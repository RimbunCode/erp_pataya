<?php

namespace Tests\Feature\Guest;

use App\FormStatus;
use App\Models\OrganizationInvitation;
use App\Models\User\Role;
use Illuminate\Support\Facades\Artisan;
use Tests\TestCase;

class OrganizationCompletionTest extends TestCase {
    public function test_valid_token_shows_completion_form(): void {
        $invitation = OrganizationInvitation::factory()->create();

        $response = $this->get(route('organization.complete', ['token' => $invitation->token]));

        $response->assertOk();
        $response->assertInertia(
            fn ($page) => $page
                ->component('Guest/OrganizationComplete')
                ->has('invitation'),
        );
    }

    public function test_expired_token_shows_expired_state(): void {
        $invitation = OrganizationInvitation::factory()->expired()->create();

        $response = $this->get(route('organization.complete', ['token' => $invitation->token]));

        $response->assertOk();
        $response->assertInertia(
            fn ($page) => $page
                ->component('Guest/OrganizationComplete')
                ->where('expired', true),
        );
    }

    public function test_already_submitted_token_shows_already_done_state(): void {
        $invitation = OrganizationInvitation::factory()->submitted()->create();

        $response = $this->get(route('organization.complete', ['token' => $invitation->token]));

        $response->assertOk();
        $response->assertInertia(
            fn ($page) => $page
                ->component('Guest/OrganizationComplete')
                ->where('alreadyDone', true),
        );
    }

    public function test_invalid_token_returns_404(): void {
        $response = $this->get(route('organization.complete', ['token' => 'invalid-token']));

        $response->assertNotFound();
    }

    public function test_guest_can_submit_completed_profile(): void {
        $invitation = OrganizationInvitation::factory()->create();

        $response = $this->post(route('organization.complete.store', ['token' => $invitation->token]), [
            'organization_name'     => 'PT Updated Company',
            'email'                 => 'updated@example.com',
            'contact_person'        => 'Jane Doe',
            'address'               => 'Jl. Sudirman No. 1',
            'phone'                 => '+6281234567890',
            'website'               => 'https://example.com',
            'industry'              => 'Technology',
            'employee_count'        => '11-50',
            'password'              => 'Password123!',
            'password_confirmation' => 'Password123!',
        ]);

        $response->assertRedirect(route('organization.success'));

        $invitation->refresh();
        $this->assertSame(FormStatus::SUBMITTED, $invitation->status);
        $this->assertSame('PT Updated Company', $invitation->organization_name);
        $this->assertSame('updated@example.com', $invitation->email);
        $this->assertNotNull($invitation->submitted_at);
        $this->assertNotNull($invitation->password);
    }

    public function test_submit_validates_password_confirmation(): void {
        $invitation = OrganizationInvitation::factory()->create();

        $response = $this->from(route('organization.complete', ['token' => $invitation->token]))
            ->post(route('organization.complete.store', ['token' => $invitation->token]), [
                'organization_name'     => 'PT Test',
                'email'                 => 'test@example.com',
                'contact_person'        => 'John',
                'password'              => 'Password123!',
                'password_confirmation' => 'DifferentPassword!',
            ]);

        $response->assertSessionHasErrors('password');
    }

    public function test_submit_validates_password_min_length(): void {
        $invitation = OrganizationInvitation::factory()->create();

        $response = $this->from(route('organization.complete', ['token' => $invitation->token]))
            ->post(route('organization.complete.store', ['token' => $invitation->token]), [
                'organization_name'     => 'PT Test',
                'email'                 => 'test@example.com',
                'contact_person'        => 'John',
                'password'              => 'short',
                'password_confirmation' => 'short',
            ]);

        $response->assertSessionHasErrors('password');
    }

    public function test_success_page_renders(): void {
        $response = $this->get(route('organization.success'));

        $response->assertOk();
        $response->assertInertia(
            fn ($page) => $page
                ->component('Guest/OrganizationCompleteSuccess'),
        );
    }

    public function test_cannot_submit_already_submitted_invitation(): void {
        $invitation = OrganizationInvitation::factory()->submitted()->create();

        $response = $this->post(route('organization.complete.store', ['token' => $invitation->token]), [
            'organization_name'     => 'PT Test',
            'email'                 => 'test@example.com',
            'contact_person'        => 'John',
            'password'              => 'Password123!',
            'password_confirmation' => 'Password123!',
        ]);

        $response->assertSessionHasErrors('token');
    }

    public function test_cannot_submit_expired_invitation(): void {
        $invitation = OrganizationInvitation::factory()->expired()->create();

        $response = $this->post(route('organization.complete.store', ['token' => $invitation->token]), [
            'organization_name'     => 'PT Test',
            'email'                 => 'test@example.com',
            'contact_person'        => 'John',
            'password'              => 'Password123!',
            'password_confirmation' => 'Password123!',
        ]);

        $response->assertSessionHasErrors('token');
    }

    protected function setUp(): void {
        parent::setUp();

        Artisan::call('migrate:fresh', [
            '--database' => 'sqlite',
            '--path'     => $this->requiredMigrationPaths(),
            '--force'    => true,
        ]);
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
