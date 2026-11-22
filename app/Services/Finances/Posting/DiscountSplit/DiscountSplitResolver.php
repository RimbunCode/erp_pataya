<?php

namespace App\Services\Finances\Posting\DiscountSplit;

use App\Enums\PostingDocumentType;
use App\Models\Finances\FinanceSetting;
use App\Services\Core\Setting\SettingsService;
use App\Services\Finances\Ledger\FiscalPeriodService;
use Carbon\CarbonInterface;

/**
 * Memutuskan flag `PostingContext.flags['discount_split']` (Finance Fase 2, Requirement 14.1; design "Posting Diskon"):
 * aktif bila hari bisnis `transactionDate` (zona waktu perusahaan, sama dengan tanggal jurnal dan effective dating
 * profil) sama dengan atau sesudah `finance_discount_split_from.{type}`. Setting kosong, atau jenis dokumen selain
 * Sales Invoice dan Purchase Invoice, berarti tidak aktif (jurnal bersih seperti sekarang).
 *
 * Dipanggil pabrik konteks (domain pemilik dokumen) sehingga Posting Rule tetap murni (P-2). Setting dibaca lewat
 * `SettingsService::getForRead()` tanpa memo dan tanpa cache: pabrik konteks lengkap hanya dibangun pada mode
 * `shadow`/`on`, dan pembacaan satu baris itu murah dibanding query item yang mendampinginya.
 */
final class DiscountSplitResolver {
    public function __construct(
        private readonly SettingsService $settings,
        private readonly FiscalPeriodService $periods,
    ) {}

    public function isActive(PostingDocumentType $type, CarbonInterface $transactionDate): bool {
        $from = $this->settings->getForRead(FinanceSetting::class)->discountSplitFrom($type);

        return $from !== null && $this->periods->businessDay($transactionDate) >= $from;
    }
}
