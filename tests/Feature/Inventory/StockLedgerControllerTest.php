<?php

namespace Tests\Feature\Inventory;

use App\Enums\FormStatus;
use App\Models\Core\Branch;
use App\Models\Core\FormatingSeries;
use App\Models\Inventory\Item;
use App\Models\Inventory\ItemUnit;
use App\Models\Inventory\ItemVariant;
use App\Models\Inventory\StockEntry;
use App\Models\Inventory\StockLedgerEntry;
use App\Models\Inventory\Unit;
use App\Models\Inventory\Warehouse;
use App\Models\User\User;
use BeyondCode\QueryDetector\QueryDetectorMiddleware;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class StockLedgerControllerTest extends TestCase {
    use RefreshDatabase;

    private User $user;
    private Branch $branch;
    private Warehouse $warehouse;
    private Item $item;
    private ItemVariant $itemVariant;
    private ItemUnit $itemUnit;
    private StockEntry $stockEntry;
    private StockLedgerEntry $stockLedger;

    protected function setUp(): void {
        parent::setUp();

        $this->withoutMiddleware([
            QueryDetectorMiddleware::class,
        ]);

        foreach (Schema::getTables() as $tableInfo) {
            $table = $tableInfo['name'];
            if (! Schema::hasColumn($table, 'is_example')) {
                Schema::table($table, fn ($t) => $t->boolean('is_example')->default(false));
            }
        }

        foreach ([User::class, FormatingSeries::class, Warehouse::class, Item::class, ItemVariant::class, StockEntry::class, StockLedgerEntry::class] as $model) {
            $model::initPermissions();
        }

        DB::table('preferences')->insert([
            'key'        => 'timezone',
            'value'      => json_encode('UTC'),
            'is_example' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->user      = User::factory()->create();
        $this->branch    = Branch::create(['name' => 'Main Branch', 'code' => 'MB']);
        $this->warehouse = Warehouse::create([
            'branch_id' => $this->branch->id,
            'name'      => 'Warehouse 1',
            'code'      => 'WH-1',
        ]);

        $unit = Unit::create(['code' => 'PCS', 'name' => 'Piece']);

        $this->item = Item::create([
            'code'            => 'ITEM-1',
            'name'            => 'Item 1',
            'default_unit_id' => $unit->id,
            'type'            => 'inventory',
        ]);

        $this->itemVariant = ItemVariant::create([
            'item_id'   => $this->item->id,
            'code'      => 'ITEM-1-VAR',
            'item_code' => 'ITEM-1',
            'item_name' => 'Item 1',
            'type'      => 'inventory',
        ]);

        $this->itemUnit = ItemUnit::create([
            'item_id'    => $this->item->id,
            'unit_id'    => $unit->id,
            'is_default' => true,
        ]);

        Auth::login($this->user);
        $this->stockEntry = StockEntry::create([
            'code'      => 'SE-DRAFT-1',
            'date'      => now(),
            'type'      => 'item_issue',
            'status'    => [FormStatus::DRAFT],
            'branch_id' => $this->branch->id,
        ]);

        $this->stockLedger = StockLedgerEntry::create([
            'referenceable_type'         => StockEntry::class,
            'referenceable_id'           => $this->stockEntry->id,
            'item_id'                    => $this->itemVariant->id,
            'warehouse_id'               => $this->warehouse->id,
            'item_unit_id'               => $this->itemUnit->id,
            'quantity_change'            => 10,
            'quantity_after_transaction' => 10,
        ]);
    }

    private function sessionWithPermission(array $permissions): array {
        return [
            'permissions' => [
                StockLedgerEntry::class => [
                    0 => [
                        [
                            'model'        => StockLedgerEntry::class,
                            'level'        => 0,
                            'only_creator' => false,
                            'permissions'  => $permissions,
                        ],
                    ],
                ],
            ],
            'permissions_version' => '0|0|0|0',
            'currentBranch'       => null,
        ];
    }

    public function test_show_returns_403_without_read_permission(): void {
        $response = $this
            ->withSession($this->sessionWithPermission(['select' => false, 'read' => false]))
            ->withCookie('lang', 'en')
            ->actingAs($this->user)
            ->get(route('stockLedgers.show', $this->stockLedger));

        $response->assertForbidden();
    }

    public function test_show_returns_200_with_read_permission_and_loads_relations(): void {
        $response = $this
            ->withSession($this->sessionWithPermission(['select' => true, 'read' => true]))
            ->withCookie('lang', 'en')
            ->actingAs($this->user)
            ->get(route('stockLedgers.show', $this->stockLedger));

        $response->assertOk();
        $response->assertInertia(
            fn ($page) => $page
                ->component('Inventory/StockLedgers/Show')
                ->where('stockLedger.id', $this->stockLedger->id)
                ->has('stockLedger.item')
                ->has('stockLedger.unit')
                ->has('stockLedger.warehouse')
                ->has('stockLedger.referenceable'),
        );
    }

    public function test_show_returns_200_with_null_referenceable_when_source_permanently_deleted(): void {
        $stockEntryId = $this->stockEntry->id;
        $this->stockEntry->forceDelete();

        $response = $this
            ->withSession($this->sessionWithPermission(['select' => true, 'read' => true]))
            ->withCookie('lang', 'en')
            ->actingAs($this->user)
            ->get(route('stockLedgers.show', $this->stockLedger));

        $response->assertOk();
        $response->assertInertia(
            fn ($page) => $page
                ->component('Inventory/StockLedgers/Show')
                ->where('stockLedger.referenceable', null),
        );

        $this->assertDatabaseMissing('stock_entries', ['id' => $stockEntryId]);
    }

    public function test_index_still_returns_200(): void {
        $response = $this
            ->withSession($this->sessionWithPermission(['select' => true, 'read' => true]))
            ->withCookie('lang', 'en')
            ->actingAs($this->user)
            ->get(route('stockLedgers.index'));

        $response->assertOk();
    }

    /**
     * Regresi: `getNameClass()` bawaan trait mengembalikan `stockLedgerEntry`
     * (dari nama kelas `StockLedgerEntry`), yang lalu di-pluralize frontend
     * (`DataTable2.jsx`) menjadi route name `stockLedgerEntries.show` —
     * tidak terdaftar, karena route resource aslinya bernama `stockLedger`
     * (lihat `Route::resourceDetail('stockLedger', ...)`). Prop Inertia
     * `name` (diisi dari `getNameClass()`, lihat `DataTableScope::addDataTable()`)
     * harus match nama route asli supaya kolom `isLink` di index tidak
     * membentuk URL ke route yang tidak ada.
     */
    public function test_index_shares_name_prop_matching_registered_route(): void {
        $response = $this
            ->withSession($this->sessionWithPermission(['select' => true, 'read' => true]))
            ->withCookie('lang', 'en')
            ->actingAs($this->user)
            ->get(route('stockLedgers.index'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page->where('name', 'stockLedger'));
    }
}
