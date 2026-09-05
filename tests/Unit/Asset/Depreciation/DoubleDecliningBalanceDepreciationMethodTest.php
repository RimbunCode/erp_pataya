<?php

namespace Tests\Unit\Asset\Depreciation;

use App\Models\Asset\Asset;
use App\Services\Asset\Depreciation\Methods\DoubleDecliningBalanceDepreciationMethod;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class DoubleDecliningBalanceDepreciationMethodTest extends TestCase {
    #[Test]
    public function amount_decreases_each_period(): void {
        $asset = new Asset([
            'gross_purchase_amount'            => 10000,
            'expected_value_after_useful_life' => 0,
            'total_number_of_depreciations'    => 5,
            'frequency_of_depreciation'        => 1,
            'opening_accumulated_depreciation' => 0,
            'depreciation_start_date'          => '2026-01-01',
        ]);

        $rows = (new DoubleDecliningBalanceDepreciationMethod)->calculate($asset);

        for ($i = 1; $i < count($rows); $i++) {
            $this->assertLessThanOrEqual($rows[$i - 1]['depreciation_amount'], $rows[$i]['depreciation_amount']);
        }
    }

    #[Test]
    public function does_not_exceed_salvage_floor(): void {
        $asset = new Asset([
            'gross_purchase_amount'            => 10000,
            'expected_value_after_useful_life' => 1000,
            'total_number_of_depreciations'    => 5,
            'frequency_of_depreciation'        => 1,
            'opening_accumulated_depreciation' => 0,
            'depreciation_start_date'          => '2026-01-01',
        ]);

        $rows = (new DoubleDecliningBalanceDepreciationMethod)->calculate($asset);

        $this->assertLessThanOrEqual(9000.0, end($rows)['accumulated_depreciation_amount']);
    }

    #[Test]
    public function prorates_first_period_when_daily_prorata_based_and_not_starting_on_first_of_month(): void {
        $asset = new Asset([
            'gross_purchase_amount'            => 10000,
            'expected_value_after_useful_life' => 0,
            'total_number_of_depreciations'    => 5,
            'frequency_of_depreciation'        => 1,
            'opening_accumulated_depreciation' => 0,
            'depreciation_start_date'          => '2026-01-15',
            'daily_prorata_based'              => true,
        ]);

        $rows = (new DoubleDecliningBalanceDepreciationMethod)->calculate($asset);

        // rate = 2/5 = 0.4; full amount period 1 = 4000; Jan 2026 31 hari, dimiliki 17 hari.
        $this->assertEqualsWithDelta(4000 * 17 / 31, $rows[0]['depreciation_amount'], 0.02);
    }
}
