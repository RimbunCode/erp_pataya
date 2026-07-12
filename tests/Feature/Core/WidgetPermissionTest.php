<?php

namespace Tests\Feature\Core;

use App\Models\Core\Widget;
use App\Models\User\User;
use Database\Factories\Core\WidgetFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class WidgetPermissionTest extends TestCase {
    use RefreshDatabase;

    private User $user;

    /** @var array<string, mixed> */
    private array $sessionData;

    protected function setUp(): void {
        parent::setUp();

        foreach (Schema::getTables() as $tableInfo) {
            $table = $tableInfo['name'];
            if (! Schema::hasColumn($table, 'is_example')) {
                Schema::table($table, fn ($t) => $t->boolean('is_example')->default(false));
            }
        }

        $this->user = User::factory()->create();

        $this->sessionData = [
            'permissions' => [
                Widget::class => [
                    0 => [
                        [
                            'model'        => Widget::class,
                            'level'        => 0,
                            'only_creator' => false,
                            'permissions'  => [
                                'select' => true,
                                'read'   => true,
                                'write'  => true,
                                'create' => true,
                                'delete' => true,
                            ],
                        ],
                    ],
                ],
            ],
            'permissions_version' => '0|0|0|0',
            'currentBranch'       => null,
        ];
    }

    private function authenticatedRequest(): static {
        return $this
            ->withSession($this->sessionData)
            ->withCookie('lang', 'en')
            ->actingAs($this->user);
    }

    public function test_get_chart_data_is_not_blocked_by_permission_gate(): void {
        $widget = WidgetFactory::new()->create([
            'model_class'   => Widget::class,
            'time_based_on' => 'created_at',
        ]);

        // DATE_FORMAT() adalah fungsi MySQL, tidak tersedia di SQLite (dipakai
        // test suite ini). Query di getChartData() akan gagal di SQLite terlepas
        // dari permission gate, jadi assertion di sini fokus membuktikan request
        // tidak diblokir oleh gate (403), bukan menguji hasil query chart itu sendiri.
        $response = $this->authenticatedRequest()
            ->post(route('get-chart', $widget), [
                'config' => [
                    'dateRange' => ['from' => null, 'to' => null],
                ],
            ]);

        $this->assertNotSame(403, $response->getStatusCode());
    }

    public function test_get_chart_data_still_blocked_when_permission_missing(): void {
        $widget = WidgetFactory::new()->create([
            'model_class'   => Widget::class,
            'time_based_on' => 'created_at',
        ]);

        $sessionWithoutSelect                                                              = $this->sessionData;
        $sessionWithoutSelect['permissions'][Widget::class][0][0]['permissions']['select'] = false;

        $response = $this
            ->withSession($sessionWithoutSelect)
            ->withCookie('lang', 'en')
            ->actingAs($this->user)
            ->post(route('get-chart', $widget), [
                'config' => [
                    'dateRange' => ['from' => null, 'to' => null],
                ],
            ]);

        $response->assertForbidden();
    }
}
