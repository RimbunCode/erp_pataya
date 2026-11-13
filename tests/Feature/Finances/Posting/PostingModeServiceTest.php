<?php

namespace Tests\Feature\Finances\Posting;

use App\Enums\PostingDocumentType;
use App\Events\Core\AuditableModelSaved;
use App\Models\Finances\FinanceSetting;
use App\Models\Finances\PostingParityLog;
use App\Models\User\Permission;
use App\Services\Core\Setting\SettingsService;
use App\Services\Finances\Posting\PostingModeResolver;
use App\Services\Finances\Posting\PostingModeService;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Session;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;
use Tests\Support\BuildsFinanceFixtures;
use Tests\TestCase;

/**
 * Finance Fase 2, Task 5.1 (Requirement 6.1, 6.8, 11.3): setting mode per jenis dokumen (default `off`), resolver
 * ber-cache 60 detik yang diinvalidasi saat mode berubah, `PostingModeService::switch()` yang memeriksa izin
 * `switch_posting_mode` dan tercatat di audit pengaturan modul.
 */
class PostingModeServiceTest extends TestCase {
    use BuildsFinanceFixtures, RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        $this->setUpFinanceFixtures([PostingParityLog::class]);
        Cache::flush();
    }

    private function grant(bool $allowed): void {
        Session::put('permissions', $allowed ? [
            PostingParityLog::class => [0 => [['model' => PostingParityLog::class, 'level' => 0, 'only_creator' => false, 'permissions' => ['select' => true, 'switch_posting_mode' => true]]]],
        ] : [
            PostingParityLog::class => [0 => [['model' => PostingParityLog::class, 'level' => 0, 'only_creator' => false, 'permissions' => ['select' => true]]]],
        ]);
    }

    public function test_default_setting_has_every_document_type_off(): void {
        $setting = FinanceSetting::current();

        $this->assertSame(PostingDocumentType::values(), array_keys($setting->posting_modes));
        $this->assertSame(['off'], array_values(array_unique($setting->posting_modes)));

        foreach (PostingDocumentType::cases() as $type) {
            $this->assertSame('off', app(PostingModeResolver::class)->for($type));
        }
    }

    public function test_row_without_modes_reads_as_off(): void {
        FinanceSetting::current();
        DB::table('finance_settings')->update(['posting_modes' => null]);
        PostingModeResolver::forget();

        $this->assertSame('off', app(PostingModeResolver::class)->for(PostingDocumentType::SalesInvoice));
    }

    public function test_switch_requires_the_switch_posting_mode_permission(): void {
        $this->grant(false);

        try {
            app(PostingModeService::class)->switch(PostingDocumentType::SalesInvoice, 'shadow');
            $this->fail('AuthorizationException diharapkan.');
        } catch (AuthorizationException) {
            // diharapkan
        }

        $this->assertSame('off', app(PostingModeResolver::class)->for(PostingDocumentType::SalesInvoice));
    }

    public function test_switch_without_any_session_permissions_is_forbidden(): void {
        Session::forget('permissions');

        $this->expectException(AuthorizationException::class);
        app(PostingModeService::class)->switch(PostingDocumentType::SalesInvoice, 'shadow');
    }

    public function test_switch_changes_only_the_requested_type_and_invalidates_the_cache(): void {
        $this->grant(true);
        $resolver = app(PostingModeResolver::class);
        $this->assertSame('off', $resolver->for(PostingDocumentType::SalesInvoice)); // mengisi cache

        app(PostingModeService::class)->switch(PostingDocumentType::SalesInvoice, 'shadow');

        $this->assertSame('shadow', $resolver->for(PostingDocumentType::SalesInvoice));
        $this->assertSame('off', $resolver->for(PostingDocumentType::PurchaseInvoice));

        app(PostingModeService::class)->switch(PostingDocumentType::SalesInvoice, 'on');
        $this->assertSame('on', $resolver->for(PostingDocumentType::SalesInvoice));

        app(PostingModeService::class)->switch(PostingDocumentType::SalesInvoice, 'off');
        $this->assertSame('off', $resolver->for(PostingDocumentType::SalesInvoice), 'Kembali ke off tanpa deploy.');
    }

    public function test_switch_rejects_unknown_modes(): void {
        $this->grant(true);

        $this->expectException(InvalidArgumentException::class);
        app(PostingModeService::class)->switch(PostingDocumentType::SalesInvoice, 'maybe');
    }

    public function test_mode_is_cached_between_reads_until_forgotten(): void {
        FinanceSetting::current();
        $resolver = app(PostingModeResolver::class);
        $this->assertSame('off', $resolver->for(PostingDocumentType::StockEntry));

        // Perubahan langsung di DB tidak terlihat sampai cache diinvalidasi (TTL 60 detik).
        $modes                                         = FinanceSetting::defaultAttributes()['posting_modes'];
        $modes[PostingDocumentType::StockEntry->value] = 'on';
        DB::table('finance_settings')->update(['posting_modes' => json_encode($modes)]);
        $this->assertSame('off', $resolver->for(PostingDocumentType::StockEntry));

        PostingModeResolver::forget();
        $this->assertSame('on', $resolver->for(PostingDocumentType::StockEntry));
    }

    public function test_unknown_stored_value_is_read_as_off(): void {
        $modes                                         = FinanceSetting::defaultAttributes()['posting_modes'];
        $modes[PostingDocumentType::StockEntry->value] = 'turbo';
        FinanceSetting::current();
        DB::table('finance_settings')->update(['posting_modes' => json_encode($modes)]);
        PostingModeResolver::forget();

        $this->assertSame('off', app(PostingModeResolver::class)->for(PostingDocumentType::StockEntry));
    }

    public function test_posting_modes_cannot_be_written_through_the_generic_settings_path(): void {
        $this->assertArrayNotHasKey('posting_modes', FinanceSetting::rules());

        $this->expectException(ValidationException::class);
        app(SettingsService::class)->update(FinanceSetting::class, ['posting_modes' => ['sales_invoice' => 'on']]);
    }

    public function test_internal_write_validates_mode_values(): void {
        $this->expectException(ValidationException::class);
        app(SettingsService::class)->updateInternal(FinanceSetting::class, ['posting_modes' => ['sales_invoice' => 'turbo']]);
    }

    public function test_switch_is_recorded_in_the_module_setting_audit_with_actor_and_before_after(): void {
        $this->grant(true);
        FinanceSetting::current();
        $events = [];
        Event::listen(AuditableModelSaved::class, function ($event) use (&$events): void {
            $events[] = $event;
        });

        app(PostingModeService::class)->switch(PostingDocumentType::DeliveryNote, 'shadow');

        $this->assertCount(1, $events);
        $event = $events[0];
        $this->assertSame('updated', $event->action);
        $this->assertInstanceOf(FinanceSetting::class, $event->model);
        $this->assertSame('off', $event->dataBefore['posting_modes']['delivery_note']);
        $this->assertSame('shadow', $event->dataAfter['posting_modes']['delivery_note']);
        $this->assertSame('off', $event->dataAfter['posting_modes']['sales_invoice']);
        $this->assertSame($this->user->id, Auth::id(), 'Pelaku adalah pengguna yang login saat audit dicatat.');
    }

    public function test_switch_reads_the_modes_inside_the_locked_transaction_so_concurrent_changes_are_not_lost(): void {
        // Bukti terbatas (SQLite, satu proses): FOR UPDATE diabaikan dan admin bersamaan tak dapat disimulasikan; yang
        // dibuktikan adalah pembacaan terjadi di dalam transaksi dan membaca data terbaru, bukan memo basi.
        $this->grant(true);
        FinanceSetting::current();
        app(SettingsService::class)->get(FinanceSetting::class); // memo basi

        // Admin lain mengubah jenis dokumen berbeda setelah memo dimuat.
        $modes                                         = FinanceSetting::defaultAttributes()['posting_modes'];
        $modes[PostingDocumentType::StockEntry->value] = 'on';
        DB::table('finance_settings')->update(['posting_modes' => json_encode($modes)]);

        $levels = [];
        DB::listen(function ($query) use (&$levels): void {
            if (str_starts_with(strtolower($query->sql), 'select') && str_contains($query->sql, 'finance_settings')) {
                $levels[] = DB::transactionLevel();
            }
        });

        $saved = app(PostingModeService::class)->switch(PostingDocumentType::SalesInvoice, 'shadow');

        $this->assertSame('on', $saved->posting_modes['stock_entry'], 'Perubahan admin lain tidak boleh tertimpa.');
        $this->assertSame('shadow', $saved->posting_modes['sales_invoice']);
        $this->assertNotEmpty($levels);
        $this->assertSame([], array_filter($levels, fn (int $level): bool => $level < 1), 'Pembacaan setting harus di dalam transaksi (SQLite tidak menegakkan FOR UPDATE).');
    }

    public function test_update_internal_closure_receives_the_locked_row(): void {
        $seen = null;
        app(SettingsService::class)->updateInternal(FinanceSetting::class, function ($locked) use (&$seen): array {
            $seen = [DB::transactionLevel(), $locked instanceof FinanceSetting];

            return ['posting_modes' => ['sales_invoice' => 'shadow']];
        });

        $this->assertTrue($seen[1]);
        $this->assertGreaterThanOrEqual(1, $seen[0]);
    }

    public function test_internal_write_rejects_arbitrary_keys(): void {
        foreach ([['made_up' => 'on'], ['sales_invoice' => 'on', 'made_up' => 'off']] as $modes) {
            try {
                app(SettingsService::class)->updateInternal(FinanceSetting::class, ['posting_modes' => $modes]);
                $this->fail('Kunci sembarang harus ditolak.');
            } catch (ValidationException $e) {
                $this->assertArrayHasKey('posting_modes', $e->errors());
            }
        }
    }

    public function test_switch_permission_is_registered_on_the_parity_log_permission(): void {
        PostingParityLog::initPermissions();

        $permission = Permission::withoutGlobalScopes()->where('model', PostingParityLog::class)->firstOrFail();

        $this->assertContains('switch_posting_mode', (array) $permission->permissions);
        $this->assertContains('select', (array) $permission->permissions);
        $this->assertContains('read', (array) $permission->permissions);
    }
}
