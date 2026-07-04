<?php

namespace Tests\Feature\Student;

use App\FormStatus;
use App\Models\Core\File;
use App\Models\RoleRequest;
use App\Models\User\Role;
use App\Models\User\User;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class InstructorRoleRequestTest extends TestCase {
    public function test_student_can_submit_instructor_role_request_with_notes_and_proof_file(): void {
        $student = User::factory()->create();
        $this->assignRole($student, 'student');

        $proofFile = $this->createProofFile($student);

        $response = $this->submitRequest(
            $student,
            $proofFile,
            'Saya ingin mengajar kelas frontend karena sudah menjadi mentor 3 tahun.',
        );

        $response->assertRedirect(route('student.profile'));
        $response->assertSessionHasNoErrors();

        $roleRequest = RoleRequest::query()->first();
        $this->assertNotNull($roleRequest);
        $this->assertSame((string) $student->id, (string) $roleRequest->user_id);
        $this->assertSame('instructor', $roleRequest->requested_role);
        $this->assertSame('Saya ingin mengajar kelas frontend karena sudah menjadi mentor 3 tahun.', $roleRequest->reason);
        $this->assertSame((string) $proofFile->id, (string) $roleRequest->proof_file_id);
        $this->assertSame(FormStatus::PENDING->value, $roleRequest->status);
    }

    public function test_student_cannot_submit_another_request_when_pending_request_exists(): void {
        $student = User::factory()->create();
        $this->assignRole($student, 'student');

        $proofFile = $this->createProofFile($student);

        $this->submitRequest($student, $proofFile, 'Permintaan pertama')
            ->assertSessionHasNoErrors();

        $secondResponse = $this->submitRequest($student, $proofFile, 'Permintaan kedua');

        $secondResponse->assertSessionHasErrors('notes');
        $this->assertSame(1, RoleRequest::query()->count());
    }

    public function test_student_can_resubmit_after_previous_request_is_rejected(): void {
        $student = User::factory()->create();
        $this->assignRole($student, 'student');

        $firstProofFile = $this->createProofFile($student, 'proof-first');
        $this->submitRequest($student, $firstProofFile, 'Permintaan awal')
            ->assertSessionHasNoErrors();

        $firstRequest = RoleRequest::query()->firstOrFail();
        $firstRequest->update([
            'status'           => FormStatus::REJECTED->value,
            'reviewed_at'      => now(),
            'rejection_reason' => 'Mohon tambahkan bukti yang lebih relevan.',
        ]);

        $secondProofFile  = $this->createProofFile($student, 'proof-second');
        $resubmitResponse = $this->submitRequest(
            $student,
            $secondProofFile,
            'Permintaan ulang dengan bukti terbaru.',
        );

        $resubmitResponse->assertSessionHasNoErrors();
        $this->assertSame(2, RoleRequest::query()->count());
        $this->assertSame(
            1,
            RoleRequest::query()
                ->where('status', FormStatus::PENDING->value)
                ->count(),
        );
    }

    protected function setUp(): void {
        parent::setUp();

        Artisan::call('migrate:fresh', [
            '--database' => 'sqlite',
            '--path'     => $this->requiredMigrationPaths(),
            '--force'    => true,
        ]);
    }

    private function submitRequest(User $student, File $proofFile, string $notes): TestResponse {
        return $this->actingAs($student)
            ->from(route('student.profile'))
            ->post(route('student.instructor-requests.store'), [
                'notes'   => $notes,
                'filesId' => [(string) $proofFile->id],
            ]);
    }

    private function createProofFile(User $user, string $name = 'instructor-proof'): File {
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
        $role = Role::query()->firstOrCreate(
            ['name' => $roleName],
            [
                'description' => "{$roleName} role",
                'is_disabled' => false,
            ],
        );

        $user->roles()->syncWithoutDetaching([$role->id]);

        return $role;
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
            'database/migrations/2026_05_23_004628_create_role_requests_table.php',
            'database/migrations/2026_05_23_004628_add_inactive_fields_to_users_table.php',
            'database/migrations/2026_06_28_164713_create_notifications_table.php',
            'database/migrations/2026_06_28_173509_add_gate_and_link_to_notifications_table.php',
            'database/migrations/2026_06_28_182100_fix_notifiable_id_type_in_notifications_table.php',
        ];
    }
}
