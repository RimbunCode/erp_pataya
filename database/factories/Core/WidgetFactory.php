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
        $metric = fake()->randomElement([
            'Sales Amount',
            'Purchase Amount',
            'Open Invoices',
            'Stock Movement',
            'Ready Stock',
            'New Customers',
            'Outstanding Payables',
        ]);
        $type         = fake()->randomElement(['summary', 'number', 'list']);
        $timeInterval = fake()->randomElement(['daily', 'weekly', 'monthly']);
        $timespan     = match ($timeInterval) {
            'daily'  => '7_days',
            'weekly' => '30_days',
            default  => '90_days',
        };
        $valueBasedOn      = str_contains($metric, 'Amount') ? 'amount' : 'quantity';
        $aggregateFunction = $valueBasedOn === 'amount'
            ? 'sum'
            : fake()->randomElement(['count', 'sum']);

        return [
            'title'                       => "{$metric} " . fake()->randomElement(['Today', 'This Week', 'This Month']),
            'type'                        => $type,
            'calculation_type'            => fake()->randomElement(['sum', 'count', 'avg']),
            'time_based_on'               => fake()->randomElement(['created_at', 'updated_at']),
            'time_interval'               => $timeInterval,
            'timespan'                    => $timespan,
            'value_based_on'              => $valueBasedOn,
            'group_by_type'               => fake()->randomElement(['none', 'branch', 'status']),
            'group_by_base_on'            => fake()->randomElement(['date', 'model']),
            'aggregate_function_based_on' => $aggregateFunction,
            'filters'                     => ['status' => ['active', 'submitted']],
            'config'                      => [
                'show_legend' => true,
                'chart_type'  => fake()->randomElement(['bar', 'line', 'table']),
            ],
            'description'   => "Widget to monitor {$metric} with {$type} presentation.",
            'created_by_id' => User::query()->inRandomOrder()->value('id'),
            'model_id'      => $permission->id,
            'model_class'   => $permission->model,
        ];
    }
}
