<?php

namespace Tests\Feature\Student;

use App\Models\Certificate;
use App\Models\CertificateTemplate;
use App\Models\Course;
use App\Models\CourseContent;
use App\Models\CourseSection;
use App\Models\Enrollment;
use App\Models\User\Role;
use App\Models\User\User;
use Illuminate\Support\Facades\Artisan;
use Tests\TestCase;

class CertificatePageTest extends TestCase {
    protected function setUp(): void {
        parent::setUp();

        Artisan::call('migrate:fresh', [
            '--database' => 'sqlite',
            '--path'     => $this->requiredMigrationPaths(),
            '--force'    => true,
        ]);
    }

    public function test_student_can_view_certificates_page(): void {
        $student = $this->makeStudent();

        $response = $this->actingAs($student)->get(route('student.certificates'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page->component('Students/Certificates'));
    }

    public function test_certificates_page_shows_student_certificates(): void {
        [$instructor, $student] = $this->makeInstructorAndStudent();
        $course     = $this->makeCourse($instructor);
        $enrollment = $this->makeEnrollment($student, $course);
        $cert       = $this->makeCertificate($enrollment);

        $response = $this->actingAs($student)->get(route('student.certificates'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Students/Certificates')
            ->has('certificates', 1)
            ->where('certificates.0.credentialId', $cert->credential_id)
            ->where('certificates.0.title', $course->title)
        );
    }

    public function test_certificates_page_does_not_show_other_students_certificates(): void {
        [$instructor, $student1] = $this->makeInstructorAndStudent();
        $student2   = $this->makeStudent();
        $course     = $this->makeCourse($instructor);
        $enrollment = $this->makeEnrollment($student1, $course);
        $this->makeCertificate($enrollment);

        // student2 login → tidak boleh lihat sertifikat student1
        $response = $this->actingAs($student2)->get(route('student.certificates'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Students/Certificates')
            ->has('certificates', 0)
        );
    }

    public function test_unauthenticated_user_cannot_view_certificates_page(): void {
        $response = $this->get(route('student.certificates'));

        $response->assertRedirect();
        $this->assertFalse(auth()->check());
    }

    public function test_verify_returns_valid_for_active_certificate(): void {
        [$instructor, $student] = $this->makeInstructorAndStudent();
        $course     = $this->makeCourse($instructor);
        $enrollment = $this->makeEnrollment($student, $course);
        $cert       = $this->makeCertificate($enrollment);

        $response = $this->actingAs($student)
            ->getJson(route('student.certificates.verify', $cert->credential_id));

        $response->assertOk()
            ->assertJson([
                'valid'         => true,
                'status'        => 'active',
                'credential_id' => $cert->credential_id,
            ]);
    }

    public function test_verify_returns_invalid_for_expired_certificate(): void {
        [$instructor, $student] = $this->makeInstructorAndStudent();
        $course     = $this->makeCourse($instructor);
        $enrollment = $this->makeEnrollment($student, $course);
        $cert       = $this->makeCertificate($enrollment, [
            'expires_at' => now()->subDay(),
        ]);

        $response = $this->actingAs($student)
            ->getJson(route('student.certificates.verify', $cert->credential_id));

        $response->assertOk()
            ->assertJson(['valid' => false, 'status' => 'expired']);
    }

    public function test_verify_returns_404_for_unknown_credential_id(): void {
        $student = $this->makeStudent();

        $response = $this->actingAs($student)
            ->getJson(route('student.certificates.verify', 'INK-FAKE-000'));

        $response->assertNotFound();
    }

    // ── Helpers ───────────────────────────────────

    private function makeStudent(): User {
        $user = User::factory()->create();
        $this->assignRole($user, 'student');
        return $user;
    }

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

    private function makeCourse(User $instructor, array $attrs = []): Course {
        return Course::query()->create(array_merge([
            'title'          => 'Test Course',
            'description'    => 'Description',
            'price'          => 100000,
            'level'          => 'beginner',
            'total_hours'    => 2,
            'total_sessions' => 2,
            'created_by'     => $instructor->id,
        ], $attrs));
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
            'enrollment_id'  => $enrollment->id,
            'user_id'        => $enrollment->user_id,
            'course_id'      => $enrollment->course_id,
            'credential_id'  => 'INK-2026-TST-001',
            'issued_at'      => now(),
            'expires_at'     => now()->addYears(2),
            'gdrive_file_id'      => 'fake-file-id',
            'gdrive_view_url'     => 'https://drive.google.com/file/d/fake/view',
            'gdrive_download_url' => 'https://drive.google.com/uc?export=download&id=fake',
            'status'         => 'active',
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
        ];
    }
}
