<?php

namespace Tests\Feature\Admin;

use App\FormStatus;
use App\Models\OrganizationInvitation;
use App\Models\User\Role;
use App\Models\User\User;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Tests\TestCase;

class OrganizationInvitationTest extends TestCase {
    public function test_admin_with_user_admin_permission_can_send_invitation(): void {
        Notification::fake();

        $admin = User::factory()->create();
        $this->assignRole($admin, 'admin');
        $this->grantAdminPermission($admin, 'user_admin');

        $response = $this->actingAs($admin)
            ->from(route('admin.user'))
            ->post(route('admin.user.organizations.invite'), [
                'organization_name' => 'PT Test Company',
                'email'             => 'org@example.com',
                'contact_person'    => 'John Doe',
            ]);

        $response->assertRedirect();
        $response->assertSessionHasNoErrors();

        $this->assertDatabaseHas('organization_invitations', [
            'organization_name' => 'PT Test Company',
            'email'             => 'org@example.com',
            'contact_person'    => 'John Doe',
            'status'            => FormStatus::INVITED->value,
        ]);
    }

    public function test_send_invitation_validates_required_fields(): void {
        $admin = User::factory()->create();
        $this->assignRole($admin, 'admin');
        $this->grantAdminPermission($admin, 'user_admin');

        $response = $this->actingAs($admin)
            ->from(route('admin.user'))
            ->post(route('admin.user.organizations.invite'), []);

        $response->assertSessionHasErrors(['organization_name', 'email', 'contact_person']);
    }

    public function test_send_invitation_validates_email_format(): void {
        $admin = User::factory()->create();
        $this->assignRole($admin, 'admin');
        $this->grantAdminPermission($admin, 'user_admin');

        $response = $this->actingAs($admin)
            ->from(route('admin.user'))
            ->post(route('admin.user.organizations.invite'), [
                'organization_name' => 'PT Test',
                'email'             => 'not-an-email',
                'contact_person'    => 'John',
            ]);

        $response->assertSessionHasErrors('email');
    }

    public function test_admin_can_approve_submitted_invitation(): void {
        Notification::fake();

        $admin = User::factory()->create();
        $this->assignRole($admin, 'admin');
        $this->grantAdminPermission($admin, 'user_admin');
        $this->ensureRoleExists('organization');

        $invitation = OrganizationInvitation::factory()->submitted()->create();

        $response = $this->actingAs($admin)
            ->from(route('admin.user'))
            ->patch(route('admin.user.organizations.review', ['invitation' => $invitation->id]), [
                'action' => 'approve',
            ]);

        $response->assertRedirect();
        $response->assertSessionHasNoErrors();

        $invitation->refresh();
        $this->assertSame(FormStatus::APPROVED, $invitation->status);
        $this->assertNotNull($invitation->reviewed_by);
        $this->assertNotNull($invitation->reviewed_at);
        $this->assertNotNull($invitation->user_id);

        $this->assertDatabaseHas('users', [
            'email' => $invitation->email,
            'name'  => $invitation->contact_person,
        ]);
    }

    public function test_admin_can_reject_submitted_invitation_with_reason(): void {
        Notification::fake();

        $admin = User::factory()->create();
        $this->assignRole($admin, 'admin');
        $this->grantAdminPermission($admin, 'user_admin');

        $invitation = OrganizationInvitation::factory()->submitted()->create();

        $response = $this->actingAs($admin)
            ->from(route('admin.user'))
            ->patch(route('admin.user.organizations.review', ['invitation' => $invitation->id]), [
                'action' => 'reject',
                'reason' => 'Incomplete documentation.',
            ]);

        $response->assertRedirect();
        $response->assertSessionHasNoErrors();

        $invitation->refresh();
        $this->assertSame(FormStatus::REJECTED, $invitation->status);
        $this->assertSame('Incomplete documentation.', $invitation->rejection_reason);
    }

    public function test_reject_requires_reason(): void {
        $admin = User::factory()->create();
        $this->assignRole($admin, 'admin');
        $this->grantAdminPermission($admin, 'user_admin');

        $invitation = OrganizationInvitation::factory()->submitted()->create();

        $response = $this->actingAs($admin)
            ->from(route('admin.user'))
            ->patch(route('admin.user.organizations.review', ['invitation' => $invitation->id]), [
                'action' => 'reject',
                'reason' => '',
            ]);

        $response->assertSessionHasErrors('reason');
    }

    public function test_cannot_approve_non_submitted_invitation(): void {
        $admin = User::factory()->create();
        $this->assignRole($admin, 'admin');
        $this->grantAdminPermission($admin, 'user_admin');

        $invitation = OrganizationInvitation::factory()->create(); // status: invited

        $response = $this->actingAs($admin)
            ->from(route('admin.user'))
            ->patch(route('admin.user.organizations.review', ['invitation' => $invitation->id]), [
                'action' => 'approve',
            ]);

        $response->assertSessionHasErrors('invitation');
    }

    public function test_admin_can_resend_invited_invitation(): void {
        Notification::fake();

        $admin = User::factory()->create();
        $this->assignRole($admin, 'admin');
        $this->grantAdminPermission($admin, 'user_admin');

        $invitation = OrganizationInvitation::factory()->expired()->create();

        $response = $this->actingAs($admin)
            ->from(route('admin.user'))
            ->post(route('admin.user.organizations.resend', ['invitation' => $invitation->id]));

        $response->assertRedirect();
        $response->assertSessionHasNoErrors();

        $invitation->refresh();
        $this->assertFalse($invitation->isExpired());
    }

    public function test_admin_can_destroy_invitation(): void {
        $admin = User::factory()->create();
        $this->assignRole($admin, 'admin');
        $this->grantAdminPermission($admin, 'user_admin');

        $invitation = OrganizationInvitation::factory()->create();

        $response = $this->actingAs($admin)
            ->from(route('admin.user'))
            ->delete(route('admin.user.organizations.destroy', ['invitation' => $invitation->id]));

        $response->assertRedirect();
        $this->assertSoftDeleted('organization_invitations', ['id' => $invitation->id]);
    }

    public function test_admin_without_user_admin_permission_cannot_send_invitation(): void {
        $admin = User::factory()->create();
        $this->assignRole($admin, 'admin');
        $this->grantAdminPermission($admin, 'finance_admin');

        $response = $this->actingAs($admin)
            ->post(route('admin.user.organizations.invite'), [
                'organization_name' => 'PT Test',
                'email'             => 'org@example.com',
                'contact_person'    => 'John',
            ]);

        $response->assertRedirect(route('admin.dashboard'));
    }

    protected function setUp(): void {
        parent::setUp();

        Artisan::call('migrate:fresh', [
            '--database' => 'sqlite',
            '--path'     => $this->requiredMigrationPaths(),
            '--force'    => true,
        ]);
    }

    private function assignRole(User $user, string $roleName): Role {
        $role = $this->ensureRoleExists($roleName);
        $user->roles()->syncWithoutDetaching([$role->id]);

        return $role;
    }

    private function ensureRoleExists(string $roleName): Role {
        return Role::query()->firstOrCreate(
            ['name' => $roleName],
            [
                'description' => "{$roleName} role",
                'is_disabled' => false,
            ],
        );
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
            'database/migrations/2025_01_31_135456_create_roles_table.php',
            'database/migrations/2025_01_31_150339_create_permissions_table.php',
            'database/migrations/2025_01_31_152926_create_user_role_table.php',
            'database/migrations/2025_01_31_153311_create_role_permissions_table.php',
            'database/migrations/2026_05_24_141817_create_admin_user_permissions_table.php',
            'database/migrations/2025_01_30_134342_create_files_table.php',
            'database/migrations/2026_06_21_172044_create_organization_invitations_table.php',
        ];
    }
}
