<?php

namespace Tests\Feature\Admin;

use App\Models\User\Role;
use App\Models\User\User;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use PHPUnit\Framework\AssertionFailedError;
use Tests\TestCase;

class CourseCategoryManagementTest extends TestCase {
    public function test_course_admin_can_access_category_page_and_create_category(): void {
        $admin = User::factory()->create();
        $this->assignRole($admin, 'admin');
        $this->grantAdminPermission($admin, 'course_admin');

        $response = $this->actingAs($admin)->get(route('admin.course-categories.index'));
        $response->assertOk();

        $page = $this->extractInertiaPage($response);
        $this->assertSame('Admin/CourseCategories/index', $page['component'] ?? null);

        $createResponse = $this->actingAs($admin)->post(route('admin.course-categories.store'), [
            'name' => 'Digital Construction',
        ]);

        $createResponse->assertRedirect();
        $createResponse->assertSessionHasNoErrors();
        $this->assertDatabaseHas('categories', [
            'name' => 'Digital Construction',
            'slug' => 'digital-construction',
        ]);
    }

    public function test_super_admin_can_access_category_page_and_create_category(): void {
        $admin = User::factory()->create();
        $this->assignRole($admin, 'admin');
        $this->grantAdminPermission($admin, 'super_admin');

        $this->actingAs($admin)->get(route('admin.course-categories.index'))->assertOk();

        $response = $this->actingAs($admin)->post(route('admin.course-categories.store'), [
            'name' => 'Construction Law',
        ]);

        $response->assertRedirect();
        $response->assertSessionHasNoErrors();
        $this->assertDatabaseHas('categories', [
            'name' => 'Construction Law',
            'slug' => 'construction-law',
        ]);
    }

    public function test_admin_without_course_admin_or_super_admin_cannot_access_category_module(): void {
        $admin = User::factory()->create();
        $this->assignRole($admin, 'admin');
        $this->grantAdminPermission($admin, 'user_admin');

        $this->actingAs($admin)
            ->get(route('admin.course-categories.index'))
            ->assertRedirect(route('admin.dashboard'))
            ->assertSessionHas('error', 'Anda tidak memiliki akses ke modul ini.');

        $this->actingAs($admin)
            ->post(route('admin.course-categories.store'), ['name' => 'Should Not Create'])
            ->assertRedirect(route('admin.dashboard'))
            ->assertSessionHas('error', 'Anda tidak memiliki akses ke modul ini.');

        $this->assertDatabaseMissing('categories', [
            'name' => 'Should Not Create',
        ]);
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
                'database/migrations/2026_04_26_075939_create_categories_table.php',
                'database/migrations/2026_05_24_141817_create_admin_user_permissions_table.php',
            ],
            '--force' => true,
        ]);
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
        $permissionId = DB::table('permissions')
            ->where('name', $permissionName)
            ->whereNull('deleted_at')
            ->value('id');

        if (! $permissionId) {
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
        }

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

    /**
     * @return array<string, mixed>
     */
    private function extractInertiaPage(TestResponse $response): array {
        if ($response->headers->has('X-Inertia')) {
            return (array) $response->json();
        }

        try {
            return (array) $response->viewData('page');
        } catch (AssertionFailedError) {
            $content = (string) $response->getContent();
            preg_match('/data-page=\"([^\"]+)\"/', $content, $matches);

            $encodedPage = $matches[1] ?? null;
            if (! $encodedPage) {
                return [];
            }

            return json_decode(html_entity_decode($encodedPage, ENT_QUOTES, 'UTF-8'), true) ?? [];
        }
    }
}
