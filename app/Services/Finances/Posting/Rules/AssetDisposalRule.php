<?php

namespace App\Services\Finances\Posting\Rules;

use App\Enums\AccountRole;
use App\Enums\PostingDocumentType;
use App\Services\Finances\Posting\Contexts\PostingContext;
use LogicException;

/**
 * Penjualan aset lewat invoice (design.md, peta rule; T-7): jurnal `disposal:{sales_invoice_item_id}` hanya bila
 * `abs(amounts['gain_loss']) > 0.0001` (harga proporsional - nilai buku proporsional, bertanda). Arah dipertahankan
 * demi parity: untung mendebit `gain_loss_disposal` dan mengkredit `fixed_asset`; rugi sebaliknya (T-7, menunggu
 * keputusan akuntan). Kunci idempotensi per baris invoice lewat `flags['sales_invoice_item_id']` (Q-P1-6).
 */
final class AssetDisposalRule extends BasePostingRule {
    private const THRESHOLD = 0.0001;

    public function documentType(): PostingDocumentType {
        return PostingDocumentType::AssetDisposal;
    }

    public function build(PostingContext $ctx): array {
        $gainLoss = $ctx->amount('gain_loss');
        if (abs($gainLoss) <= self::THRESHOLD) {
            return [];
        }

        $lineId = (string) $ctx->flag('sales_invoice_item_id', '');
        if ($lineId === '') {
            throw new LogicException('flags[sales_invoice_item_id] is required for asset disposal posting.');
        }

        return self::compact([
            self::pair("disposal:{$lineId}", AccountRole::GainLossDisposal, AccountRole::FixedAsset, abs($gainLoss), $gainLoss < 0),
        ]);
    }
}
