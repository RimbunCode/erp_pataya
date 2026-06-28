<?php

namespace Tests\Feature\Instructor;

use App\Models\Certificate;
use App\Models\Course;
use App\Models\CourseContent;
use App\Models\CourseSection;
use App\Models\Enrollment;
use App\Models\User\Role;
use App\Models\User\User;
use App\Models\UserProgress;
use App\Services\CertificateService;
use App\Services\GoogleDocsService;
use Illuminate\Support\Facades\Artisan;
use Mockery;
use Tests\TestCase;

class CertificateIssueTest extends TestCase {
    protected function setUp(): void {
        parent::setUp();

        Artisan::call('migrate:fresh', [
            '--database' => 'sqlite',
            '--path'     => $this->requiredMigrationPaths(),
            '--force'    => true,
        ]);

        // Mock GoogleDocsService agar tidak hit Google API
        $googleMock = Mockery::mock(GoogleDocsService::class);
        $googleMock->shouldReceive('generateAndUploadCertificate')->andReturn([
            'file_id'      => 'mock-file-id',
            'view_url'     => 'https://drive.google.com/file/d/mock/view',
            'download_url' => 'https://drive.google.com/uc?export=download&id=mock',
        ]);
        $this->app->instance(GoogleDocsService::class, $googleMock);
    }

    public function test_instructor_can_issue_certificate_for_completed_student(): void {
        [$instructor, $student] = $this->makeInstructorAndStudent();
        $course     = $this->makeCourse($instructor);
        $section    = $this->makeSection($course);
        $content    = $this->makeContent($section, 'material');
        $enrollment = $this->makeEnrollment($student, $course);

        // Semua konten sudah selesai
        UserProgress::query()->create([
            'user_id'      => $student->id,
            'content_id'   => $content->id,
            'is_completed' => true,
            'completed_at' => now(),
        ]);

        $response = $this->actingAs($instructor)->post(
            route('instructor.enrollments.issue-certificate', $enrollment->id)
        );

        $response->assertRedirect();
        $response->assertSessionHasNoErrors();
        $response->assertSessionHas('success');

        $this->assertDatabaseHas('certificates', [
            'enrollment_id' => $enrollment->id,
            'user_id'       => $student->id,
            'course_id'     => $course->id,
        ]);
    }

    public function test_instructor_cannot_issue_certificate_when_course_not_completed(): void {
        [$instructor, $student] = $this->makeInstructorAndStudent();
        $course     = $this->makeCourse($instructor);
        $section    = $this->makeSection($course);
        $this->makeContent($section, 'material'); // belum ada progress
        $enrollment = $this->makeEnrollment($student, $course);

        $response = $this->actingAs($instructor)->post(
            route('instructor.enrollments.issue-certificate', $enrollment->id)
        );

        $response->assertRedirect();
        $response->assertSessionHasErrors('certificate');

        $this->assertDatabaseMissing('certificates', [
            'enrollment_id' => $enrollment->id,
        ]);
    }

    public function test_instructor_cannot_issue_certificate_for_another_instructors_enrollment(): void {
        $instructor1 = User::factory()->create();
        $instructor2 = User::factory()->create();
        $student     = User::factory()->create();
        $this->assignRole($instructor1, 'instructor');
        $this->assignRole($instructor2, 'instructor');
        $this->assignRole($student, 'student');

        $course     = $this->makeCourse($instructor1); // milik instructor1
        $section    = $this->makeSection($course);
        $content    = $this->makeContent($section, 'material');
        $enrollment = $this->makeEnrollment($student, $course);

        UserProgress::query()->create([
            'user_id'      => $student->id,
            'content_id'   => $content->id,
            'is_completed' => true,
            'completed_at' => now(),
        ]);

        // instructor2 mencoba issue certificate kursus milik instructor1
        $response = $this->actingAs($instructor2)->post(
            route('instructor.enrollments.issue-certificate', $enrollment->id)
        );

        $response->assertForbidden();

        $this->assertDatabaseMissing('certificates', [
            'enrollment_id' => $enrollment->id,
        ]);
    }

    public function test_issuing_certificate_twice_returns_info_without_duplicate(): void {
        [$instructor, $student] = $this->makeInstructorAndStudent();
        $course     = $this->makeCourse($instructor);
        $section    = $this->makeSection($course);
        $content    = $this->makeContent($section, 'material');
        $enrollment = $this->makeEnrollment($student, $course);

        UserProgress::query()->create([
            'user_id'      => $student->id,
            'content_id'   => $content->id,
            'is_completed' => true,
            'completed_at' => now(),
        ]);

        // Issue pertama
        $this->actingAs($instructor)->post(
            route('instructor.enrollments.issue-certificate', $enrollment->id)
        );

        // Issue kedua
        $response = $this->actingAs($instructor)->post(
            route('instructor.enrollments.issue-certificate', $enrollment->id)
        );

        $response->assertRedirect();
        $response->assertSessionHas('info');

        // Tidak boleh ada duplikat
        $this->assertSame(1, Certificate::where('enrollment_id', $enrollment->id)->count());
    }

    // ── Helpers ───────────────────────────────────────

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
            'total_hours'    => 1,
            'total_sessions' => 1,
            'created_by'     => $instructor->id,
        ]);
    }

    private function makeSection(Course $course): CourseSection {
        return CourseSection::query()->create([
            'course_id' => $course->id,
            'title'     => 'Section 1',
            'order'     => 1,
        ]);
    }

    private function makeContent(CourseSection $section, string $type, int $order = 1): CourseContent {
        return CourseContent::query()->create([
            'section_id'  => $section->id,
            'title'       => "Content {$type}",
            'type'        => $type,
            'order'       => $order,
            'is_optional' => false,
        ]);
    }

    private function makeEnrollment(User $student, Course $course): Enrollment {
        return Enrollment::query()->create([
            'user_id'   => $student->id,
            'course_id' => $course->id,
            'status'    => 'active',
        ]);
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
