<?php

namespace Tests\Feature;

use App\FormStatus;
use App\Models\Course;
use App\Models\CoursePublishRequest;
use App\Models\User\Role;
use App\Models\User\User;
use Illuminate\Support\Facades\Artisan;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class CourseApprovalCatalogueVisibilityTest extends TestCase {
    public function test_guest_and_student_catalogues_only_show_approved_published_courses(): void {
        $instructor = User::factory()->create(['name' => 'Instructor A']);
        $student    = User::factory()->create(['name' => 'Student A']);

        $this->assignRole($instructor, 'instructor');
        $this->assignRole($student, 'student');

        $approvedCourse = $this->createCourse($instructor, [
            'title'        => 'Approved Course',
            'is_published' => true,
        ]);

        CoursePublishRequest::query()->create([
            'course_id'               => $approvedCourse->id,
            'requested_by'            => $instructor->id,
            'status'                  => FormStatus::APPROVED->value,
            'reviewed_by'             => $student->id,
            'reviewed_at'             => now(),
            'submitted_price'         => $approvedCourse->price,
            'submitted_discount'      => $approvedCourse->discount,
            'submitted_discount_type' => $approvedCourse->discount_type,
        ]);

        $pendingCourse = $this->createCourse($instructor, [
            'title'        => 'Pending Course',
            'is_published' => false,
        ]);

        CoursePublishRequest::query()->create([
            'course_id'               => $pendingCourse->id,
            'requested_by'            => $instructor->id,
            'status'                  => FormStatus::PENDING->value,
            'submitted_price'         => $pendingCourse->price,
            'submitted_discount'      => $pendingCourse->discount,
            'submitted_discount_type' => $pendingCourse->discount_type,
        ]);

        $rejectedCourse = $this->createCourse($instructor, [
            'title'        => 'Rejected Course',
            'is_published' => false,
        ]);

        CoursePublishRequest::query()->create([
            'course_id'               => $rejectedCourse->id,
            'requested_by'            => $instructor->id,
            'status'                  => FormStatus::REJECTED->value,
            'reviewed_by'             => $student->id,
            'reviewed_at'             => now(),
            'rejection_reason'        => 'Perlu revisi.',
            'submitted_price'         => $rejectedCourse->price,
            'submitted_discount'      => $rejectedCourse->discount,
            'submitted_discount_type' => $rejectedCourse->discount_type,
        ]);

        $this->get(route('guest.training'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Guest/CourseSection/CourseCatalogue')
                ->has('courses', 1)
                ->where('courses.0.id', (string) $approvedCourse->id)
                ->where('courses.0.title', 'Approved Course'));

        $this->actingAs($student)
            ->get(route('student.course-catalogue'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Students/CourseCatalogue')
                ->has('courses', 1)
                ->where('courses.0.id', (string) $approvedCourse->id)
                ->where('courses.0.title', 'Approved Course'));
    }

    protected function setUp(): void {
        parent::setUp();

        Artisan::call('migrate:fresh', [
            '--database' => 'sqlite',
            '--path'     => $this->requiredMigrationPaths(),
            '--force'    => true,
        ]);
    }

    private function createCourse(User $instructor, array $overrides = []): Course {
        return Course::query()->create(array_merge([
            'title'            => 'Course Visibility',
            'description'      => 'Course description',
            'price'            => 450000,
            'discount_type'    => 'amount',
            'discount'         => 0,
            'level'            => 'beginner',
            'total_hours'      => 4,
            'total_sessions'   => 4,
            'certificate_type' => 'attendance',
            'created_by'       => $instructor->id,
            'is_published'     => false,
        ], $overrides));
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
            'database/migrations/2026_04_28_074634_create_payments_table.php',
            'database/migrations/2026_04_28_074652_create_enrollments_table.php',
            'database/migrations/2026_05_05_025911_create_carts_table.php',
            'database/migrations/2026_05_23_213027_create_course_publish_requests_table.php',
        ];
    }
}
