<?php

namespace Tests\Unit\Asset\Depreciation;

use App\Services\Asset\Depreciation\DepreciationMethodFactory;
use App\Services\Asset\Depreciation\Methods\DoubleDecliningBalanceDepreciationMethod;
use App\Services\Asset\Depreciation\Methods\ManualDepreciationMethod;
use App\Services\Asset\Depreciation\Methods\StraightLineDepreciationMethod;
use App\Services\Asset\Depreciation\Methods\WrittenDownValueDepreciationMethod;
use LogicException;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class DepreciationMethodFactoryTest extends TestCase {
    #[Test]
    public function resolves_correct_strategy_per_method(): void {
        $this->assertInstanceOf(StraightLineDepreciationMethod::class, DepreciationMethodFactory::make('straight_line'));
        $this->assertInstanceOf(DoubleDecliningBalanceDepreciationMethod::class, DepreciationMethodFactory::make('double_declining_balance'));
        $this->assertInstanceOf(WrittenDownValueDepreciationMethod::class, DepreciationMethodFactory::make('written_down_value'));
        $this->assertInstanceOf(ManualDepreciationMethod::class, DepreciationMethodFactory::make('manual'));
    }

    #[Test]
    public function throws_for_unknown_method(): void {
        $this->expectException(LogicException::class);

        DepreciationMethodFactory::make('unknown_method');
    }
}
