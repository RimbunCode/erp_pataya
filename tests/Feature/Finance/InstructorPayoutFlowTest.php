<?php

namespace Tests\Feature\Finance;

use App\FormStatus;
use App\Models\Core\Preference;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Finance\InstructorEarning;
use App\Models\Finance\InstructorPayoutRequest;
use App\Models\Finance\InstructorPayoutRequestItem;
use App\Models\Payment;
use App\Models\User\Role;
use App\Models\User\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use PHPUnit\Framework\AssertionFailedError;
use Tests\TestCase;

class InstructorPayoutFlowTest extends TestCase {
    public function test_approved_payment_creates_instructor_earning_with_available_at_based_on_delay(): void {
        $admin      = User::factory()->create();
        $instructor = User::factory()->create();
        $student    = User::factory()->create();

        $this->assignRole($admin, 'admin');
        $this->grantAdminPermission($admin, 'finance_admin');
        $this->assignRole($instructor, 'instructor');
        $this->assignRole($student, 'student');

        Preference::query()->updateOrCreate(
            ['key' => 'payout_delay_days'],
            ['value' => '3'],
        );

        $course = $this->createCourse($instructor, 'Payout Delay Course', 500000);

        $payment = Payment::query()->create([
            'user_id'        => $student->id,
            'course_id'      => $course->id,
            'amount'         => 500000,
            'status'         => FormStatus::PENDING->value,
            'payment_method' => 'tf',
            'proof_image'    => 'payment-proofs/proof-delay.jpg',
            'paid_at'        => now(),
        ]);

        Enrollment::query()->create([
            'user_id'    => $student->id,
            'course_id'  => $course->id,
            'payment_id' => $payment->id,
            'status'     => FormStatus::PENDING->value,
        ]);

        $response = $this->actingAs($admin)->patch(route('admin.finance.approve', ['payment' => $payment->id]));
        $response->assertRedirect();

        $payment->refresh();

        $earning = InstructorEarning::query()->where('payment_id', $payment->id)->first();
        $this->assertNotNull($earning);
        $this->assertSame((string) $instructor->id, (string) $earning->instructor_id);
        $this->assertSame(500000.0, (float) $earning->instructor_amount);
        $this->assertNotNull($earning->available_at);
        $this->assertSame(
            $payment->verified_at?->copy()->addDays(3)->toDateTimeString(),
            $earning->available_at?->toDateTimeString(),
        );
    }

    public function test_instructor_can_submit_partial_payout_request_within_eligible_balance(): void {
        $instructor = User::factory()->create();
        $this->assignRole($instructor, 'instructor');

        $earning = InstructorEarning::query()->create([
            'instructor_id'     => $instructor->id,
            'payment_id'        => null,
            'course_id'         => null,
            'gross_amount'      => 100000,
            'company_amount'    => 0,
            'instructor_amount' => 100000,
            'available_at'      => now()->subDay(),
            'released_at'       => null,
        ]);

        $response = $this->actingAs($instructor)
            ->post(route('instructor.financial.payout-requests.store'), [
                'requested_amount' => 40000,
                'note'             => 'Partial payout',
            ]);

        $response->assertRedirect();
        $response->assertSessionHasNoErrors();

        $request = InstructorPayoutRequest::query()->first();
        $this->assertNotNull($request);
        $this->assertSame((string) $instructor->id, (string) $request->instructor_id);
        $this->assertSame('pending', $request->status);
        $this->assertSame(40000.0, (float) $request->requested_amount);

        $item = InstructorPayoutRequestItem::query()
            ->where('payout_request_id', $request->id)
            ->where('earning_id', $earning->id)
            ->first();

        $this->assertNotNull($item);
        $this->assertSame(40000.0, (float) $item->amount);
    }

    public function test_approved_payment_applies_company_fee_percentage_to_instructor_earning(): void {
        $admin      = User::factory()->create();
        $instructor = User::factory()->create();
        $student    = User::factory()->create();

        $this->assignRole($admin, 'admin');
        $this->grantAdminPermission($admin, 'finance_admin');
        $this->assignRole($instructor, 'instructor');
        $this->assignRole($student, 'student');

        Preference::query()->updateOrCreate(
            ['key' => 'company_fee_percentage'],
            ['value' => '12.5'],
        );

        $course = $this->createCourse($instructor, 'Payout Fee Course', 400000);

        $payment = Payment::query()->create([
            'user_id'        => $student->id,
            'course_id'      => $course->id,
            'amount'         => 400000,
            'status'         => FormStatus::PENDING->value,
            'payment_method' => 'tf',
            'proof_image'    => 'payment-proofs/proof-fee.jpg',
            'paid_at'        => now(),
        ]);

        Enrollment::query()->create([
            'user_id'    => $student->id,
            'course_id'  => $course->id,
            'payment_id' => $payment->id,
            'status'     => FormStatus::PENDING->value,
        ]);

        $response = $this->actingAs($admin)->patch(route('admin.finance.approve', ['payment' => $payment->id]));
        $response->assertRedirect();

        $earning = InstructorEarning::query()->where('payment_id', $payment->id)->first();
        $this->assertNotNull($earning);
        $this->assertSame(400000.0, (float) $earning->gross_amount);
        $this->assertSame(50000.0, (float) $earning->company_amount);
        $this->assertSame(350000.0, (float) $earning->instructor_amount);
    }

    public function test_instructor_request_above_eligible_balance_is_rejected(): void {
        $instructor = User::factory()->create();
        $this->assignRole($instructor, 'instructor');

        InstructorEarning::query()->create([
            'instructor_id'     => $instructor->id,
            'payment_id'        => null,
            'course_id'         => null,
            'gross_amount'      => 75000,
            'company_amount'    => 0,
            'instructor_amount' => 75000,
            'available_at'      => now()->subDay(),
            'released_at'       => null,
        ]);

        $response = $this->actingAs($instructor)
            ->from(route('instructor.financial'))
            ->post(route('instructor.financial.payout-requests.store'), [
                'requested_amount' => 80000,
            ]);

        $response->assertRedirect(route('instructor.financial'));
        $response->assertSessionHasErrors('requested_amount');
        $this->assertSame(0, InstructorPayoutRequest::query()->count());
    }

    public function test_partial_request_keeps_remaining_balance_eligible_for_next_request(): void {
        $instructor = User::factory()->create();
        $this->assignRole($instructor, 'instructor');

        $earning = InstructorEarning::query()->create([
            'instructor_id'     => $instructor->id,
            'payment_id'        => null,
            'course_id'         => null,
            'gross_amount'      => 100000,
            'company_amount'    => 0,
            'instructor_amount' => 100000,
            'available_at'      => now()->subDay(),
            'released_at'       => null,
        ]);

        $firstResponse = $this->actingAs($instructor)
            ->post(route('instructor.financial.payout-requests.store'), [
                'requested_amount' => 40000,
            ]);
        $firstResponse->assertRedirect();
        $firstResponse->assertSessionHasNoErrors();

        $secondResponse = $this->actingAs($instructor)
            ->post(route('instructor.financial.payout-requests.store'), [
                'requested_amount' => 60000,
            ]);
        $secondResponse->assertRedirect();
        $secondResponse->assertSessionHasNoErrors();

        $requests = InstructorPayoutRequest::query()->orderBy('created_at')->get();
        $this->assertCount(2, $requests);
        $this->assertSame(40000.0, (float) $requests[0]->requested_amount);
        $this->assertSame(60000.0, (float) $requests[1]->requested_amount);

        $itemsForEarning = InstructorPayoutRequestItem::query()
            ->where('earning_id', $earning->id)
            ->orderBy('created_at')
            ->get();

        $this->assertCount(2, $itemsForEarning);
        $this->assertSame(40000.0, (float) $itemsForEarning[0]->amount);
        $this->assertSame(60000.0, (float) $itemsForEarning[1]->amount);
    }

    public function test_finance_admin_can_run_batch_and_create_draft_payout_requests(): void {
        $admin         = User::factory()->create();
        $instructorOne = User::factory()->create();
        $instructorTwo = User::factory()->create();

        $this->assignRole($admin, 'admin');
        $this->grantAdminPermission($admin, 'finance_admin');
        $this->assignRole($instructorOne, 'instructor');
        $this->assignRole($instructorTwo, 'instructor');

        InstructorEarning::query()->create([
            'instructor_id'     => $instructorOne->id,
            'payment_id'        => null,
            'course_id'         => null,
            'gross_amount'      => 120000,
            'company_amount'    => 0,
            'instructor_amount' => 120000,
            'available_at'      => now()->subDay(),
            'released_at'       => null,
        ]);

        InstructorEarning::query()->create([
            'instructor_id'     => $instructorTwo->id,
            'payment_id'        => null,
            'course_id'         => null,
            'gross_amount'      => 90000,
            'company_amount'    => 0,
            'instructor_amount' => 90000,
            'available_at'      => now()->addDay(),
            'released_at'       => null,
        ]);

        $response = $this->actingAs($admin)->post(route('admin.finance.payouts.batch'));
        $response->assertRedirect();
        $response->assertSessionHasNoErrors();

        $draftRequests = InstructorPayoutRequest::query()->get();
        $this->assertCount(1, $draftRequests);
        $this->assertSame('draft', $draftRequests->first()->status);
        $this->assertSame((string) $instructorOne->id, (string) $draftRequests->first()->instructor_id);
        $this->assertSame(120000.0, (float) $draftRequests->first()->requested_amount);
    }

    public function test_mark_paid_requires_transfer_reference_and_proof_file(): void {
        Storage::fake('local');

        $admin      = User::factory()->create();
        $instructor = User::factory()->create();

        $this->assignRole($admin, 'admin');
        $this->grantAdminPermission($admin, 'finance_admin');
        $this->assignRole($instructor, 'instructor');

        $earning = InstructorEarning::query()->create([
            'instructor_id'     => $instructor->id,
            'payment_id'        => null,
            'course_id'         => null,
            'gross_amount'      => 150000,
            'company_amount'    => 0,
            'instructor_amount' => 150000,
            'available_at'      => now()->subDay(),
            'released_at'       => null,
        ]);

        $payoutRequest = InstructorPayoutRequest::query()->create([
            'instructor_id'    => $instructor->id,
            'requested_by'     => $instructor->id,
            'requested_amount' => 150000,
            'approved_amount'  => 150000,
            'status'           => FormStatus::APPROVED->value,
            'source'           => 'manual',
            'requested_at'     => now()->subHour(),
            'approved_at'      => now()->subMinutes(30),
        ]);

        InstructorPayoutRequestItem::query()->create([
            'payout_request_id' => $payoutRequest->id,
            'earning_id'        => $earning->id,
            'amount'            => 150000,
        ]);

        $invalidResponse = $this->actingAs($admin)
            ->from(route('admin.finance'))
            ->patch(route('admin.finance.payouts.paid', ['payoutRequest' => $payoutRequest->id]), []);

        $invalidResponse->assertRedirect(route('admin.finance'));
        $invalidResponse->assertSessionHasErrors(['transfer_reference', 'proof_file']);

        $validResponse = $this->actingAs($admin)->patch(
            route('admin.finance.payouts.paid', ['payoutRequest' => $payoutRequest->id]),
            [
                'transfer_reference' => 'TRX-PAYOUT-001',
                'proof_file'         => UploadedFile::fake()->create('proof.pdf', 256, 'application/pdf'),
            ],
        );

        $validResponse->assertRedirect();
        $validResponse->assertSessionHasNoErrors();

        $payoutRequest->refresh();
        $earning->refresh();

        $this->assertSame(FormStatus::PAID->value, $payoutRequest->status);
        $this->assertSame('TRX-PAYOUT-001', $payoutRequest->transfer_reference);
        $this->assertNotNull($payoutRequest->proof_file_path);
        $this->assertNotNull($payoutRequest->paid_at);
        $this->assertNotNull($earning->released_at);
        Storage::disk('local')->assertExists((string) $payoutRequest->proof_file_path);
    }

    public function test_marking_partial_paid_request_does_not_mark_earning_as_released(): void {
        Storage::fake('local');

        $admin      = User::factory()->create();
        $instructor = User::factory()->create();

        $this->assignRole($admin, 'admin');
        $this->grantAdminPermission($admin, 'finance_admin');
        $this->assignRole($instructor, 'instructor');

        $earning = InstructorEarning::query()->create([
            'instructor_id'     => $instructor->id,
            'payment_id'        => null,
            'course_id'         => null,
            'gross_amount'      => 100000,
            'company_amount'    => 0,
            'instructor_amount' => 100000,
            'available_at'      => now()->subDay(),
            'released_at'       => null,
        ]);

        $payoutRequest = InstructorPayoutRequest::query()->create([
            'instructor_id'    => $instructor->id,
            'requested_by'     => $instructor->id,
            'requested_amount' => 40000,
            'approved_amount'  => 40000,
            'status'           => FormStatus::APPROVED->value,
            'source'           => 'manual',
            'requested_at'     => now()->subHour(),
            'approved_at'      => now()->subMinutes(30),
        ]);

        InstructorPayoutRequestItem::query()->create([
            'payout_request_id' => $payoutRequest->id,
            'earning_id'        => $earning->id,
            'amount'            => 40000,
        ]);

        $markPaidResponse = $this->actingAs($admin)->patch(
            route('admin.finance.payouts.paid', ['payoutRequest' => $payoutRequest->id]),
            [
                'transfer_reference' => 'TRX-PARTIAL-001',
                'proof_file'         => UploadedFile::fake()->create('partial-proof.pdf', 256, 'application/pdf'),
            ],
        );

        $markPaidResponse->assertRedirect();
        $markPaidResponse->assertSessionHasNoErrors();

        $earning->refresh();
        $this->assertNull($earning->released_at);

        $newRequestResponse = $this->actingAs($instructor)
            ->post(route('instructor.financial.payout-requests.store'), [
                'requested_amount' => 60000,
            ]);

        $newRequestResponse->assertRedirect();
        $newRequestResponse->assertSessionHasNoErrors();
    }

    public function test_finance_admin_can_update_company_fee_setting(): void {
        $admin = User::factory()->create();

        $this->assignRole($admin, 'admin');
        $this->grantAdminPermission($admin, 'finance_admin');

        $response = $this->actingAs($admin)
            ->patch(route('admin.finance.settings.company-fee'), [
                'company_fee_percentage' => 18.75,
            ]);

        $response->assertRedirect();
        $response->assertSessionHasNoErrors();

        $storedValue = Preference::query()->where('key', 'company_fee_percentage')->value('value');
        $this->assertSame(18.75, (float) $storedValue);
    }

    public function test_finance_admin_can_reset_payout_delay_setting_to_zero(): void {
        $admin = User::factory()->create();

        $this->assignRole($admin, 'admin');
        $this->grantAdminPermission($admin, 'finance_admin');

        Preference::query()->updateOrCreate(
            ['key' => 'payout_delay_days'],
            ['value' => '7'],
        );

        $response = $this->actingAs($admin)
            ->patch(route('admin.finance.settings.payout-delay'), [
                'delay_days' => 0,
            ]);

        $response->assertRedirect();
        $response->assertSessionHasNoErrors();

        $storedValue = Preference::query()->where('key', 'payout_delay_days')->value('value');
        $this->assertSame(0, (int) $storedValue);
    }

    public function test_finance_page_inertia_payload_contains_payout_tab_data(): void {
        $admin      = User::factory()->create();
        $instructor = User::factory()->create(['name' => 'Instructor Payload']);

        $this->assignRole($admin, 'admin');
        $this->grantAdminPermission($admin, 'finance_admin');
        $this->assignRole($instructor, 'instructor');

        Preference::query()->updateOrCreate(
            ['key' => 'payout_delay_days'],
            ['value' => '2'],
        );
        Preference::query()->updateOrCreate(
            ['key' => 'company_fee_percentage'],
            ['value' => '9.25'],
        );

        InstructorEarning::query()->create([
            'instructor_id'     => $instructor->id,
            'payment_id'        => null,
            'course_id'         => null,
            'gross_amount'      => 80000,
            'company_amount'    => 0,
            'instructor_amount' => 80000,
            'available_at'      => now()->subDay(),
            'released_at'       => null,
        ]);

        $payoutRequest = InstructorPayoutRequest::query()->create([
            'instructor_id'    => $instructor->id,
            'requested_by'     => $instructor->id,
            'requested_amount' => 60000,
            'status'           => 'pending',
            'source'           => 'manual',
            'note'             => 'Need payout',
            'requested_at'     => now(),
        ]);

        $response = $this->actingAs($admin)->get(route('admin.finance'));
        $response->assertOk();

        $page = $this->extractInertiaPage($response);
        $this->assertSame('Admin/SystemFinance', $page['component'] ?? null);
        $this->assertSame(2, (int) ($page['props']['payoutDelayDays'] ?? -1));
        $this->assertSame(9.25, (float) ($page['props']['companyFeePercentage'] ?? -1));

        $payoutPayload = collect($page['props']['payoutRequests'] ?? [])
            ->firstWhere('id', (string) $payoutRequest->id);

        $this->assertNotNull($payoutPayload);
        $this->assertSame('Instructor Payload', $payoutPayload['instructorName'] ?? null);
        $this->assertSame('pending', $payoutPayload['status'] ?? null);
        $this->assertArrayHasKey('payoutStats', $page['props'] ?? []);
    }

    public function test_instructor_financial_page_inertia_payload_contains_mutation_and_latest_payout_data(): void {
        $instructor = User::factory()->create();
        $student    = User::factory()->create();

        $this->assignRole($instructor, 'instructor');
        $this->assignRole($student, 'student');

        Preference::query()->updateOrCreate(
            ['key' => 'company_fee_percentage'],
            ['value' => '9.25'],
        );

        $course = $this->createCourse($instructor, 'Mutasi Kelas', 300000);

        $payment = Payment::query()->create([
            'user_id'        => $student->id,
            'course_id'      => $course->id,
            'amount'         => 200000,
            'status'         => FormStatus::APPROVED->value,
            'payment_method' => 'tf',
            'paid_at'        => now()->subDay(),
            'verified_at'    => now()->subHours(20),
        ]);

        $eligibleEarning = InstructorEarning::query()->create([
            'instructor_id'     => $instructor->id,
            'payment_id'        => $payment->id,
            'course_id'         => $course->id,
            'gross_amount'      => 200000,
            'company_amount'    => 25000,
            'instructor_amount' => 175000,
            'available_at'      => now()->subHours(10),
            'released_at'       => null,
        ]);

        $pendingEarning = InstructorEarning::query()->create([
            'instructor_id'     => $instructor->id,
            'payment_id'        => null,
            'course_id'         => $course->id,
            'gross_amount'      => 150000,
            'company_amount'    => 15000,
            'instructor_amount' => 135000,
            'available_at'      => now()->addDay(),
            'released_at'       => null,
        ]);

        $releasedEarning = InstructorEarning::query()->create([
            'instructor_id'     => $instructor->id,
            'payment_id'        => null,
            'course_id'         => $course->id,
            'gross_amount'      => 100000,
            'company_amount'    => 10000,
            'instructor_amount' => 90000,
            'available_at'      => now()->subDays(2),
            'released_at'       => now()->subDay(),
        ]);

        $createdPayoutIds = collect();
        $baseTimestamp    = now()->subMinutes(10);
        for ($index = 1; $index <= 6; $index++) {
            $payoutRequest = InstructorPayoutRequest::query()->create([
                'instructor_id'    => $instructor->id,
                'requested_by'     => $instructor->id,
                'requested_amount' => 10000 * $index,
                'status'           => 'pending',
                'source'           => 'manual',
                'requested_at'     => now()->subMinutes($index),
                'created_at'       => $baseTimestamp->copy()->addSeconds($index),
                'updated_at'       => $baseTimestamp->copy()->addSeconds($index),
            ]);

            $createdPayoutIds->push((string) $payoutRequest->id);
        }

        $response = $this->actingAs($instructor)->get(route('instructor.financial'));
        $response->assertOk();

        $page = $this->extractInertiaPage($response);

        $this->assertSame('Instructors/Financials', $page['component'] ?? null);
        $this->assertSame(9.25, (float) ($page['props']['companyFeePercentage'] ?? -1));

        $mutations = collect($page['props']['mutations'] ?? []);
        $this->assertCount(3, $mutations);

        $eligiblePayload = $mutations->firstWhere('id', (string) $eligibleEarning->id);
        $pendingPayload  = $mutations->firstWhere('id', (string) $pendingEarning->id);
        $releasedPayload = $mutations->firstWhere('id', (string) $releasedEarning->id);

        $this->assertNotNull($eligiblePayload);
        $this->assertNotNull($pendingPayload);
        $this->assertNotNull($releasedPayload);

        $this->assertSame('Mutasi Kelas', $eligiblePayload['courseName'] ?? null);
        $this->assertSame(200000.0, (float) ($eligiblePayload['grossAmount'] ?? 0));
        $this->assertSame(25000.0, (float) ($eligiblePayload['companyAmount'] ?? 0));
        $this->assertSame(175000.0, (float) ($eligiblePayload['instructorAmount'] ?? 0));
        $this->assertSame(12.5, (float) ($eligiblePayload['effectiveFeePercentage'] ?? 0));
        $this->assertSame('eligible', $eligiblePayload['status'] ?? null);
        $this->assertNotEmpty($eligiblePayload['earnedAt'] ?? null);

        $this->assertSame('pending', $pendingPayload['status'] ?? null);
        $this->assertSame('released', $releasedPayload['status'] ?? null);

        $payouts = collect($page['props']['payouts'] ?? []);
        $this->assertCount(6, $payouts);
        $this->assertSame(
            $createdPayoutIds->last(),
            $payouts->pluck('id')->first(),
        );
    }

    protected function setUp(): void {
        parent::setUp();

        Artisan::call('migrate:fresh', [
            '--database' => 'sqlite',
            '--path'     => $this->requiredMigrationPaths(),
            '--force'    => true,
        ]);
    }

    private function createCourse(User $instructor, string $title, float $price): Course {
        return Course::query()->create([
            'title'          => $title,
            'description'    => "{$title} description",
            'price'          => $price,
            'level'          => 'beginner',
            'total_hours'    => 3,
            'total_sessions' => 3,
            'created_by'     => $instructor->id,
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
            'database/migrations/0001_01_01_000000_create_preferences_table.php',
            'database/migrations/2025_01_31_135456_create_roles_table.php',
            'database/migrations/2025_01_31_150339_create_permissions_table.php',
            'database/migrations/2025_01_31_152926_create_user_role_table.php',
            'database/migrations/2026_04_26_075938_create_courses_table.php',
            'database/migrations/2026_04_26_075939_create_categories_table.php',
            'database/migrations/2026_04_28_074544_create_course_category_table.php',
            'database/migrations/2026_04_28_074634_create_payments_table.php',
            'database/migrations/2026_04_28_074652_create_enrollments_table.php',
            'database/migrations/2026_05_24_141817_create_admin_user_permissions_table.php',
            'database/migrations/2026_05_24_141817_create_instructor_earnings_table.php',
            'database/migrations/2026_05_24_141817_create_instructor_payout_requests_table.php',
            'database/migrations/2026_05_24_141818_create_instructor_payout_request_items_table.php',
            'database/migrations/2026_06_28_164713_create_notifications_table.php',
            'database/migrations/2026_06_28_173509_add_gate_and_link_to_notifications_table.php',
            'database/migrations/2026_06_28_182100_fix_notifiable_id_type_in_notifications_table.php',
        ];
    }
}
