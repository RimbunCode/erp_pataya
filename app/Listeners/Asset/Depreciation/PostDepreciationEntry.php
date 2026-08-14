<?php

namespace App\Listeners\Asset\Depreciation;

use App\Enums\FormStatus;
use App\Events\Asset\AssetDepreciationDue;
use App\Models\Asset\AssetDepreciationSchedule;
use App\Models\Core\GlPostingStatus;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use LogicException;
use Throwable;

class PostDepreciationEntry implements ShouldQueue {
    use Dispatchable, InteractsWithQueue, SerializesModels;

    public int $tries     = 3;
    public array $backoff = [10, 30, 60];

    public function handle(AssetDepreciationDue $event): void {
        DB::transaction(function () use ($event) {
            $schedule = $event->schedule;
            $asset    = $schedule->asset;

            $branchId = $asset->branch()?->id;
            $accounts = $asset->assetCategory?->accounts()
                ->where('branch_id', $branchId)
                ->first();

            if (! $accounts) {
                throw new LogicException("AssetCategoryAccount tidak ditemukan untuk Asset {$asset->id} (branch {$branchId}).");
            }

            if ((float) $schedule->depreciation_amount > 0) {
                $expenseAccount = $accounts->depreciationExpenseAccount()->lockForUpdate()->first();
                $accumAccount   = $accounts->accumulatedDepreciationAccount()->lockForUpdate()->first();

                $expenseAccount->generalLedgerEntries()->create([
                    'against_account_id' => $accumAccount->id,
                    'debit'              => $schedule->depreciation_amount,
                    'credit'             => 0,
                    'transaction_date'   => $event->transactionDate,
                    'referenceable_type' => AssetDepreciationSchedule::class,
                    'referenceable_id'   => $schedule->id,
                ]);

                $accumAccount->generalLedgerEntries()->create([
                    'against_account_id' => $expenseAccount->id,
                    'debit'              => 0,
                    'credit'             => $schedule->depreciation_amount,
                    'transaction_date'   => $event->transactionDate,
                    'referenceable_type' => AssetDepreciationSchedule::class,
                    'referenceable_id'   => $schedule->id,
                ]);
            }

            GlPostingStatus::where('referenceable_type', AssetDepreciationSchedule::class)
                ->where('referenceable_id', $schedule->id)
                ->update([
                    'status'    => FormStatus::POSTED->value,
                    'posted_at' => now(),
                ]);
        });

        $this->maybeMarkFullyDepreciated($event->schedule->asset);
    }

    public function failed(AssetDepreciationDue $event, Throwable $e): void {
        GlPostingStatus::where('referenceable_type', AssetDepreciationSchedule::class)
            ->where('referenceable_id', $event->schedule->id)
            ->update([
                'status'      => FormStatus::FAILED->value,
                'retry_count' => DB::raw('retry_count + 1'),
                'last_error'  => $e->getMessage(),
            ]);
    }

    private function maybeMarkFullyDepreciated($asset): void {
        $allPosted = $asset->depreciationSchedules()
            ->whereDoesntHave('glPostingStatus', fn ($q) => $q->where('status', FormStatus::POSTED->value))
            ->doesntExist();

        if (! $allPosted || $asset->depreciationSchedules()->count() === 0) {
            return;
        }

        $statusValues   = array_map(fn (FormStatus $s) => $s->value, $asset->status ?? []);
        $statusValues[] = FormStatus::FULLY_DEPRECIATED->value;

        $asset->update([
            'status'               => array_map(fn (string $v) => FormStatus::from($v), array_unique($statusValues)),
            'is_fully_depreciated' => true,
        ]);
    }
}
