<?php

namespace Tests\Feature\Student;

use App\Models\Course;
use App\Models\CourseContent;
use App\Models\CourseSection;
use App\Models\Enrollment;
use App\Models\Submission;
use App\Models\User\Role;
use App\Models\User\User;
use App\Models\UserProgress;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class CourseListPageTest extends TestCase {
    public function test_my_courses_progress_uses_shared_completion_rules(): void {
        $instructor = User::factory()->create();
        $student    = User::factory()->create();

        $this->assignRole($instructor, 'instructor');
        $this->assignRole($student, 'student');

        $course = Course::query()->create([
            'title'          => 'Shared Progress Course',
            'description'    => 'Course description',
            'price'          => 0,
            'level'          => 'beginner',
            'total_hours'    => 3,
            'total_sessions' => 3,
            'created_by'     => $instructor->id,
        ]);

        $section = CourseSection::query()->create([
            'course_id' => $course->id,
            'title'     => 'Module A',
            'order'     => 1,
        ]);

        $material = CourseContent::query()->create([
            'section_id' => $section->id,
            'title'      => 'Material A',
            'type'       => 'material',
            'order'      => 1,
        ]);

        $assignment = CourseContent::query()->create([
            'section_id' => $section->id,
            'title'      => 'Assignment A',
            'type'       => 'assignment',
            'order'      => 2,
        ]);

        $preAssessment = CourseContent::query()->create([
            'section_id' => $section->id,
            'title'      => 'Pre Assessment A',
            'type'       => 'pre_assessment',
            'order'      => 3,
        ]);

        Enrollment::query()->create([
            'user_id'     => $student->id,
            'course_id'   => $course->id,
            'enrolled_at' => now()->subDays(7),
        ]);

        UserProgress::query()->create([
            'user_id'      => $student->id,
            'content_id'   => $material->id,
            'is_completed' => true,
            'completed_at' => now()->subDays(5),
        ]);

        $validSubmission = Submission::query()->create([
            'user_id'      => $student->id,
            'content_id'   => $assignment->id,
            'notes'        => 'valid',
            'status'       => 'submitted',
            'submitted_at' => now()->subDays(3),
        ]);

        $fileId = (string) Str::ulid();
        DB::table('files')->insert([
            'id'            => $fileId,
            'name'          => 'assignment',
            'path'          => 'files/assignment.pdf',
            'extension'     => 'pdf',
            'mime_type'     => 'application/pdf',
            'is_public'     => false,
            'created_by_id' => $student->id,
            'created_at'    => now(),
            'updated_at'    => now(),
        ]);

        DB::table('fileables')->insert([
            'file_id'       => $fileId,
            'fileable_type' => Submission::class,
            'fileable_id'   => $validSubmission->id,
            'created_at'    => now(),
            'updated_at'    => now(),
        ]);

        // Submission without file should not be counted as completed.
        Submission::query()->create([
            'user_id'      => $student->id,
            'content_id'   => $preAssessment->id,
            'notes'        => 'no file',
            'status'       => 'submitted',
            'submitted_at' => now()->subDays(2),
        ]);

        $response = $this->actingAs($student)
            ->get(route('student.courses.index'));

        $response->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Students/MyCourses')
                ->has('courses', 1));

        /** @var array{props: array{courses: array<int, array<string, mixed>>}} $page */
        $page = $response->viewData('page');

        $coursePayload = $page['props']['courses'][0];

        $this->assertSame(67, $coursePayload['progress']);

        $contents = collect($coursePayload['sections'][0]['contents'])->keyBy('id');
        $this->assertTrue($contents[$material->id]['is_completed']);
        $this->assertTrue($contents[$assignment->id]['is_completed']);
        $this->assertFalse($contents[$preAssessment->id]['is_completed']);
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
            'database/migrations/2026_06_08_024831_add_grade_feedback_to_submissions_table.php',
            'database/migrations/2025_01_30_134342_create_files_table.php',
            'database/migrations/2025_02_08_194506_create_fileables_table.php',
        ];
    }
}
