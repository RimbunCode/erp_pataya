<?php

namespace App\Models\Inventory;

use App\Models\Model;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;

class DeliveryNoteItem extends Model {
    use HasFactory, HasUlids, SoftDeletes;

    public static $parentRelation  = 'deliveryNote';
    protected $guarded             = ['id'];
    public string $translateKey    = 'finances.deliveryNoteItem';
    protected array $configColumns = [
        'item' => [
            'type'  => 'relation',
            'show'  => true,
            'order' => 0,
        ],
        'quantity' => [
            'type'  => 'numeric',
            'show'  => true,
            'order' => 1,
        ],
        'sourceWarehouse' => [
            'type'  => 'relation',
            'show'  => true,
            'order' => 2,
        ],
        'description' => [
            'show'  => true,
            'order' => 3,
        ],
        'unit' => [
            'type'  => 'relation',
            'show'  => false,
            'order' => 4,
        ],
        'referenceable' => [
            'show'  => false,
            'order' => 5,
        ],
        'valuation_rates' => [
            'ignore' => true,
        ],
        'deliveryNote' => [
            'ignore' => true,
        ],
        'delivery_note_id' => [
            'ignore' => true,
        ],
        'returnAgainstItem' => [
            'ignore' => true,
        ],
        'return_against_item_id' => [
            'ignore' => true,
        ],
    ];

    public static function templateLink() {
        return ':item';
    }

    protected $casts = [
        'quantity'            => 'float',
        'returned_quantity'   => 'float',
        'unreturned_quantity' => 'float',
        'conversion_factor'   => 'float',
        'valuation_rates'     => 'array',
    ];

    public function referenceable() {
        return $this->morphTo('referenceable', 'referenceable_type', 'referenceable_id');
    }

    public function sourceWarehouse() {
        return $this->belongsTo(Warehouse::class, 'source_warehouse_id');
    }

    public function item() {
        return $this->belongsTo(ItemVariant::class, 'item_id');
    }

    public function deliveryNote() {
        return $this->belongsTo(DeliveryNote::class);
    }

    public function unit() {
        return $this->belongsTo(ItemUnit::class, 'item_unit_id', 'id');
    }

    public function returnAgainstItem() {
        return $this->belongsTo(DeliveryNoteItem::class, 'return_against_item_id');
    }

    public function assetLines() {
        return $this->hasMany(DeliveryNoteItemAsset::class);
    }
}
