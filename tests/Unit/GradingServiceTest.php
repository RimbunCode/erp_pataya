<?php

namespace Tests\Unit;

use App\Models\Course;
use App\Models\CourseContent;
use App\Models\CourseSection;
use App\Models\Enrollment;
use App\Models\Submission;
use App\Models\User\Role;
use App\Models\User\User;
use App\Models\UserProgress;
use App\Services\CertificateService;
use App\Services\GradingService;
use Illuminate\Support\Facades\Artisan;
use Tests\TestCase;

class GradingServiceTest extends TestCase {
    private GradingService $service;

    protected function setUp(): void {
        parent::setUp();

        Artisan::call('migrate:fresh', [
            '--database' => 'sqlite',
            '--path'     => $this->requiredMigrationPaths(),
            '--force'    => true,
        ]);

        $this->service = new GradingService(new CertificateService());
    }

    public function test_computes_average_from_multiple_assignments(): void {
        [$instructor, $student] = $this->makeInstructorAndStudent();
        $course     = $this->makeCourse($instructor, 'assignment');
        $section    = $this->makeSection($course);
        $content1   = $this->makeContent($section, 'assignment', 1);
        $content2   = $this->makeContent($section, 'assignment', 2);
        $content3   = $this->makeContent($section, 'assignment', 3);
        $enrollment = $this->makeEnrollment($student, $course);

        $this->makeSubmission($student, $content1, 90);
        $this->makeSubmission($student, $content2, 80);
        $this->makeSubmission($student, $content3, 70);

        $score = $this->service->computeFinalScore($enrollment);

        $this->assertEqualsWithDelta(80.0, $score, 0.01);
    }

    public function test_returns_null_when_an_assignment_is_not_yet_graded(): void {
        [$instructor, $student] = $this->makeInstructorAndStudent();
        $course     = $this->makeCourse($instructor, 'assignment');
        $section    = $this->makeSection($course);
        $content1   = $this->makeContent($section, 'assignment', 1);
        $content2   = $this->makeContent($section, 'assignment', 2);
        $enrollment = $this->makeEnrollment($student, $course);

        $this->makeSubmission($student, $content1, 90);
        // content2 belum ada submission/grade

        $this->assertNull($this->service->computeFinalScore($enrollment));
    }

    /** @dataProvider gradeBoundaryProvider */
    public function test_score_to_grade_boundaries(float $score, string $expectedGrade): void {
        $this->assertSame($expectedGrade, $this->service->scoreToGrade($score));
    }

    public static function gradeBoundaryProvider(): array {
        return [
            'boundary 49 -> E'  => [49, 'E'],
            'boundary 50 -> D'  => [50, 'D'],
            'boundary 60 -> D'  => [60, 'D'],
            'boundary 61 -> C'  => [61, 'C'],
            'boundary 74 -> C'  => [74, 'C'],
            'boundary 75 -> B'  => [75, 'B'],
            'boundary 85 -> B'  => [85, 'B'],
            'boundary 86 -> A'  => [86, 'A'],
            'boundary 100 -> A' => [100, 'A'],
        ];
    }

    public function test_evaluate_assignment_scheme_marks_not_passed_below_min_score(): void {
        [$instructor, $student] = $this->makeInstructorAndStudent();
        $course     = $this->makeCourse($instructor, 'assignment');
        $section    = $this->makeSection($course);
        $content    = $this->makeContent($section, 'assignment', 1);
        $enrollment = $this->makeEnrollment($student, $course);

        $this->makeSubmission($student, $content, 60);

        $result = $this->service->evaluate($enrollment);

        $this->assertEqualsWithDelta(60.0, $result['final_score'], 0.01);
        $this->assertSame('D', $result['grade']);
        $this->assertFalse($result['is_passed']);
    }

    public function test_evaluate_assignment_scheme_marks_passed_at_min_score(): void {
        [$instructor, $student] = $this->makeInstructorAndStudent();
        $course     = $this->makeCourse($instructor, 'assignment');
        $section    = $this->makeSection($course);
        $content    = $this->makeContent($section, 'assignment', 1);
        $enrollment = $this->makeEnrollment($student, $course);

        $this->makeSubmission($student, $content, 61);

        $result = $this->service->evaluate($enrollment);

        $this->assertSame('C', $result['grade']);
        $this->assertTrue($result['is_passed']);
    }

    public function test_evaluate_attendance_scheme_delegates_to_is_course_completed(): void {
        [$instructor, $student] = $this->makeInstructorAndStudent();
        $course     = $this->makeCourse($instructor, 'attendance');
        $section    = $this->makeSection($course);
        $content    = $this->makeContent($section, 'material', 1);
        $enrollment = $this->makeEnrollment($student, $course);

        UserProgress::query()->create([
            'user_id'      => $student->id,
            'content_id'   => $content->id,
            'is_completed' => true,
            'completed_at' => now(),
        ]);

        $result = $this->service->evaluate($enrollment);

        $this->assertNull($result['final_score']);
        $this->assertNull($result['grade']);
        $this->assertTrue($result['is_passed']);
    }

    public function test_evaluate_attendance_scheme_not_passed_when_incomplete(): void {
        [$instructor, $student] = $this->makeInstructorAndStudent();
        $course     = $this->makeCourse($instructor, 'attendance');
        $section    = $this->makeSection($course);
        $this->makeContent($section, 'material', 1);
        $enrollment = $this->makeEnrollment($student, $course);

        $result = $this->service->evaluate($enrollment);

        $this->assertFalse($result['is_passed']);
    }

    public function test_is_fully_evaluated_true_when_all_assignments_graded(): void {
        [$instructor, $student] = $this->makeInstructorAndStudent();
        $course     = $this->makeCourse($instructor, 'assignment');
        $section    = $this->makeSection($course);
        $content    = $this->makeContent($section, 'assignment', 1);
        $enrollment = $this->makeEnrollment($student, $course);

        $this->makeSubmission($student, $content, 80);

        $this->assertTrue($this->service->isFullyEvaluated($enrollment));
    }

    public function test_is_fully_evaluated_false_when_assignment_not_yet_graded(): void {
        [$instructor, $student] = $this->makeInstructorAndStudent();
        $course     = $this->makeCourse($instructor, 'assignment');
        $section    = $this->makeSection($course);
        $this->makeContent($section, 'assignment', 1);
        $enrollment = $this->makeEnrollment($student, $course);

        $this->assertFalse($this->service->isFullyEvaluated($enrollment));
    }

    public function test_is_fully_evaluated_always_true_for_attendance_scheme(): void {
        [$instructor, $student] = $this->makeInstructorAndStudent();
        $course     = $this->makeCourse($instructor, 'attendance');
        $section    = $this->makeSection($course);
        $this->makeContent($section, 'material', 1);
        $enrollment = $this->makeEnrollment($student, $course);

        $this->assertTrue($this->service->isFullyEvaluated($enrollment));
    }

    public function test_sync_evaluation_creates_record_without_changing_status(): void {
        [$instructor, $student] = $this->makeInstructorAndStudent();
        $course     = $this->makeCourse($instructor, 'assignment');
        $section    = $this->makeSection($course);
        $content    = $this->makeContent($section, 'assignment', 1);
        $enrollment = $this->makeEnrollment($student, $course);

        $this->makeSubmission($student, $content, 90);

        $evaluation = $this->service->syncEvaluation($enrollment);

        $this->assertSame('draft', $evaluation->status);
        $this->assertTrue($evaluation->is_passed);
        $this->assertSame('A', $evaluation->grade);

        // Sinkron ulang tidak boleh mereset status yang sudah diubah manual
        $evaluation->update(['status' => 'final']);
        $resynced = $this->service->syncEvaluation($enrollment->fresh());

        $this->assertSame('final', $resynced->status);
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

    private function makeCourse(User $instructor, string $graduationScheme): Course {
        return Course::query()->create([
            'title'             => 'Unit Test Course',
            'description'       => 'Description',
            'price'             => 0,
            'level'             => 'beginner',
            'total_hours'       => 1,
            'total_sessions'    => 1,
            'created_by'        => $instructor->id,
            'graduation_scheme' => $graduationScheme,
            'min_passing_score' => 61,
        ]);
    }

    private function makeSection(Course $course): CourseSection {
        return CourseSection::query()->create([
            'course_id' => $course->id,
            'title'     => 'Section 1',
            'order'     => 1,
        ]);
    }

    private function makeContent(
        CourseSection $section,
        string $type,
        int $order = 1,
        bool $isOptional = false,
    ): CourseContent {
        return CourseContent::query()->create([
            'section_id'  => $section->id,
            'title'       => "Content {$type} {$order}",
            'type'        => $type,
            'order'       => $order,
            'is_optional' => $isOptional,
        ]);
    }

    private function makeEnrollment(User $student, Course $course): Enrollment {
        return Enrollment::query()->create([
            'user_id'   => $student->id,
            'course_id' => $course->id,
            'status'    => 'active',
        ]);
    }

    private function makeSubmission(User $student, CourseContent $content, int $grade): Submission {
        return Submission::query()->create([
            'user_id'      => $student->id,
            'content_id'   => $content->id,
            'status'       => 'graded',
            'submitted_at' => now(),
            'grade'        => $grade,
            'graded_at'    => now(),
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
            'database/migrations/2026_07_07_000001_add_graduation_scheme_to_courses_table.php',
            'database/migrations/2026_07_07_000002_create_enrollment_evaluations_table.php',
            'database/migrations/2026_07_07_000003_add_layout_columns_to_certificate_templates_table.php',
            'database/migrations/2026_07_07_000004_add_snapshot_and_source_to_certificates_table.php',
        ];
    }
}
