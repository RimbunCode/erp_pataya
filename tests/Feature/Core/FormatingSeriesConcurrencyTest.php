<?php

namespace Tests\Feature\Core;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Symfony\Component\Process\Process;
use Tests\TestCase;

/**
 * Regresi race condition FormatingSeries::generate(): counter dibaca-diubah-
 * ditulis tanpa kunci baris menghasilkan kode ganda saat dua proses
 * membangkitkan nomor bersamaan. generate() wajib serial lewat
 * lockForUpdate (MySQL) di dalam transaksi (SQLite worker memakai mode
 * IMMEDIATE seperti SettingsConcurrencyTest).
 */
class FormatingSeriesConcurrencyTest extends TestCase {
    public function test_parallel_generates_produce_unique_sequential_codes(): void {
        $database = tempnam(sys_get_temp_dir(), 'erp-formating-');
        $this->assertNotFalse($database);
        $gate       = $database . '.start';
        $readyFiles = [$database . '.ready0', $database . '.ready1'];
        $processes  = [];
        config(['database.connections.formating_concurrency' => [
            'driver'                  => 'sqlite',
            'database'                => $database,
            'foreign_key_constraints' => false,
            'busy_timeout'            => 10000,
            'transaction_mode'        => 'IMMEDIATE',
        ]]);

        try {
            $schema = Schema::connection('formating_concurrency');
            $schema->create('formating_series', function (Blueprint $table): void {
                $table->ulid('id')->primary();
                $table->string('name');
                $table->string('model')->unique();
                $table->json('logs')->nullable();
                $table->string('format');
                $table->timestamps();
            });
            $schema->create('core_settings', function (Blueprint $table): void {
                $table->ulid('id')->primary();
                $table->string('timezone')->default('Asia/Jakarta');
            });
            DB::connection('formating_concurrency')->table('formating_series')->insert([
                'id'     => (string) Str::ulid(),
                'name'   => 'Concurrency Probe',
                'model'  => 'App\Models\Core\Todo',
                'format' => '@[iiii]',
                // Bentuk awal seperti yang ditulis DataTable saat init model.
                'logs'       => '{"i":{}}',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            DB::connection('formating_concurrency')->table('core_settings')->insert([
                'id'       => (string) Str::ulid(),
                'timezone' => 'UTC',
            ]);

            $worker = <<<'PHP'
            require $argv[1] . '/vendor/autoload.php';
            $app = require $argv[1] . '/bootstrap/app.php';
            $app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
            config([
                'database.default' => 'sqlite',
                'database.connections.sqlite.database' => $argv[2],
                'database.connections.sqlite.foreign_key_constraints' => false,
                'database.connections.sqlite.busy_timeout' => 10000,
                'database.connections.sqlite.transaction_mode' => 'IMMEDIATE',
                'session.driver' => 'array',
                'cache.default' => 'array',
            ]);
            Illuminate\Support\Facades\DB::purge('sqlite');
            file_put_contents($argv[4], 'ready');
            $deadline = microtime(true) + 15;
            while (! file_exists($argv[3])) {
                if (microtime(true) > $deadline) {
                    throw new RuntimeException('Worker barrier timed out.');
                }
                usleep(1000);
            }
            // Event model dinonaktifkan: LinkModel::saved butuh tabel
            // permissions/command-search yang tak ada di DB worker minimal.
            // Counter tak terpengaruh event, jadi uji kunci tetap sah.
            $codes = App\Models\Core\FormatingSeries::withoutEvents(function () {
                $codes = [];
                for ($index = 0; $index < 10; $index++) {
                    $codes[] = App\Models\Core\FormatingSeries::generate('App\Models\Core\Todo', []);
                }

                return $codes;
            });
            echo json_encode($codes);
            PHP;

            foreach ($readyFiles as $readyFile) {
                $process = new Process([PHP_BINARY, '-r', $worker, base_path(), $database, $gate, $readyFile], base_path(), [
                    'APP_ENV'       => 'testing',
                    'DB_CONNECTION' => 'sqlite',
                    'DB_DATABASE'   => $database,
                ]);
                $process->setTimeout(60);
                $process->start();
                $processes[] = $process;
            }

            $deadline = microtime(true) + 20;
            while (! is_file($readyFiles[0]) || ! is_file($readyFiles[1])) {
                foreach ($processes as $process) {
                    if (! $process->isRunning()) {
                        $this->fail($process->getErrorOutput() . $process->getOutput());
                    }
                }
                $this->assertLessThan($deadline, microtime(true), 'Workers must reach the barrier.');
                usleep(10000);
            }
            touch($gate);

            $codes = [];
            foreach ($processes as $process) {
                $process->wait();
                $this->assertTrue($process->isSuccessful(), $process->getErrorOutput() . $process->getOutput());
                $codes = array_merge($codes, json_decode($process->getOutput(), true, flags: JSON_THROW_ON_ERROR));
            }

            sort($codes);
            $expected = array_map(fn (int $number): string => sprintf('%04d', $number), range(1, 20));
            $this->assertSame($expected, $codes);

            $logs = json_decode(DB::connection('formating_concurrency')->table('formating_series')->value('logs'), true);
            $this->assertSame(20, $logs['i'][0]['current']);
        } finally {
            foreach ($processes as $process) {
                if ($process->isRunning()) {
                    $process->stop();
                }
            }
            DB::purge('formating_concurrency');
            foreach ([$database, $database . '-journal', $database . '-wal', $database . '-shm', $gate, ...$readyFiles] as $path) {
                if (is_file($path)) {
                    unlink($path);
                }
            }
        }
    }
}
