<?php

namespace Tests\Feature\Finances\Posting;

use App\Enums\FormStatus;
use App\Enums\PostingDocumentType;
use App\Exceptions\Finances\UnresolvedAccountRoleException;
use App\Models\Core\GlPostingStatus;
use App\Models\Finances\Account;
use App\Models\Finances\FinanceSetting;
use App\Models\Finances\Journal;
use App\Models\Finances\PostingParityLog;
use App\Models\Finances\PostingProfile;
use App\Models\Inventory\StockEntry;
use App\Services\Core\Setting\SettingsService;
use App\Services\Finances\Ledger\JournalService;
use App\Services\Finances\Posting\Contexts\PostingContext;
use App\Services\Finances\Posting\PostingGateway;
use App\Services\Finances\Posting\PostingModeResolver;
use App\Services\Finances\Posting\PostingOutcome;
use App\Services\Finances\Posting\PostingProfileService;
use Carbon\CarbonImmutable;
use Illuminate\Database\Connection;
use Illuminate\Database\DeadlockException;
use Illuminate\Database\LostConnectionException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Support\AssertsPostingParity;
use Tests\Support\BuildsFinanceFixtures;
use Tests\TestCase;

/**
 * Finance Fase 2, Task 5.3-5.4: `PostingGateway` pada tiga mode. P-5 (mode aman: `off` tidak memanggil engine;
 * `shadow` menelan kegagalan engine dan mencatat parity), P-6 (guard cancel pada semua mode; `GlPostingStatus`
 * pending menjadi `skipped`).
 */
class PostingGatewayTest extends TestCase {
    use AssertsPostingParity, BuildsFinanceFixtures, RefreshDatabase;

    private Account $stock;
    private Account $srnb;
    private StockEntry $source;
    private int $legacyCalls = 0;

    protected function setUp(): void {
        parent::setUp();

        $this->setUpFinanceFixtures([PostingProfile::class, StockEntry::class, PostingParityLog::class]);

        $this->stock = $this->makeAccount('1241', 'Persediaan', 'asset');
        $this->srnb  = $this->makeAccount('2150', 'SRNB', 'liability', 'credit');

        $profiles = app(PostingProfileService::class);
        $profiles->activate($profiles->createDraft('Profil', '2026-01-01', null, [
            'stock'                         => $this->stock->id,
            'stock_received_but_not_billed' => $this->srnb->id,
        ]));

        $this->source = $this->makeStockEntry();
        PostingModeResolver::forget();
    }

    private function setMode(PostingDocumentType $type, string $mode): void {
        $modes = array_merge(FinanceSetting::defaultAttributes()['posting_modes'], [$type->value => $mode]);
        app(SettingsService::class)->updateInternal(FinanceSetting::class, ['posting_modes' => $modes]);
        PostingModeResolver::forget();
    }

    private function ctx(PostingDocumentType $type = PostingDocumentType::PurchaseReceipt, array $flags = []): PostingContext {
        return new PostingContext($type, $this->source::class, $this->source->getKey(), CarbonImmutable::parse('2026-11-12 10:00:00'), null, ['total' => 500, 'paid_amount' => 500], $flags);
    }

    /**
     * Jalur lama: persis `postPair` Fase 1 untuk Purchase Receipt (debit stok, kredit SRNB).
     */
    private function legacy(float $amount = 500): \Closure {
        return function () use ($amount): void {
            $this->legacyCalls++;
            app(JournalService::class)->postPair($this->stock->id, $this->srnb->id, $amount, $this->source, CarbonImmutable::parse('2026-11-12 10:00:00'));
        };
    }

    private function gateway(): PostingGateway {
        return app(PostingGateway::class);
    }

    public function test_all_modes_default_to_off(): void {
        foreach (PostingDocumentType::cases() as $type) {
            $this->assertSame('off', app(PostingModeResolver::class)->for($type), $type->value);
        }
    }

    public function test_off_mode_runs_only_the_legacy_path_and_never_touches_the_engine_p5(): void {
        // Tanpa profil dan akun legacy, engine akan gagal bila dipanggil (peran cash_or_bank tak ter-resolve).
        $outcome = $this->gateway()->post($this->ctx(PostingDocumentType::PaymentEntry, ['payment_type' => 'receive', 'paymentable_kind' => 'sales_invoice']), $this->legacy());

        $this->assertSame(PostingOutcome::POSTED, $outcome->status);
        $this->assertSame([], $outcome->journals, 'Mode off: jalur lama memegang jurnalnya.');
        $this->assertSame(1, $this->legacyCalls);
        $this->assertSame(1, Journal::count());
        $this->assertSame(0, PostingParityLog::count(), 'Mode off tidak membuat catatan parity.');
    }

    public function test_shadow_mode_runs_legacy_then_records_a_match(): void {
        $this->setMode(PostingDocumentType::PurchaseReceipt, 'shadow');

        $outcome = $this->gateway()->post($this->ctx(), $this->legacy());

        $this->assertSame(PostingOutcome::POSTED, $outcome->status);
        $this->assertSame(1, $this->legacyCalls);
        $this->assertSame(1, Journal::count(), 'Hanya jalur lama yang menulis jurnal.');

        $log = PostingParityLog::query()->firstOrFail();
        $this->assertSame('match', $log->status);
        $this->assertSame('purchase_receipt', $log->document_type);
        $this->assertSame($this->source->getKey(), $log->source_id);
        $this->assertArrayHasKey('default', $log->legacy);
        $this->assertArrayHasKey('default', $log->engine);
    }

    public function test_shadow_mode_records_a_mismatch_when_the_paths_disagree(): void {
        $this->setMode(PostingDocumentType::PurchaseReceipt, 'shadow');

        $this->gateway()->post($this->ctx(), $this->legacy(300));

        $log = PostingParityLog::query()->firstOrFail();
        $this->assertSame('mismatch', $log->status);
        $this->assertNotEmpty($log->diff);
    }

    public function test_shadow_engine_failure_is_swallowed_and_logged_as_engine_error_p5(): void {
        $this->setMode(PostingDocumentType::PaymentEntry, 'shadow');
        $ctx = $this->ctx(PostingDocumentType::PaymentEntry, ['payment_type' => 'receive', 'paymentable_kind' => 'sales_invoice']);

        $this->gateway()->post($ctx, $this->legacy());

        $this->assertSame(1, $this->legacyCalls, 'Posting lama tetap berhasil.');
        $this->assertSame(1, Journal::count());
        $log = PostingParityLog::query()->firstOrFail();
        $this->assertSame('engine_error', $log->status);
        $this->assertNull($log->engine);
        $this->assertNotEmpty($log->diff['message']);
    }

    public function test_on_mode_posts_through_the_engine_and_skips_the_legacy_path(): void {
        $this->setMode(PostingDocumentType::PurchaseReceipt, 'on');

        $outcome = $this->gateway()->post($this->ctx(), $this->legacy());

        $this->assertSame(PostingOutcome::POSTED, $outcome->status);
        $this->assertCount(1, $outcome->journals);
        $this->assertSame(0, $this->legacyCalls);
        $journal = Journal::query()->firstOrFail();
        $this->assertSame(StockEntry::class . ':' . $this->source->getKey() . ':default', $journal->posting_key);
        $this->assertSame(0, PostingParityLog::count());
    }

    public function test_on_mode_unresolved_role_fails_loudly_without_falling_back_to_legacy(): void {
        $this->setMode(PostingDocumentType::PaymentEntry, 'on');

        $this->expectException(UnresolvedAccountRoleException::class);
        try {
            $this->gateway()->post($this->ctx(PostingDocumentType::PaymentEntry, ['payment_type' => 'receive', 'paymentable_kind' => 'sales_invoice']), $this->legacy());
        } finally {
            $this->assertSame(0, $this->legacyCalls);
            $this->assertSame(0, Journal::count());
        }
    }

    public function test_canceled_source_is_skipped_on_every_mode_p6(): void {
        $this->source->update(['status' => [FormStatus::CANCELED]]);

        foreach (['off', 'shadow', 'on'] as $mode) {
            $this->setMode(PostingDocumentType::PurchaseReceipt, $mode);
            GlPostingStatus::query()->where('referenceable_id', $this->source->getKey())->delete();
            GlPostingStatus::create(['referenceable_type' => $this->source::class, 'referenceable_id' => $this->source->getKey(), 'status' => 'pending']);

            $outcome = $this->gateway()->post($this->ctx(), $this->legacy());

            $this->assertSame(PostingOutcome::SKIPPED, $outcome->status, "mode {$mode}");
            $this->assertSame(0, $this->legacyCalls, "mode {$mode}: jalur lama tidak boleh jalan");
            $this->assertSame(0, Journal::count(), "mode {$mode}: tidak ada jurnal");
            $this->assertSame(0, PostingParityLog::count(), "mode {$mode}: tidak ada parity");
            $this->assertSame('skipped', GlPostingStatus::query()->where('referenceable_id', $this->source->getKey())->firstOrFail()->status->value, "mode {$mode}");
        }
    }

    public function test_non_pending_posting_status_of_a_canceled_source_is_left_untouched(): void {
        $this->source->update(['status' => [FormStatus::CANCELED]]);
        GlPostingStatus::create(['referenceable_type' => $this->source::class, 'referenceable_id' => $this->source->getKey(), 'status' => 'posted', 'posted_at' => now()]);

        $this->gateway()->post($this->ctx(), $this->legacy());

        $this->assertSame('posted', GlPostingStatus::query()->where('referenceable_id', $this->source->getKey())->firstOrFail()->status->value);
    }

    public function test_shadow_compares_only_the_purposes_of_the_context_for_an_asset_sold_on_two_invoice_lines(): void {
        $fixed = $this->makeAccount('1510', 'Aset Tetap', 'asset');
        $gain  = $this->makeAccount('4910', 'Untung Pelepasan', 'income', 'credit');
        $this->setMode(PostingDocumentType::AssetDisposal, 'shadow');

        $date = CarbonImmutable::parse('2026-11-12 10:00:00');
        $ctx  = fn (string $line, float $gainLoss): PostingContext => new PostingContext(
            PostingDocumentType::AssetDisposal,
            $this->source::class,
            $this->source->getKey(),
            $date,
            null,
            ['gain_loss' => $gainLoss],
            ['sales_invoice_item_id' => $line],
            ['gain_loss_disposal' => $gain->id, 'fixed_asset' => $fixed->id],
        );
        $postLegacy = fn (string $line, float $amount) => app(JournalService::class)->postPair($gain->id, $fixed->id, $amount, $this->source, $date, "disposal:{$line}");

        // Baris invoice L2 sudah diposting lebih dulu pada aset yang sama (Q-P1-6); lalu L1 diposting lewat gateway.
        $postLegacy('L2', 70);
        $this->gateway()->post($ctx('L1', 30), fn () => $postLegacy('L1', 30));

        $this->assertSame(2, Journal::count());
        $log = PostingParityLog::query()->firstOrFail();
        $this->assertSame('match', $log->status, 'Jurnal disposal baris lain tidak boleh menjadi missing_in_engine.');
        $this->assertSame(['disposal:L1'], array_keys($log->legacy));
        $this->assertSame(['disposal:L1'], array_keys($log->engine));
    }

    /**
     * Pada savepoint bersarang Laravel membungkus error konkurensi (deadlock/lock wait timeout) menjadi `DeadlockException`,
     * sehingga kedua kasus berikut lewat cabang `DeadlockException` di gateway. Cabang `ConcurrencyErrorDetector` diuji
     * langsung di `test_concurrency_detector_branch_recognizes_lock_wait_timeout_messages`.
     *
     * @return iterable<string, array{0: \Throwable}>
     */
    public static function concurrencyErrors(): iterable {
        yield 'DeadlockException' => [new DeadlockException('Deadlock found when trying to get lock')];
        yield 'lock wait timeout' => [new \RuntimeException('SQLSTATE[HY000]: General error: 1205 Lock wait timeout exceeded; try restarting transaction')];
    }

    #[DataProvider('concurrencyErrors')]
    public function test_shadow_rethrows_concurrency_errors_instead_of_swallowing_them(\Throwable $error): void {
        $this->setMode(PostingDocumentType::PurchaseReceipt, 'shadow');
        $this->failParityLogInserts([$error]);

        try {
            $this->gateway()->post($this->ctx(), $this->legacy());
            $this->fail('Error konkurensi harus dilempar ulang.');
        } catch (\Throwable $caught) {
            $chain = [];
            for ($e = $caught; $e !== null; $e = $e->getPrevious()) {
                $chain[] = $e;
            }
            $this->assertContains($error, $chain, 'Error konkurensi asli (atau pembungkusnya) harus dilempar ulang.');
        }

        // Error konkurensi pada savepoint bersarang tidak digulung di tempat oleh Laravel (rollback diserahkan ke transaksi
        // terluar, yaitu transaksi listener/job di produksi; di test ini transaksi terluar milik RefreshDatabase). Yang
        // dijamin gateway: error naik ke pemanggil dan tidak berakhir sebagai outcome `posted` yang ditelan.
        $this->assertSame(1, $this->legacyCalls);
    }

    public function test_shadow_still_swallows_ordinary_engine_errors_and_keeps_the_legacy_journal(): void {
        $this->setMode(PostingDocumentType::PurchaseReceipt, 'shadow');
        $this->failParityLogInserts([new \RuntimeException('engine bug')]);

        $outcome = $this->gateway()->post($this->ctx(), $this->legacy());

        $this->assertSame(PostingOutcome::POSTED, $outcome->status);
        $this->assertSame(1, $this->legacyCalls);
        $this->assertSame(1, Journal::count(), 'Savepoint engine tidak merusak jurnal jalur lama.');
        $this->assertSame(['engine_error'], PostingParityLog::query()->pluck('status')->map(fn ($status) => $status instanceof \BackedEnum ? $status->value : $status)->all());
    }

    public function test_concurrency_detector_branch_recognizes_lock_wait_timeout_messages(): void {
        $method = new \ReflectionMethod(PostingGateway::class, 'isConcurrencyError');

        $this->assertTrue($method->invoke($this->gateway(), new \RuntimeException('SQLSTATE[HY000]: General error: 1205 Lock wait timeout exceeded; try restarting transaction')));
        $this->assertTrue($method->invoke($this->gateway(), new DeadlockException('Deadlock found')));
        $this->assertFalse($method->invoke($this->gateway(), new \RuntimeException('engine bug')));
    }

    public function test_shadow_rethrows_a_deadlock_on_the_engine_error_insert_after_an_ordinary_engine_error(): void {
        $this->setMode(PostingDocumentType::PurchaseReceipt, 'shadow');
        // Injeksi 1: error engine biasa pada insert parity pertama (ditelan, lalu dicatat `engine_error`).
        // Injeksi 2: deadlock pada insert `engine_error` itu sendiri (bentrok `finance:prune-parity-logs`): HARUS naik.
        $deadlock = new DeadlockException('Deadlock found when trying to get lock');
        $this->failParityLogInserts([new \RuntimeException('engine bug'), $deadlock]);

        try {
            $this->gateway()->post($this->ctx(), $this->legacy());
            $this->fail('Deadlock pada insert engine_error harus dilempar ulang, bukan menghasilkan outcome posted.');
        } catch (\Throwable $caught) {
            $chain = [];
            for ($e = $caught; $e !== null; $e = $e->getPrevious()) {
                $chain[] = $e;
            }
            $this->assertContains($deadlock, $chain);
        }

        $this->assertSame(1, $this->legacyCalls);
    }

    public function test_shadow_swallows_an_ordinary_error_on_the_engine_error_insert_itself(): void {
        $this->setMode(PostingDocumentType::PurchaseReceipt, 'shadow');
        $this->failParityLogInserts([new \RuntimeException('engine bug'), new \RuntimeException('log insert failed')]);

        $outcome = $this->gateway()->post($this->ctx(), $this->legacy());

        $this->assertSame(PostingOutcome::POSTED, $outcome->status);
        $this->assertSame(1, Journal::count());
        $this->assertSame(0, PostingParityLog::count());
    }

    private function guardContext(): PostingContext {
        return new PostingContext(PostingDocumentType::PurchaseReceipt, $this->source::class, $this->source->getKey(), CarbonImmutable::parse('2026-11-12 10:00:00'), null, []);
    }

    public function test_shadow_builds_the_context_after_legacy_and_swallows_an_ordinary_factory_error(): void {
        $this->setMode(PostingDocumentType::PurchaseReceipt, 'shadow');
        $order = [];

        $outcome = $this->gateway()->postDeferred(
            $this->guardContext(),
            function () use (&$order): PostingContext {
                $order[] = 'context';

                throw new \RuntimeException('factory bug');
            },
            function () use (&$order): void {
                $order[] = 'legacy';
                ($this->legacy())();
            },
        );

        $this->assertSame(['legacy', 'context'], $order, 'Konteks dibangun setelah jalur lama berjalan.');
        $this->assertSame(PostingOutcome::POSTED, $outcome->status);
        $this->assertSame(1, Journal::count(), 'Error pabrik tidak menggagalkan posting lama.');
        $log = PostingParityLog::query()->firstOrFail();
        $this->assertSame('engine_error', $log->status);
    }

    public function test_shadow_rethrows_a_concurrency_error_raised_by_the_context_factory(): void {
        $this->setMode(PostingDocumentType::PurchaseReceipt, 'shadow');
        $deadlock = new DeadlockException('Deadlock found when trying to get lock');

        try {
            $this->gateway()->postDeferred($this->guardContext(), fn () => throw $deadlock, $this->legacy());
            $this->fail('Error konkurensi dari pabrik konteks harus dilempar ulang.');
        } catch (\Throwable $caught) {
            $chain = [];
            for ($e = $caught; $e !== null; $e = $e->getPrevious()) {
                $chain[] = $e;
            }
            $this->assertContains($deadlock, $chain);
        }
    }

    /**
     * @return iterable<string, array{0: \Throwable}>
     */
    public static function lostConnectionErrors(): iterable {
        yield 'LostConnectionException' => [new LostConnectionException('Lost connection and no reconnector available.')];
        yield 'server has gone away' => [new \RuntimeException('SQLSTATE[HY000]: General error: 2006 MySQL server has gone away')];
    }

    /**
     * @param  \Closure(): mixed  $run
     */
    private function assertRethrown(\Throwable $expected, \Closure $run): void {
        try {
            $run();
            $this->fail('Error harus dilempar ulang, bukan menghasilkan outcome posted.');
        } catch (\Throwable $caught) {
            $chain = [];
            for ($e = $caught; $e !== null; $e = $e->getPrevious()) {
                $chain[] = $e;
            }
            $this->assertContains($expected, $chain);
        }
    }

    #[DataProvider('lostConnectionErrors')]
    public function test_shadow_rethrows_lost_connection_errors_from_the_engine(\Throwable $error): void {
        $this->setMode(PostingDocumentType::PurchaseReceipt, 'shadow');
        $this->failParityLogInserts([$error]);

        $this->assertRethrown($error, fn () => $this->gateway()->post($this->ctx(), $this->legacy()));
        $this->assertSame(1, $this->legacyCalls);
    }

    #[DataProvider('lostConnectionErrors')]
    public function test_shadow_rethrows_lost_connection_errors_on_the_engine_error_insert(\Throwable $error): void {
        $this->setMode(PostingDocumentType::PurchaseReceipt, 'shadow');
        $this->failParityLogInserts([new \RuntimeException('engine bug'), $error]);

        $this->assertRethrown($error, fn () => $this->gateway()->post($this->ctx(), $this->legacy()));
    }

    public function test_shadow_rethrows_when_the_transaction_level_dropped_below_the_level_before_the_savepoint(): void {
        $this->setMode(PostingDocumentType::PurchaseReceipt, 'shadow');

        $connection = DB::connection();
        $property   = new \ReflectionProperty(Connection::class, 'transactions');
        $original   = $property->getValue($connection);
        $error      = new \RuntimeException('engine bug (koneksi direset: level transaksi turun)');
        $fired      = false;
        DB::listen(function ($query) use (&$fired, $property, $connection, $error): void {
            if (! $fired && str_starts_with(strtolower($query->sql), 'insert') && str_contains($query->sql, 'posting_parity_logs')) {
                $fired = true;
                // Simulasi: koneksi putus saat savepoint, Laravel mereset counter ke 0 dan server menggulung transaksi.
                $property->setValue($connection, 0);

                throw $error;
            }
        });

        try {
            $this->assertRethrown($error, fn () => $this->gateway()->post($this->ctx(), $this->legacy()));
        } finally {
            $property->setValue($connection, $original);
        }
    }

    public function test_deferred_context_is_not_built_in_off_mode_but_is_built_for_shadow_and_on(): void {
        $built = 0;
        $guard = new PostingContext(PostingDocumentType::PurchaseReceipt, $this->source::class, $this->source->getKey(), CarbonImmutable::parse('2026-11-12 10:00:00'), null, []);
        $full  = function () use (&$built): PostingContext {
            $built++;

            return $this->ctx();
        };

        $this->gateway()->postDeferred($guard, $full, $this->legacy());
        $this->assertSame(0, $built, 'Mode off: pabrik konteks tidak berjalan.');
        $this->assertSame(1, $this->legacyCalls);

        $this->setMode(PostingDocumentType::PurchaseReceipt, 'shadow');
        $this->gateway()->postDeferred($guard, $full, fn () => null);
        $this->assertSame(1, $built);

        $this->setMode(PostingDocumentType::PurchaseReceipt, 'on');
        $this->source->update(['status' => [FormStatus::APPROVED]]);
        $this->gateway()->postDeferred($guard, $full, $this->legacy());
        $this->assertSame(2, $built);
    }

    public function test_on_mode_reports_already_posted_on_retry_without_new_journals(): void {
        $this->setMode(PostingDocumentType::PurchaseReceipt, 'on');

        $first = $this->gateway()->post($this->ctx(), $this->legacy());
        $retry = $this->gateway()->post($this->ctx(), $this->legacy());

        $this->assertSame(PostingOutcome::POSTED, $first->status);
        $this->assertSame(PostingOutcome::ALREADY_POSTED, $retry->status);
        $this->assertSame($first->journals[0]->id, $retry->journals[0]->id);
        $this->assertSame(1, Journal::count());
    }

    public function test_asset_disposal_is_skipped_when_the_guard_sales_invoice_is_canceled(): void {
        $invoice = $this->makeStockEntry([FormStatus::CANCELED]); // pengganti Sales Invoice penjaga
        GlPostingStatus::create(['referenceable_type' => $invoice::class, 'referenceable_id' => $invoice->getKey(), 'status' => 'pending']);
        $fixed = $this->makeAccount('1510', 'Aset Tetap', 'asset');
        $gain  = $this->makeAccount('4910', 'Untung Pelepasan', 'income', 'credit');

        foreach (['off', 'shadow', 'on'] as $mode) {
            $this->setMode(PostingDocumentType::AssetDisposal, $mode);
            GlPostingStatus::query()->where('referenceable_id', $invoice->getKey())->update(['status' => 'pending']);
            $ctx = new PostingContext(
                PostingDocumentType::AssetDisposal,
                $this->source::class,
                $this->source->getKey(),
                CarbonImmutable::parse('2026-11-12 10:00:00'),
                null,
                ['gain_loss' => 30],
                ['sales_invoice_item_id' => 'L1'],
                ['gain_loss_disposal' => $gain->id, 'fixed_asset' => $fixed->id],
                guardDocument: ['type' => $invoice::class, 'id' => $invoice->getKey()],
            );

            $outcome = $this->gateway()->post($ctx, $this->legacy());

            $this->assertSame(PostingOutcome::SKIPPED, $outcome->status, $mode);
            $this->assertSame(0, Journal::count(), $mode);
            $this->assertSame('skipped', GlPostingStatus::query()->where('referenceable_id', $invoice->getKey())->firstOrFail()->status->value, $mode);
        }
        $this->assertSame(0, $this->legacyCalls);
    }

    public function test_guard_reads_the_source_inside_a_transaction_in_every_mode(): void {
        // Bukti terbatas (SQLite, satu proses): FOR UPDATE diabaikan; yang dibuktikan adalah guard membaca dokumen
        // penjaga pada transactionLevel >= 1 (tempat kunci baris berlaku di MySQL), pada ketiga mode.
        $levels = [];
        DB::listen(function ($query) use (&$levels): void {
            if (str_contains($query->sql, 'stock_entries')) {
                $levels[] = DB::transactionLevel();
            }
        });

        foreach (['off', 'shadow', 'on'] as $mode) {
            $this->setMode(PostingDocumentType::PurchaseReceipt, $mode);
            $levels = [];

            $this->gateway()->post($this->ctx(), fn () => null);

            $this->assertNotEmpty($levels, "mode {$mode}: guard harus membaca sumber");
            $this->assertSame([], array_filter($levels, fn (int $level): bool => $level < 1), "mode {$mode}: sumber dibaca di luar transaksi");
        }
    }

    public function test_shadow_engine_error_does_not_roll_back_the_legacy_journal_inside_the_gateway_transaction(): void {
        $this->setMode(PostingDocumentType::PaymentEntry, 'shadow');

        $this->gateway()->post($this->ctx(PostingDocumentType::PaymentEntry, ['payment_type' => 'receive', 'paymentable_kind' => 'sales_invoice']), $this->legacy());

        $this->assertSame(1, Journal::count(), 'Jurnal jalur lama tetap ada walau engine gagal di shadow.');
        $this->assertSame('engine_error', PostingParityLog::query()->firstOrFail()->status);
    }
}
