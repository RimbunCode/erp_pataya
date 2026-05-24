<?php

namespace Tests\Feature\Admin;

use App\FormStatus;
use App\Models\Core\File;
use App\Models\RoleRequest;
use App\Models\User\Role;
use App\Models\User\User;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class UserDirectoryRoleRequestTest extends TestCase {
    public function test_admin_can_approve_pending_instructor_request_and_attach_role(): void {
        $admin   = User::factory()->create();
        $student = User::factory()->create();

        $this->assignRole($admin, 'admin');
        $this->assignRole($student, 'student');
        $this->ensureRoleExists('instructor');

        $roleRequest = $this->createPendingInstructorRequest($student);

        $response = $this->actingAs($admin)->patch(
            route('admin.user.requests.approve', ['roleRequest' => $roleRequest->id]),
        );

        $response->assertRedirect();
        $response->assertSessionHasNoErrors();

        $roleRequest->refresh();
        $student->refresh();

        $this->assertSame(FormStatus::APPROVED->value, $roleRequest->status);
        $this->assertSame((string) $admin->id, (string) $roleRequest->reviewed_by);
        $this->assertNotNull($roleRequest->reviewed_at);
        $this->assertNull($roleRequest->rejection_reason);
        $this->assertTrue(
            $student->roles->pluck('name')->contains('instructor'),
        );
    }

    public function test_admin_reject_request_requires_reason_and_persists_rejection_reason(): void {
        $admin   = User::factory()->create();
        $student = User::factory()->create();

        $this->assignRole($admin, 'admin');
        $this->assignRole($student, 'student');

        $roleRequest = $this->createPendingInstructorRequest($student);

        $withoutReasonResponse = $this->actingAs($admin)
            ->from(route('admin.user'))
            ->patch(
                route('admin.user.requests.reject', ['roleRequest' => $roleRequest->id]),
                ['reason' => ''],
            );
        $withoutReasonResponse->assertSessionHasErrors('reason');

        $response = $this->actingAs($admin)->patch(
            route('admin.user.requests.reject', ['roleRequest' => $roleRequest->id]),
            ['reason' => 'Dokumen bukti belum valid.'],
        );

        $response->assertRedirect();
        $response->assertSessionHasNoErrors();

        $roleRequest->refresh();
        $this->assertSame(FormStatus::REJECTED->value, $roleRequest->status);
        $this->assertSame('Dokumen bukti belum valid.', $roleRequest->rejection_reason);
        $this->assertSame((string) $admin->id, (string) $roleRequest->reviewed_by);
        $this->assertNotNull($roleRequest->reviewed_at);
    }

    public function test_admin_cannot_set_user_inactive_without_reason(): void {
        $admin = User::factory()->create();
        $user  = User::factory()->create();

        $this->assignRole($admin, 'admin');

        $response = $this->actingAs($admin)
            ->from(route('admin.user'))
            ->patch(
                route('admin.user.users.status', ['user' => $user->id]),
                ['status' => 'inactive'],
            );

        $response->assertSessionHasErrors('reason');
    }

    public function test_admin_can_set_user_inactive_and_reactivate_user(): void {
        $admin = User::factory()->create();
        $user  = User::factory()->create();

        $this->assignRole($admin, 'admin');

        $inactiveResponse = $this->actingAs($admin)->patch(
            route('admin.user.users.status', ['user' => $user->id]),
            [
                'status' => 'inactive',
                'reason' => 'Akun perlu ditinjau manual.',
            ],
        );

        $inactiveResponse->assertRedirect();
        $inactiveResponse->assertSessionHasNoErrors();

        $user->refresh();
        $this->assertSame(FormStatus::INACTIVE, $user->status);
        $this->assertSame('Akun perlu ditinjau manual.', $user->inactive_reason);
        $this->assertSame((string) $admin->id, (string) $user->inactive_by);
        $this->assertNotNull($user->inactive_at);

        $activeResponse = $this->actingAs($admin)->patch(
            route('admin.user.users.status', ['user' => $user->id]),
            ['status' => 'active'],
        );

        $activeResponse->assertRedirect();
        $activeResponse->assertSessionHasNoErrors();

        $user->refresh();
        $this->assertSame(FormStatus::ACTIVE, $user->status);
        $this->assertNull($user->inactive_reason);
        $this->assertNull($user->inactive_by);
        $this->assertNull($user->inactive_at);
    }

    public function test_admin_user_directory_page_returns_real_inertia_props(): void {
        $admin   = User::factory()->create(['name' => 'Admin User']);
        $student = User::factory()->create(['name' => 'Student User']);

        $this->assignRole($admin, 'admin');
        $this->assignRole($student, 'student');

        $roleRequest = $this->createPendingInstructorRequest($student);

        $response = $this->actingAs($admin)->get(route('admin.user'));

        $response->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('Admin/UserDirectory/index')
            ->has('users')
            ->has('requests', 1)
            ->has('admins')
            ->where('orgs', [])
            ->where('orgsMeta.ready', false)
            ->has('requests.0', fn (Assert $request) => $request
                ->where('id', (string) $roleRequest->id)
                ->where('userId', (string) $student->id)
                ->where('requestedRole', 'instructor')
                ->where('status', FormStatus::PENDING->value)
                ->etc()));
    }

    public function test_admin_user_directory_page_exposes_rejection_history_for_reapplied_role_request(): void {
        $admin   = User::factory()->create();
        $student = User::factory()->create();

        $this->assignRole($admin, 'admin');
        $this->assignRole($student, 'student');

        $rejectedRequest = RoleRequest::query()->create([
            'user_id'          => $student->id,
            'requested_role'   => 'instructor',
            'reason'           => 'Pengajuan pertama',
            'proof_file_id'    => $this->createProofFile($student, 'proof-rejected')->id,
            'status'           => FormStatus::REJECTED->value,
            'reviewed_by'      => $admin->id,
            'reviewed_at'      => now()->subDay(),
            'rejection_reason' => 'Dokumen bukti tidak terbaca.',
        ]);

        $pendingRequest = $this->createPendingInstructorRequest($student);

        $this->actingAs($admin)
            ->get(route('admin.user'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/UserDirectory/index')
                ->where('requests', function ($requests) use ($pendingRequest, $rejectedRequest): bool {
                    $requestCollection = collect($requests);
                    $pendingPayload    = $requestCollection->firstWhere('id', (string) $pendingRequest->id);

                    if ($pendingPayload === null) {
                        return false;
                    }

                    return ($pendingPayload['rejectionHistoryCount'] ?? 0) === 1
                        && ($pendingPayload['rejectionHistory'][0]['id'] ?? null) === (string) $rejectedRequest->id
                        && ($pendingPayload['rejectionHistory'][0]['reason'] ?? null) === 'Dokumen bukti tidak terbaca.';
                }));
    }

    protected function setUp(): void {
        parent::setUp();

        Artisan::call('migrate:fresh', [
            '--database' => 'sqlite',
            '--path'     => $this->requiredMigrationPaths(),
            '--force'    => true,
        ]);
    }

    private function createPendingInstructorRequest(User $student): RoleRequest {
        $proofFile = $this->createProofFile($student);

        return RoleRequest::query()->create([
            'user_id'        => $student->id,
            'requested_role' => 'instructor',
            'reason'         => 'Saya memiliki pengalaman mengajar.',
            'proof_file_id'  => $proofFile->id,
            'status'         => FormStatus::PENDING->value,
        ]);
    }

    private function createProofFile(User $user, string $name = 'proof-admin'): File {
        $fileId = (string) Str::ulid();

        DB::table('files')->insert([
            'id'            => $fileId,
            'name'          => $name,
            'path'          => "files/{$name}.pdf",
            'extension'     => 'pdf',
            'mime_type'     => 'application/pdf',
            'is_public'     => false,
            'created_by_id' => $user->id,
            'created_at'    => now(),
            'updated_at'    => now(),
        ]);

        return File::query()->findOrFail($fileId);
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
            'database/migrations/2025_01_30_134342_create_files_table.php',
            'database/migrations/2026_05_23_004628_create_role_requests_table.php',
        ];
    }
}
