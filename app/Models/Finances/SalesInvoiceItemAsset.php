<?php

namespace App\Models\Finances;

use App\Enums\FormStatus;
use App\Events\Asset\AssetSoldViaInvoice;
use App\Models\Asset\Asset;
use App\Models\Model;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class SalesInvoiceItemAsset extends Model {
    use HasFactory, HasUlids, SoftDeletes;

    public static $parentRelation = 'salesInvoiceItem';
    protected $guarded            = ['id'];
    protected $casts              = [
        'quantity'     => 'float',
        'processed_at' => 'datetime',
    ];

    public function salesInvoiceItem(): BelongsTo {
        return $this->belongsTo(SalesInvoiceItem::class);
    }

    public function asset(): BelongsTo {
        return $this->belongsTo(Asset::class);
    }

    protected static function booted(): void {
        static::created(function (self $row) {
            $invoice = $row->salesInvoiceItem->salesInvoice;
            if (\in_array(FormStatus::APPROVED, $invoice->status ?? [], true)) {
                event(new AssetSoldViaInvoice($row));
            }
        });
    }
}
