<?php

namespace Database\Factories\Core;

use App\Models\Core\Dashboard;
use App\Models\Core\Widget;
use App\Models\DashboardWidget;
use App\Models\User\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Dashboard>
 */
class DashboardFactory extends Factory {
    protected $model = Dashboard::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array {
        return [
            'title'         => fake()->unique()->words(3, true),
            'created_by_id' => User::query()->inRandomOrder()->value('id'),
        ];
    }

    public function configure(): static {
        return $this->afterCreating(function (Dashboard $dashboard): void {
            $widgets = Widget::query()->inRandomOrder()->limit(2)->get();
            if ($widgets->isEmpty()) {
                $widgets = WidgetFactory::new()->count(2)->create();
            }

            foreach ($widgets as $order => $widget) {
                DashboardWidget::query()->create([
                    'width'        => fake()->randomElement(['full', 'half', 'third']),
                    'dashboard_id' => $dashboard->id,
                    'widget_id'    => $widget->id,
                    'type'         => 'widget',
                    'order'        => $order,
                    'is_visible'   => true,
                ]);
            }
        });
    }
}
