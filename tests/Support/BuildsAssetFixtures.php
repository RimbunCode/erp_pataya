<?php

namespace Tests\Support;

use App\Enums\FormStatus;
use App\Models\Asset\Asset;
use App\Models\Asset\AssetCategoryAccount;
use App\Models\Finances\Account;

/**
 * Fixture aset untuk characterization test Finance (depresiasi, scrap, penyesuaian nilai, disposal).
 * Dipakai bersama `BuildsFinanceFixtures`, yang menyediakan `$this->branch` dan `makeAccount()`.
 */
trait BuildsAssetFixtures {
    /**
     * Aset aktif di cabang utama beserta akun kategorinya (`AssetCategoryAccount`) per cabang tersebut.
     *
     * @param  array<string, mixed>  $assetAttributes
     * @return array{asset: Asset, fixed: Account, accum: Account, expense: Account, gainLoss: Account}
     */
    protected function makeAssetWithAccounts(array $assetAttributes = []): array {
        $fixed    = $this->makeAccount('1500', 'Aset Tetap', 'asset', 'debit', 'fixed_asset');
        $accum    = $this->makeAccount('1590', 'Akumulasi Penyusutan', 'asset', 'credit', 'accumulated_depreciation');
        $expense  = $this->makeAccount('6100', 'Beban Penyusutan', 'expense', 'debit', 'depreciation_expense');
        $gainLoss = $this->makeAccount('7100', 'Laba Rugi Pelepasan', 'income', 'credit', 'gain_loss_disposal');

        $asset = Asset::factory()->create([
            'gross_purchase_amount' => 1000,
            'status'                => [FormStatus::ACTIVE],
            ...$assetAttributes,
        ]);
        $asset->assetLocation->update(['branch_id' => $this->branch->id]);

        AssetCategoryAccount::factory()->create([
            'asset_category_id'                   => $asset->asset_category_id,
            'branch_id'                           => $this->branch->id,
            'fixed_asset_account_id'              => $fixed->id,
            'accumulated_depreciation_account_id' => $accum->id,
            'depreciation_expense_account_id'     => $expense->id,
            'gain_loss_disposal_account_id'       => $gainLoss->id,
        ]);

        return ['asset' => $asset->refresh(), 'fixed' => $fixed, 'accum' => $accum, 'expense' => $expense, 'gainLoss' => $gainLoss];
    }
}
