<?php

namespace Tests\Feature\Finances\Characterization\KnownIssues;

use App\Enums\FormStatus;
use App\Models\Finances\Account;
use App\Models\Finances\GeneralLedger;
use App\Models\Finances\PaymentEntry;
use App\Models\Finances\PaymentSchedule;
use App\Models\Finances\SalesInvoice;
use App\Models\Inventory\Item;
use App\Models\Inventory\ItemVariant;
use App\Models\Inventory\StockEntry;
use App\Models\Inventory\StockLedgerEntry;
use App\Models\Inventory\Unit;
use App\Models\Inventory\Warehouse;
use App\Services\Finances\Audit\BalanceSnapshotService;
use App\Services\Finances\PaymentEntryService;
use App\Services\Finances\SalesInvoiceService;
use App\Services\Inventory\StockEntryService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Group;
use Tests\Support\BuildsFinanceFixtures;
use Tests\TestCase;

/**
 * Known-issue F-04 (PRD Lampiran A): membatalkan dokumen men-soft-delete baris GL dan SLE lewat hook `Submitable`,
 * tanpa jurnal pembalik, dan `accounts.balance_amount` tidak disesuaikan. Test menegaskan perilaku AKTUAL.
 */
#[Group('known-issue')]
class CancelSoftDeletesLedgerTest extends TestCase {
    use BuildsFinanceFixtures, RefreshDatabase;

    private Account $cash;
    private Account $receivable;
    private Account $sales;

    protected function setUp(): void {
        parent::setUp();

        $this->setUpFinanceFixtures([SalesInvoice::class, PaymentSchedule::class, PaymentEntry::class, Unit::class, Warehouse::class, Item::class, ItemVariant::class, StockEntry::class, StockLedgerEntry::class]);
        $this->cash       = $this->makeAccount('1100', 'Kas', 'asset', 'debit', 'cash');
        $this->receivable = $this->makeAccount('1200', 'Piutang Usaha', 'asset', 'debit', 'accounts_receivable');
        $this->sales      = $this->makeAccount('4000', 'Penjualan', 'income', 'credit', 'sales');
    }

    private function assertSoftDeletedWithoutReversal($document, int $expectedRows): void {
        $rows = $this->ledgerOf($document);

        $this->assertCount($expectedRows, $rows, 'Tidak ada baris jurnal pembalik: jumlah baris tetap.');
        $this->assertTrue($rows->every(fn (GeneralLedger $row) => $row->deleted_at !== null), 'Semua baris GL di-soft-delete.');
        $this->assertSame(0, GeneralLedger::where('referenceable_type', $document::class)->where('referenceable_id', $document->getKey())->count(), 'Laporan standar tidak melihat baris apa pun.');
    }

    public function test_f04_cancel_sales_invoice_soft_deletes_ledger_and_leaves_posting_status_posted(): void {
        $invoice = $this->makeSalesInvoice($this->receivable, $this->sales);
        app(SalesInvoiceService::class)->onApproved($invoice);
        $this->assertCount(2, $this->ledgerOf($invoice));

        app(SalesInvoiceService::class)->cancel($invoice->fresh());

        $this->assertContains(FormStatus::CANCELED, $invoice->fresh()->status);
        $this->assertSoftDeletedWithoutReversal($invoice, 2);
        $this->assertPostingStatus($invoice, 'posted');
    }

    public function test_f04_cancel_payment_entry_soft_deletes_ledger_without_reversal(): void {
        $invoice = $this->makeUnpaidSalesInvoice(1_000_000);
        $payment = $this->makePaymentEntry($invoice, 1_000_000, $this->receivable, $this->cash);
        app(PaymentEntryService::class)->onApproved($payment->fresh());

        app(PaymentEntryService::class)->cancel($payment->fresh());

        // Hanya bagian GL yang masih known-issue. Pembalikan paid_amount/status/jadwal sudah diperbaiki (N-10, hotfix)
        // dan diuji di PaymentEntryCancelTest.
        $this->assertContains(FormStatus::CANCELED, $payment->fresh()->status);
        $this->assertSoftDeletedWithoutReversal($payment, 2);
    }

    public function test_f04_cancel_stock_entry_soft_deletes_gl_and_sle_but_keeps_cached_account_balances(): void {
        $stock                                                                      = $this->makeAccount('1300', 'Persediaan', 'asset', 'debit', 'stock');
        $difference                                                                 = $this->makeAccount('5900', 'Selisih Stok', 'expense', 'debit', 'stock_adjustment');
        ['warehouse' => $warehouse, 'variant' => $variant, 'itemUnit' => $itemUnit] = $this->makeInventoryFixture();

        $entry = StockEntry::create([
            'code'      => 'SE-F04', 'date' => now(), 'type' => 'item_receipt', 'status' => [FormStatus::DRAFT],
            'branch_id' => $this->branch->id, 'difference_account_id' => $difference->id,
        ]);
        $entry->items()->create(['item_id' => $variant->id, 'target_warehouse_id' => $warehouse->id, 'item_unit_id' => $itemUnit->id, 'conversion_factor' => 1, 'quantity' => 5, 'basic_rate' => 2000]);

        app(StockEntryService::class)->onApproved($entry->fresh());
        $this->assertGreaterThan(0, StockLedgerEntry::where('referenceable_id', $entry->id)->count());

        app(StockEntryService::class)->cancel($entry->fresh());

        $this->assertSoftDeletedWithoutReversal($entry, 2);
        $this->assertSame(0, StockLedgerEntry::where('referenceable_id', $entry->id)->count(), 'SLE ikut di-soft-delete.');
        $this->assertGreaterThan(0, StockLedgerEntry::withTrashed()->where('referenceable_id', $entry->id)->count());

        // F-09/F-04: saldo cache tidak dikoreksi, sehingga menyimpang dari GL aktif (yang kini kosong).
        $this->assertEqualsWithDelta(10_000, Account::find($stock->id)->balance_amount, 0.01);
        $this->assertEqualsWithDelta(-10_000, Account::find($difference->id)->balance_amount, 0.01);

        $handle = fopen('php://temp', 'w+');
        (new BalanceSnapshotService)->write($handle);
        rewind($handle);
        $header = fgetcsv($handle);
        $rows   = [];
        while (($line = fgetcsv($handle)) !== false) {
            $rows[] = array_combine($header, $line);
        }
        $row = collect($rows)->firstWhere('account_id', $stock->id);
        $this->assertSame('0.0000', $row['net']);
        $this->assertSame('-10000.0000', $row['difference'], 'Snapshot baseline menampilkan selisih cache vs GL pada akun ini.');
    }
}
