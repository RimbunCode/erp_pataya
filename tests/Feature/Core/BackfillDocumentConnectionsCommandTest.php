<?php

namespace Tests\Feature\Core;

use App\Enums\FormStatus;
use App\Models\Asset\AssetService;
use App\Models\Asset\AssetServiceConsumedItem;
use App\Models\Core\Branch;
use App\Models\Core\FormatingSeries;
use App\Models\Core\ModelConnection;
use App\Models\Model as BaseModel;
use App\Models\Purchase\PurchaseOrder;
use App\Models\Purchase\PurchaseReceipt;
use App\Models\Purchase\Supplier;
use App\Models\Service\WorkOrder;
use App\Models\Service\WorkOrderItem;
use App\Models\User\User;
use Database\Factories\Core\CountryFactory;
use Database\Factories\Inventory\ItemVariantFactory;
use Database\Factories\Purchase\PurchaseOrderFactory;
use Database\Factories\Purchase\SupplierFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Spec document-connection-coverage, FR4 dan NFR1: backfill koneksi untuk dokumen lama.
 */
class BackfillDocumentConnectionsCommandTest extends TestCase {
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

    /**
     * Dokumen dibuat langsung tanpa submit, meniru data lama yang belum punya koneksi.
     */
    private function makeReceipt(array $over = []): PurchaseReceipt {
        return BaseModel::withoutEvents(fn () => PurchaseReceipt::create(array_merge([
            'code'          => 'PR-' . fake()->unique()->randomNumber(8),
            'branch_id'     => $this->branch->id,
            'date'          => now(),
            'created_by_id' => $this->user->id,
        ], $over)));
    }

    private function countConnections(): int {
        return ModelConnection::count();
    }

    #[Test]
    public function backfills_receipt_link_to_purchase_order(): void {
        $receipt = $this->makeReceipt(['purchase_order_id' => $this->po->id]);

        $this->artisan('connections:backfill')->assertSuccessful();

        $this->assertTrue(
            ModelConnection::query()
                ->where('model_type', PurchaseOrder::class)
                ->where('model_id', $this->po->id)
                ->where('reference_type', PurchaseReceipt::class)
                ->where('reference_id', $receipt->id)
                ->exists(),
        );
    }

    #[Test]
    public function backfills_return_link_to_returned_receipt(): void {
        $original = $this->makeReceipt(['purchase_order_id' => $this->po->id]);
        $return   = $this->makeReceipt(['purchase_order_id' => $this->po->id, 'return_against_id' => $original->id]);

        $this->artisan('connections:backfill')->assertSuccessful();

        $this->assertTrue(
            ModelConnection::query()
                ->where('model_type', PurchaseReceipt::class)
                ->where('model_id', $original->id)
                ->where('reference_type', PurchaseReceipt::class)
                ->where('reference_id', $return->id)
                ->exists(),
        );
    }

    #[Test]
    public function backfills_item_chain_from_work_order_item_to_asset_service(): void {
        $consumedItem = AssetServiceConsumedItem::factory()->create();
        $workOrder    = WorkOrder::create([
            'code'          => fake()->unique()->bothify('WO-####'),
            'branch_id'     => $this->branch->id,
            'date'          => now(),
            'created_by_id' => $this->user->id,
        ]);
        $item = WorkOrderItem::create([
            'work_order_id'      => $workOrder->id,
            'item_variant_id'    => ItemVariantFactory::new()->create()->id,
            'quantity'           => 1,
            'referenceable_type' => AssetServiceConsumedItem::class,
            'referenceable_id'   => $consumedItem->id,
        ]);

        $this->artisan('connections:backfill')->assertSuccessful();

        $this->assertTrue(
            ModelConnection::query()
                ->where('model_type', AssetServiceConsumedItem::class)
                ->where('model_id', $consumedItem->id)
                ->where('reference_type', WorkOrderItem::class)
                ->where('reference_id', $item->id)
                ->exists(),
            'Koneksi item tingkat pertama harus dibackfill.',
        );
        $this->assertTrue(
            ModelConnection::query()
                ->where('model_type', AssetService::class)
                ->where('model_id', $consumedItem->asset_service_id)
                ->where('reference_type', WorkOrder::class)
                ->where('reference_id', $workOrder->id)
                ->exists(),
            'Koneksi tingkat dokumen ke AssetService harus dibackfill.',
        );
    }

    #[Test]
    public function dry_run_writes_nothing(): void {
        $this->makeReceipt(['purchase_order_id' => $this->po->id]);
        $before = $this->countConnections();

        $this->artisan('connections:backfill', ['--dry-run' => true])
            ->expectsOutputToContain('DRY RUN')
            ->assertSuccessful();

        $this->assertSame($before, $this->countConnections());
    }

    #[Test]
    public function running_twice_does_not_duplicate_rows(): void {
        $original = $this->makeReceipt(['purchase_order_id' => $this->po->id]);
        $this->makeReceipt(['purchase_order_id' => $this->po->id, 'return_against_id' => $original->id]);

        $this->artisan('connections:backfill')->assertSuccessful();
        $countAfterFirst = $this->countConnections();

        $this->artisan('connections:backfill')->assertSuccessful();

        $this->assertSame($countAfterFirst, $this->countConnections());
    }

    #[Test]
    public function document_without_parent_is_skipped(): void {
        $receipt = $this->makeReceipt(['purchase_order_id' => null]);

        $this->artisan('connections:backfill')->assertSuccessful();

        $this->assertFalse(
            ModelConnection::query()
                ->where('reference_type', PurchaseReceipt::class)
                ->where('reference_id', $receipt->id)
                ->exists(),
        );
    }
}
