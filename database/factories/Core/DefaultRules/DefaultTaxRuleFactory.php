<?php

namespace Database\Factories\Core\DefaultRules;

use App\Models\Core\DefaultRules\DefaultTaxRule;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<DefaultTaxRule> */
class DefaultTaxRuleFactory extends Factory {
    protected $model = DefaultTaxRule::class;

    public function definition(): array {
        return [
            'module'           => 'purchase',
            'document_type'    => 'purchase_order',
            'item_type'        => 'goods',
            'is_stock_item'    => null,
            'item_category_id' => null,
            'tax_id'           => null,
            'priority'         => 0,
        ];
    }
}
