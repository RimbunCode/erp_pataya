<?php

namespace App\Services\Finances\Tax;

use App\Models\Finances\Tax;
use App\Services\Finances\Ledger\MinorUnit;

/**
 * Sumber `tax_invoice_dpp_amount` / `tax_invoice_ppn_amount` pada Faktur Pajak (Finance Fase 3, Requirement 9.1).
 *
 * Bila `tax_breakdown` ter-snapshot dan SEMUA komponennya terklasifikasi (kategori bukan `unclassified`), hanya
 * komponen berkategori PPN (`ppn_standard`/`ppn_luxury`) yang dijumlahkan, jadi PPh dan pajak lain tidak masuk
 * kolom PPN. Selain itu (tanpa snapshot, snapshot kosong/gagal dibangun, atau ada komponen `unclassified`) hasilnya
 * null dan pemanggil memakai perilaku lama (`sum(items.dpp_amount)` / `sum(items.tax_amount)`).
 */
final class TaxInvoiceAmounts {
    /**
     * @param  array<string, mixed>|null  $breakdown  isi `tax_breakdown` dokumen
     * @return array{dpp: float, ppn: float}|null null = pakai perilaku lama
     */
    public static function fromBreakdown(?array $breakdown): ?array {
        $components = $breakdown['components'] ?? [];
        if (! \is_array($components) || $components === []) {
            return null;
        }

        $minorUnit = (int) ($breakdown['minor_unit'] ?? 2);
        $dpp       = 0;
        $ppn       = 0;

        foreach ($components as $row) {
            $category = (string) ($row['category'] ?? Tax::CATEGORY_UNCLASSIFIED);
            if ($category === Tax::CATEGORY_UNCLASSIFIED) {
                return null;
            }

            if (\in_array($category, Tax::PPN_CATEGORIES, true)) {
                $dpp += MinorUnit::toMinor($row['dpp_amount'] ?? 0, $minorUnit);
                $ppn += MinorUnit::toMinor($row['tax_amount'] ?? 0, $minorUnit);
            }
        }

        return [
            'dpp' => (float) MinorUnit::fromMinor($dpp, $minorUnit),
            'ppn' => (float) MinorUnit::fromMinor($ppn, $minorUnit),
        ];
    }
}
