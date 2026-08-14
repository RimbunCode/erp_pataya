<?php

namespace Tests\Unit\Asset\Depreciation;

use App\Models\Asset\Asset;
use App\Services\Asset\Depreciation\Methods\ManualDepreciationMethod;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class ManualDepreciationMethodTest extends TestCase {
    #[Test]
    public function all_rows_have_zero_depreciation_amount(): void {
        $asset = new Asset([
            'gross_purchase_amount'            => 10000,
            'expected_value_after_useful_life' => 0,
            'total_number_of_depreciations'    => 4,
            'frequency_of_depreciation'        => 1,
            'opening_accumulated_depreciation' => 0,
            'depreciation_start_date'          => '2026-01-01',
        ]);

        $rows = (new ManualDepreciationMethod)->calculate($asset);

        $this->assertCount(4, $rows);
        foreach ($rows as $row) {
            $this->assertSame(0.0, $row['depreciation_amount']);
        }
    }
}
