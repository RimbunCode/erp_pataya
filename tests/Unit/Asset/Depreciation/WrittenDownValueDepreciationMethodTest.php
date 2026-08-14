<?php

namespace Tests\Unit\Asset\Depreciation;

use App\Models\Asset\Asset;
use App\Services\Asset\Depreciation\Methods\WrittenDownValueDepreciationMethod;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class WrittenDownValueDepreciationMethodTest extends TestCase {
    #[Test]
    public function calculates_amount_from_remaining_book_value(): void {
        $asset = new Asset([
            'gross_purchase_amount'            => 10000,
            'expected_value_after_useful_life' => 0,
            'total_number_of_depreciations'    => 3,
            'frequency_of_depreciation'        => 1,
            'rate_of_depreciation'             => 0.20,
            'opening_accumulated_depreciation' => 0,
            'depreciation_start_date'          => '2026-01-01',
        ]);

        $rows = (new WrittenDownValueDepreciationMethod)->calculate($asset);

        $this->assertEqualsWithDelta(2000.0, $rows[0]['depreciation_amount'], 0.02);
        $this->assertEqualsWithDelta(1600.0, $rows[1]['depreciation_amount'], 0.02);
    }

    #[Test]
    public function does_not_exceed_salvage_floor(): void {
        $asset = new Asset([
            'gross_purchase_amount'            => 10000,
            'expected_value_after_useful_life' => 1000,
            'total_number_of_depreciations'    => 10,
            'frequency_of_depreciation'        => 1,
            'rate_of_depreciation'             => 0.50,
            'opening_accumulated_depreciation' => 0,
            'depreciation_start_date'          => '2026-01-01',
        ]);

        $rows = (new WrittenDownValueDepreciationMethod)->calculate($asset);

        $this->assertLessThanOrEqual(9000.0, end($rows)['accumulated_depreciation_amount']);
    }
}
