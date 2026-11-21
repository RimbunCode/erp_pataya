<?php

namespace App\Console\Commands\Asset;

use App\Enums\FormStatus;
use App\Events\Asset\AssetDepreciationDue;
use App\Models\Asset\AssetDepreciationSchedule;
use App\Models\Core\GlPostingStatus;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Throwable;

class PostAssetDepreciationCommand extends Command {
    protected $signature   = 'assets:post-depreciation';
    protected $description = 'Posting baris AssetDepreciationSchedule yang jatuh tempo dan belum diproses ke GeneralLedger via queued Job';

    public function handle(): int {
        $count  = 0;
        $failed = 0;

        AssetDepreciationSchedule::where('schedule_date', '<=', now())
            ->whereDoesntHave('glPostingStatus')
            ->with('asset.assetCategory.accounts')
            ->orderBy('asset_id')->orderBy('schedule_date')
            ->chunkById(100, function ($schedules) use (&$count, &$failed) {
                foreach ($schedules as $schedule) {
                    try {
                        DB::transaction(function () use ($schedule) {
                            GlPostingStatus::create([
                                'referenceable_type' => AssetDepreciationSchedule::class,
                                'referenceable_id'   => $schedule->id,
                                'status'             => 'pending',
                            ]);
                            event(new AssetDepreciationDue($schedule, now()));
                        });
                    } catch (Throwable $e) {
                        // Eksekusi inline (D-1 opsi C): kegagalan satu baris menggulung transaksinya, lalu dicatat sebagai
                        // `failed` (sama dengan `failed()` listener berantrean) agar baris lain tetap diproses.
                        report($e);
                        GlPostingStatus::create([
                            'referenceable_type' => AssetDepreciationSchedule::class,
                            'referenceable_id'   => $schedule->id,
                            'status'             => FormStatus::FAILED->value,
                            'retry_count'        => 1,
                            'last_error'         => $e->getMessage(),
                        ]);
                        $failed++;

                        continue;
                    }
                    $count++;
                }
            });

        $this->info("assets:post-depreciation: {$count} baris jadwal diproses" . ($failed > 0 ? ", {$failed} gagal (lihat Status Posting GL)." : '.'));

        return self::SUCCESS;
    }
}
