<?php

namespace Tests\Feature;

use App\FormStatus;
use App\Models\User\User;
use Database\Seeders\AdminPermissionSeeder;
use Database\Seeders\RoleSeeder;
use Database\Seeders\UserSeeder;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class UserSeederPermissionTest extends TestCase {
    public function test_user_seeder_creates_admin_accounts_with_granular_permissions(): void {
        $this->seed(RoleSeeder::class);
        $this->seed(AdminPermissionSeeder::class);
        $this->seed(UserSeeder::class);

        $superAdmin   = User::query()->where('email', 'admin@inkindo.test')->first();
        $financeAdmin = User::query()->where('email', 'finance.admin@inkindo.test')->first();
        $courseAdmin  = User::query()->where('email', 'course.admin@inkindo.test')->first();
        $userAdmin    = User::query()->where('email', 'user.admin@inkindo.test')->first();

        $this->assertNotNull($superAdmin);
        $this->assertNotNull($financeAdmin);
        $this->assertNotNull($courseAdmin);
        $this->assertNotNull($userAdmin);

        $this->assertSame(FormStatus::ACTIVE, $superAdmin->status);
        $this->assertSame(FormStatus::ACTIVE, $financeAdmin->status);
        $this->assertSame(FormStatus::ACTIVE, $courseAdmin->status);
        $this->assertSame(FormStatus::ACTIVE, $userAdmin->status);

        $this->assertSame(['super_admin'], $this->resolveAdminPermissionNames((string) $superAdmin->id));
        $this->assertSame(['finance_admin'], $this->resolveAdminPermissionNames((string) $financeAdmin->id));
        $this->assertSame(['course_admin'], $this->resolveAdminPermissionNames((string) $courseAdmin->id));
        $this->assertSame(['user_admin'], $this->resolveAdminPermissionNames((string) $userAdmin->id));
    }

    protected function setUp(): void {
        parent::setUp();

        Artisan::call('migrate:fresh', [
            '--database' => 'sqlite',
            '--path'     => [
                'database/migrations/0001_01_01_000000_create_users_table.php',
                'database/migrations/2025_01_31_135456_create_roles_table.php',
                'database/migrations/2025_01_31_150339_create_permissions_table.php',
                'database/migrations/2025_01_31_152926_create_user_role_table.php',
                'database/migrations/2025_01_31_153311_create_role_permissions_table.php',
                'database/migrations/2026_05_24_141817_create_admin_user_permissions_table.php',
            ],
            '--force' => true,
        ]);
    }

    /**
     * @return array<int, string>
     */
    private function resolveAdminPermissionNames(string $userId): array {
        return DB::table('admin_user_permissions')
            ->join('permissions', 'permissions.id', '=', 'admin_user_permissions.permission_id')
            ->where('admin_user_permissions.user_id', $userId)
            ->whereNull('admin_user_permissions.deleted_at')
            ->whereNull('permissions.deleted_at')
            ->orderBy('permissions.name')
            ->pluck('permissions.name')
            ->map(fn ($permissionName) => (string) $permissionName)
            ->values()
            ->all();
    }
}
