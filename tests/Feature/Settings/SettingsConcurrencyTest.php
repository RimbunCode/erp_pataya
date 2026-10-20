<?php

namespace Tests\Feature\Settings;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Symfony\Component\Process\Process;
use Tests\TestCase;

class SettingsConcurrencyTest extends TestCase {
    public function test_parallel_first_reads_create_only_one_singleton(): void {
        $result = $this->runWorkers('singleton');

        $this->assertCount(1, array_unique($result['outputs']));
        $this->assertSame(1, $result['core_count']);
    }

    public function test_parallel_serial_allocations_are_unique_and_persist_the_last_number(): void {
        $result  = $this->runWorkers('serial');
        $serials = array_merge(...$result['outputs']);
        sort($serials);

        $expected = array_map(fn (int $number): string => sprintf('010.%013d', $number), range(1, 20));
        $this->assertSame($expected, $serials);
        $this->assertSame(20, (int) $result['last_used']);
    }

    /** @return array{outputs: array, core_count: int, last_used: int|string} */
    private function runWorkers(string $mode): array {
        $database = tempnam(sys_get_temp_dir(), 'erp-settings-');
        $this->assertNotFalse($database);
        $gate       = $database . '.start';
        $readyFiles = [$database . '.ready0', $database . '.ready1'];
        $processes  = [];
        config(['database.connections.settings_concurrency' => [
            'driver'                  => 'sqlite',
            'database'                => $database,
            'foreign_key_constraints' => false,
            'busy_timeout'            => 10000,
            'transaction_mode'        => 'IMMEDIATE',
        ]]);

        try {
            $schema = Schema::connection('settings_concurrency');
            $schema->create('core_settings', function (Blueprint $table): void {
                $table->ulid('id')->primary();
                $table->boolean('singleton')->default(true)->unique();
                $table->string('timezone');
                $table->string('default_number_format');
                $table->unsignedInteger('num_per_page');
                $table->json('per_page_options');
                $table->timestamps();
            });
            $schema->create('finance_settings', function (Blueprint $table): void {
                $table->ulid('id')->primary();
                $table->boolean('singleton')->default(true)->unique();
                $table->unsignedBigInteger('tax_invoice_serial_range_start')->default(0);
                $table->unsignedBigInteger('tax_invoice_serial_range_end')->default(0);
                $table->unsignedBigInteger('tax_invoice_serial_last_used')->default(0);
                $table->timestamps();
            });
            DB::connection('settings_concurrency')->table('finance_settings')->insert([
                'id'                             => (string) Str::ulid(),
                'tax_invoice_serial_range_start' => 1,
                'tax_invoice_serial_range_end'   => 20,
                'created_at'                     => now(),
                'updated_at'                     => now(),
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
            if ($argv[5] === 'singleton') {
                echo json_encode(App\Models\Core\CoreSetting::current()->id);
            } else {
                $allocator = $app->make(App\Services\Finances\TaxInvoiceSerialAllocator::class);
                $numbers = [];
                for ($index = 0; $index < 10; $index++) {
                    $numbers[] = $allocator->nextSerial('01');
                }
                echo json_encode($numbers);
            }
            PHP;

            foreach ($readyFiles as $readyFile) {
                $process = new Process([PHP_BINARY, '-r', $worker, base_path(), $database, $gate, $readyFile, $mode], base_path(), [
                    'APP_ENV'        => 'testing',
                    'DB_CONNECTION'  => 'sqlite',
                    'DB_DATABASE'    => $database,
                    'SESSION_DRIVER' => 'array',
                    'CACHE_STORE'    => 'array',
                ]);
                $process->setTimeout(30);
                $process->start();
                $processes[] = $process;
            }

            $deadline = microtime(true) + 15;
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

            $outputs = [];
            foreach ($processes as $process) {
                $process->wait();
                $this->assertTrue($process->isSuccessful(), $process->getErrorOutput() . $process->getOutput());
                $outputs[] = json_decode($process->getOutput(), true, flags: JSON_THROW_ON_ERROR);
            }

            return [
                'outputs'    => $outputs,
                'core_count' => DB::connection('settings_concurrency')->table('core_settings')->count(),
                'last_used'  => DB::connection('settings_concurrency')->table('finance_settings')->value('tax_invoice_serial_last_used'),
            ];
        } finally {
            foreach ($processes as $process) {
                if ($process->isRunning()) {
                    $process->stop();
                }
            }
            DB::purge('settings_concurrency');
            foreach ([$database, $database . '-journal', $database . '-wal', $database . '-shm', $gate, ...$readyFiles] as $path) {
                if (is_file($path)) {
                    unlink($path);
                }
            }
        }
    }
}
