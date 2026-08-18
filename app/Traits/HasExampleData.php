<?php

namespace App\Traits;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Schema;

/**
 * Trait HasExampleData
 *
 * Provides functionality for managing example data in models.
 * Example data is used for template preview and testing purposes.
 *
 * A global scope automatically excludes example data from all queries.
 * Use `withExampleData()` or `onlyExampleData()` to include them.
 *
 * @method static Builder exampleData()
 * @method static Builder withExampleData()
 * @method static Builder onlyExampleData()
 * @method static Builder withoutExampleData()
 */
trait HasExampleData {
    /**
     * Boot the trait — register a global scope that excludes example data by default.
     */
    public static function bootHasExampleData(): void {
        static::addGlobalScope('exclude_example_data', function (Builder $builder): void {
            // ponytail: skip scope if column doesn't exist — avoids test-environment errors
            // on tables created before is_example was adopted. Add column via migration
            // when the table's module is actively worked on.
            if (! Schema::hasColumn(
                $builder->getModel()->getTable(),
                'is_example',
            )) {
                return;
            }
            $builder->where(static::resolveExampleColumn(), false);
        });
    }

    /**
     * Scope to get only example data (removes the global scope and filters to is_example = true).
     */
    public function scopeExampleData(Builder $query): Builder {
        return $query->withoutGlobalScope('exclude_example_data')
            ->where(static::resolveExampleColumn(), true);
    }

    /**
     * Alias: scope to get only example data.
     */
    public function scopeOnlyExampleData(Builder $query): Builder {
        return $this->scopeExampleData($query);
    }

    /**
     * Scope to include example data alongside normal data (removes the global scope).
     */
    public function scopeWithExampleData(Builder $query): Builder {
        return $query->withoutGlobalScope('exclude_example_data');
    }

    /**
     * Scope to explicitly exclude example data (same as default behavior, useful after withExampleData).
     */
    public function scopeWithoutExampleData(Builder $query): Builder {
        return $query->where(static::resolveExampleColumn(), false);
    }

    /**
     * Check if this is example data.
     */
    public function isExampleData(): bool {
        return (bool) ($this->attributes['is_example'] ?? false);
    }

    /**
     * Mark as example data.
     */
    public function markAsExample(): bool {
        return $this->update(['is_example' => true]);
    }

    /**
     * Resolve the fully qualified column name for is_example.
     */
    protected static function resolveExampleColumn(): string {
        return (new static)->qualifyColumn('is_example');
    }
}
