<?php

namespace Database\Seeders;

use App\Models\Finances\Tax;
use App\Services\Finances\Tax\TaxRuleVersionService;
use Illuminate\Database\Seeder;

/**
 * Seed pajak standar Finance Fase 3 (Requirement 1.4): `PPN 12% (DPP Nilai Lain 11/12)`, hanya bila belum ada pajak
 * berkategori `ppn_standard` (termasuk yang terhapus lunak). Tidak pernah menimpa pajak atau versi yang sudah ada,
 * sehingga aman dijalankan berulang. Versi 1 dibuat lewat `TaxRuleVersionService::createInitialVersion()`: tarif 12,
 * faktor DPP 11/12 (tarif efektif 11%), berlaku sejak awal tanpa batas akhir.
 */
class TaxSeeder extends Seeder {
    public const NAME = 'PPN 12% (DPP Nilai Lain 11/12)';

    public function run(): void {
        $exists = Tax::query()->withTrashed()->where('category', Tax::CATEGORY_PPN_STANDARD)->exists();
        if ($exists) {
            return;
        }

        $tax = Tax::query()->create([
            'name'     => self::NAME,
            'rate'     => 12,
            'category' => Tax::CATEGORY_PPN_STANDARD,
            'behavior' => Tax::BEHAVIOR_ADDITIVE,
        ]);

        app(TaxRuleVersionService::class)->createInitialVersion($tax);
    }
}
