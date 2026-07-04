<?php

namespace Tests\Feature\Notifications;

use App\FormStatus;
use App\Models\Course;
use App\Models\CoursePublishRequest;
use App\Models\User\Role;
use App\Models\User\User;
use App\Notifications\CourseApprovalRequestedNotification;
use App\Notifications\CourseApprovalRespondedNotification;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class MenuNotificationMarkAsReadTest extends TestCase {
    public function test_opening_menu_page_marks_matching_menu_key_notifications_as_read(): void {
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

        // menu_key 'approval' — akan ditandai read saat admin membuka /admin/approvals
        $admin->notify(new CourseApprovalRequestedNotification($publishRequest));

        // menu_key 'manage-classes' — tidak boleh ikut ditandai read
        $instructor->notify(new CourseApprovalRespondedNotification($publishRequest));

        $this->assertSame(1, $admin->fresh()->unreadNotifications()->count());
        $this->assertSame(1, $instructor->fresh()->unreadNotifications()->count());

        $response = $this->actingAs($admin)->get(route('admin.approval'));
        $response->assertOk();

        $this->assertSame(0, $admin->fresh()->unreadNotifications()->count());
        $this->assertSame(1, $instructor->fresh()->unreadNotifications()->count());
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
            'database/migrations/2026_06_28_164713_create_notifications_table.php',
            'database/migrations/2026_06_28_173509_add_gate_and_link_to_notifications_table.php',
            'database/migrations/2026_06_28_182100_fix_notifiable_id_type_in_notifications_table.php',
        ];
    }
}
