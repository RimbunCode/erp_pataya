<?php

namespace Tests\Feature\Traits;

use App\Models\Core\Log;
use App\Models\Inventory\Category;
use App\Models\Inventory\Unit;
use App\Models\User\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Audit log dulu SKIP TOTAL saat tidak ada user terautentikasi (Auth::id()
 * null -- mis. seeder/artisan/job), padahal Log::user_id nullable dan FE
 * (Log::code()/activityText() accessor) sudah siap tampilkan "System".
 * Fix: log tetap tercatat dengan user_id null, TANPA memanggil
 * loadRelations() (hindari cache relasi $model ter-mutasi -- root cause 2
 * percobaan gagal sebelumnya, lihat memory project_audit_log_auth_guard_revert).
 */
class DataTableAuditLogAuthTest extends TestCase {
    use RefreshDatabase;

    public function test_log_recorded_with_null_user_when_not_authenticated(): void {
        $category = Category::create(['name' => 'Tanpa Auth', 'type' => 'inventory']);

        $log = Log::where('loggable_id', $category->id)
            ->where('loggable_type', Category::class)
            ->where('action', 'created')
            ->first();

        $this->assertNotNull($log, 'Log HARUS tetap tercatat walau tidak ada user terautentikasi.');
        $this->assertNull($log->user_id);
        $this->assertSame('Tanpa Auth', $log->data_after['name'] ?? null, 'name (kolom mentah) tetap harus muncul di snapshot.');
    }

    public function test_log_recorded_with_user_id_when_authenticated(): void {
        $user = User::factory()->create();
        $this->actingAs($user);

        $category = Category::create(['name' => 'Dengan Auth', 'type' => 'inventory']);

        $log = Log::where('loggable_id', $category->id)
            ->where('loggable_type', Category::class)
            ->where('action', 'created')
            ->first();

        $this->assertNotNull($log);
        $this->assertSame($user->id, $log->user_id, 'Jalur authenticated tidak boleh berubah (regresi).');
    }

    public function test_update_log_recorded_with_null_user_when_not_authenticated(): void {
        $category = Category::create(['name' => 'Awal', 'type' => 'inventory']);
        $category->fillForUpdate(['name' => 'Diubah Tanpa Auth']);

        $log = Log::where('loggable_id', $category->id)
            ->where('loggable_type', Category::class)
            ->where('action', 'updated')
            ->first();

        $this->assertNotNull($log, 'Log update HARUS tetap tercatat walau tidak ada user terautentikasi.');
        $this->assertNull($log->user_id);
        $this->assertSame('Diubah Tanpa Auth', $log->data_after['name'] ?? null);
    }

    public function test_relation_derived_key_absent_from_snapshot_when_not_authenticated(): void {
        // Snapshot tanpa auth pakai getAttributes() mentah (bukan loadRelations()
        // + toArray()) -- key relasi (mis. defaultUnit) TIDAK boleh ada, hanya
        // kolom FK id polos. Ini trade-off yang disengaja, bukan bug.
        $unit     = Unit::create(['name' => 'Kilogram', 'code' => 'kg']);
        $category = Category::create([
            'name'            => 'Ada Relasi',
            'type'            => 'inventory',
            'default_unit_id' => $unit->id,
        ]);

        $log = Log::where('loggable_id', $category->id)
            ->where('loggable_type', Category::class)
            ->where('action', 'created')
            ->first();

        $this->assertSame($unit->id, $log->data_after['default_unit_id'] ?? null);
        $this->assertArrayNotHasKey('defaultUnit', $log->data_after ?? []);
    }
}
