<?php

namespace Tests\Feature\Inventory;

use App\Enums\FormStatus;
use App\Models\Core\Branch;
use App\Models\Core\FormatingSeries;
use App\Models\Inventory\Item;
use App\Models\Inventory\ItemUnit;
use App\Models\Inventory\ItemVariant;
use App\Models\Inventory\Stock;
use App\Models\Inventory\StockEntry;
use App\Models\Inventory\Unit;
use App\Models\Inventory\Warehouse;
use App\Models\User\User;
use App\Services\Inventory\StockEntryService;
use Illuminate\Database\Eloquent\RelationNotFoundException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class StockEntrySubmitTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        // initPermissions() menambah kolom runtime (is_example, status, code, dst)
        // yang di produksi dibuat oleh PermissionSeeder, bukan migration.
        // Juga otomatis membuat row formating_series untuk StockEntry.
        foreach ([User::class, FormatingSeries::class, Branch::class, Unit::class, Warehouse::class, Item::class, ItemVariant::class, StockEntry::class] as $model) {
            $model::initPermissions();
        }

        // FormatingSeries::generate() butuh preference timezone (row harus ada,
        // kalau tidak (string) null jadi '' dan DateTimeZone melempar error).
        DB::table('preferences')->insert([
            'key'        => 'timezone',
            'value'      => json_encode('UTC'),
            'is_example' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function makeUser(): User {
        $id = (string) str()->ulid();
        DB::table('users')->insert([
            'id'         => $id,
            'name'       => 'Tester',
            'email'      => $id . '@test.com',
            'password'   => null,
            'status'     => 'active',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return User::find($id);
    }

    /**
     * Regresi untuk bug: StockEntryService::submit() (baris 261) meng-eager-load
     * 'item.sourceWarehouse' padahal relasi sourceWarehouse() ada di StockEntryItem,
     * bukan di ItemVariant (relasi 'item'-nya). Ini melempar
     * RelationNotFoundException [sourceWarehouse] pada model ItemVariant.
     *
     * Stok sengaja dibuat KURANG dari quantity yang diminta, supaya submit()
     * melempar ValidationException (jalur validasi stok) sebelum sampai ke
     * checkApproval() — sehingga test tidak perlu setup Account/ApprovalScheme.
     * Pesan error validasi juga memakai $item->sourceWarehouse->name, jadi
     * assert isinya sekaligus membuktikan relasi benar-benar ter-load.
     */
    public function test_submit_item_issue_does_not_throw_relation_not_found_exception(): void {
        $branch = Branch::create(['name' => 'Main Branch', 'code' => 'MB']);

        $warehouse = Warehouse::create([
            'branch_id' => $branch->id,
            'name'      => 'Warehouse 1',
            'code'      => 'WH-1',
        ]);

        $unit = Unit::create([
            'code' => 'PCS',
            'name' => 'Piece',
        ]);

        $item = Item::create([
            'code'            => 'ITEM-1',
            'name'            => 'Item 1',
            'default_unit_id' => $unit->id,
            'type'            => 'inventory',
        ]);

        $itemVariant = ItemVariant::create([
            'item_id'   => $item->id,
            'code'      => 'ITEM-1-VAR',
            'item_code' => 'ITEM-1',
            'item_name' => 'Item 1',
            'type'      => 'inventory',
        ]);

        $itemUnit = ItemUnit::create([
            'item_id'    => $item->id,
            'unit_id'    => $unit->id,
            'is_default' => true,
        ]);

        Stock::create([
            'item_variant_id'   => $itemVariant->id,
            'warehouse_id'      => $warehouse->id,
            'item_unit_id'      => $itemUnit->id,
            'quantity'          => 1,
            'conversion_factor' => 1,
            'stock_queue'       => [],
        ]);

        Auth::login($this->makeUser());

        $stockEntry = StockEntry::create([
            'code'      => 'SE-DRAFT-1',
            'date'      => now(),
            'type'      => 'item_issue',
            'status'    => [FormStatus::DRAFT],
            'branch_id' => $branch->id,
        ]);

        $stockEntry->items()->create([
            'item_id'             => $itemVariant->id,
            'source_warehouse_id' => $warehouse->id,
            'quantity'            => 10,
            'item_unit_id'        => $itemUnit->id,
            'conversion_factor'   => 1,
            'basic_rate'          => 1000,
        ]);

        $service = app(StockEntryService::class);

        try {
            $service->submit($stockEntry->fresh());
            $this->fail('Expected ValidationException was not thrown (stock sengaja kurang).');
        } catch (RelationNotFoundException $e) {
            $this->fail('Bug regresi: eager-load sourceWarehouse masih salah nesting — ' . $e->getMessage());
        } catch (ValidationException $e) {
            // Bukti relasi sourceWarehouse ter-load dengan benar: nama warehouse
            // muncul di pesan error (diakses via $item->sourceWarehouse->name).
            $messages = collect($e->errors()['items'] ?? [])->implode(' ');
            $this->assertStringContainsString('Warehouse 1', $messages);
        }
    }
}
