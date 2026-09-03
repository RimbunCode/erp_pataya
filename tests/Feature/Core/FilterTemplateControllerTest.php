<?php

namespace Tests\Feature\Core;

use App\Http\Middleware\AppMiddleware;
use App\Http\Middleware\EnsureUserIsOnboarded;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\LanguageMiddleware;
use App\Models\Asset\AssetCategory;
use App\Models\Core\ApprovalScheme;
use App\Models\Core\SavedFilter;
use App\Models\User\Permission;
use App\Models\User\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class FilterTemplateControllerTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        $this->withoutMiddleware([
            AppMiddleware::class,
            EnsureUserIsOnboarded::class,
            HandleInertiaRequests::class,
            LanguageMiddleware::class,
        ]);

        // Global scope HasExampleData butuh kolom is_example (ditambah via initPermissions di prod).
        foreach (['users', 'approval_schemes', 'saved_filters', 'preferences', 'asset_categories'] as $tbl) {
            if (Schema::hasTable($tbl) && ! Schema::hasColumn($tbl, 'is_example')) {
                Schema::table($tbl, fn ($t) => $t->boolean('is_example')->default(false));
            }
        }
    }

    /**
     * @param  array<string,bool>  $granted
     * @return array<string,mixed>
     */
    private function permissions(array $granted): array {
        return [
            'permissions' => [
                SavedFilter::class => [
                    0 => [
                        [
                            'model'        => SavedFilter::class,
                            'level'        => 0,
                            'only_creator' => false,
                            'permissions'  => $granted,
                        ],
                    ],
                ],
            ],
        ];
    }

    private function fullPermissions(): array {
        return $this->permissions([
            'select' => true, 'read' => true, 'write' => true,
            'create' => true, 'delete' => true,
        ]);
    }

    private function makeUser(): User {
        return User::factory()->create();
    }

    /**
     * @return array<string,mixed>
     */
    private function sampleTree(string $value = 'foo'): array {
        return ['root' => ['k' => 'and', 'c' => [
            'i1' => ['k' => 'name', 'o' => 'matches', 'v' => $value],
        ]]];
    }

    private function registerPermission(string $model, string $name = 'Approval Schemes'): Permission {
        return Permission::create([
            'module'             => 'Core',
            'name'               => $name,
            'route'              => 'x',
            'model'              => $model,
            'permissions'        => ['select', 'read', 'write', 'create', 'delete'],
            'is_submitable'      => false,
            'allow_only_creator' => false,
            'ignore_permission'  => false,
        ]);
    }

    // ---- Permission gate (P5) ---------------------------------------------

    public function test_index_forbidden_without_select_permission(): void {
        $user = $this->makeUser();

        $this->actingAs($user)
            ->withSession($this->permissions([]))
            ->getJson(route('filterTemplates.index'))
            ->assertStatus(403);
    }

    public function test_store_forbidden_without_create_permission(): void {
        $user = $this->makeUser();

        $this->actingAs($user)
            ->withSession($this->permissions(['select' => true]))
            ->postJson(route('filterTemplates.store'), [
                'model'  => ApprovalScheme::class,
                'filter' => $this->sampleTree(),
                'name'   => 'Test',
            ])
            ->assertStatus(403);
    }

    public function test_store_succeeds_with_create_permission(): void {
        $user = $this->makeUser();
        $this->registerPermission(ApprovalScheme::class);

        $res = $this->actingAs($user)
            ->withSession($this->fullPermissions())
            ->postJson(route('filterTemplates.store'), [
                'model'  => ApprovalScheme::class,
                'filter' => $this->sampleTree(),
                'name'   => 'Shared A',
            ]);

        $res->assertRedirect();
        $this->assertDatabaseHas('saved_filters', [
            'model'     => ApprovalScheme::class,
            'name'      => 'Shared A',
            'is_saved'  => true,
            'is_shared' => true,
            'user_id'   => $user->id,
        ]);
    }

    public function test_destroy_forbidden_without_delete_permission(): void {
        $user   = $this->makeUser();
        $shared = SavedFilter::create([
            'user_id' => $user->id, 'model' => ApprovalScheme::class,
            'filter'  => $this->sampleTree(), 'name' => 'A', 'is_saved' => true, 'is_shared' => true,
        ]);

        $this->actingAs($user)
            ->withSession($this->permissions(['select' => true]))
            ->deleteJson(route('filterTemplates.destroy', $shared))
            ->assertStatus(403);
    }

    public function test_destroy_succeeds_with_delete_permission(): void {
        $user   = $this->makeUser();
        $shared = SavedFilter::create([
            'user_id' => $user->id, 'model' => ApprovalScheme::class,
            'filter'  => $this->sampleTree(), 'name' => 'A', 'is_saved' => true, 'is_shared' => true,
        ]);

        $this->actingAs($user)
            ->withSession($this->fullPermissions())
            ->deleteJson(route('filterTemplates.destroy', $shared))
            ->assertRedirect();

        $this->assertDatabaseMissing('saved_filters', ['id' => $shared->id]);
    }

    /**
     * Regression P5: SavedFilterController (filter privat) TIDAK tersentuh
     * dispatcher permission baru — tetap terbuka untuk semua user seperti sebelumnya.
     */
    public function test_private_filter_endpoints_remain_ungated(): void {
        $user = $this->makeUser();

        $this->actingAs($user)
            ->withSession($this->permissions([])) // TANPA permission SavedFilter apa pun
            ->postJson('/saved-filters', [
                'model'  => ApprovalScheme::class,
                'filter' => $this->sampleTree(),
            ])
            ->assertOk();
    }

    // ---- setDefault (P1, P2) -----------------------------------------------

    public function test_set_default_rejects_non_shared_filter(): void {
        $user   = $this->makeUser();
        $filter = SavedFilter::create([
            'user_id' => $user->id, 'model' => ApprovalScheme::class,
            'filter'  => $this->sampleTree(), 'name' => 'Private', 'is_saved' => true, 'is_shared' => false,
        ]);

        $this->actingAs($user)
            ->withSession($this->fullPermissions())
            ->postJson(route('filterTemplates.setDefault', $filter))
            ->assertStatus(422);
    }

    public function test_set_default_forbidden_without_write_permission(): void {
        $user   = $this->makeUser();
        $shared = SavedFilter::create([
            'user_id' => $user->id, 'model' => ApprovalScheme::class,
            'filter'  => $this->sampleTree(), 'name' => 'Shared', 'is_saved' => true, 'is_shared' => true,
        ]);

        $this->actingAs($user)
            ->withSession($this->permissions(['select' => true]))
            ->postJson(route('filterTemplates.setDefault', $shared))
            ->assertStatus(403);
    }

    public function test_set_default_maintains_single_default_per_model(): void {
        $user = $this->makeUser();
        $a    = SavedFilter::create([
            'user_id' => $user->id, 'model' => ApprovalScheme::class,
            'filter'  => $this->sampleTree('A'), 'name' => 'A', 'is_saved' => true, 'is_shared' => true, 'is_default' => true,
        ]);
        $b = SavedFilter::create([
            'user_id' => $user->id, 'model' => ApprovalScheme::class,
            'filter'  => $this->sampleTree('B'), 'name' => 'B', 'is_saved' => true, 'is_shared' => true,
        ]);

        $this->actingAs($user)
            ->withSession($this->fullPermissions())
            ->postJson(route('filterTemplates.setDefault', $b))
            ->assertOk();

        $this->assertFalse(SavedFilter::find($a->id)->is_default);
        $this->assertTrue(SavedFilter::find($b->id)->is_default);
        $this->assertSame(1, SavedFilter::where('model', ApprovalScheme::class)->where('is_default', true)->count());
    }

    // ---- preview (P4, P6) --------------------------------------------------

    public function test_preview_forbidden_without_read_permission(): void {
        $user = $this->makeUser();
        $this->registerPermission(ApprovalScheme::class);

        $this->actingAs($user)
            ->withSession($this->permissions([]))
            ->postJson(route('filterTemplates.preview'), [
                'model'  => ApprovalScheme::class,
                'filter' => $this->sampleTree(),
            ])
            ->assertStatus(403);
    }

    public function test_preview_rejects_model_not_registered_in_permission_registry(): void {
        $user = $this->makeUser();
        // Sengaja TIDAK registrasi Permission untuk ApprovalScheme.

        $this->actingAs($user)
            ->withSession($this->permissions(['read' => true]))
            ->postJson(route('filterTemplates.preview'), [
                'model'  => ApprovalScheme::class,
                'filter' => $this->sampleTree(),
            ])
            ->assertStatus(422);
    }

    public function test_preview_does_not_persist_any_row(): void {
        $user = $this->makeUser();
        $this->registerPermission(ApprovalScheme::class);
        $before = SavedFilter::count();

        $this->actingAs($user)
            ->withSession($this->permissions(['read' => true]))
            ->postJson(route('filterTemplates.preview'), [
                'model'  => ApprovalScheme::class,
                'filter' => $this->sampleTree(),
            ])
            ->assertOk()
            ->assertJsonStructure(['columns', 'data']);

        $this->assertSame($before, SavedFilter::count());
    }

    /**
     * P6: pengelola punya permission SELECT/READ/CREATE dst pada SavedFilter,
     * TAPI TIDAK PUNYA permission apa pun atas model target (AssetCategory) —
     * preview tetap sukses karena dispatcher hanya mengecek permission atas
     * SavedFilter::class, bukan model target.
     */
    public function test_preview_succeeds_regardless_of_target_model_permission(): void {
        $user = $this->makeUser();
        $this->registerPermission(AssetCategory::class, 'Asset Categories');

        $this->actingAs($user)
            // Sesi TIDAK menyertakan permission apa pun untuk AssetCategory::class.
            ->withSession($this->permissions(['read' => true]))
            ->postJson(route('filterTemplates.preview'), [
                'model'  => AssetCategory::class,
                'filter' => ['root' => ['k' => 'and', 'c' => []]],
            ])
            ->assertOk();
    }
}
