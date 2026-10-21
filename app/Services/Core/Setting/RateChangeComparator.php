<?php

namespace App\Services\Core\Setting;

class RateChangeComparator {
    public function hasChanged(
        float $sourceRate,
        float $sourceExchangeRate,
        float $sourceConversionFactor,
        float $documentRate,
        float $documentExchangeRate,
        float $documentConversionFactor,
    ): bool {
        $sourceBaseUnitRate   = $sourceRate * $sourceExchangeRate / max($sourceConversionFactor, 0.0000001);
        $documentBaseUnitRate = $documentRate * $documentExchangeRate / max($documentConversionFactor, 0.0000001);

        return abs($sourceBaseUnitRate - $documentBaseUnitRate) > 0.000001;
    }
}
