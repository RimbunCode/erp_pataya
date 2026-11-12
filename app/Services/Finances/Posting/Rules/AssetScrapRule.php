<?php

namespace App\Services\Finances\Posting\Rules;

use App\Enums\AccountRole;
use App\Enums\PostingDocumentType;
use App\Services\Finances\Posting\Contexts\PostingContext;

/**
 * Scrap aset (design.md, peta rule; T-1): jurnal `write_off`, debit `accumulated_depreciation`, kredit `fixed_asset`
 * sebesar nilai buku saat scrap (`amounts['write_off_amount']`). Tidak ada baris untung/rugi atau sisa: meniru
 * `PostScrapWriteOff`. Dilewati bila `flags['is_depreciable']` eksplisit false atau jumlahnya tidak positif
 * (event lama hanya dipicu pada `is_depreciable` dan nilai buku > 0).
 */
final class AssetScrapRule extends BasePostingRule {
    public function documentType(): PostingDocumentType {
        return PostingDocumentType::AssetScrap;
    }

    public function build(PostingContext $ctx): array {
        $amount = $ctx->amount('write_off_amount');
        if ($ctx->flag('is_depreciable', true) === false || $amount <= 0) {
            return [];
        }

        return self::compact([self::pair('write_off', AccountRole::AccumulatedDepreciation, AccountRole::FixedAsset, $amount)]);
    }
}
