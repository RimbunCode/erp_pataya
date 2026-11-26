<?php

namespace Tests\Feature\Finances\Posting;

use App\Enums\FormStatus;
use App\Models\Asset\AssetCategoryAccount;
use App\Models\Asset\AssetValueAdjustment;
use App\Models\Finances\Account;
use App\Models\Finances\PostingProfile;
use App\Services\Finances\Posting\AccountPanel\PostedAccountPanel;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Exceptions;
use Tests\Support\BuildsAssetFixtures;
use Tests\Support\BuildsFinanceFixtures;
use Tests\Support\EnablesEnginePosting;
use Tests\TestCase;

/**
 * Finance Fase 2, Task 12.4 (Requirement 13.4 dan 13.7): panel "Akun pencatatan" untuk Asset Value Adjustment.
 * Dokumen yang lewat skema approval berakhir dengan status `[need_approval, submitted]`; panel harus membaca kolom
 * tercatat (bukan pratinjau) pada status itu.
 */
class PostedAccountPanelAssetAdjustmentTest extends TestCase {
    use BuildsAssetFixtures, BuildsFinanceFixtures, EnablesEnginePosting, RefreshDatabase;

    private Account $difference;

    protected function setUp(): void {
        parent::setUp();

        $this->setUpFinanceFixtures([PostingProfile::class]);
        $this->difference = $this->makeAccount('7200', 'Selisih Revaluasi', 'income', 'credit', 'revaluation_gain');
        $this->enableEnginePosting(['asset_revaluation' => $this->difference]);
    }

    /**
     * @param  list<FormStatus>  $status
     * @param  array<string, mixed>  $attributes
     */
    private function adjustment(array $status, float $new = 6000, array $attributes = []): AssetValueAdjustment {
        $setup = $this->makeAssetWithAccounts(['gross_purchase_amount' => 5000]);

        return AssetValueAdjustment::factory()->create([
            'asset_id'            => $setup['asset']->id,
            'current_asset_value' => 5000,
            'new_asset_value'     => $new,
            'status'              => $status,
            ...$attributes,
        ]);
    }

    private function panel(): PostedAccountPanel {
        return app(PostedAccountPanel::class);
    }

    public function test_draft_adjustment_previews_the_revaluation_account(): void {
        $result = $this->panel()->build($this->adjustment([FormStatus::DRAFT])->fresh());

        $this->assertSame('preview', $result['state']);
        $roles = array_column($result['rows'], 'account', 'role');
        $this->assertSame($this->difference->id, $roles['asset_revaluation']['id']);
    }

    public function test_adjustment_waiting_for_approval_alone_is_still_a_preview(): void {
        $result = $this->panel()->build($this->adjustment([FormStatus::NEED_APPROVAL])->fresh());

        $this->assertSame('preview', $result['state']);
    }

    public function test_approved_adjustment_with_need_approval_status_reads_the_recorded_column(): void {
        $other = $this->makeAccount('7300', 'Akun Tercatat', 'income', 'credit');
        $doc   = $this->adjustment([FormStatus::NEED_APPROVAL, FormStatus::SUBMITTED], 6000, ['difference_account_id' => $other->id]);

        $result = $this->panel()->build($doc->fresh());

        $this->assertSame('recorded', $result['state']);
        $this->assertSame([$other->id], array_column(array_column($result['rows'], 'account'), 'id'));
        $this->assertSame('asset_revaluation', $result['rows'][0]['role']);
    }

    public function test_approved_adjustment_without_recorded_column_is_pending_posting(): void {
        $result = $this->panel()->build($this->adjustment([FormStatus::NEED_APPROVAL, FormStatus::SUBMITTED])->fresh());

        $this->assertSame('pending_posting', $result['state']);
    }

    public function test_missing_asset_category_account_is_an_error_naming_the_category_without_reporting(): void {
        Exceptions::fake();
        $doc = $this->adjustment([FormStatus::DRAFT]);
        AssetCategoryAccount::query()->delete();

        $result = $this->panel()->build($doc->fresh());

        $this->assertSame('error', $result['state']);
        $this->assertFalse($result['fixable']);
        $this->assertStringContainsString((string) $doc->asset->assetCategory->category_name, (string) $result['message']);
        Exceptions::assertNothingReported();
    }

    public function test_zero_difference_produces_no_journal_before_and_after_approval(): void {
        $draft = $this->adjustment([FormStatus::DRAFT], 5000);
        $this->assertSame('no_journal', $this->panel()->build($draft->fresh())['state']);

        DB::table('asset_value_adjustments')->where('id', $draft->id)->update(['status' => json_encode([FormStatus::NEED_APPROVAL->value, FormStatus::SUBMITTED->value])]);
        $this->assertSame('no_journal', $this->panel()->build($draft->fresh())['state']);
    }
}
