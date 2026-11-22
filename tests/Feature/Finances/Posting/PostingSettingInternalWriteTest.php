<?php

namespace Tests\Feature\Finances\Posting;

use App\Enums\PostingDocumentType;
use App\Events\Core\AuditableModelSaved;
use App\Models\Finances\FinanceSetting;
use App\Models\Finances\PostingParityLog;
use App\Models\User\Permission;
use App\Services\Core\Setting\SettingsService;
use App\Services\Finances\Posting\PostingExecutionService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Session;
use Illuminate\Validation\ValidationException;
use Tests\Support\BuildsFinanceFixtures;
use Tests\TestCase;

/**
 * Finance Fase 2, Task 5.1 (diubah Q-P2-23, 2026-11-22): penulisan internal setting Finance. Mode engine `off`/`shadow`
 * dan setting `posting_modes` sudah dihapus (engine selalu aktif), jadi cakupan jalur tulis internal
 * (`SettingsService::updateInternal()`: kunci baris, validasi, audit pengaturan modul, tak dapat ditulis lewat jalur
 * umum) dipertahankan dengan setting `posting_executions` (D-1) yang masih ada. Perilaku sakelar eksekusi itu sendiri
 * diuji `PostingExecutionTest`.
 */
class PostingSettingInternalWriteTest extends TestCase {
    use BuildsFinanceFixtures, RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        $this->setUpFinanceFixtures([PostingParityLog::class]);
        Cache::flush();
    }

    private function grant(): void {
        Session::put('permissions', [
            PostingParityLog::class => [0 => [['model' => PostingParityLog::class, 'level' => 0, 'only_creator' => false, 'permissions' => ['select' => true, 'switch_posting_mode' => true]]]],
        ]);
    }

    public function test_posting_modes_setting_no_longer_exists(): void {
        $this->assertFalse(Schema::hasColumn('finance_settings', 'posting_modes'));
        $this->assertArrayNotHasKey('posting_modes', FinanceSetting::defaultAttributes());
        $this->assertArrayNotHasKey('posting_modes', FinanceSetting::current()->getAttributes());
    }

    public function test_posting_modes_can_no_longer_be_written_even_through_the_internal_path(): void {
        $this->expectException(ValidationException::class);
        app(SettingsService::class)->updateInternal(FinanceSetting::class, ['posting_modes' => ['sales_invoice' => 'on']]);
    }

    public function test_posting_executions_cannot_be_written_through_the_generic_settings_path(): void {
        $this->assertArrayNotHasKey('posting_executions', FinanceSetting::rules());

        $this->expectException(ValidationException::class);
        app(SettingsService::class)->update(FinanceSetting::class, ['posting_executions' => ['sales_invoice' => 'queue']]);
    }

    public function test_internal_write_validates_execution_values(): void {
        $this->expectException(ValidationException::class);
        app(SettingsService::class)->updateInternal(FinanceSetting::class, ['posting_executions' => array_fill_keys(PostingDocumentType::values(), 'turbo')]);
    }

    public function test_internal_write_rejects_arbitrary_keys(): void {
        $valid = array_fill_keys(PostingDocumentType::values(), 'inline');

        foreach ([['made_up' => 'inline'], [...$valid, 'made_up' => 'queue']] as $executions) {
            try {
                app(SettingsService::class)->updateInternal(FinanceSetting::class, ['posting_executions' => $executions]);
                $this->fail('Kunci sembarang harus ditolak.');
            } catch (ValidationException $e) {
                $this->assertArrayHasKey('posting_executions', $e->errors());
            }
        }
    }

    public function test_update_internal_closure_receives_the_locked_row(): void {
        $seen = null;
        app(SettingsService::class)->updateInternal(FinanceSetting::class, function ($locked) use (&$seen): array {
            $seen = [DB::transactionLevel(), $locked instanceof FinanceSetting];

            return ['posting_executions' => array_fill_keys(PostingDocumentType::values(), 'inline')];
        });

        $this->assertTrue($seen[1]);
        $this->assertGreaterThanOrEqual(1, $seen[0]);
    }

    public function test_switch_is_recorded_in_the_module_setting_audit_with_actor_and_before_after(): void {
        $this->grant();
        FinanceSetting::current();
        $events = [];
        Event::listen(AuditableModelSaved::class, function ($event) use (&$events): void {
            $events[] = $event;
        });

        app(PostingExecutionService::class)->switch(PostingDocumentType::DeliveryNote, 'queue');

        $this->assertCount(1, $events);
        $event = $events[0];
        $this->assertSame('updated', $event->action);
        $this->assertInstanceOf(FinanceSetting::class, $event->model);
        $this->assertSame('inline', $event->dataBefore['posting_executions']['delivery_note']);
        $this->assertSame('queue', $event->dataAfter['posting_executions']['delivery_note']);
        $this->assertSame('inline', $event->dataAfter['posting_executions']['sales_invoice']);
        $this->assertSame($this->user->id, Auth::id(), 'Pelaku adalah pengguna yang login saat audit dicatat.');
    }

    public function test_switch_reads_the_executions_inside_the_locked_transaction_so_concurrent_changes_are_not_lost(): void {
        // Bukti terbatas (SQLite, satu proses): FOR UPDATE diabaikan dan admin bersamaan tak dapat disimulasikan; yang
        // dibuktikan adalah pembacaan terjadi di dalam transaksi dan membaca data terbaru, bukan memo basi.
        $this->grant();
        FinanceSetting::current();
        app(SettingsService::class)->get(FinanceSetting::class); // memo basi

        // Admin lain mengubah jenis dokumen berbeda setelah memo dimuat.
        $executions                                         = FinanceSetting::defaultAttributes()['posting_executions'];
        $executions[PostingDocumentType::StockEntry->value] = 'queue';
        DB::table('finance_settings')->update(['posting_executions' => json_encode($executions)]);

        $levels = [];
        DB::listen(function ($query) use (&$levels): void {
            if (str_starts_with(strtolower($query->sql), 'select') && str_contains($query->sql, 'finance_settings')) {
                $levels[] = DB::transactionLevel();
            }
        });

        $saved = app(PostingExecutionService::class)->switch(PostingDocumentType::SalesInvoice, 'queue');

        $this->assertSame('queue', $saved->posting_executions['stock_entry'], 'Perubahan admin lain tidak boleh tertimpa.');
        $this->assertSame('queue', $saved->posting_executions['sales_invoice']);
        $this->assertNotEmpty($levels);
        $this->assertSame([], array_filter($levels, fn (int $level): bool => $level < 1), 'Pembacaan setting harus di dalam transaksi (SQLite tidak menegakkan FOR UPDATE).');
    }

    public function test_switch_permission_is_registered_on_the_parity_log_permission(): void {
        PostingParityLog::initPermissions();

        $permission = Permission::withoutGlobalScopes()->where('model', PostingParityLog::class)->firstOrFail();

        $this->assertContains('switch_posting_mode', (array) $permission->permissions);
        $this->assertContains('select', (array) $permission->permissions);
        $this->assertContains('read', (array) $permission->permissions);
    }
}
