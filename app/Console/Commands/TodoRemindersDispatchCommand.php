<?php

namespace App\Console\Commands;

use App\Services\Core\TodoReminderService;
use Illuminate\Console\Command;

class TodoRemindersDispatchCommand extends Command {
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'todos:remind
        {--dry-run : Log tanpa mengirim atau mencatat}
        {--todo= : Batasi sweep ke satu ToDo (debugging)}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Kirim reminder ToDo (lead/hari-H/overdue) dan auto-close event yang sudah lewat';

    public function handle(TodoReminderService $service): int {
        $result = $service->sweep(
            dryRun: (bool) $this->option('dry-run'),
            todoId: $this->option('todo'),
        );

        $this->info(sprintf(
            'ToDo reminder: %d diperiksa, %d reminder terkirim, %d auto-closed, %d dilewati.',
            $result['scanned'],
            $result['sent'],
            $result['closed'],
            $result['skipped'],
        ));

        return self::SUCCESS;
    }
}
