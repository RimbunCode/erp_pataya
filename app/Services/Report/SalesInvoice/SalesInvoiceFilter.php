<?php

namespace App\Services\Report\SalesInvoice;

use App\Services\Report\ReportFilter;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;

/**
 * Filter dasar Laporan Invoice Penjualan (Req 11.2): rentang tanggal invoice,
 * pelanggan, dan status pembayaran (lunas, sebagian, belum).
 */
final class SalesInvoiceFilter extends ReportFilter {
    /** Kunci parameter query yang dibaca laporan ini. */
    public const KEYS = ['date_from', 'date_to', 'customer_id', 'payment_status'];

    /** Nilai status pembayaran yang valid, sama dengan kolom payment_status pada view. */
    public const PAYMENT_STATUSES = ['lunas', 'sebagian', 'belum'];

    public function __construct(
        private ?string $dateFrom = null,
        private ?string $dateTo = null,
        private ?string $customerId = null,
        private ?string $paymentStatus = null,
    ) {}

    /**
     * @param  array<string, string|null>  $values  nilai dari ReportFilterStore
     */
    public static function fromValues(array $values): self {
        return new self(
            dateFrom: $values['date_from'] ?? null,
            dateTo: $values['date_to'] ?? null,
            customerId: $values['customer_id'] ?? null,
            paymentStatus: $values['payment_status'] ?? null,
        );
    }

    public function applyTo(Builder $query): Builder {
        return $query
            ->when($this->dateFrom, fn (Builder $q, string $value) => $q->where('transaction_date', '>=', Carbon::parse($value)->startOfDay()))
            ->when($this->dateTo, fn (Builder $q, string $value) => $q->where('transaction_date', '<=', Carbon::parse($value)->endOfDay()))
            ->when($this->customerId, fn (Builder $q, string $value) => $q->where('customer_id', $value))
            ->when($this->paymentStatus, fn (Builder $q, string $value) => $q->where('payment_status', $value));
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
        if ($this->paymentStatus !== null) {
            $summary[__('report.filter.status')] = __('report.sales_invoice.payment.' . $this->paymentStatus);
        }

        return $summary;
    }
}
