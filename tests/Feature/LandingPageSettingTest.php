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
            ->assertRedirect(route('guest.home', ['liveEdit' => 1]));

        $payload = [
            'theme' => [
                'guest' => [
                    'primary' => '#123456',
                ],
            ],
            'home' => [
                'hero' => [
                    'title' => $this->doc('Custom Hero Title'),
                ],
                'media' => [
                    'heroImageFileId' => '01JXYZMEDIAHERO',
                ],
                'ads' => [
                    'items' => [
                        [
                            'enabled'      => true,
                            'title'        => $this->doc('Ad Slot 1'),
                            'description'  => $this->doc('Deskripsi iklan 1'),
                            'imageFileId'  => '01JXYZADIMAGE01',
                            'ctaLabel'     => $this->doc('Klik'),
                            'url'          => 'https://example.com/ad-1',
                            'openInNewTab' => true,
                        ],
                        [
                            'enabled'      => false,
                            'title'        => $this->doc('Ad Slot 2'),
                            'description'  => $this->doc('Deskripsi iklan 2'),
                            'imageFileId'  => null,
                            'ctaLabel'     => $this->doc('Pelajari'),
                            'url'          => '',
                            'openInNewTab' => false,
                        ],
                    ],
                ],
                'trusted' => [
                    'companies' => [
                        $this->doc('WIKA'),
                        $this->doc('ADHI KARYA'),
                        $this->doc('PP (PERSERO)'),
                        $this->doc('HUTAMA KARYA'),
                        $this->doc('WASZKITA'),
                        $this->doc('JASA MARGA'),
                        $this->doc('BRANTAS ABIPRAYA'),
                    ],
                ],
            ],
        ];

        $this->actingAs($admin)
            ->patch(route('admin.landing-page-settings.update'), ['content' => $payload])
            ->assertRedirect()
            ->assertSessionHasNoErrors();

        $stored = Preference::query()->find(GuestPageContentService::PREFERENCE_KEY);

        $this->assertNotNull($stored);
        $this->assertSame('#123456', data_get($stored->value, 'theme.guest.primary'));
        $this->assertSame('Custom Hero Title', data_get($stored->value, 'home.hero.title.content.0.content.0.text'));
        $this->assertSame('01JXYZMEDIAHERO', data_get($stored->value, 'home.media.heroImageFileId'));
        $this->assertCount(2, data_get($stored->value, 'home.ads.items', []));
        $this->assertCount(7, data_get($stored->value, 'home.trusted.companies', []));

        $this->actingAs($admin)
            ->get(route('guest.home'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Guest/Index')
                ->where('content.home.hero.title.content.0.content.0.text', 'Custom Hero Title')
                ->where('content.theme.guest.primary', '#123456')
                ->has('content.home.ads.items', 2)
                ->has('content.home.trusted.companies', 7));
    }

    public function test_live_edit_mode_requires_content_admin_permission(): void {
        $this->get(route('guest.home', ['liveEdit' => 1]))->assertForbidden();

        $adminWithoutContentPermission = User::factory()->create();
        $this->assignRole($adminWithoutContentPermission, 'admin');
        $this->grantAdminPermission($adminWithoutContentPermission, 'finance_admin');

        $this->actingAs($adminWithoutContentPermission)
            ->get(route('guest.home', ['liveEdit' => 1]))
            ->assertForbidden();
    }

    public function test_content_admin_can_open_guest_home_live_edit_mode(): void {
        $admin = User::factory()->create();

        $this->assignRole($admin, 'admin');
        $this->grantAdminPermission($admin, 'content_admin');

        $this->actingAs($admin)
            ->get(route('guest.home', ['liveEdit' => 1]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Guest/Index')
                ->where('liveEditor.enabled', true)
                ->where('liveEditor.pageKey', 'home')
                ->where('liveEditor.saveRoute', route('admin.landing-page-settings.update', absolute: false))
                ->where('liveEditor.uploadRoute', route('admin.landing-page-settings.media.upload', absolute: false)));
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
            'database/migrations/2025_01_30_134342_create_files_table.php',
            'database/migrations/2025_01_31_135456_create_roles_table.php',
            'database/migrations/2025_01_31_150339_create_permissions_table.php',
            'database/migrations/2025_01_31_152926_create_user_role_table.php',
            'database/migrations/2026_04_26_075938_create_courses_table.php',
            'database/migrations/2026_05_24_141817_create_admin_user_permissions_table.php',
            'database/migrations/2026_06_28_164713_create_notifications_table.php',
            'database/migrations/2026_06_28_173509_add_gate_and_link_to_notifications_table.php',
            'database/migrations/2026_06_28_182100_fix_notifiable_id_type_in_notifications_table.php',
        ];
    }
}
