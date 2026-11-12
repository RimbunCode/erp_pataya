<?php

namespace App\Services\Finances\Posting\Rules;

use App\Enums\AccountRole;
use App\Enums\PostingDocumentType;
use App\Services\Finances\Posting\Contexts\PostingContext;

/**
 * Delivery Note (design.md, peta rule): satu jurnal `default`, debit `cost_of_goods_sold`, kredit `stock` sebesar
 * `amounts['total_picked']`; retur menukar sisi (`flags['is_return']`).
 */
final class DeliveryNoteRule extends BasePostingRule {
    public function documentType(): PostingDocumentType {
        return PostingDocumentType::DeliveryNote;
    }

    public function build(PostingContext $ctx): array {
        return self::compact([
            self::pair('default', AccountRole::CostOfGoodsSold, AccountRole::Stock, $ctx->amount('total_picked'), $ctx->isReturn()),
        ]);
    }
}
