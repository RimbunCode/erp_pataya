<?php

namespace App\Models\Asset;

use App\Models\Core\GlPostingStatus;
use App\Models\Model;
use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphOne;
use Illuminate\Database\Eloquent\SoftDeletes;

class AssetDepreciationSchedule extends Model {
    use DataTable, HasFactory, HasUlids, SoftDeletes;

    protected $guarded = ['id'];
    protected $casts   = [
        'schedule_date'                   => 'date',
        'depreciation_amount'             => 'decimal:2',
        'accumulated_depreciation_amount' => 'decimal:2',
    ];

    public function asset(): BelongsTo {
        return $this->belongsTo(Asset::class);
    }

    public function glPostingStatus(): MorphOne {
        return $this->morphOne(GlPostingStatus::class, 'referenceable');
    }
}
