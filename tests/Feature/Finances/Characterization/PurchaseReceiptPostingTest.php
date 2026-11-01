<?php

namespace Tests\Feature\Finances\Characterization;

use App\Enums\FormStatus;
use App\Events\Purchase\PurchaseReceiptGeneralLedgerPostingRequested;
use App\Listeners\Purchase\Ledger\PostPurchaseReceiptGeneralLedger;
use App\Models\Core\GlPostingStatus;
use App\Models\Finances\Account;
use App\Models\Purchase\PurchaseReceipt;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Support\BuildsFinanceFixtures;
use Tests\TestCase;

/**
 * Characterization Fase 0 (titik posting #3, Lampiran B PRD): Purchase Receipt.
 *
 * Dikunci di batas event: `totalRatesForGL` adalah keluaran valuasi stok (`PurchaseReceiptService::onApproved`,
 * sudah dicakup test FIFO/SLE), dan valuasi tidak termasuk refactor posting Fase 2. Receipt hanya memposting GL
 * bila ada nilai tagihan (`totalRatesForGL > 0`) atau retur; receipt yang diterima sebelum ditagih tidak
 * menghasilkan GL (jurnalnya muncul lewat Purchase Invoice, cabang stok/SRNB).
 */
class PurchaseReceiptPostingTest extends TestCase {
    use BuildsFinanceFixtures, RefreshDatabase;

    private Account $stock;
    private Account $srnb;

    protected function setUp(): void {
        parent::setUp();

        $this->setUpFinanceFixtures();
        $this->stock = $this->makeAccount('1300', 'Persediaan', 'asset', 'debit', 'stock');
        $this->srnb  = $this->makeAccount('2100', 'SRNB', 'liability', 'credit', 'stock_received_but_not_billed');
    }

    private function makeReceipt(): PurchaseReceipt {
        $id = (string) Str::ulid();
        DB::table('purchase_receipts')->insert(['id' => $id, 'date' => now()->subDays(2), 'created_at' => now(), 'updated_at' => now()]);

        return PurchaseReceipt::withoutEvents(fn () => PurchaseReceipt::find($id));
    }

    private function postLedger(PurchaseReceipt $receipt, float $total, bool $isReturn): void {
        GlPostingStatus::create([
            'referenceable_type' => PurchaseReceipt::class,
            'referenceable_id'   => $receipt->id,
            'status'             => FormStatus::PENDING,
        ]);

        (new PostPurchaseReceiptGeneralLedger)->handle(new PurchaseReceiptGeneralLedgerPostingRequested($receipt, $total, $isReturn, now()));
    }

    public function test_normal_receipt_debits_stock_and_credits_srnb(): void {
        $receipt = $this->makeReceipt();
        $this->postLedger($receipt, 1200, false);

        $this->assertLedger($receipt, [
            ['account' => $this->stock, 'against' => $this->srnb, 'debit' => 1200, 'credit' => 0],
            ['account' => $this->srnb, 'against' => $this->stock, 'debit' => 0, 'credit' => 1200],
        ], now()->toDateString());
        $this->assertPostingStatus($receipt, 'posted');
    }

    public function test_return_receipt_reverses_stock_and_srnb(): void {
        $receipt = $this->makeReceipt();
        $this->postLedger($receipt, 400, true);

        $this->assertLedger($receipt, [
            ['account' => $this->srnb, 'against' => $this->stock, 'debit' => 400, 'credit' => 0],
            ['account' => $this->stock, 'against' => $this->srnb, 'debit' => 0, 'credit' => 400],
        ], now()->toDateString());
        $this->assertPostingStatus($receipt, 'posted');
    }

    public function test_stock_account_is_the_latest_created_one_not_a_configured_one(): void {
        // F-06: `where(root_type, account_type)->latest()->first()`.
        $newStock = $this->makeAccount('1301', 'Persediaan Baru', 'asset', 'debit', 'stock');
        Account::whereKey($this->stock->id)->update(['created_at' => now()->subDay()]);

        $receipt = $this->makeReceipt();
        $this->postLedger($receipt, 50, false);

        $this->assertLedger($receipt, [
            ['account' => $newStock, 'against' => $this->srnb, 'debit' => 50, 'credit' => 0],
            ['account' => $this->srnb, 'against' => $newStock, 'debit' => 0, 'credit' => 50],
        ]);
    }
}
