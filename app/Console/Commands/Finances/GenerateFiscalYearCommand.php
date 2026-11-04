<?php

namespace App\Console\Commands\Finances;

use App\Services\Finances\Ledger\FiscalPeriodService;
use Illuminate\Console\Command;
use Illuminate\Validation\ValidationException;

class GenerateFiscalYearCommand extends Command {
    protected $signature   = 'finance:generate-fiscal-year {year : Tahun kalender (mis. 2026)}';
    protected $description = 'Membuat satu tahun fiskal kalender berisi 12 periode bulanan berstatus open (idempoten)';

    public function handle(FiscalPeriodService $service): int {
        $year = (string) $this->argument('year');
        if (! ctype_digit($year) || (int) $year < 1900 || (int) $year > 2200) {
            $this->error('Tahun harus berupa angka antara 1900 dan 2200.');

            return self::FAILURE;
        }

        try {
            $fiscalYear = $service->generateYear((int) $year);
        } catch (ValidationException $e) {
            $this->error(implode(' ', collect($e->errors())->flatten()->all()));

            return self::FAILURE;
        }

        $this->info("Tahun fiskal {$fiscalYear->name}: {$fiscalYear->periods()->count()} periode.");

        return self::SUCCESS;
    }
}
