<?php

namespace App\Services\Finances\Currency;

use App\Enums\RateType;
use Carbon\CarbonInterface;
use JsonSerializable;

/**
 * Hasil konversi mata uang beserta penjelasannya (Finance Fase 4, Requirement 2.3 dan 2.5): jumlah hasil (dibulatkan
 * HALF_UP ke minor unit mata uang tujuan), kurs yang dipakai, tipe, tanggal, sumber, dan apakah kurs kebalikan.
 * Dapat diserialisasi (`toArray`/JSON) untuk dipakai sebagai penjelasan di UI dan jejak kurs pada dokumen.
 */
final readonly class FxConversion implements JsonSerializable {
    /** Nilai `source` untuk konversi `from = to` (tanpa pencarian kurs). */
    public const SOURCE_IDENTITY = 'identity';

    /**
     * @param  string  $amount  jumlah hasil, string desimal. Dibulatkan HALF_UP ke minor unit mata uang tujuan, KECUALI
     *                          konversi `from = to` (identity): jumlah dikembalikan apa adanya (ternormalisasi) tanpa
     *                          pembulatan (Requirement 2.4).
     * @param  string  $rate  kurs untuk PENJELASAN di UI (untuk kebalikan: `1/rate` pada 8 digit). Bukan dasar
     *                        penghitungan ulang.
     * @param  bool  $inverse  true bila konversi berjalan berlawanan arah dengan baris kurs tersimpan (`to -> from`)
     * @param  ?string  $exchangeRateId  id baris `exchange_rates` yang dipakai; null untuk identity
     * @param  ?string  $storedRate  kurs apa adanya di baris tersimpan (arah `from -> to` milik baris itu); `1` untuk identity.
     *                               Konsumen yang perlu menghitung ulang (revaluasi, jejak dokumen) memakai `storedRate` +
     *                               `inverse`: kurs langsung `amount × storedRate`, kebalikan `amount ÷ storedRate`
     *                               (mengalikan dengan `rate` kebalikan yang dibulatkan 8 digit memberi selisih,
     *                               mis. IDR 15.800.000 dengan USD→IDR 15800 menjadi 999,98, bukan 1000,00).
     */
    public function __construct(
        public string $amount,
        public string $rate,
        public RateType $rateType,
        public CarbonInterface $rateDate,
        public string $source,
        public bool $inverse,
        public string $from,
        public string $to,
        public ?string $exchangeRateId = null,
        public ?string $storedRate = null,
    ) {}

    /**
     * @return array{amount: string, rate: string, rate_type: string, rate_date: string, source: string, inverse: bool, from: string, to: string, exchange_rate_id: ?string, stored_rate: ?string}
     */
    public function toArray(): array {
        return [
            'amount'           => $this->amount,
            'rate'             => $this->rate,
            'rate_type'        => $this->rateType->value,
            'rate_date'        => $this->rateDate->toDateString(),
            'source'           => $this->source,
            'inverse'          => $this->inverse,
            'from'             => $this->from,
            'to'               => $this->to,
            'exchange_rate_id' => $this->exchangeRateId,
            'stored_rate'      => $this->storedRate,
        ];
    }

    /**
     * @return array{amount: string, rate: string, rate_type: string, rate_date: string, source: string, inverse: bool, from: string, to: string, exchange_rate_id: ?string, stored_rate: ?string}
     */
    public function jsonSerialize(): array {
        return $this->toArray();
    }
}
