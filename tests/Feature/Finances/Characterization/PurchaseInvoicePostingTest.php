<?php

namespace Tests\Feature\Finances\Characterization;

use App\Enums\FormStatus;
use App\Events\Finances\PurchaseInvoiceGeneralLedgerPostingRequested;
use App\Listeners\Finances\Ledger\PostPurchaseInvoiceGeneralLedger;
use App\Models\Core\GlPostingStatus;
use App\Models\Finances\Account;
use App\Models\Finances\PurchaseInvoice;
use App\Models\Finances\PurchaseInvoiceItem;
use App\Models\Inventory\ItemVariant;
use App\Models\Model as BaseModel;
use App\Models\Purchase\PurchaseOrder;
use App\Services\Finances\PurchaseInvoiceService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\BuildsFinanceFixtures;
use Tests\TestCase;

/**
 * Characterization Fase 0 (titik posting #2, Lampiran B PRD): Purchase Invoice.
 *
 * Dua jalur GL: (a) expense/kredit, selalu dibuat, dan (b) stok/SRNB, hanya bila `totalStockGL > 0` dan bukan retur.
 * Jalur (a) diuji dari `PurchaseInvoiceService::onApproved`. Jalur (b) diuji lewat event + listener asli karena
 * nilai `totalStockGL` berasal dari valuasi SLE pending yang sudah dicakup `PurchaseInvoicePendingSlesFifoOrderTest`.
 */
class PurchaseInvoicePostingTest extends TestCase {
    use BuildsFinanceFixtures, RefreshDatabase;

    private Account $expenseHead;
    private Account $payable;
    private PurchaseOrder $purchaseOrder;

    protected function setUp(): void {
        parent::setUp();

        $this->setUpFinanceFixtures([PurchaseInvoice::class, PurchaseOrder::class]);
        $this->expenseHead = $this->makeAccount('5000', 'Beban Pembelian', 'expense', 'debit');
        $this->payable     = $this->makeAccount('2000', 'Utang Usaha', 'liability', 'credit', 'accounts_payable');

        // `onApproved` selalu men-dispatch PurchaseOrderBillStatusRecalculationRequested(PO non-null):
        // Purchase Invoice tanpa PO gagal dengan TypeError, jadi semua fixture memakai satu PO.
        $this->purchaseOrder = BaseModel::withoutEvents(fn () => PurchaseOrder::create([
            'code'          => 'PO-CHAR-1',
            'date'          => now(),
            'status'        => [FormStatus::SUBMITTED],
            'created_by_id' => $this->user->id,
        ]));
    }

    /**
     * @param  array<string, mixed>  $attributes
     * @param  array<string, mixed>  $itemAttributes
     */
    private function makeInvoice(array $attributes = [], array $itemAttributes = []): PurchaseInvoice {
        $invoice = PurchaseInvoice::create([
            'date'                    => now()->subDays(3),
            'expanse_head_account_id' => $this->expenseHead->id,
            'credit_account_id'       => $this->payable->id,
            'purchase_order_id'       => $this->purchaseOrder->id,
            'branch_id'               => $this->branch->id,
            'status'                  => [FormStatus::SUBMITTED],
            ...$attributes,
        ]);

        PurchaseInvoiceItem::create([
            'purchase_invoice_id' => $invoice->id,
            'item_id'             => ItemVariant::factory()->create()->id,
            'quantity'            => 2,
            'rate'                => 1000,
            'tax_rate'            => 10,
            ...$itemAttributes,
        ]);

        return $invoice->fresh();
    }

    private function approve(PurchaseInvoice $invoice): PurchaseInvoice {
        app(PurchaseInvoiceService::class)->onApproved($invoice);

        return $invoice->fresh();
    }

    private function dispatchPosting(PurchaseInvoice $invoice, float $stockTotal, float $total, bool $isReturn): void {
        GlPostingStatus::create([
            'referenceable_type' => PurchaseInvoice::class,
            'referenceable_id'   => $invoice->id,
            'status'             => FormStatus::PENDING,
        ]);

        (new PostPurchaseInvoiceGeneralLedger)->handle(new PurchaseInvoiceGeneralLedgerPostingRequested(
            $invoice,
            $stockTotal,
            $total,
            $isReturn,
            now(),
            $this->expenseHead->id,
            $this->payable->id,
        ));
    }

    public function test_invoice_without_stock_posts_only_expense_debit_and_payable_credit(): void {
        $invoice = $this->approve($this->makeInvoice());

        // F-17: 2.000 × 11/12 × 10% = 183,33 → total 2.183,33; satu pasang tanpa pemisahan pajak (F-03).
        $this->assertLedger($invoice, [
            ['account' => $this->expenseHead, 'against' => $this->payable, 'debit' => 2183.33, 'credit' => 0],
            ['account' => $this->payable, 'against' => $this->expenseHead, 'debit' => 0, 'credit' => 2183.33],
        ], now()->toDateString());

        $this->assertEqualsWithDelta(2183.33, $invoice->amount, 0.01);
        $this->assertContains(FormStatus::UNPAID, $invoice->status);
        $this->assertPostingStatus($invoice, 'posted');
        $this->assertSame(now()->subDays(3)->toDateString(), $invoice->date->toDateString(), 'F-19: tanggal GL = now(), bukan tanggal dokumen');
    }

    public function test_return_invoice_posts_reversed_expense_and_payable(): void {
        $original     = $this->approve($this->makeInvoice());
        $originalItem = $original->items()->first();

        $return = $this->approve($this->makeInvoice(
            ['return_against_id' => $original->id],
            ['quantity' => 1, 'return_against_item_id' => $originalItem->id],
        ));

        $this->assertLedger($return, [
            ['account' => $this->payable, 'against' => $this->expenseHead, 'debit' => 1091.67, 'credit' => 0],
            ['account' => $this->expenseHead, 'against' => $this->payable, 'debit' => 0, 'credit' => 1091.67],
        ], now()->toDateString());

        $this->assertContains(FormStatus::RETURNED, $return->status);
        $this->assertPostingStatus($return, 'posted');
    }

    public function test_stock_branch_adds_stock_debit_and_srnb_credit_before_expense_pair(): void {
        $stock = $this->makeAccount('1300', 'Persediaan', 'asset', 'debit', 'stock');
        $srnb  = $this->makeAccount('2100', 'SRNB', 'liability', 'credit', 'stock_received_but_not_billed');

        $invoice = $this->makeInvoice();
        $this->dispatchPosting($invoice, 1500, 2183.33, false);

        $this->assertLedger($invoice, [
            ['account' => $stock, 'against' => $srnb, 'debit' => 1500, 'credit' => 0],
            ['account' => $srnb, 'against' => $stock, 'debit' => 0, 'credit' => 1500],
            ['account' => $this->expenseHead, 'against' => $this->payable, 'debit' => 2183.33, 'credit' => 0],
            ['account' => $this->payable, 'against' => $this->expenseHead, 'debit' => 0, 'credit' => 2183.33],
        ], now()->toDateString());

        $this->assertPostingStatus($invoice, 'posted');
    }

    public function test_return_skips_stock_branch_even_when_stock_total_is_positive(): void {
        $this->makeAccount('1300', 'Persediaan', 'asset', 'debit', 'stock');
        $this->makeAccount('2100', 'SRNB', 'liability', 'credit', 'stock_received_but_not_billed');

        $invoice = $this->makeInvoice();
        $this->dispatchPosting($invoice, 500, 800, true);

        $this->assertLedger($invoice, [
            ['account' => $this->payable, 'against' => $this->expenseHead, 'debit' => 800, 'credit' => 0],
            ['account' => $this->expenseHead, 'against' => $this->payable, 'debit' => 0, 'credit' => 800],
        ]);
    }

    public function test_stock_and_srnb_accounts_are_chosen_by_latest_created_not_by_configuration(): void {
        // F-06: `where(account_type)->latest()->first()`: akun terbaru menang bila ada lebih dari satu.
        $oldStock = $this->makeAccount('1300', 'Persediaan Lama', 'asset', 'debit', 'stock');
        $newStock = $this->makeAccount('1301', 'Persediaan Baru', 'asset', 'debit', 'stock');
        Account::whereKey($oldStock->id)->update(['created_at' => now()->subDay()]);
        $srnb = $this->makeAccount('2100', 'SRNB', 'liability', 'credit', 'stock_received_but_not_billed');

        $invoice = $this->makeInvoice();
        $this->dispatchPosting($invoice, 100, 100, false);

        $this->assertLedger($invoice, [
            ['account' => $newStock, 'against' => $srnb, 'debit' => 100, 'credit' => 0],
            ['account' => $srnb, 'against' => $newStock, 'debit' => 0, 'credit' => 100],
            ['account' => $this->expenseHead, 'against' => $this->payable, 'debit' => 100, 'credit' => 0],
            ['account' => $this->payable, 'against' => $this->expenseHead, 'debit' => 0, 'credit' => 100],
        ]);
        $this->assertSame(0, $this->ledgerOf($invoice)->where('account_id', $oldStock->id)->count());
    }
}
