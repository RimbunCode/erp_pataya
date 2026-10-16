<?php

namespace App\Services\Report\Sparepart;

use App\Services\Report\ReportFilter;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;

/**
 * Filter dasar Laporan Pemakaian Sparepart (Req 15.2): rentang tanggal, item, dan aset.
 */
final class SparepartUsageFilter extends ReportFilter {
    /** Kunci parameter query yang dibaca laporan ini. */
    public const KEYS = ['date_from', 'date_to', 'item_variant_id', 'asset_id'];

    public function __construct(
        private ?string $dateFrom = null,
        private ?string $dateTo = null,
        private ?string $itemVariantId = null,
        private ?string $assetId = null,
    ) {}

    /**
     * @param  array<string, string|null>  $values  nilai dari ReportFilterStore
     */
    public static function fromValues(array $values): self {
        return new self(
            dateFrom: $values['date_from'] ?? null,
            dateTo: $values['date_to'] ?? null,
            itemVariantId: $values['item_variant_id'] ?? null,
            assetId: $values['asset_id'] ?? null,
        );
    }

    public function applyTo(Builder $query): Builder {
        return $query
            ->when($this->dateFrom, fn (Builder $q, string $value) => $q->where('transaction_date', '>=', Carbon::parse($value)->startOfDay()))
            ->when($this->dateTo, fn (Builder $q, string $value) => $q->where('transaction_date', '<=', Carbon::parse($value)->endOfDay()))
            ->when($this->itemVariantId, fn (Builder $q, string $value) => $q->where('item_variant_id', $value))
            ->when($this->assetId, fn (Builder $q, string $value) => $q->where('asset_id', $value));
    }

    public function toSummary(): array {
        $summary = [];

        if ($this->dateFrom !== null) {
            $summary[__('report.filter.date_from')] = $this->dateFrom;
        }
        if ($this->dateTo !== null) {
            $summary[__('report.filter.date_to')] = $this->dateTo;
        }
        if ($this->itemVariantId !== null) {
            $summary[__('report.filter.item')] = $this->itemVariantId;
        }
        if ($this->assetId !== null) {
            $summary[__('report.filter.asset')] = $this->assetId;
        }

        return $summary;
    }
}
