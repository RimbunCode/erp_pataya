<?php

namespace App\Models\Core;

use App\Models\Model;
use App\Models\User\User;
use Database\Factories\SavedFilterFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SavedFilter extends Model {
    use HasFactory, HasUlids;

    protected $guarded = ['id'];

    protected static function newFactory(): Factory {
        return SavedFilterFactory::new();
    }

    protected function casts(): array {
        return [
            'filter'   => 'array',
            'is_saved' => 'boolean',
        ];
    }

    public function user(): BelongsTo {
        return $this->belongsTo(User::class);
    }

    /**
     * Scope ke model tertentu (FQCN).
     */
    public function scopeForModel(Builder $query, string $model): Builder {
        return $query->where('model', $model);
    }

    /**
     * Listing private: named filter milik user untuk sebuah model.
     */
    public function scopeOwnedListing(Builder $query, string $userId, string $model): Builder {
        return $query->where('is_saved', true)
            ->where('user_id', $userId)
            ->where('model', $model);
    }
}
