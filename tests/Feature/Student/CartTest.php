<?php

namespace Tests\Feature\Student;

use App\Models\Cart;
use App\Models\Course;
use App\Models\User\Role;
use App\Models\User\User;
use Illuminate\Support\Facades\Artisan;
use Tests\TestCase;

class CartTest extends TestCase {
    public function test_student_can_add_course_to_cart(): void {
        $instructor = User::factory()->create();
        $student    = User::factory()->create();
        $this->assignRole($instructor, 'instructor');
        $this->assignRole($student, 'student');

        $course = $this->createCourse($instructor);

        $response = $this->actingAs($student)->post(route('student.cart.store'), [
            'course_id' => (string) $course->id,
        ]);

        $response->assertRedirect();
        $response->assertSessionHasNoErrors();

        $this->assertDatabaseHas('carts', [
            'user_id'   => $student->id,
            'course_id' => $course->id,
        ]);
    }

    public function test_adding_same_course_to_cart_does_not_create_duplicate(): void {
        $instructor = User::factory()->create();
        $student    = User::factory()->create();
        $this->assignRole($instructor, 'instructor');
        $this->assignRole($student, 'student');

        $course = $this->createCourse($instructor);

        $this->actingAs($student)->post(route('student.cart.store'), [
            'course_id' => (string) $course->id,
        ]);

        $this->actingAs($student)->post(route('student.cart.store'), [
            'course_id' => (string) $course->id,
        ]);

        $count = Cart::query()
            ->where('user_id', $student->id)
            ->where('course_id', $course->id)
            ->count();

        $this->assertSame(1, $count);
    }

    public function test_student_can_remove_course_from_cart(): void {
        $instructor = User::factory()->create();
        $student    = User::factory()->create();
        $this->assignRole($instructor, 'instructor');
        $this->assignRole($student, 'student');

        $course = $this->createCourse($instructor);

        Cart::query()->create([
            'user_id'   => $student->id,
            'course_id' => $course->id,
        ]);

        $this->assertDatabaseHas('carts', [
            'user_id'   => $student->id,
            'course_id' => $course->id,
        ]);

        $response = $this->actingAs($student)->delete(
            route('student.cart.destroy', ['courseId' => (string) $course->id])
        );

        $response->assertRedirect();

        $this->assertDatabaseMissing('carts', [
            'user_id'   => $student->id,
            'course_id' => $course->id,
        ]);
    }

    public function test_removing_course_not_in_cart_does_nothing(): void {
        $instructor = User::factory()->create();
        $student    = User::factory()->create();
        $this->assignRole($instructor, 'instructor');
        $this->assignRole($student, 'student');

        $course = $this->createCourse($instructor);

        $response = $this->actingAs($student)->delete(
            route('student.cart.destroy', ['courseId' => (string) $course->id])
        );

        $response->assertRedirect();

        $this->assertSame(0, Cart::query()->where('user_id', $student->id)->count());
    }

    public function test_unauthenticated_user_cannot_add_to_cart(): void {
        $instructor = User::factory()->create();
        $this->assignRole($instructor, 'instructor');

        $course = $this->createCourse($instructor);

        $response = $this->post(route('student.cart.store'), [
            'course_id' => (string) $course->id,
        ]);

        $response->assertRedirect(route('guest.home'));
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
            'database/migrations/2026_05_05_025911_create_carts_table.php',
            'database/migrations/2026_05_22_134117_add_status_to_enrollments_table.php',
            'database/migrations/2026_05_22_134117_add_rejection_reason_to_payments_table.php',
        ];
    }
}
