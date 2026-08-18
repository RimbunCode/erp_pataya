<?php

namespace App\Listeners\Asset\Depreciation;

use App\Enums\FormStatus;
use App\Events\Asset\AssetScrapped;
use App\Models\Asset\Asset;
use App\Models\Core\GlPostingStatus;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use LogicException;
use Throwable;

class PostScrapWriteOff implements ShouldQueue {
    use Dispatchable, InteractsWithQueue, SerializesModels;

    public int $tries     = 3;
    public array $backoff = [10, 30, 60];

    public function handle(AssetScrapped $event): void {
        DB::transaction(function () use ($event) {
            $asset = $event->asset;

            $branchId = $asset->branch()?->id;
            $accounts = $asset->assetCategory?->accounts()
                ->where('branch_id', $branchId)
                ->first();

            if (! $accounts) {
                throw new LogicException("AssetCategoryAccount tidak ditemukan untuk Asset {$asset->id} (branch {$branchId}).");
            }

            $accumAccount = $accounts->accumulatedDepreciationAccount()->lockForUpdate()->first();
            $fixedAccount = $accounts->fixedAssetAccount()->lockForUpdate()->first();

            $accumAccount->generalLedgerEntries()->create([
                'against_account_id' => $fixedAccount->id,
                'debit'              => $event->writeOffAmount,
                'credit'             => 0,
                'transaction_date'   => $event->transactionDate,
                'referenceable_type' => Asset::class,
                'referenceable_id'   => $asset->id,
            ]);

            $journalEntry = $fixedAccount->generalLedgerEntries()->create([
                'against_account_id' => $accumAccount->id,
                'debit'              => 0,
                'credit'             => $event->writeOffAmount,
                'transaction_date'   => $event->transactionDate,
                'referenceable_type' => Asset::class,
                'referenceable_id'   => $asset->id,
            ]);

            $asset->update(['journal_entry_for_scrap_id' => $journalEntry->id]);

            GlPostingStatus::where('referenceable_type', Asset::class)
                ->where('referenceable_id', $asset->id)
                ->update([
                    'status'    => FormStatus::POSTED->value,
                    'posted_at' => now(),
                ]);
        });
    }

    public function failed(AssetScrapped $event, Throwable $e): void {
        GlPostingStatus::where('referenceable_type', Asset::class)
            ->where('referenceable_id', $event->asset->id)
            ->update([
                'status'      => FormStatus::FAILED->value,
                'retry_count' => DB::raw('retry_count + 1'),
                'last_error'  => $e->getMessage(),
            ]);
    }
}
