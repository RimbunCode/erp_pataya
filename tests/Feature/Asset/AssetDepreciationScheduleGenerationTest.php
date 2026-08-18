<?php

namespace Tests\Feature\Asset;

use App\Models\Asset\Asset;
use App\Services\Asset\AssetService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class AssetDepreciationScheduleGenerationTest extends TestCase {
    use RefreshDatabase;

    #[Test]
    public function generates_schedule_when_calculate_depreciation_is_true(): void {
        $asset = Asset::factory()->create([
            'calculate_depreciation'           => true,
            'depreciation_method'              => 'straight_line',
            'gross_purchase_amount'            => 12000,
            'expected_value_after_useful_life' => 0,
            'total_number_of_depreciations'    => 12,
            'frequency_of_depreciation'        => 1,
            'available_for_use_date'           => now()->subMonth(),
        ]);

        (new AssetService)->onApproved($asset);

        $this->assertCount(12, $asset->depreciationSchedules);
        $this->assertDatabaseCount('asset_depreciation_schedules', 12);
    }

    #[Test]
    public function does_not_generate_schedule_when_calculate_depreciation_is_false(): void {
        $asset = Asset::factory()->create(['calculate_depreciation' => false]);

        (new AssetService)->onApproved($asset);

        $this->assertCount(0, $asset->depreciationSchedules);
    }

    #[Test]
    public function no_gl_posting_status_is_created_at_generation_time(): void {
        $asset = Asset::factory()->create([
            'calculate_depreciation'           => true,
            'depreciation_method'              => 'straight_line',
            'gross_purchase_amount'            => 6000,
            'expected_value_after_useful_life' => 0,
            'total_number_of_depreciations'    => 6,
            'frequency_of_depreciation'        => 1,
            'available_for_use_date'           => now()->subMonth(),
        ]);

        (new AssetService)->onApproved($asset);

        $this->assertDatabaseCount('gl_posting_statuses', 0);
    }

    #[Test]
    public function existing_asset_starts_from_opening_accumulated_depreciation(): void {
        $asset = Asset::factory()->create([
            'calculate_depreciation'           => true,
            'depreciation_method'              => 'straight_line',
            'gross_purchase_amount'            => 10000,
            'expected_value_after_useful_life' => 0,
            'total_number_of_depreciations'    => 2,
            'frequency_of_depreciation'        => 1,
            'opening_accumulated_depreciation' => 4000,
            'available_for_use_date'           => now()->subMonth(),
        ]);

        (new AssetService)->onApproved($asset);

        $last = $asset->depreciationSchedules()->orderBy('schedule_date', 'desc')->first();
        $this->assertEqualsWithDelta(10000.0, (float) $last->accumulated_depreciation_amount, 0.02);
    }
}
