<?php

namespace App\Services\Handlebar;

/**
 * PHP port of the arithmetic Handlebars helpers registered in
 * `resources/js/lib/initHandlebar.js` (multiply, subtract, add, divide),
 * used for inline expressions in calculated print-template table columns
 * (e.g. `{{multiply this.quantity this.price}}`).
 */
class ArithmeticHelperService {
    public function multiply(mixed $a, mixed $b): float {
        $numA = $this->toFloat($a);
        $numB = $this->toFloat($b);

        if ($numA === null || $numB === null) {
            return 0;
        }

        return $numA * $numB;
    }

    public function subtract(mixed $a, mixed $b): float {
        $numA = $this->toFloat($a);
        $numB = $this->toFloat($b);

        if ($numA === null) {
            return 0;
        }
        if ($numB === null) {
            return $numA;
        }

        return $numA - $numB;
    }

    public function add(mixed $a, mixed $b): float {
        $numA = $this->toFloat($a);
        $numB = $this->toFloat($b);

        if ($numA === null) {
            return $numB ?? 0;
        }
        if ($numB === null) {
            return $numA;
        }

        return $numA + $numB;
    }

    public function divide(mixed $a, mixed $b): float {
        $numA = $this->toFloat($a);
        $numB = $this->toFloat($b);

        if ($numA === null) {
            return 0;
        }
        if ($numB === null || $numB === 0.0) {
            return 0;
        }

        return $numA / $numB;
    }

    protected function toFloat(mixed $value): ?float {
        if (is_int($value) || is_float($value)) {
            return (float) $value;
        }
        if (is_string($value) && is_numeric($value)) {
            return (float) $value;
        }

        return null;
    }
}
