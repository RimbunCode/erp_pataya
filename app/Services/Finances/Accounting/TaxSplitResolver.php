<?php

namespace App\Services\Finances\Accounting;

use App\Enums\PostingDocumentType;
use App\Models\Finances\FinanceSetting;
use App\Models\Finances\GeneralLedger;
use App\Models\Finances\Journal;
use App\Models\Finances\Tax;
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
    /**
     * `purpose` jurnal yang menjadi tolok ukur bentuk invoice asal (bagian akhir `posting_key`; sama dengan diskon).
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
        $from = $this->cutoverDate($type);

        return $from !== null && $this->periods->businessDay($transactionDate) >= $from;
    }

    /**
     * Seperti `isActive()`, tetapi retur (`$originId` terisi) mengikuti bentuk jurnal invoice ASAL (keputusan pemilik
     * produk 27 November 2026, selaras Q-P2-25 `DiscountSplitResolver`): retur memisahkan pajak bila dan hanya bila jurnal
     * asal memuat baris pajak terpisah (baris dengan `tax_rule_version_id`), di sisi mana pun tanggal retur terhadap
     * cutover, sehingga saldo `tax_output`/`tax_input` tidak pernah debit/kredit tanpa lawan dari invoice asal.
     * Jurnal asal ada tanpa baris pajak = tertanam (pra-cutover, atau tak ada komponen yang dapat dipisah). Tanpa invoice
     * asal, atau jurnal asal belum ada, dipakai tanggal retur sendiri.
     *
     * @param  string|null  $originMorphClass  `getMorphClass()` invoice asal (sama dengan dokumen retur)
     * @param  string|null  $originId  `return_against_id`
     */
    public function isActiveForDocument(PostingDocumentType $type, CarbonInterface $transactionDate, ?string $originMorphClass = null, ?string $originId = null): bool {
        $purpose = self::ORIGIN_JOURNAL_PURPOSE[$type->value] ?? null;
        if ($originMorphClass !== null && $originId !== null && $originId !== '' && $purpose !== null) {
            $origin = Journal::query()
                ->withoutGlobalScopes()
                ->where('posting_key', "{$originMorphClass}:{$originId}:{$purpose}")
                ->first(['id']);

            if ($origin !== null) {
                return GeneralLedger::query()
                    ->withoutGlobalScopes()
                    ->where('journal_id', $origin->id)
                    ->whereNotNull('tax_rule_version_id')
                    // Baris pajak potong (`withholding`, Bagian B) bukan pemisahan PPN: ia selalu diposting dan tidak
                    // menentukan bentuk retur.
                    ->whereHas('taxRuleVersion.tax', fn ($tax) => $tax->withTrashed()->where('behavior', Tax::BEHAVIOR_ADDITIVE))
                    ->exists();
            }
        }

        return $this->isActive($type, $transactionDate);
    }

    /**
     * Nilai jenis dokumen yang `finance_tax_split_from`-nya sudah terisi (dasar peringatan peran pajak belum terpetakan).
     *
     * @return list<string>
     */
    public function documentTypesWithCutover(): array {
        $types = [];
        foreach (PostingDocumentType::cases() as $type) {
            if ($this->cutoverDate($type) !== null) {
                $types[] = $type->value;
            }
        }

        return $types;
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
