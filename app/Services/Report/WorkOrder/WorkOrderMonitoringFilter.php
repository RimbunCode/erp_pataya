<?php

namespace App\Services\Report\WorkOrder;

use App\Services\Report\ReportFilter;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;

/**
 * Filter dasar Laporan Monitoring Work Order (Req 14.2): rentang tanggal kerusakan,
 * status pengerjaan (selesai atau berjalan), jenis servis, dan aset.
 */
final class WorkOrderMonitoringFilter extends ReportFilter {
    /** Kunci parameter query yang dibaca laporan ini. */
    public const KEYS = ['date_from', 'date_to', 'progress_status', 'service_type', 'asset_id'];

    /** Nilai status pengerjaan yang valid, sama dengan kolom progress_status pada view. */
    public const PROGRESS_STATUSES = ['berjalan', 'selesai'];

    public function __construct(
        private ?string $dateFrom = null,
        private ?string $dateTo = null,
        private ?string $progressStatus = null,
        private ?string $serviceType = null,
        private ?string $assetId = null,
    ) {}

    /**
     * @param  array<string, string|null>  $values  nilai dari ReportFilterStore
     */
    public static function fromValues(array $values): self {
        return new self(
            dateFrom: $values['date_from'] ?? null,
            dateTo: $values['date_to'] ?? null,
            progressStatus: $values['progress_status'] ?? null,
            serviceType: $values['service_type'] ?? null,
            assetId: $values['asset_id'] ?? null,
        );
    }

    public function applyTo(Builder $query): Builder {
        return $query
            ->when($this->dateFrom, fn (Builder $q, string $value) => $q->where('transaction_date', '>=', Carbon::parse($value)->startOfDay()))
            ->when($this->dateTo, fn (Builder $q, string $value) => $q->where('transaction_date', '<=', Carbon::parse($value)->endOfDay()))
            ->when($this->progressStatus, fn (Builder $q, string $value) => $q->where('progress_status', $value))
            ->when($this->serviceType, fn (Builder $q, string $value) => $q->where('service_type', $value))
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
        if ($this->progressStatus !== null) {
            $summary[__('report.filter.status')] = __('report.work_order.progress.' . $this->progressStatus);
        }
        if ($this->serviceType !== null) {
            $summary[__('report.filter.service_type')] = $this->serviceType;
        }
        if ($this->assetId !== null) {
            $summary[__('report.filter.asset')] = $this->assetId;
        }

        return $summary;
    }
}
