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
     * @param  string  $amount  jumlah hasil, string desimal
     * @param  string  $rate  kurs yang dipakai, string desimal (untuk kebalikan: `1/rate` pada 8 digit)
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
    ) {}

    /**
     * @return array{amount: string, rate: string, rate_type: string, rate_date: string, source: string, inverse: bool, from: string, to: string}
     */
    public function toArray(): array {
        return [
            'amount'    => $this->amount,
            'rate'      => $this->rate,
            'rate_type' => $this->rateType->value,
            'rate_date' => $this->rateDate->toDateString(),
            'source'    => $this->source,
            'inverse'   => $this->inverse,
            'from'      => $this->from,
            'to'        => $this->to,
        ];
    }

    /**
     * @return array{amount: string, rate: string, rate_type: string, rate_date: string, source: string, inverse: bool, from: string, to: string}
     */
    public function jsonSerialize(): array {
        return $this->toArray();
    }
}
