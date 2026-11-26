<?php

namespace App\Services\Asset\Accounting;

use App\Enums\AccountRole;
use App\Enums\PostingDocumentType;
use App\Models\Asset\AssetValueAdjustment;
use App\Services\Finances\Posting\AccountPanel\DeclaresNoJournal;
use App\Services\Finances\Posting\AccountPanel\PanelPreviewUnavailableException;
use App\Services\Finances\Posting\AccountPanel\PanelSource;
use App\Services\Finances\Posting\AccountPanel\RecordedColumns;
use App\Services\Finances\Posting\Contexts\PostingContext;
use Illuminate\Database\Eloquent\Model;

/**
 * Sisi baca panel "Akun pencatatan" Asset Value Adjustment (Finance Fase 2, Task 12.4; Requirement 13.4). Milik domain
 * Asset (P-8), pasangan `AssetValueAdjustmentPostedAccountRecorder`: peran `asset_revaluation` ->
 * `difference_account_id`. Akun aset adalah akun master `AssetCategoryAccount` dan tidak punya kolom dokumen.
 *
 * Pratinjau memerlukan `AssetCategoryAccount` cabang aset itu (sama dengan listener approve); bila belum ada, panel
 * menampilkan state `error` yang menyebut kategorinya (konfigurasi belum lengkap harus terlihat sebelum approve).
 * Selisih nol tidak membentuk jurnal (`onApproved` tidak membuat `GlPostingStatus`): `producesNoJournal`.
 */
final class AssetValueAdjustmentPanelSource implements DeclaresNoJournal, PanelSource {
    public function __construct(private readonly AssetPostingContextFactory $factory) {}

    public function documentType(): PostingDocumentType {
        return PostingDocumentType::AssetValueAdjustment;
    }

    public function previewContext(Model $document): ?PostingContext {
        /** @var AssetValueAdjustment $document */
        $asset = $document->asset;
        if ($asset === null) {
            return null;
        }

        $accounts = $asset->assetCategory?->accounts()->where('branch_id', $asset->branch()?->id)->first();
        if ($accounts === null) {
            // Listener approve melempar LogicException pada kasus yang sama: peringatkan sekarang, bukan diam.
            throw new PanelPreviewUnavailableException(__('finances/postedAccounts.errors.asset_category_account_missing', [
                'category' => (string) ($asset->assetCategory?->category_name ?? '-'),
            ]));
        }

        return $this->factory->valueAdjustment($document, $accounts, now());
    }

    public function producesNoJournal(Model $document): bool {
        /** @var AssetValueAdjustment $document */
        return (float) $document->difference_amount === 0.0;
    }

    public function previewIsEstimate(): bool {
        return false;
    }

    public function recorded(Model $document): array {
        /** @var AssetValueAdjustment $document */
        return RecordedColumns::single(AccountRole::AssetRevaluation->value, $document->difference_account_id);
    }
}
