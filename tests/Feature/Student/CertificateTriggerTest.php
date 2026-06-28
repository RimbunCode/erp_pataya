<?php

namespace Tests\Feature\Student;

use App\Jobs\IssueCertificateJob;
use App\Models\Course;
use App\Models\CourseContent;
use App\Models\CourseSection;
use App\Models\Enrollment;
use App\Models\Submission;
use App\Models\User\Role;
use App\Models\User\User;
use App\Models\UserProgress;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class CertificateTriggerTest extends TestCase {
    protected function setUp(): void {
        parent::setUp();

        Artisan::call('migrate:fresh', [
            '--database' => 'sqlite',
            '--path'     => $this->requiredMigrationPaths(),
            '--force'    => true,
        ]);
    }

    // ── Progress Trigger (material) ──────────────────

    public function test_completing_last_material_dispatches_certificate_job(): void {
        Queue::fake();

        [$instructor, $student] = $this->makeInstructorAndStudent();
        $course     = $this->makeCourse($instructor);
        $section    = $this->makeSection($course);
        $content    = $this->makeContent($section, 'material');
        $enrollment = $this->makeEnrollment($student, $course);

        $this->actingAs($student)->post(
            route('student.progress.store', ['content' => $content->id])
        );

        Queue::assertPushed(IssueCertificateJob::class, function ($job) use ($enrollment) {
            return $job->enrollment->id === $enrollment->id;
        });
    }

    public function test_completing_material_when_other_content_still_incomplete_does_not_dispatch_job(): void {
        Queue::fake();

        [$instructor, $student] = $this->makeInstructorAndStudent();
        $course  = $this->makeCourse($instructor);
        $section = $this->makeSection($course);
        $this->makeContent($section, 'material'); // konten pertama — belum selesai
        $content2 = $this->makeContent($section, 'material', 2);
        $this->makeEnrollment($student, $course);

        // hanya selesaikan konten kedua, konten pertama masih belum
        $this->actingAs($student)->post(
            route('student.progress.store', ['content' => $content2->id])
        );

        Queue::assertNotPushed(IssueCertificateJob::class);
    }

    public function test_completing_material_when_certificate_already_exists_does_not_dispatch_job(): void {
        Queue::fake();

        [$instructor, $student] = $this->makeInstructorAndStudent();
        $course     = $this->makeCourse($instructor);
        $section    = $this->makeSection($course);
        $content    = $this->makeContent($section, 'material');
        $enrollment = $this->makeEnrollment($student, $course);

        // sertifikat sudah ada
        $this->makeCertificateRecord($enrollment);

        $this->actingAs($student)->post(
            route('student.progress.store', ['content' => $content->id])
        );

        Queue::assertNotPushed(IssueCertificateJob::class);
    }

    // ── Grading Trigger (assignment) ─────────────────

    public function test_grading_last_submission_dispatches_certificate_job(): void {
        Queue::fake();

        [$instructor, $student] = $this->makeInstructorAndStudent();
        $course     = $this->makeCourse($instructor);
        $section    = $this->makeSection($course);
        $content    = $this->makeContent($section, 'assignment');
        $enrollment = $this->makeEnrollment($student, $course);
        $submission = $this->makeSubmission($student, $content);

        $this->actingAs($instructor)->patch(
            route('instructor.enrollments.submissions.grade', [
                'enrollment' => $enrollment->id,
                'submission' => $submission->id,
            ]),
            ['grade' => 90, 'feedback' => 'Bagus!']
        );

        Queue::assertPushed(IssueCertificateJob::class, function ($job) use ($enrollment) {
            return $job->enrollment->id === $enrollment->id;
        });
    }

    public function test_grading_marks_content_as_completed_in_user_progress(): void {
        Queue::fake();

        [$instructor, $student] = $this->makeInstructorAndStudent();
        $course     = $this->makeCourse($instructor);
        $section    = $this->makeSection($course);
        $content    = $this->makeContent($section, 'assignment');
        $enrollment = $this->makeEnrollment($student, $course);
        $submission = $this->makeSubmission($student, $content);

        $this->actingAs($instructor)->patch(
            route('instructor.enrollments.submissions.grade', [
                'enrollment' => $enrollment->id,
                'submission' => $submission->id,
            ]),
            ['grade' => 75]
        );

        $this->assertDatabaseHas('user_progress', [
            'user_id'      => $student->id,
            'content_id'   => $content->id,
            'is_completed' => true,
        ]);
    }

    public function test_grading_with_null_grade_does_not_dispatch_certificate_job(): void {
        Queue::fake();

        [$instructor, $student] = $this->makeInstructorAndStudent();
        $course     = $this->makeCourse($instructor);
        $section    = $this->makeSection($course);
        $content    = $this->makeContent($section, 'assignment');
        $enrollment = $this->makeEnrollment($student, $course);
        $submission = $this->makeSubmission($student, $content);

        // grade null = hanya feedback, belum dinilai
        $this->actingAs($instructor)->patch(
            route('instructor.enrollments.submissions.grade', [
                'enrollment' => $enrollment->id,
                'submission' => $submission->id,
            ]),
            ['feedback' => 'Cek kembali tugasmu.']
        );

        Queue::assertNotPushed(IssueCertificateJob::class);
    }

    public function test_grading_when_other_content_still_incomplete_does_not_dispatch_job(): void {
        Queue::fake();

        [$instructor, $student] = $this->makeInstructorAndStudent();
        $course  = $this->makeCourse($instructor);
        $section = $this->makeSection($course);
        $this->makeContent($section, 'material', 1); // material — belum selesai
        $content2   = $this->makeContent($section, 'assignment', 2);
        $enrollment = $this->makeEnrollment($student, $course);
        $submission = $this->makeSubmission($student, $content2);

        $this->actingAs($instructor)->patch(
            route('instructor.enrollments.submissions.grade', [
                'enrollment' => $enrollment->id,
                'submission' => $submission->id,
            ]),
            ['grade' => 80]
        );

        Queue::assertNotPushed(IssueCertificateJob::class);
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
            'price'          => 100000,
            'level'          => 'beginner',
            'total_hours'    => 2,
            'total_sessions' => 2,
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
            'title'       => "Content {$type} {$order}",
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

    private function makeSubmission(User $student, CourseContent $content): Submission {
        return Submission::query()->create([
            'user_id'      => $student->id,
            'content_id'   => $content->id,
            'status'       => 'submitted',
            'submitted_at' => now(),
        ]);
    }

    private function makeCertificateRecord(Enrollment $enrollment): void {
        \App\Models\Certificate::query()->create([
            'enrollment_id'  => $enrollment->id,
            'user_id'        => $enrollment->user_id,
            'course_id'      => $enrollment->course_id,
            'credential_id'  => 'INK-2026-TST-001',
            'issued_at'      => now(),
            'gdrive_file_id'      => 'fake-id',
            'gdrive_view_url'     => 'https://drive.google.com/file/d/fake/view',
            'gdrive_download_url' => 'https://drive.google.com/uc?export=download&id=fake',
            'status'         => 'active',
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
