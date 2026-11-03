<?php

namespace Tests\Feature\Finances\Characterization;

use App\Enums\FormStatus;
use App\Models\Asset\Asset;
use App\Models\Asset\AssetDepreciationSchedule;
use App\Models\Core\GlPostingStatus;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\BuildsAssetFixtures;
use Tests\Support\BuildsFinanceFixtures;
use Tests\TestCase;

/**
 * Characterization Fase 0 (titik posting #8, Lampiran B PRD): scrap aset.
 *
 * Jalur penuh `Asset::scrap()` → `AssetScrapped` → `PostScrapWriteOff`. Jurnal memakai nilai buku sebagai jumlah
 * hapus buku: debit akumulasi penyusutan, kredit aset tetap (perilaku saat ini, dikunci apa adanya).
 */
class AssetScrapPostingTest extends TestCase {
    use BuildsAssetFixtures, BuildsFinanceFixtures, RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        $this->setUpFinanceFixtures();
    }

    public function test_scrap_writes_off_book_value_against_accumulated_depreciation(): void {
        ['asset' => $asset, 'fixed' => $fixed, 'accum' => $accum] = $this->makeAssetWithAccounts(['is_depreciable' => true]);

        $asset->scrap();

        $this->assertLedger($asset->fresh(), [
            ['account' => $accum, 'against' => $fixed, 'debit' => 1000, 'credit' => 0],
            ['account' => $fixed, 'against' => $accum, 'debit' => 0, 'credit' => 1000],
        ], now()->toDateString());

        $asset = $asset->fresh();
        $this->assertContains(FormStatus::SCRAPPED, $asset->status);
        $this->assertNotContains(FormStatus::ACTIVE, $asset->status);
        $this->assertPostingStatus($asset, 'posted');
        $this->assertSame(
            $this->ledgerOf($asset)->firstWhere('credit', 1000.0)->id,
            $asset->journal_entry_for_scrap_id,
            'journal_entry_for_scrap_id menunjuk baris kredit aset tetap.',
        );
    }

    public function test_scrap_amount_is_book_value_after_posted_depreciation(): void {
        ['asset' => $asset, 'fixed' => $fixed] = $this->makeAssetWithAccounts(['is_depreciable' => true]);
        AssetDepreciationSchedule::factory()->create(['asset_id' => $asset->id, 'schedule_date' => now()->subDay(), 'depreciation_amount' => 400]);
        $this->artisan('assets:post-depreciation')->assertSuccessful();

        $asset->fresh()->scrap();

        $scrapRows = $this->ledgerOf($asset->fresh());
        $this->assertCount(2, $scrapRows);
        $this->assertEqualsWithDelta(600, $scrapRows->where('account_id', $fixed->id)->first()->credit, 0.01);
    }

    public function test_non_depreciable_asset_scrap_posts_nothing(): void {
        ['asset' => $asset] = $this->makeAssetWithAccounts(['is_depreciable' => false]);

        $asset->scrap();

        $this->assertCount(0, $this->ledgerOf($asset->fresh()));
        $this->assertSame(0, GlPostingStatus::where('referenceable_type', Asset::class)->where('referenceable_id', $asset->id)->count());
        $this->assertContains(FormStatus::SCRAPPED, $asset->fresh()->status);
    }
}
