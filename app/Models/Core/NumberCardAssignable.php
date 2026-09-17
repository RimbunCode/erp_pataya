<?php

namespace App\Models\Core;

use App\Models\Model;
use App\Models\User\Assignable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class NumberCardAssignable extends Model {
    use HasUlids;

    protected $guarded             = ['id'];
    protected array $configColumns = [
        'numberCard',
        'assignable',
    ];

    public static function templateLink() {
        return ':numberCard.label - :assignable';
    }

    public function numberCard(): BelongsTo {
        return $this->belongsTo(NumberCard::class);
    }

    public function assignable(): BelongsTo {
        return $this->belongsTo(Assignable::class, 'assignable_id');
    }
}
