<?php

namespace App\Models\Core;

use App\Models\Model;
use App\Models\User\Assignable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ChartAssignable extends Model {
    use HasUlids;

    protected $guarded = ['id'];

    public function chart(): BelongsTo {
        return $this->belongsTo(Chart::class);
    }

    public function assignable(): BelongsTo {
        return $this->belongsTo(Assignable::class, 'assignable_id');
    }
}
