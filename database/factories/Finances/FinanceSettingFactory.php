<?php

namespace Database\Factories\Finances;

use App\Models\Finances\FinanceSetting;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<FinanceSetting>
 */
class FinanceSettingFactory extends Factory {
    protected $model = FinanceSetting::class;

    public function definition(): array {
        return [
            'singleton'                      => true,
            'tax_invoice_serial_range_start' => 0,
            'tax_invoice_serial_range_end'   => 0,
            'tax_invoice_serial_last_used'   => 0,
        ];
    }
}
