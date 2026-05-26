<?php

namespace Tests\Feature;

use App\Models\Core\Preference;
use App\Models\User\Role;
use App\Models\User\User;
use App\Services\Guest\GuestPageContentService;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class LandingPageSettingTest extends TestCase {
    public function test_content_admin_can_access_and_update_landing_page_settings(): void {
        $admin = User::factory()->create();

        $this->assignRole($admin, 'admin');
        $this->grantAdminPermission($admin, 'content_admin');

        $this->actingAs($admin)
            ->get(route('admin.landing-page-settings.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/LandingPageSettings/index')
                ->has('content.home.hero.title.type'));

        $payload = [
            'home' => [
                'hero' => [
                    'title' => $this->doc('Custom Hero Title'),
                ],
            ],
        ];

        $this->actingAs($admin)
            ->patch(route('admin.landing-page-settings.update'), ['content' => $payload])
            ->assertRedirect()
            ->assertSessionHasNoErrors();

        $stored = Preference::query()->find(GuestPageContentService::PREFERENCE_KEY);

        $this->assertNotNull($stored);
        $this->assertSame('Custom Hero Title', data_get($stored->value, 'home.hero.title.content.0.content.0.text'));

        $this->actingAs($admin)
            ->get(route('guest.home'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Guest/Index')
                ->where('content.home.hero.title.content.0.content.0.text', 'Custom Hero Title'));
    }

    public function test_non_content_admin_cannot_access_landing_page_settings(): void {
        $admin = User::factory()->create();

        $this->assignRole($admin, 'admin');
        $this->grantAdminPermission($admin, 'finance_admin');

        $this->actingAs($admin)
            ->get(route('admin.landing-page-settings.index'))
            ->assertRedirect(route('admin.dashboard'))
            ->assertSessionHas('error', 'Anda tidak memiliki akses ke modul ini.');
    }

    protected function setUp(): void {
        parent::setUp();

        Artisan::call('migrate:fresh', [
            '--database' => 'sqlite',
            '--path'     => $this->requiredMigrationPaths(),
            '--force'    => true,
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function doc(string $text): array {
        return [
            'type'    => 'doc',
            'content' => [
                [
                    'type'    => 'paragraph',
                    'content' => [
                        [
                            'type' => 'text',
                            'text' => $text,
                        ],
                    ],
                ],
            ],
        ];
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
     * @return array<int, string>
     */
    private function requiredMigrationPaths(): array {
        return [
            'database/migrations/0001_01_01_000000_create_users_table.php',
            'database/migrations/0001_01_01_000000_create_preferences_table.php',
            'database/migrations/2025_01_31_135456_create_roles_table.php',
            'database/migrations/2025_01_31_150339_create_permissions_table.php',
            'database/migrations/2025_01_31_152926_create_user_role_table.php',
            'database/migrations/2026_05_24_141817_create_admin_user_permissions_table.php',
        ];
    }
}
