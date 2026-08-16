<?php

namespace App\Models\Inventory;

use App\Models\Asset\Asset;
use App\Models\Model;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class DeliveryNoteItemAsset extends Model {
    use HasFactory, HasUlids, SoftDeletes;

    public static $parentRelation = 'deliveryNoteItem';
    protected $guarded            = ['id'];
    protected $casts              = [
        'quantity'     => 'float',
        'processed_at' => 'datetime',
    ];

    public function deliveryNoteItem(): BelongsTo {
        return $this->belongsTo(DeliveryNoteItem::class);
    }

    public function asset(): BelongsTo {
        return $this->belongsTo(Asset::class);
    }
}
