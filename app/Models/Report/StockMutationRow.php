<?php

namespace App\Models\Report;

use App\Models\Model;
use App\Services\Report\StockMutation\TransactionTypeLabeler;
use App\Traits\DataTable;
use App\Traits\HasBranch;

/**
 * Baris Laporan Mutasi Stock: pembacaan read-only atas view report_stock_mutations
 * (satu baris per stock_ledger_entries).
 *
 * Izin dicek pada modul sumber (Inventory: StockLedgerEntry), bukan pada model ini. Pembatasan cabang
 * mengikuti gudang lewat HasBranch, sama seperti modul Inventory.
 */
class StockMutationRow extends Model {
    use DataTable, HasBranch;

    protected $table                        = 'report_stock_mutations';
    protected $guarded                      = ['*'];
    public $timestamps                      = false;
    public $incrementing                    = false;
    protected $keyType                      = 'string';
    public $translateKey                    = 'report_rows.stock_mutation';
    protected static bool $ignorePermission = true;
    protected $configColumns                = [
        'transaction_date' => [
            'type'  => 'datetime',
            'show'  => true,
            'order' => 0,
        ],
        'item_code' => [
            'show'  => true,
            'order' => 1,
        ],
        'item_name' => [
            'show'  => true,
            'order' => 2,
        ],
        'warehouse_name' => [
            'show'  => true,
            'order' => 3,
        ],
        'transaction_type' => [
            'show'      => true,
            'order'     => 4,
            'dependsOn' => ['referenceable_type'],
        ],
        'quantity_change' => [
            'type'  => 'numeric',
            'show'  => true,
            'order' => 5,
        ],
        'quantity_after_transaction' => [
            'type'  => 'numeric',
            'show'  => true,
            'order' => 6,
        ],
        'item_variant_id' => [
            'ignore' => true,
        ],
        'warehouse_id' => [
            'ignore' => true,
        ],
        'referenceable_type' => [
            'ignore' => true,
        ],
        'referenceable_id' => [
            'ignore' => true,
        ],
    ];

    public static function getDefaultSortColumn(): string {
        return 'transaction_date';
    }

    public static function templateLink(): string {
        return ':item_code - :warehouse_name';
    }

    /**
     * Jenis transaksi berbahasa Indonesia, diturunkan dari referenceable_type (Req 9.4).
     */
    public function getTransactionTypeAttribute(): string {
        return app(TransactionTypeLabeler::class)->label($this->referenceable_type);
    }

    public static function initPermissions() {
        // Sengaja kosong: laporan memakai izin modul sumber (lihat docblock kelas).
    }

    public function canDelete() {
        return false;
    }
}
