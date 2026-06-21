<?php

namespace Tests\Feature\Student;

use App\Models\Course;
use App\Models\CourseContent;
use App\Models\CourseSection;
use App\Models\Enrollment;
use App\Models\User\Role;
use App\Models\User\User;
use App\Models\UserProgress;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Str;
use Tests\TestCase;

class ProgressTest extends TestCase {
    public function test_student_can_mark_material_as_completed(): void {
        $instructor = User::factory()->create();
        $student    = User::factory()->create();
        $this->assignRole($instructor, 'instructor');
        $this->assignRole($student, 'student');

        $course  = $this->createCourse($instructor);
        $section = $this->createSection($course);
        $content = $this->createContent($section, 'material');

        Enrollment::query()->create([
            'user_id'   => $student->id,
            'course_id' => $course->id,
            'status'    => 'active',
        ]);

        $response = $this->actingAs($student)->post(
            route('student.progress.store', ['content' => $content->id])
        );

        $response->assertRedirect();

        $this->assertDatabaseHas('user_progress', [
            'user_id'      => $student->id,
            'content_id'   => $content->id,
            'is_completed' => true,
        ]);
    }

    public function test_marking_same_material_twice_does_not_create_duplicate(): void {
        $instructor = User::factory()->create();
        $student    = User::factory()->create();
        $this->assignRole($instructor, 'instructor');
        $this->assignRole($student, 'student');

        $course  = $this->createCourse($instructor);
        $section = $this->createSection($course);
        $content = $this->createContent($section, 'material');

        Enrollment::query()->create([
            'user_id'   => $student->id,
            'course_id' => $course->id,
            'status'    => 'active',
        ]);

        $this->actingAs($student)->post(
            route('student.progress.store', ['content' => $content->id])
        );

        $this->actingAs($student)->post(
            route('student.progress.store', ['content' => $content->id])
        );

        $count = UserProgress::query()
            ->where('user_id', $student->id)
            ->where('content_id', $content->id)
            ->count();

        $this->assertSame(1, $count);
    }

    public function test_marking_non_material_content_returns_403(): void {
        $instructor = User::factory()->create();
        $student    = User::factory()->create();
        $this->assignRole($instructor, 'instructor');
        $this->assignRole($student, 'student');

        $course  = $this->createCourse($instructor);
        $section = $this->createSection($course);
        $content = $this->createContent($section, 'assignment');

        Enrollment::query()->create([
            'user_id'   => $student->id,
            'course_id' => $course->id,
            'status'    => 'active',
        ]);

        $response = $this->actingAs($student)->post(
            route('student.progress.store', ['content' => $content->id])
        );

        $response->assertForbidden();

        $this->assertDatabaseMissing('user_progress', [
            'user_id'    => $student->id,
            'content_id' => $content->id,
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
            'title'     => 'Section 1',
            'order'     => 1,
        ]);
    }

    private function createContent(CourseSection $section, string $type): CourseContent {
        return CourseContent::query()->create([
            'section_id'  => $section->id,
            'title'       => 'Content ' . Str::random(4),
            'type'        => $type,
            'order'       => 1,
            'is_optional' => false,
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
            'database/migrations/2026_04_28_074710_create_user_progress_table.php',
            'database/migrations/2026_05_22_134117_add_status_to_enrollments_table.php',
            'database/migrations/2026_05_22_134117_add_rejection_reason_to_payments_table.php',
            'database/migrations/2026_06_07_182309_add_url_to_course_contents_table.php',
            'database/migrations/2026_06_17_143845_add_deadline_time_to_course_contents_table.php',
        ];
    }
}
