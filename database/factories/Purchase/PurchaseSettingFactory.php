<?php

namespace Database\Factories\Purchase;

use App\Models\Purchase\PurchaseSetting;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<PurchaseSetting>
 */
class PurchaseSettingFactory extends Factory {
    protected $model = PurchaseSetting::class;

    public function definition(): array {
        return [
            'singleton'                        => true,
            'default_tax_id'                   => null,
            'default_target_warehouse_id'      => null,
            'default_payment_term_template_id' => null,
            'over_receipt_tolerance_percent'   => null,
            'over_billing_tolerance_percent'   => null,
            'rate_change_action'               => 'none',
        ];
    }
}
