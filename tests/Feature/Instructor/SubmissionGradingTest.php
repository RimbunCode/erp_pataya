<?php

namespace Tests\Feature\Instructor;

use App\Models\Course;
use App\Models\CourseContent;
use App\Models\CourseSection;
use App\Models\Enrollment;
use App\Models\Submission;
use App\Models\User\Role;
use App\Models\User\User;
use Illuminate\Support\Facades\Artisan;
use Tests\TestCase;

class SubmissionGradingTest extends TestCase {
    public function test_instructor_can_grade_student_submission(): void {
        $instructor = User::factory()->create();
        $student    = User::factory()->create();
        $this->assignRole($instructor, 'instructor');
        $this->assignRole($student, 'student');

        $course     = $this->createCourse($instructor);
        $section    = $this->createSection($course);
        $content    = $this->createContent($section);
        $enrollment = $this->createEnrollment($student, $course);
        $submission = $this->createSubmission($student, $content);

        $response = $this->actingAs($instructor)->patch(
            route('instructor.enrollments.submissions.grade', [
                'enrollment' => $enrollment->id,
                'submission' => $submission->id,
            ]),
            [
                'grade'    => 85,
                'feedback' => 'Tugas bagus, tetap semangat!',
            ]
        );

        $response->assertRedirect();
        $response->assertSessionHasNoErrors();

        $this->assertDatabaseHas('submissions', [
            'id'       => $submission->id,
            'grade'    => 85,
            'feedback' => 'Tugas bagus, tetap semangat!',
        ]);

        $submission->refresh();
        $this->assertNotNull($submission->graded_at);
    }

    public function test_instructor_can_give_null_grade_to_clear_grade(): void {
        $instructor = User::factory()->create();
        $student    = User::factory()->create();
        $this->assignRole($instructor, 'instructor');
        $this->assignRole($student, 'student');

        $course     = $this->createCourse($instructor);
        $section    = $this->createSection($course);
        $content    = $this->createContent($section);
        $enrollment = $this->createEnrollment($student, $course);
        $submission = $this->createSubmission($student, $content);

        $response = $this->actingAs($instructor)->patch(
            route('instructor.enrollments.submissions.grade', [
                'enrollment' => $enrollment->id,
                'submission' => $submission->id,
            ]),
            ['feedback' => 'Belum ada nilai']
        );

        $response->assertRedirect();
        $response->assertSessionHasNoErrors();
    }

    public function test_instructor_cannot_grade_submission_of_another_instructor_course(): void {
        $instructor1 = User::factory()->create();
        $instructor2 = User::factory()->create();
        $student     = User::factory()->create();
        $this->assignRole($instructor1, 'instructor');
        $this->assignRole($instructor2, 'instructor');
        $this->assignRole($student, 'student');

        $course1    = $this->createCourse($instructor1);
        $section1   = $this->createSection($course1);
        $content1   = $this->createContent($section1);
        $enrollment = $this->createEnrollment($student, $course1);
        $submission = $this->createSubmission($student, $content1);

        $response = $this->actingAs($instructor2)->patch(
            route('instructor.enrollments.submissions.grade', [
                'enrollment' => $enrollment->id,
                'submission' => $submission->id,
            ]),
            ['grade' => 90]
        );

        $response->assertForbidden();

        $this->assertDatabaseMissing('submissions', [
            'id'    => $submission->id,
            'grade' => 90,
        ]);
    }

    public function test_instructor_cannot_grade_submission_that_belongs_to_different_enrollment_user(): void {
        $instructor = User::factory()->create();
        $student1   = User::factory()->create();
        $student2   = User::factory()->create();
        $this->assignRole($instructor, 'instructor');
        $this->assignRole($student1, 'student');
        $this->assignRole($student2, 'student');

        $course     = $this->createCourse($instructor);
        $section    = $this->createSection($course);
        $content    = $this->createContent($section);
        $enrollment = $this->createEnrollment($student1, $course);

        // submission belongs to student2, but enrollment belongs to student1
        $submission = $this->createSubmission($student2, $content);

        $response = $this->actingAs($instructor)->patch(
            route('instructor.enrollments.submissions.grade', [
                'enrollment' => $enrollment->id,
                'submission' => $submission->id,
            ]),
            ['grade' => 75]
        );

        $response->assertStatus(422);

        $this->assertDatabaseMissing('submissions', [
            'id'    => $submission->id,
            'grade' => 75,
        ]);
    }

    protected function setUp(): void {
        parent::setUp();

        Artisan::call('migrate:fresh', [
            '--database' => 'sqlite',
            '--path'     => $this->requiredMigrationPaths(),
            '--force'    => true,
        ]);
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

    private function createCourse(User $instructor): Course {
        return Course::query()->create([
            'title'          => 'Test Course',
            'description'    => 'Test description',
            'price'          => 100000,
            'level'          => 'beginner',
            'total_hours'    => 2,
            'total_sessions' => 2,
            'created_by'     => $instructor->id,
        ]);
    }

    private function createSection(Course $course): CourseSection {
        return CourseSection::query()->create([
            'course_id' => $course->id,
            'title'     => 'Section Test',
            'order'     => 1,
        ]);
    }

    private function createContent(CourseSection $section): CourseContent {
        return CourseContent::query()->create([
            'section_id'  => $section->id,
            'title'       => 'Assignment Test',
            'type'        => 'assignment',
            'order'       => 1,
            'is_optional' => false,
        ]);
    }

    private function createEnrollment(User $student, Course $course): Enrollment {
        return Enrollment::query()->create([
            'user_id'   => $student->id,
            'course_id' => $course->id,
            'status'    => 'active',
        ]);
    }

    private function createSubmission(User $student, CourseContent $content): Submission {
        return Submission::query()->create([
            'user_id'      => $student->id,
            'content_id'   => $content->id,
            'status'       => 'submitted',
            'submitted_at' => now(),
        ]);
    }

    /**
     * @return array<int, string>
     */
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
            'database/migrations/2026_04_29_074108_create_submissions_table.php',
            'database/migrations/2026_04_28_074710_create_user_progress_table.php',
            'database/migrations/2026_05_22_134117_add_status_to_enrollments_table.php',
            'database/migrations/2026_05_22_134117_add_rejection_reason_to_payments_table.php',
            'database/migrations/2026_06_07_182309_add_url_to_course_contents_table.php',
            'database/migrations/2026_06_08_024831_add_grade_feedback_to_submissions_table.php',
            'database/migrations/2026_06_17_143845_add_deadline_time_to_course_contents_table.php',
            'database/migrations/2026_06_28_164713_create_notifications_table.php',
            'database/migrations/2026_06_28_173509_add_gate_and_link_to_notifications_table.php',
            'database/migrations/2026_06_28_182100_fix_notifiable_id_type_in_notifications_table.php',
        ];
    }
}
