<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\CourseContent;
use App\Models\CourseSection;
use App\Models\User\Role;
use App\Models\User\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\Artisan;
use Tests\TestCase;

class CourseContentDeadlineTest extends TestCase {
    private Course $course;
    private CourseSection $section;

    public function test_deadline_cutoff_with_date_and_time(): void {
        $content = CourseContent::query()->create([
            'section_id'    => $this->section->id,
            'title'         => 'Assignment with time',
            'type'          => 'assignment',
            'order'         => 1,
            'deadline'      => '2026-06-20',
            'deadline_time' => '14:30',
        ]);

        $cutoff = $content->deadlineCutoff();

        $this->assertNotNull($cutoff);
        $this->assertSame('2026-06-20 14:30:00', $cutoff->format('Y-m-d H:i:s'));
    }

    public function test_deadline_cutoff_legacy_fallback_without_time(): void {
        $content = CourseContent::query()->create([
            'section_id'    => $this->section->id,
            'title'         => 'Assignment legacy',
            'type'          => 'assignment',
            'order'         => 1,
            'deadline'      => '2026-06-20 09:15:00',
            'deadline_time' => null,
        ]);

        $cutoff = $content->deadlineCutoff();

        $this->assertNotNull($cutoff);
        $this->assertSame('2026-06-20 09:15:00', $cutoff->format('Y-m-d H:i:s'));
    }

    public function test_deadline_cutoff_returns_null_when_no_deadline(): void {
        $content = CourseContent::query()->create([
            'section_id' => $this->section->id,
            'title'      => 'No deadline',
            'type'       => 'material',
            'order'      => 1,
        ]);

        $this->assertNull($content->deadlineCutoff());
    }

    public function test_has_deadline_passed_uses_cutoff(): void {
        Carbon::setTestNow('2026-06-20 15:00:00');

        $content = CourseContent::query()->create([
            'section_id'    => $this->section->id,
            'title'         => 'Passed deadline',
            'type'          => 'assignment',
            'order'         => 1,
            'deadline'      => '2026-06-20',
            'deadline_time' => '14:30',
        ]);

        $this->assertTrue($content->hasDeadlinePassed());

        $content->update(['deadline_time' => '16:00']);
        $content->refresh();
        $this->assertFalse($content->hasDeadlinePassed());

        Carbon::setTestNow();
    }

    public function test_deadline_label_uses_cutoff_format(): void {
        $content = CourseContent::query()->create([
            'section_id'    => $this->section->id,
            'title'         => 'Label test',
            'type'          => 'assignment',
            'order'         => 1,
            'deadline'      => '2026-06-20',
            'deadline_time' => '14:30',
        ]);

        $label = $content->deadlineLabel();

        $this->assertNotNull($label);
        $this->assertStringContainsString('20 Jun 2026', $label);
        $this->assertStringContainsString('14:30', $label);
    }

    public function test_deadline_label_null_when_no_deadline(): void {
        $content = CourseContent::query()->create([
            'section_id' => $this->section->id,
            'title'      => 'No deadline label',
            'type'       => 'material',
            'order'      => 1,
        ]);

        $this->assertNull($content->deadlineLabel());
    }

    public function test_instructor_can_update_deadline_date_and_time(): void {
        $instructor = User::factory()->create();
        $this->assignRole($instructor, 'instructor');

        $course = Course::query()->create([
            'title'      => 'Deadline Test Course',
            'description'=> 'desc',
            'price'      => 0,
            'level'      => 'beginner',
            'created_by' => $instructor->id,
        ]);

        $section = CourseSection::query()->create([
            'course_id' => $course->id,
            'title'     => 'Section',
            'order'     => 1,
        ]);

        $content = CourseContent::query()->create([
            'section_id' => $section->id,
            'title'      => 'Assignment',
            'type'       => 'assignment',
            'order'      => 1,
        ]);

        $response = $this->actingAs($instructor)->patch(
            route('instructor.classes.sections.contents.update', $content->id),
            [
                'deadline'      => '2026-07-01',
                'deadline_time' => '15:30',
            ],
        );

        $response->assertSessionHasNoErrors();

        $content->refresh();
        $this->assertSame('2026-07-01', $content->deadline->format('Y-m-d'));
        $this->assertSame('15:30', $content->deadline_time);
    }

    protected function setUp(): void {
        parent::setUp();

        Artisan::call('migrate:fresh', [
            '--database' => 'sqlite',
            '--path'     => $this->requiredMigrationPaths(),
            '--force'    => true,
        ]);

        $instructor = User::factory()->create();
        $this->assignRole($instructor, 'instructor');

        $this->course = Course::query()->create([
            'title'      => 'Test Course',
            'description'=> 'Test',
            'price'      => 0,
            'level'      => 'beginner',
            'created_by' => $instructor->id,
        ]);

        $this->section = CourseSection::query()->create([
            'course_id' => $this->course->id,
            'title'     => 'Test Section',
            'order'     => 1,
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
            'database/migrations/2026_04_28_074531_create_course_sections_table.php',
            'database/migrations/2026_04_28_074547_create_course_contents_table.php',
            'database/migrations/2026_06_17_143845_add_deadline_time_to_course_contents_table.php',
        ];
    }
}
