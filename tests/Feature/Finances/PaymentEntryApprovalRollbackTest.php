<?php

namespace Tests\Feature\Finances;

use App\Enums\FormStatus;
use App\Events\Core\ApprovalDecided;
use App\Http\Middleware\AppMiddleware;
use App\Http\Middleware\EnsureUserIsOnboarded;
use App\Http\Middleware\LanguageMiddleware;
use App\Models\Core\ApprovalInstance;
use App\Models\Core\ApprovalInstanceStep;
use App\Models\Finances\Account;
use App\Models\Finances\Journal;
use App\Models\Finances\PaymentEntry;
use App\Models\Finances\PaymentSchedule;
use App\Models\Finances\PostingProfile;
use App\Models\Finances\SalesInvoice;
use App\Models\User\Role;
use App\Models\User\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Testing\TestResponse;
use Tests\Support\BuildsFinanceFixtures;
use Tests\Support\EnablesEnginePosting;
use Tests\TestCase;

/**
 * Approve berskema atas Payment Entry (Requirement 13.7, Q-P2-40): kegagalan `onApproved` (peran akun tak
 * ter-resolve) menggulung keputusan approval sehingga instance dan step tetap pending, dokumen tetap
 * `need_approval`, dan approver dapat mengulang setelah Posting Profile dilengkapi.
 */
class PaymentEntryApprovalRollbackTest extends TestCase {
    use BuildsFinanceFixtures, EnablesEnginePosting, RefreshDatabase;

    private Account $cash;
    private Account $receivable;
    private PaymentEntry $payment;
    private ApprovalInstanceStep $step;

    protected function setUp(): void {
        parent::setUp();

        $this->setUpFinanceFixtures([SalesInvoice::class, PaymentSchedule::class, PaymentEntry::class, PostingProfile::class]);
        $this->cash       = $this->makeAccount('1100', 'Kas', 'asset', 'debit', 'cash');
        $this->receivable = $this->makeAccount('1200', 'Piutang Usaha', 'asset', 'debit', 'accounts_receivable');
        $this->enableEnginePosting(['receivable' => $this->receivable]);
        $method = $this->makeCashPaymentMethod($this->cash);

        $invoice       = $this->makeUnpaidSalesInvoice(1_000_000);
        $this->payment = $this->makePaymentEntry($invoice, 1_000_000, $this->receivable, $this->cash, ['payment_method_id' => $method->id, 'status' => [FormStatus::NEED_APPROVAL]]);

        $role = Role::create(['name' => 'Approver Pembayaran', 'description' => '']);
        DB::table('user_role')->insert(['user_id' => $this->user->id, 'role_id' => $role->id, 'created_at' => now(), 'updated_at' => now()]);

        // Pembuat dokumen berbeda dari approver agar tidak ter-auto-approve.
        $creator = User::factory()->create();
        $this->payment->forceFill(['created_by_id' => $creator->id])->saveQuietly();
        $this->role = $role;
    }

    private Role $role;

    private function createInstance(bool $advanced): void {
        $schemeId = (string) str()->ulid();
        DB::table('approval_schemes')->insert([
            'id'            => $schemeId,
            'name'          => 'Skema Payment Entry',
            'permission_id' => DB::table('permissions')->where('model', PaymentEntry::class)->value('id'),
            'name_model'    => 'PaymentEntry',
            'model'         => PaymentEntry::class,
            'is_active'     => 1,
            'is_example'    => 0,
            'trigger_on'    => 'submit',
            'created_at'    => now(),
            'updated_at'    => now(),
        ]);
        $stepId = (string) str()->ulid();
        DB::table('approval_scheme_steps')->insert([
            'id'                 => $stepId,
            'sequence'           => 0,
            'approval_scheme_id' => $schemeId,
            'approver_type'      => 'role',
            'approverable_type'  => Role::class,
            'approverable_id'    => $this->role->id,
            'is_advanced'        => $advanced,
            'created_at'         => now(),
            'updated_at'         => now(),
        ]);
        if ($advanced) {
            $other = Role::create(['name' => 'Approver Paralel', 'description' => '']);
            foreach ([$this->role, $other] as $approverRole) {
                DB::table('approval_scheme_step_approvers')->insert([
                    'id'                      => (string) str()->ulid(),
                    'approval_scheme_step_id' => $stepId,
                    'approver_type'           => 'role',
                    'approverable_type'       => Role::class,
                    'approverable_id'         => $approverRole->id,
                    'created_at'              => now(),
                    'updated_at'              => now(),
                ]);
            }
        }

        $instance   = ApprovalInstance::makeInstance($this->payment);
        $this->step = ApprovalInstanceStep::where('approval_instance_id', $instance->id)->firstOrFail();
        $this->assertSame(FormStatus::PENDING->value, $this->step->status->value);
    }

    private function approve(): TestResponse {
        return $this->actingAs($this->user)
            ->withoutMiddleware([AppMiddleware::class, EnsureUserIsOnboarded::class, LanguageMiddleware::class])
            ->postJson(route('approvalInstances.decision', $this->step->id), ['decision' => 'approve']);
    }

    public function test_unresolved_role_rolls_back_the_approval_so_the_approver_can_retry_after_the_profile_is_completed(): void {
        $this->createInstance(false);
        Event::fake([ApprovalDecided::class]);
        $level = DB::transactionLevel();
        Account::whereKey($this->receivable->id)->update(['is_group' => true]);

        $this->approve()->assertStatus(422)->assertJsonValidationErrors(['status']);

        Event::assertNotDispatched(ApprovalDecided::class);
        $this->assertSame($level, DB::transactionLevel(), 'Tidak ada transaksi menggantung.');
        $this->assertSame(FormStatus::PENDING->value, $this->step->fresh()->status->value);
        $this->assertNull($this->step->fresh()->acted_by_id);
        $this->assertSame(FormStatus::PENDING->value, $this->step->approvalInstance->fresh()->status->value);
        $this->assertContains(FormStatus::NEED_APPROVAL, $this->payment->fresh()->status);
        $this->assertSame(0, Journal::query()->count());

        // Profil dilengkapi: approve ulang berhasil.
        Account::whereKey($this->receivable->id)->update(['is_group' => false]);
        $this->approve()->assertRedirect();

        Event::assertDispatched(ApprovalDecided::class, 1);
        $this->assertSame(FormStatus::APPROVED->value, $this->step->fresh()->status->value);
        $this->assertSame(FormStatus::APPROVED->value, $this->step->approvalInstance->fresh()->status->value);
        $this->assertContains(FormStatus::PAID, $this->payment->fresh()->status);
        $this->assertSame(1, Journal::query()->count());
    }

    public function test_parallel_approver_child_rows_return_to_pending_after_rollback(): void {
        $this->createInstance(true);
        Event::fake([ApprovalDecided::class]);
        Account::whereKey($this->receivable->id)->update(['is_group' => true]);

        $this->approve()->assertStatus(422);

        Event::assertNotDispatched(ApprovalDecided::class);
        $this->assertSame(FormStatus::PENDING->value, $this->step->fresh()->status->value);
        $children = $this->step->approvers()->get();
        $this->assertCount(2, $children);
        $this->assertTrue($children->every(fn ($child) => $child->status->value === FormStatus::PENDING->value && $child->acted_by_id === null));
        $this->assertContains(FormStatus::NEED_APPROVAL, $this->payment->fresh()->status);

        Account::whereKey($this->receivable->id)->update(['is_group' => false]);
        $this->approve()->assertRedirect();

        $this->assertSame(FormStatus::APPROVED->value, $this->step->fresh()->status->value);
        $this->assertSame(FormStatus::APPROVED->value, $this->step->approvalInstance->fresh()->status->value);
        $this->assertContains(FormStatus::PAID, $this->payment->fresh()->status);
    }
}
