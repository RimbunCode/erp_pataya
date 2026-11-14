<?php

namespace App\Listeners\Asset\Depreciation;

use App\Enums\FormStatus;
use App\Events\Asset\AssetDepreciationDue;
use App\Exceptions\Finances\DuplicatePostingException;
use App\Models\Asset\AssetDepreciationSchedule;
use App\Models\Core\GlPostingStatus;
use App\Services\Asset\Accounting\AssetPostingContextFactory;
use App\Services\Finances\Ledger\JournalService;
use App\Services\Finances\Posting\PostingGateway;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
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
                // Requirement 3.4, spec asset-management-depreciation: baris ini gagal
                // posting (FAILED, butuh retry manual via GlPostingStatusController) —
                // log warning supaya operator tahu ROOT CAUSE-nya dari log tanpa perlu
                // buka detail error tiap baris FAILED satu-satu.
                Log::warning("AssetCategoryAccount tidak ditemukan untuk Asset {$asset->id} (branch {$branchId}) — depreciation schedule {$schedule->id} gagal posting.");

                throw new LogicException("AssetCategoryAccount tidak ditemukan untuk Asset {$asset->id} (branch {$branchId}).");
            }

            // Gateway Posting Engine (Finance Fase 2, Task 7.1): closure = jalur Fase 1 apa adanya (mode `off`/`shadow`).
            $outcome = app(PostingGateway::class)->post(
                app(AssetPostingContextFactory::class)->depreciation($schedule, $accounts, Carbon::instance($event->transactionDate)),
                function () use ($event, $schedule, $accounts) {
                    if ((float) $schedule->depreciation_amount > 0) {
                        $expenseAccount = $accounts->depreciationExpenseAccount()->lockForUpdate()->first();
                        $accumAccount   = $accounts->accumulatedDepreciationAccount()->lockForUpdate()->first();

                        try {
                            app(JournalService::class)->postPair(
                                $expenseAccount->id,
                                $accumAccount->id,
                                $schedule->depreciation_amount,
                                $schedule,
                                Carbon::instance($event->transactionDate),
                                purpose: 'depreciation',
                            );
                        } catch (DuplicatePostingException) {
                            // Sudah terposting (Requirement 3.3).
                        }
                    }
                },
            );

            // Q-P2-12: jangan menimpa `skipped` (dokumen dibatalkan sebelum job berjalan) menjadi `posted`.
            if ($outcome->isSkipped()) {
                return;
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
