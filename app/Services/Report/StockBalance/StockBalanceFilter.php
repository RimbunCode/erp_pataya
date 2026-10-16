<?php

namespace App\Services\Report\StockBalance;

use App\Services\Report\ReportFilter;
use Illuminate\Database\Eloquent\Builder;

/**
 * Filter dasar Laporan Stok Persediaan. Snapshot posisi terkini, jadi tanpa
 * rentang tanggal (Req 2.1).
 */
final class StockBalanceFilter extends ReportFilter {
    /** Kunci parameter query yang dibaca laporan ini. */
    public const KEYS = ['item_variant_id', 'warehouse_id', 'category_id'];

    public function __construct(
        private ?string $itemVariantId = null,
        private ?string $warehouseId = null,
        private ?string $categoryId = null,
    ) {}

    /**
     * @param  array<string, string|null>  $values  nilai dari ReportFilterStore
     */
    public static function fromValues(array $values): self {
        return new self(
            itemVariantId: $values['item_variant_id'] ?? null,
            warehouseId: $values['warehouse_id'] ?? null,
            categoryId: $values['category_id'] ?? null,
        );
    }

    public function applyTo(Builder $query): Builder {
        return $query
            ->when($this->itemVariantId, fn (Builder $q, string $value) => $q->where('item_variant_id', $value))
            ->when($this->warehouseId, fn (Builder $q, string $value) => $q->where('warehouse_id', $value))
            ->when($this->categoryId, fn (Builder $q, string $value) => $q->where('category_id', $value));
    }

    public function toSummary(): array {
        $summary = [];

        if ($this->itemVariantId !== null) {
            $summary[__('report.filter.item')] = $this->itemVariantId;
        }
        if ($this->warehouseId !== null) {
            $summary[__('report.filter.warehouse')] = $this->warehouseId;
        }
        if ($this->categoryId !== null) {
            $summary[__('report.filter.category')] = $this->categoryId;
        }

        return $summary;
    }
}
