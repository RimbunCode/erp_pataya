<?php

namespace Tests\Feature\Student;

use App\FormStatus;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Payment;
use App\Models\User\Role;
use App\Models\User\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class EnrollmentVerificationFlowTest extends TestCase {
    public function test_student_submit_enrollment_creates_pending_payment_and_pending_enrollment(): void {
        Storage::fake('local');

        $instructor = User::factory()->create();
        $student    = User::factory()->create();

        $this->assignRole($instructor, 'instructor');
        $this->assignRole($student, 'student');

        $course = $this->createCourse($instructor, 'Flow Course A');

        $response = $this->actingAs($student)->post(route('student.enroll'), [
            'course_ids'     => [(string) $course->id],
            'payment_method' => 'tf',
            'payment_proof'  => UploadedFile::fake()->image('proof.jpg'),
            'notes'          => 'Initial payment note',
        ]);

        $response->assertRedirect();

        $payment = Payment::query()->first();
        $this->assertNotNull($payment);
        $this->assertSame(FormStatus::PENDING->value, $payment->status);
        $this->assertNotNull($payment->proof_image);
        Storage::disk('local')->assertExists($payment->proof_image);

        $enrollment = Enrollment::query()->first();
        $this->assertNotNull($enrollment);
        $this->assertSame(FormStatus::PENDING->value, $enrollment->status);
        $this->assertSame((string) $payment->id, (string) $enrollment->payment_id);
    }

    public function test_admin_can_approve_pending_payment_and_activate_enrollment(): void {
        $admin      = User::factory()->create();
        $instructor = User::factory()->create();
        $student    = User::factory()->create();

        $this->assignRole($admin, 'admin');
        $this->assignRole($instructor, 'instructor');
        $this->assignRole($student, 'student');

        $course = $this->createCourse($instructor, 'Flow Course B');

        $payment = Payment::query()->create([
            'user_id'        => $student->id,
            'course_id'      => $course->id,
            'amount'         => $course->price,
            'status'         => FormStatus::PENDING->value,
            'payment_method' => 'tf',
            'proof_image'    => 'payment-proofs/proof-b.jpg',
            'paid_at'        => now(),
        ]);

        $enrollment = Enrollment::query()->create([
            'user_id'    => $student->id,
            'course_id'  => $course->id,
            'payment_id' => $payment->id,
            'status'     => FormStatus::PENDING->value,
        ]);

        $response = $this->actingAs($admin)->patch(route('admin.finance.approve', ['payment' => $payment->id]));

        $response->assertRedirect();

        $payment->refresh();
        $enrollment->refresh();

        $this->assertSame(FormStatus::APPROVED->value, $payment->status);
        $this->assertNotNull($payment->verified_at);
        $this->assertSame((string) $admin->id, (string) $payment->verified_by);

        $this->assertSame(FormStatus::ACTIVE->value, $enrollment->status);
    }

    public function test_admin_finance_page_exposes_student_note_from_payment(): void {
        $admin      = User::factory()->create();
        $instructor = User::factory()->create();
        $student    = User::factory()->create();

        $this->assignRole($admin, 'admin');
        $this->assignRole($instructor, 'instructor');
        $this->assignRole($student, 'student');

        $course = $this->createCourse($instructor, 'Flow Course Note');

        $payment = Payment::query()->create([
            'user_id'        => $student->id,
            'course_id'      => $course->id,
            'amount'         => $course->price,
            'status'         => FormStatus::PENDING->value,
            'payment_method' => 'tf',
            'notes'          => 'Mohon dicek, transfer dari rekening BCA atas nama A.',
            'proof_image'    => 'payment-proofs/proof-note.jpg',
            'paid_at'        => now(),
        ]);

        Enrollment::query()->create([
            'user_id'    => $student->id,
            'course_id'  => $course->id,
            'payment_id' => $payment->id,
            'status'     => FormStatus::PENDING->value,
        ]);

        $this->actingAs($admin)
            ->get(route('admin.finance'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/SystemFinance')
                ->where('payments.0.id', (string) $payment->id)
                ->where('payments.0.studentNote', 'Mohon dicek, transfer dari rekening BCA atas nama A.'));
    }

    public function test_admin_finance_page_exposes_rejection_history_after_student_reupload(): void {
        $admin      = User::factory()->create();
        $instructor = User::factory()->create();
        $student    = User::factory()->create();

        $this->assignRole($admin, 'admin');
        $this->assignRole($instructor, 'instructor');
        $this->assignRole($student, 'student');

        $course = $this->createCourse($instructor, 'Flow Course Reupload');

        $rejectedPayment = Payment::query()->create([
            'user_id'          => $student->id,
            'course_id'        => $course->id,
            'amount'           => $course->price,
            'status'           => FormStatus::REJECTED->value,
            'payment_method'   => 'tf',
            'notes'            => 'Bukti pertama',
            'rejection_reason' => 'Bukti transfer tidak jelas.',
            'proof_image'      => 'payment-proofs/proof-rejected.jpg',
            'paid_at'          => now()->subDays(2),
            'verified_by'      => $admin->id,
            'verified_at'      => now()->subDays(2),
        ]);

        $pendingPayment = Payment::query()->create([
            'user_id'        => $student->id,
            'course_id'      => $course->id,
            'amount'         => $course->price,
            'status'         => FormStatus::PENDING->value,
            'payment_method' => 'tf',
            'notes'          => 'Bukti upload ulang',
            'proof_image'    => 'payment-proofs/proof-pending.jpg',
            'paid_at'        => now(),
        ]);

        Enrollment::query()->create([
            'user_id'    => $student->id,
            'course_id'  => $course->id,
            'payment_id' => $pendingPayment->id,
            'status'     => FormStatus::PENDING->value,
        ]);

        $this->actingAs($admin)
            ->get(route('admin.finance'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/SystemFinance')
                ->where('payments', function ($payments) use ($pendingPayment, $rejectedPayment): bool {
                    $paymentCollection = collect($payments);

                    $pendingPayload = $paymentCollection->firstWhere('id', (string) $pendingPayment->id);
                    if ($pendingPayload === null) {
                        return false;
                    }

                    return $paymentCollection->firstWhere('id', (string) $rejectedPayment->id) !== null
                        && ($pendingPayload['rejectionHistoryCount'] ?? 0) === 1
                        && ($pendingPayload['rejectionHistory'][0]['id'] ?? null) === (string) $rejectedPayment->id
                        && ($pendingPayload['rejectionHistory'][0]['reason'] ?? null) === 'Bukti transfer tidak jelas.';
                }));
    }

    public function test_admin_can_reject_and_student_can_reupload_for_same_course(): void {
        Storage::fake('local');

        $admin      = User::factory()->create();
        $instructor = User::factory()->create();
        $student    = User::factory()->create();

        $this->assignRole($admin, 'admin');
        $this->assignRole($instructor, 'instructor');
        $this->assignRole($student, 'student');

        $course = $this->createCourse($instructor, 'Flow Course C');

        $payment = Payment::query()->create([
            'user_id'        => $student->id,
            'course_id'      => $course->id,
            'amount'         => $course->price,
            'status'         => FormStatus::PENDING->value,
            'payment_method' => 'tf',
            'proof_image'    => 'payment-proofs/proof-c.jpg',
            'paid_at'        => now(),
        ]);

        $enrollment = Enrollment::query()->create([
            'user_id'    => $student->id,
            'course_id'  => $course->id,
            'payment_id' => $payment->id,
            'status'     => FormStatus::PENDING->value,
        ]);

        $rejectResponse = $this->actingAs($admin)->patch(route('admin.finance.reject', ['payment' => $payment->id]), [
            'reason' => 'Nominal tidak sesuai.',
        ]);

        $rejectResponse->assertRedirect();

        $payment->refresh();
        $enrollment->refresh();

        $this->assertSame(FormStatus::REJECTED->value, $payment->status);
        $this->assertSame('Nominal tidak sesuai.', $payment->rejection_reason);
        $this->assertSame(FormStatus::REJECTED->value, $enrollment->status);

        $reuploadResponse = $this->actingAs($student)->post(route('student.enroll'), [
            'course_ids'     => [(string) $course->id],
            'payment_method' => 'tf',
            'payment_proof'  => UploadedFile::fake()->image('proof-reupload.jpg'),
            'notes'          => 'Resubmit proof',
        ]);

        $reuploadResponse->assertRedirect();

        $this->assertSame(2, Payment::query()->where('course_id', $course->id)->where('user_id', $student->id)->count());

        $enrollment->refresh();
        $this->assertSame(FormStatus::PENDING->value, $enrollment->status);

        $latestPayment = Payment::query()->find($enrollment->payment_id);
        $this->assertNotNull($latestPayment);
        $this->assertSame(FormStatus::PENDING->value, $latestPayment->status);
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

    private function createCourse(User $instructor, string $title): Course {
        return Course::query()->create([
            'title'          => $title,
            'description'    => "{$title} description",
            'price'          => 450000,
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
            'database/migrations/2025_01_31_135456_create_roles_table.php',
            'database/migrations/2025_01_31_152926_create_user_role_table.php',
            'database/migrations/2026_04_26_075938_create_courses_table.php',
            'database/migrations/2026_04_26_075939_create_categories_table.php',
            'database/migrations/2026_04_28_074544_create_course_category_table.php',
            'database/migrations/2026_04_28_074634_create_payments_table.php',
            'database/migrations/2026_04_28_074652_create_enrollments_table.php',
        ];
    }
}
