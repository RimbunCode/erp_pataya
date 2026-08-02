<?php

namespace Tests\Feature;

use App\Models\Core\Branch;
use App\Models\Core\FormatingSeries;
use App\Models\Sales\InternalOrder;
use App\Models\User\User;
use Database\Factories\Inventory\ItemVariantFactory;
use Database\Factories\Inventory\WarehouseFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Bug report user: source_warehouse tidak tersimpan saat Internal Order dibuat/disave.
 *
 * Root cause: InternalOrderRequest::rules() tidak mendeklarasikan
 * 'items.*.source_warehouse.id' -- karena Laravel FormRequest::validated()
 * (dan BaseFormRequest::validated() yang murni delegasi ke parent) hanya
 * mengembalikan field yang dideklarasikan di rules(), seluruh objek
 * source_warehouse pada tiap item di-strip sebelum sampai ke service layer,
 * meski field itu benar dikirim dari frontend. InternalOrderService sudah
 * benar (fillItemRelations() sudah menangani source_warehouse_id), FE sudah
 * benar (mengirim source_warehouse per item) -- satu-satunya titik gagal
 * adalah validation rules yang hilang.
 */
class InternalOrderSourceWarehouseTest extends TestCase {
    use RefreshDatabase;

    private User $user;
    private Branch $branch;

    protected function setUp(): void {
        parent::setUp();

        foreach (Schema::getTables() as $tableInfo) {
            $table = $tableInfo['name'];
            if (! Schema::hasColumn($table, 'is_example')) {
                Schema::table($table, fn ($t) => $t->boolean('is_example')->default(false));
            }
        }

        foreach ([User::class, FormatingSeries::class, InternalOrder::class] as $model) {
            $model::initPermissions();
        }

        DB::table('preferences')->insert([
            'key'        => 'timezone',
            'value'      => json_encode('UTC'),
            'is_example' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->user   = User::factory()->create();
        $this->branch = Branch::create(['name' => 'Main Branch', 'code' => 'MB', 'is_main_branch' => true]);
    }

    private function sessionWithInternalOrderPermissions(): array {
        return [
            'permissions' => [
                InternalOrder::class => [
                    0 => [[
                        'model'        => InternalOrder::class,
                        'level'        => 0,
                        'only_creator' => false,
                        'permissions'  => ['select' => true, 'read' => true, 'write' => true, 'create' => true],
                    ]],
                ],
            ],
            'permissions_version' => '0|0|0|0',
            'currentBranch'       => $this->branch->id,
        ];
    }

    private function makeItemUnit(string $itemId): string {
        $unitMasterId = (string) Str::ulid();
        DB::table('units')->insert([
            'id'                => $unitMasterId,
            'code'              => 'PCS-' . $unitMasterId,
            'name'              => 'PCS',
            'conversion_factor' => 1,
            'is_default'        => true,
            'created_at'        => now(),
            'updated_at'        => now(),
        ]);

        $itemUnitId = (string) Str::ulid();
        DB::table('item_units')->insert([
            'id'                => $itemUnitId,
            'item_id'           => $itemId,
            'unit_id'           => $unitMasterId,
            'conversion_factor' => 1,
            'is_default'        => true,
            'order'             => 0,
            'created_at'        => now(),
            'updated_at'        => now(),
        ]);

        return $itemUnitId;
    }

    public function test_source_warehouse_is_persisted_when_internal_order_is_created(): void {
        $itemVariant = ItemVariantFactory::new()->create();
        $unitId      = $this->makeItemUnit($itemVariant->item_id);
        $warehouse   = WarehouseFactory::new()->create();

        $response = $this
            ->actingAs($this->user)
            ->withCookie('lang', 'en')
            ->withSession($this->sessionWithInternalOrderPermissions())
            ->post('/internalOrders', [
                'date'  => now()->toDateString(),
                'items' => [
                    [
                        'id'               => (string) Str::ulid(),
                        'item'             => ['id' => $itemVariant->id],
                        'unit'             => ['id' => $unitId],
                        'quantity'         => 3,
                        'source_warehouse' => ['id' => $warehouse->id],
                    ],
                ],
            ]);

        $response->assertSessionHasNoErrors();

        $internalOrder = InternalOrder::first();
        $this->assertNotNull($internalOrder, 'Internal Order harus tersimpan');

        $item = $internalOrder->items()->first();
        $this->assertNotNull($item, 'Internal Order item harus tersimpan');
        $this->assertSame(
            $warehouse->id,
            $item->source_warehouse_id,
            'source_warehouse_id harus tersimpan sesuai yang dikirim, bukan null',
        );
    }

    public function test_source_warehouse_is_persisted_when_internal_order_is_updated(): void {
        $itemVariant = ItemVariantFactory::new()->create();
        $unitId      = $this->makeItemUnit($itemVariant->item_id);
        $warehouseA  = WarehouseFactory::new()->create();
        $warehouseB  = WarehouseFactory::new()->create();

        $itemId = (string) Str::ulid();
        $this
            ->actingAs($this->user)
            ->withCookie('lang', 'en')
            ->withSession($this->sessionWithInternalOrderPermissions())
            ->post('/internalOrders', [
                'date'  => now()->toDateString(),
                'items' => [
                    [
                        'id'               => $itemId,
                        'item'             => ['id' => $itemVariant->id],
                        'unit'             => ['id' => $unitId],
                        'quantity'         => 3,
                        'source_warehouse' => ['id' => $warehouseA->id],
                    ],
                ],
            ]);

        $internalOrder  = InternalOrder::first();
        $existingItemId = (string) $internalOrder->items()->first()->id;

        $response = $this
            ->actingAs($this->user)
            ->withCookie('lang', 'en')
            ->withSession($this->sessionWithInternalOrderPermissions())
            ->put("/internalOrders/{$internalOrder->id}", [
                'date'  => now()->toDateString(),
                'items' => [
                    [
                        'id'               => $existingItemId,
                        'item'             => ['id' => $itemVariant->id],
                        'unit'             => ['id' => $unitId],
                        'quantity'         => 3,
                        'source_warehouse' => ['id' => $warehouseB->id],
                    ],
                ],
            ]);

        $response->assertSessionHasNoErrors();

        $item = $internalOrder->items()->first();
        $this->assertSame(
            $warehouseB->id,
            $item->source_warehouse_id,
            'source_warehouse_id harus ter-update ke warehouse baru, bukan null',
        );
    }
}
