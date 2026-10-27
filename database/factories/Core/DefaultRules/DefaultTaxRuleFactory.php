<?php

namespace Database\Factories\Core\DefaultRules;

use App\Models\Core\DefaultRules\DefaultTaxRule;
use Database\Factories\Finances\TaxFactory;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<DefaultTaxRule> */
class DefaultTaxRuleFactory extends Factory {
    protected $model = DefaultTaxRule::class;

    public function definition(): array {
        return [
            'module'           => 'purchase',
            'document_type'    => 'purchase_order',
            'item_type'        => 'inventory',
            'is_stock_item'    => null,
            'item_category_id' => null,
            'tax_id'           => TaxFactory::new(),
            'priority'         => 0,
        ];
    }
}
