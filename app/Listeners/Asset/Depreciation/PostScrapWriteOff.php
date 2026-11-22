<?php

namespace App\Listeners\Asset\Depreciation;

use App\Enums\FormStatus;
use App\Events\Asset\AssetScrapped;
use App\Models\Asset\Asset;
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

            // Gateway Posting Engine (Finance Fase 2, Task 7.1; closure legacy dihapus Task 14.1): akun master datang dari
            // `AssetCategoryAccount` lewat konteks; `UnresolvedAccountRoleException` dan sejenisnya
            // membuat job gagal ke `failed`.
            $outcome = app(PostingGateway::class)->post(
                app(AssetPostingContextFactory::class)->scrap($asset, $accounts, (float) $event->writeOffAmount, Carbon::instance($event->transactionDate)),
            );

            // Q-P2-12: jangan menimpa `skipped` menjadi `posted`.
            if ($outcome->isSkipped()) {
                return;
            }

            // `journal_entry_for_scrap_id` dari jurnal hasil (Q-P2-12c), hanya saat jurnal baru ditulis; `already_posted`
            // (retry) tidak menimpa nilai yang sudah terisi oleh posting pertama (Q-P2-12b). Jumlah nol tidak membuat
            // jurnal (Requirement 2.10), sehingga tidak ada baris untuk ditunjuk.
            if ($outcome->isPosted() && $outcome->journals !== []) {
                // Baris kredit pada akun master `fixed_asset` (sama dengan jalur lama), bukan sekadar baris kredit pertama.
                $creditLine = $outcome->journals[0]->lines->first(fn ($line) => $line->account_id === $accounts->fixed_asset_account_id && (float) $line->credit > 0);
                $asset->update(['journal_entry_for_scrap_id' => $creditLine?->id]);
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
