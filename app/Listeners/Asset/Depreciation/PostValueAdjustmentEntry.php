<?php

namespace App\Listeners\Asset\Depreciation;

use App\Enums\FormStatus;
use App\Events\Asset\AssetValueAdjustmentApproved;
use App\Models\Asset\AssetValueAdjustment;
use App\Models\Core\GlPostingStatus;
use App\Services\Asset\Accounting\AssetPostingContextFactory;
use App\Services\Finances\Posting\PostingGateway;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use LogicException;
use Throwable;

class PostValueAdjustmentEntry implements ShouldQueue {
    use Dispatchable, InteractsWithQueue, SerializesModels;

    public int $tries     = 3;
    public array $backoff = [10, 30, 60];

    public function handle(AssetValueAdjustmentApproved $event): void {
        DB::transaction(function () use ($event) {
            $adjustment = $event->adjustment;
            $asset      = $adjustment->asset;

            $branchId = $asset->branch()?->id;
            $accounts = $asset->assetCategory?->accounts()
                ->where('branch_id', $branchId)
                ->first();

            if (! $accounts) {
                throw new LogicException("AssetCategoryAccount tidak ditemukan untuk Asset {$asset->id} (branch {$branchId}).");
            }

            // Gateway Posting Engine (Finance Fase 2, Task 7.1; closure legacy dihapus Task 14.1): akun aset dari
            // `AssetCategoryAccount` lewat konteks, akun selisih dari peran `asset_revaluation` pada profil (bukan lagi
            // kolom `difference_account_id` dokumen); `PostingModeNotOnException`/`UnresolvedAccountRoleException`
            // membuat job gagal ke `failed`.
            $outcome = app(PostingGateway::class)->post(
                app(AssetPostingContextFactory::class)->valueAdjustment($adjustment, $accounts, Carbon::instance($event->transactionDate)),
            );

            // Q-P2-12: jangan menimpa `skipped` menjadi `posted`.
            if ($outcome->isSkipped()) {
                return;
            }

            // `gross_purchase_amount` bersifat non-idempoten, diterapkan hanya saat jurnal baru ditulis; `already_posted`
            // (retry) tidak menerapkannya ulang (Q-P2-12b).
            if ($outcome->isPosted()) {
                $asset->update([
                    'gross_purchase_amount' => (float) $asset->gross_purchase_amount + (float) $adjustment->difference_amount,
                ]);
            }

            GlPostingStatus::where('referenceable_type', AssetValueAdjustment::class)
                ->where('referenceable_id', $adjustment->id)
                ->update([
                    'status'    => FormStatus::POSTED->value,
                    'posted_at' => now(),
                ]);
        });
    }

    public function failed(AssetValueAdjustmentApproved $event, Throwable $e): void {
        GlPostingStatus::where('referenceable_type', AssetValueAdjustment::class)
            ->where('referenceable_id', $event->adjustment->id)
            ->update([
                'status'      => FormStatus::FAILED->value,
                'retry_count' => DB::raw('retry_count + 1'),
                'last_error'  => $e->getMessage(),
            ]);
    }
}
