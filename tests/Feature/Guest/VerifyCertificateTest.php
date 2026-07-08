<?php

namespace Tests\Feature\Guest;

use App\Models\Certificate;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\User\Role;
use App\Models\User\User;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class VerifyCertificateTest extends TestCase {
    protected function setUp(): void {
        parent::setUp();

        Artisan::call('migrate:fresh', [
            '--database' => 'sqlite',
            '--path'     => $this->requiredMigrationPaths(),
            '--force'    => true,
        ]);
    }

    public function test_verify_page_shows_not_found_for_unknown_credential_id(): void {
        $response = $this->get(route('guest.verify.show', 'INK-FAKE-000'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Guest/VerifyCTA/VerifyCTA')
            ->where('result.found', false)
        );
    }

    public function test_verify_page_shows_revoked_message(): void {
        [$instructor, $student] = $this->makeInstructorAndStudent();
        $course      = $this->makeCourse($instructor);
        $enrollment  = $this->makeEnrollment($student, $course);
        $certificate = $this->makeCertificate($enrollment, ['status' => 'revoked']);

        $response = $this->get(route('guest.verify.show', $certificate->credential_id));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Guest/VerifyCTA/VerifyCTA')
            ->where('result.found', true)
            ->where('result.status', 'revoked')
            ->where('result.pdfViewerUrl', null)
        );
    }

    public function test_verify_page_shows_expired_message(): void {
        [$instructor, $student] = $this->makeInstructorAndStudent();
        $course      = $this->makeCourse($instructor);
        $enrollment  = $this->makeEnrollment($student, $course);
        $certificate = $this->makeCertificate($enrollment, ['expires_at' => now()->subDay()]);

        $response = $this->get(route('guest.verify.show', $certificate->credential_id));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Guest/VerifyCTA/VerifyCTA')
            ->where('result.found', true)
            ->where('result.status', 'expired')
            ->where('result.pdfViewerUrl', null)
        );
    }

    public function test_verify_page_shows_iframe_url_for_active_template_certificate(): void {
        Storage::fake();
        Storage::put('certificates/INK-2026-VER-001.pdf', 'fake-pdf-content');

        [$instructor, $student] = $this->makeInstructorAndStudent();
        $course      = $this->makeCourse($instructor);
        $enrollment  = $this->makeEnrollment($student, $course);
        $certificate = $this->makeCertificate($enrollment, [
            'credential_id' => 'INK-2026-VER-001',
            'source'        => 'template',
            'file_path'     => 'certificates/INK-2026-VER-001.pdf',
        ]);

        $response = $this->get(route('guest.verify.show', $certificate->credential_id));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Guest/VerifyCTA/VerifyCTA')
            ->where('result.found', true)
            ->where('result.status', 'active')
            ->where('result.studentName', $student->name)
            ->where('result.courseTitle', $course->title)
            ->has('result.pdfViewerUrl')
            ->where('result.pdfViewerUrl', fn ($url) =>
                str_starts_with($url, 'https://docs.google.com/viewerng/viewer?hl=en&embedded=true&url=')
                && str_contains($url, urlencode(route('certificates.stream', $certificate->id)))
            )
        );
    }

    public function test_verify_page_does_not_show_iframe_for_non_template_source(): void {
        [$instructor, $student] = $this->makeInstructorAndStudent();
        $course      = $this->makeCourse($instructor);
        $enrollment  = $this->makeEnrollment($student, $course);
        $certificate = $this->makeCertificate($enrollment, ['source' => 'manual_upload']);

        $response = $this->get(route('guest.verify.show', $certificate->credential_id));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Guest/VerifyCTA/VerifyCTA')
            ->where('result.found', true)
            ->where('result.status', 'active')
            ->where('result.pdfViewerUrl', null)
        );
    }

    public function test_verify_page_is_publicly_accessible_without_auth(): void {
        [$instructor, $student] = $this->makeInstructorAndStudent();
        $course      = $this->makeCourse($instructor);
        $enrollment  = $this->makeEnrollment($student, $course);
        $certificate = $this->makeCertificate($enrollment);

        $this->assertGuest();

        $response = $this->get(route('guest.verify.show', $certificate->credential_id));

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
