<?php

namespace Tests\Feature\Instructor;

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

class StudentManagementPageTest extends TestCase {
    public function test_instructor_students_page_uses_database_data_and_shared_progress_rules(): void {
        Carbon::setTestNow(Carbon::parse('2026-05-17 10:00:00'));

        $instructor = User::factory()->create();
        $this->assignRole($instructor, 'instructor');

        $pendingStudent   = User::factory()->create(['name' => 'Pending Student']);
        $activeStudent    = User::factory()->create(['name' => 'Active Student']);
        $completedStudent = User::factory()->create(['name' => 'Completed Student']);

        $this->assignRole($pendingStudent, 'student');
        $this->assignRole($activeStudent, 'student');
        $this->assignRole($completedStudent, 'student');

        [$pendingCourse, $pendingMaterial, $pendingAssignment]       = $this->createCourseBundle($instructor, 'Course Pending');
        [$activeCourse, $activeMaterial, $activeAssignment]          = $this->createCourseBundle($instructor, 'Course Active');
        [$completedCourse, $completedMaterial, $completedAssignment] = $this->createCourseBundle($instructor, 'Course Completed');

        Enrollment::query()->create([
            'user_id'     => $pendingStudent->id,
            'course_id'   => $pendingCourse->id,
            'enrolled_at' => now()->subDays(5),
        ]);

        Enrollment::query()->create([
            'user_id'     => $activeStudent->id,
            'course_id'   => $activeCourse->id,
            'enrolled_at' => now()->subDays(4),
        ]);

        Enrollment::query()->create([
            'user_id'     => $completedStudent->id,
            'course_id'   => $completedCourse->id,
            'enrolled_at' => now()->subDays(3),
        ]);

        UserProgress::query()->create([
            'user_id'      => $activeStudent->id,
            'content_id'   => $activeMaterial->id,
            'is_completed' => true,
            'completed_at' => now()->subDays(2),
        ]);

        UserProgress::query()->create([
            'user_id'      => $completedStudent->id,
            'content_id'   => $completedMaterial->id,
            'is_completed' => true,
            'completed_at' => now()->subDays(2),
        ]);

        $this->createValidSubmission(
            $completedStudent,
            $completedAssignment,
            now()->subDay(),
        );

        $response = $this->actingAs($instructor)
            ->get(route('instructor.students'));

        $response->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Instructors/StudentManagement')
                ->has('students', 3)
                ->where('courses.0', 'All Courses'));

        /** @var array{props: array{students: array<int, array<string, mixed>>, courses: array<int, string>}} $page */
        $page = $response->viewData('page');

        $students = collect($page['props']['students'])->keyBy('course');

        $this->assertSame(0, $students['Course Pending']['progress']);
        $this->assertSame('PENDING', $students['Course Pending']['status']);
        $this->assertFalse($students['Course Pending']['modules'][0]['done']);

        $this->assertSame(50, $students['Course Active']['progress']);
        $this->assertSame('ACTIVE', $students['Course Active']['status']);
        $this->assertFalse($students['Course Active']['modules'][0]['done']);

        $this->assertSame(100, $students['Course Completed']['progress']);
        $this->assertSame('COMPLETED', $students['Course Completed']['status']);
        $this->assertTrue($students['Course Completed']['modules'][0]['done']);
        $this->assertNotEmpty($students['Course Completed']['lastActive']);
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

    /**
     * @return array{Course, CourseContent, CourseContent}
     */
    private function createCourseBundle(User $instructor, string $title): array {
        $course = Course::query()->create([
            'title'          => $title,
            'description'    => "{$title} description",
            'price'          => 0,
            'level'          => 'beginner',
            'total_hours'    => 2,
            'total_sessions' => 2,
            'created_by'     => $instructor->id,
        ]);

        $section = CourseSection::query()->create([
            'course_id' => $course->id,
            'title'     => "{$title} Module",
            'order'     => 1,
        ]);

        $material = CourseContent::query()->create([
            'section_id' => $section->id,
            'title'      => "{$title} Material",
            'type'       => 'material',
            'order'      => 1,
        ]);

        $assignment = CourseContent::query()->create([
            'section_id' => $section->id,
            'title'      => "{$title} Assignment",
            'type'       => 'assignment',
            'order'      => 2,
        ]);

        return [$course, $material, $assignment];
    }

    private function createValidSubmission(User $user, CourseContent $content, Carbon $submittedAt): void {
        $submission = Submission::query()->create([
            'user_id'      => $user->id,
            'content_id'   => $content->id,
            'notes'        => 'Submitted',
            'status'       => 'submitted',
            'submitted_at' => $submittedAt,
        ]);

        $fileId = (string) Str::ulid();
        DB::table('files')->insert([
            'id'            => $fileId,
            'name'          => 'answer',
            'path'          => 'files/answer.pdf',
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
            'database/migrations/2026_04_26_075939_create_categories_table.php',
            'database/migrations/2026_04_28_074544_create_course_category_table.php',
            'database/migrations/2026_04_28_074531_create_course_sections_table.php',
            'database/migrations/2026_04_28_074547_create_course_contents_table.php',
            'database/migrations/2026_04_28_074634_create_payments_table.php',
            'database/migrations/2026_04_28_074652_create_enrollments_table.php',
            'database/migrations/2026_04_28_074710_create_user_progress_table.php',
            'database/migrations/2026_04_29_074108_create_submissions_table.php',
            'database/migrations/2025_01_30_134342_create_files_table.php',
            'database/migrations/2025_02_08_194506_create_fileables_table.php',
        ];
    }
}
