<?php

namespace App\Services\Core\Setting;

class ToleranceCalculator {
    public function allowed(float $sourceQuantity, float $alreadyUsed, ?float $percent): ?float {
        if ($percent === null) {
            return null;
        }

        $maximumAllowed = max(0, $sourceQuantity * (1 + $percent / 100));

        return max(0, $maximumAllowed - $alreadyUsed);
    }

    public function exceeds(float $requested, float $sourceQuantity, float $alreadyUsed, ?float $percent): bool {
        $allowed = $this->allowed($sourceQuantity, $alreadyUsed, $percent);

        return $allowed !== null && $requested - $allowed > 0.0001;
    }

    public function exceedsValue(float $requestedValue, float $sourceValue, float $alreadyBilledValue, ?float $percent): bool {
        return $this->exceeds($requestedValue, $sourceValue, $alreadyBilledValue, $percent);
    }
}
