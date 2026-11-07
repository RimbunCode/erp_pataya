<?php

namespace App\Listeners\Asset\Depreciation;

use App\Enums\FormStatus;
use App\Events\Asset\AssetScrapped;
use App\Exceptions\Finances\DuplicatePostingException;
use App\Models\Asset\Asset;
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

            try {
                $journal = app(JournalService::class)->postPair(
                    $accumAccount->id,
                    $fixedAccount->id,
                    $event->writeOffAmount,
                    $asset,
                    Carbon::instance($event->transactionDate),
                    purpose: 'write_off',
                );

                // `assets.journal_entry_for_scrap_id` menunjuk baris kredit (akun aset tetap), seperti sebelumnya.
                // Jumlah nol tidak membuat jurnal (Requirement 2.10), sehingga tidak ada baris untuk ditunjuk.
                $creditLine = $journal?->lines->first(fn ($line) => $line->account_id === $fixedAccount->id && (float) $line->credit > 0);
                $asset->update(['journal_entry_for_scrap_id' => $creditLine?->id]);
            } catch (DuplicatePostingException) {
                // Sudah terposting (Requirement 3.3); `journal_entry_for_scrap_id` sudah terisi oleh posting pertama.
            }

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
