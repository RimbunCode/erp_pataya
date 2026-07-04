<?php

namespace Tests\Feature\Student;

use App\Models\Core\Fileable;
use App\Models\Course;
use App\Models\CourseContent;
use App\Models\CourseSection;
use App\Models\Enrollment;
use App\Models\Submission;
use App\Models\User\Role;
use App\Models\User\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

class SubmissionTest extends TestCase {
    public function test_student_can_submit_assignment_with_uploaded_file(): void {
        Storage::fake('local');
        // Add TreeView columns required by File model observer
        \Illuminate\Support\Facades\Schema::table('files', function (\Illuminate\Database\Schema\Blueprint $table) {
            if (! \Illuminate\Support\Facades\Schema::hasColumn('files', 'lft')) {
                $table->unsignedInteger('lft')->default(0);
                $table->unsignedInteger('rgt')->default(0);
                $table->unsignedInteger('depth')->default(0);
            }
        });

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
            route('student.submissions.store', ['content' => $content->id]),
            [
                'notes' => 'Tugas saya',
                'files' => [UploadedFile::fake()->create('tugas.pdf', 100, 'application/pdf')],
            ]
        );

        $response->assertRedirect();
        $response->assertSessionHasNoErrors();

        $this->assertDatabaseHas('submissions', [
            'user_id'    => $student->id,
            'content_id' => $content->id,
            'status'     => 'submitted',
            'notes'      => 'Tugas saya',
        ]);
    }

    public function test_student_can_submit_assignment_with_existing_file_id(): void {
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

        $fileId = $this->insertFile($student->id, 'existing-file', 'files/existing.pdf');

        $response = $this->actingAs($student)->post(
            route('student.submissions.store', ['content' => $content->id]),
            [
                'notes'   => 'Menggunakan file yang ada',
                'filesId' => [$fileId],
            ]
        );

        $response->assertRedirect();
        $response->assertSessionHasNoErrors();

        $this->assertDatabaseHas('submissions', [
            'user_id'    => $student->id,
            'content_id' => $content->id,
            'status'     => 'submitted',
        ]);

        $submission = Submission::query()
            ->where('user_id', $student->id)
            ->where('content_id', $content->id)
            ->first();

        $this->assertNotNull($submission);
        $this->assertDatabaseHas('fileables', [
            'file_id'       => $fileId,
            'fileable_id'   => (string) $submission->id,
            'fileable_type' => Submission::class,
        ]);
    }

    public function test_student_cannot_submit_to_non_submission_content_type(): void {
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
            route('student.submissions.store', ['content' => $content->id]),
            ['notes' => 'coba submit']
        );

        $response->assertStatus(422);
        $this->assertDatabaseMissing('submissions', [
            'user_id'    => $student->id,
            'content_id' => $content->id,
        ]);
    }

    public function test_student_cannot_submit_after_deadline_has_passed(): void {
        $instructor = User::factory()->create();
        $student    = User::factory()->create();
        $this->assignRole($instructor, 'instructor');
        $this->assignRole($student, 'student');

        $course  = $this->createCourse($instructor);
        $section = $this->createSection($course);
        $content = $this->createContent($section, 'assignment', deadline: now()->subDay());

        Enrollment::query()->create([
            'user_id'   => $student->id,
            'course_id' => $course->id,
            'status'    => 'active',
        ]);

        $response = $this->actingAs($student)->post(
            route('student.submissions.store', ['content' => $content->id]),
            ['notes' => 'terlambat']
        );

        $response->assertRedirect();
        $response->assertSessionHasErrors('submission');

        $this->assertDatabaseMissing('submissions', [
            'user_id'    => $student->id,
            'content_id' => $content->id,
        ]);
    }

    public function test_student_can_delete_submission_file_and_submission_deleted_when_last_file_removed(): void {
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

        $submission = Submission::query()->create([
            'user_id'      => $student->id,
            'content_id'   => $content->id,
            'status'       => 'submitted',
            'submitted_at' => now(),
        ]);

        $fileId = $this->insertFile($student->id, 'tugas-file', 'files/tugas.pdf');

        Fileable::query()->create([
            'file_id'       => $fileId,
            'fileable_id'   => $submission->id,
            'fileable_type' => Submission::class,
        ]);

        $response = $this->actingAs($student)->delete(
            route('student.submissions.files.destroy', ['content' => $content->id, 'file' => $fileId])
        );

        $response->assertRedirect();
        $response->assertSessionHasNoErrors();

        $this->assertDatabaseMissing('fileables', [
            'file_id'     => $fileId,
            'fileable_id' => (string) $submission->id,
        ]);

        $this->assertDatabaseMissing('submissions', [
            'id' => (string) $submission->id,
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

    private function insertFile(string $userId, string $name, string $path): string {
        $id = (string) Str::ulid();
        DB::table('files')->insert([
            'id'            => $id,
            'name'          => $name,
            'path'          => $path,
            'extension'     => 'pdf',
            'mime_type'     => 'application/pdf',
            'is_public'     => 0,
            'created_by_id' => $userId,
            'created_at'    => now(),
            'updated_at'    => now(),
        ]);

        return $id;
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

    private function createContent(CourseSection $section, string $type, ?\DateTimeInterface $deadline = null): CourseContent {
        return CourseContent::query()->create([
            'section_id'  => $section->id,
            'title'       => 'Content ' . Str::random(4),
            'type'        => $type,
            'order'       => 1,
            'is_optional' => false,
            'deadline'    => $deadline,
        ]);
    }

    /**
     * @return array<int, string>
     */
    private function requiredMigrationPaths(): array {
        return [
            'database/migrations/0001_01_01_000000_create_users_table.php',
            'database/migrations/0001_01_01_000000_create_preferences_table.php',
            'database/migrations/2025_01_30_134342_create_files_table.php',
            'database/migrations/2025_02_08_194506_create_fileables_table.php',
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
