<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

class DevLogs extends Command {
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'dev:logs';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Stream development logs with a Windows-safe fallback when pcntl is unavailable.';

    /**
     * Execute the console command.
     */
    public function handle(): int {
        if (! function_exists('pcntl_fork')) {
            $this->warn('Skipping Pail: the pcntl extension is not available on this PHP build.');

            return self::SUCCESS;
        }

        return $this->call('pail', [
            '--timeout' => 0,
        ]);
    }
}
