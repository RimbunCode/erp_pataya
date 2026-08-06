<?php

namespace Tests\Feature\Core\Notification;

use App\Enums\FormStatus;
use App\Http\Controllers\Controller;
use App\Http\Middleware\AppMiddleware;
use App\Http\Middleware\EnsureUserIsOnboarded;
use App\Http\Middleware\LanguageMiddleware;
use App\Models\Core\ApprovalInstance;
use App\Models\Core\ApprovalInstanceStep;
use App\Models\Model as AppModel;
use App\Models\User\Role;
use App\Models\User\User;
use App\Notifications\ApprovalCanceledNotification;
use App\Notifications\ApprovalDecidedNotification;
use App\Notifications\ApprovalPendingNotification;
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

class ApprovalNotificationTestDocument extends AppModel {
    use HasUlids, Submitable;

    protected $table   = 'approval_notification_test_documents';
    protected $guarded = ['id'];

    public function getRouteKeyName(): string {
        return 'id';
    }
}

class ApprovalNotificationTestDocumentController extends Controller {
    public function __construct(Request $request) {
        parent::__construct($request, ApprovalNotificationTestDocument::class);
    }

    public function onApproved(mixed $id) {
        return back();
    }

    public function onRejected(mixed $id) {
        return back();
    }
}

class ApprovalNotificationTest extends TestCase {
    use RefreshDatabase;

    private string $permissionId;

    protected function setUp(): void {
        parent::setUp();

        foreach (['approval_schemes', 'approval_scheme_steps', 'roles', 'users', 'approval_instances', 'approval_instance_steps', 'general_ledgers', 'stock_ledger_entries', 'branches'] as $tbl) {
            if (Schema::hasTable($tbl) && ! Schema::hasColumn($tbl, 'is_example')) {
                Schema::table($tbl, fn ($t) => $t->boolean('is_example')->default(false));
            }
        }

        if (! Schema::hasTable('approval_notification_test_documents')) {
            Schema::create('approval_notification_test_documents', function ($t) {
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
            'name'               => 'ApprovalNotificationTestDocument',
            'model'              => ApprovalNotificationTestDocument::class,
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

    private function makeScheme(string $name, array $steps): string {
        $schemeId = (string) Str::ulid();
        DB::table('approval_schemes')->insert([
            'id'            => $schemeId,
            'name'          => $name,
            'permission_id' => $this->permissionId,
            'name_model'    => 'ApprovalNotificationTestDocument',
            'model'         => ApprovalNotificationTestDocument::class,
            'is_active'     => 1,
            'is_example'    => 0,
            'trigger_on'    => 'submit',
            'created_at'    => now(),
            'updated_at'    => now(),
        ]);

        foreach ($steps as $sequence => $role) {
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

    private function makeDocument(User $creator): ApprovalNotificationTestDocument {
        return ApprovalNotificationTestDocument::create([
            'id'            => (string) Str::ulid(),
            'created_by_id' => $creator->id,
            'code'          => 'DOC-' . Str::random(6),
            'status'        => FormStatus::NEED_APPROVAL,
        ]);
    }

    private function decideViaHttp(User $approver, ApprovalInstanceStep $step, string $decision) {
        return $this->actingAs($approver)
            ->withoutMiddleware([AppMiddleware::class, EnsureUserIsOnboarded::class, LanguageMiddleware::class])
            ->postJson(route('approvalInstances.decision', $step->id), ['decision' => $decision]);
    }

    public function test_final_approval_notifies_creator(): void {
        Notification::fake();
        Queue::fake();

        $role     = $this->makeRole('ApproverRoleA');
        $approver = $this->makeUser('ApproverA');
        $this->assignRole($approver, $role);
        $creator = $this->makeUser('CreatorA');

        $this->makeScheme('scheme-final', [$role]);

        $doc      = $this->makeDocument($creator);
        $instance = ApprovalInstance::makeInstance($doc, [
            'controller' => ApprovalNotificationTestDocumentController::class,
            'parameters' => ['approvalNotificationTestDocument' => $doc->id],
        ]);
        $step = ApprovalInstanceStep::where('approval_instance_id', $instance->id)->first();

        $response = $this->decideViaHttp($approver, $step, 'approve');

        $this->assertNotEquals(500, $response->getStatusCode(), (string) $response->getContent());
        $this->assertEquals(FormStatus::APPROVED->value, $instance->fresh()->status->value);

        Notification::assertSentTo(
            $creator,
            ApprovalDecidedNotification::class,
            fn ($notification) => $notification->decision === 'approved',
        );
    }

    public function test_reject_notifies_creator_with_notes(): void {
        Notification::fake();
        Queue::fake();

        $role     = $this->makeRole('ApproverRoleB');
        $approver = $this->makeUser('ApproverB');
        $this->assignRole($approver, $role);
        $creator = $this->makeUser('CreatorB');

        $this->makeScheme('scheme-reject', [$role]);

        $doc      = $this->makeDocument($creator);
        $instance = ApprovalInstance::makeInstance($doc, [
            'controller' => ApprovalNotificationTestDocumentController::class,
            'parameters' => ['approvalNotificationTestDocument' => $doc->id],
        ]);
        $step = ApprovalInstanceStep::where('approval_instance_id', $instance->id)->first();

        $response = $this->actingAs($approver)
            ->withoutMiddleware([AppMiddleware::class, EnsureUserIsOnboarded::class, LanguageMiddleware::class])
            ->postJson(route('approvalInstances.decision', $step->id), ['decision' => 'reject', 'notes' => 'kurang lengkap']);

        $this->assertNotEquals(500, $response->getStatusCode(), (string) $response->getContent());
        $this->assertEquals(FormStatus::REJECTED->value, $instance->fresh()->status->value);

        Notification::assertSentTo(
            $creator,
            ApprovalDecidedNotification::class,
            fn ($notification) => $notification->decision === 'rejected' && $notification->notes === 'kurang lengkap',
        );
    }

    public function test_intermediate_step_approval_notifies_next_step_role_candidates(): void {
        Notification::fake();
        Queue::fake();

        $roleA      = $this->makeRole('StepARole');
        $roleB      = $this->makeRole('StepBRole');
        $approverA  = $this->makeUser('StepAApprover');
        $approverB1 = $this->makeUser('StepBApprover1');
        $approverB2 = $this->makeUser('StepBApprover2');
        $this->assignRole($approverA, $roleA);
        $this->assignRole($approverB1, $roleB);
        $this->assignRole($approverB2, $roleB);
        $creator = $this->makeUser('CreatorC');

        $this->makeScheme('scheme-two-step', [$roleA, $roleB]);

        $doc      = $this->makeDocument($creator);
        $instance = ApprovalInstance::makeInstance($doc, [
            'controller' => ApprovalNotificationTestDocumentController::class,
            'parameters' => ['approvalNotificationTestDocument' => $doc->id],
        ]);
        $firstStep = ApprovalInstanceStep::where('approval_instance_id', $instance->id)->where('sequence', 0)->first();

        // Step pertama sudah dapat notifikasi pending saat instance dibuat.
        Notification::assertSentTo($approverA, ApprovalPendingNotification::class);

        $response = $this->decideViaHttp($approverA, $firstStep, 'approve');
        $this->assertNotEquals(500, $response->getStatusCode(), (string) $response->getContent());

        // Instance belum selesai (masih ada step B) — creator TIDAK dapat ApprovalDecidedNotification dulu.
        Notification::assertNotSentTo($creator, ApprovalDecidedNotification::class);

        // KEDUA user role B dapat notifikasi pending (bukan cuma satu).
        Notification::assertSentTo($approverB1, ApprovalPendingNotification::class);
        Notification::assertSentTo($approverB2, ApprovalPendingNotification::class);
    }

    public function test_auto_approved_first_step_does_not_send_pending_notification(): void {
        Notification::fake();
        Queue::fake();

        $role    = $this->makeRole('SelfApproverRole');
        $creator = $this->makeUser('SelfApproverCreator');
        $this->assignRole($creator, $role);

        $this->makeScheme('scheme-auto-approve', [$role]);

        $doc = $this->makeDocument($creator);

        // makeInstance() dipanggil "sebagai" creator (auto-approve pass
        // mendeteksi requester = approver step 0) — di test ini creator
        // memang requester-nya (bukan actingAs terpisah, cukup created_by_id).
        ApprovalInstance::makeInstance($doc, [
            'controller' => ApprovalNotificationTestDocumentController::class,
            'parameters' => ['approvalNotificationTestDocument' => $doc->id],
        ]);

        Notification::assertNothingSentTo($creator);
    }

    public function test_cancel_with_pending_approval_notifies_candidate_approvers(): void {
        Notification::fake();
        Queue::fake();

        $role     = $this->makeRole('CancelRole');
        $approver = $this->makeUser('CancelApprover');
        $this->assignRole($approver, $role);
        $creator = $this->makeUser('CancelCreator');

        $this->makeScheme('scheme-cancel', [$role]);

        $doc = $this->makeDocument($creator);
        ApprovalInstance::makeInstance($doc, [
            'controller' => ApprovalNotificationTestDocumentController::class,
            'parameters' => ['approvalNotificationTestDocument' => $doc->id],
        ]);

        $doc->update(['status' => FormStatus::CANCELED]);

        Notification::assertSentTo($approver, ApprovalCanceledNotification::class);
    }

    public function test_cancel_after_full_approval_sends_no_new_notification(): void {
        Notification::fake();
        Queue::fake();

        $role     = $this->makeRole('CancelApprovedRole');
        $approver = $this->makeUser('CancelApprovedApprover');
        $this->assignRole($approver, $role);
        $creator = $this->makeUser('CancelApprovedCreator');

        $this->makeScheme('scheme-cancel-approved', [$role]);

        $doc      = $this->makeDocument($creator);
        $instance = ApprovalInstance::makeInstance($doc, [
            'controller' => ApprovalNotificationTestDocumentController::class,
            'parameters' => ['approvalNotificationTestDocument' => $doc->id],
        ]);
        $step = ApprovalInstanceStep::where('approval_instance_id', $instance->id)->first();
        $this->decideViaHttp($approver, $step, 'approve');

        Notification::fake(); // reset — hanya peduli event setelah titik ini

        $doc->fresh()->update(['status' => FormStatus::CANCELED]);

        Notification::assertNothingSent();
    }
}
