<?php

namespace Tests\Feature\Admin;

use App\Models\User\Role;
use App\Models\User\User;
use App\Services\Admin\AdminPermissionService;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class AdminModulePermissionTest extends TestCase {
    public function test_finance_admin_can_access_finance_module_but_cannot_access_other_admin_modules(): void {
        $admin = User::factory()->create();
        $this->assignRole($admin, 'admin');
        $this->grantAdminPermission($admin, 'finance_admin');

        $this->actingAs($admin)->get(route('admin.finance'))->assertOk();

        $this->actingAs($admin)->get(route('admin.approval'))
            ->assertRedirect(route('admin.dashboard'))
            ->assertSessionHas('error', 'Anda tidak memiliki akses ke modul ini.');

        $this->actingAs($admin)->get(route('admin.user'))
            ->assertRedirect(route('admin.dashboard'))
            ->assertSessionHas('error', 'Anda tidak memiliki akses ke modul ini.');
    }

    public function test_course_admin_can_only_access_approvals_module(): void {
        $admin = User::factory()->create();
        $this->assignRole($admin, 'admin');
        $this->grantAdminPermission($admin, 'course_admin');

        $this->actingAs($admin)->get(route('admin.approval'))->assertOk();
        $this->actingAs($admin)->get(route('admin.course-categories.index'))->assertOk();

        $this->actingAs($admin)->get(route('admin.finance'))
            ->assertRedirect(route('admin.dashboard'))
            ->assertSessionHas('error', 'Anda tidak memiliki akses ke modul ini.');

        $this->actingAs($admin)->get(route('admin.user'))
            ->assertRedirect(route('admin.dashboard'))
            ->assertSessionHas('error', 'Anda tidak memiliki akses ke modul ini.');
    }

    public function test_user_admin_can_only_access_user_directory_module(): void {
        $admin = User::factory()->create();
        $this->assignRole($admin, 'admin');
        $this->grantAdminPermission($admin, 'user_admin');

        $this->actingAs($admin)->get(route('admin.user'))->assertOk();

        $this->actingAs($admin)->get(route('admin.approval'))
            ->assertRedirect(route('admin.dashboard'))
            ->assertSessionHas('error', 'Anda tidak memiliki akses ke modul ini.');

        $this->actingAs($admin)->get(route('admin.finance'))
            ->assertRedirect(route('admin.dashboard'))
            ->assertSessionHas('error', 'Anda tidak memiliki akses ke modul ini.');

        $this->actingAs($admin)->get(route('admin.landing-page-settings.index'))
            ->assertRedirect(route('admin.dashboard'))
            ->assertSessionHas('error', 'Anda tidak memiliki akses ke modul ini.');

        $this->actingAs($admin)->get(route('admin.course-categories.index'))
            ->assertRedirect(route('admin.dashboard'))
            ->assertSessionHas('error', 'Anda tidak memiliki akses ke modul ini.');
    }

    public function test_content_admin_can_only_access_landing_page_settings_module(): void {
        $admin = User::factory()->create();
        $this->assignRole($admin, 'admin');
        $this->grantAdminPermission($admin, 'content_admin');

        $this->actingAs($admin)->get(route('admin.landing-page-settings.index'))->assertOk();

        $this->actingAs($admin)->get(route('admin.approval'))
            ->assertRedirect(route('admin.dashboard'))
            ->assertSessionHas('error', 'Anda tidak memiliki akses ke modul ini.');

        $this->actingAs($admin)->get(route('admin.finance'))
            ->assertRedirect(route('admin.dashboard'))
            ->assertSessionHas('error', 'Anda tidak memiliki akses ke modul ini.');

        $this->actingAs($admin)->get(route('admin.user'))
            ->assertRedirect(route('admin.dashboard'))
            ->assertSessionHas('error', 'Anda tidak memiliki akses ke modul ini.');

        $this->actingAs($admin)->get(route('admin.course-categories.index'))
            ->assertRedirect(route('admin.dashboard'))
            ->assertSessionHas('error', 'Anda tidak memiliki akses ke modul ini.');
    }

    public function test_admin_without_module_assignment_can_access_dashboard_and_profile_but_not_modules(): void {
        $admin = User::factory()->create();
        $this->assignRole($admin, 'admin');

        $this->actingAs($admin)->get(route('admin.dashboard'))->assertOk();
        $this->actingAs($admin)->get(route('admin.profile'))->assertOk();

        $this->actingAs($admin)->get(route('admin.approval'))
            ->assertRedirect(route('admin.dashboard'))
            ->assertSessionHas('error', 'Anda tidak memiliki akses ke modul ini.');

        $this->actingAs($admin)->get(route('admin.finance'))
            ->assertRedirect(route('admin.dashboard'))
            ->assertSessionHas('error', 'Anda tidak memiliki akses ke modul ini.');

        $this->actingAs($admin)->get(route('admin.user'))
            ->assertRedirect(route('admin.dashboard'))
            ->assertSessionHas('error', 'Anda tidak memiliki akses ke modul ini.');

        $this->actingAs($admin)->get(route('admin.landing-page-settings.index'))
            ->assertRedirect(route('admin.dashboard'))
            ->assertSessionHas('error', 'Anda tidak memiliki akses ke modul ini.');

        $this->actingAs($admin)->get(route('admin.course-categories.index'))
            ->assertRedirect(route('admin.dashboard'))
            ->assertSessionHas('error', 'Anda tidak memiliki akses ke modul ini.');
    }

    public function test_super_admin_can_access_all_modules_and_assign_permissions(): void {
        $superAdmin  = User::factory()->create();
        $targetAdmin = User::factory()->create();

        $this->assignRole($superAdmin, 'admin');
        $this->assignRole($targetAdmin, 'admin');
        $this->grantAdminPermission($superAdmin, 'super_admin');

        $this->actingAs($superAdmin)->get(route('admin.approval'))->assertOk();
        $this->actingAs($superAdmin)->get(route('admin.finance'))->assertOk();
        $this->actingAs($superAdmin)->get(route('admin.user'))->assertOk();
        $this->actingAs($superAdmin)->get(route('admin.landing-page-settings.index'))->assertOk();
        $this->actingAs($superAdmin)->get(route('admin.course-categories.index'))->assertOk();

        $response = $this->actingAs($superAdmin)->patch(
            route('admin.user.admins.permissions', ['user' => $targetAdmin->id]),
            ['permissions' => ['finance_admin', 'user_admin']],
        );

        $response->assertRedirect();
        $response->assertSessionHasNoErrors();

        $this->assertSame(
            ['finance_admin', 'user_admin'],
            $this->resolveAssignedPermissions($targetAdmin),
        );
    }

    public function test_super_admin_permission_is_exclusive_when_assigned(): void {
        $superAdmin  = User::factory()->create();
        $targetAdmin = User::factory()->create();

        $this->assignRole($superAdmin, 'admin');
        $this->assignRole($targetAdmin, 'admin');
        $this->grantAdminPermission($superAdmin, 'super_admin');

        $response = $this->actingAs($superAdmin)->patch(
            route('admin.user.admins.permissions', ['user' => $targetAdmin->id]),
            ['permissions' => ['super_admin', 'finance_admin', 'course_admin']],
        );

        $response->assertRedirect();
        $response->assertSessionHasNoErrors();

        $this->assertSame(['super_admin'], $this->resolveAssignedPermissions($targetAdmin));
    }

    public function test_non_super_admin_cannot_edit_admin_permission_assignments(): void {
        $actor       = User::factory()->create();
        $targetAdmin = User::factory()->create();

        $this->assignRole($actor, 'admin');
        $this->assignRole($targetAdmin, 'admin');
        $this->grantAdminPermission($actor, 'user_admin');

        $this->actingAs($actor)
            ->patch(
                route('admin.user.admins.permissions', ['user' => $targetAdmin->id]),
                ['permissions' => ['finance_admin']],
            )
            ->assertRedirect(route('admin.dashboard'))
            ->assertSessionHas('error', 'Anda tidak memiliki akses ke modul ini.');

        $this->assertSame([], $this->resolveAssignedPermissions($targetAdmin));
    }

    public function test_system_blocks_removing_last_super_admin_permission(): void {
        $superAdmin = User::factory()->create();
        $this->assignRole($superAdmin, 'admin');
        $this->grantAdminPermission($superAdmin, 'super_admin');

        $response = $this->actingAs($superAdmin)
            ->from(route('admin.user'))
            ->patch(
                route('admin.user.admins.permissions', ['user' => $superAdmin->id]),
                ['permissions' => []],
            );

        $response->assertRedirect(route('admin.user'));
        $response->assertSessionHasErrors('permissions');

        $this->assertSame(['super_admin'], $this->resolveAssignedPermissions($superAdmin));
    }

    public function test_resolve_user_permission_names_is_cached_for_the_same_user_instance(): void {
        $admin = User::factory()->create();
        $this->assignRole($admin, 'admin');
        $this->grantAdminPermission($admin, 'finance_admin');
        $this->grantAdminPermission($admin, 'user_admin');

        /** @var AdminPermissionService $service */
        $service = app(AdminPermissionService::class);

        DB::flushQueryLog();
        DB::enableQueryLog();

        $firstResolvedPermissions = $service->resolveUserPermissionNames($admin);
        $queriesAfterFirstCall    = DB::getQueryLog();

        $secondResolvedPermissions = $service->resolveUserPermissionNames($admin);
        $queriesAfterSecondCall    = DB::getQueryLog();

        DB::disableQueryLog();

        $this->assertEqualsCanonicalizing(['finance_admin', 'user_admin'], $firstResolvedPermissions);
        $this->assertSame($firstResolvedPermissions, $secondResolvedPermissions);

        $firstPermissionQueries  = $this->countAdminPermissionQueries($queriesAfterFirstCall);
        $secondPermissionQueries = $this->countAdminPermissionQueries($queriesAfterSecondCall);

        $this->assertGreaterThan(0, $firstPermissionQueries);
        $this->assertSame($firstPermissionQueries, $secondPermissionQueries);
    }

    protected function setUp(): void {
        parent::setUp();

        Artisan::call('migrate:fresh', [
            '--database' => 'sqlite',
            '--path'     => $this->requiredMigrationPaths(),
            '--force'    => true,
        ]);

        foreach (['finance_admin', 'course_admin', 'user_admin', 'content_admin', 'super_admin'] as $permissionName) {
            $this->ensureAdminPermissionExists($permissionName);
        }
    }

    private function assignRole(User $user, string $roleName): void {
        $role = Role::query()->firstOrCreate(
            ['name' => $roleName],
            [
                'description' => "{$roleName} role",
                'is_disabled' => false,
            ],
        );

        $user->roles()->syncWithoutDetaching([$role->id]);
    }

    private function grantAdminPermission(User $user, string $permissionName): void {
        $permissionId = $this->ensureAdminPermissionExists($permissionName);

        $exists = DB::table('admin_user_permissions')
            ->where('user_id', $user->id)
            ->where('permission_id', $permissionId)
            ->whereNull('deleted_at')
            ->exists();

        if ($exists) {
            return;
        }

        DB::table('admin_user_permissions')->insert([
            'id'            => (string) Str::ulid(),
            'user_id'       => $user->id,
            'permission_id' => $permissionId,
            'created_at'    => now(),
            'updated_at'    => now(),
            'deleted_at'    => null,
        ]);
    }

    private function ensureAdminPermissionExists(string $permissionName): string {
        $permissionId = DB::table('permissions')
            ->where('name', $permissionName)
            ->whereNull('deleted_at')
            ->value('id');

        if (is_string($permissionId) && $permissionId !== '') {
            return $permissionId;
        }

        $permissionId = (string) Str::ulid();
        DB::table('permissions')->insert([
            'id'          => $permissionId,
            'module'      => 'lms',
            'name'        => $permissionName,
            'model'       => User::class,
            'route'       => 'admin.*',
            'permissions' => json_encode(['view']),
            'created_at'  => now(),
            'updated_at'  => now(),
        ]);

        return $permissionId;
    }

    /**
     * @return array<int, string>
     */
    private function resolveAssignedPermissions(User $user): array {
        return DB::table('permissions')
            ->join('admin_user_permissions', 'admin_user_permissions.permission_id', '=', 'permissions.id')
            ->where('admin_user_permissions.user_id', $user->id)
            ->whereNull('admin_user_permissions.deleted_at')
            ->whereNull('permissions.deleted_at')
            ->orderBy('permissions.name')
            ->pluck('permissions.name')
            ->map(fn ($name) => (string) $name)
            ->values()
            ->all();
    }

    /**
     * @return array<int, string>
     */
    private function requiredMigrationPaths(): array {
        return [
            'database/migrations/0001_01_01_000000_create_users_table.php',
            'database/migrations/0001_01_01_000000_create_preferences_table.php',
            'database/migrations/2025_01_30_134342_create_files_table.php',
            'database/migrations/2025_01_31_135456_create_roles_table.php',
            'database/migrations/2025_01_31_150339_create_permissions_table.php',
            'database/migrations/2025_01_31_152926_create_user_role_table.php',
            'database/migrations/2025_01_31_153311_create_role_permissions_table.php',
            'database/migrations/2026_04_26_075938_create_courses_table.php',
            'database/migrations/2026_04_26_075939_create_categories_table.php',
            'database/migrations/2026_04_28_074544_create_course_category_table.php',
            'database/migrations/2026_04_28_074634_create_payments_table.php',
            'database/migrations/2026_04_28_074652_create_enrollments_table.php',
            'database/migrations/2026_05_01_060520_create_instructor_profiles_table.php',
            'database/migrations/2026_05_23_004628_create_role_requests_table.php',
            'database/migrations/2026_05_23_213027_create_course_publish_requests_table.php',
            'database/migrations/2026_05_24_141817_create_admin_user_permissions_table.php',
            'database/migrations/2026_05_24_141817_create_instructor_earnings_table.php',
            'database/migrations/2026_05_24_141817_create_instructor_payout_requests_table.php',
            'database/migrations/2026_05_24_141818_create_instructor_payout_request_items_table.php',
        ];
    }

    /**
     * @param  array<int, array{query: string, bindings: array<int, mixed>, time: float}>  $queries
     */
    private function countAdminPermissionQueries(array $queries): int {
        return collect($queries)
            ->filter(function (array $query): bool {
                $sql = strtolower((string) ($query['query'] ?? ''));

                return str_contains($sql, 'admin_user_permissions')
                    && str_contains($sql, 'from')
                    && str_contains($sql, 'permissions');
            })
            ->count();
    }
}
