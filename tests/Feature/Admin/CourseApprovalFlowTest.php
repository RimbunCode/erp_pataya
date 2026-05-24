<?php

namespace Tests\Feature\Admin;

use App\FormStatus;
use App\Models\Category;
use App\Models\Course;
use App\Models\CoursePublishRequest;
use App\Models\User\Role;
use App\Models\User\User;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use PHPUnit\Framework\AssertionFailedError;
use Tests\TestCase;

class CourseApprovalFlowTest extends TestCase {
    public function test_admin_can_approve_pending_course_publish_request_and_publish_course(): void {
        $admin      = User::factory()->create();
        $instructor = User::factory()->create();

        $this->assignRole($admin, 'admin');
        $this->grantAdminPermission($admin, 'course_admin');
        $this->assignRole($instructor, 'instructor');

        $course = $this->createCourse($instructor);

        $publishRequest = CoursePublishRequest::query()->create([
            'course_id'               => $course->id,
            'requested_by'            => $instructor->id,
            'status'                  => FormStatus::PENDING->value,
            'submitted_price'         => $course->price,
            'submitted_discount'      => $course->discount,
            'submitted_discount_type' => $course->discount_type,
        ]);

        $response = $this->actingAs($admin)->patch(
            route('admin.approval.approve', ['coursePublishRequest' => $publishRequest->id]),
        );

        $response->assertRedirect();
        $response->assertSessionHasNoErrors();

        $publishRequest->refresh();
        $course->refresh();

        $this->assertSame(FormStatus::APPROVED->value, $publishRequest->status);
        $this->assertSame((string) $admin->id, (string) $publishRequest->reviewed_by);
        $this->assertNotNull($publishRequest->reviewed_at);
        $this->assertTrue($course->is_published);
    }

    public function test_admin_approval_applies_submitted_pricing_snapshot_to_course(): void {
        $admin      = User::factory()->create();
        $instructor = User::factory()->create();

        $this->assignRole($admin, 'admin');
        $this->grantAdminPermission($admin, 'course_admin');
        $this->assignRole($instructor, 'instructor');

        $course = $this->createCourse($instructor, [
            'price'         => 500000,
            'discount_type' => 'amount',
            'discount'      => 25000,
            'is_published'  => true,
        ]);

        $publishRequest = CoursePublishRequest::query()->create([
            'course_id'               => $course->id,
            'requested_by'            => $instructor->id,
            'status'                  => FormStatus::PENDING->value,
            'submitted_price'         => 550000,
            'submitted_discount'      => 10,
            'submitted_discount_type' => 'percentage',
        ]);

        $response = $this->actingAs($admin)->patch(
            route('admin.approval.approve', ['coursePublishRequest' => $publishRequest->id]),
        );

        $response->assertRedirect();
        $response->assertSessionHasNoErrors();

        $course->refresh();

        $this->assertTrue($course->is_published);
        $this->assertSame(550000.0, (float) $course->price);
        $this->assertSame(10.0, (float) $course->discount);
        $this->assertSame('percentage', (string) $course->discount_type);
    }

    public function test_admin_reject_requires_reason_and_persists_reason(): void {
        $admin      = User::factory()->create();
        $instructor = User::factory()->create();

        $this->assignRole($admin, 'admin');
        $this->grantAdminPermission($admin, 'course_admin');
        $this->assignRole($instructor, 'instructor');

        $course = $this->createCourse($instructor);

        $publishRequest = CoursePublishRequest::query()->create([
            'course_id'               => $course->id,
            'requested_by'            => $instructor->id,
            'status'                  => FormStatus::PENDING->value,
            'submitted_price'         => $course->price,
            'submitted_discount'      => $course->discount,
            'submitted_discount_type' => $course->discount_type,
        ]);

        $withoutReasonResponse = $this->actingAs($admin)
            ->from(route('admin.approval'))
            ->patch(
                route('admin.approval.reject', ['coursePublishRequest' => $publishRequest->id]),
                ['reason' => ''],
            );

        $withoutReasonResponse->assertSessionHasErrors('reason');

        $response = $this->actingAs($admin)->patch(
            route('admin.approval.reject', ['coursePublishRequest' => $publishRequest->id]),
            ['reason' => 'Konten belum memenuhi standar kurikulum.'],
        );

        $response->assertRedirect();
        $response->assertSessionHasNoErrors();

        $publishRequest->refresh();
        $course->refresh();

        $this->assertSame(FormStatus::REJECTED->value, $publishRequest->status);
        $this->assertSame('Konten belum memenuhi standar kurikulum.', $publishRequest->rejection_reason);
        $this->assertSame((string) $admin->id, (string) $publishRequest->reviewed_by);
        $this->assertNotNull($publishRequest->reviewed_at);
        $this->assertFalse($course->is_published);
    }

    public function test_admin_approvals_page_returns_real_requests_payload(): void {
        $admin      = User::factory()->create();
        $instructor = User::factory()->create(['name' => 'Instruktur A']);

        $this->assignRole($admin, 'admin');
        $this->grantAdminPermission($admin, 'course_admin');
        $this->assignRole($instructor, 'instructor');

        $category = Category::query()->create([
            'name' => 'Management',
            'slug' => 'management',
        ]);

        $course = $this->createCourse($instructor, [
            'title' => 'Course Approval Payload',
        ]);
        $course->categories()->sync([$category->id]);

        $publishRequest = CoursePublishRequest::query()->create([
            'course_id'               => $course->id,
            'requested_by'            => $instructor->id,
            'status'                  => FormStatus::PENDING->value,
            'submitted_price'         => $course->price,
            'submitted_discount'      => $course->discount,
            'submitted_discount_type' => $course->discount_type,
        ]);

        $response = $this->actingAs($admin)->get(route('admin.approval'));
        $response->assertOk();

        $page = $this->extractInertiaPage($response);
        $this->assertSame('Admin/Approvals', $page['component'] ?? null);

        $requests = collect($page['props']['requests'] ?? []);
        $payload  = $requests->firstWhere('id', (string) $publishRequest->id);

        $this->assertNotNull($payload);
        $this->assertSame((string) $course->id, $payload['courseId'] ?? null);
        $this->assertSame('Course Approval Payload', $payload['title'] ?? null);
        $this->assertSame('Instruktur A', $payload['instructor'] ?? null);
        $this->assertSame(FormStatus::PENDING->value, $payload['status'] ?? null);
    }

    public function test_admin_approvals_page_exposes_rejection_history_for_resubmitted_course_request(): void {
        $admin      = User::factory()->create();
        $instructor = User::factory()->create();

        $this->assignRole($admin, 'admin');
        $this->grantAdminPermission($admin, 'course_admin');
        $this->assignRole($instructor, 'instructor');

        $course = $this->createCourse($instructor);

        $rejectedRequest = CoursePublishRequest::query()->create([
            'course_id'               => $course->id,
            'requested_by'            => $instructor->id,
            'status'                  => FormStatus::REJECTED->value,
            'reviewed_by'             => $admin->id,
            'reviewed_at'             => now()->subDay(),
            'rejection_reason'        => 'Silabus belum lengkap.',
            'submitted_price'         => $course->price,
            'submitted_discount'      => $course->discount,
            'submitted_discount_type' => $course->discount_type,
        ]);

        $pendingRequest = CoursePublishRequest::query()->create([
            'course_id'               => $course->id,
            'requested_by'            => $instructor->id,
            'status'                  => FormStatus::PENDING->value,
            'submitted_price'         => $course->price,
            'submitted_discount'      => $course->discount,
            'submitted_discount_type' => $course->discount_type,
        ]);

        $response = $this->actingAs($admin)->get(route('admin.approval'));
        $response->assertOk();

        $page = $this->extractInertiaPage($response);

        $this->assertIsArray($page);
        $this->assertSame('Admin/Approvals', $page['component'] ?? null);

        $requestCollection = collect($page['props']['requests'] ?? []);
        $pendingPayload    = $requestCollection->firstWhere('id', (string) $pendingRequest->id);

        $this->assertNotNull($pendingPayload);
        $this->assertSame(1, $pendingPayload['rejectionHistoryCount']);
        $this->assertCount(1, $pendingPayload['rejectionHistory']);
        $this->assertSame((string) $rejectedRequest->id, $pendingPayload['rejectionHistory'][0]['id']);
        $this->assertSame('Silabus belum lengkap.', $pendingPayload['rejectionHistory'][0]['reason']);
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
            'title'            => 'Course Approval',
            'description'      => 'Course description',
            'price'            => 500000,
            'discount_type'    => 'percentage',
            'discount'         => 5,
            'level'            => 'intermediate',
            'total_hours'      => 8,
            'total_sessions'   => 6,
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

    private function grantAdminPermission(User $user, string $permissionName): void {
        $permissionId = DB::table('permissions')
            ->where('name', $permissionName)
            ->whereNull('deleted_at')
            ->value('id');

        if (! $permissionId) {
            $permissionId = (string) Str::ulid();
            DB::table('permissions')->insert([
                'id'          => $permissionId,
                'module'      => 'lms',
                'name'        => $permissionName,
                'model'       => User::class,
                'route'       => 'admin.*',
                'permissions' => json_encode(['view']),
                'created_at'  => now(),
                'updated_at'  => now(),
            ]);
        }

        $exists = DB::table('admin_user_permissions')
            ->where('user_id', $user->id)
            ->where('permission_id', $permissionId)
            ->whereNull('deleted_at')
            ->exists();

        if ($exists) {
            return;
        }

        DB::table('admin_user_permissions')->insert([
            'id'            => (string) Str::ulid(),
            'user_id'       => $user->id,
            'permission_id' => $permissionId,
            'created_at'    => now(),
            'updated_at'    => now(),
            'deleted_at'    => null,
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function extractInertiaPage(TestResponse $response): array {
        if ($response->headers->has('X-Inertia')) {
            return (array) $response->json();
        }

        try {
            return (array) $response->viewData('page');
        } catch (AssertionFailedError) {
            $content = (string) $response->getContent();
            preg_match('/data-page="([^"]+)"/', $content, $matches);

            $encodedPage = $matches[1] ?? null;
            if (! $encodedPage) {
                return [];
            }

            return json_decode(html_entity_decode($encodedPage, ENT_QUOTES, 'UTF-8'), true) ?? [];
        }
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
            'database/migrations/2026_05_24_141817_create_admin_user_permissions_table.php',
            'database/migrations/2026_04_26_075938_create_courses_table.php',
            'database/migrations/2026_04_26_075939_create_categories_table.php',
            'database/migrations/2026_04_28_074544_create_course_category_table.php',
            'database/migrations/2026_05_23_213027_create_course_publish_requests_table.php',
        ];
    }
}
