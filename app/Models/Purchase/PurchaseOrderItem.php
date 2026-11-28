<?php

namespace App\Models\Purchase;

use App\Enums\Permission;
use App\Models\Finances\PurchaseInvoice;
use App\Models\Finances\Tax;
use App\Models\Inventory\ItemUnit;
use App\Models\Inventory\ItemVariant;
use App\Models\Inventory\Warehouse;
use App\Models\Model;
use App\Traits\ExposesInvoiceItemTaxes;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class PurchaseOrderItem extends Model {
    use ExposesInvoiceItemTaxes, HasUlids, SoftDeletes;

    /** Izin lihat kolom harga beli: pembuat PurchaseOrder atau PurchaseInvoice. */
    private const PRICE_VISIBILITY = [
        [PurchaseOrder::class, [Permission::Write, Permission::Create]],
        [PurchaseInvoice::class, [Permission::Write, Permission::Create]],
    ];

    public static $parentRelation = 'purchaseOrder';

    /**
     * Sengaja memakai namespace lang dokumen induk (tanpa sufiks .item): model
     * baris item tidak punya berkas lang sendiri, kolomnya didefinisikan di
     * array columns milik induk. Jangan diubah balik ke .item, label kolom akan
     * tercetak sebagai kunci mentah.
     */
    public string $translateKey = 'purchase.purchaseOrder';

    protected $guarded = ['id'];
    protected $appends = ['tax_names', 'tax_rates'];
    protected $casts   = [
        'required_date'       => 'datetime',
        'quantity'            => 'float',
        'received_quantity'   => 'float',
        'unreceived_quantity' => 'float',
        'billed_quantity'     => 'float',
        'unbilled_quantity'   => 'float',
        'conversion_factor'   => 'float',
        'tax_rate'            => 'float',
        'basic_amount'        => 'float',
        'discount_amount'     => 'float',
        'tax_amount'          => 'float',
        'amount'              => 'float',
        'rate'                => 'float',
    ];

    /**
     * basic_amount adalah generated column KOTOR (quantity * rate) sejak migration
     * add_discount_amount_to_purchase_order_items_table -- net_amount (setelah
     * diskon dokumen) dipakai untuk label "Jumlah Dasar"/"Basic Amount" yang
     * historisnya merujuk nilai net, konsisten dengan PurchaseInvoiceItem::dpp_amount.
     */
    public function getNetAmountAttribute(): float {
        return $this->basic_amount - $this->discount_amount;
    }

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
        'unit' => [
            'type'     => 'relation',
            'show'     => true,
            'order'    => 2,
            'linkable' => true,
        ],
        'rate' => [
            'type'       => 'currency',
            'show'       => true,
            'order'      => 3,
            'linkable'   => true,
            'visibleFor' => self::PRICE_VISIBILITY,
        ],
        'basic_amount' => [
            'type'       => 'currency',
            'show'       => false,
            'order'      => 4,
            'linkable'   => true,
            'visibleFor' => self::PRICE_VISIBILITY,
        ],
        'net_amount' => [
            'type'       => 'currency',
            'show'       => true,
            'order'      => 4,
            'linkable'   => true,
            'visibleFor' => self::PRICE_VISIBILITY,
            'dependsOn'  => ['basic_amount', 'discount_amount'],
        ],
        'tax_names' => [
            'show'      => false,
            'dependsOn' => ['taxes'],
        ],
        'tax_rates' => [
            'show'      => false,
            'dependsOn' => ['taxes'],
        ],
        'taxes' => [
            'type' => 'relation',
            'show' => false,
        ],
        'taxLines' => [
            'ignore' => true,
        ],
        'tax' => [
            'type'     => 'relation',
            'show'     => true,
            'order'    => 5,
            'linkable' => true,
        ],
        'tax_rate' => [
            'type'     => 'numeric',
            'show'     => false,
            'order'    => 6,
            'linkable' => true,
        ],
        'tax_amount' => [
            'type'       => 'currency',
            'show'       => true,
            'order'      => 7,
            'linkable'   => true,
            'visibleFor' => self::PRICE_VISIBILITY,
        ],
        'amount' => [
            'type'       => 'currency',
            'show'       => true,
            'order'      => 8,
            'linkable'   => true,
            'visibleFor' => self::PRICE_VISIBILITY,
        ],
        'targetWarehouse' => [
            'type'     => 'relation',
            'show'     => false,
            'order'    => 9,
            'linkable' => true,
        ],
        'description' => [
            'show'     => false,
            'order'    => 10,
            'linkable' => true,
        ],
        'required_date' => [
            'type'  => 'date',
            'show'  => false,
            'order' => 11,
        ],
        'received_quantity' => [
            'type'  => 'numeric',
            'show'  => false,
            'order' => 12,
        ],
        'unreceived_quantity' => [
            'type'     => 'numeric',
            'show'     => false,
            'order'    => 13,
            'linkable' => true,
        ],
        'billed_quantity' => [
            'type'  => 'numeric',
            'show'  => false,
            'order' => 14,
        ],
        'unbilled_quantity' => [
            'type'     => 'numeric',
            'show'     => false,
            'order'    => 15,
            'linkable' => true,
        ],
        'conversion_factor' => [
            'hidden'   => true,
            'linkable' => true,
        ],
        'item_name' => [
            'ignore' => true,
        ],
        'unit_name' => [
            'ignore' => true,
        ],
        'purchaseOrder' => [
            'ignore' => true,
        ],
        'purchase_order_id' => [
            'ignore' => true,
        ],
        'referenceable' => [
            'ignore' => true,
        ],
    ];

    public static function templateLink() {
        return ':item';
    }

    public function purchaseOrder() {
        return $this->belongsTo(PurchaseOrder::class);
    }

    public function unit() {
        return $this->belongsTo(ItemUnit::class, 'item_unit_id', 'id');
    }

    public function tax() {
        return $this->belongsTo(Tax::class);
    }

    /**
     * Baris pajak item (pajak majemuk), berurut `position`; `position` 0 = Pajak Utama. Satu-satunya sumber tulis:
     * `InvoiceItemTaxCalculator` (lewat `OrderTaxApplier`).
     */
    public function taxLines(): HasMany {
        return $this->hasMany(PurchaseOrderItemTax::class)->orderBy('position');
    }

    /**
     * Semua pajak item berurut `position`, dengan kolom hitung pivot. `tax()` tetap menunjuk Pajak Utama.
     */
    public function taxes(): BelongsToMany {
        return $this->belongsToMany(Tax::class, 'purchase_order_item_taxes', 'purchase_order_item_id', 'tax_id')
            ->withPivot(['tax_rule_version_id', 'position', 'tax_rate', 'dpp_factor', 'base_amount', 'dpp_amount', 'tax_amount', 'withholding_amount'])
            ->withTrashed()
            ->orderByPivot('position');
    }

    public function targetWarehouse() {
        return $this->belongsTo(Warehouse::class, 'target_warehouse_id');
    }

    public function item() {
        return $this->belongsTo(ItemVariant::class, 'item_id');
    }

    public function referenceable() {
        return $this->morphTo();
    }

    public function parentItem() {
        return $this->belongsTo(PurchaseOrderItem::class, 'parent_item_id');
    }

    public function childItems() {
        return $this->hasMany(PurchaseOrderItem::class, 'parent_item_id');
    }
}
