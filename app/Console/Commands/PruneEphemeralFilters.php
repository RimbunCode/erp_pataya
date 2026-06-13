<?php

namespace App\Console\Commands;

use App\Models\Core\SavedFilter;
use Illuminate\Console\Command;

class PruneEphemeralFilters extends Command {
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'saved-filters:prune {--days=7 : Umur maksimum (hari) row ephemeral}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Hapus saved filter ephemeral (is_saved=false) yang lebih tua dari TTL';

    /**
     * Execute the console command.
     */
    public function handle(): int {
        $days = (int) $this->option('days');

        $deleted = SavedFilter::query()
            ->where('is_saved', false)
            ->where('created_at', '<', now()->subDays($days))
            ->delete();

        $this->info("Menghapus {$deleted} ephemeral filter (> {$days} hari).");

        return self::SUCCESS;
    }
}
