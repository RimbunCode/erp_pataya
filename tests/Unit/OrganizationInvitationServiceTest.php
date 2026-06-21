<?php

namespace Tests\Unit;

use App\FormStatus;
use App\Models\OrganizationInvitation;
use App\Models\User\Role;
use App\Models\User\User;
use App\Notifications\OrganizationInvitationNotification;
use App\Services\Admin\OrganizationInvitationService;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class OrganizationInvitationServiceTest extends TestCase {
    private OrganizationInvitationService $service;

    public function test_send_invitation_creates_record_and_dispatches_notification(): void {
        Notification::fake();

        $admin = User::factory()->create();
        $data  = [
            'organization_name' => 'PT Service Test',
            'email'             => 'service@test.com',
            'contact_person'    => 'Service Person',
        ];

        $invitation = $this->service->sendInvitation($data, $admin);

        $this->assertNotNull($invitation->id);
        $this->assertSame('PT Service Test', $invitation->organization_name);
        $this->assertSame('service@test.com', $invitation->email);
        $this->assertSame('Service Person', $invitation->contact_person);
        $this->assertSame(FormStatus::INVITED, $invitation->status);
        $this->assertSame((string) $admin->id, (string) $invitation->invited_by);
        $this->assertNotNull($invitation->token);
        $this->assertNotNull($invitation->expired_at);
        $this->assertFalse($invitation->isExpired());

        Notification::assertSentOnDemand(
            OrganizationInvitationNotification::class,
            fn ($notification, $channels, $notifiable) => true,
        );
    }

    public function test_complete_profile_updates_fields_and_status(): void {
        $invitation = OrganizationInvitation::factory()->create();

        $data = [
            'organization_name' => 'PT Updated',
            'email'             => 'updated@test.com',
            'contact_person'    => 'Updated Person',
            'address'           => 'Jl. Test',
            'phone'             => '+628123456789',
            'website'           => 'https://test.com',
            'industry'          => 'IT',
            'employee_count'    => '51-200',
            'password'          => 'SecurePass123!',
        ];

        $result = $this->service->completeProfile($invitation, $data);

        $this->assertSame(FormStatus::SUBMITTED, $result->status);
        $this->assertSame('PT Updated', $result->organization_name);
        $this->assertSame('updated@test.com', $result->email);
        $this->assertNotNull($result->submitted_at);
        $this->assertNotNull($result->password);
    }

    public function test_complete_profile_throws_on_expired_invitation(): void {
        $invitation = OrganizationInvitation::factory()->expired()->create();

        $this->expectException(ValidationException::class);

        $this->service->completeProfile($invitation, [
            'organization_name' => 'PT Test',
            'email'             => 'test@test.com',
            'contact_person'    => 'John',
            'password'          => 'Password123!',
        ]);
    }

    public function test_complete_profile_throws_on_non_invited_status(): void {
        $invitation = OrganizationInvitation::factory()->submitted()->create();

        $this->expectException(ValidationException::class);

        $this->service->completeProfile($invitation, [
            'organization_name' => 'PT Test',
            'email'             => 'test@test.com',
            'contact_person'    => 'John',
            'password'          => 'Password123!',
        ]);
    }

    public function test_approve_creates_user_with_organization_role(): void {
        Notification::fake();
        $this->ensureRoleExists('organization');

        $invitation = OrganizationInvitation::factory()->submitted()->create();
        $reviewer   = User::factory()->create();

        $this->service->approve($invitation, $reviewer);

        $invitation->refresh();
        $this->assertSame(FormStatus::APPROVED, $invitation->status);
        $this->assertNotNull($invitation->user_id);
        $this->assertSame((string) $reviewer->id, (string) $invitation->reviewed_by);

        $user = User::find($invitation->user_id);
        $this->assertNotNull($user);
        $this->assertTrue($user->roles->pluck('name')->contains('organization'));
    }

    public function test_approve_throws_on_non_submitted_invitation(): void {
        $invitation = OrganizationInvitation::factory()->create(); // invited
        $reviewer   = User::factory()->create();

        $this->expectException(ValidationException::class);

        $this->service->approve($invitation, $reviewer);
    }

    public function test_reject_sets_rejected_status_and_reason(): void {
        Notification::fake();

        $invitation = OrganizationInvitation::factory()->submitted()->create();
        $reviewer   = User::factory()->create();

        $this->service->reject($invitation, $reviewer, 'Not eligible.');

        $invitation->refresh();
        $this->assertSame(FormStatus::REJECTED, $invitation->status);
        $this->assertSame('Not eligible.', $invitation->rejection_reason);
        $this->assertSame((string) $reviewer->id, (string) $invitation->reviewed_by);
    }

    public function test_reject_throws_on_non_submitted_invitation(): void {
        $invitation = OrganizationInvitation::factory()->create(); // invited
        $reviewer   = User::factory()->create();

        $this->expectException(ValidationException::class);

        $this->service->reject($invitation, $reviewer, 'Reason');
    }

    public function test_resend_extends_expiry_if_expired(): void {
        Notification::fake();

        $invitation     = OrganizationInvitation::factory()->expired()->create();
        $originalExpiry = $invitation->expired_at;

        $this->service->resendInvitation($invitation);

        $invitation->refresh();
        $this->assertGreaterThan($originalExpiry, $invitation->expired_at);
        $this->assertFalse($invitation->isExpired());
    }

    public function test_resend_throws_on_non_invited_status(): void {
        $invitation = OrganizationInvitation::factory()->submitted()->create();

        $this->expectException(ValidationException::class);

        $this->service->resendInvitation($invitation);
    }

    protected function setUp(): void {
        parent::setUp();

        Artisan::call('migrate:fresh', [
            '--database' => 'sqlite',
            '--path'     => $this->requiredMigrationPaths(),
            '--force'    => true,
        ]);

        $this->service = app(OrganizationInvitationService::class);
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
