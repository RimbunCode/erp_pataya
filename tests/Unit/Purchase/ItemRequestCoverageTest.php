<?php

namespace Tests\Unit\Purchase;

use App\Models\Asset\AssetServiceConsumedItem;
use App\Models\Inventory\ItemVariant;
use App\Models\Purchase\ItemRequestCoverage;
use App\Models\Purchase\PurchaseRequest;
use App\Models\Purchase\PurchaseRequestItem;
use App\Models\User\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Relasi morphTo source/covering — spec item-request-auto-detect, Requirement 4.4.
 */
class ItemRequestCoverageTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        // initPermissions() runtime-patch kolom shared trait Submitable
        // (status/code/branch_id/dst) via Schema::hasColumn() — lihat
        // DataTable::initPermissions(), pola sama seperti PurchaseReceiptItemScopeTest.
        PurchaseRequest::initPermissions();
    }

    #[Test]
    public function source_resolves_to_the_source_document_model(): void {
        $sourceItem = AssetServiceConsumedItem::factory()->create();

        $coverage = ItemRequestCoverage::factory()
            ->for($sourceItem, 'source')
            ->create();

        $this->assertTrue($coverage->source->is($sourceItem));
        $this->assertSame(AssetServiceConsumedItem::class, $coverage->source_type);
    }

    #[Test]
    public function covering_resolves_to_the_covering_document_model(): void {
        $purchaseRequest = PurchaseRequest::create([
            'code'          => 'PR-TEST-0001',
            'date'          => now(),
            'created_by_id' => User::factory()->create()->id,
        ]);
        $variant      = ItemVariant::factory()->create();
        $coveringItem = PurchaseRequestItem::create([
            'purchase_request_id' => $purchaseRequest->id,
            'item_variant_id'     => $variant->id,
            'quantity'            => 5,
        ]);

        $coverage = ItemRequestCoverage::factory()
            ->for($coveringItem, 'covering')
            ->create();

        $this->assertTrue($coverage->covering->is($coveringItem));
        $this->assertSame(PurchaseRequestItem::class, $coverage->covering_type);
    }

    #[Test]
    public function quantity_covered_is_cast_to_float(): void {
        $coverage = ItemRequestCoverage::factory()->create(['quantity_covered' => '12.5']);

        $this->assertSame(12.5, $coverage->fresh()->quantity_covered);
    }

    #[Test]
    public function soft_deleting_a_coverage_excludes_it_from_default_queries(): void {
        $coverage = ItemRequestCoverage::factory()->create();

        $coverage->delete();

        $this->assertNull(ItemRequestCoverage::find($coverage->id));
        $this->assertNotNull(ItemRequestCoverage::withTrashed()->find($coverage->id));
    }
}
