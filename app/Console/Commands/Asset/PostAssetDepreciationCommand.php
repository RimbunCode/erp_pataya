<?php

namespace App\Console\Commands\Asset;

use App\Events\Asset\AssetDepreciationDue;
use App\Models\Asset\AssetDepreciationSchedule;
use App\Models\Core\GlPostingStatus;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class PostAssetDepreciationCommand extends Command {
    protected $signature   = 'assets:post-depreciation';
    protected $description = 'Posting baris AssetDepreciationSchedule yang jatuh tempo dan belum diproses ke GeneralLedger via queued Job';

    public function handle(): int {
        $count = 0;

        AssetDepreciationSchedule::where('schedule_date', '<=', now())
            ->whereDoesntHave('glPostingStatus')
            ->with('asset.assetCategory.accounts')
            ->orderBy('asset_id')->orderBy('schedule_date')
            ->chunkById(100, function ($schedules) use (&$count) {
                foreach ($schedules as $schedule) {
                    DB::transaction(function () use ($schedule) {
                        GlPostingStatus::create([
                            'referenceable_type' => AssetDepreciationSchedule::class,
                            'referenceable_id'   => $schedule->id,
                            'status'             => 'pending',
                        ]);
                        event(new AssetDepreciationDue($schedule, now()));
                    });
                    $count++;
                }
            });

        $this->info("assets:post-depreciation: {$count} baris jadwal diproses.");

        return self::SUCCESS;
    }
}
