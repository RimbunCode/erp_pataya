<?php

namespace App\Services\Asset\Accounting;

use App\Enums\PostingDocumentType;
use App\Models\Asset\Asset;
use App\Models\Asset\AssetCategoryAccount;
use App\Models\Asset\AssetDepreciationSchedule;
use App\Models\Asset\AssetValueAdjustment;
use App\Models\Finances\SalesInvoice;
use App\Models\Finances\SalesInvoiceItem;
use App\Services\Finances\Posting\Contexts\PostingContext;
use Carbon\CarbonInterface;

/**
 * Pabrik `PostingContext` untuk empat titik posting Asset (Finance Fase 2, Task 7.1). Milik domain Asset (engine tidak
 * mengenal model Asset, P-8). Akun yang dibawa hanya akun master `AssetCategoryAccount` (peran aset; Requirement
 * 3.1.1); akun pilihan pengguna pada dokumen tidak dibaca (Requirement 7.4). `AssetCategoryAccount` dioper pemanggil
 * (listener sudah memuatnya) sehingga pabrik tidak menambah query. `branchId` null dan `sourceType` FQCN, sama dengan
 * jalur `postPair` lama.
 */
final class AssetPostingContextFactory {
    /** @var array<string, string> peran => kolom `AssetCategoryAccount` */
    private const MASTER_COLUMNS = [
        'fixed_asset'              => 'fixed_asset_account_id',
        'accumulated_depreciation' => 'accumulated_depreciation_account_id',
        'depreciation_expense'     => 'depreciation_expense_account_id',
        'capital_work_in_progress' => 'capital_work_in_progress_account_id',
        'gain_loss_disposal'       => 'gain_loss_disposal_account_id',
    ];

    public function depreciation(AssetDepreciationSchedule $schedule, AssetCategoryAccount $accounts, CarbonInterface $transactionDate): PostingContext {
        return new PostingContext(
            documentType: PostingDocumentType::AssetDepreciation,
            sourceType: $schedule->getMorphClass(),
            sourceId: (string) $schedule->getKey(),
            transactionDate: $transactionDate,
            branchId: null,
            amounts: ['depreciation_amount' => (float) $schedule->depreciation_amount],
            masterAccounts: $this->masters($accounts, ['depreciation_expense', 'accumulated_depreciation']),
        );
    }

    public function scrap(Asset $asset, AssetCategoryAccount $accounts, float $writeOffAmount, CarbonInterface $transactionDate): PostingContext {
        return new PostingContext(
            documentType: PostingDocumentType::AssetScrap,
            sourceType: $asset->getMorphClass(),
            sourceId: (string) $asset->getKey(),
            transactionDate: $transactionDate,
            branchId: null,
            amounts: ['write_off_amount' => $writeOffAmount],
            flags: ['is_depreciable' => true], // event scrap hanya dipicu untuk aset yang dapat disusutkan
            masterAccounts: $this->masters($accounts, ['accumulated_depreciation', 'fixed_asset']),
        );
    }

    public function valueAdjustment(AssetValueAdjustment $adjustment, AssetCategoryAccount $accounts, CarbonInterface $transactionDate): PostingContext {
        return new PostingContext(
            documentType: PostingDocumentType::AssetValueAdjustment,
            sourceType: $adjustment->getMorphClass(),
            sourceId: (string) $adjustment->getKey(),
            transactionDate: $transactionDate,
            branchId: null,
            amounts: ['difference_amount' => (float) $adjustment->difference_amount],
            masterAccounts: $this->masters($accounts, ['fixed_asset']),
        );
    }

    /**
     * Disposal: sumber jurnal adalah aset (kunci `disposal:{sales_invoice_item_id}`), tetapi status pembatalan ada di
     * Sales Invoice sumber baris penjualan sehingga ia menjadi dokumen penjaga guard cancel (Q-P2-13).
     */
    public function disposal(SalesInvoiceItem $line, Asset $asset, AssetCategoryAccount $accounts, float $gainLoss, CarbonInterface $transactionDate): PostingContext {
        return new PostingContext(
            documentType: PostingDocumentType::AssetDisposal,
            sourceType: $asset->getMorphClass(),
            sourceId: (string) $asset->getKey(),
            transactionDate: $transactionDate,
            branchId: null,
            amounts: ['gain_loss' => $gainLoss],
            flags: ['sales_invoice_item_id' => (string) $line->getKey()],
            masterAccounts: $this->masters($accounts, ['gain_loss_disposal', 'fixed_asset']),
            guardDocument: ['type' => (new SalesInvoice)->getMorphClass(), 'id' => (string) $line->sales_invoice_id],
        );
    }

    /**
     * @param  list<string>  $roles
     * @return array<string, string>
     */
    private function masters(AssetCategoryAccount $accounts, array $roles): array {
        $masters = [];
        foreach ($roles as $role) {
            $accountId = $accounts->getAttribute(self::MASTER_COLUMNS[$role]);
            if ($accountId !== null && $accountId !== '') {
                $masters[$role] = (string) $accountId;
            }
        }

        return $masters;
    }
}
