<?php

namespace Tests\Feature\Instructor;

use App\FormStatus;
use App\Models\Category;
use App\Models\Course;
use App\Models\CoursePublishRequest;
use App\Models\User\Role;
use App\Models\User\User;
use Illuminate\Support\Facades\Artisan;
use Tests\TestCase;

class CoursePublishWorkflowTest extends TestCase {
    public function test_instructor_can_submit_publish_request_for_unpublished_course(): void {
        $instructor = User::factory()->create();
        $this->assignRole($instructor, 'instructor');

        $course = $this->createCourse($instructor, [
            'price'         => 500000,
            'discount_type' => 'percentage',
            'discount'      => 10,
            'is_published'  => false,
        ]);

        $response = $this->actingAs($instructor)
            ->patch(route('instructor.classes.togglePublish', ['course' => $course->id]));

        $response->assertRedirect();
        $response->assertSessionHasNoErrors();

        $course->refresh();
        $this->assertFalse($course->is_published);

        $this->assertDatabaseHas('course_publish_requests', [
            'course_id'               => $course->id,
            'requested_by'            => $instructor->id,
            'status'                  => FormStatus::PENDING->value,
            'submitted_discount_type' => 'percentage',
        ]);
    }

    public function test_instructor_cannot_submit_publish_request_when_pending_request_exists(): void {
        $instructor = User::factory()->create();
        $this->assignRole($instructor, 'instructor');

        $course = $this->createCourse($instructor);

        CoursePublishRequest::query()->create([
            'course_id'               => $course->id,
            'requested_by'            => $instructor->id,
            'status'                  => FormStatus::PENDING->value,
            'submitted_price'         => $course->price,
            'submitted_discount'      => $course->discount,
            'submitted_discount_type' => $course->discount_type,
        ]);

        $response = $this->actingAs($instructor)
            ->from(route('instructor.classes.show', ['course' => $course->id]))
            ->patch(route('instructor.classes.togglePublish', ['course' => $course->id]));

        $response->assertSessionHasErrors('course');

        $this->assertSame(
            1,
            CoursePublishRequest::query()
                ->where('course_id', $course->id)
                ->where('status', FormStatus::PENDING->value)
                ->count(),
        );
    }

    public function test_instructor_must_edit_course_info_before_resubmitting_after_rejection(): void {
        $instructor = User::factory()->create();
        $this->assignRole($instructor, 'instructor');

        $category = Category::query()->create([
            'name' => 'Civil',
            'slug' => 'civil',
        ]);

        $course = $this->createCourse($instructor, [
            'price'         => 650000,
            'discount_type' => 'amount',
            'discount'      => 50000,
        ]);
        $course->categories()->sync([$category->id]);
        $course->forceFill(['updated_at' => now()->subHours(2)])->saveQuietly();

        CoursePublishRequest::query()->create([
            'course_id'               => $course->id,
            'requested_by'            => $instructor->id,
            'status'                  => FormStatus::REJECTED->value,
            'reviewed_by'             => $instructor->id,
            'reviewed_at'             => now()->subMinute(),
            'rejection_reason'        => 'Perbaiki harga kursus.',
            'submitted_price'         => $course->price,
            'submitted_discount'      => $course->discount,
            'submitted_discount_type' => $course->discount_type,
        ]);

        $blockedResponse = $this->actingAs($instructor)
            ->from(route('instructor.classes.show', ['course' => $course->id]))
            ->patch(route('instructor.classes.togglePublish', ['course' => $course->id]));

        $blockedResponse->assertSessionHasErrors('course');

        $updateResponse = $this->actingAs($instructor)->patch(
            route('instructor.classes.update', ['course' => $course->id]),
            [
                'title'            => $course->title,
                'description'      => $course->description,
                'price'            => 700000,
                'discount_type'    => 'amount',
                'discount'         => 50000,
                'level'            => $course->level,
                'category'         => $category->slug,
                'total_hours'      => $course->total_hours,
                'total_sessions'   => $course->total_sessions,
                'certificate_type' => 'professional',
            ],
        );

        $updateResponse->assertRedirect();
        $updateResponse->assertSessionHasNoErrors();

        $resubmitResponse = $this->actingAs($instructor)
            ->patch(route('instructor.classes.togglePublish', ['course' => $course->id]));

        $resubmitResponse->assertRedirect();
        $resubmitResponse->assertSessionHasNoErrors();

        $this->assertSame(
            1,
            CoursePublishRequest::query()
                ->where('course_id', $course->id)
                ->where('status', FormStatus::PENDING->value)
                ->count(),
        );
    }

    public function test_updating_price_or_discount_on_published_course_keeps_old_pricing_and_creates_pending_request(): void {
        $instructor = User::factory()->create();
        $this->assignRole($instructor, 'instructor');

        $category = Category::query()->create([
            'name' => 'Structures',
            'slug' => 'structures',
        ]);

        $course = $this->createCourse($instructor, [
            'price'         => 500000,
            'discount_type' => 'percentage',
            'discount'      => 5,
            'is_published'  => true,
        ]);
        $course->categories()->sync([$category->id]);

        $response = $this->actingAs($instructor)->patch(
            route('instructor.classes.update', ['course' => $course->id]),
            [
                'title'            => $course->title,
                'description'      => $course->description,
                'price'            => 525000,
                'discount_type'    => 'percentage',
                'discount'         => 5,
                'level'            => $course->level,
                'category'         => $category->slug,
                'total_hours'      => $course->total_hours,
                'total_sessions'   => $course->total_sessions,
                'certificate_type' => 'professional',
            ],
        );

        $response->assertRedirect();
        $response->assertSessionHasNoErrors();

        $course->refresh();
        $this->assertTrue($course->is_published);
        $this->assertSame(500000.0, (float) $course->price);
        $this->assertSame(5.0, (float) $course->discount);
        $this->assertSame('percentage', (string) $course->discount_type);

        $pendingRequest = CoursePublishRequest::query()
            ->where('course_id', $course->id)
            ->where('status', FormStatus::PENDING->value)
            ->first();

        $this->assertNotNull($pendingRequest);
        $this->assertSame(525000.0, (float) $pendingRequest->submitted_price);
        $this->assertSame(5.0, (float) $pendingRequest->submitted_discount);
        $this->assertSame('percentage', (string) $pendingRequest->submitted_discount_type);
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
            'title'            => 'Course Publish Flow',
            'description'      => 'Course description',
            'price'            => 500000,
            'discount_type'    => 'amount',
            'discount'         => 0,
            'level'            => 'beginner',
            'total_hours'      => 8,
            'total_sessions'   => 4,
            'certificate_type' => 'professional',
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
            'database/migrations/2025_01_31_150339_create_permissions_table.php',
            'database/migrations/2025_01_31_152926_create_user_role_table.php',
            'database/migrations/2025_01_31_153311_create_role_permissions_table.php',
            'database/migrations/2026_05_24_141817_create_admin_user_permissions_table.php',
            'database/migrations/2026_04_26_075938_create_courses_table.php',
            'database/migrations/2026_04_26_075939_create_categories_table.php',
            'database/migrations/2026_04_28_074544_create_course_category_table.php',
            'database/migrations/2026_05_23_213027_create_course_publish_requests_table.php',
            'database/migrations/2026_06_28_164713_create_notifications_table.php',
            'database/migrations/2026_06_28_173509_add_gate_and_link_to_notifications_table.php',
            'database/migrations/2026_06_28_182100_fix_notifiable_id_type_in_notifications_table.php',
        ];
    }
}
