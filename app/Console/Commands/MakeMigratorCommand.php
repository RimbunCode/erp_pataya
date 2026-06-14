<?php

namespace App\Console\Commands;

use Illuminate\Console\GeneratorCommand;

class MakeMigratorCommand extends GeneratorCommand {
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'make:migrator {name}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Create a new feature migrator class';

    /**
     * The type of class being generated.
     *
     * @var string
     */
    protected $type = 'Migrator';

    /**
     * Get the stub file for the generator.
     */
    protected function getStub(): string {
        return base_path('stubs/migrator.stub');
    }

    /**
     * Get the default namespace for the class.
     */
    protected function getDefaultNamespace($rootNamespace): string {
        return $rootNamespace . '\Services\Migration\Migrators';
    }
}
