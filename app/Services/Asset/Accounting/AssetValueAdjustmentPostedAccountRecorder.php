<?php

namespace App\Services\Asset\Accounting;

use App\Enums\AccountRole;
use App\Enums\PostingDocumentType;
use App\Services\Finances\Posting\Contexts\PostingContext;
use App\Services\Finances\Posting\PostedAccountNotes;
use App\Services\Finances\Posting\PostedAccountRecorder;
use Illuminate\Support\Facades\DB;

/**
 * Menulis balik akun yang dipakai engine ke Asset Value Adjustment (Requirement 13.2, Task 12.1):
 * `difference_account_id` <- akun peran `asset_revaluation`. Tulis senyap lewat query builder (tanpa event model dan
 * audit log), dibatasi ke dokumen ini.
 */
final class AssetValueAdjustmentPostedAccountRecorder implements PostedAccountRecorder {
    public function documentType(): PostingDocumentType {
        return PostingDocumentType::AssetValueAdjustment;
    }

    public function record(PostingContext $ctx, PostedAccountNotes $notes): void {
        $accountId = $notes->accountFor(AccountRole::AssetRevaluation->value);
        if ($accountId === null) {
            return;
        }

        DB::table('asset_value_adjustments')->where('id', $ctx->sourceId)->update(['difference_account_id' => $accountId]);
    }
}
