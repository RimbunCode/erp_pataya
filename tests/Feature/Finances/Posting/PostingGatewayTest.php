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
use App\Services\Finances\Posting\Contexts\PostingContext;
use App\Services\Finances\Posting\PostingGateway;
use App\Services\Finances\Posting\PostingOutcome;
use App\Services\Finances\Posting\PostingProfileService;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\Support\BuildsFinanceFixtures;
use Tests\TestCase;

/**
 * Finance Fase 2, Task 5.3-5.4, Task 14.1 dan Q-P2-23 (2026-11-22): `PostingGateway`. Mode `off`/`shadow` dihapus dan
 * engine selalu aktif, jadi gateway hanya punya satu jalur tulis. Yang dikunci di sini: guard cancel (P-6;
 * `GlPostingStatus` pending menjadi `skipped`, pabrik konteks tidak dipanggil), penulisan lewat engine tanpa fallback
 * diam-diam (Requirement 7.6), dan gateway memposting tanpa baris setting Finance sama sekali (tidak ada sakelar mode).
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

    public function test_gateway_posts_through_the_engine(): void {
        $outcome = $this->gateway()->post($this->ctx());

        $this->assertSame(PostingOutcome::POSTED, $outcome->status);
        $this->assertCount(1, $outcome->journals);
        $journal = Journal::query()->firstOrFail();
        $this->assertSame(StockEntry::class . ':' . $this->source->getKey() . ':default', $journal->posting_key);
        $this->assertSame(0, PostingParityLog::count());
    }

    public function test_unresolved_role_fails_loudly_without_any_fallback(): void {

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

    public function test_canceled_source_is_skipped_p6(): void {
        $this->source->update(['status' => [FormStatus::CANCELED]]);
        GlPostingStatus::create(['referenceable_type' => $this->source::class, 'referenceable_id' => $this->source->getKey(), 'status' => 'pending']);

        $outcome = $this->gateway()->post($this->ctx());

        $this->assertSame(PostingOutcome::SKIPPED, $outcome->status);
        $this->assertSame(0, Journal::count(), 'tidak ada jurnal');
        $this->assertSame(0, PostingParityLog::count(), 'tidak ada parity');
        $this->assertSame('skipped', GlPostingStatus::query()->where('referenceable_id', $this->source->getKey())->firstOrFail()->status->value);
    }

    public function test_non_pending_posting_status_of_a_canceled_source_is_left_untouched(): void {
        $this->source->update(['status' => [FormStatus::CANCELED]]);
        GlPostingStatus::create(['referenceable_type' => $this->source::class, 'referenceable_id' => $this->source->getKey(), 'status' => 'posted', 'posted_at' => now()]);

        $this->gateway()->post($this->ctx());

        $this->assertSame('posted', GlPostingStatus::query()->where('referenceable_id', $this->source->getKey())->firstOrFail()->status->value);
    }

    public function test_deferred_context_is_built_only_when_the_guard_document_is_not_canceled(): void {
        $built = 0;
        $guard = $this->guardContext();
        $full  = function () use (&$built): PostingContext {
            $built++;

            return $this->ctx();
        };

        $this->source->update(['status' => [FormStatus::CANCELED]]);
        GlPostingStatus::create(['referenceable_type' => $this->source::class, 'referenceable_id' => $this->source->getKey(), 'status' => 'pending']);
        $this->assertSame(PostingOutcome::SKIPPED, $this->gateway()->postDeferred($guard, $full)->status);
        $this->assertSame(0, $built, 'Dokumen dibatalkan: pabrik konteks tidak berjalan.');

        $this->source->update(['status' => [FormStatus::APPROVED]]);
        $this->gateway()->postDeferred($guard, $full);
        $this->assertSame(1, $built);
    }

    public function test_gateway_posts_without_any_finance_setting_row(): void {
        // Tidak ada lagi sakelar mode: gateway tidak membaca setting Finance untuk memutuskan boleh memposting atau tidak.
        FinanceSetting::query()->delete();

        $outcome = $this->gateway()->post($this->ctx());

        $this->assertSame(PostingOutcome::POSTED, $outcome->status);
        $this->assertSame(1, Journal::count());
    }

    public function test_finance_setting_no_longer_has_posting_modes(): void {
        $this->assertArrayNotHasKey('posting_modes', FinanceSetting::defaultAttributes());
        $this->assertArrayNotHasKey('posting_modes', FinanceSetting::internalRules());
        $this->assertArrayHasKey('posting_executions', FinanceSetting::internalRules());
        $this->assertFalse(Schema::hasColumn('finance_settings', 'posting_modes'));
    }

    public function test_gateway_reports_already_posted_on_retry_without_new_journals(): void {
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

        $ctx = new PostingContext(
            PostingDocumentType::AssetDisposal,
            $this->source::class,
            $this->source->getKey(),
            CarbonImmutable::parse('2026-11-12 10:00:00'),
            null,
            ['proceeds' => 130, 'cost' => 100, 'accumulated_depreciation' => 0, 'gain_loss' => 30],
            ['sales_invoice_item_id' => 'L1'],
            ['gain_loss_disposal' => $gain->id, 'fixed_asset' => $fixed->id],
            guardDocument: ['type' => $invoice::class, 'id' => $invoice->getKey()],
        );

        $outcome = $this->gateway()->post($ctx);

        $this->assertSame(PostingOutcome::SKIPPED, $outcome->status);
        $this->assertSame(0, Journal::count());
        $this->assertSame('skipped', GlPostingStatus::query()->where('referenceable_id', $invoice->getKey())->firstOrFail()->status->value);
    }

    public function test_guard_reads_the_source_inside_a_transaction(): void {
        // Bukti terbatas (SQLite, satu proses): FOR UPDATE diabaikan; yang dibuktikan adalah guard membaca dokumen
        // penjaga pada transactionLevel >= 1 (tempat kunci baris berlaku di MySQL).
        $levels = [];
        DB::listen(function ($query) use (&$levels): void {
            if (str_contains($query->sql, 'stock_entries')) {
                $levels[] = DB::transactionLevel();
            }
        });

        $this->gateway()->post($this->ctx());

        $this->assertNotEmpty($levels, 'guard harus membaca sumber');
        $this->assertSame([], array_filter($levels, fn (int $level): bool => $level < 1), 'sumber dibaca di luar transaksi');
    }
}
