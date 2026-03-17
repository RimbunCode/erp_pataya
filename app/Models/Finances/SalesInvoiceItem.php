<?php

namespace App\Models\Finances;

use App\Models\Inventory\ItemVariant;
use App\Models\Inventory\Unit;
use App\Models\Model;
use App\Models\Sales\SalesOrderItem;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class SalesInvoiceItem extends Model {
    use HasUlids, SoftDeletes;

    protected $guarded = ['id'];

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
        return $this->belongsTo(Unit::class);
    }

    public function tax() {
        return $this->belongsTo(Tax::class);
    }

    public function item() {
        return $this->belongsTo(ItemVariant::class, 'item_id');
    }
}
