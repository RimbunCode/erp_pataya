<?php

namespace Tests\Feature\Finances\Characterization;

use App\Enums\FormStatus;
use App\Models\Core\GlPostingStatus;
use App\Models\Finances\Account;
use App\Models\Inventory\Item;
use App\Models\Inventory\ItemVariant;
use App\Models\Inventory\StockEntry;
use App\Models\Inventory\StockLedgerEntry;
use App\Models\Inventory\Unit;
use App\Models\Inventory\Warehouse;
use App\Services\Inventory\StockEntryService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\BuildsFinanceFixtures;
use Tests\TestCase;

/**
 * Characterization Fase 0 (titik posting #6, Lampiran B PRD): Stock Entry.
 *
 * Posting sinkron di `onApproved` yang juga mengubah `accounts.balance_amount` langsung (F-05, F-09): sisi debit
 * `+jumlah`, sisi kredit `−jumlah`. Hanya `item_receipt` dan `item_issue` (serta biaya tambahan) memposting GL;
 * `item_transfer` dan `item_consumption` tidak.
 */
class StockEntryPostingTest extends TestCase {
    use BuildsFinanceFixtures, RefreshDatabase;

    private Account $stock;
    private Account $difference;
    private Warehouse $warehouse;
    private ItemVariant $variant;
    private $itemUnit;

    protected function setUp(): void {
        parent::setUp();

        $this->setUpFinanceFixtures([Unit::class, Warehouse::class, Item::class, ItemVariant::class, StockEntry::class, StockLedgerEntry::class]);
        $this->stock      = $this->makeAccount('1300', 'Persediaan', 'asset', 'debit', 'stock');
        $this->difference = $this->makeAccount('5900', 'Selisih Stok', 'expense', 'debit', 'stock_adjustment');

        ['warehouse' => $this->warehouse, 'variant' => $this->variant, 'itemUnit' => $this->itemUnit] = $this->makeInventoryFixture();
    }

    /**
     * @param  array<string, mixed>  $itemAttributes
     */
    private function makeEntry(string $type, array $itemAttributes): StockEntry {
        $entry = StockEntry::create([
            'code'                  => 'SE-' . $type,
            'date'                  => now()->subDays(4),
            'type'                  => $type,
            'status'                => [FormStatus::DRAFT],
            'branch_id'             => $this->branch->id,
            'difference_account_id' => $this->difference->id,
        ]);

        $entry->items()->create([
            'item_id'           => $this->variant->id,
            'item_unit_id'      => $this->itemUnit->id,
            'conversion_factor' => 1,
            'quantity'          => 5,
            'basic_rate'        => 2000,
            ...$itemAttributes,
        ]);

        return $entry->fresh();
    }

    private function approve(StockEntry $entry): StockEntry {
        app(StockEntryService::class)->onApproved($entry);

        return $entry->fresh();
    }

    private function balance(Account $account): float {
        return (float) Account::find($account->id)->balance_amount;
    }

    private function receive(): StockEntry {
        return $this->approve($this->makeEntry('item_receipt', ['target_warehouse_id' => $this->warehouse->id]));
    }

    public function test_item_receipt_debits_stock_credits_difference_and_updates_cached_balances(): void {
        $entry = $this->receive();

        $this->assertLedger($entry, [
            ['account' => $this->stock, 'against' => $this->difference, 'debit' => 10_000, 'credit' => 0],
            ['account' => $this->difference, 'against' => $this->stock, 'debit' => 0, 'credit' => 10_000],
        ], now()->toDateString());

        // F-09: saldo di-cache langsung pada akun, bertanda debit − kredit.
        $this->assertEqualsWithDelta(10_000, $this->balance($this->stock), 0.01);
        $this->assertEqualsWithDelta(-10_000, $this->balance($this->difference), 0.01);

        $this->assertContains(FormStatus::COMPLETED, $entry->status);
        $this->assertSame(0, GlPostingStatus::where('referenceable_type', StockEntry::class)->count(), 'Stock Entry tidak dilacak GlPostingStatus.');
    }

    public function test_gl_transaction_date_is_approval_time_not_document_date(): void {
        // F-19 berlaku juga di Stock Entry: tanggal dokumen 4 hari lalu, GL memakai now().
        $entry = $this->receive();

        $this->assertSame(now()->subDays(4)->toDateString(), $entry->date->toDateString());
        $this->assertSame(now()->toDateString(), $this->ledgerOf($entry)->first()->transaction_date->toDateString());
    }

    public function test_item_issue_credits_stock_debits_difference_and_reverses_cached_balances(): void {
        $this->receive();

        $issue = $this->approve($this->makeEntry('item_issue', ['source_warehouse_id' => $this->warehouse->id, 'quantity' => 2]));

        $this->assertLedger($issue, [
            ['account' => $this->difference, 'against' => $this->stock, 'debit' => 4000, 'credit' => 0],
            ['account' => $this->stock, 'against' => $this->difference, 'debit' => 0, 'credit' => 4000],
        ], now()->toDateString());

        $this->assertEqualsWithDelta(6000, $this->balance($this->stock), 0.01);
        $this->assertEqualsWithDelta(-6000, $this->balance($this->difference), 0.01);
    }

    public function test_item_transfer_does_not_post_general_ledger_or_touch_balances(): void {
        $this->receive();
        $target = Warehouse::create(['branch_id' => $this->branch->id, 'name' => 'Gudang Tujuan', 'code' => 'WH-TGT']);

        $transfer = $this->approve($this->makeEntry('item_transfer', [
            'source_warehouse_id' => $this->warehouse->id,
            'target_warehouse_id' => $target->id,
            'quantity'            => 1,
        ]));

        $this->assertCount(0, $this->ledgerOf($transfer));
        $this->assertEqualsWithDelta(10_000, $this->balance($this->stock), 0.01);
    }

    public function test_additional_cost_posts_stock_debit_and_expense_credit_per_cost(): void {
        $freight = $this->makeAccount('5800', 'Biaya Angkut', 'expense', 'debit');
        $entry   = $this->makeEntry('item_receipt', ['target_warehouse_id' => $this->warehouse->id]);
        $entry->additionalCosts()->create(['expense_account_id' => $freight->id, 'purpose' => 'Angkut', 'amount' => 300]);

        $entry = $this->approve($entry);

        // Pasangan utama (10.000) + pasangan biaya tambahan (300): stok didebit lagi, akun biaya dikredit.
        $this->assertCount(4, $this->ledgerOf($entry));
        $this->assertEqualsWithDelta(10_300, $this->balance($this->stock), 0.01);
        $this->assertEqualsWithDelta(-300, $this->balance($freight), 0.01);
        $this->assertEqualsWithDelta(300, $this->ledgerOf($entry)->where('account_id', $freight->id)->first()->credit, 0.01);
    }
}
