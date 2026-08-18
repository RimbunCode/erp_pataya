<?php

namespace Tests\Unit\Asset\Depreciation;

use App\Models\Asset\Asset;
use App\Services\Asset\Depreciation\Methods\StraightLineDepreciationMethod;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class StraightLineDepreciationMethodTest extends TestCase {
    #[Test]
    public function calculates_equal_periods_summing_to_depreciable_base(): void {
        $asset = new Asset([
            'gross_purchase_amount'            => 12000,
            'expected_value_after_useful_life' => 0,
            'total_number_of_depreciations'    => 12,
            'frequency_of_depreciation'        => 1,
            'opening_accumulated_depreciation' => 0,
            'depreciation_start_date'          => '2026-01-01',
        ]);

        $rows = (new StraightLineDepreciationMethod)->calculate($asset);

        $this->assertCount(12, $rows);
        $this->assertEqualsWithDelta(12000.0, $rows[0]['depreciation_amount'] * 12, 0.02);
        $this->assertEqualsWithDelta(12000.0, end($rows)['accumulated_depreciation_amount'], 0.02);
    }

    #[Test]
    public function clamps_last_period_to_salvage_floor(): void {
        $asset = new Asset([
            'gross_purchase_amount'            => 10000,
            'expected_value_after_useful_life' => 1000,
            'total_number_of_depreciations'    => 3,
            'frequency_of_depreciation'        => 1,
            'opening_accumulated_depreciation' => 0,
            'depreciation_start_date'          => '2026-01-01',
        ]);

        $rows = (new StraightLineDepreciationMethod)->calculate($asset);

        $this->assertEqualsWithDelta(9000.0, end($rows)['accumulated_depreciation_amount'], 0.02);
    }

    #[Test]
    public function starts_from_opening_accumulated_depreciation_for_existing_asset(): void {
        $asset = new Asset([
            'gross_purchase_amount'            => 10000,
            'expected_value_after_useful_life' => 0,
            'total_number_of_depreciations'    => 2,
            'frequency_of_depreciation'        => 1,
            'opening_accumulated_depreciation' => 4000,
            'depreciation_start_date'          => '2026-01-01',
        ]);

        $rows = (new StraightLineDepreciationMethod)->calculate($asset);

        $this->assertEqualsWithDelta(10000.0, end($rows)['accumulated_depreciation_amount'], 0.02);
    }
}
