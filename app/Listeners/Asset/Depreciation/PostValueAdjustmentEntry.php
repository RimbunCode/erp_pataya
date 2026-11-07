<?php

namespace App\Listeners\Asset\Depreciation;

use App\Enums\FormStatus;
use App\Events\Asset\AssetValueAdjustmentApproved;
use App\Exceptions\Finances\DuplicatePostingException;
use App\Models\Asset\AssetValueAdjustment;
use App\Models\Core\GlPostingStatus;
use App\Services\Finances\Ledger\JournalService;
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

            $fixedAccount      = $accounts->fixedAssetAccount()->lockForUpdate()->first();
            $differenceAccount = $adjustment->differenceAccount()->lockForUpdate()->first();
            $amount            = abs((float) $adjustment->difference_amount);
            $isIncrease        = (float) $adjustment->difference_amount > 0;

            try {
                app(JournalService::class)->postPair(
                    $fixedAccount->id,
                    $differenceAccount->id,
                    $amount,
                    $adjustment,
                    Carbon::instance($event->transactionDate),
                    purpose: 'value_adjustment',
                    reverseSides: ! $isIncrease,
                );

                $asset->update([
                    'gross_purchase_amount' => (float) $asset->gross_purchase_amount + (float) $adjustment->difference_amount,
                ]);
            } catch (DuplicatePostingException) {
                // Sudah terposting (Requirement 3.3): jangan menerapkan ulang `gross_purchase_amount`.
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
