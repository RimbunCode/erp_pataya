<?php

namespace App\Services\Report\Purchase;

use App\Services\Report\ReportFilter;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;

/**
 * Filter dasar Laporan Pembelian (Req 12.2): rentang tanggal PO, supplier, dan item.
 * Item adalah relasi baris (purchase_order_items), jadi filter ini menyaring PO yang
 * memuat item tersebut lewat EXISTS.
 */
final class PurchaseFilter extends ReportFilter {
    /** Kunci parameter query yang dibaca laporan ini. */
    public const KEYS = ['date_from', 'date_to', 'supplier_id', 'item_variant_id'];

    public function __construct(
        private ?string $dateFrom = null,
        private ?string $dateTo = null,
        private ?string $supplierId = null,
        private ?string $itemVariantId = null,
    ) {}

    /**
     * @param  array<string, string|null>  $values  nilai dari ReportFilterStore
     */
    public static function fromValues(array $values): self {
        return new self(
            dateFrom: $values['date_from'] ?? null,
            dateTo: $values['date_to'] ?? null,
            supplierId: $values['supplier_id'] ?? null,
            itemVariantId: $values['item_variant_id'] ?? null,
        );
    }

    public function applyTo(Builder $query): Builder {
        return $query
            ->when($this->dateFrom, fn (Builder $q, string $value) => $q->where('transaction_date', '>=', Carbon::parse($value)->startOfDay()))
            ->when($this->dateTo, fn (Builder $q, string $value) => $q->where('transaction_date', '<=', Carbon::parse($value)->endOfDay()))
            ->when($this->supplierId, fn (Builder $q, string $value) => $q->where('supplier_id', $value))
            ->when($this->itemVariantId, fn (Builder $q, string $value) => $q->whereExists(
                fn ($sub) => $sub->selectRaw('1')
                    ->from('purchase_order_items')
                    ->whereColumn('purchase_order_items.purchase_order_id', 'report_purchases.id')
                    ->where('purchase_order_items.item_id', $value)
                    ->whereNull('purchase_order_items.deleted_at'),
            ));
    }

    public function toSummary(): array {
        $summary = [];

        if ($this->dateFrom !== null) {
            $summary[__('report.filter.date_from')] = $this->dateFrom;
        }
        if ($this->dateTo !== null) {
            $summary[__('report.filter.date_to')] = $this->dateTo;
        }
        if ($this->supplierId !== null) {
            $summary[__('report.filter.supplier')] = $this->supplierId;
        }
        if ($this->itemVariantId !== null) {
            $summary[__('report.filter.item')] = $this->itemVariantId;
        }

        return $summary;
    }
}
