<?php

namespace App\Jobs\Core;

use App\Services\Core\HaveTransactionsSyncService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class ReplayHaveTransactionsSyncJob implements ShouldQueue {
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * @param  array<int, array{table: string, column: string, value: mixed}>  $references
     * @param  string[]|null  $trackedTables
     */
    public function __construct(
        public array $references,
        public ?array $trackedTables = null,
    ) {
        //
    }

    /**
     * Execute the job.
     */
    public function handle(HaveTransactionsSyncService $syncService): void {
        $syncService->replayReferences($this->references, $this->trackedTables);
    }
}
