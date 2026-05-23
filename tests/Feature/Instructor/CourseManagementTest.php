<?php

namespace Tests\Feature\Instructor;

use App\Models\Category;
use App\Models\Course;
use App\Models\User\Role;
use App\Models\User\User;
use Illuminate\Support\Facades\Artisan;
use Tests\TestCase;

class CourseManagementTest extends TestCase {
    public function test_instructor_can_create_course_with_discount_and_without_sections_when_total_sessions_is_empty(): void {
        $instructor = User::factory()->create();
        $this->assignRole($instructor, 'instructor');

        $category = Category::query()->create([
            'name' => 'Project Management',
            'slug' => 'project-management',
        ]);

        $response = $this->actingAs($instructor)->post(route('instructor.classes.store'), [
            'title'            => 'Course Tanpa Section',
            'description'      => 'Course description',
            'price'            => 500000,
            'discount_type'    => 'amount',
            'discount'         => 125000,
            'level'            => 'beginner',
            'category'         => $category->slug,
            'total_hours'      => 8,
            'total_sessions'   => '',
            'certificate_type' => 'attendance',
            'sections'         => [],
        ]);
        $response->assertSessionHasNoErrors();

        $location = (string) $response->headers->get('Location');
        $this->assertStringContainsString('/instructor/classes/', $location);

        $coursePath = (string) parse_url($location, PHP_URL_PATH);
        $courseId   = (string) basename($coursePath);
        $course     = Course::query()->findOrFail($courseId);

        $response->assertRedirect(route('instructor.classes.show', $courseId));

        $this->assertDatabaseHas('courses', [
            'id'             => $course->id,
            'discount'       => 125000,
            'total_sessions' => 0,
        ]);
        $this->assertDatabaseCount('course_sections', 0);
        $this->assertTrue(
            $course->categories()->whereKey($category->id)->exists(),
        );
    }

    public function test_instructor_can_update_course_discount(): void {
        $instructor = User::factory()->create();
        $this->assignRole($instructor, 'instructor');

        $category = Category::query()->create([
            'name' => 'BIM',
            'slug' => 'bim',
        ]);

        $course = Course::query()->create([
            'title'          => 'Course Lama',
            'description'    => 'Old description',
            'price'          => 600000,
            'discount'       => 0,
            'level'          => 'intermediate',
            'total_hours'    => 10,
            'total_sessions' => 4,
            'created_by'     => $instructor->id,
        ]);
        $course->categories()->attach($category->id);

        $response = $this->actingAs($instructor)->patch(route('instructor.classes.update', $course->id), [
            'title'            => 'Course Lama',
            'description'      => 'Old description',
            'price'            => 600000,
            'discount_type'    => 'amount',
            'discount'         => 100000,
            'level'            => 'intermediate',
            'category'         => $category->slug,
            'total_hours'      => 10,
            'total_sessions'   => 4,
            'certificate_type' => 'professional',
        ]);
        $response->assertSessionHasNoErrors();

        $response->assertRedirect(route('instructor.classes.show', $course->id));

        $this->assertDatabaseHas('courses', [
            'id'       => $course->id,
            'discount' => 100000,
        ]);
    }

    public function test_store_rejects_discount_percentage_above_100(): void {
        $instructor = User::factory()->create();
        $this->assignRole($instructor, 'instructor');

        $category = Category::query()->create([
            'name' => 'Category 1',
            'slug' => 'category-1',
        ]);

        $response = $this->actingAs($instructor)->post(route('instructor.classes.store'), [
            'title'            => 'Course Invalid Percentage',
            'description'      => 'Course description',
            'price'            => 500000,
            'discount_type'    => 'percentage',
            'discount'         => 120,
            'level'            => 'beginner',
            'category'         => $category->slug,
            'total_hours'      => 8,
            'total_sessions'   => 2,
            'certificate_type' => 'attendance',
        ]);

        $response->assertSessionHasErrors(['discount']);
    }

    public function test_update_rejects_discount_amount_above_price(): void {
        $instructor = User::factory()->create();
        $this->assignRole($instructor, 'instructor');

        $category = Category::query()->create([
            'name' => 'Category 2',
            'slug' => 'category-2',
        ]);

        $course = Course::query()->create([
            'title'          => 'Course Update Invalid',
            'description'    => 'Old description',
            'price'          => 600000,
            'discount_type'  => 'amount',
            'discount'       => 0,
            'level'          => 'intermediate',
            'total_hours'    => 10,
            'total_sessions' => 4,
            'created_by'     => $instructor->id,
        ]);
        $course->categories()->attach($category->id);

        $response = $this->actingAs($instructor)->patch(route('instructor.classes.update', $course->id), [
            'title'            => 'Course Update Invalid',
            'description'      => 'Old description',
            'price'            => 600000,
            'discount_type'    => 'amount',
            'discount'         => 700000,
            'level'            => 'intermediate',
            'category'         => $category->slug,
            'total_hours'      => 10,
            'total_sessions'   => 4,
            'certificate_type' => 'professional',
        ]);

        $response->assertSessionHasErrors(['discount']);
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
        ];
    }
}
