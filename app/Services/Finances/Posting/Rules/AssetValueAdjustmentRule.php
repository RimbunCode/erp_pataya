<?php

namespace App\Services\Finances\Posting\Rules;

use App\Enums\AccountRole;
use App\Enums\PostingDocumentType;
use App\Services\Finances\Posting\Contexts\PostingContext;

/**
 * Penyesuaian nilai aset (design.md, peta rule; T-2, Q-P2-8): jurnal `value_adjustment` sebesar
 * `abs(amounts['difference_amount'])`. Kenaikan (selisih > 0): debit `fixed_asset`, kredit `asset_revaluation`;
 * penurunan: sisi ditukar.
 */
final class AssetValueAdjustmentRule extends BasePostingRule {
    public function documentType(): PostingDocumentType {
        return PostingDocumentType::AssetValueAdjustment;
    }

    public function build(PostingContext $ctx): array {
        $difference = $ctx->amount('difference_amount');

        return self::compact([
            self::pair('value_adjustment', AccountRole::FixedAsset, AccountRole::AssetRevaluation, abs($difference), $difference < 0),
        ]);
    }
}
