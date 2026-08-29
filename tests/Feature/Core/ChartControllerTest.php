<?php

namespace Tests\Feature\Core;

use App\Models\Core\Chart;
use App\Models\Model as AppModel;
use App\Models\User\Permission as PermissionModel;
use App\Models\User\User;
use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class ChartTargetRecord extends AppModel {
    use DataTable, HasUlids;

    protected $table   = 'chart_target_records';
    protected $guarded = ['id'];
}

class ChartControllerTest extends TestCase {
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void {
        parent::setUp();

        if (! Schema::hasTable('chart_target_records')) {
            Schema::create('chart_target_records', function ($t) {
                $t->ulid('id')->primary();
                $t->string('category')->nullable();
                $t->timestamps();
            });
        }

        $this->user = User::factory()->create();
    }

    private function actingWith(array $targetPermissions = []): static {
        $permissions = [
            Chart::class => [0 => [[
                'model'       => Chart::class, 'level' => 0, 'only_creator' => false,
                'permissions' => ['select' => true, 'create' => true, 'write' => true, 'delete' => true, 'read' => true],
            ]]],
        ];
        foreach ($targetPermissions as $class) {
            $permissions[$class] = [0 => [[
                'model'       => $class, 'level' => 0, 'only_creator' => false,
                'permissions' => ['select' => true, 'read' => true],
            ]]];
        }

        return $this
            ->withSession(['permissions' => $permissions, 'permissions_version' => '0|0|0|0', 'currentBranch' => null])
            ->withCookie('lang', 'en')
            ->withHeader('Accept', 'application/json')
            ->withHeader('X-Inertia', 'true')
            ->actingAs($this->user);
    }

    public function test_store_group_by_chart(): void {
        $permission = PermissionModel::create(['model' => ChartTargetRecord::class, 'module' => 'Core', 'name' => 'Chart Target Record']);

        $response = $this->actingWith([ChartTargetRecord::class])->post(route('charts.store'), [
            'chart_name'        => 'By Category', 'chart_source_type' => 'group_by', 'visual_type' => 'bar',
            'group_by_based_on' => 'category', 'group_by_type' => 'count',
            'model'             => ['id' => $permission->id, 'model' => ChartTargetRecord::class],
        ]);

        $response->assertRedirect();
        $this->assertDatabaseHas('charts', ['chart_name' => 'By Category', 'chart_source_type' => 'group_by']);
    }

    /** Requirement 8.4: getData wajib re-cek gate per request. */
    public function test_get_data_rejected_when_not_visible(): void {
        $chart = Chart::create(['chart_name' => 'Private', 'model_class' => ChartTargetRecord::class, 'chart_source_type' => 'group_by', 'group_by_based_on' => 'category']);

        $response = $this->actingWith([])->post(route('charts.getData', $chart));

        $response->assertStatus(403);
    }

    public function test_get_data_group_by_when_visible(): void {
        ChartTargetRecord::create(['category' => 'A']);
        ChartTargetRecord::create(['category' => 'A']);
        ChartTargetRecord::create(['category' => 'B']);
        $chart = Chart::create([
            'chart_name'        => 'By Category', 'model_class' => ChartTargetRecord::class,
            'chart_source_type' => 'group_by', 'group_by_based_on' => 'category', 'group_by_type' => 'count',
        ]);

        $response = $this->actingWith([ChartTargetRecord::class])->post(route('charts.getData', $chart));

        $response->assertOk();
        $this->assertSame(['A', 'B'], $response->json('labels'));
    }

    /** Gate DASAR (bukan Requirement 8) — mirror `WidgetPermissionTest` lama. */
    public function test_get_data_blocked_without_select_permission_on_chart_entity(): void {
        $chart = Chart::create(['chart_name' => 'X', 'model_class' => ChartTargetRecord::class, 'chart_source_type' => 'group_by', 'group_by_based_on' => 'category', 'is_shared_all' => true]);

        $response = $this
            ->withSession(['permissions' => [], 'permissions_version' => '0|0|0|0', 'currentBranch' => null])
            ->withCookie('lang', 'en')
            ->withHeader('Accept', 'application/json')
            ->actingAs($this->user)
            ->post(route('charts.getData', $chart));

        $response->assertForbidden();
    }

    /** Requirement 5.4 regresi: group_by TIDAK jatuh ke count-by-time (bug lama Widget). */
    public function test_get_data_group_by_ignores_time_fields_even_if_set(): void {
        ChartTargetRecord::create(['category' => 'A']);
        $chart = Chart::create([
            'chart_name'        => 'Regression', 'model_class' => ChartTargetRecord::class,
            'chart_source_type' => 'group_by', 'group_by_based_on' => 'category', 'group_by_type' => 'count',
            'timeseries'        => true, 'based_on' => 'created_at', 'time_interval' => 'monthly',
        ]);

        $response = $this->actingWith([ChartTargetRecord::class])->post(route('charts.getData', $chart));

        $response->assertOk();
        $response->assertJsonStructure(['labels', 'datasets']);
        $response->assertJsonMissing(['period']);
    }
}
