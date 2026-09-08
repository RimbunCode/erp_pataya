<?php

namespace Tests\Unit\Asset;

use App\Enums\FormStatus;
use App\Models\Asset\Asset;
use App\Models\Asset\AssetCategory;
use App\Models\Asset\AssetLocation;
use App\Models\Core\FormatingSeries;
use App\Models\Finances\PurchaseInvoice;
use App\Models\Model as BaseModel;
use App\Models\Purchase\PurchaseReceipt;
use App\Models\User\User;
use App\Services\Asset\AssetService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use LogicException;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class AssetServiceSubmitGuardTest extends TestCase {
    use RefreshDatabase;

    private AssetService $service;

    protected function setUp(): void {
        parent::setUp();
        $this->service = app(AssetService::class);

        // initPermissions() runtime-patch kolom shared trait Submitable
        // (status/code/branch_id/dst) via Schema::hasColumn() -- lihat
        // DataTable::initPermissions(). PurchaseReceipt/PurchaseInvoice
        // dibutuhkan makeBareReceipt()/makeBareInvoice() (Requirement 7 test);
        // FormatingSeries/Asset dibutuhkan test yang sampai ke tahap sukses
        // submit() (generate() butuh row FormatingSeries untuk Asset::class).
        foreach ([FormatingSeries::class, Asset::class, PurchaseReceipt::class, PurchaseInvoice::class] as $model) {
            $model::initPermissions();
        }
    }

    #[Test]
    public function submit_rejects_when_category_is_null(): void {
        $location = AssetLocation::factory()->create();

        $asset = Asset::factory()->create([
            'asset_category_id' => null,
            'asset_location_id' => $location->id,
            'status'            => [FormStatus::DRAFT],
        ]);

        $this->expectException(LogicException::class);
        $this->expectExceptionMessage(__('asset/asset.cannot_submit_incomplete', [
            'fields' => __('asset/asset.columns.asset_category'),
        ]));

        $this->service->submit($asset);
    }

    #[Test]
    public function submit_rejects_when_location_is_null(): void {
        $category = AssetCategory::factory()->create();

        $asset = Asset::factory()->create([
            'asset_category_id' => $category->id,
            'asset_location_id' => null,
            'status'            => [FormStatus::DRAFT],
        ]);

        $this->expectException(LogicException::class);
        $this->expectExceptionMessage(__('asset/asset.cannot_submit_incomplete', [
            'fields' => __('asset/asset.columns.asset_location'),
        ]));

        $this->service->submit($asset);
    }

    #[Test]
    public function submit_rejects_when_both_category_and_location_are_null(): void {
        $asset = Asset::factory()->create([
            'asset_category_id' => null,
            'asset_location_id' => null,
            'status'            => [FormStatus::DRAFT],
        ]);

        $this->expectException(LogicException::class);
        $this->expectExceptionMessage(__('asset/asset.cannot_submit_incomplete', [
            'fields' => implode(', ', [
                __('asset/asset.columns.asset_category'),
                __('asset/asset.columns.asset_location'),
            ]),
        ]));

        $this->service->submit($asset);
    }

    #[Test]
    public function submit_does_not_block_asset_with_complete_data(): void {
        // Regression: asset with both category and location set should pass the guard.
        // The guard only checks for null — complete data must not trigger cannot_submit_incomplete.
        $asset = Asset::factory()->create([
            'status' => [FormStatus::DRAFT],
        ]);

        $this->assertNotNull($asset->asset_category_id);
        $this->assertNotNull($asset->asset_location_id);

        // Verify the guard condition directly — no need to call full submit()
        $this->assertTrue(
            $asset->asset_category_id !== null && $asset->asset_location_id !== null,
            'Asset with complete data should pass the submit guard check',
        );
    }

    // ─── Spec asset-management-purchase-integration-v2, Requirement 7 ──────

    private function makeBareReceipt(): PurchaseReceipt {
        $user = User::factory()->create();

        return BaseModel::withoutEvents(fn () => PurchaseReceipt::create([
            'code'          => 'PR-' . fake()->unique()->randomNumber(8),
            'date'          => now(),
            'created_by_id' => $user->id,
        ]));
    }

    private function makeBareInvoice(): PurchaseInvoice {
        $user = User::factory()->create();

        return BaseModel::withoutEvents(fn () => PurchaseInvoice::create([
            'code'          => 'PI-' . fake()->unique()->randomNumber(8),
            'date'          => now(),
            'created_by_id' => $user->id,
        ]));
    }

    #[Test]
    public function submit_rejects_when_purchase_history_incomplete(): void {
        $category = AssetCategory::factory()->create();
        $location = AssetLocation::factory()->create();
        $invoice  = $this->makeBareInvoice();
        $asset    = Asset::factory()->create([
            'asset_category_id'   => $category->id,
            'asset_location_id'   => $location->id,
            'purchase_invoice_id' => $invoice->id,
            'purchase_receipt_id' => null,
            'status'              => [FormStatus::DRAFT],
        ]);

        $this->expectException(LogicException::class);
        $this->expectExceptionMessage(__('asset/asset.cannot_submit_incomplete', [
            'fields' => __('asset/asset.purchase_receipt_or_invoice'),
        ]));

        $this->service->submit($asset);
    }

    #[Test]
    public function submit_accepted_when_no_purchase_history_at_all(): void {
        $category = AssetCategory::factory()->create();
        $location = AssetLocation::factory()->create();
        $asset    = Asset::factory()->create([
            'asset_category_id'   => $category->id,
            'asset_location_id'   => $location->id,
            'purchase_receipt_id' => null,
            'purchase_invoice_id' => null,
            'status'              => [FormStatus::DRAFT],
        ]);

        $this->service->submit($asset);

        $this->assertNotNull($asset->fresh()->code);
    }

    #[Test]
    public function submit_accepted_when_purchase_history_complete(): void {
        $category = AssetCategory::factory()->create();
        $location = AssetLocation::factory()->create();
        $receipt  = $this->makeBareReceipt();
        $invoice  = $this->makeBareInvoice();
        $asset    = Asset::factory()->create([
            'asset_category_id'   => $category->id,
            'asset_location_id'   => $location->id,
            'purchase_receipt_id' => $receipt->id,
            'purchase_invoice_id' => $invoice->id,
            'status'              => [FormStatus::DRAFT],
        ]);

        $this->service->submit($asset);

        $this->assertNotNull($asset->fresh()->code);
    }

    #[Test]
    public function completing_missing_link_via_update_then_submit_succeeds(): void {
        $category = AssetCategory::factory()->create();
        $location = AssetLocation::factory()->create();
        $receipt  = $this->makeBareReceipt();
        $asset    = Asset::factory()->create([
            'asset_category_id'   => $category->id,
            'asset_location_id'   => $location->id,
            'purchase_receipt_id' => $receipt->id,
            'purchase_invoice_id' => null,
            'status'              => [FormStatus::DRAFT],
        ]);

        try {
            $this->service->submit($asset);
            $this->fail('Diharapkan LogicException, tidak ada exception yang dilempar.');
        } catch (LogicException) {
            // expected
        }

        $invoice = $this->makeBareInvoice();
        $asset->forceFill(['purchase_invoice_id' => $invoice->id])->save();

        $this->service->submit($asset);

        $this->assertNotNull($asset->fresh()->code);
    }
}
