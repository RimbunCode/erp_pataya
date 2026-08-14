<?php

namespace App\Listeners\Asset\Depreciation;

use App\Enums\FormStatus;
use App\Events\Asset\AssetValueAdjustmentApproved;
use App\Models\Asset\AssetValueAdjustment;
use App\Models\Core\GlPostingStatus;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
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

            $fixedAccount->generalLedgerEntries()->create([
                'against_account_id' => $differenceAccount->id,
                'debit'              => $isIncrease ? $amount : 0,
                'credit'             => $isIncrease ? 0 : $amount,
                'transaction_date'   => $event->transactionDate,
                'referenceable_type' => AssetValueAdjustment::class,
                'referenceable_id'   => $adjustment->id,
            ]);

            $differenceAccount->generalLedgerEntries()->create([
                'against_account_id' => $fixedAccount->id,
                'debit'              => $isIncrease ? 0 : $amount,
                'credit'             => $isIncrease ? $amount : 0,
                'transaction_date'   => $event->transactionDate,
                'referenceable_type' => AssetValueAdjustment::class,
                'referenceable_id'   => $adjustment->id,
            ]);

            $asset->update([
                'gross_purchase_amount' => (float) $asset->gross_purchase_amount + (float) $adjustment->difference_amount,
            ]);

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
