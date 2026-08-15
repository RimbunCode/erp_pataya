<?php

namespace App\Models\Asset;

use App\Models\Inventory\Item;
use App\Models\Model;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class AssetServiceConsumedItem extends Model {
    use HasFactory, HasUlids, SoftDeletes;

    public static $parentRelation = 'assetService';
    protected $guarded            = ['id'];
    protected $casts              = [
        'quantity'       => 'float',
        'valuation_rate' => 'float',
        'total_value'    => 'float',
    ];

    protected static function booted(): void {
        static::saving(function (self $item) {
            $item->total_value = (float) $item->quantity * (float) $item->valuation_rate;
        });
    }

    public function assetService(): BelongsTo {
        return $this->belongsTo(AssetService::class);
    }

    public function item(): BelongsTo {
        return $this->belongsTo(Item::class);
    }
}
