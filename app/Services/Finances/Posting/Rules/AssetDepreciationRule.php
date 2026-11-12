<?php

namespace App\Services\Finances\Posting\Rules;

use App\Enums\AccountRole;
use App\Enums\PostingDocumentType;
use App\Services\Finances\Posting\Contexts\PostingContext;

/**
 * Depresiasi aset (design.md, peta rule): jurnal `depreciation` bila `amounts['depreciation_amount']` > 0; debit
 * `depreciation_expense`, kredit `accumulated_depreciation`. Akun berasal dari akun master (`AssetCategoryAccount`).
 */
final class AssetDepreciationRule extends BasePostingRule {
    public function documentType(): PostingDocumentType {
        return PostingDocumentType::AssetDepreciation;
    }

    public function build(PostingContext $ctx): array {
        $amount = $ctx->amount('depreciation_amount');
        if ($amount <= 0) {
            return [];
        }

        return self::compact([self::pair('depreciation', AccountRole::DepreciationExpense, AccountRole::AccumulatedDepreciation, $amount)]);
    }
}
