<?php

namespace App\Models\Core;

use App\Casts\FormStatusCast;
use App\Enums\FormStatus;
use App\Models\Model;
use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class GlPostingStatus extends Model {
    use DataTable, HasUlids;

    protected $guarded = ['id'];
    protected $casts   = [
        'status'    => FormStatusCast::class,
        'posted_at' => 'datetime',
    ];
    public string $translateKey    = 'core.glPostingStatus';
    protected array $configColumns = [
        'referenceable_type' => [
            'show'  => true,
            'order' => 0,
        ],
        'referenceable' => [
            'show'   => true,
            'isLink' => true,
            'order'  => 1,
        ],
        'status' => [
            'show'  => true,
            'order' => 2,
        ],
        'retry_count' => [
            'show'  => true,
            'order' => 3,
        ],
        'last_error' => [
            'show'  => true,
            'order' => 4,
        ],
        'posted_at' => [
            'type'  => 'datetime',
            'show'  => true,
            'order' => 5,
        ],
        'created_at' => [
            'type'  => 'datetime',
            'show'  => true,
            'order' => 6,
        ],
    ];

    protected static function permissions(): array {
        return ['select', 'read', 'write'];
    }

    public function referenceable(): MorphTo {
        return $this->morphTo();
    }

    public function scopePending(Builder $query): Builder {
        return $query->where('status', FormStatus::PENDING);
    }

    public function scopeFailed(Builder $query): Builder {
        return $query->where('status', FormStatus::FAILED);
    }
}
