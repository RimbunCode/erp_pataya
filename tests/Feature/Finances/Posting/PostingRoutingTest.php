<?php

namespace Tests\Feature\Finances\Posting;

use App\Enums\FormStatus;
use App\Enums\PostingDocumentType;
use App\Events\Finances\PurchaseInvoiceGeneralLedgerPostingRequested;
use App\Events\Finances\SalesInvoiceGeneralLedgerPostingRequested;
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
use App\Models\Inventory\ItemVariant;
use App\Models\Model as BaseModel;
use App\Models\Purchase\PurchaseOrder;
use App\Services\Finances\Accounting\PaymentEntryPostingContextFactory;
use App\Services\Finances\PaymentEntryService;
use App\Services\Finances\Posting\Contexts\PostingContext;
use App\Services\Finances\SalesInvoiceService;
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

        $this->setUpFinanceFixtures([PostingProfile::class, PostingParityLog::class, SalesInvoice::class, PurchaseInvoice::class, PurchaseOrder::class, PaymentSchedule::class, PaymentEntry::class]);
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
}
