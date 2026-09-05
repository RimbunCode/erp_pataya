<?php

namespace App\Console\Commands;

use App\Services\Core\DashboardCacheWarmerService;
use Illuminate\Console\Command;

/**
 * Requirement H (optimasi dashboard) — lihat docblock DashboardCacheWarmerService
 * utk detail cakupan & alasan desainnya.
 */
class WarmDashboardCacheCommand extends Command {
    protected $signature   = 'dashboard:warm-cache';
    protected $description = 'Warm cache Number Card/Chart yang terpasang di Desk (redam cache-miss dashboard).';

    public function __construct(private readonly DashboardCacheWarmerService $warmer) {
        parent::__construct();
    }

    public function handle(): int {
        $result = $this->warmer->warm();

        $this->info("Number Card di-warm: {$result['number_cards']}");
        $this->info("Chart di-warm: {$result['charts']}");

        return self::SUCCESS;
    }
}
