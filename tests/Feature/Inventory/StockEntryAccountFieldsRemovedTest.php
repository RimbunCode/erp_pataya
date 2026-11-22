<?php

namespace Tests\Feature\Inventory;

use App\Enums\FormStatus;
use App\Models\Finances\AdditionalCost;
use App\Models\Inventory\Item;
use App\Models\Inventory\ItemUnit;
use App\Models\Inventory\ItemVariant;
use App\Models\Inventory\StockEntry;
use App\Models\Inventory\StockLedgerEntry;
use App\Models\Inventory\Unit;
use App\Models\Inventory\Warehouse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\BuildsFinanceFixtures;
use Tests\TestCase;

/**
 * Finance Fase 2, Task 12.3 untuk Stock Entry dan biaya tambahannya (Requirement 13.1/13.3) dan Q-P2-23 (2026-11-22):
 * controller tidak lagi mengirim `accountsManagedByEngine` (tidak ada mode), store/update berjalan tanpa akun selisih
 * dan akun biaya tambahan, kolom akun dokumen dibiarkan null, dan update draft mengosongkan akun lama (engine yang
 * mengisinya).
 */
class StockEntryAccountFieldsRemovedTest extends TestCase {
    use BuildsFinanceFixtures, RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        $this->setUpFinanceFixtures([StockEntry::class, Unit::class, Warehouse::class, Item::class, ItemVariant::class, StockLedgerEntry::class]);
    }

    private function http(): static {
        return $this
            ->withSession([
                'permissions' => [
                    StockEntry::class => [
                        0 => [
                            [
                                'model'        => StockEntry::class,
                                'level'        => 0,
                                'only_creator' => false,
                                'permissions'  => ['select' => true, 'read' => true, 'create' => true, 'write' => true],
                            ],
                        ],
                    ],
                ],
                'permissions_version' => '0|0|0|0',
                'currentBranch'       => $this->branch->id,
            ])
            ->withCookie('lang', 'en')
            ->actingAs($this->user);
    }

    /**
     * @param  array{warehouse: Warehouse, variant: ItemVariant, itemUnit: ItemUnit}  $inventory
     * @return array<string, mixed>
     */
    private function receiptPayload(array $inventory, bool $withAccounts): array {
        $payload = [
            'date'  => now()->toDateString(),
            'type'  => 'item_receipt',
            'items' => [[
                'id'                => 'baris-1',
                'item'              => ['id' => $inventory['variant']->id],
                'quantity'          => 5,
                'unit'              => ['id' => $inventory['itemUnit']->id],
                'target_warehouse'  => ['id' => $inventory['warehouse']->id],
                'basic_rate'        => 2000,
                'conversion_factor' => 1,
            ]],
            'additional_costs' => [['id' => 'biaya-1', 'purpose' => 'Angkut', 'amount' => 300]],
        ];

        if ($withAccounts) {
            $account                                           = $this->makeAccount('5900', 'Selisih Stok', 'expense', 'debit', 'stock_adjustment');
            $payload['difference_account']                     = ['id' => $account->id];
            $payload['additional_costs'][0]['expense_account'] = ['id' => $account->id];
        }

        return $payload;
    }

    public function test_pages_do_not_send_the_removed_mode_prop(): void {
        $entry = $this->makeStockEntry([FormStatus::DRAFT], 'item_receipt');

        $this->http()->get('/stockEntries/create')->assertOk()->assertInertia(
            fn ($page) => $page->component('Inventory/StockEntries/Show')->missing('accountsManagedByEngine'),
        );
        $this->http()->get('/stockEntries/' . $entry->id)->assertOk()->assertInertia(
            fn ($page) => $page->missing('accountsManagedByEngine'),
        );
    }

    public function test_store_without_accounts_succeeds_and_leaves_account_columns_null(): void {
        $inventory = $this->makeInventoryFixture();

        $response = $this->http()->post('/stockEntries', $this->receiptPayload($inventory, false));

        $response->assertSessionHasNoErrors();
        $entry = StockEntry::query()->firstOrFail();
        $this->assertNull($entry->difference_account_id);
        $cost = $entry->additionalCosts()->firstOrFail();
        $this->assertNull($cost->expense_account_id);
        $this->assertEqualsWithDelta(300, $cost->amount, 0.01);
    }

    public function test_store_discards_account_columns_sent_by_a_client(): void {
        $inventory = $this->makeInventoryFixture();

        $this->http()->post('/stockEntries', $this->receiptPayload($inventory, true))->assertSessionHasNoErrors();

        $entry = StockEntry::query()->firstOrFail();
        $this->assertNull($entry->difference_account_id, 'P-14: akun kiriman klien dibuang.');
        $this->assertNull($entry->additionalCosts()->firstOrFail()->expense_account_id);
    }

    public function test_update_of_a_draft_clears_recorded_accounts_for_the_engine_to_fill(): void {
        $inventory = $this->makeInventoryFixture();
        $this->http()->post('/stockEntries', $this->receiptPayload($inventory, true))->assertSessionHasNoErrors();
        $entry   = StockEntry::query()->firstOrFail();
        $account = $this->makeAccount('5800', 'Biaya Angkut', 'expense');
        $entry->forceFill(['difference_account_id' => $account->id])->save();
        $entry->additionalCosts()->firstOrFail()->forceFill(['expense_account_id' => $account->id])->save();
        $costId = $entry->additionalCosts()->firstOrFail()->id;

        $payload                                  = $this->receiptPayload($inventory, false);
        $payload['additional_costs'][0]['id']     = $costId;
        $payload['additional_costs'][0]['amount'] = 450;

        $this->http()->put('/stockEntries/' . $entry->id, $payload)->assertSessionHasNoErrors();

        // Keputusan pemilik produk 2026-11-22 (Q-P2-23): update draft tidak wajib mempertahankan akun lama.
        $this->assertNull($entry->fresh()->difference_account_id, 'Akun lama dikosongkan; engine yang mengisinya.');
        $cost = AdditionalCost::query()->findOrFail($costId);
        $this->assertNull($cost->expense_account_id);
        $this->assertEqualsWithDelta(450, $cost->amount, 0.01);
    }
}
