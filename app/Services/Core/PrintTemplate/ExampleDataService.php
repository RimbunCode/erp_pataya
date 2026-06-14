<?php

namespace App\Services\Core\PrintTemplate;

use App\Models\Core\PrintTemplate;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;

/**
 * Service for managing example data retrieval and generation for template preview
 *
 * This service handles querying models with is_example = true and provides
 * optimized relation loading for template preview and print operations.
 */
class ExampleDataService {
    /**
     * Cache duration for example data (in seconds)
     */
    protected int $cacheDuration = 3600; // 1 hour

    /**
     * Get example data for a specific model
     *
     * Retrieves the first record marked as example data (is_example = true)
     * from the specified model class.
     *
     * @param  string  $modelClass  Fully qualified model class name
     * @return Model|null Example model instance or null if not found
     */
    public function getExampleData(string $modelClass): ?Model {
        if (! \class_exists($modelClass)) {
            return null;
        }

        $cacheKey = "example_data.{$modelClass}";

        return Cache::remember($cacheKey, $this->cacheDuration, function () use ($modelClass) {
            try {
                $model = new $modelClass;

                // Check if model has is_example column
                if (
                    ! \in_array('is_example', $model->getFillable()) &&
                    ! \in_array('is_example', \array_keys($model->getCasts()))
                ) {
                    return null;
                }

                return $model->exampleData()->first();
            } catch (\Exception $e) {
                return null;
            }
        });
    }

    /**
     * Get example data with relations loaded from used_relations array
     *
     * Retrieves example data and eager loads only the specified relations
     * for optimized performance.
     *
     * @param  string  $modelClass  Fully qualified model class name
     * @param  array  $relations  Array of relation paths to eager load
     * @return Model|null Example model instance with relations or null if not found
     */
    public function getExampleDataWithRelations(string $modelClass, array $relations): ?Model {
        if (! \class_exists($modelClass)) {
            return null;
        }

        // Validate relations exist before loading
        $validRelations = $this->validateRelations($modelClass, $relations);

        if (empty($validRelations)) {
            // No valid relations, return basic example data
            return $this->getExampleData($modelClass);
        }

        $cacheKey = "example_data.{$modelClass}." . md5(\implode(',', $validRelations));

        return Cache::remember($cacheKey, $this->cacheDuration, function () use ($modelClass, $validRelations) {
            try {
                $model = new $modelClass;

                // Check if model has is_example column
                if (
                    ! \in_array('is_example', $model->getFillable()) &&
                    ! \in_array('is_example', \array_keys($model->getCasts()))
                ) {
                    return null;
                }

                return $model->with($validRelations)
                    ->exampleData()
                    ->first();
            } catch (\Exception $e) {
                return null;
            }
        });
    }

    /**
     * Get example data for template (uses template's used_relations)
     *
     * Convenience method that extracts the used_relations from a PrintTemplate
     * and loads example data with those relations.
     *
     * @param  PrintTemplate  $template  Print template instance
     * @return Model|null Example model instance with template relations or null if not found
     */
    public function getExampleDataForTemplate(PrintTemplate $template): ?Model {
        $modelClass = $template->model;

        if (! $modelClass) {
            return null;
        }

        $relations = $template->getUsedRelations();

        return $this->getExampleDataWithRelations($modelClass, $relations);
    }

    /**
     * Check if example data exists for model
     *
     * @param  string  $modelClass  Fully qualified model class name
     * @return bool True if example data exists
     */
    public function hasExampleData(string $modelClass): bool {
        if (! \class_exists($modelClass)) {
            return false;
        }

        $cacheKey = "example_data_exists.{$modelClass}";

        return Cache::remember($cacheKey, $this->cacheDuration, function () use ($modelClass) {
            try {
                $model = new $modelClass;

                // Check if model has is_example column
                if (
                    ! \in_array('is_example', $model->getFillable()) &&
                    ! \in_array('is_example', \array_keys($model->getCasts()))
                ) {
                    return false;
                }

                return $model->exampleData()->exists();
            } catch (\Exception $e) {
                return false;
            }
        });
    }

    /**
     * Generate example data for model
     *
     * Creates example data records using the model's factory.
     * Sets is_example = true for all generated records.
     *
     * @param  string  $modelClass  Fully qualified model class name
     * @param  int  $count  Number of example records to generate
     * @return Collection Collection of generated example models
     */
    public function generateExampleData(string $modelClass, int $count = 1): Collection {
        if (! \class_exists($modelClass)) {
            return collect();
        }

        try {
            $model = new $modelClass;

            // Check if model has factory
            if (! \method_exists($model, 'factory')) {
                return collect();
            }

            // Generate example data using factory
            $examples = $modelClass::factory()
                ->count($count)
                ->create(['is_example' => true]);

            // Clear cache for this model
            $this->clearCache($modelClass);

            return $examples;
        } catch (\Exception $e) {
            return collect();
        }
    }

    /**
     * Validate relations exist before loading
     *
     * Checks if the specified relations exist on the given model class.
     * Returns only valid relations.
     *
     * @param  string  $modelClass  Fully qualified model class name
     * @param  array  $relations  Array of relation paths to validate
     * @return array Array of valid relation paths
     */
    protected function validateRelations(string $modelClass, array $relations): array {
        if (! \class_exists($modelClass)) {
            return [];
        }

        $validRelations = [];

        try {
            $modelInstance = new $modelClass;

            foreach ($relations as $relationPath) {
                if ($this->isValidRelationPath($modelInstance, $relationPath)) {
                    $validRelations[] = $relationPath;
                }
            }
        } catch (\Exception $e) {
            return [];
        }

        return $validRelations;
    }

    /**
     * Check if a relation path is valid on a model instance
     *
     * @param  Model  $model  Model instance
     * @param  string  $relationPath  Relation path (e.g., "customer.address")
     * @return bool True if relation path is valid
     */
    protected function isValidRelationPath(Model $model, string $relationPath): bool {
        $parts        = \explode('.', $relationPath);
        $currentModel = $model;

        foreach ($parts as $relation) {
            // Check if method exists on current model
            if (! \method_exists($currentModel, $relation)) {
                return false;
            }

            // Try to get the relation
            try {
                $relationInstance = $currentModel->$relation();

                // Check if it's actually a relation
                if (! $relationInstance instanceof Relation) {
                    return false;
                }

                // Get the related model for next iteration
                $currentModel = $relationInstance->getRelated();
            } catch (\Exception $e) {
                return false;
            }
        }

        return true;
    }

    /**
     * Clear cache for a specific model
     *
     * @param  string  $modelClass  Fully qualified model class name
     */
    protected function clearCache(string $modelClass): void {
        // Clear basic example data cache
        Cache::forget("example_data.{$modelClass}");
        Cache::forget("example_data_exists.{$modelClass}");

        // Clear all relation-specific caches (pattern matching)
        // Note: This is a simple implementation. For production, consider using cache tags
        $cachePrefix = "example_data.{$modelClass}.";
        // Laravel doesn't support wildcard cache deletion by default
        // This would need to be implemented with cache tags or a custom cache driver
    }
}
