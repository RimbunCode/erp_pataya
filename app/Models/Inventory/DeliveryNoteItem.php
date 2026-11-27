<?php

namespace App\Models\Inventory;

use App\Models\Asset\Asset;
use App\Models\Finances\Account;
use App\Models\Model;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
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
        'asset' => [
            'type' => 'relation',
            'show' => false,
        ],
        'asset_id' => [
            'hidden'   => true,
            'linkable' => true,
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
        // Catatan audit akun yang dipakai engine (Task 12.1 bagian B): bukan kolom tabel data.
        'posted_account_id' => [
            'ignore' => true,
        ],
        'posted_stock_account_id' => [
            'ignore' => true,
        ],
        'postedAccount' => [
            'ignore' => true,
        ],
        'postedStockAccount' => [
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

    public function asset(): BelongsTo {
        return $this->belongsTo(Asset::class);
    }

    public function deliveryNote() {
        return $this->belongsTo(DeliveryNote::class);
    }

    public function unit() {
        return $this->belongsTo(ItemUnit::class, 'item_unit_id', 'id');
    }

    /**
     * Akun `cost_of_goods_sold` per baris yang dicatat engine posting saat approve (Task 12.1 bagian B).
     */
    public function postedAccount(): BelongsTo {
        return $this->belongsTo(Account::class, 'posted_account_id');
    }

    /**
     * Akun `stock` per baris yang dicatat engine posting saat approve (Task 12.1 bagian B).
     */
    public function postedStockAccount(): BelongsTo {
        return $this->belongsTo(Account::class, 'posted_stock_account_id');
    }

    public function returnAgainstItem() {
        return $this->belongsTo(DeliveryNoteItem::class, 'return_against_item_id');
    }
}
