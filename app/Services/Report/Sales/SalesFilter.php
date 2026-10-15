<?php

namespace App\Services\Report\Sales;

use App\Services\Report\ReportFilter;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;

/**
 * Filter dasar Laporan Penjualan (Req 10.2): rentang tanggal SO, pelanggan, dan item.
 *
 * Item adalah relasi baris (sales_order_items), jadi filter ini menyaring SO yang
 * memuat item tersebut lewat EXISTS. Nilai pada baris SO tetap total dokumen itu.
 */
final class SalesFilter extends ReportFilter {
    /** Kunci parameter query yang dibaca laporan ini. */
    public const KEYS = ['date_from', 'date_to', 'customer_id', 'item_variant_id'];

    public function __construct(
        private ?string $dateFrom = null,
        private ?string $dateTo = null,
        private ?string $customerId = null,
        private ?string $itemVariantId = null,
    ) {}

    /**
     * @param  array<string, string|null>  $values  nilai dari ReportFilterStore
     */
    public static function fromValues(array $values): self {
        return new self(
            dateFrom: $values['date_from'] ?? null,
            dateTo: $values['date_to'] ?? null,
            customerId: $values['customer_id'] ?? null,
            itemVariantId: $values['item_variant_id'] ?? null,
        );
    }

    public function applyTo(Builder $query): Builder {
        return $query
            ->when($this->dateFrom, fn (Builder $q, string $value) => $q->where('transaction_date', '>=', Carbon::parse($value)->startOfDay()))
            ->when($this->dateTo, fn (Builder $q, string $value) => $q->where('transaction_date', '<=', Carbon::parse($value)->endOfDay()))
            ->when($this->customerId, fn (Builder $q, string $value) => $q->where('customer_id', $value))
            ->when($this->itemVariantId, fn (Builder $q, string $value) => $q->whereExists(
                fn ($sub) => $sub->selectRaw('1')
                    ->from('sales_order_items')
                    ->whereColumn('sales_order_items.sales_order_id', 'report_sales.id')
                    ->where('sales_order_items.item_id', $value)
                    ->whereNull('sales_order_items.deleted_at'),
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
        if ($this->customerId !== null) {
            $summary[__('report.filter.customer')] = $this->customerId;
        }
        if ($this->itemVariantId !== null) {
            $summary[__('report.filter.item')] = $this->itemVariantId;
        }

        return $summary;
    }
}
