<?php

namespace App\Services\Asset\Depreciation;

use App\Services\Asset\Depreciation\Methods\DoubleDecliningBalanceDepreciationMethod;
use App\Services\Asset\Depreciation\Methods\ManualDepreciationMethod;
use App\Services\Asset\Depreciation\Methods\StraightLineDepreciationMethod;
use App\Services\Asset\Depreciation\Methods\WrittenDownValueDepreciationMethod;
use LogicException;

class DepreciationMethodFactory {
    public static function make(string $method): DepreciationMethodContract {
        return match ($method) {
            'straight_line'            => new StraightLineDepreciationMethod,
            'double_declining_balance' => new DoubleDecliningBalanceDepreciationMethod,
            'written_down_value'       => new WrittenDownValueDepreciationMethod,
            'manual'                   => new ManualDepreciationMethod,
            default                    => throw new LogicException("Unknown depreciation method: {$method}"),
        };
    }
}
