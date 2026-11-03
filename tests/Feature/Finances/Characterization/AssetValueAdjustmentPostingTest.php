<?php

namespace Tests\Feature\Finances\Characterization;

use App\Enums\FormStatus;
use App\Events\Asset\AssetValueAdjustmentApproved;
use App\Listeners\Asset\Depreciation\PostValueAdjustmentEntry;
use App\Models\Asset\AssetValueAdjustment;
use App\Models\Core\GlPostingStatus;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\BuildsAssetFixtures;
use Tests\Support\BuildsFinanceFixtures;
use Tests\TestCase;

/**
 * Characterization Fase 0 (titik posting #9, Lampiran B PRD): penyesuaian nilai aset.
 *
 * Dikunci di batas event `AssetValueAdjustmentApproved` + listener asli (pembuatan event ada di
 * `AssetValueAdjustmentService`, yang membutuhkan alur persetujuan penuh). Nilai kenaikan mendebit aset tetap,
 * penurunan mengkredit; akun lawan adalah `difference_account` milik penyesuaian.
 */
class AssetValueAdjustmentPostingTest extends TestCase {
    use BuildsAssetFixtures, BuildsFinanceFixtures, RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        $this->setUpFinanceFixtures();
    }

    private function adjust(float $current, float $new): array {
        $setup      = $this->makeAssetWithAccounts(['gross_purchase_amount' => $current]);
        $difference = $this->makeAccount('7200', 'Selisih Revaluasi', 'income', 'credit', 'revaluation_gain');

        $adjustment = AssetValueAdjustment::factory()->create([
            'asset_id'              => $setup['asset']->id,
            'current_asset_value'   => $current,
            'new_asset_value'       => $new,
            'difference_account_id' => $difference->id,
        ]);
        GlPostingStatus::create([
            'referenceable_type' => AssetValueAdjustment::class,
            'referenceable_id'   => $adjustment->id,
            'status'             => FormStatus::PENDING,
        ]);

        (new PostValueAdjustmentEntry)->handle(new AssetValueAdjustmentApproved($adjustment, now()));

        return [$adjustment, $setup['asset'], $setup['fixed'], $difference];
    }

    public function test_value_increase_debits_fixed_asset_and_credits_difference_account(): void {
        [$adjustment, $asset, $fixed, $difference] = $this->adjust(5000, 6000);

        $this->assertLedger($adjustment, [
            ['account' => $fixed, 'against' => $difference, 'debit' => 1000, 'credit' => 0],
            ['account' => $difference, 'against' => $fixed, 'debit' => 0, 'credit' => 1000],
        ], now()->toDateString());
        $this->assertPostingStatus($adjustment, 'posted');
        $this->assertEquals(6000.0, (float) $asset->fresh()->gross_purchase_amount);
    }

    public function test_value_decrease_credits_fixed_asset_and_debits_difference_account(): void {
        [$adjustment, $asset, $fixed, $difference] = $this->adjust(5000, 4200);

        $this->assertLedger($adjustment, [
            ['account' => $difference, 'against' => $fixed, 'debit' => 800, 'credit' => 0],
            ['account' => $fixed, 'against' => $difference, 'debit' => 0, 'credit' => 800],
        ], now()->toDateString());
        $this->assertEquals(4200.0, (float) $asset->fresh()->gross_purchase_amount);
    }
}
