<?php

namespace Tests\Feature\Core\Approval;

use App\Enums\FormStatus;
use App\Events\Core\DocumentCanceled;
use App\Http\Controllers\Controller;
use App\Listeners\Core\Approval\CancelPendingApprovalSteps;
use App\Models\Core\ApprovalInstance;
use App\Models\Core\ApprovalInstanceStep;
use App\Models\Model as AppModel;
use App\Models\User\Role;
use App\Models\User\User;
use App\Notifications\ApprovalCanceledNotification;
use App\Traits\Submitable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

class CancelPendingApprovalStepsTestDocument extends AppModel {
    use HasUlids, Submitable;

    protected $table   = 'cancel_pending_approval_steps_test_documents';
    protected $guarded = ['id'];

    public function getRouteKeyName(): string {
        return 'id';
    }
}

class CancelPendingApprovalStepsTestDocumentController extends Controller {
    public function __construct(Request $request) {
        parent::__construct($request, CancelPendingApprovalStepsTestDocument::class);
    }

    public function onApproved(CancelPendingApprovalStepsTestDocument $cancelPendingApprovalStepsTestDocument) {
        return back();
    }

    public function onRejected(CancelPendingApprovalStepsTestDocument $cancelPendingApprovalStepsTestDocument) {
        return back();
    }
}

class CancelPendingApprovalStepsTest extends TestCase {
    use RefreshDatabase;

    private string $permissionId;

    protected function setUp(): void {
        parent::setUp();

        foreach (['approval_schemes', 'approval_scheme_steps', 'roles', 'users', 'approval_instances', 'approval_instance_steps', 'general_ledgers', 'stock_ledger_entries'] as $tbl) {
            if (Schema::hasTable($tbl) && ! Schema::hasColumn($tbl, 'is_example')) {
                Schema::table($tbl, fn ($t) => $t->boolean('is_example')->default(false));
            }
        }

        if (! Schema::hasTable('cancel_pending_approval_steps_test_documents')) {
            Schema::create('cancel_pending_approval_steps_test_documents', function ($t) {
                $t->ulid('id')->primary();
                $t->ulid('created_by_id')->nullable();
                $t->string('code')->nullable();
                $t->string('status')->default('draft');
                $t->boolean('is_example')->default(false);
                $t->timestamp('submitted_at')->nullable();
                $t->timestamp('canceled_at')->nullable();
                $t->char('amended_from_id', 26)->nullable();
                $t->integer('revision_number')->default(0);
                $t->timestamps();
                $t->softDeletes();
            });
        }

        $this->permissionId = (string) Str::ulid();
        DB::table('permissions')->insert([
            'id'                 => $this->permissionId,
            'module'             => 'test',
            'name'               => 'CancelPendingApprovalStepsTestDocument',
            'model'              => CancelPendingApprovalStepsTestDocument::class,
            'route'              => 'test',
            'permissions'        => '[]',
            'is_submitable'      => 1,
            'allow_only_creator' => 0,
            'created_at'         => now(),
            'updated_at'         => now(),
        ]);
    }

    private function makeUser(string $name): User {
        $id = (string) Str::ulid();
        DB::table('users')->insert([
            'id'         => $id,
            'name'       => $name,
            'email'      => $id . '@test.com',
            'password'   => null,
            'status'     => 'active',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return User::find($id);
    }

    private function makeRole(string $name): Role {
        $id = (string) Str::ulid();
        DB::table('roles')->insert([
            'id'          => $id,
            'name'        => $name,
            'description' => '',
            'is_disabled' => 0,
            'is_example'  => 0,
            'created_at'  => now(),
            'updated_at'  => now(),
        ]);

        return Role::find($id);
    }

    private function assignRole(User $user, Role $role): void {
        DB::table('user_role')->insertOrIgnore([
            'user_id'    => $user->id,
            'role_id'    => $role->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    /**
     * @param  list<Role>  $roles  urutan sequence step (0-based)
     */
    private function makeScheme(string $name, array $roles): string {
        $schemeId = (string) Str::ulid();
        DB::table('approval_schemes')->insert([
            'id'            => $schemeId,
            'name'          => $name,
            'permission_id' => $this->permissionId,
            'name_model'    => 'CancelPendingApprovalStepsTestDocument',
            'model'         => CancelPendingApprovalStepsTestDocument::class,
            'is_active'     => 1,
            'is_example'    => 0,
            'trigger_on'    => 'submit',
            'created_at'    => now(),
            'updated_at'    => now(),
        ]);

        foreach ($roles as $sequence => $role) {
            DB::table('approval_scheme_steps')->insert([
                'id'                 => (string) Str::ulid(),
                'sequence'           => $sequence,
                'approval_scheme_id' => $schemeId,
                'approver_type'      => 'role',
                'approverable_type'  => Role::class,
                'approverable_id'    => $role->id,
                'is_advanced'        => false,
                'created_at'         => now(),
                'updated_at'         => now(),
            ]);
        }

        return $schemeId;
    }

    private function makeDocument(User $creator): CancelPendingApprovalStepsTestDocument {
        return CancelPendingApprovalStepsTestDocument::create([
            'id'            => (string) Str::ulid(),
            'created_by_id' => $creator->id,
            'code'          => 'DOC-' . Str::random(6),
            'status'        => FormStatus::NEED_APPROVAL,
        ]);
    }

    /**
     * Property 3 — cascade lengkap tanpa sisa: N step PENDING/WAITING
     * sebelum cancel → 0 step PENDING/WAITING setelah listener jalan.
     */
    public function test_cancel_document_cascades_all_pending_and_waiting_steps_to_canceled(): void {
        Notification::fake();
        Queue::fake();

        $roleA   = $this->makeRole('CancelStepARole');
        $roleB   = $this->makeRole('CancelStepBRole');
        $roleC   = $this->makeRole('CancelStepCRole');
        $creator = $this->makeUser('CancelCreator');

        $this->makeScheme('scheme-cancel-cascade', [$roleA, $roleB, $roleC]);

        $doc      = $this->makeDocument($creator);
        $instance = ApprovalInstance::makeInstance($doc, [
            'controller' => CancelPendingApprovalStepsTestDocumentController::class,
            'parameters' => ['cancelPendingApprovalStepsTestDocument' => $doc->id],
        ]);

        $stepsBefore = ApprovalInstanceStep::where('approval_instance_id', $instance->id)->get();
        $this->assertCount(3, $stepsBefore);
        $this->assertEqualsCanonicalizing(
            [FormStatus::PENDING->value, FormStatus::WAITING->value, FormStatus::WAITING->value],
            $stepsBefore->pluck('status')->map(fn ($s) => $s->value)->all(),
        );

        $doc->update(['status' => FormStatus::CANCELED]);

        $stepsAfter                = ApprovalInstanceStep::where('approval_instance_id', $instance->id)->get();
        $remainingPendingOrWaiting = $stepsAfter->whereIn('status', [FormStatus::PENDING, FormStatus::WAITING]);

        $this->assertCount(0, $remainingPendingOrWaiting, 'Tidak boleh ada step PENDING/WAITING tersisa setelah dokumen dibatalkan');
        $this->assertTrue(
            $stepsAfter->every(fn ($step) => $step->status === FormStatus::CANCELED),
            'Semua step seharusnya berstatus CANCELED',
        );
    }

    /**
     * Property 4 — idempotensi: pemanggilan listener berulang pada state
     * yang sama tidak mengubah apa-apa dan tidak error.
     */
    public function test_listener_is_idempotent_when_called_multiple_times(): void {
        Notification::fake();
        Queue::fake();

        $roleA   = $this->makeRole('IdempotentRoleA');
        $creator = $this->makeUser('IdempotentCreator');

        $this->makeScheme('scheme-idempotent', [$roleA]);

        $doc      = $this->makeDocument($creator);
        $instance = ApprovalInstance::makeInstance($doc, [
            'controller' => CancelPendingApprovalStepsTestDocumentController::class,
            'parameters' => ['cancelPendingApprovalStepsTestDocument' => $doc->id],
        ]);

        $doc->update(['status' => FormStatus::CANCELED]);

        $stateAfterFirstCancel = ApprovalInstanceStep::where('approval_instance_id', $instance->id)
            ->get(['id', 'status'])
            ->map(fn ($s) => [$s->id, $s->status->value])
            ->all();

        $event    = new DocumentCanceled($doc, $instance->fresh());
        $listener = new CancelPendingApprovalSteps;

        // Jalankan listener berulang — tidak boleh error, state tidak boleh berubah.
        $listener->handle($event);
        $listener->handle($event);
        $listener->handle($event);

        $stateAfterRepeatedCalls = ApprovalInstanceStep::where('approval_instance_id', $instance->id)
            ->get(['id', 'status'])
            ->map(fn ($s) => [$s->id, $s->status->value])
            ->all();

        $this->assertEquals($stateAfterFirstCancel, $stateAfterRepeatedCalls);
    }

    /**
     * Property 5 — notifikasi tidak terpengaruh: ApprovalCanceledNotification
     * tetap terkirim seperti sebelum perubahan ini.
     */
    public function test_cancel_notification_still_sent_alongside_cascade(): void {
        Notification::fake();
        Queue::fake();

        $roleA    = $this->makeRole('NotifRoleA');
        $roleB    = $this->makeRole('NotifRoleB');
        $approver = $this->makeUser('NotifApproverA');
        $this->assignRole($approver, $roleA);
        $creator = $this->makeUser('NotifCreator');

        $this->makeScheme('scheme-notif-cancel', [$roleA, $roleB]);

        $doc = $this->makeDocument($creator);
        ApprovalInstance::makeInstance($doc, [
            'controller' => CancelPendingApprovalStepsTestDocumentController::class,
            'parameters' => ['cancelPendingApprovalStepsTestDocument' => $doc->id],
        ]);

        $doc->update(['status' => FormStatus::CANCELED]);

        Notification::assertSentTo($approver, ApprovalCanceledNotification::class);
    }

    public function test_document_without_approval_instance_is_noop(): void {
        Notification::fake();
        Queue::fake();

        $creator = $this->makeUser('NoApprovalCreator');
        $doc     = $this->makeDocument($creator);

        // Tidak ada scheme aktif → tidak ada ApprovalInstance dibuat.
        $doc->update(['status' => FormStatus::CANCELED]);

        $this->assertNull($doc->fresh()->approvalable);
        Notification::assertNothingSent();
    }

    public function test_advanced_step_child_approvers_pending_are_cascaded_but_decided_ones_are_not(): void {
        Notification::fake();
        Queue::fake();

        $roleA   = $this->makeRole('AdvancedRoleA');
        $creator = $this->makeUser('AdvancedCreator');

        $schemeId = (string) Str::ulid();
        DB::table('approval_schemes')->insert([
            'id'            => $schemeId,
            'name'          => 'scheme-advanced-cascade',
            'permission_id' => $this->permissionId,
            'name_model'    => 'CancelPendingApprovalStepsTestDocument',
            'model'         => CancelPendingApprovalStepsTestDocument::class,
            'is_active'     => 1,
            'is_example'    => 0,
            'trigger_on'    => 'submit',
            'created_at'    => now(),
            'updated_at'    => now(),
        ]);
        $stepId = (string) Str::ulid();
        DB::table('approval_scheme_steps')->insert([
            'id'                 => $stepId,
            'sequence'           => 0,
            'approval_scheme_id' => $schemeId,
            'approver_type'      => 'role',
            'approverable_type'  => Role::class,
            'approverable_id'    => $roleA->id,
            'is_advanced'        => true,
            'created_at'         => now(),
            'updated_at'         => now(),
        ]);

        $doc      = $this->makeDocument($creator);
        $instance = ApprovalInstance::makeInstance($doc, [
            'controller' => CancelPendingApprovalStepsTestDocumentController::class,
            'parameters' => ['cancelPendingApprovalStepsTestDocument' => $doc->id],
        ]);

        $step = ApprovalInstanceStep::where('approval_instance_id', $instance->id)->first();

        // Simulasikan 1 approver anak sudah APPROVED, 1 lagi masih PENDING.
        $decidedApproverId = (string) Str::ulid();
        DB::table('approval_instance_step_approvers')->insert([
            'id'                        => $decidedApproverId,
            'approval_instance_step_id' => $step->id,
            'approver_type'             => 'role',
            'approverable_type'         => Role::class,
            'approverable_id'           => $roleA->id,
            'status'                    => FormStatus::APPROVED->value,
            'created_at'                => now(),
            'updated_at'                => now(),
        ]);
        $pendingApproverId = (string) Str::ulid();
        DB::table('approval_instance_step_approvers')->insert([
            'id'                        => $pendingApproverId,
            'approval_instance_step_id' => $step->id,
            'approver_type'             => 'role',
            'approverable_type'         => Role::class,
            'approverable_id'           => $roleA->id,
            'status'                    => FormStatus::PENDING->value,
            'created_at'                => now(),
            'updated_at'                => now(),
        ]);

        $doc->update(['status' => FormStatus::CANCELED]);

        $decidedApprover = DB::table('approval_instance_step_approvers')->where('id', $decidedApproverId)->first();
        $pendingApprover = DB::table('approval_instance_step_approvers')->where('id', $pendingApproverId)->first();

        $this->assertEquals(FormStatus::APPROVED->value, $decidedApprover->status, 'Approver yang sudah APPROVED tidak boleh ditimpa');
        $this->assertEquals(FormStatus::CANCELED->value, $pendingApprover->status, 'Approver PENDING harus ikut ter-cancel');
    }
}
