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
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Tests\Support\AssertsPostingParity;
use Tests\Support\BuildsFinanceFixtures;
use Tests\TestCase;

/**
 * Finance Fase 2 (putaran perbaikan Sprint D; diperbarui Task 14.1 dan Q-P2-23, 2026-11-22): bukti routing gateway yang
 * DISKRIMINATIF. Akun pada dokumen SENGAJA berbeda dari akun profil: engine HARUS memakai akun profil (atau akun master
 * metode pembayaran) dan bukan akun dokumen. Mode `off`/`shadow` sudah dihapus, jadi engine selalu aktif; pabrik
 * konteks Sales/Purchase Invoice/Payment Entry hanya tidak berjalan untuk dokumen penjaga yang dibatalkan.
 */
class PostingRoutingTest extends TestCase {
    use AssertsPostingParity, BuildsFinanceFixtures, RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        $this->setUpFinanceFixtures([PostingProfile::class, PostingParityLog::class, SalesInvoice::class, PurchaseInvoice::class, PurchaseOrder::class, PaymentSchedule::class, PaymentEntry::class, Unit::class, Warehouse::class, Item::class, ItemVariant::class, StockEntry::class, StockLedgerEntry::class]);
    }

    public function test_sales_invoice_and_payment_use_profile_accounts_when_document_accounts_differ_from_profile_accounts(): void {
        $docReceivable  = $this->makeAccount('1201', 'Piutang Dokumen', 'asset', 'debit', 'accounts_receivable');
        $docRevenue     = $this->makeAccount('4001', 'Penjualan Dokumen', 'income', 'credit', 'sales');
        $profReceivable = $this->makeAccount('1210', 'Piutang Profil', 'asset');
        $profRevenue    = $this->makeAccount('4010', 'Penjualan Profil', 'income', 'credit');
        $docCashTo      = $this->makeAccount('1101', 'Kas Dokumen', 'asset', 'debit', 'cash');
        $docPaidFrom    = $this->makeAccount('1202', 'Piutang Dokumen 2', 'asset', 'debit');
        $methodCash     = $this->makeAccount('1110', 'Kas Metode Bayar', 'asset', 'debit', 'cash');
        $method         = PaymentMethod::create(['name' => 'Kas Tunai', 'default_account_id' => $methodCash->id]);
        $this->activateParityProfile(['receivable' => $profReceivable, 'revenue' => $profRevenue]);

        $invoice = $this->makeSalesInvoice($docReceivable, $docRevenue);
        $sales   = $this->makeUnpaidSalesInvoice(1_000_000);
        $payment = $this->makePaymentEntry($sales, 400_000, $docPaidFrom, $docCashTo, ['payment_method_id' => $method->id]);

        app(SalesInvoiceService::class)->onApproved($invoice);
        app(PaymentEntryService::class)->onApproved($payment->fresh());

        $invoiceLines = array_map(fn (array $j): array => array_column($j['lines'], 0), $this->journalSignature($invoice->fresh()));
        $paymentLines = array_map(fn (array $j): array => array_column($j['lines'], 0), $this->journalSignature($payment));

        // Akun profil (invoice) dan akun master + profil (payment), bukan akun yang dipilih pada dokumen.
        $this->assertSame(['default' => ['1210', '4010']], $invoiceLines, 'Engine memakai akun profil, bukan akun dokumen.');
        $this->assertSame(['default' => ['1110', '1210']], $paymentLines, 'Debit akun master metode bayar, kredit piutang profil.');
        $this->assertNull($this->parityLogStatus($invoice->fresh()), 'Tidak ada catatan parity.');
        $this->assertNull($this->parityLogStatus($payment), 'Tidak ada catatan parity.');
    }

    public function test_invoice_context_is_built_for_sales_and_purchase_invoice_unless_the_guard_document_is_canceled(): void {
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

        // Dokumen dibatalkan: guard melewati posting SEBELUM pabrik konteks berjalan, jadi baris invoice tidak dibaca.
        $sales    = $makeSales();
        $purchase = $makePurchase();
        $sales->update(['status' => [FormStatus::CANCELED]]);
        $purchase->update(['status' => [FormStatus::CANCELED]]);
        $this->assertSame(0, $queriesTouching('sales_invoice_items', fn () => $salesRun($sales)), 'Canceled: tidak ada query baris Sales Invoice.');
        $this->assertSame(0, $queriesTouching('purchase_invoice_items', fn () => $purchaseRun($purchase)), 'Canceled: tidak ada query baris Purchase Invoice.');

        // Dokumen aktif: konteks dibangun (baris invoice dibaca).
        $sales    = $makeSales();
        $purchase = $makePurchase();
        $this->assertGreaterThan(0, $queriesTouching('sales_invoice_items', fn () => $salesRun($sales)), 'Konteks Sales Invoice dibangun.');
        $this->assertGreaterThan(0, $queriesTouching('purchase_invoice_items', fn () => $purchaseRun($purchase)), 'Konteks Purchase Invoice dibangun.');
    }

    public function test_payment_context_is_built_once_on_approval(): void {
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

        $builds = function () use ($paidFrom, $paidTo, $method, $spy): int {
            $sales   = $this->makeUnpaidSalesInvoice(1_000_000);
            $payment = $this->makePaymentEntry($sales, 400_000, $paidFrom, $paidTo, ['payment_method_id' => $method->id])->fresh();

            $before = $spy->fullContextBuilds;
            app(PaymentEntryService::class)->onApproved($payment);

            return $spy->fullContextBuilds - $before;
        };

        $this->assertSame(1, $builds(), 'Konteks penuh dibangun satu kali.');
    }

    public function test_sales_invoice_listener_ends_failed_with_the_unresolved_role_message(): void {
        $recv = $this->makeAccount('1200', 'Piutang', 'asset', 'debit', 'accounts_receivable');
        $rev  = $this->makeAccount('4000', 'Penjualan', 'income', 'credit', 'sales');
        // Profil aktif tanpa pemetaan peran: engine selalu aktif dan menolak dengan peran yang tidak ter-resolve.
        $this->activateParityProfile([]);

        $invoice = $this->makeSalesInvoice($recv, $rev);
        GlPostingStatus::create(['referenceable_type' => SalesInvoice::class, 'referenceable_id' => $invoice->id, 'status' => FormStatus::PENDING]);

        $event    = new SalesInvoiceGeneralLedgerPostingRequested($invoice, 2183.33, false, now(), $recv->id, $rev->id);
        $listener = new PostSalesInvoiceGeneralLedger;

        // Job listener: handle() melempar, queue worker lalu memanggil failed() dengan exception itu.
        try {
            $listener->handle($event);
            $this->fail('Peran yang tidak ter-resolve harus menggagalkan posting.');
        } catch (UnresolvedAccountRoleException $e) {
            $listener->failed($event, $e);
        }

        $row = GlPostingStatus::where('referenceable_type', SalesInvoice::class)->where('referenceable_id', $invoice->id)->firstOrFail();
        $this->assertSame(FormStatus::FAILED->value, $row->status instanceof \BackedEnum ? $row->status->value : $row->status);
        $this->assertSame(1, (int) $row->retry_count);
        $this->assertSame($e->getMessage(), $row->last_error);
        $this->assertSame([], $this->journalSignature($invoice->fresh()));
        $this->assertNull($this->parityLogStatus($invoice->fresh()));
    }

    private function makeAccountOnce(string $number): Account {
        return Account::query()->where('account_number', $number)->firstOrFail();
    }

    public function test_sales_invoice_without_document_accounts_posts_through_the_profile(): void {
        $recv    = $this->makeAccount('1210', 'Piutang Profil', 'asset', 'debit', 'accounts_receivable');
        $rev     = $this->makeAccount('4010', 'Penjualan Profil', 'income', 'credit', 'sales');
        $payable = $this->makeAccount('2000', 'Utang', 'liability', 'credit', 'accounts_payable');
        $srnb    = $this->makeAccount('2100', 'SRNB', 'liability', 'credit', 'stock_received_but_not_billed');
        $stock   = $this->makeAccount('1300', 'Persediaan', 'asset', 'debit', 'stock');
        $this->activateParityProfile(['receivable' => $recv, 'revenue' => $rev, 'payable' => $payable, 'expense' => $srnb, 'stock' => $stock, 'stock_received_but_not_billed' => $srnb]);

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

    public function test_payment_entry_without_document_accounts_posts_through_the_profile(): void {
        $methodCash = $this->makeAccount('1110', 'Kas Metode Bayar', 'asset', 'debit', 'cash');
        $receivable = $this->makeAccount('1210', 'Piutang Profil', 'asset');
        $payable    = $this->makeAccount('2010', 'Utang Profil', 'liability', 'credit');
        $method     = PaymentMethod::create(['name' => 'Kas Tunai', 'default_account_id' => $methodCash->id]);
        $this->activateParityProfile(['receivable' => $receivable, 'payable' => $payable]);

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

    public function test_payment_entry_with_unresolved_role_fails_with_a_clear_message_and_rolls_back(): void {
        config(['finance.posting.legacy_account_fallback' => false]);
        $methodCash = $this->makeAccount('1110', 'Kas Metode Bayar', 'asset', 'debit', 'cash');
        $method     = PaymentMethod::create(['name' => 'Kas Tunai', 'default_account_id' => $methodCash->id]);
        $this->activateParityProfile([]);

        $sales   = $this->makeUnpaidSalesInvoice(1_000_000);
        $payment = $this->makePaymentEntry($sales, 400_000, $methodCash, $methodCash, ['payment_method_id' => $method->id, 'account_paid_to_id' => null, 'account_paid_from_id' => null]);

        try {
            app(PaymentEntryService::class)->onApproved($payment->fresh());
            $this->fail('Peran receivable yang tidak ter-resolve harus menggagalkan approve.');
        } catch (ValidationException $e) {
            $message = $e->errors()['status'][0];
            $this->assertStringContainsString('receivable', $message);
            $this->assertStringContainsString(PostingDocumentType::PaymentEntry->value, $message);
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

    public function test_stock_entry_without_document_accounts_posts_through_the_profile(): void {
        $stock      = $this->makeAccount('1300', 'Persediaan', 'asset', 'debit', 'stock');
        $difference = $this->makeAccount('5900', 'Selisih Stok', 'expense', 'debit', 'stock_adjustment');
        $freight    = $this->makeAccount('5800', 'Biaya Angkut', 'expense', 'debit');
        $this->activateParityProfile(['stock' => $stock, 'stock_adjustment' => $difference, 'expense_included_in_valuation' => $freight]);

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

    public function test_stock_entry_with_unresolved_role_fails_with_a_clear_message_and_rolls_back(): void {
        config(['finance.posting.legacy_account_fallback' => false]);
        $this->activateParityProfile([]);

        $entry = $this->receiptWithoutAccounts()['entry'];

        try {
            app(StockEntryService::class)->onApproved($entry);
            $this->fail('Peran akun yang tidak ter-resolve harus menggagalkan approve.');
        } catch (ValidationException $e) {
            $message = $e->errors()['status'][0];
            $this->assertStringContainsString('stock', $message);
            $this->assertStringContainsString(PostingDocumentType::StockEntry->value, $message);
        }

        $this->assertSame(0, StockLedgerEntry::count(), 'Mutasi stok digulung bersama transaksi approve.');
        $this->assertSame([], $this->journalSignature($entry));
    }
}
