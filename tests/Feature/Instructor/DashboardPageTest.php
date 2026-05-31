<?php

namespace Tests\Feature\Instructor;

use App\FormStatus;
use App\Models\Course;
use App\Models\CoursePublishRequest;
use App\Models\Enrollment;
use App\Models\Finance\InstructorEarning;
use App\Models\Finance\InstructorPayoutRequest;
use App\Models\User\Role;
use App\Models\User\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\Artisan;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class DashboardPageTest extends TestCase {
    public function test_dashboard_route_renders_empty_payload_for_new_instructor(): void {
        $instructor = User::factory()->create();
        $this->assignRole($instructor, 'instructor');

        $response = $this->actingAs($instructor)->get(route('instructor.dashboard'));

        $response->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Instructors/Dashboard')
                ->where('overview.totalCourses', 0)
                ->where('overview.publishedCourses', 0)
                ->where('overview.totalStudents', 0)
                ->where('overview.availableBalance', 0)
                ->where('attention.pendingApprovalCourses', 0)
                ->where('attention.rejectedCourses', 0)
                ->where('attention.pendingPayoutAmount', 0)
                ->where('topCourses', [])
                ->where('recentEnrollments', []));
    }

    public function test_dashboard_uses_scoped_aggregates_sorted_lists_and_recent_limit(): void {
        Carbon::setTestNow(Carbon::parse('2026-05-24 10:00:00'));

        $instructor      = User::factory()->create();
        $otherInstructor = User::factory()->create();
        $this->assignRole($instructor, 'instructor');
        $this->assignRole($otherInstructor, 'instructor');

        $courseAlpha = $this->createCourse($instructor, [
            'title'        => 'Alpha Course',
            'is_published' => true,
        ]);
        $courseBeta = $this->createCourse($instructor, [
            'title'        => 'Beta Course',
            'is_published' => false,
        ]);
        $courseGamma = $this->createCourse($instructor, [
            'title'        => 'Gamma Course',
            'is_published' => false,
        ]);
        $courseDelta = $this->createCourse($instructor, [
            'title'        => 'Delta Course',
            'is_published' => false,
        ]);

        $this->createPublishRequest($courseBeta, $instructor, FormStatus::PENDING->value);
        $this->createPublishRequest($courseGamma, $instructor, FormStatus::REJECTED->value);

        $students = collect(range(1, 9))->map(function (int $number): User {
            $student = User::factory()->create(['name' => "Student {$number}"]);
            $this->assignRole($student, 'student');

            return $student;
        });

        foreach ($students as $index => $student) {
            $course = match (true) {
                $index <= 2  => $courseAlpha,
                $index <= 5  => $courseBeta,
                $index === 6 => $courseGamma,
                default      => $courseDelta,
            };

            Enrollment::query()->create([
                'user_id'     => $student->id,
                'course_id'   => $course->id,
                'status'      => FormStatus::ACTIVE->value,
                'enrolled_at' => now()->subHours($index + 1),
            ]);
        }

        $outsideStudent = User::factory()->create(['name' => 'Outside Student']);
        $outsideCourse  = $this->createCourse($otherInstructor, [
            'title' => 'Outside Course',
        ]);
        Enrollment::query()->create([
            'user_id'     => $outsideStudent->id,
            'course_id'   => $outsideCourse->id,
            'status'      => FormStatus::ACTIVE->value,
            'enrolled_at' => now()->subMinutes(5),
        ]);

        InstructorEarning::query()->create([
            'instructor_id'     => $instructor->id,
            'course_id'         => $courseAlpha->id,
            'payment_id'        => null,
            'gross_amount'      => 100000,
            'company_amount'    => 0,
            'instructor_amount' => 100000,
            'available_at'      => now()->subDay(),
            'released_at'       => null,
        ]);
        InstructorEarning::query()->create([
            'instructor_id'     => $instructor->id,
            'course_id'         => $courseBeta->id,
            'payment_id'        => null,
            'gross_amount'      => 50000,
            'company_amount'    => 0,
            'instructor_amount' => 50000,
            'available_at'      => now()->subHours(20),
            'released_at'       => null,
        ]);
        InstructorEarning::query()->create([
            'instructor_id'     => $instructor->id,
            'course_id'         => $courseGamma->id,
            'payment_id'        => null,
            'gross_amount'      => 200000,
            'company_amount'    => 0,
            'instructor_amount' => 200000,
            'available_at'      => now()->subDay(),
            'released_at'       => now()->subHour(),
        ]);
        InstructorEarning::query()->create([
            'instructor_id'     => $instructor->id,
            'course_id'         => $courseDelta->id,
            'payment_id'        => null,
            'gross_amount'      => 70000,
            'company_amount'    => 0,
            'instructor_amount' => 70000,
            'available_at'      => now()->addDay(),
            'released_at'       => null,
        ]);
        InstructorEarning::query()->create([
            'instructor_id'     => $otherInstructor->id,
            'course_id'         => $outsideCourse->id,
            'payment_id'        => null,
            'gross_amount'      => 999999,
            'company_amount'    => 0,
            'instructor_amount' => 999999,
            'available_at'      => now()->subDay(),
            'released_at'       => null,
        ]);

        InstructorPayoutRequest::query()->create([
            'instructor_id'    => $instructor->id,
            'requested_by'     => $instructor->id,
            'requested_amount' => 40000,
            'status'           => FormStatus::PENDING->value,
            'source'           => 'manual',
            'requested_at'     => now(),
        ]);
        InstructorPayoutRequest::query()->create([
            'instructor_id'    => $instructor->id,
            'requested_by'     => $instructor->id,
            'requested_amount' => 20000,
            'status'           => FormStatus::DRAFT->value,
            'source'           => 'manual',
            'requested_at'     => now(),
        ]);
        InstructorPayoutRequest::query()->create([
            'instructor_id'    => $instructor->id,
            'requested_by'     => $instructor->id,
            'requested_amount' => 10000,
            'status'           => FormStatus::APPROVED->value,
            'source'           => 'manual',
            'requested_at'     => now(),
        ]);
        InstructorPayoutRequest::query()->create([
            'instructor_id'    => $instructor->id,
            'requested_by'     => $instructor->id,
            'requested_amount' => 5000,
            'status'           => FormStatus::PAID->value,
            'source'           => 'manual',
            'requested_at'     => now(),
        ]);
        InstructorPayoutRequest::query()->create([
            'instructor_id'    => $instructor->id,
            'requested_by'     => $instructor->id,
            'requested_amount' => 7000,
            'status'           => FormStatus::REJECTED->value,
            'source'           => 'manual',
            'requested_at'     => now(),
        ]);
        InstructorPayoutRequest::query()->create([
            'instructor_id'    => $otherInstructor->id,
            'requested_by'     => $otherInstructor->id,
            'requested_amount' => 888888,
            'status'           => FormStatus::PENDING->value,
            'source'           => 'manual',
            'requested_at'     => now(),
        ]);

        $response = $this->actingAs($instructor)->get(route('instructor.dashboard'));
        $response->assertOk();

        /** @var array{component: string, props: array<string, mixed>} $page */
        $page = $response->viewData('page');

        $this->assertSame('Instructors/Dashboard', $page['component'] ?? null);

        $overview = $page['props']['overview'] ?? [];
        $this->assertSame(4, (int) ($overview['totalCourses'] ?? -1));
        $this->assertSame(1, (int) ($overview['publishedCourses'] ?? -1));
        $this->assertSame(9, (int) ($overview['totalStudents'] ?? -1));
        $this->assertSame(150000.0, (float) ($overview['availableBalance'] ?? -1));

        $attention = $page['props']['attention'] ?? [];
        $this->assertSame(1, (int) ($attention['pendingApprovalCourses'] ?? -1));
        $this->assertSame(1, (int) ($attention['rejectedCourses'] ?? -1));
        $this->assertSame(70000.0, (float) ($attention['pendingPayoutAmount'] ?? -1));

        $topCourses = $page['props']['topCourses'] ?? [];
        $this->assertCount(4, $topCourses);
        $this->assertSame((string) $courseAlpha->id, $topCourses[0]['id'] ?? null);
        $this->assertSame((string) $courseBeta->id, $topCourses[1]['id'] ?? null);
        $this->assertSame((string) $courseDelta->id, $topCourses[2]['id'] ?? null);
        $this->assertSame((string) $courseGamma->id, $topCourses[3]['id'] ?? null);
        $this->assertSame('published', $topCourses[0]['status'] ?? null);
        $this->assertSame('pending', $topCourses[1]['status'] ?? null);
        $this->assertSame('draft', $topCourses[2]['status'] ?? null);
        $this->assertSame('rejected', $topCourses[3]['status'] ?? null);

        $recentEnrollments = $page['props']['recentEnrollments'] ?? [];
        $this->assertCount(8, $recentEnrollments);
        $recentNames = array_column($recentEnrollments, 'studentName');
        $this->assertSame('Student 1', $recentNames[0] ?? null);
        $this->assertContains('Student 8', $recentNames);
        $this->assertNotContains('Student 9', $recentNames);
        $this->assertNotContains('Outside Student', $recentNames);

        Carbon::setTestNow();
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

    private function createCourse(User $instructor, array $overrides = []): Course {
        return Course::query()->create(array_merge([
            'title'          => 'Course',
            'description'    => 'Course description',
            'price'          => 100000,
            'discount_type'  => 'amount',
            'discount'       => 0,
            'is_published'   => false,
            'level'          => 'beginner',
            'total_hours'    => 2,
            'total_sessions' => 2,
            'created_by'     => $instructor->id,
        ], $overrides));
    }

    private function createPublishRequest(Course $course, User $requester, string $status): void {
        CoursePublishRequest::query()->create([
            'course_id'               => $course->id,
            'requested_by'            => $requester->id,
            'status'                  => $status,
            'submitted_price'         => (float) $course->price,
            'submitted_discount'      => (float) $course->discount,
            'submitted_discount_type' => (string) $course->discount_type,
        ]);
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
            'database/migrations/2026_04_28_074634_create_payments_table.php',
            'database/migrations/2026_04_28_074652_create_enrollments_table.php',
            'database/migrations/2026_05_23_213027_create_course_publish_requests_table.php',
            'database/migrations/2026_05_24_141817_create_instructor_earnings_table.php',
            'database/migrations/2026_05_24_141817_create_instructor_payout_requests_table.php',
            'database/migrations/2026_05_24_141818_create_instructor_payout_request_items_table.php',
        ];
    }
}
