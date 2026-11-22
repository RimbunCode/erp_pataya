<?php

namespace App\Services\Finances\Posting\DiscountSplit;

use App\Enums\PostingDocumentType;
use App\Models\Finances\FinanceSetting;
use App\Models\Finances\Journal;
use App\Services\Core\Setting\SettingsService;
use App\Services\Finances\Ledger\FiscalPeriodService;
use Carbon\CarbonInterface;

/**
 * Memutuskan flag `PostingContext.flags['discount_split']` (Finance Fase 2, Requirement 14.1; design "Posting Diskon"):
 * aktif bila hari bisnis `transactionDate` (zona waktu perusahaan, sama dengan tanggal jurnal dan effective dating
 * profil) sama dengan atau sesudah `finance_discount_split_from.{type}`. Setting kosong, atau jenis dokumen selain
 * Sales Invoice dan Purchase Invoice, berarti tidak aktif (jurnal bersih seperti sekarang).
 *
 * Tanggal pembanding adalah tanggal JURNAL (`transactionDate` konteks, yaitu saat approve atau saat percobaan ulang
 * posting), bukan kolom `date` dokumen (keputusan pemilik produk 22 November 2026, Requirement 14.1).
 *
 * Retur mengikuti bentuk invoice ASAL (keputusan 22 November 2026): `isActiveForDocument()` membandingkan tanggal
 * jurnal invoice asal (lewat `return_against_id`) dengan setting, sehingga retur atas invoice pra-cutover tetap bersih
 * dan retur atas invoice pasca-cutover tetap terpisah dengan sisi ditukar, di sisi mana pun tanggal retur terhadap
 * cutover. Tanpa invoice asal, atau jurnal asal tidak ditemukan (posting gagal/tertunda atau total nol), dipakai
 * tanggal retur sendiri. Perbandingan memakai setting SAAT INI: bila cutover dipindah atau dikosongkan sesudah invoice
 * asal diposting, retur mengikuti setting baru (bentuk asal tidak direkam; tercatat sebagai risiko di spek).
 *
 * Dipanggil pabrik konteks (domain pemilik dokumen) sehingga Posting Rule tetap murni (P-2). Setting dibaca lewat
 * `SettingsService::getForRead()` tanpa memo dan tanpa cache: pembacaan satu baris itu murah dibanding query item
 * yang mendampingi pabrik konteks lengkap.
 */
final class DiscountSplitResolver {
    /**
     * `purpose` jurnal yang menjadi tolok ukur bentuk invoice asal (bagian akhir `posting_key`).
     */
    private const ORIGIN_JOURNAL_PURPOSE = [
        'sales_invoice'    => 'default',
        'purchase_invoice' => 'expense',
    ];

    public function __construct(
        private readonly SettingsService $settings,
        private readonly FiscalPeriodService $periods,
    ) {}

    public function isActive(PostingDocumentType $type, CarbonInterface $transactionDate): bool {
        $from = $this->settings->getForRead(FinanceSetting::class)->discountSplitFrom($type);

        return $from !== null && $this->periods->businessDay($transactionDate) >= $from;
    }

    /**
     * Seperti `isActive()`, tetapi retur (`$returnAgainstId` terisi) mengikuti tanggal jurnal invoice asal.
     *
     * @param  string|null  $originMorphClass  `getMorphClass()` invoice asal (sama dengan dokumen retur)
     * @param  string|null  $originId  `return_against_id`
     */
    public function isActiveForDocument(PostingDocumentType $type, CarbonInterface $transactionDate, ?string $originMorphClass = null, ?string $originId = null): bool {
        $effectiveDate = $transactionDate;

        $purpose = self::ORIGIN_JOURNAL_PURPOSE[$type->value] ?? null;
        if ($originMorphClass !== null && $originId !== null && $originId !== '' && $purpose !== null) {
            $origin = Journal::query()
                ->withoutGlobalScopes()
                ->where('posting_key', "{$originMorphClass}:{$originId}:{$purpose}")
                ->first(['id', 'transaction_date']);

            $effectiveDate = $origin?->transaction_date ?? $transactionDate;
        }

        return $this->isActive($type, $effectiveDate);
    }
}
