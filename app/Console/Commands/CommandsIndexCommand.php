<?php

namespace App\Console\Commands;

use App\Services\Core\CommandSearchIndexService;
use Illuminate\Console\Command;

class CommandsIndexCommand extends Command {
    protected $signature = 'commands:index
                            {--rebuild : Rebuild full navigation & record search index}';
    protected $description = 'Build command search index for navigation and document records.';

    public function __construct(private readonly CommandSearchIndexService $commandSearchIndexService) {
        parent::__construct();
    }

    public function handle(): int {
        $result = $this->commandSearchIndexService->rebuild(prune: (bool) $this->option('rebuild'));

        $this->info($this->option('rebuild') ? 'Mode: FULL REBUILD' : 'Mode: INCREMENTAL REBUILD');
        $this->table(['Type', 'Count'], [
            ['Navigation', $result['navigation']],
            ['Records', $result['records']],
            ['Total', $result['total']],
        ]);

        return self::SUCCESS;
    }
}
