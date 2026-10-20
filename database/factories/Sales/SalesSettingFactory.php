<?php

namespace Database\Factories\Sales;

use App\Models\Sales\SalesSetting;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<SalesSetting>
 */
class SalesSettingFactory extends Factory {
    protected $model = SalesSetting::class;

    public function definition(): array {
        return [
            'singleton'      => true,
            'default_tax_id' => null,
        ];
    }
}
