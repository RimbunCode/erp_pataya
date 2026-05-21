<?php

namespace App\Traits;

use Illuminate\Database\Eloquent\Builder;

/**
 * Trait HasExampleData
 *
 * Provides functionality for managing example data in models.
 * Example data is used for template preview and testing purposes.
 *
 * @method static Builder exampleData()
 */
trait HasExampleData {
    /**
     * Scope to get only example data
     */
    public function scopeExampleData(Builder $query): Builder {
        return $query->where('is_example', true);
    }

    /**
     * Check if this is example data
     */
    public function isExampleData(): bool {
        return $this->is_example === true;
    }

    /**
     * Mark as example data
     */
    public function markAsExample(): bool {
        return $this->update(['is_example' => true]);
    }
}
