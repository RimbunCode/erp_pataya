<?php

namespace Tests\Feature\Core;

use App\FormStatus;
use App\Http\Middleware\AppMiddleware;
use App\Http\Middleware\EnsureUserIsOnboarded;
use App\Http\Middleware\LanguageMiddleware;
use App\Models\Core\ApprovalInstance;
use App\Models\Core\ApprovalInstanceStep;
use App\Models\Model as AppModel;
use App\Models\User\Role;
use App\Models\User\User;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

// Dokumen stub — cukup punya id & created_by_id
class ApprovalTestDocument extends AppModel {
    use HasUlids;

    protected $table   = 'approval_test_documents';
    protected $guarded = ['id'];
    public $timestamps = false;

    public function getRouteKeyName(): string {
        return 'id';
    }
}

class ApprovalAutoApproveTest extends TestCase {
    use RefreshDatabase;

    private string $permissionId;

    protected function setUp(): void {
        parent::setUp();

        // Kolom is_example & have_transactions ditambah via initPermissions() di prod (bukan migration).
        // Tambahkan manual agar global scope HasExampleData tidak error di SQLite.
        $tablesNeedingIsExample = [
            'approval_schemes', 'approval_scheme_steps', 'roles', 'users',
            'approval_instances', 'approval_instance_steps',
        ];
        foreach ($tablesNeedingIsExample as $tbl) {
            if (Schema::hasTable($tbl) && ! Schema::hasColumn($tbl, 'is_example')) {
                Schema::table($tbl, fn ($t) => $t->boolean('is_example')->default(false));
            }
        }

        // Buat tabel dokumen stub jika belum ada
        if (! Schema::hasTable('approval_test_documents')) {
            Schema::create('approval_test_documents', function ($t) {
                $t->ulid('id')->primary();
                $t->ulid('created_by_id')->nullable();
            });
        }

        // Insert permission dummy
        $this->permissionId = (string) str()->ulid();
        DB::table('permissions')->insert([
            'id'                 => $this->permissionId,
            'module'             => 'test',
            'name'               => 'ApprovalTestDocument',
            'model'              => ApprovalTestDocument::class,
            'route'              => 'test',
            'permissions'        => '[]',
            'is_submitable'      => 1,
            'allow_only_creator' => 0,
            'created_at'         => now(),
            'updated_at'         => now(),
        ]);
    }

    private function makeUser(?string $name = null): User {
        $id = (string) str()->ulid();
        DB::table('users')->insert([
            'id'         => $id,
            'name'       => $name ?? 'User ' . $id,
            'email'      => $id . '@test.com',
            'password'   => null,
            'status'     => 'active',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return User::find($id);
    }

    private function makeRole(string $name = 'TestRole'): Role {
        $id = (string) str()->ulid();
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
        $schemeId = (string) str()->ulid();
        DB::table('approval_schemes')->insert([
            'id'            => $schemeId,
            'name'          => $name,
            'permission_id' => $this->permissionId,
            'name_model'    => 'ApprovalTestDocument',
            'model'         => ApprovalTestDocument::class,
            'is_active'     => 1,
            'is_example'    => 0,
            'trigger_on'    => 'submit',
            'created_at'    => now(),
            'updated_at'    => now(),
        ]);

        foreach ($steps as $index => $step) {
            $stepId = (string) str()->ulid();
            DB::table('approval_scheme_steps')->insert([
                'id'                 => $stepId,
                'sequence'           => $index,
                'approval_scheme_id' => $schemeId,
                'approver_type'      => $step['approver_type'],
                'approverable_type'  => $step['approverable_type'],
                'approverable_id'    => $step['approverable_id'],
                'is_advanced'        => $step['is_advanced'] ?? false,
                'created_at'         => now(),
                'updated_at'         => now(),
            ]);

            if (! empty($step['approvers'])) {
                foreach ($step['approvers'] as $childApprover) {
                    DB::table('approval_scheme_step_approvers')->insert([
                        'id'                      => (string) str()->ulid(),
                        'approval_scheme_step_id' => $stepId,
                        'approver_type'           => $childApprover['approver_type'],
                        'approverable_type'       => $childApprover['approverable_type'],
                        'approverable_id'         => $childApprover['approverable_id'],
                        'created_at'              => now(),
                        'updated_at'              => now(),
                    ]);
                }
            }
        }

        return $schemeId;
    }

    private function makeDocument(User $creator): ApprovalTestDocument {
        $id = (string) str()->ulid();
        DB::table('approval_test_documents')->insert([
            'id'            => $id,
            'created_by_id' => $creator->id,
        ]);

        return ApprovalTestDocument::find($id);
    }

    /**
     * Contoh 1 dari spec:
     * Step 0 = Role A (requester punya role A)
     * Step 1 = Role B
     * → step 0 auto-APPROVED, step 1 PENDING, instance PENDING
     */
    public function test_auto_approve_example_1_partial(): void {
        $roleA     = $this->makeRole('RoleA');
        $roleB     = $this->makeRole('RoleB');
        $requester = $this->makeUser('Requester');
        $this->assignRole($requester, $roleA);

        $this->makeScheme('scheme-ex1', [
            [
                'approver_type'     => 'role',
                'approverable_type' => Role::class,
                'approverable_id'   => $roleA->id,
            ],
            [
                'approver_type'     => 'role',
                'approverable_type' => Role::class,
                'approverable_id'   => $roleB->id,
            ],
        ]);

        $doc      = $this->makeDocument($requester);
        $instance = ApprovalInstance::makeInstance($doc);

        $this->assertNotNull($instance);
        $this->assertEquals(FormStatus::PENDING->value, $instance->fresh()->status->value);

        $steps = ApprovalInstanceStep::where('approval_instance_id', $instance->id)
            ->orderBy('sequence')
            ->get();

        $this->assertEquals(FormStatus::APPROVED->value, $steps[0]->status->value);
        $this->assertEquals($requester->id, $steps[0]->acted_by_id);
        $this->assertEquals(FormStatus::PENDING->value, $steps[1]->status->value);
    }

    /**
     * Contoh 2 dari spec:
     * Step 0 = Role A
     * Step 1 = Role A (requester punya role A → last match = step 1)
     * → step 0 SKIPPED, step 1 APPROVED, instance APPROVED, onApproved fired
     */
    public function test_auto_approve_example_2_full(): void {
        $roleA     = $this->makeRole('RoleA2');
        $requester = $this->makeUser('Requester2');
        $this->assignRole($requester, $roleA);

        $this->makeScheme('scheme-ex2', [
            [
                'approver_type'     => 'role',
                'approverable_type' => Role::class,
                'approverable_id'   => $roleA->id,
            ],
            [
                'approver_type'     => 'role',
                'approverable_type' => Role::class,
                'approverable_id'   => $roleA->id,
            ],
        ]);

        $doc      = $this->makeDocument($requester);
        $instance = ApprovalInstance::makeInstance($doc);

        $this->assertNotNull($instance);
        $this->assertEquals(FormStatus::APPROVED->value, $instance->fresh()->status->value);

        $steps = ApprovalInstanceStep::where('approval_instance_id', $instance->id)
            ->orderBy('sequence')
            ->get();

        $this->assertEquals(FormStatus::SKIPPED->value, $steps[0]->status->value);
        $this->assertEquals(FormStatus::APPROVED->value, $steps[1]->status->value);
        $this->assertEquals($requester->id, $steps[1]->acted_by_id);
    }

    /**
     * Multi-approver (is_advanced): step 0 punya 2 approver (roleA, roleB).
     * Requester punya roleA → step auto-APPROVED, approver roleA = APPROVED, roleB = SKIPPED.
     */
    public function test_auto_approve_advanced_step_with_matching_child_approver(): void {
        $roleA     = $this->makeRole('RoleA3');
        $roleB     = $this->makeRole('RoleB3');
        $requester = $this->makeUser('Requester3');
        $this->assignRole($requester, $roleA);

        $this->makeScheme('scheme-adv', [
            [
                'approver_type'     => 'role',
                'approverable_type' => Role::class,
                'approverable_id'   => $roleA->id,
                'is_advanced'       => true,
                'approvers'         => [
                    [
                        'approver_type'     => 'role',
                        'approverable_type' => Role::class,
                        'approverable_id'   => $roleA->id,
                    ],
                    [
                        'approver_type'     => 'role',
                        'approverable_type' => Role::class,
                        'approverable_id'   => $roleB->id,
                    ],
                ],
            ],
        ]);

        $doc      = $this->makeDocument($requester);
        $instance = ApprovalInstance::makeInstance($doc);

        $this->assertNotNull($instance);
        $this->assertEquals(FormStatus::APPROVED->value, $instance->fresh()->status->value);

        $step = ApprovalInstanceStep::where('approval_instance_id', $instance->id)->first();
        $this->assertEquals(FormStatus::APPROVED->value, $step->status->value);

        $childApprovers = $step->approvers()->orderBy('created_at')->get();
        $this->assertEquals(FormStatus::APPROVED->value, $childApprovers[0]->status->value);
        $this->assertEquals($requester->id, $childApprovers[0]->acted_by_id);
        $this->assertEquals(FormStatus::SKIPPED->value, $childApprovers[1]->status->value);
    }

    /**
     * Backward-compat: single-approver biasa, requester BUKAN approver → tidak ada auto-approve.
     */
    public function test_single_approver_no_match_stays_pending(): void {
        $roleA     = $this->makeRole('RoleA4');
        $roleB     = $this->makeRole('RoleB4');
        $requester = $this->makeUser('Requester4');
        $this->assignRole($requester, $roleA);

        $this->makeScheme('scheme-noauto', [
            [
                'approver_type'     => 'role',
                'approverable_type' => Role::class,
                'approverable_id'   => $roleB->id,
            ],
        ]);

        $doc      = $this->makeDocument($requester);
        $instance = ApprovalInstance::makeInstance($doc);

        $this->assertNotNull($instance);
        $this->assertEquals(FormStatus::PENDING->value, $instance->fresh()->status->value);

        $step = ApprovalInstanceStep::where('approval_instance_id', $instance->id)->first();
        $this->assertEquals(FormStatus::PENDING->value, $step->status->value);
        $this->assertNull($step->acted_by_id);
    }

    /**
     * Race approve: approver A approve dulu → step APPROVED, approver B child SKIPPED, instance APPROVED.
     */
    public function test_race_approve_first_approver_wins(): void {
        $roleA     = $this->makeRole('RaceRoleA');
        $roleB     = $this->makeRole('RaceRoleB');
        $approverA = $this->makeUser('ApproverA');
        $approverB = $this->makeUser('ApproverB');
        $this->assignRole($approverA, $roleA);
        $this->assignRole($approverB, $roleB);

        $creator = $this->makeUser('CreatorRace');

        $this->makeScheme('scheme-race-approve', [
            [
                'approver_type'     => 'role',
                'approverable_type' => Role::class,
                'approverable_id'   => $roleA->id,
                'is_advanced'       => true,
                'approvers'         => [
                    [
                        'approver_type'     => 'role',
                        'approverable_type' => Role::class,
                        'approverable_id'   => $roleA->id,
                    ],
                    [
                        'approver_type'     => 'role',
                        'approverable_type' => Role::class,
                        'approverable_id'   => $roleB->id,
                    ],
                ],
            ],
        ]);

        $doc      = $this->makeDocument($creator);
        $instance = ApprovalInstance::makeInstance($doc);
        $step     = ApprovalInstanceStep::where('approval_instance_id', $instance->id)->first();

        // approverA approve via HTTP
        $this->actingAs($approverA)
            ->withoutMiddleware([
                AppMiddleware::class,
                EnsureUserIsOnboarded::class,
                LanguageMiddleware::class,
            ])
            ->postJson(route('approvalInstances.decision', $step->id), [
                'decision' => 'approve',
            ]);

        $step->refresh();
        $this->assertEquals(FormStatus::APPROVED->value, $step->status->value);
        $this->assertEquals($approverA->id, $step->acted_by_id);

        $childApprovers = $step->approvers()->orderBy('created_at')->get();
        $approvedChild  = $childApprovers->firstWhere('approverable_id', $roleA->id);
        $skippedChild   = $childApprovers->firstWhere('approverable_id', $roleB->id);

        $this->assertEquals(FormStatus::APPROVED->value, $approvedChild->status->value);
        $this->assertEquals($approverA->id, $approvedChild->acted_by_id);
        $this->assertEquals(FormStatus::SKIPPED->value, $skippedChild->status->value);

        // instance APPROVED (single step)
        $this->assertEquals(FormStatus::APPROVED->value, $instance->fresh()->status->value);
    }

    /**
     * Race reject: approver A reject → step REJECTED, approver B child SKIPPED, instance REJECTED.
     */
    public function test_race_reject_first_approver_rejects(): void {
        $roleA     = $this->makeRole('RejectRoleA');
        $roleB     = $this->makeRole('RejectRoleB');
        $approverA = $this->makeUser('RejectApproverA');
        $approverB = $this->makeUser('RejectApproverB');
        $this->assignRole($approverA, $roleA);
        $this->assignRole($approverB, $roleB);

        $creator = $this->makeUser('CreatorReject');

        $this->makeScheme('scheme-race-reject', [
            [
                'approver_type'     => 'role',
                'approverable_type' => Role::class,
                'approverable_id'   => $roleA->id,
                'is_advanced'       => true,
                'approvers'         => [
                    [
                        'approver_type'     => 'role',
                        'approverable_type' => Role::class,
                        'approverable_id'   => $roleA->id,
                    ],
                    [
                        'approver_type'     => 'role',
                        'approverable_type' => Role::class,
                        'approverable_id'   => $roleB->id,
                    ],
                ],
            ],
            [
                'approver_type'     => 'role',
                'approverable_type' => Role::class,
                'approverable_id'   => $roleB->id,
            ],
        ]);

        $doc      = $this->makeDocument($creator);
        $instance = ApprovalInstance::makeInstance($doc);
        $step     = ApprovalInstanceStep::where('approval_instance_id', $instance->id)
            ->where('sequence', 0)
            ->first();

        // approverA reject via HTTP (bypass onboarding/app/language middleware)
        $this->actingAs($approverA)
            ->withoutMiddleware([
                AppMiddleware::class,
                EnsureUserIsOnboarded::class,
                LanguageMiddleware::class,
            ])
            ->postJson(route('approvalInstances.decision', $step->id), [
                'decision' => 'reject',
            ]);

        $step->refresh();
        $this->assertEquals(FormStatus::REJECTED->value, $step->status->value);
        $this->assertEquals($approverA->id, $step->acted_by_id);

        $childApprovers = $step->approvers()->orderBy('created_at')->get();
        $rejectedChild  = $childApprovers->firstWhere('approverable_id', $roleA->id);
        $skippedChild   = $childApprovers->firstWhere('approverable_id', $roleB->id);

        $this->assertEquals(FormStatus::REJECTED->value, $rejectedChild->status->value);
        $this->assertEquals(FormStatus::SKIPPED->value, $skippedChild->status->value);

        // instance REJECTED
        $this->assertEquals(FormStatus::REJECTED->value, $instance->fresh()->status->value);
    }

    /**
     * Payload: step advanced eager-load approvers.approver untuk tab Approvals.
     */
    public function test_instance_step_eager_loads_approvers_with_approver_relation(): void {
        $roleA   = $this->makeRole('PayloadRoleA');
        $roleB   = $this->makeRole('PayloadRoleB');
        $creator = $this->makeUser('PayloadCreator');

        $this->makeScheme('scheme-payload', [
            [
                'approver_type'     => 'role',
                'approverable_type' => Role::class,
                'approverable_id'   => $roleA->id,
                'is_advanced'       => true,
                'approvers'         => [
                    [
                        'approver_type'     => 'role',
                        'approverable_type' => Role::class,
                        'approverable_id'   => $roleA->id,
                    ],
                    [
                        'approver_type'     => 'role',
                        'approverable_type' => Role::class,
                        'approverable_id'   => $roleB->id,
                    ],
                ],
            ],
        ]);

        $doc      = $this->makeDocument($creator);
        $instance = ApprovalInstance::makeInstance($doc);

        $step = ApprovalInstanceStep::with('approvers.approver')
            ->where('approval_instance_id', $instance->id)
            ->first();

        $this->assertTrue($step->is_advanced);
        $this->assertCount(2, $step->approvers);

        foreach ($step->approvers as $childApprover) {
            $this->assertNotNull($childApprover->approver, 'Relasi approver harus ter-load');
        }
    }
}
