<?php

namespace App\Models\Purchase;

use Illuminate\Database\Eloquent\Builder;

/**
 * Baris Purchase Receipt di luar PO yang dapat ditagih invoice (spec
 * purchase-invoice-off-po-items). Model turunan KHUSUS dropdown LinkModel:
 * `PurchaseReceiptItem::scopeLinkModel` membatasi ke item aset tetap (fitur Asset),
 * jadi dropdown invoice memakai model ini dengan scope sendiri. Tabel sama.
 */
class PurchaseReceiptOffPoItem extends PurchaseReceiptItem {
    protected $table = 'purchase_receipt_items';

    /**
     * Baris berdiri sendiri (tanpa PO Item dan tanpa `replaces`) dari receipt yang
     * sudah di-approve. Filter PO lewat `filters: {purchase_order_id}` di LinkModel.
     */
    public function scopeLinkModel(Builder $query, string $search): Builder {
        return $query
            ->whereNull('purchase_order_item_id')
            ->whereNull('replaces_purchase_order_item_id')
            ->whereHas('purchaseReceipt', fn ($q) => $q
                ->whereNull('return_against_id')
                ->whereNotNull('submitted_at')
                ->whereJsonContains('status', 'received'))
            ->when($search !== '', fn ($q) => $q->whereHas('item', fn ($q2) => $q2
                ->where('code', 'like', "%{$search}%")
                ->orWhereHas('item', fn ($q3) => $q3->where('name', 'like', "%{$search}%"))));
    }
}
