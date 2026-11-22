<?php

namespace Tests\Feature\Finances\Posting;

use App\Enums\FormStatus;
use App\Enums\PostingDocumentType;
use App\Exceptions\Finances\PostingModeNotOnException;
use App\Exceptions\Finances\UnresolvedAccountRoleException;
use App\Models\Core\GlPostingStatus;
use App\Models\Finances\Account;
use App\Models\Finances\FinanceSetting;
use App\Models\Finances\Journal;
use App\Models\Finances\PostingParityLog;
use App\Models\Finances\PostingProfile;
use App\Models\Inventory\StockEntry;
use App\Services\Core\Setting\SettingsService;
use App\Services\Finances\Posting\Contexts\PostingContext;
use App\Services\Finances\Posting\PostingGateway;
use App\Services\Finances\Posting\PostingModeResolver;
use App\Services\Finances\Posting\PostingOutcome;
use App\Services\Finances\Posting\PostingProfileService;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\Support\BuildsFinanceFixtures;
use Tests\TestCase;

/**
 * Finance Fase 2, Task 5.3-5.4 dan Task 14.1: `PostingGateway`. Sejak closure legacy dihapus (Task 14.1) gateway hanya
 * punya satu jalur tulis (engine, mode `on`). Yang dikunci di sini: guard cancel pada SEMUA mode (P-6; `GlPostingStatus`
 * pending menjadi `skipped`), mode `on` menulis lewat engine tanpa fallback diam-diam (Requirement 7.6), dan mode
 * `off`/`shadow` gagal tertutup dengan `PostingModeNotOnException` sebelum pabrik konteks dipanggil: tanpa jurnal dan
 * tanpa catatan parity.
 */
class PostingGatewayTest extends TestCase {
    use BuildsFinanceFixtures, RefreshDatabase;

    private Account $stock;
    private Account $srnb;
    private StockEntry $source;

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

    private function guardContext(): PostingContext {
        return new PostingContext(PostingDocumentType::PurchaseReceipt, $this->source::class, $this->source->getKey(), CarbonImmutable::parse('2026-11-12 10:00:00'), null, []);
    }

    private function gateway(): PostingGateway {
        return app(PostingGateway::class);
    }

    public function test_all_modes_default_to_off(): void {
        // Default `off` tidak diubah Task 14.1 (Requirement 6.1): perubahan default menunggu keputusan pemilik produk.
        foreach (PostingDocumentType::cases() as $type) {
            $this->assertSame('off', app(PostingModeResolver::class)->for($type), $type->value);
        }
    }

    public function test_off_mode_fails_closed_without_journals_and_never_touches_the_engine(): void {
        // Tanpa profil/akun untuk `cash_or_bank` engine akan gagal dengan UnresolvedAccountRoleException bila dipanggil;
        // yang dilempar justru PostingModeNotOnException, jadi engine tidak disentuh.
        try {
            $this->gateway()->post($this->ctx(PostingDocumentType::PaymentEntry, ['payment_type' => 'receive', 'paymentable_kind' => 'sales_invoice']));
            $this->fail('Mode off harus gagal tertutup.');
        } catch (PostingModeNotOnException $e) {
            $this->assertSame('payment_entry', $e->documentType);
            $this->assertSame('off', $e->mode);
            $this->assertStringContainsString('payment_entry', $e->getMessage());
        }

        $this->assertSame(0, Journal::count());
        $this->assertSame(0, PostingParityLog::count(), 'Mode off tidak membuat catatan parity.');
    }

    public function test_shadow_mode_fails_closed_without_journals_or_parity_log(): void {
        $this->setMode(PostingDocumentType::PurchaseReceipt, 'shadow');

        try {
            $this->gateway()->post($this->ctx());
            $this->fail('Mode shadow harus gagal tertutup (tidak ada jalur lama untuk dibandingkan).');
        } catch (PostingModeNotOnException $e) {
            $this->assertSame('shadow', $e->mode);
        }

        $this->assertSame(0, Journal::count());
        $this->assertSame(0, PostingParityLog::count());
    }

    public function test_on_mode_posts_through_the_engine(): void {
        $this->setMode(PostingDocumentType::PurchaseReceipt, 'on');

        $outcome = $this->gateway()->post($this->ctx());

        $this->assertSame(PostingOutcome::POSTED, $outcome->status);
        $this->assertCount(1, $outcome->journals);
        $journal = Journal::query()->firstOrFail();
        $this->assertSame(StockEntry::class . ':' . $this->source->getKey() . ':default', $journal->posting_key);
        $this->assertSame(0, PostingParityLog::count());
    }

    public function test_on_mode_unresolved_role_fails_loudly_without_any_fallback(): void {
        $this->setMode(PostingDocumentType::PaymentEntry, 'on');

        try {
            $this->gateway()->post($this->ctx(PostingDocumentType::PaymentEntry, ['payment_type' => 'receive', 'paymentable_kind' => 'sales_invoice']));
            $this->fail('Peran tidak terpetakan harus melempar UnresolvedAccountRoleException.');
        } catch (UnresolvedAccountRoleException $e) {
            // Lapis legacy dilaporkan dimatikan (Task 14.1), bukan dicoba.
            $this->assertStringContainsString(__('finances/posting.layers.legacy_off'), $e->getMessage());
        }

        $this->assertSame(0, Journal::count());
    }

    public function test_legacy_account_fallback_config_defaults_to_off(): void {
        $this->assertFalse(config('finance.posting.legacy_account_fallback'));
    }

    public function test_canceled_source_is_skipped_on_every_mode_p6(): void {
        $this->source->update(['status' => [FormStatus::CANCELED]]);

        foreach (['off', 'shadow', 'on'] as $mode) {
            $this->setMode(PostingDocumentType::PurchaseReceipt, $mode);
            GlPostingStatus::query()->where('referenceable_id', $this->source->getKey())->delete();
            GlPostingStatus::create(['referenceable_type' => $this->source::class, 'referenceable_id' => $this->source->getKey(), 'status' => 'pending']);

            $outcome = $this->gateway()->post($this->ctx());

            $this->assertSame(PostingOutcome::SKIPPED, $outcome->status, "mode {$mode}");
            $this->assertSame(0, Journal::count(), "mode {$mode}: tidak ada jurnal");
            $this->assertSame(0, PostingParityLog::count(), "mode {$mode}: tidak ada parity");
            $this->assertSame('skipped', GlPostingStatus::query()->where('referenceable_id', $this->source->getKey())->firstOrFail()->status->value, "mode {$mode}");
        }
    }

    public function test_non_pending_posting_status_of_a_canceled_source_is_left_untouched(): void {
        $this->source->update(['status' => [FormStatus::CANCELED]]);
        GlPostingStatus::create(['referenceable_type' => $this->source::class, 'referenceable_id' => $this->source->getKey(), 'status' => 'posted', 'posted_at' => now()]);

        $this->gateway()->post($this->ctx());

        $this->assertSame('posted', GlPostingStatus::query()->where('referenceable_id', $this->source->getKey())->firstOrFail()->status->value);
    }

    public function test_deferred_context_is_built_only_in_on_mode(): void {
        $built = 0;
        $guard = $this->guardContext();
        $full  = function () use (&$built): PostingContext {
            $built++;

            return $this->ctx();
        };

        foreach (['off', 'shadow'] as $mode) {
            $this->setMode(PostingDocumentType::PurchaseReceipt, $mode);
            try {
                $this->gateway()->postDeferred($guard, $full);
                $this->fail("mode {$mode}: harus gagal tertutup");
            } catch (PostingModeNotOnException) {
                $this->assertSame(0, $built, "Mode {$mode}: pabrik konteks tidak berjalan.");
            }
        }

        $this->setMode(PostingDocumentType::PurchaseReceipt, 'on');
        $this->source->update(['status' => [FormStatus::APPROVED]]);
        $this->gateway()->postDeferred($guard, $full);
        $this->assertSame(1, $built);
    }

    public function test_on_mode_reports_already_posted_on_retry_without_new_journals(): void {
        $this->setMode(PostingDocumentType::PurchaseReceipt, 'on');

        $first = $this->gateway()->post($this->ctx());
        $retry = $this->gateway()->post($this->ctx());

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
                ['gain_loss'             => 30],
                ['sales_invoice_item_id' => 'L1'],
                ['gain_loss_disposal'    => $gain->id, 'fixed_asset' => $fixed->id],
                guardDocument: ['type' => $invoice::class, 'id' => $invoice->getKey()],
            );

            $outcome = $this->gateway()->post($ctx);

            $this->assertSame(PostingOutcome::SKIPPED, $outcome->status, $mode);
            $this->assertSame(0, Journal::count(), $mode);
            $this->assertSame('skipped', GlPostingStatus::query()->where('referenceable_id', $invoice->getKey())->firstOrFail()->status->value, $mode);
        }
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

            try {
                $this->gateway()->post($this->ctx());
            } catch (PostingModeNotOnException) {
                // off/shadow gagal tertutup setelah guard membaca sumber.
            }

            $this->assertNotEmpty($levels, "mode {$mode}: guard harus membaca sumber");
            $this->assertSame([], array_filter($levels, fn (int $level): bool => $level < 1), "mode {$mode}: sumber dibaca di luar transaksi");
        }
    }
}
