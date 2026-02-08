<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Str;

class Feature extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'make:feature
                            {name : Nama feature/class dasar, mis. Item}
                            {--M|module= : Nama module (WAJIB), mis. Inventory}
                            {--S|service : Generate service class}
                            {--F|force : Overwrite existing files}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Generate controller, model(+migration), request, dan optional service dalam sebuah module';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $name = Str::studly($this->argument('name'));
        $module = $this->option('module');

        if (! $module) {
            $this->error('--module atau -M wajib diisi. Contoh: php artisan make:feature Item --module=Inventory');

            return self::FAILURE;
        }

        $module = Str::studly($module);

        // 1) Model + migration: App\Models\{Module}\{Name}
        $modelName = "{$module}/{$name}";
        Artisan::call('make:model', [
            'name' => $modelName,
            '-m' => true, // buat migration
            '--force' => $this->option('force'),
        ]);
        $this->info(Artisan::output());

        // 2) Controller: App\Http\Controllers\{Module}\{Name}Controller (resource)
        $controllerName = "{$module}/{$name}Controller";
        Artisan::call('make:controller', [
            'name' => $controllerName,
            '--resource' => true,
            '--force' => $this->option('force'),
            '--model' => "App/Models/$modelName",
        ]);
        $this->info(Artisan::output());

        // 3) Form Request: App\Http\Requests\{Module}\{Name}Request
        $requestName = "{$module}/{$name}Request";
        Artisan::call('make:request', [
            'name' => $requestName,
            '--force' => $this->option('force'),
        ]);
        $this->info(Artisan::output());

        // 4) Optional Service: App\Services\{Module}\{Name}Service
        if ($this->option('service')) {
            $serviceName = "Services/{$module}/{$name}Service";
            Artisan::call('make:class', [
                'name' => $serviceName,
                '--force' => $this->option('force'),
            ]);
            $this->info(Artisan::output());
        }

        $this->info('✅ Selesai. Files utama sudah dibuat.');

        return self::SUCCESS;
    }
}
