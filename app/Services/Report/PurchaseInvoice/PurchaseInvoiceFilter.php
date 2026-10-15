<?php

namespace App\Services\Report\PurchaseInvoice;

use App\Services\Report\ReportFilter;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;

/**
 * Filter dasar Laporan Invoice Pembelian (Req 13.2): rentang tanggal invoice, supplier,
 * dan status pembayaran (lunas, sebagian, belum).
 */
final class PurchaseInvoiceFilter extends ReportFilter {
    /** Kunci parameter query yang dibaca laporan ini. */
    public const KEYS = ['date_from', 'date_to', 'supplier_id', 'payment_status'];

    /** Nilai status pembayaran yang valid, sama dengan kolom payment_status pada view. */
    public const PAYMENT_STATUSES = ['lunas', 'sebagian', 'belum'];

    public function __construct(
        private ?string $dateFrom = null,
        private ?string $dateTo = null,
        private ?string $supplierId = null,
        private ?string $paymentStatus = null,
    ) {}

    /**
     * @param  array<string, string|null>  $values  nilai dari ReportFilterStore
     */
    public static function fromValues(array $values): self {
        return new self(
            dateFrom: $values['date_from'] ?? null,
            dateTo: $values['date_to'] ?? null,
            supplierId: $values['supplier_id'] ?? null,
            paymentStatus: $values['payment_status'] ?? null,
        );
    }

    public function applyTo(Builder $query): Builder {
        return $query
            ->when($this->dateFrom, fn (Builder $q, string $value) => $q->where('transaction_date', '>=', Carbon::parse($value)->startOfDay()))
            ->when($this->dateTo, fn (Builder $q, string $value) => $q->where('transaction_date', '<=', Carbon::parse($value)->endOfDay()))
            ->when($this->supplierId, fn (Builder $q, string $value) => $q->where('supplier_id', $value))
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
        if ($this->supplierId !== null) {
            $summary[__('report.filter.supplier')] = $this->supplierId;
        }
        if ($this->paymentStatus !== null) {
            $summary[__('report.filter.status')] = __('report.purchase_invoice.payment.' . $this->paymentStatus);
        }

        return $summary;
    }
}
