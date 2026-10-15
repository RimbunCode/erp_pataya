<?php

namespace App\Services\Report\TeamActivity;

use App\Services\Report\ReportFilter;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;

/**
 * Filter dasar Laporan Anggota Tim (Req 16.2): rentang tanggal aktivitas, PIC, dan status
 * aktivitas. Aktivitas tanpa PIC tetap ikut kalau PIC tidak dipilih.
 */
final class TeamActivityFilter extends ReportFilter {
    /** Kunci parameter query yang dibaca laporan ini. */
    public const KEYS = ['date_from', 'date_to', 'pic_id', 'activity_status'];

    public function __construct(
        private ?string $dateFrom = null,
        private ?string $dateTo = null,
        private ?string $picId = null,
        private ?string $activityStatus = null,
    ) {}

    /**
     * @param  array<string, string|null>  $values  nilai dari ReportFilterStore
     */
    public static function fromValues(array $values): self {
        return new self(
            dateFrom: $values['date_from'] ?? null,
            dateTo: $values['date_to'] ?? null,
            picId: $values['pic_id'] ?? null,
            activityStatus: $values['activity_status'] ?? null,
        );
    }

    public function applyTo(Builder $query): Builder {
        return $query
            ->when($this->dateFrom, fn (Builder $q, string $value) => $q->where('transaction_date', '>=', Carbon::parse($value)->startOfDay()))
            ->when($this->dateTo, fn (Builder $q, string $value) => $q->where('transaction_date', '<=', Carbon::parse($value)->endOfDay()))
            ->when($this->picId, fn (Builder $q, string $value) => $q->where('pic_id', $value))
            ->when($this->activityStatus, fn (Builder $q, string $value) => $q->where('activity_status', $value));
    }

    public function toSummary(): array {
        $summary = [];

        if ($this->dateFrom !== null) {
            $summary[__('report.filter.date_from')] = $this->dateFrom;
        }
        if ($this->dateTo !== null) {
            $summary[__('report.filter.date_to')] = $this->dateTo;
        }
        if ($this->picId !== null) {
            $summary[__('report.filter.pic')] = $this->picId;
        }
        if ($this->activityStatus !== null) {
            $summary[__('report.filter.status')] = $this->activityStatus;
        }

        return $summary;
    }
}
