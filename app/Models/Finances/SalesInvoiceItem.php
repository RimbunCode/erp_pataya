<?php

namespace App\Models\Finances;

use App\Enums\Permission;
use App\Models\Asset\Asset;
use App\Models\Inventory\ItemUnit;
use App\Models\Inventory\ItemVariant;
use App\Models\Model;
use App\Models\Sales\SalesOrder;
use App\Models\Sales\SalesOrderItem;
use App\Traits\ComputesLegacyInvoiceItemAmounts;
use App\Traits\ExposesInvoiceItemTaxes;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class SalesInvoiceItem extends Model {
    use ComputesLegacyInvoiceItemAmounts, ExposesInvoiceItemTaxes, HasFactory, HasUlids, SoftDeletes;

    /** Kolom harga satuan dan ketiadaan kolom `amount` (dipakai `ComputesLegacyInvoiceItemAmounts`). */
    public const LEGACY_PRICE_COLUMN = 'price';

    public const LEGACY_HAS_AMOUNT_COLUMN = false;

    /** Izin lihat kolom harga jual: pembuat SalesOrder atau SalesInvoice. */
    private const PRICE_VISIBILITY = [
        [SalesOrder::class, [Permission::Write, Permission::Create]],
        [SalesInvoice::class, [Permission::Write, Permission::Create]],
    ];

    public static $parentRelation = 'salesInvoice';

    /**
     * Sengaja memakai namespace lang dokumen induk (tanpa sufiks .item): model
     * baris item tidak punya berkas lang sendiri, kolomnya didefinisikan di
     * array columns milik induk. Jangan diubah balik ke .item, label kolom akan
     * tercetak sebagai kunci mentah.
     */
    public string $translateKey = 'finances.salesInvoice';

    protected $guarded = ['id'];
    protected $appends = ['tax_names', 'tax_rates'];
    protected $casts   = [
        'quantity'            => 'float',
        'returned_quantity'   => 'float',
        'unreturned_quantity' => 'float',
        'price'               => 'float',
        'price_base_currency' => 'float',
        'conversion_factor'   => 'float',
        'tax_rate'            => 'float',
        'exchange_rate'       => 'float',
        'basic_amount'        => 'float',
        'discount_amount'     => 'float',
        'dpp_amount'          => 'float',
        'tax_amount'          => 'float',
        'withholding_amount'  => 'float',
    ];
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
        'unit' => [
            'type'  => 'relation',
            'show'  => true,
            'order' => 2,
        ],
        'price' => [
            'type'       => 'currency',
            'show'       => true,
            'order'      => 3,
            'linkable'   => true,
            'visibleFor' => self::PRICE_VISIBILITY,
        ],
        'basic_amount' => [
            'type'       => 'currency',
            'show'       => true,
            'order'      => 4,
            'linkable'   => true,
            'visibleFor' => self::PRICE_VISIBILITY,
        ],
        'dpp_amount' => [
            'type'       => 'currency',
            'show'       => true,
            'order'      => 5,
            'linkable'   => true,
            'visibleFor' => self::PRICE_VISIBILITY,
        ],
        'tax' => [
            'type'  => 'relation',
            'show'  => true,
            'order' => 6,
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
        'tax_rate' => [
            'type'     => 'numeric',
            'show'     => false,
            'order'    => 7,
            'linkable' => true,
        ],
        'tax_amount' => [
            'type'       => 'currency',
            'show'       => true,
            'order'      => 8,
            'linkable'   => true,
            'visibleFor' => self::PRICE_VISIBILITY,
        ],
        'withholding_amount' => [
            'type'       => 'currency',
            'show'       => false,
            'linkable'   => true,
            'visibleFor' => self::PRICE_VISIBILITY,
        ],
        'description' => [
            'show'  => false,
            'order' => 9,
        ],
        'returned_quantity' => [
            'type'  => 'numeric',
            'show'  => false,
            'order' => 10,
        ],
        'unreturned_quantity' => [
            'type'  => 'numeric',
            'show'  => false,
            'order' => 11,
        ],
        'conversion_factor' => [
            'hidden'   => true,
            'linkable' => true,
        ],
        'currency_code' => [
            'hidden' => true,
        ],
        'base_currency_code' => [
            'hidden' => true,
        ],
        'exchange_rate' => [
            'hidden' => true,
        ],
        'price_base_currency' => [
            'hidden' => true,
        ],
        'salesInvoice' => [
            'ignore' => true,
        ],
        'sales_invoice_id' => [
            'ignore' => true,
        ],
        'salesOrderItem' => [
            'ignore' => true,
        ],
        'sales_order_item_id' => [
            'ignore' => true,
        ],
        'returnAgainstItem' => [
            'ignore' => true,
        ],
        'return_against_item_id' => [
            'ignore' => true,
        ],
        'postedAccount' => [
            'ignore' => true,
        ],
        'posted_account_id' => [
            'ignore' => true,
        ],
    ];

    public static function templateLink() {
        return ':asset_id ? :asset | :item';
    }

    public function salesInvoice() {
        return $this->belongsTo(SalesInvoice::class);
    }

    public function salesOrderItem() {
        return $this->belongsTo(SalesOrderItem::class);
    }

    public function returnAgainstItem() {
        return $this->belongsTo(SalesInvoiceItem::class, 'return_against_item_id');
    }

    /**
     * Akun peran per baris yang dicatat engine posting saat approve (Task 12.1).
     */
    public function postedAccount(): BelongsTo {
        return $this->belongsTo(Account::class, 'posted_account_id');
    }

    public function unit() {
        return $this->belongsTo(ItemUnit::class, 'item_unit_id', 'id');
    }

    public function tax() {
        return $this->belongsTo(Tax::class);
    }

    /**
     * Baris pajak item (pajak majemuk), berurut `position`; `position` 0 = Pajak Utama. Satu-satunya sumber tulis:
     * `InvoiceItemTaxCalculator`.
     */
    public function taxLines(): HasMany {
        return $this->hasMany(SalesInvoiceItemTax::class)->orderBy('position');
    }

    /**
     * Semua pajak item berurut `position`, dengan kolom hitung pivot. `tax()` tetap menunjuk Pajak Utama.
     */
    public function taxes(): BelongsToMany {
        return $this->belongsToMany(Tax::class, 'sales_invoice_item_taxes', 'sales_invoice_item_id', 'tax_id')
            ->withPivot(['tax_rule_version_id', 'position', 'tax_rate', 'dpp_factor', 'base_amount', 'dpp_amount', 'tax_amount', 'withholding_amount'])
            ->withTrashed()
            ->orderByPivot('position');
    }

    public function item() {
        return $this->belongsTo(ItemVariant::class, 'item_id');
    }

    public function asset(): BelongsTo {
        return $this->belongsTo(Asset::class);
    }
}
