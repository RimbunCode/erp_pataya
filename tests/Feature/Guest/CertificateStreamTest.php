<?php

namespace Tests\Feature\Guest;

use App\Models\Certificate;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\User\Role;
use App\Models\User\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Tests\TestCase;

class CertificateStreamTest extends TestCase {
    protected function setUp(): void {
        parent::setUp();

        Artisan::call('migrate:fresh', [
            '--database' => 'sqlite',
            '--path'     => $this->requiredMigrationPaths(),
            '--force'    => true,
        ]);
    }

    protected function tearDown(): void {
        Carbon::setTestNow();
        parent::tearDown();
    }

    public function test_valid_signature_streams_pdf_inline(): void {
        Storage::fake();
        Storage::put('certificates/INK-2026-STR-001.pdf', 'fake-pdf-content');

        [$instructor, $student] = $this->makeInstructorAndStudent();
        $course      = $this->makeCourse($instructor);
        $enrollment  = $this->makeEnrollment($student, $course);
        $certificate = $this->makeCertificate($enrollment, [
            'credential_id' => 'INK-2026-STR-001',
            'source'        => 'template',
            'file_path'     => 'certificates/INK-2026-STR-001.pdf',
        ]);

        $signedUrl = URL::temporarySignedRoute(
            'certificates.stream',
            now()->addMinutes(15),
            ['certificate' => $certificate->id],
        );

        $response = $this->get($signedUrl);

        $response->assertOk();
        $response->assertHeader('Content-Type', 'application/pdf');
    }

    public function test_missing_signature_is_rejected(): void {
        [$instructor, $student] = $this->makeInstructorAndStudent();
        $course      = $this->makeCourse($instructor);
        $enrollment  = $this->makeEnrollment($student, $course);
        $certificate = $this->makeCertificate($enrollment, [
            'source'    => 'template',
            'file_path' => 'certificates/unsigned.pdf',
        ]);

        $response = $this->get(route('certificates.stream', $certificate->id));

        $response->assertForbidden();
    }

    public function test_invalid_signature_is_rejected(): void {
        [$instructor, $student] = $this->makeInstructorAndStudent();
        $course      = $this->makeCourse($instructor);
        $enrollment  = $this->makeEnrollment($student, $course);
        $certificate = $this->makeCertificate($enrollment, [
            'source'    => 'template',
            'file_path' => 'certificates/tampered.pdf',
        ]);

        $signedUrl  = URL::temporarySignedRoute(
            'certificates.stream',
            now()->addMinutes(15),
            ['certificate' => $certificate->id],
        );
        $tamperedUrl = $signedUrl . '&tampered=1';

        $response = $this->get($tamperedUrl);

        $response->assertForbidden();
    }

    public function test_expired_signature_is_rejected(): void {
        Storage::fake();
        Storage::put('certificates/INK-2026-EXP-001.pdf', 'fake-pdf-content');

        [$instructor, $student] = $this->makeInstructorAndStudent();
        $course      = $this->makeCourse($instructor);
        $enrollment  = $this->makeEnrollment($student, $course);
        $certificate = $this->makeCertificate($enrollment, [
            'credential_id' => 'INK-2026-EXP-001',
            'source'        => 'template',
            'file_path'     => 'certificates/INK-2026-EXP-001.pdf',
        ]);

        $signedUrl = URL::temporarySignedRoute(
            'certificates.stream',
            now()->addMinutes(15),
            ['certificate' => $certificate->id],
        );

        Carbon::setTestNow(now()->addMinutes(16));

        $response = $this->get($signedUrl);

        $response->assertForbidden();
    }

    public function test_non_template_source_returns_404_even_with_valid_signature(): void {
        [$instructor, $student] = $this->makeInstructorAndStudent();
        $course      = $this->makeCourse($instructor);
        $enrollment  = $this->makeEnrollment($student, $course);
        $certificate = $this->makeCertificate($enrollment, [
            'source'    => 'manual_upload',
            'file_path' => null,
        ]);

        $signedUrl = URL::temporarySignedRoute(
            'certificates.stream',
            now()->addMinutes(15),
            ['certificate' => $certificate->id],
        );

        $response = $this->get($signedUrl);

        $response->assertNotFound();
    }

    public function test_missing_file_returns_404(): void {
        Storage::fake();

        [$instructor, $student] = $this->makeInstructorAndStudent();
        $course      = $this->makeCourse($instructor);
        $enrollment  = $this->makeEnrollment($student, $course);
        $certificate = $this->makeCertificate($enrollment, [
            'source'    => 'template',
            'file_path' => 'certificates/does-not-exist.pdf',
        ]);

        $signedUrl = URL::temporarySignedRoute(
            'certificates.stream',
            now()->addMinutes(15),
            ['certificate' => $certificate->id],
        );

        $response = $this->get($signedUrl);

        $response->assertNotFound();
    }

    public function test_stream_is_accessible_without_authentication(): void {
        Storage::fake();
        Storage::put('certificates/INK-2026-PUB-001.pdf', 'fake-pdf-content');

        [$instructor, $student] = $this->makeInstructorAndStudent();
        $course      = $this->makeCourse($instructor);
        $enrollment  = $this->makeEnrollment($student, $course);
        $certificate = $this->makeCertificate($enrollment, [
            'credential_id' => 'INK-2026-PUB-001',
            'source'        => 'template',
            'file_path'     => 'certificates/INK-2026-PUB-001.pdf',
        ]);

        $signedUrl = URL::temporarySignedRoute(
            'certificates.stream',
            now()->addMinutes(15),
            ['certificate' => $certificate->id],
        );

        $this->assertGuest();

        $response = $this->get($signedUrl);

        $response->assertOk();
    }

    // ── Helpers ───────────────────────────────────

    private function makeInstructorAndStudent(): array {
        $instructor = User::factory()->create();
        $student    = User::factory()->create();
        $this->assignRole($instructor, 'instructor');
        $this->assignRole($student, 'student');
        return [$instructor, $student];
    }

    private function assignRole(User $user, string $roleName): void {
        $role = Role::query()->firstOrCreate(
            ['name' => $roleName],
            ['description' => "{$roleName} role", 'is_disabled' => false],
        );
        $user->roles()->syncWithoutDetaching([$role->id]);
    }

    private function makeCourse(User $instructor): Course {
        return Course::query()->create([
            'title'          => 'Test Course',
            'description'    => 'Description',
            'price'          => 0,
            'level'          => 'beginner',
            'total_hours'    => 2,
            'total_sessions' => 2,
            'created_by'     => $instructor->id,
        ]);
    }

    private function makeEnrollment(User $student, Course $course): Enrollment {
        return Enrollment::query()->create([
            'user_id'   => $student->id,
            'course_id' => $course->id,
            'status'    => 'active',
        ]);
    }

    private function makeCertificate(Enrollment $enrollment, array $attrs = []): Certificate {
        return Certificate::query()->create(array_merge([
            'enrollment_id'       => $enrollment->id,
            'user_id'             => $enrollment->user_id,
            'course_id'           => $enrollment->course_id,
            'credential_id'       => 'INK-2026-TST-001',
            'issued_at'           => now(),
            'expires_at'          => now()->addYears(2),
            'gdrive_file_id'      => 'fake-file-id',
            'gdrive_view_url'     => 'https://drive.google.com/file/d/fake/view',
            'gdrive_download_url' => 'https://drive.google.com/uc?export=download&id=fake',
            'status'              => 'active',
        ], $attrs));
    }

    /** @return array<int, string> */
    private function requiredMigrationPaths(): array {
        return [
            'database/migrations/0001_01_01_000000_create_users_table.php',
            'database/migrations/0001_01_01_000000_create_preferences_table.php',
            'database/migrations/2025_01_31_135456_create_roles_table.php',
            'database/migrations/2025_01_31_150339_create_permissions_table.php',
            'database/migrations/2025_01_31_152926_create_user_role_table.php',
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
            'database/migrations/2026_06_07_182309_add_url_to_course_contents_table.php',
            'database/migrations/2026_06_08_024831_add_grade_feedback_to_submissions_table.php',
            'database/migrations/2026_06_17_143845_add_deadline_time_to_course_contents_table.php',
            'database/migrations/2026_06_27_000001_create_certificate_templates_table.php',
            'database/migrations/2026_06_27_000002_create_certificates_table.php',
            'database/migrations/2026_07_07_000001_add_graduation_scheme_to_courses_table.php',
            'database/migrations/2026_07_07_000002_create_enrollment_evaluations_table.php',
            'database/migrations/2026_07_07_000003_add_layout_columns_to_certificate_templates_table.php',
            'database/migrations/2026_07_07_000004_add_snapshot_and_source_to_certificates_table.php',
            'database/migrations/2026_07_08_221025_add_second_signer_to_certificate_templates_table.php',
            'database/migrations/2026_07_08_233747_add_partner_logos_to_certificate_templates_table.php',
        ];
    }
}
