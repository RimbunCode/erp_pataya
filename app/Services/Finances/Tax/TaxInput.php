<?php

namespace App\Services\Finances\Tax;

use Carbon\CarbonInterface;

/**
 * Satu pasangan (baris, pajak) yang dihitung `TaxEngine` (Finance Fase 3, Requirement 4.1 dan 13.6). `lineRef`
 * boleh berulang untuk baris yang sama (kait multi-pajak per baris, D-28). Tax Engine tidak mengenal model
 * dokumen: pemanggil menyerahkan basis, pajak, tanggal, dan minor unit mata uang dasar.
 */
final readonly class TaxInput {
    /**
     * @param  string  $taxId  `taxes.id`
     * @param  float|int|string  $baseAmount  basis bersih setelah diskon (belum dikali faktor DPP), dalam mata uang dasar
     * @param  CarbonInterface  $date  tanggal dokumen (bukan `now()`; Requirement 3.4)
     * @param  int  $minorUnit  minor unit mata uang dasar (0..6)
     * @param  string|null  $lineRef  rujukan baris untuk penjelasan (mis. `id` item)
     */
    public function __construct(
        public string $taxId,
        public float|int|string $baseAmount,
        public CarbonInterface $date,
        public int $minorUnit,
        public ?string $lineRef = null,
    ) {}
}
