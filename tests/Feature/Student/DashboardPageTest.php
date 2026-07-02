<?php

namespace Tests\Feature\Student;

use App\FormStatus;
use App\Models\Course;
use App\Models\CourseContent;
use App\Models\CourseSection;
use App\Models\Enrollment;
use App\Models\Submission;
use App\Models\User\Role;
use App\Models\User\User;
use App\Models\UserProgress;
use Carbon\Carbon;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class DashboardPageTest extends TestCase {
    public function test_dashboard_route_renders_empty_payload_for_new_student(): void {
        $student = User::factory()->create();
        $this->assignRole($student, 'student');

        $response = $this->actingAs($student)->get(route('student.dashboard'));

        $response->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Students/Dashboard')
                ->where('overview.ongoingCourses', 0)
                ->where('overview.completedCourses', 0)
                ->where('overview.pendingVerificationCourses', 0)
                ->where('overview.pendingSubmissions', 0)
                ->where('hero.averageProgress', 0)
                ->where('hero.resumeCourse', null)
                ->where('continueLearning', [])
                ->where('upcomingDeadlines', []));
    }

    public function test_dashboard_uses_scoped_aggregates_progress_rules_sorting_and_limits(): void {
        Carbon::setTestNow(Carbon::parse('2026-05-24 10:00:00'));

        $instructor      = User::factory()->create();
        $otherInstructor = User::factory()->create();
        $student         = User::factory()->create();
        $otherStudent    = User::factory()->create();

        $this->assignRole($instructor, 'instructor');
        $this->assignRole($otherInstructor, 'instructor');
        $this->assignRole($student, 'student');
        $this->assignRole($otherStudent, 'student');

        $courseAlpha    = $this->createCourse($instructor, 'Course Alpha');
        $courseBeta     = $this->createCourse($instructor, 'Course Beta');
        $courseGamma    = $this->createCourse($instructor, 'Course Gamma');
        $courseDelta    = $this->createCourse($instructor, 'Course Delta');
        $coursePending  = $this->createCourse($instructor, 'Course Pending');
        $courseRejected = $this->createCourse($instructor, 'Course Rejected');

        $alphaSection = $this->createSection($courseAlpha, 'Alpha Section', 1);

        $alphaMaterialDone = $this->createContent($alphaSection, [
            'title' => 'Alpha Material Done',
            'type'  => 'material',
            'order' => 1,
        ]);

        $alphaAssignmentDone = $this->createContent($alphaSection, [
            'title'    => 'Alpha Assignment Done',
            'type'     => 'assignment',
            'order'    => 2,
            'deadline' => now()->addDays(5),
        ]);

        $alphaAssignmentOne = $this->createContent($alphaSection, [
            'title'    => 'Alpha Assignment 1',
            'type'     => 'assignment',
            'order'    => 3,
            'deadline' => now()->subDay(),
        ]);

        $alphaAssignmentTwo = $this->createContent($alphaSection, [
            'title'    => 'Alpha Assignment 2',
            'type'     => 'assignment',
            'order'    => 4,
            'deadline' => now()->addHour(),
        ]);

        $alphaAssignmentThree = $this->createContent($alphaSection, [
            'title'    => 'Alpha Assignment 3',
            'type'     => 'assignment',
            'order'    => 5,
            'deadline' => now()->addHours(2),
        ]);

        $alphaAssignmentFour = $this->createContent($alphaSection, [
            'title'    => 'Alpha Assignment 4',
            'type'     => 'assignment',
            'order'    => 6,
            'deadline' => now()->addHours(3),
        ]);

        $alphaAssignmentFive = $this->createContent($alphaSection, [
            'title'    => 'Alpha Assignment 5',
            'type'     => 'assignment',
            'order'    => 7,
            'deadline' => now()->addHours(4),
        ]);

        $alphaAssignmentSix = $this->createContent($alphaSection, [
            'title'    => 'Alpha Assignment 6',
            'type'     => 'assignment',
            'order'    => 8,
            'deadline' => now()->addHours(5),
        ]);

        $betaSection = $this->createSection($courseBeta, 'Beta Section', 1);

        $betaMaterialDone = $this->createContent($betaSection, [
            'title' => 'Beta Material Done',
            'type'  => 'material',
            'order' => 1,
        ]);

        $betaAssignmentDone = $this->createContent($betaSection, [
            'title'    => 'Beta Assignment Done',
            'type'     => 'assignment',
            'order'    => 2,
            'deadline' => now()->addDays(2),
        ]);

        $gammaSection = $this->createSection($courseGamma, 'Gamma Section', 1);

        $gammaMaterialOne = $this->createContent($gammaSection, [
            'title' => 'Gamma Material 1',
            'type'  => 'material',
            'order' => 1,
        ]);

        $deltaSection = $this->createSection($courseDelta, 'Delta Section', 1);

        $deltaMaterialOne = $this->createContent($deltaSection, [
            'title' => 'Delta Material 1',
            'type'  => 'material',
            'order' => 1,
        ]);

        $deltaMaterialTwo = $this->createContent($deltaSection, [
            'title' => 'Delta Material 2',
            'type'  => 'material',
            'order' => 2,
        ]);

        Enrollment::query()->create([
            'user_id'     => $student->id,
            'course_id'   => $courseAlpha->id,
            'status'      => FormStatus::ACTIVE->value,
            'enrolled_at' => now()->subDays(10),
        ]);
        Enrollment::query()->create([
            'user_id'     => $student->id,
            'course_id'   => $courseBeta->id,
            'status'      => FormStatus::ACTIVE->value,
            'enrolled_at' => now()->subDays(9),
        ]);
        Enrollment::query()->create([
            'user_id'     => $student->id,
            'course_id'   => $courseGamma->id,
            'status'      => FormStatus::ACTIVE->value,
            'enrolled_at' => now()->subHour(),
        ]);
        Enrollment::query()->create([
            'user_id'     => $student->id,
            'course_id'   => $courseDelta->id,
            'status'      => FormStatus::ACTIVE->value,
            'enrolled_at' => now()->subDays(3),
        ]);
        Enrollment::query()->create([
            'user_id'     => $student->id,
            'course_id'   => $coursePending->id,
            'status'      => FormStatus::PENDING->value,
            'enrolled_at' => now()->subDays(2),
        ]);
        Enrollment::query()->create([
            'user_id'     => $student->id,
            'course_id'   => $courseRejected->id,
            'status'      => FormStatus::REJECTED->value,
            'enrolled_at' => now()->subDay(),
        ]);

        UserProgress::query()->create([
            'user_id'      => $student->id,
            'content_id'   => $alphaMaterialDone->id,
            'is_completed' => true,
            'completed_at' => now()->subDays(3),
        ]);

        $alphaSubmission = Submission::query()->create([
            'user_id'      => $student->id,
            'content_id'   => $alphaAssignmentDone->id,
            'notes'        => 'alpha done',
            'status'       => 'submitted',
            'submitted_at' => now()->subDays(2),
        ]);
        $this->attachSubmissionFile($alphaSubmission, $student);

        UserProgress::query()->create([
            'user_id'      => $student->id,
            'content_id'   => $betaMaterialDone->id,
            'is_completed' => true,
            'completed_at' => now()->subDay(),
        ]);

        $betaSubmission = Submission::query()->create([
            'user_id'      => $student->id,
            'content_id'   => $betaAssignmentDone->id,
            'notes'        => 'beta done',
            'status'       => 'submitted',
            'submitted_at' => now()->subDay(),
        ]);
        $this->attachSubmissionFile($betaSubmission, $student);

        UserProgress::query()->create([
            'user_id'      => $student->id,
            'content_id'   => $deltaMaterialOne->id,
            'is_completed' => true,
            'completed_at' => now()->subMinutes(30),
        ]);

        $otherCourse = $this->createCourse($otherInstructor, 'Outside Course');

        $otherSection = $this->createSection($otherCourse, 'Outside Section', 1);

        $outsideAssignment = $this->createContent($otherSection, [
            'title'    => 'Outside Assignment',
            'type'     => 'assignment',
            'order'    => 1,
            'deadline' => now()->subHours(2),
        ]);

        Enrollment::query()->create([
            'user_id'     => $otherStudent->id,
            'course_id'   => $otherCourse->id,
            'status'      => FormStatus::ACTIVE->value,
            'enrolled_at' => now()->subMinutes(10),
        ]);

        $outsideSubmission = Submission::query()->create([
            'user_id'      => $otherStudent->id,
            'content_id'   => $outsideAssignment->id,
            'notes'        => 'outside',
            'status'       => 'submitted',
            'submitted_at' => now()->subMinutes(5),
        ]);
        $this->attachSubmissionFile($outsideSubmission, $otherStudent);

        $response = $this->actingAs($student)->get(route('student.dashboard'));
        $response->assertOk();

        /** @var array{component: string, props: array<string, mixed>} $page */
        $page = $response->viewData('page');

        $this->assertSame('Students/Dashboard', $page['component'] ?? null);

        $overview = $page['props']['overview'] ?? [];
        $this->assertSame(3, (int) ($overview['ongoingCourses'] ?? -1));
        $this->assertSame(1, (int) ($overview['completedCourses'] ?? -1));
        $this->assertSame(2, (int) ($overview['pendingVerificationCourses'] ?? -1));
        $this->assertSame(6, (int) ($overview['pendingSubmissions'] ?? -1));

        $continueLearning = $page['props']['continueLearning'] ?? [];
        $this->assertCount(3, $continueLearning);
        $this->assertSame((string) $courseDelta->id, $continueLearning[0]['id'] ?? null);
        $this->assertSame((string) $courseGamma->id, $continueLearning[1]['id'] ?? null);
        $this->assertSame((string) $courseAlpha->id, $continueLearning[2]['id'] ?? null);
        $this->assertSame('Delta Material 2', $continueLearning[0]['nextContentTitle'] ?? null);
        $this->assertSame('Gamma Material 1', $continueLearning[1]['nextContentTitle'] ?? null);
        $this->assertSame('Alpha Assignment 1', $continueLearning[2]['nextContentTitle'] ?? null);
        $this->assertNotContains((string) $courseBeta->id, array_column($continueLearning, 'id'));

        $upcomingDeadlines = $page['props']['upcomingDeadlines'] ?? [];
        $this->assertCount(5, $upcomingDeadlines);
        $this->assertSame('Alpha Assignment 1', $upcomingDeadlines[0]['contentTitle'] ?? null);
        $this->assertSame('Alpha Assignment 5', $upcomingDeadlines[4]['contentTitle'] ?? null);
        $this->assertTrue((bool) ($upcomingDeadlines[0]['isOverdue'] ?? false));
        $this->assertFalse((bool) ($upcomingDeadlines[1]['isOverdue'] ?? true));
        $this->assertNotContains('Alpha Assignment 6', array_column($upcomingDeadlines, 'contentTitle'));
        $this->assertNotContains('Outside Course', array_column($upcomingDeadlines, 'courseTitle'));

        $deadlineDates = array_column($upcomingDeadlines, 'deadlineAt');
        $sortedDates   = $deadlineDates;
        sort($sortedDates);
        $this->assertSame($sortedDates, $deadlineDates);

        $hero = $page['props']['hero'] ?? [];
        $this->assertSame(44, (int) ($hero['averageProgress'] ?? -1));
        $this->assertSame((string) $courseDelta->id, $hero['resumeCourse']['id'] ?? null);
        $this->assertSame('Course Delta', $hero['resumeCourse']['title'] ?? null);
        $this->assertSame(50, (int) ($hero['resumeCourse']['progress'] ?? -1));

        Carbon::setTestNow();
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

    private function createCourse(User $instructor, string $title): Course {
        return Course::query()->create([
            'title'          => $title,
            'description'    => "{$title} description",
            'price'          => 0,
            'discount_type'  => 'amount',
            'discount'       => 0,
            'is_published'   => true,
            'level'          => 'beginner',
            'total_hours'    => 2,
            'total_sessions' => 2,
            'created_by'     => $instructor->id,
        ]);
    }

    private function createSection(Course $course, string $title, int $order): CourseSection {
        return CourseSection::query()->create([
            'course_id' => $course->id,
            'title'     => $title,
            'order'     => $order,
        ]);
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    private function createContent(CourseSection $section, array $overrides): CourseContent {
        return CourseContent::query()->create(array_merge([
            'section_id'  => $section->id,
            'title'       => 'Content',
            'type'        => 'material',
            'description' => null,
            'deadline'    => null,
            'is_optional' => false,
            'is_required' => true,
            'order'       => 1,
        ], $overrides));
    }

    private function attachSubmissionFile(Submission $submission, User $user): void {
        $fileId = (string) Str::ulid();

        DB::table('files')->insert([
            'id'            => $fileId,
            'name'          => 'submission',
            'path'          => 'files/submission.pdf',
            'extension'     => 'pdf',
            'mime_type'     => 'application/pdf',
            'is_public'     => false,
            'created_by_id' => $user->id,
            'created_at'    => now(),
            'updated_at'    => now(),
        ]);

        DB::table('fileables')->insert([
            'file_id'       => $fileId,
            'fileable_type' => Submission::class,
            'fileable_id'   => $submission->id,
            'created_at'    => now(),
            'updated_at'    => now(),
        ]);
    }

    /**
     * @return array<int, string>
     */
    private function requiredMigrationPaths(): array {
        return [
            'database/migrations/0001_01_01_000000_create_users_table.php',
            'database/migrations/2025_01_31_135456_create_roles_table.php',
            'database/migrations/2025_01_31_152926_create_user_role_table.php',
            'database/migrations/2026_04_26_075938_create_courses_table.php',
            'database/migrations/2026_04_28_074531_create_course_sections_table.php',
            'database/migrations/2026_04_28_074547_create_course_contents_table.php',
            'database/migrations/2026_04_28_074634_create_payments_table.php',
            'database/migrations/2026_04_28_074652_create_enrollments_table.php',
            'database/migrations/2026_04_28_074710_create_user_progress_table.php',
            'database/migrations/2026_04_29_074108_create_submissions_table.php',
            'database/migrations/2026_06_08_024831_add_grade_feedback_to_submissions_table.php',
            'database/migrations/2025_01_30_134342_create_files_table.php',
            'database/migrations/2025_02_08_194506_create_fileables_table.php',
            'database/migrations/2026_06_28_164713_create_notifications_table.php',
            'database/migrations/2026_06_28_173509_add_gate_and_link_to_notifications_table.php',
            'database/migrations/2026_06_28_182100_fix_notifiable_id_type_in_notifications_table.php',
        ];
    }
}
