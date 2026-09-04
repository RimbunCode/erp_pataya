<?php

namespace Tests\Feature\Models;

use App\Models\Core\ApprovalInstance;
use App\Models\Core\ApprovalInstanceStep;
use App\Models\User\Role;
use App\Models\User\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Rollout withTrashed (spec soft-delete-relation-context Task 5.2, diperluas)
 * ke ApprovalInstanceStep::approver()/actedBy() -- relasi ini AUTO eager-load
 * lewat $with property (bukan loadRelations() opt-in per controller seperti
 * Account/Item/PaymentEntry/Todo/GeneralLedger), jadi fix-nya langsung di
 * definisi relasi model (constrain() untuk morphTo approver, withTrashed()
 * langsung untuk belongsTo actedBy).
 */
class ApprovalInstanceStepSoftDeleteTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        foreach (Schema::getTables() as $tableInfo) {
            $table = $tableInfo['name'];
            if (! Schema::hasColumn($table, 'is_example')) {
                Schema::table($table, fn ($t) => $t->boolean('is_example')->default(false));
            }
        }
    }

    /**
     * Insert rantai FK minimal (permission -> approval_scheme -> approval_instance)
     * lewat DB::table() langsung, bypass boot hook Eloquent -- pola sama seperti
     * ExistsExcludingTrashedTest (yang diuji relasi model, bukan business logic
     * pembuatan approval scheme/instance).
     */
    private function makeApprovalInstanceId(array $overrides = []): string {
        $permissionId = (string) Str::ulid();
        DB::table('permissions')->insert([
            'id'         => $permissionId,
            'module'     => 'test',
            'name'       => 'test-' . $permissionId,
            'model'      => 'App\\Models\\Test',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $schemeId = (string) Str::ulid();
        DB::table('approval_schemes')->insert([
            'id'            => $schemeId,
            'name'          => 'Scheme ' . $schemeId,
            'permission_id' => $permissionId,
            'name_model'    => 'Test',
            'model'         => 'App\\Models\\Test',
            'created_at'    => now(),
            'updated_at'    => now(),
        ]);

        $instanceId = (string) Str::ulid();
        DB::table('approval_instances')->insert(array_merge([
            'id'                 => $instanceId,
            'approval_scheme_id' => $schemeId,
            'document_type'      => 'App\\Models\\Test',
            'document_id'        => (string) Str::ulid(),
            'created_at'         => now(),
            'updated_at'         => now(),
        ], $overrides));

        return $instanceId;
    }

    private function makeStep(string $instanceId, array $overrides = []): ApprovalInstanceStep {
        $stepId = (string) Str::ulid();
        DB::table('approval_instance_steps')->insert(array_merge([
            'id'                   => $stepId,
            'sequence'             => 0,
            'approval_instance_id' => $instanceId,
            'approver_type'        => 'user',
            'approverable_type'    => User::class,
            'approverable_id'      => (string) Str::ulid(),
            'is_advanced'          => false,
            'status'               => 'pending',
            'created_at'           => now(),
            'updated_at'           => now(),
        ], $overrides));

        return ApprovalInstanceStep::findOrFail($stepId);
    }

    public function test_approver_stays_visible_when_target_user_soft_deleted(): void {
        $instanceId = $this->makeApprovalInstanceId();
        $user       = User::factory()->create();
        $user->delete();

        $step = $this->makeStep($instanceId, [
            'approver_type'     => 'user',
            'approverable_type' => User::class,
            'approverable_id'   => $user->id,
        ]);

        $this->assertNotNull($step->approver, 'approver (User) tidak boleh null walau sudah di-soft-delete.');
        $this->assertNotNull($step->approver->deleted_at);
        $this->assertSame($user->id, $step->approver->id);
    }

    public function test_approver_stays_visible_when_target_role_soft_deleted(): void {
        $instanceId = $this->makeApprovalInstanceId();
        $role       = Role::create(['name' => 'Role ' . Str::ulid()]);
        $role->delete();

        $step = $this->makeStep($instanceId, [
            'approver_type'     => 'role',
            'approverable_type' => Role::class,
            'approverable_id'   => $role->id,
        ]);

        $this->assertNotNull($step->approver, 'approver (Role) tidak boleh null walau sudah di-soft-delete.');
        $this->assertNotNull($step->approver->deleted_at);
        $this->assertSame($role->id, $step->approver->id);
    }

    public function test_acted_by_stays_visible_when_user_soft_deleted(): void {
        $instanceId = $this->makeApprovalInstanceId();
        $actor      = User::factory()->create();
        $actor->delete();

        $step = $this->makeStep($instanceId, [
            'acted_by_id' => $actor->id,
        ]);

        $this->assertNotNull($step->actedBy, 'actedBy tidak boleh null walau user-nya sudah di-soft-delete.');
        $this->assertNotNull($step->actedBy->deleted_at);
        $this->assertSame($actor->id, $step->actedBy->id);
    }

    public function test_approver_still_works_for_non_deleted_user(): void {
        // Regresi: constrain() withTrashed tidak boleh mengubah hasil untuk
        // approver yang masih aktif (belum di-soft-delete).
        $instanceId = $this->makeApprovalInstanceId();
        $user       = User::factory()->create();

        $step = $this->makeStep($instanceId, [
            'approver_type'     => 'user',
            'approverable_type' => User::class,
            'approverable_id'   => $user->id,
        ]);

        $this->assertNotNull($step->approver);
        $this->assertNull($step->approver->deleted_at);
    }

    /**
     * ApprovalInstance::document() -- morphTo ke ~13 model Submitable (open
     * set), pakai withTrashed() native (bukan constrain() spt approver(), yang
     * enumerasi User/Role saja karena target-nya fixed 2 tipe). Role dipakai
     * di sini sebagai stand-in target SoftDeletes generik -- mekanisme yang
     * diuji sama persis dgn document beneran (Submitable), cukup buat
     * membuktikan withTrashed() bekerja tanpa perlu setup SalesOrder penuh.
     */
    public function test_document_stays_visible_when_target_document_soft_deleted(): void {
        $document = Role::create(['name' => 'Document Stand-in ' . Str::ulid()]);
        $document->delete();

        $instanceId = $this->makeApprovalInstanceId([
            'document_type' => Role::class,
            'document_id'   => $document->id,
        ]);

        $instance = ApprovalInstance::findOrFail($instanceId);

        $this->assertNotNull($instance->document, 'document tidak boleh null walau sudah di-soft-delete.');
        $this->assertNotNull($instance->document->deleted_at);
        $this->assertSame($document->id, $instance->document->id);
    }
}
