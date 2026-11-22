<?php

namespace Tests\Feature\Finances\Characterization;

use App\Enums\FormStatus;
use App\Enums\PostingDocumentType;
use App\Events\Asset\AssetSoldViaInvoice;
use App\Listeners\Asset\Rental\PostAssetDisposalGainLoss;
use App\Models\Asset\Asset;
use App\Models\Asset\AssetDepreciationSchedule;
use App\Models\Core\GlPostingStatus;
use App\Models\Finances\Account;
use App\Models\Finances\FinanceSetting;
use App\Models\Finances\Journal;
use App\Models\Finances\PostingProfile;
use App\Models\Finances\SalesInvoice;
use App\Models\Finances\SalesInvoiceItem;
use App\Services\Core\Setting\SettingsService;
use App\Services\Finances\SalesInvoiceService;
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
    private function sell(Asset $asset, float $price, float $quantity = 1, array $attributes = []): SalesInvoiceItem {
        $line = SalesInvoiceItem::factory()->create(['item_id' => null, 'asset_id' => $asset->id, 'quantity' => $quantity, 'price' => $price, ...$attributes]);

        (new PostAssetDisposalGainLoss)->handle(new AssetSoldViaInvoice($line));

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

    public function test_combined_with_the_sales_invoice_journal_the_result_is_the_standard_disposal_form(): void {
        ['asset' => $asset] = $this->bookedAsset(['gross_purchase_amount' => 10000, 'opening_accumulated_depreciation' => 4000]);
        $invoice            = $this->makeSalesInvoice($this->receivable, $this->revenue, [], ['item_id' => null, 'asset_id' => $asset->id, 'quantity' => 1, 'price' => 7000, 'tax_rate' => 0]);

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

        // Piutang tepat harga jual (tidak ganda), pendapatan saling meniadakan, nilai buku keluar, untung 1.000 di kredit.
        $this->assertSame(['1200' => 7000.0, '1500' => -10000.0, '1590' => 4000.0, '4100' => 0.0, '7100' => -1000.0], $net);
        $this->assertSame(0.0, array_sum($net));
        $this->assertSame(2, Journal::query()->count());
    }
}
