<?php

namespace App\Models\Asset;

use App\Models\Inventory\ItemUnit;
use App\Models\Inventory\ItemVariant;
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
        /**
         * Requirement 7.1/7.2, spec asset-service-billing: perlu resolve
         * customer billing dari AssetService induk saat baris part dipilih
         * di SalesOrder/InternalOrder — relasi ini harus terdaftar (walau
         * hidden) supaya bisa diminta lewat prop `with` LinkModel.
         */
        'assetService' => [
            'type'   => 'relation',
            'hidden' => true,
        ],
    ];

    /**
     * Bug pre-existing: model ini tidak punya templateLink() sama sekali,
     * padahal dipakai lewat AssetServiceConsumedItemLinkModel — search
     * dropdown-nya 500 error (ModelController::__invoke() panggil
     * templateLink() tanpa guard) sebelum fix ini.
     */
    public static function templateLink() {
        return ':item - :quantity';
    }

    protected static function booted(): void {
        static::saving(function (self $item) {
            $item->total_value = (float) $item->quantity * (float) $item->valuation_rate;
        });
    }

    public function assetService(): BelongsTo {
        return $this->belongsTo(AssetService::class);
    }

    /**
     * Requirement 4.5, spec asset-service-billing: menunjuk ItemVariant
     * (selaras SalesOrderItem/InternalOrderItem.item_id), bukan Item langsung
     * — supaya baris part bisa 1:1 auto-derive ItemVariant tanpa ambiguitas.
     */
    public function item(): BelongsTo {
        return $this->belongsTo(ItemVariant::class);
    }

    public function itemUnit(): BelongsTo {
        return $this->belongsTo(ItemUnit::class);
    }
}
