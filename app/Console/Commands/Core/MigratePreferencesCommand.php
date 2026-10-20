<?php

namespace App\Console\Commands\Core;

use App\Services\Core\Setting\PreferenceMigrator;
use Illuminate\Console\Command;

class MigratePreferencesCommand extends Command {
    protected $signature = 'settings:migrate-preferences
                            {--dry-run : Run migration without writing to database}
                            {--force : Overwrite modified settings in the target tables}
                            {--report : Display detailed migration decisions}';
    protected $description = 'Migrate legacy preferences to typed module settings tables';

    public function handle(PreferenceMigrator $migrator): int {
        $dryRun = (bool) $this->option('dry-run');
        $force  = (bool) $this->option('force');
        $report = (bool) $this->option('report');

        $this->info('Starting preferences migration' . ($dryRun ? ' (dry-run)...' : '...'));

        $results = $migrator->run($dryRun, $force);

        $this->line('Migrated: ' . count($results['migrated']));
        $this->line('Skipped (existing): ' . count($results['skipped_existing']));
        $this->line('Invalid: ' . count($results['invalid']));
        $this->line('Unknown keys: ' . count($results['unknown_keys']));

        if ($report) {
            $this->newLine();
            $this->table(['Category', 'Keys'], [
                ['Migrated', implode(', ', $results['migrated'])],
                ['Skipped Existing', implode(', ', $results['skipped_existing'])],
                ['Invalid', json_encode($results['invalid'])],
                ['Unknown Keys', implode(', ', $results['unknown_keys'])],
            ]);
        }

        return self::SUCCESS;
    }
}
