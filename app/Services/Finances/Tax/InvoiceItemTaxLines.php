<?php

namespace App\Services\Finances\Tax;

use Illuminate\Database\Eloquent\Model;

/**
 * Satu-satunya pembaca "pajak apa saja yang dibawa item invoice" untuk jurnal, snapshot, cetak, dan pemeriksaan
 * versi (spek finance-multi-tax-per-item, Requirement 7.6). Sumber utama: baris pivot (`taxLines`, berurut
 * `position`). Jaring pengaman baca: item ber-`tax_id` TANPA baris pivot (data sebelum migrasi backfill) dibaca
 * sebagai SATU pajak dari kolom item, dengan angka apa adanya (`tax_amount` dan `withholding_amount` item), sehingga
 * perilaku lama tidak berubah.
 *
 * @phpstan-type TaxLine array{tax_id: string, tax_rule_version_id: string|null, position: int, tax_rate: float, dpp_factor: float|null, base_amount: float, dpp_amount: float, tax_amount: float, withholding_amount: float, from_pivot: bool}
 */
final class InvoiceItemTaxLines {
    /**
     * @return list<TaxLine>
     */
    public static function of(object $item): array {
        $lines = [];

        if ($item instanceof Model) {
            foreach ($item->taxLines as $line) {
                $lines[] = [
                    'tax_id'              => (string) $line->tax_id,
                    'tax_rule_version_id' => blank($line->tax_rule_version_id) ? null : (string) $line->tax_rule_version_id,
                    'position'            => (int) $line->position,
                    'tax_rate'            => (float) $line->tax_rate,
                    'dpp_factor'          => (float) $line->dpp_factor,
                    'base_amount'         => (float) $line->base_amount,
                    'dpp_amount'          => (float) $line->dpp_amount,
                    'tax_amount'          => (float) $line->tax_amount,
                    'withholding_amount'  => (float) $line->withholding_amount,
                    'from_pivot'          => true,
                ];
            }
        }

        if ($lines !== []) {
            return $lines;
        }

        $taxId = $item->tax_id ?? null;
        if (blank($taxId)) {
            return [];
        }

        return [[
            'tax_id'              => (string) $taxId,
            'tax_rule_version_id' => blank($item->tax_rule_version_id ?? null) ? null : (string) $item->tax_rule_version_id,
            'position'            => 0,
            'tax_rate'            => (float) ($item->tax_rate ?? 0),
            'dpp_factor'          => null,
            'base_amount'         => (float) ($item->basic_amount ?? 0) - (float) ($item->discount_amount ?? 0),
            'dpp_amount'          => (float) ($item->dpp_amount ?? 0),
            'tax_amount'          => (float) ($item->tax_amount ?? 0),
            'withholding_amount'  => (float) ($item->withholding_amount ?? 0),
            'from_pivot'          => false,
        ]];
    }

    /**
     * Rujukan baris untuk snapshot/pembulatan: item dan pajak (`{itemId}#{taxId}`, Requirement 3.5).
     */
    public static function lineRef(object $item, string $taxId): string {
        return $item instanceof Model ? self::refFor((string) $item->getKey(), $taxId) : self::refFor('', $taxId);
    }

    public static function refFor(string $itemId, string $taxId): string {
        return $itemId . '#' . $taxId;
    }

    /**
     * Id item dari rujukan baris; rujukan lama (hanya id item, snapshot sebelum pajak majemuk) dikembalikan apa adanya.
     */
    public static function itemIdOf(string $lineRef): string {
        return explode('#', $lineRef, 2)[0];
    }
}
