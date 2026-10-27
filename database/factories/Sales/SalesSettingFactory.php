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
            'singleton'                        => true,
            'default_tax_id'                   => null,
            'default_source_warehouse_id'      => null,
            'default_payment_term_template_id' => null,
            'over_delivery_tolerance_percent'  => null,
            'over_billing_tolerance_percent'   => null,
            'rate_change_action'               => 'none',
            'below_cost_action'                => 'none',
        ];
    }
}
