<?php

namespace Tests\Feature\Core;

use App\Http\Middleware\AppMiddleware;
use App\Http\Middleware\LanguageMiddleware;
use App\Models\Core\Widget;
use App\Models\User\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WidgetChartDataTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_fills_missing_daily_periods_with_zero_values(): void
    {
        $authenticatedUser = User::factory()->create([
            'created_at' => '2026-05-01 08:00:00',
            'updated_at' => '2026-05-01 08:00:00',
        ]);

        User::factory()->create([
            'created_at' => '2026-04-01 08:00:00',
            'updated_at' => '2026-04-01 08:00:00',
        ]);

        User::factory()->create([
            'created_at' => '2026-04-03 08:00:00',
            'updated_at' => '2026-04-03 08:00:00',
        ]);

        $widget = Widget::query()->create([
            'title' => 'Users by Day',
            'type' => 'line',
            'calculation_type' => 'count',
            'time_based_on' => 'created_at',
            'time_interval' => 'day',
            'timespan' => 'custom',
            'model_class' => User::class,
            'created_by' => $authenticatedUser->id,
        ]);

        $response = $this
            ->withoutMiddleware([AppMiddleware::class, LanguageMiddleware::class])
            ->actingAs($authenticatedUser)
            ->postJson(route('get-chart', $widget), [
                'config' => [
                    'dateRange' => [
                        'from' => '2026-04-01 00:00:00',
                        'to' => '2026-04-04 23:59:59',
                    ],
                ],
            ]);

        $response->assertOk();
        $response->assertJsonCount(4);
        $response->assertJson([
            ['period' => '01 Apr 2026', 'total' => 1],
            ['period' => '02 Apr 2026', 'total' => 0],
            ['period' => '03 Apr 2026', 'total' => 1],
            ['period' => '04 Apr 2026', 'total' => 0],
        ]);
    }

    public function test_it_does_not_fill_missing_periods_for_non_line_and_non_bar_charts(): void
    {
        $authenticatedUser = User::factory()->create([
            'created_at' => '2026-05-01 08:00:00',
            'updated_at' => '2026-05-01 08:00:00',
        ]);

        User::factory()->create([
            'created_at' => '2026-04-01 08:00:00',
            'updated_at' => '2026-04-01 08:00:00',
        ]);

        User::factory()->create([
            'created_at' => '2026-04-03 08:00:00',
            'updated_at' => '2026-04-03 08:00:00',
        ]);

        $widget = Widget::query()->create([
            'title' => 'Users by Day',
            'type' => 'pie',
            'calculation_type' => 'count',
            'time_based_on' => 'created_at',
            'time_interval' => 'day',
            'timespan' => 'custom',
            'model_class' => User::class,
            'created_by' => $authenticatedUser->id,
        ]);

        $response = $this
            ->withoutMiddleware([AppMiddleware::class, LanguageMiddleware::class])
            ->actingAs($authenticatedUser)
            ->postJson(route('get-chart', $widget), [
                'config' => [
                    'dateRange' => [
                        'from' => '2026-04-01 00:00:00',
                        'to' => '2026-04-04 23:59:59',
                    ],
                ],
            ]);

        $response->assertOk();
        $response->assertJsonCount(2);
        $response->assertJson([
            ['period' => '01 Apr 2026', 'total' => 1],
            ['period' => '03 Apr 2026', 'total' => 1],
        ]);
    }
}
