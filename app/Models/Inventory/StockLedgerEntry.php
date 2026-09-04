<?php

namespace App\Models\Inventory;

use App\Models\Core\FormatingSeries;
use App\Models\Model;
use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class StockLedgerEntry extends Model {
    use DataTable, HasUlids, SoftDeletes;

    protected $guarded                          = ['id'];
    protected static ?string $defaultSortColumn = 'transaction_date';
    public $translateKey                        = 'inventory.stockLedger';

    protected static function permissions() {
        return [
            'select',
            'read',
            'export',
            'print',
        ];
    }

    protected $configColumns = [
        'code' => [
            'show'   => true,
            'order'  => 0,
            'isLink' => true,
        ],
        'item' => [
            'show'  => true,
            'order' => 1,
        ],
        'quantity_change' => [
            'type'  => 'numeric',
            'show'  => true,
            'order' => 2,
        ],
        'quantity_after_transaction' => [
            'type'  => 'numeric',
            'show'  => true,
            'order' => 3,
        ],
        'valuation_rate' => [
            'type'  => 'numeric',
            'show'  => true,
            'order' => 4,
        ],
        'balance_stock_value' => [
            'type'  => 'numeric',
            'show'  => true,
            'order' => 5,
        ],
        'change_in_stock_value' => [
            'type'  => 'numeric',
            'show'  => true,
            'order' => 6,
        ],
        'referenceable' => [
            'show'  => true,
            'order' => 7,
        ],
        'stock_queue' => [
            'ignore' => true,
        ],

        'unit',
        'warehouse',
    ];
    protected $casts = [
        'stock_queue'                => 'array',
        'is_valuated'                => 'boolean',
        'transaction_date'           => 'datetime',
        'conversion_factor'          => 'float',
        'quantity_change'            => 'float',
        'quantity_after_transaction' => 'float',
        'valuation_rate'             => 'float',
        'balance_stock_value'        => 'float',
        'change_in_stock_value'      => 'float',
    ];

    public static function templateLink() {
        return ':code';
    }

    /**
     * Nama kelas (`StockLedgerEntry`) tidak sama dengan nama route resource
     * (`stockLedger`, lihat `Route::resourceDetail('stockLedger', ...)` di
     * routes/web.php) — override ini supaya breadcrumb/link yang dibentuk
     * dari attribute `route` (mis. `setBreadcrumbs()`) mengarah ke route yang
     * benar-benar terdaftar, bukan `stockLedgerEntries` hasil pluralize nama
     * kelas.
     */
    protected function getRouteAttribute() {
        return 'stockLedgers';
    }

    /**
     * Jalur terpisah dari `getRouteAttribute()` di atas: `getNameClass()`
     * dipakai `DataTableScope::addDataTable()` untuk mengisi prop Inertia
     * `name`, yang lalu dipakai `DataTable2.jsx` untuk membentuk nama route
     * kolom `isLink` (`pluralize.plural(name) + '.show'`). Tanpa override
     * ini, frontend mengarah ke `stockLedgerEntries.show` yang tidak
     * terdaftar. `initPermissions()` (DataTable.php) TIDAK memakai method
     * ini — pakai `Str::afterLast(static::class, '\\')` langsung — sehingga
     * override ini tidak berdampak ke nama Permission/FormatingSeries yang
     * sudah tersimpan.
     */
    public function getNameClass() {
        return 'stockLedger';
    }

    protected static function loadRelationsOnShow() {
        return [
            'item',
            'unit',
            'warehouse',
            'referenceable',
        ];
    }

    public function canDelete() {
        return false;
    }

    protected static string $defaultFormatCode = 'SLE-@[iiii]/@[yy]';
    protected static $generateCodeSeries       = true;

    public static function boot() {
        parent::boot();
        self::creating(function ($model) {
            $model->code = FormatingSeries::generate(StockLedgerEntry::class, $model->toArray());
        });
    }

    public function item() {
        return $this->belongsTo(ItemVariant::class, 'item_id');
    }

    public function unit() {
        return $this->belongsTo(ItemUnit::class, 'item_unit_id', 'id');
    }

    public function warehouse() {
        return $this->belongsTo(Warehouse::class, 'warehouse_id');
    }

    public function referenceable() {
        return $this->morphTo();
    }
}
