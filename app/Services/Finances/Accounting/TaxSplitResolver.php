<?php

namespace App\Services\Finances\Accounting;

use App\Enums\PostingDocumentType;
use App\Models\Finances\FinanceSetting;
use App\Services\Core\Setting\SettingsService;
use App\Services\Finances\Ledger\FiscalPeriodService;
use Carbon\CarbonInterface;

/**
 * Memutuskan flag `PostingContext.flags['tax_split']` (Finance Fase 3, Requirement 7.5; design "Cutover"): aktif bila
 * hari bisnis `transactionDate` (zona waktu perusahaan, sama dengan tanggal jurnal) sama dengan atau sesudah
 * `finance_tax_split_from.{type}`. Setting kosong (NULL = tidak aktif, Q-P3-3), atau jenis dokumen selain Sales Invoice
 * dan Purchase Invoice, berarti tidak aktif (bentuk jurnal lama).
 *
 * Tanggal pembanding adalah tanggal JURNAL (saat approve atau saat percobaan ulang posting), selaras dengan
 * `DiscountSplitResolver`. Dibaca pabrik konteks (domain pemilik dokumen) sehingga Posting Rule tetap murni.
 * Status PKP perusahaan (`finance_company_is_pkp`) dibaca lewat `companyIsPkp()` untuk kreditabilitas PPN Masukan
 * (Requirement 7.9).
 */
final class TaxSplitResolver {
    public function __construct(
        private readonly SettingsService $settings,
        private readonly FiscalPeriodService $periods,
    ) {}

    public function isActive(PostingDocumentType $type, CarbonInterface $transactionDate): bool {
        $from = $this->cutoverDate($type);

        return $from !== null && $this->periods->businessDay($transactionDate) >= $from;
    }

    /**
     * Tanggal cutover (`Y-m-d`) untuk jenis dokumen itu, atau null bila tidak aktif.
     */
    public function cutoverDate(PostingDocumentType $type): ?string {
        $map   = $this->settings->getForRead(FinanceSetting::class)->tax_split_from;
        $value = \is_array($map) ? ($map[$type->value] ?? null) : null;

        return $value === null || $value === '' ? null : substr((string) $value, 0, 10);
    }

    public function companyIsPkp(): bool {
        return (bool) $this->settings->getForRead(FinanceSetting::class)->company_is_pkp;
    }
}
