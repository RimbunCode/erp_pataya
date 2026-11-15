<?php

namespace Tests\Feature\Purchase;

use App\Enums\FormStatus;
use App\Models\Core\FormatingSeries;
use App\Models\Inventory\ItemUnit;
use App\Models\Inventory\Unit;
use App\Models\Model as BaseModel;
use App\Models\Purchase\PurchaseOrder;
use App\Models\Purchase\PurchaseReceipt;
use App\Models\Purchase\PurchaseReceiptItem;
use App\Models\Purchase\Supplier;
use App\Models\User\User;
use BeyondCode\QueryDetector\QueryDetectorMiddleware;
use Database\Factories\Core\CountryFactory;
use Database\Factories\Inventory\ItemFactory;
use Database\Factories\Inventory\ItemVariantFactory;
use Database\Factories\Inventory\WarehouseFactory;
use Database\Factories\Purchase\PurchaseOrderFactory;
use Database\Factories\Purchase\SupplierFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Tombol "Buat Purchase Return" membuka `/purchaseReceipts/create/purchaseReceipt/{id}`. Data awal harus menandai
 * dokumen sebagai retur (`is_return`), seperti alur retur Delivery Note, Sales Invoice, dan Purchase Invoice;
 * tanpa itu form tampil sebagai penerimaan biasa dan bagian rujukan retur tersembunyi.
 */
class PurchaseReceiptReturnPrefillTest extends TestCase {
    use RefreshDatabase;

    private User $user;
    private PurchaseReceipt $receipt;

    protected function setUp(): void {
        parent::setUp();

        // SQLite test tidak punya json_overlaps (fungsi MySQL) yang dipakai controller untuk mencari draft retur.
        DB::connection()->getPdo()->sqliteCreateFunction('json_overlaps', function (?string $a, ?string $b): int {
            $left  = json_decode($a ?? '[]', true) ?? [];
            $right = json_decode($b ?? '[]', true) ?? [];

            return array_intersect($left, $right) !== [] ? 1 : 0;
        }, 2);

        foreach (Schema::getTables() as $tableInfo) {
            $table = $tableInfo['name'];
            if (! Schema::hasColumn($table, 'is_example')) {
                Schema::table($table, fn ($t) => $t->boolean('is_example')->default(false));
            }
        }
        foreach ([FormatingSeries::class, Supplier::class, PurchaseOrder::class, PurchaseReceipt::class] as $model) {
            $model::initPermissions();
        }
        DB::table('preferences')->insert([
            'key'        => 'timezone',
            'value'      => json_encode('UTC'),
            'is_example' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        CountryFactory::new()->create(['code' => 'IDN']);

        $this->withoutMiddleware([QueryDetectorMiddleware::class]);
        $this->user = User::factory()->create();
        $this->actingAs($this->user)
            ->withSession([
                'permissions' => [
                    PurchaseReceipt::class => [
                        0 => [
                            [
                                'model'        => PurchaseReceipt::class,
                                'level'        => 0,
                                'only_creator' => false,
                                'permissions'  => ['select' => true, 'read' => true, 'create' => true, 'write' => true],
                            ],
                        ],
                    ],
                ],
                'permissions_version' => '0|0|0|0',
                'currentBranch'       => null,
            ])
            ->withCookie('lang', 'en');

        $warehouse = WarehouseFactory::new()->create();
        $item      = ItemFactory::new()->create();
        $variant   = ItemVariantFactory::new()->create(['item_id' => $item->id, 'code' => 'ZZ-RET-V1']);
        $unit      = Unit::create(['code' => 'PCS-' . fake()->unique()->numerify('####'), 'name' => 'Pieces', 'conversion_factor' => 1, 'is_default' => true]);
        $itemUnit  = ItemUnit::create(['item_id' => $item->id, 'unit_id' => $unit->id, 'conversion_factor' => 1, 'is_default' => true]);

        $po = BaseModel::withoutEvents(fn () => PurchaseOrderFactory::new()->create([
            'supplier_id' => SupplierFactory::new()->create()->id,
            'status'      => [FormStatus::SUBMITTED],
        ]));

        $this->receipt = BaseModel::withoutEvents(fn () => PurchaseReceipt::create([
            'code'              => 'PR-' . fake()->unique()->randomNumber(8),
            'date'              => now(),
            'purchase_order_id' => $po->id,
            'created_by_id'     => $this->user->id,
        ]));
        $this->receipt->forceFill(['submitted_at' => now(), 'status' => [FormStatus::RECEIVED]])->save();

        PurchaseReceiptItem::create([
            'purchase_receipt_id' => $this->receipt->id,
            'purchase_order_id'   => $po->id,
            'item_id'             => $variant->id,
            'item_unit_id'        => $itemUnit->id,
            'quantity'            => 5,
            'target_warehouse_id' => $warehouse->id,
        ]);
    }

    #[Test]
    public function return_link_prefills_form_as_a_return_against_the_receipt(): void {
        $response = $this->get('/purchaseReceipts/create/purchaseReceipt/' . $this->receipt->id);

        $response->assertOk();
        $response->assertInertia(
            fn ($page) => $page
                ->component('Purchase/PurchaseReceipts/Show')
                ->where('defaultData.is_return', true)
                ->where('defaultData.return_against.id', $this->receipt->id)
                ->has('defaultData.items', 1),
        );
    }
}
