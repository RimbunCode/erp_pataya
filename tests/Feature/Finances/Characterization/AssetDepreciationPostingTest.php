<?php

namespace Tests\Feature\Finances\Characterization;

use App\Enums\FormStatus;
use App\Models\Asset\AssetDepreciationSchedule;
use App\Models\Core\GlPostingStatus;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\BuildsAssetFixtures;
use Tests\Support\BuildsFinanceFixtures;
use Tests\TestCase;

/**
 * Characterization Fase 0 (titik posting #7, Lampiran B PRD): depresiasi aset.
 *
 * Jalur penuh: `assets:post-depreciation` → `GlPostingStatus` pending → `AssetDepreciationDue` → `PostDepreciationEntry`
 * (queue sinkron di test). Jadwal diproses hanya bila `schedule_date <= now()`.
 */
class AssetDepreciationPostingTest extends TestCase {
    use BuildsAssetFixtures, BuildsFinanceFixtures, RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        $this->setUpFinanceFixtures();
    }

    private function makeSchedule($asset, float $amount, $date = null): AssetDepreciationSchedule {
        return AssetDepreciationSchedule::factory()->create([
            'asset_id'            => $asset->id,
            'schedule_date'       => $date ?? now()->subDay(),
            'depreciation_amount' => $amount,
        ]);
    }

    public function test_due_schedule_debits_depreciation_expense_and_credits_accumulated_depreciation(): void {
        ['asset' => $asset, 'expense' => $expense, 'accum' => $accum] = $this->makeAssetWithAccounts();
        $schedule                                                     = $this->makeSchedule($asset, 500);

        $this->artisan('assets:post-depreciation')->assertSuccessful();

        $this->assertLedger($schedule, [
            ['account' => $expense, 'against' => $accum, 'debit' => 500, 'credit' => 0],
            ['account' => $accum, 'against' => $expense, 'debit' => 0, 'credit' => 500],
        ], now()->toDateString());
        $this->assertPostingStatus($schedule, 'posted');
    }

    public function test_schedule_not_yet_due_is_not_posted(): void {
        ['asset' => $asset] = $this->makeAssetWithAccounts();
        $schedule           = $this->makeSchedule($asset, 500, now()->addMonth());

        $this->artisan('assets:post-depreciation')->assertSuccessful();

        $this->assertCount(0, $this->ledgerOf($schedule));
        $this->assertSame(0, GlPostingStatus::where('referenceable_id', $schedule->id)->count());
    }

    public function test_posting_last_schedule_marks_asset_fully_depreciated(): void {
        ['asset' => $asset] = $this->makeAssetWithAccounts();
        $this->makeSchedule($asset, 500);

        $this->artisan('assets:post-depreciation')->assertSuccessful();

        $asset = $asset->fresh();
        $this->assertTrue((bool) $asset->is_fully_depreciated);
        $this->assertContains(FormStatus::FULLY_DEPRECIATED, $asset->status);
    }

    public function test_zero_amount_schedule_posts_no_ledger_rows_but_is_marked_posted(): void {
        ['asset' => $asset] = $this->makeAssetWithAccounts();
        $schedule           = $this->makeSchedule($asset, 0);

        $this->artisan('assets:post-depreciation')->assertSuccessful();

        $this->assertCount(0, $this->ledgerOf($schedule));
        $this->assertPostingStatus($schedule, 'posted');
    }

    public function test_second_run_does_not_post_the_same_schedule_again(): void {
        ['asset' => $asset] = $this->makeAssetWithAccounts();
        $schedule           = $this->makeSchedule($asset, 500);

        $this->artisan('assets:post-depreciation')->assertSuccessful();
        $this->artisan('assets:post-depreciation')->assertSuccessful();

        $this->assertCount(2, $this->ledgerOf($schedule));
    }
}
