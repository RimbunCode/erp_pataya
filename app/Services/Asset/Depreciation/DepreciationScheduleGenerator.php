<?php

namespace App\Services\Asset\Depreciation;

use App\Models\Asset\Asset;
use App\Models\Asset\AssetDepreciationSchedule;
use Illuminate\Support\Str;
use LogicException;

class DepreciationScheduleGenerator {
    public function generate(Asset $asset): void {
        if (empty($asset->total_number_of_depreciations)) {
            throw new LogicException(__('asset/asset.total_number_of_depreciations_required'));
        }

        $strategy = DepreciationMethodFactory::make($asset->depreciation_method);
        $rows     = $strategy->calculate($asset);

        AssetDepreciationSchedule::insert(array_map(fn (array $row) => [
            'id'                              => (string) Str::ulid(),
            'asset_id'                        => $asset->id,
            'schedule_date'                   => $row['schedule_date']->toDateString(),
            'depreciation_amount'             => $row['depreciation_amount'],
            'accumulated_depreciation_amount' => $row['accumulated_depreciation_amount'],
            'is_example'                      => $asset->is_example ?? false,
            'created_at'                      => now(),
            'updated_at'                      => now(),
        ], $rows));
    }
}
