<?php

namespace Tests\Feature\Instructor;

use App\Models\Core\Fileable;
use App\Models\Course;
use App\Models\CourseContent;
use App\Models\CourseSection;
use App\Models\User\Role;
use App\Models\User\User;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class CourseSectionContentTest extends TestCase {
    // ── Section Tests ─────────────────────────────────────────────────────────

    public function test_instructor_can_create_section_for_own_course(): void {
        $instructor = User::factory()->create();
        $this->assignRole($instructor, 'instructor');

        $course = $this->createCourse($instructor);

        $response = $this->actingAs($instructor)->post(
            route('instructor.classes.sections.store', ['course' => $course->id]),
            ['title' => 'Bab 1: Pendahuluan']
        );

        $response->assertRedirect();
        $response->assertSessionHasNoErrors();

        $this->assertDatabaseHas('course_sections', [
            'course_id' => $course->id,
            'title'     => 'Bab 1: Pendahuluan',
        ]);
    }

    public function test_instructor_cannot_create_section_for_another_instructor_course(): void {
        $instructor1 = User::factory()->create();
        $instructor2 = User::factory()->create();
        $this->assignRole($instructor1, 'instructor');
        $this->assignRole($instructor2, 'instructor');

        $course = $this->createCourse($instructor1);

        $response = $this->actingAs($instructor2)->post(
            route('instructor.classes.sections.store', ['course' => $course->id]),
            ['title' => 'Section Tidak Sah']
        );

        $response->assertForbidden();

        $this->assertDatabaseMissing('course_sections', [
            'course_id' => $course->id,
            'title'     => 'Section Tidak Sah',
        ]);
    }

    public function test_instructor_can_update_section(): void {
        $instructor = User::factory()->create();
        $this->assignRole($instructor, 'instructor');

        $course  = $this->createCourse($instructor);
        $section = $this->createSection($course);

        $response = $this->actingAs($instructor)->patch(
            route('instructor.classes.sections.update', ['section' => $section->id]),
            ['title' => 'Judul Diperbarui']
        );

        $response->assertRedirect();
        $response->assertSessionHasNoErrors();

        $this->assertDatabaseHas('course_sections', [
            'id'    => $section->id,
            'title' => 'Judul Diperbarui',
        ]);
    }

    public function test_instructor_cannot_update_another_instructor_section(): void {
        $instructor1 = User::factory()->create();
        $instructor2 = User::factory()->create();
        $this->assignRole($instructor1, 'instructor');
        $this->assignRole($instructor2, 'instructor');

        $course  = $this->createCourse($instructor1);
        $section = $this->createSection($course);

        $response = $this->actingAs($instructor2)->patch(
            route('instructor.classes.sections.update', ['section' => $section->id]),
            ['title' => 'Diubah Ilegal']
        );

        $response->assertForbidden();

        $this->assertDatabaseMissing('course_sections', [
            'id'    => $section->id,
            'title' => 'Diubah Ilegal',
        ]);
    }

    public function test_instructor_can_delete_section(): void {
        $instructor = User::factory()->create();
        $this->assignRole($instructor, 'instructor');

        $course  = $this->createCourse($instructor);
        $section = $this->createSection($course);

        $response = $this->actingAs($instructor)->delete(
            route('instructor.classes.sections.destroy', ['section' => $section->id])
        );

        $response->assertRedirect();
        $response->assertSessionHasNoErrors();

        $this->assertDatabaseMissing('course_sections', [
            'id' => $section->id,
        ]);
    }

    // ── Content Tests ─────────────────────────────────────────────────────────

    public function test_instructor_can_create_content_in_own_section(): void {
        $instructor = User::factory()->create();
        $this->assignRole($instructor, 'instructor');

        $course  = $this->createCourse($instructor);
        $section = $this->createSection($course);

        $response = $this->actingAs($instructor)->post(
            route('instructor.classes.sections.contents.store', ['section' => $section->id]),
            [
                'title' => 'Materi 1',
                'type'  => 'material',
            ]
        );

        $response->assertRedirect();
        $response->assertSessionHasNoErrors();

        $this->assertDatabaseHas('course_contents', [
            'section_id' => $section->id,
            'title'      => 'Materi 1',
            'type'       => 'material',
        ]);
    }

    public function test_instructor_cannot_create_content_in_another_instructor_section(): void {
        $instructor1 = User::factory()->create();
        $instructor2 = User::factory()->create();
        $this->assignRole($instructor1, 'instructor');
        $this->assignRole($instructor2, 'instructor');

        $course  = $this->createCourse($instructor1);
        $section = $this->createSection($course);

        $response = $this->actingAs($instructor2)->post(
            route('instructor.classes.sections.contents.store', ['section' => $section->id]),
            [
                'title' => 'Konten Tidak Sah',
                'type'  => 'material',
            ]
        );

        $response->assertForbidden();
    }

    public function test_instructor_can_update_content(): void {
        $instructor = User::factory()->create();
        $this->assignRole($instructor, 'instructor');

        $course   = $this->createCourse($instructor);
        $section  = $this->createSection($course);
        $content  = $this->createContent($section, 'material');

        $response = $this->actingAs($instructor)->patch(
            route('instructor.classes.sections.contents.update', ['content' => $content->id]),
            [
                'title'       => 'Judul Konten Baru',
                'description' => 'Deskripsi diperbarui',
            ]
        );

        $response->assertRedirect();
        $response->assertSessionHasNoErrors();

        $this->assertDatabaseHas('course_contents', [
            'id'          => $content->id,
            'title'       => 'Judul Konten Baru',
            'description' => 'Deskripsi diperbarui',
        ]);
    }

    public function test_instructor_can_delete_content(): void {
        $instructor = User::factory()->create();
        $this->assignRole($instructor, 'instructor');

        $course  = $this->createCourse($instructor);
        $section = $this->createSection($course);
        $content = $this->createContent($section, 'assignment');

        $response = $this->actingAs($instructor)->delete(
            route('instructor.classes.sections.contents.destroy', ['content' => $content->id])
        );

        $response->assertRedirect();
        $response->assertSessionHasNoErrors();

        $this->assertDatabaseMissing('course_contents', [
            'id' => $content->id,
        ]);
    }

    public function test_instructor_can_link_existing_file_to_content(): void {
        $instructor = User::factory()->create();
        $this->assignRole($instructor, 'instructor');

        $course  = $this->createCourse($instructor);
        $section = $this->createSection($course);
        $content = $this->createContent($section, 'material');

        $fileId = $this->insertFile($instructor->id, 'materi-link', 'files/materi-link.pdf');

        $response = $this->actingAs($instructor)->post(
            route('instructor.classes.sections.contents.upload', ['content' => $content->id]),
            ['filesId' => [$fileId]]
        );

        $response->assertRedirect();
        $response->assertSessionHasNoErrors();

        $this->assertSame(1, Fileable::query()
            ->where('fileable_id', $content->id)
            ->where('fileable_type', CourseContent::class)
            ->count());
    }

    public function test_instructor_can_remove_file_from_content(): void {
        $instructor = User::factory()->create();
        $this->assignRole($instructor, 'instructor');

        $course  = $this->createCourse($instructor);
        $section = $this->createSection($course);
        $content = $this->createContent($section, 'material');

        $fileId = $this->insertFile($instructor->id, 'materi-file', 'files/materi.pdf');

        Fileable::query()->create([
            'file_id'       => $fileId,
            'fileable_id'   => $content->id,
            'fileable_type' => CourseContent::class,
        ]);

        $response = $this->actingAs($instructor)->delete(
            route('instructor.classes.sections.contents.files.destroy', [
                'content' => $content->id,
                'file'    => $fileId,
            ])
        );

        $response->assertRedirect();
        $response->assertSessionHasNoErrors();

        $this->assertDatabaseMissing('fileables', [
            'file_id'     => $fileId,
            'fileable_id' => (string) $content->id,
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
            'title'     => 'Section Test',
            'order'     => 1,
        ]);
    }

    private function createContent(CourseSection $section, string $type): CourseContent {
        return CourseContent::query()->create([
            'section_id'  => $section->id,
            'title'       => 'Content Test',
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
            'database/migrations/2025_01_30_134342_create_files_table.php',
            'database/migrations/2025_02_08_194506_create_fileables_table.php',
            'database/migrations/2025_01_31_135456_create_roles_table.php',
            'database/migrations/2025_01_31_150339_create_permissions_table.php',
            'database/migrations/2025_01_31_152926_create_user_role_table.php',
            'database/migrations/2026_04_26_075938_create_courses_table.php',
            'database/migrations/2026_04_26_075939_create_categories_table.php',
            'database/migrations/2026_04_28_074544_create_course_category_table.php',
            'database/migrations/2026_04_28_074531_create_course_sections_table.php',
            'database/migrations/2026_04_28_074547_create_course_contents_table.php',
            'database/migrations/2026_04_28_074548_create_course_content_files_table.php',
            'database/migrations/2026_06_07_182309_add_url_to_course_contents_table.php',
            'database/migrations/2026_06_17_143845_add_deadline_time_to_course_contents_table.php',
        ];
    }
}
