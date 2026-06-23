<?php

namespace App\Console\Commands;

use App\Services\Core\DataTableConfigCache;
use App\Services\Core\DataTableConfigValidator;
use App\Traits\LinkModel;
use Illuminate\Console\Command;
use Illuminate\Database\Eloquent\Model as EloquentModel;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;
use Throwable;

class ModelCacheCommand extends Command {
    protected $signature = 'model:cache
        {--clear : Kosongkan cache}
        {--model= : Batasi ke satu model class}
        {--no-warm : Jangan warm ulang setelah clear}
        {--no-validate : Lewati validasi strict}
        {--strict : Exit non-zero bila ada pelanggaran}';
    protected $description = 'Cache model config and validate';

    public function handle() {
        $modelsToProcess = [];
        $targetModel     = $this->option('model');

        if ($targetModel) {
            try {
                $resolvedModel = $this->resolveModelClass($targetModel);
                if ($resolvedModel && in_array(LinkModel::class, class_uses_recursive($resolvedModel), true)) {
                    $modelsToProcess[] = $resolvedModel;
                } else {
                    $this->error("Model '{$targetModel}' not found or does not use LinkModel trait.");

                    return 1;
                }
            } catch (Throwable $e) {
                $this->error("Error resolving model '{$targetModel}': " . $e->getMessage());

                return 1;
            }
        } else {
            $modelsToProcess = DataTableConfigCache::discoverLinkModels();
        }

        if (empty($modelsToProcess)) {
            $this->warn('No LinkModel models found to process.');

            return 0;
        }

        $shouldClear = $this->option('clear');
        $noWarm      = $this->option('no-warm');
        $noValidate  = $this->option('no-validate');
        $isStrict    = $this->option('strict');

        $exitCode      = 0;
        $allViolations = [];

        foreach ($modelsToProcess as $modelClass) {
            $modelProgressBar = $this->getOutput()->createProgressBar(1);
            $modelProgressBar->start();

            if ($shouldClear) {
                DataTableConfigCache::forget($modelClass);
                $this->line("Cleared cache for {$modelClass}");
            }

            if (! $noWarm) {
                try {
                    if (! $noValidate) {
                        $modelProgressBar->setMessage(" Validating {$modelClass}...");
                        $violations = DataTableConfigValidator::validate($modelClass);
                        if (! empty($violations)) {
                            $allViolations[$modelClass] = $violations;
                            if ($isStrict) {
                                $exitCode = 1;
                            }
                        }
                    }

                    $modelProgressBar->setMessage(" Warming cache for {$modelClass}...");
                    DataTableConfigCache::warm($modelClass);
                    $this->line("Warmed cache for {$modelClass}");

                } catch (Throwable $e) {
                    $this->error("Error processing {$modelClass}: " . $e->getMessage());
                    $exitCode = 1;
                }
            }
            $modelProgressBar->finish();
        }

        if (! empty($allViolations)) {
            $this->warn('\nFound configuration violations:');
            foreach ($allViolations as $model => $vils) {
                $this->warn("  Model: {$model}");
                foreach ($vils as $vil) {
                    $col = $vil['column'] ?? 'N/A';
                    $this->warn("    - Rule {$vil['rule']} (Column: {$col}): {$vil['message']}");
                }
            }
        }

        if ($exitCode === 1 && $isStrict) {
            $this->error('\nConfiguration validation failed with --strict flag.');
        } elseif ($exitCode === 1) {
            $this->warn('\nConfiguration validation found issues, but --no-strict flag was used.');
        }

        return $exitCode;
    }

    protected function resolveModelClass(string $targetModel): ?string {
        if (class_exists($targetModel) && is_subclass_of($targetModel, EloquentModel::class)) {
            return $targetModel;
        }

        $namespace  = 'App\\Models\\';
        $modelClass = $namespace . $targetModel;
        if (class_exists($modelClass) && is_subclass_of($modelClass, EloquentModel::class)) {
            return $modelClass;
        }

        // Try to find model in subdirectories
        $modelPath = app_path('Models');
        foreach (File::allFiles($modelPath) as $file) {
            $relative = str_replace([$modelPath . DIRECTORY_SEPARATOR, '.php'], '', $file->getPathname());
            $class    = 'App\\Models\\' . str_replace(DIRECTORY_SEPARATOR, '\\', $relative);
            if (Str::endsWith($class, '\\' . $targetModel) && class_exists($class) && is_subclass_of($class, EloquentModel::class)) {
                return $class;
            }
        }

        return null;
    }
}
