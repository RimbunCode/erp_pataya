<?php

namespace Database\Factories\Core\DefaultRules;

use App\Models\Core\Branch;
use App\Models\Core\DefaultRules\DefaultWarehouseRule;
use App\Models\Inventory\Warehouse;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<DefaultWarehouseRule> */
class DefaultWarehouseRuleFactory extends Factory {
    protected $model = DefaultWarehouseRule::class;

    public function definition(): array {
        return [
            'module'           => 'purchase',
            'document_type'    => 'purchase_order',
            'item_type'        => 'inventory',
            'is_stock_item'    => true,
            'item_category_id' => null,
            'warehouse_id'     => function (): string {
                $branch    = Branch::query()->create(['name' => fake()->unique()->company()]);
                $warehouse = Warehouse::query()->create([
                    'branch_id' => $branch->id,
                    'name'      => fake()->unique()->word(),
                    'code'      => strtoupper(fake()->unique()->bothify('WH-####')),
                ]);

                return $warehouse->id;
            },
            'priority' => 0,
        ];
    }
}
