<?php

namespace App\Services\Core\Setting;

class RateChangeComparator {
    /**
     * Bila `$sameCurrency` true (dokumen sumber dan dokumen bermata uang sama), tarif dibandingkan
     * apa adanya dalam mata uang dokumen tanpa kurs, sehingga selisih kurs bukan perubahan tarif.
     * Bila berbeda, kedua tarif dikonversi ke mata uang dasar dengan kursnya masing-masing.
     */
    public function hasChanged(
        float $sourceRate,
        float $sourceExchangeRate,
        float $sourceConversionFactor,
        float $documentRate,
        float $documentExchangeRate,
        float $documentConversionFactor,
        bool $sameCurrency = false,
    ): bool {
        if ($sameCurrency) {
            $sourceExchangeRate = $documentExchangeRate = 1.0;
        }

        $sourceBaseUnitRate   = $sourceRate * $sourceExchangeRate / max($sourceConversionFactor, 0.0000001);
        $documentBaseUnitRate = $documentRate * $documentExchangeRate / max($documentConversionFactor, 0.0000001);

        return abs($sourceBaseUnitRate - $documentBaseUnitRate) > 0.000001;
    }
}
