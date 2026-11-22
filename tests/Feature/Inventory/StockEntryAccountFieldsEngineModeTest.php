<?php

namespace Tests\Feature\Inventory;

use App\Enums\FormStatus;
use App\Enums\PostingDocumentType;
use App\Models\Finances\AdditionalCost;
use App\Models\Finances\FinanceSetting;
use App\Models\Inventory\Item;
use App\Models\Inventory\ItemUnit;
use App\Models\Inventory\ItemVariant;
use App\Models\Inventory\StockEntry;
use App\Models\Inventory\StockLedgerEntry;
use App\Models\Inventory\Unit;
use App\Models\Inventory\Warehouse;
use App\Services\Core\Setting\SettingsService;
use App\Services\Finances\Posting\PostingModeResolver;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\BuildsFinanceFixtures;
use Tests\TestCase;

/**
 * Finance Fase 2, Task 12.3 untuk Stock Entry dan biaya tambahannya (Requirement 13.1/13.3): saat mode engine `on`,
 * controller melaporkan `accountsManagedByEngine`, store/update berjalan tanpa akun selisih dan akun biaya tambahan,
 * dan kolom akun dokumen dibiarkan null (atau nilai lama dipertahankan); saat `off`/`shadow` akun tetap wajib.
 */
class StockEntryAccountFieldsEngineModeTest extends TestCase {
    use BuildsFinanceFixtures, RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        $this->setUpFinanceFixtures([StockEntry::class, Unit::class, Warehouse::class, Item::class, ItemVariant::class, StockLedgerEntry::class]);
    }

    private function setPostingMode(string $mode): void {
        $modes = array_merge(FinanceSetting::defaultAttributes()['posting_modes'], [PostingDocumentType::StockEntry->value => $mode]);
        app(SettingsService::class)->updateInternal(FinanceSetting::class, ['posting_modes' => $modes]);
        PostingModeResolver::forget();
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

    public function test_pages_report_whether_accounts_are_managed_by_the_engine(): void {
        $entry = $this->makeStockEntry([FormStatus::DRAFT], 'item_receipt');

        foreach ([['off', false], ['shadow', false], ['on', true]] as [$mode, $managed]) {
            $this->setPostingMode($mode);

            $this->http()->get('/stockEntries/create')->assertOk()->assertInertia(
                fn ($page) => $page->component('Inventory/StockEntries/Show')->where('accountsManagedByEngine', $managed),
            );
            $this->http()->get('/stockEntries/' . $entry->id)->assertOk()->assertInertia(
                fn ($page) => $page->where('accountsManagedByEngine', $managed),
            );
        }
    }

    public function test_store_without_accounts_is_rejected_while_mode_is_not_on(): void {
        $inventory = $this->makeInventoryFixture();

        foreach (['off', 'shadow'] as $mode) {
            $this->setPostingMode($mode);

            $response = $this->http()->post('/stockEntries', $this->receiptPayload($inventory, false));

            $response->assertSessionHasErrors(['difference_account.id', 'additional_costs.0.expense_account.id']);
        }
        $this->assertSame(0, StockEntry::count());
    }

    public function test_store_without_accounts_succeeds_and_leaves_account_columns_null_when_mode_is_on(): void {
        $this->setPostingMode('on');
        $inventory = $this->makeInventoryFixture();

        $response = $this->http()->post('/stockEntries', $this->receiptPayload($inventory, false));

        $response->assertSessionHasNoErrors();
        $entry = StockEntry::query()->firstOrFail();
        $this->assertNull($entry->difference_account_id);
        $cost = $entry->additionalCosts()->firstOrFail();
        $this->assertNull($cost->expense_account_id);
        $this->assertEqualsWithDelta(300, $cost->amount, 0.01);
    }

    public function test_store_discards_account_columns_sent_by_a_client_when_mode_is_on(): void {
        $this->setPostingMode('on');
        $inventory = $this->makeInventoryFixture();

        $this->http()->post('/stockEntries', $this->receiptPayload($inventory, true))->assertSessionHasNoErrors();

        $entry = StockEntry::query()->firstOrFail();
        $this->assertNull($entry->difference_account_id, 'P-14: akun kiriman klien dibuang saat mode on.');
        $this->assertNull($entry->additionalCosts()->firstOrFail()->expense_account_id);
    }

    public function test_update_without_accounts_keeps_recorded_accounts_when_mode_is_on(): void {
        $inventory = $this->makeInventoryFixture();
        $this->http()->post('/stockEntries', $this->receiptPayload($inventory, true))->assertSessionHasNoErrors();
        $entry   = StockEntry::query()->firstOrFail();
        $account = $this->makeAccount('5800', 'Biaya Angkut', 'expense');
        $entry->forceFill(['difference_account_id' => $account->id])->save();
        $entry->additionalCosts()->firstOrFail()->forceFill(['expense_account_id' => $account->id])->save();
        $costId = $entry->additionalCosts()->firstOrFail()->id;

        $this->setPostingMode('on');
        $payload                                  = $this->receiptPayload($inventory, false);
        $payload['additional_costs'][0]['id']     = $costId;
        $payload['additional_costs'][0]['amount'] = 450;

        $this->http()->put('/stockEntries/' . $entry->id, $payload)->assertSessionHasNoErrors();

        $this->assertSame($account->id, $entry->fresh()->difference_account_id, 'Nilai lama dipertahankan sebagai catatan audit.');
        $cost = AdditionalCost::query()->findOrFail($costId);
        $this->assertSame($account->id, $cost->expense_account_id);
        $this->assertEqualsWithDelta(450, $cost->amount, 0.01);
    }
}
