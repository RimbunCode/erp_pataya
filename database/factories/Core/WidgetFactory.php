<?php

namespace Database\Factories\Core;

use App\Models\Core\Widget;
use App\Models\User\Permission;
use App\Models\User\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Widget>
 */
class WidgetFactory extends Factory {
    protected $model = Widget::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array {
        $permission = Permission::query()->inRandomOrder()->first() ?? Permission::query()->create([
            'module'      => 'Core',
            'name'        => 'Widgets',
            'model'       => Widget::class,
            'route'       => 'widgets',
            'permissions' => ['select', 'read', 'write', 'create', 'delete'],
        ]);

        return [
            'title'                       => fake()->unique()->words(3, true),
            'type'                        => fake()->randomElement(['summary', 'number', 'list']),
            'calculation_type'            => fake()->randomElement(['sum', 'count', 'avg']),
            'time_based_on'               => fake()->randomElement(['created_at', 'updated_at']),
            'time_interval'               => fake()->randomElement(['daily', 'weekly', 'monthly']),
            'timespan'                    => fake()->randomElement(['7_days', '30_days', '90_days']),
            'value_based_on'              => fake()->randomElement(['amount', 'quantity']),
            'group_by_type'               => fake()->randomElement(['none', 'branch', 'status']),
            'group_by_base_on'            => fake()->randomElement(['date', 'model']),
            'aggregate_function_based_on' => fake()->randomElement(['sum', 'count']),
            'filters'                     => ['active' => true],
            'config'                      => ['show_legend' => true],
            'description'                 => fake()->sentence(),
            'created_by_id'               => User::query()->inRandomOrder()->value('id'),
            'model_id'                    => $permission->id,
            'model_class'                 => $permission->model,
        ];
    }
}
