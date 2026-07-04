<?php

namespace Tests\Feature;

use App\Models\Category;
use Database\Seeders\CategorySeeder;
use Database\Seeders\CourseSeeder;
use Database\Seeders\RoleSeeder;
use Database\Seeders\UserSeeder;
use Illuminate\Support\Facades\Artisan;
use Tests\TestCase;

class CourseSeederCoverageTest extends TestCase {
    public function test_course_seeder_creates_one_or_two_courses_for_each_category(): void {
        $this->seed(RoleSeeder::class);
        $this->seed(UserSeeder::class);
        $this->seed(CategorySeeder::class);
        $this->seed(CourseSeeder::class);

        $categories = Category::query()
            ->withCount('courses')
            ->orderBy('name')
            ->get();

        $this->assertGreaterThan(0, $categories->count());

        foreach ($categories as $category) {
            $this->assertContains((int) $category->courses_count, [1, 2]);
        }

        $this->assertTrue(
            $categories->contains(fn (Category $category) => (int) $category->courses_count === 1),
        );
        $this->assertTrue(
            $categories->contains(fn (Category $category) => (int) $category->courses_count === 2),
        );
    }

    protected function setUp(): void {
        parent::setUp();

        Artisan::call('migrate:fresh', [
            '--database' => 'sqlite',
            '--path'     => [
                'database/migrations/0001_01_01_000000_create_users_table.php',
                'database/migrations/2025_01_31_135456_create_roles_table.php',
                'database/migrations/2025_01_31_152926_create_user_role_table.php',
                'database/migrations/2026_04_26_075938_create_courses_table.php',
                'database/migrations/2026_04_26_075939_create_categories_table.php',
                'database/migrations/2026_04_28_074544_create_course_category_table.php',
                'database/migrations/2026_04_28_074531_create_course_sections_table.php',
                'database/migrations/2026_04_28_074547_create_course_contents_table.php',
                'database/migrations/2026_05_01_060519_create_student_profiles_table.php',
                'database/migrations/2026_05_01_060520_create_instructor_profiles_table.php',
            ],
            '--force' => true,
        ]);
    }
}
