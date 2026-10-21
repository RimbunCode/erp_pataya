<?php

namespace Tests\Feature\Core;

use App\Enums\FormStatus;
use App\Models\Asset\AssetServiceConsumedItem;
use App\Models\Core\Branch;
use App\Models\Core\FormatingSeries;
use App\Models\Core\ModelConnection;
use App\Models\Inventory\ItemVariant;
use App\Models\Model as BaseModel;
use App\Models\Purchase\PurchaseOrder;
use App\Models\Purchase\PurchaseReceipt;
use App\Models\Purchase\Supplier;
use App\Models\Service\WorkOrder;
use App\Models\Service\WorkOrderItem;
use App\Models\User\User;
use Database\Factories\Core\CountryFactory;
use Database\Factories\Purchase\PurchaseOrderFactory;
use Database\Factories\Purchase\SupplierFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Spec document-connection-coverage, FR5: tidak ada regresi pada pasangan tipe yang sudah
 * tercatat, payload data tingkat item, dan baris audit bertipe penanda bebas.
 */
class DocumentConnectionRegressionTest extends TestCase {
    use RefreshDatabase;

    private User $user;
    private Branch $branch;
    private PurchaseOrder $po;

    protected function setUp(): void {
        parent::setUp();

        foreach ([FormatingSeries::class, Supplier::class, PurchaseOrder::class, PurchaseReceipt::class, WorkOrder::class] as $model) {
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

        $this->user   = User::factory()->create();
        $this->branch = Branch::create(['name' => 'Main Branch', 'code' => 'MB', 'is_main_branch' => true]);
        $this->actingAs($this->user);

        $supplier = SupplierFactory::new()->create();
        $this->po = BaseModel::withoutEvents(fn () => PurchaseOrderFactory::new()->create([
            'supplier_id' => $supplier->id,
            'status'      => [FormStatus::SUBMITTED],
        ]));
    }

    #[Test]
    public function backfill_does_not_overwrite_existing_item_payload(): void {
        $consumedItem = AssetServiceConsumedItem::factory()->create();
        $workOrder    = WorkOrder::create([
            'code'          => fake()->unique()->bothify('WO-####'),
            'branch_id'     => $this->branch->id,
            'date'          => now(),
            'created_by_id' => $this->user->id,
        ]);
        $item = WorkOrderItem::create([
            'work_order_id'      => $workOrder->id,
            'item_variant_id'    => ItemVariant::factory()->create()->id,
            'quantity'           => 1,
            'referenceable_type' => AssetServiceConsumedItem::class,
            'referenceable_id'   => $consumedItem->id,
        ]);

        // Baris yang sudah tercatat saat submit, dengan payload yang harus tetap.
        $existing = ModelConnection::create([
            'model_type'     => AssetServiceConsumedItem::class,
            'model_id'       => $consumedItem->id,
            'reference_type' => WorkOrderItem::class,
            'reference_id'   => $item->id,
            'data'           => ['ordered_quantity' => 9],
        ]);

        $this->artisan('connections:backfill')->assertSuccessful();

        $this->assertSame(['ordered_quantity' => 9], $existing->fresh()->data);
    }

    #[Test]
    public function backfill_keeps_existing_header_pair_and_its_payload(): void {
        $receipt = BaseModel::withoutEvents(fn () => PurchaseReceipt::create([
            'code'              => 'PR-' . fake()->unique()->randomNumber(8),
            'branch_id'         => $this->branch->id,
            'purchase_order_id' => $this->po->id,
            'date'              => now(),
            'created_by_id'     => $this->user->id,
        ]));

        $existing = ModelConnection::create([
            'model_type'     => PurchaseOrder::class,
            'model_id'       => $this->po->id,
            'reference_type' => PurchaseReceipt::class,
            'reference_id'   => $receipt->id,
            'data'           => ['note' => 'sudah ada'],
        ]);

        $this->artisan('connections:backfill')->assertSuccessful();

        $this->assertSame(['note' => 'sudah ada'], $existing->fresh()->data);
        $this->assertSame(1, ModelConnection::query()
            ->where('reference_type', PurchaseReceipt::class)
            ->where('reference_id', $receipt->id)
            ->count());
    }

    #[Test]
    public function backfill_leaves_audit_marker_rows_untouched(): void {
        $audit = ModelConnection::create([
            'model_type'     => PurchaseOrder::class,
            'model_id'       => $this->po->id,
            'reference_type' => 'sync',
            'reference_id'   => (string) Str::ulid(),
            'data'           => ['action' => 'sync'],
        ]);

        $this->artisan('connections:backfill')->assertSuccessful();

        $this->assertSame(['action' => 'sync'], $audit->fresh()->data);
        $this->assertSame(1, ModelConnection::query()->where('reference_type', 'sync')->count());
    }
}
