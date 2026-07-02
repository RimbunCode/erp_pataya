<?php

namespace Tests\Feature\Admin;

use App\Models\Core\File;
use App\Models\Course;
use App\Models\CourseContent;
use App\Models\CourseSection;
use App\Models\Enrollment;
use App\Models\EnrollmentCertificateUpload;
use App\Models\User\Role;
use App\Models\User\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

class StudentCertificateUploadTest extends TestCase {
    public function test_admin_can_upload_certificate_when_progress_complete(): void {
        Storage::fake('local');

        [$admin, $student, $enrollment] = $this->makeCompletedEnrollment();

        $response = $this->actingAs($admin)->post(
            route('admin.student-certificate-uploads.upload', $enrollment),
            [
                'files'    => [UploadedFile::fake()->create('sertifikat.pdf', 100, 'application/pdf')],
                'name'     => ['Sertifikat Course'],
                'isPublic' => ['false'],
            ],
        );

        $response->assertRedirect();
        $response->assertSessionHasNoErrors();
        $response->assertSessionHas('success', 'Sertifikat berhasil diupload.');

        $this->assertDatabaseHas('enrollment_certificate_uploads', [
            'enrollment_id' => (string) $enrollment->id,
            'uploaded_by'   => (string) $admin->id,
        ]);
    }

    public function test_upload_accepts_image_file(): void {
        Storage::fake('local');

        [$admin, $student, $enrollment] = $this->makeCompletedEnrollment();

        $response = $this->actingAs($admin)->post(
            route('admin.student-certificate-uploads.upload', $enrollment),
            [
                'files'    => [UploadedFile::fake()->image('sertifikat.png')],
                'name'     => ['Sertifikat Gambar'],
                'isPublic' => ['false'],
            ],
        );

        $response->assertRedirect();
        $response->assertSessionHasNoErrors();

        $this->assertDatabaseHas('enrollment_certificate_uploads', [
            'enrollment_id' => (string) $enrollment->id,
        ]);
    }

    public function test_upload_rejected_when_progress_incomplete(): void {
        Storage::fake('local');

        [$admin, $student, $enrollment] = $this->makeCompletedEnrollment(completeProgress: false);

        $response = $this->actingAs($admin)->post(
            route('admin.student-certificate-uploads.upload', $enrollment),
            [
                'files'    => [UploadedFile::fake()->create('sertifikat.pdf', 100, 'application/pdf')],
                'name'     => ['Sertifikat Course'],
                'isPublic' => ['false'],
            ],
        );

        $response->assertSessionHasErrors('files');

        $this->assertDatabaseMissing('enrollment_certificate_uploads', [
            'enrollment_id' => (string) $enrollment->id,
        ]);
    }

    public function test_upload_rejects_disallowed_file_type(): void {
        Storage::fake('local');

        [$admin, $student, $enrollment] = $this->makeCompletedEnrollment();

        $response = $this->actingAs($admin)->post(
            route('admin.student-certificate-uploads.upload', $enrollment),
            [
                'files'    => [UploadedFile::fake()->create('catatan.txt', 10, 'text/plain')],
                'name'     => ['Catatan'],
                'isPublic' => ['false'],
            ],
        );

        $response->assertSessionHasErrors('files.0');

        $this->assertDatabaseMissing('enrollment_certificate_uploads', [
            'enrollment_id' => (string) $enrollment->id,
        ]);
    }

    public function test_reupload_replaces_old_file_without_dangling_reference(): void {
        Storage::fake('local');

        [$admin, $student, $enrollment] = $this->makeCompletedEnrollment();

        $this->actingAs($admin)->post(
            route('admin.student-certificate-uploads.upload', $enrollment),
            [
                'files'    => [UploadedFile::fake()->create('sertifikat-lama.pdf', 100, 'application/pdf')],
                'name'     => ['Sertifikat Lama'],
                'isPublic' => ['false'],
            ],
        )->assertSessionHasNoErrors();

        $oldFileId = EnrollmentCertificateUpload::query()
            ->where('enrollment_id', $enrollment->id)
            ->value('file_id');

        $response = $this->actingAs($admin)->post(
            route('admin.student-certificate-uploads.upload', $enrollment),
            [
                'files'    => [UploadedFile::fake()->create('sertifikat-baru.pdf', 100, 'application/pdf')],
                'name'     => ['Sertifikat Baru'],
                'isPublic' => ['false'],
            ],
        );

        $response->assertSessionHasNoErrors();

        $upload = EnrollmentCertificateUpload::query()
            ->where('enrollment_id', $enrollment->id)
            ->first();

        $this->assertNotNull($upload);
        $this->assertNotSame((string) $oldFileId, (string) $upload->file_id);
        $this->assertNotNull($upload->file, 'File baru harus tetap terhubung setelah reupload.');
        $this->assertTrue(File::withTrashed()->find($oldFileId)->trashed(), 'File lama harus soft-deleted.');

        // Halaman detail student tidak boleh error setelah reupload.
        $this->actingAs($admin)
            ->get(route('admin.student-certificate-uploads.show', $student))
            ->assertOk();
    }

    public function test_show_page_survives_missing_certificate_file(): void {
        [$admin, $student, $enrollment] = $this->makeCompletedEnrollment();

        $fileId = $this->insertFile($admin->id, 'sertifikat-hilang', 'files/hilang.pdf');

        EnrollmentCertificateUpload::query()->create([
            'enrollment_id' => $enrollment->id,
            'file_id'       => $fileId,
            'uploaded_by'   => $admin->id,
            'uploaded_at'   => now(),
        ]);

        File::query()->find($fileId)->delete();

        $response = $this->actingAs($admin)->get(
            route('admin.student-certificate-uploads.show', $student),
        );

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Admin/StudentCertificateUploads/index')
            ->where('selectedStudentCourses.0.certificate', null)
        );
    }

    protected function setUp(): void {
        parent::setUp();

        Artisan::call('migrate:fresh', [
            '--database' => 'sqlite',
            '--path'     => $this->requiredMigrationPaths(),
            '--force'    => true,
        ]);

        // Kolom TreeView yang dibutuhkan observer model File.
        Schema::table('files', function ($table) {
            $table->unsignedInteger('lft')->default(0);
            $table->unsignedInteger('rgt')->default(0);
            $table->unsignedInteger('depth')->default(0);
        });

        $this->ensureAdminPermissionExists('content_admin');
    }

    /**
     * @return array{0: User, 1: User, 2: Enrollment}
     */
    private function makeCompletedEnrollment(bool $completeProgress = true): array {
        $admin      = User::factory()->create();
        $instructor = User::factory()->create();
        $student    = User::factory()->create();

        $this->assignRole($admin, 'admin');
        $this->assignRole($instructor, 'instructor');
        $this->assignRole($student, 'student');
        $this->grantAdminPermission($admin, 'content_admin');

        $course = Course::query()->create([
            'title'          => 'Test Course',
            'description'    => 'Description',
            'price'          => 100000,
            'level'          => 'beginner',
            'total_hours'    => 2,
            'total_sessions' => 2,
            'created_by'     => $instructor->id,
        ]);

        $section = CourseSection::query()->create([
            'course_id' => $course->id,
            'title'     => 'Section 1',
            'order'     => 1,
        ]);

        $content = CourseContent::query()->create([
            'section_id'  => $section->id,
            'title'       => 'Material 1',
            'type'        => 'material',
            'order'       => 1,
            'is_optional' => false,
        ]);

        $enrollment = Enrollment::query()->create([
            'user_id'   => $student->id,
            'course_id' => $course->id,
            'status'    => 'active',
        ]);

        if ($completeProgress) {
            DB::table('user_progress')->insert([
                'id'           => (string) Str::ulid(),
                'user_id'      => $student->id,
                'content_id'   => $content->id,
                'is_completed' => true,
                'completed_at' => now(),
                'created_at'   => now(),
                'updated_at'   => now(),
            ]);
        }

        return [$admin, $student, $enrollment];
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

    private function insertFile(string $userId, string $name, string $path): string {
        $id = (string) Str::ulid();
        DB::table('files')->insert([
            'id'            => $id,
            'name'          => $name,
            'path'          => $path,
            'extension'     => 'pdf',
            'mime_type'     => 'application/pdf',
            'is_public'     => 0,
            'created_by_id' => $userId,
            'created_at'    => now(),
            'updated_at'    => now(),
        ]);

        return $id;
    }

    /**
     * @return array<int, string>
     */
    private function requiredMigrationPaths(): array {
        return [
            'database/migrations/0001_01_01_000000_create_users_table.php',
            'database/migrations/0001_01_01_000000_create_preferences_table.php',
            'database/migrations/2025_01_30_134342_create_files_table.php',
            'database/migrations/2025_02_08_194506_create_fileables_table.php',
            'database/migrations/2025_01_31_135456_create_roles_table.php',
            'database/migrations/2025_01_31_150339_create_permissions_table.php',
            'database/migrations/2025_01_31_152926_create_user_role_table.php',
            'database/migrations/2025_01_31_153311_create_role_permissions_table.php',
            'database/migrations/2026_04_26_075938_create_courses_table.php',
            'database/migrations/2026_04_26_075939_create_categories_table.php',
            'database/migrations/2026_04_28_074544_create_course_category_table.php',
            'database/migrations/2026_04_28_074634_create_payments_table.php',
            'database/migrations/2026_04_28_074652_create_enrollments_table.php',
            'database/migrations/2026_04_28_074531_create_course_sections_table.php',
            'database/migrations/2026_04_28_074547_create_course_contents_table.php',
            'database/migrations/2026_04_28_074548_create_course_content_files_table.php',
            'database/migrations/2026_04_28_074710_create_user_progress_table.php',
            'database/migrations/2026_04_29_074108_create_submissions_table.php',
            'database/migrations/2026_05_22_134117_add_status_to_enrollments_table.php',
            'database/migrations/2026_05_22_134117_add_rejection_reason_to_payments_table.php',
            'database/migrations/2026_05_24_141817_create_admin_user_permissions_table.php',
            'database/migrations/2026_06_07_182309_add_url_to_course_contents_table.php',
            'database/migrations/2026_06_08_024831_add_grade_feedback_to_submissions_table.php',
            'database/migrations/2026_06_17_143845_add_deadline_time_to_course_contents_table.php',
            'database/migrations/2026_06_28_164713_create_notifications_table.php',
            'database/migrations/2026_06_28_173509_add_gate_and_link_to_notifications_table.php',
            'database/migrations/2026_06_28_182100_fix_notifiable_id_type_in_notifications_table.php',
            'database/migrations/2026_07_02_000001_create_enrollment_certificate_uploads_table.php',
        ];
    }
}
