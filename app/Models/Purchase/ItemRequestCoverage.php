<?php

namespace App\Models\Purchase;

use App\Models\Model;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class ItemRequestCoverage extends Model {
    use HasFactory, HasUlids, SoftDeletes;

    protected $guarded = ['id'];
    protected $casts   = [
        'quantity_covered' => 'float',
    ];

    public function source(): MorphTo {
        return $this->morphTo();
    }

    public function covering(): MorphTo {
        return $this->morphTo();
    }
}
