<?php

namespace Tests\Feature\Finances\Characterization;

use App\Enums\FormStatus;
use App\Enums\JournalStatus;
use App\Enums\PostingDocumentType;
use App\Events\Asset\AssetSoldViaInvoice;
use App\Listeners\Asset\Rental\PostAssetDisposalGainLoss;
use App\Models\Asset\Asset;
use App\Models\Asset\AssetDepreciationSchedule;
use App\Models\Core\GlPostingStatus;
use App\Models\Finances\Account;
use App\Models\Finances\FinanceSetting;
use App\Models\Finances\GeneralLedger;
use App\Models\Finances\Journal;
use App\Models\Finances\PostingProfile;
use App\Models\Finances\SalesInvoice;
use App\Models\Finances\SalesInvoiceItem;
use App\Services\Core\Setting\SettingsService;
use App\Services\Finances\Ledger\FiscalPeriodService;
use App\Services\Finances\Ledger\JournalReversalService;
use App\Services\Finances\SalesInvoiceService;
use Carbon\CarbonInterface;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\AssertsPostingParity;
use Tests\Support\BuildsAssetFixtures;
use Tests\Support\BuildsFinanceFixtures;
use Tests\Support\EnablesEnginePosting;
use Tests\TestCase;

/**
 * Titik posting #10 (Lampiran B PRD): jurnal pelepasan aset (penjualan via invoice), bentuk baku T-7 (keputusan pemilik
 * produk 2026-11-22; opsi A 2026-11-23). Sebelumnya uji ini mengunci jurnal lama (hanya untung/rugi vs aset tetap, arah
 * terbalik, impas tidak diposting); parity terhadap jurnal lama sengaja berbeda seperti F-10.
 *
 * Jurnal pelepasan mendebit PENDAPATAN (membalik kredit Sales Invoice atas baris aset), bukan piutang. Gabungan dengan
 * jurnal Sales Invoice = Dr piutang (harga jual), Dr akumulasi penyusutan, Cr aset tetap (harga perolehan), untung di
 * kredit, rugi di debit. Fixture: perolehan 1.000, akumulasi awal 400 (nilai buku 600).
 */
class AssetDisposalGainLossPostingTest extends TestCase {
    use AssertsPostingParity, BuildsAssetFixtures, BuildsFinanceFixtures, EnablesEnginePosting, RefreshDatabase;

    private Account $revenue;
    private Account $discount;
    private Account $receivable;

    protected function setUp(): void {
        parent::setUp();

        $this->setUpFinanceFixtures([PostingProfile::class, SalesInvoice::class]);

        $this->receivable = $this->makeAccount('1200', 'Piutang Usaha', 'asset', 'debit', 'accounts_receivable');
        $this->revenue    = $this->makeAccount('4100', 'Penjualan', 'income', 'credit', 'sales');
        $this->discount   = $this->makeAccount('4900', 'Potongan Penjualan', 'income', 'debit');
        $this->enableEnginePosting(['receivable' => $this->receivable, 'revenue' => $this->revenue, 'discount' => $this->discount]);
    }

    /**
     * @param  array<string, mixed>  $assetAttributes
     * @return array{asset: Asset, fixed: Account, accum: Account, gainLoss: Account}
     */
    private function bookedAsset(array $assetAttributes = []): array {
        return $this->makeAssetWithAccounts(['opening_accumulated_depreciation' => 400, ...$assetAttributes]);
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    private function sell(Asset $asset, float $price, float $quantity = 1, array $attributes = [], ?CarbonInterface $invoiceDate = null): SalesInvoiceItem {
        $line = SalesInvoiceItem::factory()->create(['item_id' => null, 'asset_id' => $asset->id, 'quantity' => $quantity, 'price' => $price, ...$attributes]);

        (new PostAssetDisposalGainLoss)->handle(new AssetSoldViaInvoice($line, $invoiceDate));

        return $line->fresh();
    }

    /**
     * Jurnal pelepasan sebagai peta nomor akun => [debit, kredit] (baris pada akun sama sudah digabung engine).
     *
     * @return array<string, array{0: float, 1: float}>
     */
    private function disposalLines(Asset $asset, SalesInvoiceItem $line): array {
        $signature = $this->journalSignature($asset)["disposal:{$line->id}"] ?? null;
        $this->assertNotNull($signature, 'Jurnal pelepasan tidak terposting.');

        $lines = [];
        foreach ($signature['lines'] as [$account, $debit, $credit]) {
            $lines[$account] = [$debit, $credit];
        }
        ksort($lines);

        return $lines;
    }

    public function test_gain_debits_revenue_and_accumulated_depreciation_and_credits_fixed_asset_at_cost_and_gain(): void {
        ['asset' => $asset] = $this->bookedAsset();

        $line = $this->sell($asset, 700);

        $this->assertSame([
            '1500' => [0.0, 1000.0],
            '1590' => [400.0, 0.0],
            '4100' => [700.0, 0.0],
            '7100' => [0.0, 100.0],
        ], $this->disposalLines($asset, $line));
        $this->assertNotNull($line->processed_at);
        $this->assertPostingStatus($line, 'posted');
    }

    public function test_loss_debits_the_gain_loss_account(): void {
        ['asset' => $asset] = $this->bookedAsset();

        $line = $this->sell($asset, 500);

        $this->assertSame([
            '1500' => [0.0, 1000.0],
            '1590' => [400.0, 0.0],
            '4100' => [500.0, 0.0],
            '7100' => [100.0, 0.0],
        ], $this->disposalLines($asset, $line));
    }

    public function test_sale_at_book_value_still_posts_the_asset_removal_without_a_gain_loss_line(): void {
        ['asset' => $asset] = $this->bookedAsset();

        $line = $this->sell($asset, 600);

        $this->assertSame([
            '1500' => [0.0, 1000.0],
            '1590' => [400.0, 0.0],
            '4100' => [600.0, 0.0],
        ], $this->disposalLines($asset, $line));
        $this->assertNotNull($line->processed_at);
        $this->assertSame(FormStatus::POSTED, GlPostingStatus::where('referenceable_id', $line->id)->first()->status);
    }

    public function test_accumulated_depreciation_is_posted_schedules_plus_opening_balance(): void {
        ['asset' => $asset] = $this->bookedAsset(['is_depreciable' => true, 'opening_accumulated_depreciation' => 100]);
        AssetDepreciationSchedule::factory()->create(['asset_id' => $asset->id, 'schedule_date' => now()->subDay(), 'depreciation_amount' => 300]);
        $this->artisan('assets:post-depreciation')->assertSuccessful();
        // Jadwal yang belum terposting tidak ikut akumulasi.
        AssetDepreciationSchedule::factory()->create(['asset_id' => $asset->id, 'schedule_date' => now()->addMonth(), 'depreciation_amount' => 999]);

        $this->assertEqualsWithDelta(400.0, $asset->fresh()->accumulatedDepreciation(), 0.001);
        $this->assertEqualsWithDelta(600.0, $asset->fresh()->bookValue(), 0.001);

        $line = $this->sell($asset->fresh(), 700);

        $this->assertSame([
            '1500' => [0.0, 1000.0],
            '1590' => [400.0, 0.0],
            '4100' => [700.0, 0.0],
            '7100' => [0.0, 100.0],
        ], $this->disposalLines($asset, $line));
    }

    public function test_quantity_above_one_uses_the_line_total_not_the_unit_price(): void {
        // 4 unit senilai 1.000; jual 2 unit @ 2.000 (basic 4.000): perolehan 500, akumulasi 200, nilai buku 300, untung 3.700.
        ['asset' => $asset] = $this->bookedAsset(['asset_quantity' => 4, 'allow_bulk_quantity' => true]);

        $line = $this->sell($asset, 2000, 2);

        $this->assertSame([
            '1500' => [0.0, 500.0],
            '1590' => [200.0, 0.0],
            '4100' => [4000.0, 0.0],
            '7100' => [0.0, 3700.0],
        ], $this->disposalLines($asset, $line));
    }

    public function test_discount_reduces_proceeds_and_pre_cutover_form_stays_net(): void {
        ['asset' => $asset] = $this->bookedAsset();

        $line = $this->sell($asset, 700, 1, ['discount_amount' => 100]);

        // Hasil bersih 600 = nilai buku: impas; pendapatan dibalik sebesar bersih.
        $this->assertSame([
            '1500' => [0.0, 1000.0],
            '1590' => [400.0, 0.0],
            '4100' => [600.0, 0.0],
        ], $this->disposalLines($asset, $line));
    }

    public function test_discount_split_reverses_gross_revenue_and_credits_the_discount_account(): void {
        app(SettingsService::class)->update(FinanceSetting::class, [FinanceSetting::DISCOUNT_SPLIT_COLUMNS[PostingDocumentType::SalesInvoice->value] => '2020-01-01']);
        ['asset' => $asset] = $this->bookedAsset();

        $line = $this->sell($asset, 700, 1, ['discount_amount' => 100]);

        $this->assertSame([
            '1500' => [0.0, 1000.0],
            '1590' => [400.0, 0.0],
            '4100' => [700.0, 0.0],
            '4900' => [0.0, 100.0],
        ], $this->disposalLines($asset, $line));
    }

    public function test_return_invoice_line_posts_no_disposal_and_is_marked_skipped(): void {
        ['asset' => $asset] = $this->bookedAsset();
        $original           = SalesInvoice::factory()->create();
        $returnInvoice      = SalesInvoice::factory()->create(['return_against_id' => $original->id]);

        $line = $this->sell($asset, 700, 1, ['sales_invoice_id' => $returnInvoice->id]);

        $this->assertSame([], $this->journalSignature($asset));
        $this->assertNull($line->processed_at);
        $this->assertPostingStatus($line, 'skipped');
    }

    /**
     * Setujui Sales Invoice satu baris aset (perolehan 10.000, akumulasi awal 4.000) dan kembalikan saldo bersih per akun
     * gabungan jurnal Sales Invoice + jurnal pelepasan (debit - kredit).
     *
     * @param  array<string, mixed>  $itemAttributes
     * @return array<string, float>
     */
    private function approveAndNetBalances(array $itemAttributes): array {
        ['asset' => $asset] = $this->bookedAsset(['gross_purchase_amount' => 10000, 'opening_accumulated_depreciation' => 4000]);
        $invoice            = $this->makeSalesInvoice($this->receivable, $this->revenue, [], ['item_id' => null, 'asset_id' => $asset->id, 'quantity' => 1, ...$itemAttributes]);

        app(SalesInvoiceService::class)->onApproved($invoice);

        $net = [];
        foreach ([$this->journalSignature($invoice), $this->journalSignature($asset)] as $signatures) {
            foreach ($signatures as $journal) {
                foreach ($journal['lines'] as [$account, $debit, $credit]) {
                    $net[$account] = round(($net[$account] ?? 0.0) + $debit - $credit, 2);
                }
            }
        }
        ksort($net);

        return $net;
    }

    public function test_canceling_the_sales_invoice_voids_the_disposal_journal_and_restores_account_balances(): void {
        ['asset' => $asset] = $this->bookedAsset(['gross_purchase_amount' => 10000, 'opening_accumulated_depreciation' => 4000]);
        $invoice            = $this->makeSalesInvoice($this->receivable, $this->revenue, [], ['item_id' => null, 'asset_id' => $asset->id, 'quantity' => 1]);
        app(SalesInvoiceService::class)->onApproved($invoice);
        $this->assertNotSame([], $this->journalSignature($asset));

        app(SalesInvoiceService::class)->cancel($invoice->fresh());
        app(SalesInvoiceService::class)->cancel($invoice->fresh());

        $journals = Journal::query()->withoutGlobalScopes()->where('source_type', $asset->getMorphClass())->get();
        $this->assertNotEmpty($journals);
        $this->assertSame([JournalStatus::Voided->value], $journals->pluck('status')->unique()->values()->all());
        $this->assertSame(0, GeneralLedger::query()->whereIn('journal_id', $journals->pluck('id'))->count());
    }

    public function test_reversing_the_disposal_journal_then_canceling_the_invoice_voids_both_and_nets_every_account_to_zero(): void {
        ['asset' => $asset] = $this->bookedAsset(['gross_purchase_amount' => 10000, 'opening_accumulated_depreciation' => 4000]);
        $invoice            = $this->makeSalesInvoice($this->receivable, $this->revenue, [], ['item_id' => null, 'asset_id' => $asset->id, 'quantity' => 1]);
        app(SalesInvoiceService::class)->onApproved($invoice);

        $disposal = Journal::query()->where('source_type', $asset->getMorphClass())->firstOrFail();
        $reversal = app(JournalReversalService::class)->reverse($disposal);

        app(SalesInvoiceService::class)->cancel($invoice->fresh());

        $this->assertSame(JournalStatus::Voided->value, Journal::query()->withoutGlobalScopes()->find($disposal->id)->status);
        $this->assertSame(JournalStatus::Voided->value, Journal::query()->withoutGlobalScopes()->find($reversal->id)->status);

        $net = GeneralLedger::query()->get()->groupBy('account_id')->map(fn ($rows) => round((float) $rows->sum('debit') - (float) $rows->sum('credit'), 2));
        $this->assertSame([], $net->filter(fn ($value) => $value !== 0.0)->all());
    }

    public function test_canceling_the_invoice_marks_the_asset_line_posting_status_skipped(): void {
        ['asset' => $asset] = $this->bookedAsset();
        $invoice            = $this->makeSalesInvoice($this->receivable, $this->revenue, [], ['item_id' => null, 'asset_id' => $asset->id, 'quantity' => 1]);
        app(SalesInvoiceService::class)->onApproved($invoice);
        $line = $invoice->items()->first();
        $this->assertEquals(FormStatus::POSTED, GlPostingStatus::where('referenceable_id', $line->id)->first()->status);

        app(SalesInvoiceService::class)->cancel($invoice->fresh());

        $this->assertEquals(FormStatus::SKIPPED, GlPostingStatus::where('referenceable_id', $line->id)->first()->status);
    }

    private function unpostedSchedule(Asset $asset): AssetDepreciationSchedule {
        return AssetDepreciationSchedule::factory()->create(['asset_id' => $asset->id, 'schedule_date' => now()->subDay(), 'depreciation_amount' => 100.0]);
    }

    public function test_full_quantity_disposal_posting_stops_unposted_schedules_without_a_delivery_note(): void {
        ['asset' => $asset] = $this->bookedAsset();
        $posted             = $this->unpostedSchedule($asset);
        GlPostingStatus::create(['referenceable_type' => AssetDepreciationSchedule::class, 'referenceable_id' => $posted->id, 'status' => FormStatus::POSTED->value]);
        $unposted = $this->unpostedSchedule($asset);

        $this->sell($asset, 700);
        $this->sell($asset->refresh(), 0); // idempoten: baris kedua tidak mengubah hasil

        $this->assertSoftDeleted($unposted);
        $this->assertNotSoftDeleted($posted);
        $this->assertTrue($asset->refresh()->isFullySold());

        $this->artisan('assets:post-depreciation')->assertSuccessful();
        $this->assertDatabaseMissing('gl_posting_statuses', ['referenceable_id' => $unposted->id]);
    }

    public function test_partial_quantity_disposal_keeps_the_schedules(): void {
        ['asset' => $asset] = $this->bookedAsset(['allow_bulk_quantity' => true, 'asset_quantity' => 2]);
        $unposted           = $this->unpostedSchedule($asset);

        $this->sell($asset, 700, 1);

        $this->assertNotSoftDeleted($unposted);
        $this->assertFalse($asset->refresh()->isFullySold());
    }

    public function test_invoice_then_delivery_note_keeps_schedules_stopped(): void {
        ['asset' => $asset] = $this->bookedAsset();
        $unposted           = $this->unpostedSchedule($asset);

        $this->sell($asset, 700);
        $asset->refresh()->addSoldQuantity(1); // DN belakangan

        $this->assertSoftDeleted($unposted);
        $this->assertTrue($asset->refresh()->isFullySold());
    }

    public function test_a_canceled_disposal_no_longer_counts_as_fully_sold(): void {
        ['asset' => $asset] = $this->bookedAsset();
        $invoice            = $this->makeSalesInvoice($this->receivable, $this->revenue, [], ['item_id' => null, 'asset_id' => $asset->id, 'quantity' => 1]);
        app(SalesInvoiceService::class)->onApproved($invoice);
        $this->assertTrue($asset->refresh()->isFullySold());

        app(SalesInvoiceService::class)->cancel($invoice->fresh());

        $this->assertFalse($asset->refresh()->isFullySold());
    }

    public function test_canceling_an_invoice_without_asset_lines_leaves_other_disposal_journals_untouched(): void {
        ['asset' => $asset] = $this->bookedAsset();
        $line               = $this->sell($asset, 700);
        $other              = $this->makeSalesInvoice($this->receivable, $this->revenue, [], []);

        app(SalesInvoiceService::class)->cancel($other->fresh());

        $this->assertArrayHasKey("disposal:{$line->id}", $this->journalSignature($asset));
    }

    public function test_combined_with_the_sales_invoice_journal_the_result_is_the_standard_disposal_form(): void {
        $net = $this->approveAndNetBalances(['price' => 7000, 'tax_rate' => 0]);

        // Piutang tepat harga jual (tidak ganda), pendapatan saling meniadakan, nilai buku keluar, untung 1.000 di kredit.
        $this->assertSame(['1200' => 7000.0, '1500' => -10000.0, '1590' => 4000.0, '4100' => 0.0, '7100' => -1000.0], $net);
        $this->assertSame(0.0, array_sum($net));
        $this->assertSame(2, Journal::query()->count());
    }

    public function test_combined_with_a_taxed_sales_invoice_leaves_only_the_tax_in_revenue(): void {
        // Harga 7.200: DPP baris 6.600 (basic x 11/12), pajak 10% = 660.
        $net = $this->approveAndNetBalances(['price' => 7200, 'tax_rate' => 10]);

        // F-03: pajak masih menyatu di pendapatan sampai Fase 3, jadi sisa pendapatan = pajak (660) di kredit; piutang
        // menanggung harga jual + pajak (7.860). Untung 1.200 = 7.200 + 4.000 - 10.000 (pajak tidak ikut hasil penjualan).
        $this->assertSame(['1200' => 7860.0, '1500' => -10000.0, '1590' => 4000.0, '4100' => -660.0, '7100' => -1200.0], $net);
        $this->assertSame(0.0, array_sum($net));
    }

    public function test_combined_with_discount_split_active_returns_both_revenue_and_discount_to_zero(): void {
        app(SettingsService::class)->update(FinanceSetting::class, [FinanceSetting::DISCOUNT_SPLIT_COLUMNS[PostingDocumentType::SalesInvoice->value] => '2020-01-01']);

        $net = $this->approveAndNetBalances(['price' => 7000, 'tax_rate' => 0, 'discount_amount' => 500]);

        // SI: Dr piutang 6.500, Dr diskon 500, Cr pendapatan 7.000; pelepasan membalik kotor: pendapatan dan diskon nol.
        $this->assertSame(['1200' => 6500.0, '1500' => -10000.0, '1590' => 4000.0, '4100' => 0.0, '4900' => 0.0, '7100' => -500.0], $net);
        $this->assertSame(0.0, array_sum($net));
    }

    public function test_disposal_form_follows_the_invoice_approval_date_not_the_job_run_date(): void {
        // Cutover hari ini; SI disetujui kemarin (jurnal bersih, sebelum cutover) tetapi job pelepasan baru berjalan hari
        // ini: pelepasan harus tetap bersih agar pendapatan dan diskon baris aset kembali nol.
        app(SettingsService::class)->update(FinanceSetting::class, [FinanceSetting::DISCOUNT_SPLIT_COLUMNS[PostingDocumentType::SalesInvoice->value] => app(FiscalPeriodService::class)->businessDay(now())]);
        ['asset' => $asset] = $this->bookedAsset();

        $line = $this->sell($asset, 700, 1, ['discount_amount' => 100], now()->subDay());

        $this->assertSame([
            '1500' => [0.0, 1000.0],
            '1590' => [400.0, 0.0],
            '4100' => [600.0, 0.0],
        ], $this->disposalLines($asset, $line));
    }

    public function test_disposal_form_is_split_when_the_invoice_was_approved_after_cutover(): void {
        // Kebalikannya: SI disetujui hari ini (setelah cutover kemarin) sehingga jurnalnya bentuk kotor.
        app(SettingsService::class)->update(FinanceSetting::class, [FinanceSetting::DISCOUNT_SPLIT_COLUMNS[PostingDocumentType::SalesInvoice->value] => app(FiscalPeriodService::class)->businessDay(now()->subDay())]);
        ['asset' => $asset] = $this->bookedAsset();

        $line = $this->sell($asset, 700, 1, ['discount_amount' => 100], now());

        $this->assertSame([
            '1500' => [0.0, 1000.0],
            '1590' => [400.0, 0.0],
            '4100' => [700.0, 0.0],
            '4900' => [0.0, 100.0],
        ], $this->disposalLines($asset, $line));
    }
}
