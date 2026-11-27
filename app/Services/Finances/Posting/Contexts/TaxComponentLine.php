<?php

namespace App\Services\Finances\Posting\Contexts;

/**
 * Satu komponen pajak sebuah invoice yang dibawa `PostingContext::$taxComponents` (Finance Fase 3, Requirement 7).
 * Disusun pabrik konteks (domain pemilik dokumen) dari NILAI TERSIMPAN item, dikelompokkan per (pajak, versi aturan);
 * Posting Rule hanya menyebut peran, tidak pernah akun, dan tidak mengenal model pajak (P-8).
 *
 * `lineShares` memetakan `LineAttributes::$lineId` => bagian pajak baris itu, agar baris `revenue`/`expense` peka-barang
 * dapat dikurangi tepat sebesar pajak yang dipisah (baris pendapatan/beban = sisa, Requirement 7.4).
 */
final readonly class TaxComponentLine {
    /**
     * @param  string  $role  peran pajak (`output_role` untuk penjualan, `input_role` untuk pembelian) dari versi aturan
     * @param  float  $amount  Σ `tax_amount` tersimpan komponen ini (dalam ruang nilai yang sama dengan `amounts['total']`)
     * @param  bool  $isCreditable  pajak masukan dapat dikreditkan (`taxes.is_creditable` dan PKP); selalu true untuk penjualan
     * @param  bool  $classified  pajak terklasifikasi (`category` bukan `unclassified`) dan `behavior = additive`
     * @param  array<string, float>  $lineShares
     * @param  bool  $withholding  pajak potong (Bagian B, Requirement 12.4): `amount` = Σ `withholding_amount` tersimpan,
     *                             `role` = `withholding_receivable`/`withholding_payable`; tidak menambah total dan tidak
     *                             dipisah dari `revenue`/`expense`, tetapi memotong `receivable`/`payable`
     */
    public function __construct(
        public ?string $ruleVersionId,
        public string $role,
        public float $amount,
        public bool $isCreditable,
        public bool $classified,
        public array $lineShares = [],
        public ?string $taxId = null,
        public bool $withholding = false,
    ) {}

    /**
     * Apakah komponen ini dipisah ke barisnya sendiri (Requirement 7.1-7.3): terklasifikasi, punya versi aturan
     * (peran berasal dari versi; tanpa versi = legacy, tertanam), dan untuk pembelian dapat dikreditkan.
     */
    public function isSplittable(bool $requiresCreditable): bool {
        return ! $this->withholding && $this->classified && $this->ruleVersionId !== null && $this->amount > 0 && (! $requiresCreditable || $this->isCreditable);
    }

    public function shareOf(?string $lineId): float {
        return $lineId === null ? 0.0 : (float) ($this->lineShares[$lineId] ?? 0.0);
    }
}
