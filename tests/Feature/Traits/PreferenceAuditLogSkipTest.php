<?php

namespace Tests\Feature\Traits;

use App\Models\Core\Log;
use App\Models\Core\Preference;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Preference punya primary key string bebas (mis. "tax_invoice_serial_range_start"),
 * yg bisa lebih panjang dari kolom logs.loggable_id -> QueryException truncation.
 * Preference juga bukan entitas bisnis yg perlu diaudit per-perubahan. Fix:
 * $auditable = false di model, dicek satu titik di RecordAuditLog listener.
 */
class PreferenceAuditLogSkipTest extends TestCase {
    use RefreshDatabase;

    public function test_creating_preference_does_not_record_audit_log(): void {
        Preference::create(['key' => 'some_setting', 'value' => 'some_value']);

        $this->assertDatabaseMissing('logs', [
            'loggable_id'   => 'some_setting',
            'loggable_type' => Preference::class,
        ]);
    }

    public function test_updating_preference_does_not_record_audit_log(): void {
        $preference = Preference::create(['key' => 'other_setting', 'value' => 'awal']);
        $preference->fillForUpdate(['value' => 'diubah']);

        $this->assertSame(
            0,
            Log::where('loggable_id', 'other_setting')->where('loggable_type', Preference::class)->count(),
        );
    }
}
