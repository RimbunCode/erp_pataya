<?php

namespace App\Models\Finances;

use App\Models\Inventory\ItemUnit;
use App\Models\Inventory\ItemVariant;
use App\Models\Model;
use App\Models\Sales\SalesOrderItem;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class SalesInvoiceItem extends Model {
    use HasUlids, SoftDeletes;

    public static $parentRelation  = 'salesInvoice';
    public string $translateKey    = 'finances.salesInvoice.item';
    protected $guarded             = ['id'];
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
            'type'  => 'relation',
            'show'  => true,
            'order' => 2,
        ],
        'price' => [
            'type'  => 'currency',
            'show'  => true,
            'order' => 3,
        ],
        'basic_amount' => [
            'type'  => 'currency',
            'show'  => true,
            'order' => 4,
        ],
        'tax' => [
            'type'  => 'relation',
            'show'  => true,
            'order' => 5,
        ],
        'tax_rate' => [
            'type'  => 'numeric',
            'show'  => false,
            'order' => 6,
        ],
        'tax_amount' => [
            'type'  => 'currency',
            'show'  => true,
            'order' => 7,
        ],
        'description' => [
            'show'  => false,
            'order' => 8,
        ],
        'returned_quantity' => [
            'type'  => 'numeric',
            'show'  => false,
            'order' => 9,
        ],
        'unreturned_quantity' => [
            'type'  => 'numeric',
            'show'  => false,
            'order' => 10,
        ],
        'conversion_factor' => [
            'ignore' => true,
        ],
        'currency_code' => [
            'ignore' => true,
        ],
        'base_currency_code' => [
            'ignore' => true,
        ],
        'exchange_rate' => [
            'ignore' => true,
        ],
        'price_base_currency' => [
            'ignore' => true,
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
    ];

    public static function templateLink() {
        return ':item';
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

    public function unit() {
        return $this->belongsTo(ItemUnit::class, 'item_unit_id', 'id');
    }

    public function tax() {
        return $this->belongsTo(Tax::class);
    }

    public function item() {
        return $this->belongsTo(ItemVariant::class, 'item_id');
    }
}
