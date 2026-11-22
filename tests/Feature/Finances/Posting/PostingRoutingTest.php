<?php

namespace Tests\Feature\Finances\Posting;

use App\Enums\FormStatus;
use App\Enums\PostingDocumentType;
use App\Events\Finances\PurchaseInvoiceGeneralLedgerPostingRequested;
use App\Events\Finances\SalesInvoiceGeneralLedgerPostingRequested;
use App\Exceptions\Finances\UnresolvedAccountRoleException;
use App\Listeners\Finances\Ledger\PostPurchaseInvoiceGeneralLedger;
use App\Listeners\Finances\Ledger\PostSalesInvoiceGeneralLedger;
use App\Models\Core\GlPostingStatus;
use App\Models\Finances\Account;
use App\Models\Finances\PaymentEntry;
use App\Models\Finances\PaymentMethod;
use App\Models\Finances\PaymentSchedule;
use App\Models\Finances\PostingParityLog;
use App\Models\Finances\PostingProfile;
use App\Models\Finances\PurchaseInvoice;
use App\Models\Finances\PurchaseInvoiceItem;
use App\Models\Finances\SalesInvoice;
use App\Models\Inventory\Item;
use App\Models\Inventory\ItemUnit;
use App\Models\Inventory\ItemVariant;
use App\Models\Inventory\StockEntry;
use App\Models\Inventory\StockLedgerEntry;
use App\Models\Inventory\Unit;
use App\Models\Inventory\Warehouse;
use App\Models\Model as BaseModel;
use App\Models\Purchase\PurchaseOrder;
use App\Services\Finances\Accounting\PaymentEntryPostingContextFactory;
use App\Services\Finances\PaymentEntryService;
use App\Services\Finances\Posting\Contexts\PostingContext;
use App\Services\Finances\SalesInvoiceService;
use App\Services\Inventory\StockEntryService;
use Illuminate\Database\DeadlockException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\Support\AssertsPostingParity;
use Tests\Support\BuildsFinanceFixtures;
use Tests\TestCase;

/**
 * Finance Fase 2 (putaran perbaikan Sprint D): bukti routing gateway yang DISKRIMINATIF. Pada parity test kelompok 1 dan
 * 2 akun dokumen dan akun profil sama, sehingga `on` yang secara keliru masih memakai jalur lama tidak terdeteksi. Di sini
 * akun pada dokumen SENGAJA berbeda dari akun profil: `off` memakai akun dokumen, `on` HARUS memakai akun profil
 * (atau akun master metode pembayaran), `shadow` memakai akun dokumen dan mencatat `config_diff`. Juga membuktikan pabrik
 * konteks Sales/Purchase Invoice tidak berjalan pada `off` (Requirement 6.2).
 */
class PostingRoutingTest extends TestCase {
    use AssertsPostingParity, BuildsFinanceFixtures, RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        $this->setUpFinanceFixtures([PostingProfile::class, PostingParityLog::class, SalesInvoice::class, PurchaseInvoice::class, PurchaseOrder::class, PaymentSchedule::class, PaymentEntry::class, Unit::class, Warehouse::class, Item::class, ItemVariant::class, StockEntry::class, StockLedgerEntry::class]);
    }

    public function test_sales_invoice_and_payment_follow_the_mode_when_document_accounts_differ_from_profile_accounts(): void {
        $docReceivable  = $this->makeAccount('1201', 'Piutang Dokumen', 'asset', 'debit', 'accounts_receivable');
        $docRevenue     = $this->makeAccount('4001', 'Penjualan Dokumen', 'income', 'credit', 'sales');
        $profReceivable = $this->makeAccount('1210', 'Piutang Profil', 'asset');
        $profRevenue    = $this->makeAccount('4010', 'Penjualan Profil', 'income', 'credit');
        $docCashTo      = $this->makeAccount('1101', 'Kas Dokumen', 'asset', 'debit', 'cash');
        $docPaidFrom    = $this->makeAccount('1202', 'Piutang Dokumen 2', 'asset', 'debit');
        $methodCash     = $this->makeAccount('1110', 'Kas Metode Bayar', 'asset', 'debit', 'cash');
        $method         = PaymentMethod::create(['name' => 'Kas Tunai', 'default_account_id' => $methodCash->id]);
        $this->activateParityProfile(['receivable' => $profReceivable, 'revenue' => $profRevenue]);

        $signatures = [];
        $statuses   = [];
        foreach (['off', 'shadow', 'on'] as $mode) {
            $this->setPostingMode(PostingDocumentType::SalesInvoice, $mode);
            $this->setPostingMode(PostingDocumentType::PaymentEntry, $mode);

            $invoice = $this->makeSalesInvoice($docReceivable, $docRevenue);
            app(SalesInvoiceService::class)->onApproved($invoice);

            $sales   = $this->makeUnpaidSalesInvoice(1_000_000);
            $payment = $this->makePaymentEntry($sales, 400_000, $docPaidFrom, $docCashTo, ['payment_method_id' => $method->id]);
            app(PaymentEntryService::class)->onApproved($payment->fresh());

            $signatures['invoice'][$mode] = array_map(fn (array $j): array => array_column($j['lines'], 0), $this->journalSignature($invoice->fresh()));
            $signatures['payment'][$mode] = array_map(fn (array $j): array => array_column($j['lines'], 0), $this->journalSignature($payment));
            $statuses[$mode]              = [$this->parityLogStatus($invoice->fresh()), $this->parityLogStatus($payment)];
        }

        // off dan shadow: akun yang dipilih pada dokumen. on: akun profil (invoice) dan akun master + profil (payment).
        $this->assertSame(['default' => ['1201', '4001']], $signatures['invoice']['off']);
        $this->assertSame(['default' => ['1201', '4001']], $signatures['invoice']['shadow']);
        $this->assertSame(['default' => ['1210', '4010']], $signatures['invoice']['on'], 'on memakai akun profil, bukan akun dokumen.');
        $this->assertSame(['default' => ['1101', '1202']], $signatures['payment']['off']);
        $this->assertSame(['default' => ['1101', '1202']], $signatures['payment']['shadow']);
        $this->assertSame(['default' => ['1110', '1210']], $signatures['payment']['on'], 'on: debit akun master metode bayar, kredit piutang profil.');

        // shadow mencatat perbedaan konfigurasi (bukan mismatch) untuk dokumen yang akunnya dipilih pengguna.
        $this->assertSame(['config_diff', 'config_diff'], $statuses['shadow']);
        $this->assertSame([null, null], $statuses['off']);
        $this->assertSame([null, null], $statuses['on']);
    }

    public function test_invoice_context_is_not_built_in_off_mode_for_sales_and_purchase_invoice(): void {
        $recv    = $this->makeAccount('1200', 'Piutang', 'asset', 'debit', 'accounts_receivable');
        $rev     = $this->makeAccount('4000', 'Penjualan', 'income', 'credit', 'sales');
        $payable = $this->makeAccount('2000', 'Utang', 'liability', 'credit', 'accounts_payable');
        $srnb    = $this->makeAccount('2100', 'SRNB', 'liability', 'credit', 'stock_received_but_not_billed');
        $stock   = $this->makeAccount('1300', 'Persediaan', 'asset', 'debit', 'stock');
        $this->activateParityProfile(['receivable' => $recv, 'revenue' => $rev, 'payable' => $payable, 'expense' => $srnb, 'stock' => $stock, 'stock_received_but_not_billed' => $srnb]);

        $po = BaseModel::withoutEvents(fn () => PurchaseOrder::create(['code' => 'PO-ROUTE-1', 'date' => now(), 'status' => [FormStatus::SUBMITTED], 'created_by_id' => $this->user->id]));

        $salesRun = function (SalesInvoice $invoice) use ($recv, $rev): void {
            (new PostSalesInvoiceGeneralLedger)->handle(new SalesInvoiceGeneralLedgerPostingRequested($invoice, 2183.33, false, now(), $recv->id, $rev->id));
        };
        $purchaseRun = function (PurchaseInvoice $invoice) use ($payable, $srnb): void {
            (new PostPurchaseInvoiceGeneralLedger)->handle(new PurchaseInvoiceGeneralLedgerPostingRequested($invoice, 0.0, 2183.33, false, now(), $srnb->id, $payable->id));
        };

        $queriesTouching = function (string $table, \Closure $run) {
            $sql = [];
            DB::listen(function ($query) use (&$sql): void {
                $sql[] = $query->sql;
            });
            $run();

            return \count(array_filter($sql, fn (string $statement): bool => str_contains($statement, '"' . $table . '"')));
        };

        $makeSales = function (): SalesInvoice {
            $invoice = $this->makeSalesInvoice($this->makeAccountOnce('1200'), $this->makeAccountOnce('4000'));
            GlPostingStatus::create(['referenceable_type' => SalesInvoice::class, 'referenceable_id' => $invoice->id, 'status' => FormStatus::PENDING]);

            return $invoice;
        };
        $makePurchase = function () use ($po, $payable, $srnb): PurchaseInvoice {
            $invoice = PurchaseInvoice::create(['date' => now(), 'expanse_head_account_id' => $srnb->id, 'credit_account_id' => $payable->id, 'purchase_order_id' => $po->id, 'branch_id' => $this->branch->id, 'status' => [FormStatus::SUBMITTED]]);
            PurchaseInvoiceItem::create(['purchase_invoice_id' => $invoice->id, 'item_id' => ItemVariant::factory()->create()->id, 'quantity' => 2, 'rate' => 1000, 'tax_rate' => 10]);
            GlPostingStatus::create(['referenceable_type' => PurchaseInvoice::class, 'referenceable_id' => $invoice->id, 'status' => FormStatus::PENDING]);

            return $invoice;
        };

        // off: baris invoice tidak dibaca pabrik konteks.
        $sales    = $makeSales();
        $purchase = $makePurchase();
        $this->assertSame(0, $queriesTouching('sales_invoice_items', fn () => $salesRun($sales)), 'off: tidak ada query baris Sales Invoice.');
        $this->assertSame(0, $queriesTouching('purchase_invoice_items', fn () => $purchaseRun($purchase)), 'off: tidak ada query baris Purchase Invoice.');

        // shadow dan on: konteks dibangun (baris invoice dibaca).
        foreach (['shadow', 'on'] as $mode) {
            $this->setPostingMode(PostingDocumentType::SalesInvoice, $mode);
            $this->setPostingMode(PostingDocumentType::PurchaseInvoice, $mode);
            $sales    = $makeSales();
            $purchase = $makePurchase();
            $this->assertGreaterThan(0, $queriesTouching('sales_invoice_items', fn () => $salesRun($sales)), "{$mode}: konteks Sales Invoice dibangun.");
            $this->assertGreaterThan(0, $queriesTouching('purchase_invoice_items', fn () => $purchaseRun($purchase)), "{$mode}: konteks Purchase Invoice dibangun.");
        }
    }

    public function test_payment_context_is_not_built_in_off_mode_but_is_built_for_shadow_and_on(): void {
        $paidFrom   = $this->makeAccount('1202', 'Piutang Dokumen', 'asset', 'debit');
        $paidTo     = $this->makeAccount('1101', 'Kas Dokumen', 'asset', 'debit', 'cash');
        $methodCash = $this->makeAccount('1110', 'Kas Metode Bayar', 'asset', 'debit', 'cash');
        $receivable = $this->makeAccount('1210', 'Piutang Profil', 'asset');
        $method     = PaymentMethod::create(['name' => 'Kas Tunai', 'default_account_id' => $methodCash->id]);
        $this->activateParityProfile(['receivable' => $receivable]);

        // Query `payment_methods` tidak diskriminatif (alokasi jadwal juga memuatnya): hitung pemanggilan pabrik konteks
        // lewat spy yang meneruskan ke pabrik asli.
        $spy = new class(app(PaymentEntryPostingContextFactory::class))
        {
            public int $fullContextBuilds = 0;

            public function __construct(private PaymentEntryPostingContextFactory $real) {}

            public function forGuard(PaymentEntry $paymentEntry): PostingContext {
                return $this->real->forGuard($paymentEntry);
            }

            public function forApproval(PaymentEntry $paymentEntry): PostingContext {
                $this->fullContextBuilds++;

                return $this->real->forApproval($paymentEntry);
            }
        };
        $this->app->instance(PaymentEntryPostingContextFactory::class, $spy);

        $builds = function (string $mode) use ($paidFrom, $paidTo, $method, $spy): int {
            $this->setPostingMode(PostingDocumentType::PaymentEntry, $mode);
            $sales   = $this->makeUnpaidSalesInvoice(1_000_000);
            $payment = $this->makePaymentEntry($sales, 400_000, $paidFrom, $paidTo, ['payment_method_id' => $method->id])->fresh();

            $before = $spy->fullContextBuilds;
            app(PaymentEntryService::class)->onApproved($payment);

            return $spy->fullContextBuilds - $before;
        };

        $this->assertSame(0, $builds('off'), 'off: pabrik konteks penuh Payment Entry tidak berjalan.');
        $this->assertSame(1, $builds('shadow'), 'shadow: konteks dibangun.');
        $this->assertSame(1, $builds('on'), 'on: konteks dibangun.');
    }

    public function test_sales_invoice_listener_in_shadow_propagates_a_deadlock_from_the_parity_insert_and_keeps_status_pending(): void {
        $recv = $this->makeAccount('1200', 'Piutang', 'asset', 'debit', 'accounts_receivable');
        $rev  = $this->makeAccount('4000', 'Penjualan', 'income', 'credit', 'sales');
        $this->activateParityProfile(['receivable' => $recv, 'revenue' => $rev]);
        $this->setPostingMode(PostingDocumentType::SalesInvoice, 'shadow');

        $invoice = $this->makeSalesInvoice($recv, $rev);
        GlPostingStatus::create(['referenceable_type' => SalesInvoice::class, 'referenceable_id' => $invoice->id, 'status' => FormStatus::PENDING]);

        $deadlock = new DeadlockException('Deadlock found when trying to get lock');
        $this->failParityLogInserts([$deadlock]);

        try {
            (new PostSalesInvoiceGeneralLedger)->handle(new SalesInvoiceGeneralLedgerPostingRequested($invoice, 2183.33, false, now(), $recv->id, $rev->id));
            $this->fail('Deadlock pada insert parity harus muncul dari listener, bukan menghasilkan POSTED tanpa jurnal.');
        } catch (\Throwable $caught) {
            $chain = [];
            for ($e = $caught; $e !== null; $e = $e->getPrevious()) {
                $chain[] = $e;
            }
            $this->assertContains($deadlock, $chain);
        }

        $status = GlPostingStatus::where('referenceable_type', SalesInvoice::class)->where('referenceable_id', $invoice->id)->firstOrFail()->status;
        $this->assertSame(FormStatus::PENDING->value, $status instanceof \BackedEnum ? $status->value : $status);
    }

    private function makeAccountOnce(string $number): Account {
        return Account::query()->where('account_number', $number)->firstOrFail();
    }

    public function test_sales_invoice_without_document_accounts_posts_through_the_profile_when_mode_is_on(): void {
        $recv    = $this->makeAccount('1210', 'Piutang Profil', 'asset', 'debit', 'accounts_receivable');
        $rev     = $this->makeAccount('4010', 'Penjualan Profil', 'income', 'credit', 'sales');
        $payable = $this->makeAccount('2000', 'Utang', 'liability', 'credit', 'accounts_payable');
        $srnb    = $this->makeAccount('2100', 'SRNB', 'liability', 'credit', 'stock_received_but_not_billed');
        $stock   = $this->makeAccount('1300', 'Persediaan', 'asset', 'debit', 'stock');
        $this->activateParityProfile(['receivable' => $recv, 'revenue' => $rev, 'payable' => $payable, 'expense' => $srnb, 'stock' => $stock, 'stock_received_but_not_billed' => $srnb]);
        $this->setPostingMode(PostingDocumentType::SalesInvoice, 'on');
        $this->setPostingMode(PostingDocumentType::PurchaseInvoice, 'on');

        // Task 12.3: dokumen dibuat tanpa akun (form tidak lagi meminta), kolom akun null.
        $invoice = $this->makeSalesInvoice($recv, $rev, ['debit_account_id' => null, 'income_account_id' => null]);
        $this->assertNull($invoice->debit_account_id);
        app(SalesInvoiceService::class)->onApproved($invoice);

        $this->assertSame(['default' => ['1210', '4010']], array_map(fn (array $j): array => array_column($j['lines'], 0), $this->journalSignature($invoice->fresh())));

        $po       = BaseModel::withoutEvents(fn () => PurchaseOrder::create(['code' => 'PO-NOACC-1', 'date' => now(), 'status' => [FormStatus::SUBMITTED], 'created_by_id' => $this->user->id]));
        $purchase = PurchaseInvoice::create(['date' => now(), 'purchase_order_id' => $po->id, 'branch_id' => $this->branch->id, 'status' => [FormStatus::SUBMITTED]]);
        PurchaseInvoiceItem::create(['purchase_invoice_id' => $purchase->id, 'item_id' => ItemVariant::factory()->create()->id, 'quantity' => 2, 'rate' => 1000, 'tax_rate' => 10]);
        GlPostingStatus::create(['referenceable_type' => PurchaseInvoice::class, 'referenceable_id' => $purchase->id, 'status' => FormStatus::PENDING]);
        (new PostPurchaseInvoiceGeneralLedger)->handle(new PurchaseInvoiceGeneralLedgerPostingRequested($purchase, 0.0, 2183.33, false, now(), null, null));

        $this->assertNotEmpty($this->journalSignature($purchase->fresh()), 'Purchase Invoice tanpa akun dokumen tetap terposting lewat engine.');
    }

    public function test_payment_entry_without_document_accounts_posts_through_the_profile_when_mode_is_on(): void {
        $methodCash = $this->makeAccount('1110', 'Kas Metode Bayar', 'asset', 'debit', 'cash');
        $receivable = $this->makeAccount('1210', 'Piutang Profil', 'asset');
        $payable    = $this->makeAccount('2010', 'Utang Profil', 'liability', 'credit');
        $method     = PaymentMethod::create(['name' => 'Kas Tunai', 'default_account_id' => $methodCash->id]);
        $this->activateParityProfile(['receivable' => $receivable, 'payable' => $payable]);
        $this->setPostingMode(PostingDocumentType::PaymentEntry, 'on');

        // Task 12.3: Payment Entry dibuat tanpa akun (form tidak lagi meminta), kolom akun null.
        $sales   = $this->makeUnpaidSalesInvoice(1_000_000);
        $receive = $this->makePaymentEntry($sales, 400_000, $methodCash, $methodCash, ['payment_method_id' => $method->id, 'account_paid_to_id' => null, 'account_paid_from_id' => null]);
        $this->assertNull($receive->fresh()->account_paid_to_id);
        $this->assertNull($receive->fresh()->account_paid_from_id);
        app(PaymentEntryService::class)->onApproved($receive->fresh());

        $this->assertSame(['default' => ['1110', '1210']], array_map(fn (array $j): array => array_column($j['lines'], 0), $this->journalSignature($receive)), 'receive: debit akun master metode bayar, kredit piutang profil.');
        $this->assertContains(FormStatus::PAID, $receive->fresh()->status);

        $purchase = $this->makeUnpaidPurchaseInvoice(500_000);
        $pay      = $this->makePaymentEntry($purchase, 200_000, $methodCash, $methodCash, ['payment_method_id' => $method->id, 'account_paid_to_id' => null, 'account_paid_from_id' => null]);
        app(PaymentEntryService::class)->onApproved($pay->fresh());

        $this->assertSame(['default' => ['2010', '1110']], array_map(fn (array $j): array => array_column($j['lines'], 0), $this->journalSignature($pay)), 'pay: debit utang profil, kredit akun master metode bayar.');
    }

    public function test_payment_entry_with_unresolved_role_in_on_mode_fails_with_a_clear_message_and_rolls_back(): void {
        config(['finance.posting.legacy_account_fallback' => false]);
        $methodCash = $this->makeAccount('1110', 'Kas Metode Bayar', 'asset', 'debit', 'cash');
        $method     = PaymentMethod::create(['name' => 'Kas Tunai', 'default_account_id' => $methodCash->id]);
        $this->activateParityProfile([]);
        $this->setPostingMode(PostingDocumentType::PaymentEntry, 'on');

        $sales   = $this->makeUnpaidSalesInvoice(1_000_000);
        $payment = $this->makePaymentEntry($sales, 400_000, $methodCash, $methodCash, ['payment_method_id' => $method->id, 'account_paid_to_id' => null, 'account_paid_from_id' => null]);

        try {
            app(PaymentEntryService::class)->onApproved($payment->fresh());
            $this->fail('Peran receivable yang tidak ter-resolve harus menggagalkan approve.');
        } catch (UnresolvedAccountRoleException $e) {
            $this->assertSame('receivable', $e->role);
            $this->assertStringContainsString('receivable', $e->getMessage());
            $this->assertStringContainsString(PostingDocumentType::PaymentEntry->value, $e->getMessage());
        }

        $this->assertContains(FormStatus::DRAFT, $payment->fresh()->status, 'Approve digulung: Payment Entry tetap draft.');
        $this->assertEqualsWithDelta(0, (float) $sales->fresh()->paid_amount, 0.01, 'Penerapan pembayaran ke invoice ikut digulung.');
        $this->assertSame([], $this->journalSignature($payment));
    }

    /**
     * @return array{warehouse: Warehouse, variant: ItemVariant, itemUnit: ItemUnit}
     */
    private function receiptWithoutAccounts(): array {
        $inventory = $this->makeInventoryFixture();
        $entry     = StockEntry::create([
            'code'      => 'SE-NOACC-1',
            'date'      => now()->subDays(4),
            'type'      => 'item_receipt',
            'status'    => [FormStatus::DRAFT],
            'branch_id' => $this->branch->id,
        ]);
        $entry->items()->create([
            'item_id'             => $inventory['variant']->id,
            'item_unit_id'        => $inventory['itemUnit']->id,
            'conversion_factor'   => 1,
            'quantity'            => 5,
            'basic_rate'          => 2000,
            'target_warehouse_id' => $inventory['warehouse']->id,
        ]);
        $entry->additionalCosts()->create(['purpose' => 'Angkut', 'amount' => 300]);

        return [...$inventory, 'entry' => $entry->fresh()];
    }

    public function test_stock_entry_without_document_accounts_posts_through_the_profile_when_mode_is_on(): void {
        $stock      = $this->makeAccount('1300', 'Persediaan', 'asset', 'debit', 'stock');
        $difference = $this->makeAccount('5900', 'Selisih Stok', 'expense', 'debit', 'stock_adjustment');
        $freight    = $this->makeAccount('5800', 'Biaya Angkut', 'expense', 'debit');
        $this->activateParityProfile(['stock' => $stock, 'stock_adjustment' => $difference, 'expense_included_in_valuation' => $freight]);
        $this->setPostingMode(PostingDocumentType::StockEntry, 'on');

        // Task 12.3: Stock Entry dan biaya tambahannya dibuat tanpa akun (form tidak lagi meminta), kolom akun null.
        $fixture = $this->receiptWithoutAccounts();
        $entry   = $fixture['entry'];
        $this->assertNull($entry->difference_account_id);
        $this->assertNull($entry->additionalCosts()->firstOrFail()->expense_account_id);

        app(StockEntryService::class)->onApproved($entry);

        $signature = $this->journalSignature($entry->fresh());
        ksort($signature);
        $purposes = array_keys($signature);
        $this->assertCount(2, $purposes);
        $this->assertSame('default', $purposes[1]);
        $this->assertStringStartsWith('additional_cost:', $purposes[0]);
        $this->assertSame([['1300', 10_000.0, 0.0], ['5900', 0.0, 10_000.0]], $signature['default']['lines'], 'Stock Entry tanpa akun selisih tetap terposting lewat profil.');
        $this->assertSame([['1300', 300.0, 0.0], ['5800', 0.0, 300.0]], $signature[$purposes[0]]['lines'], 'Biaya tambahan tanpa akun biaya tetap terposting lewat profil.');
    }

    public function test_stock_entry_with_unresolved_role_in_on_mode_fails_with_a_clear_message_and_rolls_back(): void {
        config(['finance.posting.legacy_account_fallback' => false]);
        $this->activateParityProfile([]);
        $this->setPostingMode(PostingDocumentType::StockEntry, 'on');

        $entry = $this->receiptWithoutAccounts()['entry'];

        try {
            app(StockEntryService::class)->onApproved($entry);
            $this->fail('Peran akun yang tidak ter-resolve harus menggagalkan approve.');
        } catch (UnresolvedAccountRoleException $e) {
            $this->assertNotSame('', $e->role);
            $this->assertStringContainsString($e->role, $e->getMessage());
            $this->assertStringContainsString(PostingDocumentType::StockEntry->value, $e->getMessage());
        }

        $this->assertSame(0, StockLedgerEntry::count(), 'Mutasi stok digulung bersama transaksi approve.');
        $this->assertSame([], $this->journalSignature($entry));
    }
}
