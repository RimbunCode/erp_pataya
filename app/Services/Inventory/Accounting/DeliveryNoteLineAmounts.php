<?php

namespace App\Services\Inventory\Accounting;

use App\Models\Inventory\DeliveryNote;
use App\Models\Inventory\DeliveryNoteItem;

/**
 * Nilai HPP per baris Delivery Note, satu sumber untuk pabrik konteks posting dan jalur retry
 * (`GlPostingStatusController`). Nilainya sama dengan yang dijumlahkan `DeliveryNoteService::onApproved` ke
 * `total_picked`:
 *
 * - maju: Σ `rate * quantity` dari `valuation_rates` baris itu sendiri;
 * - retur: Σ `rate * quantity` dari `valuation_rates` baris dokumen asal (`returnAgainstItem`), karena baris retur
 *   tidak menyimpan `valuation_rates` sendiri.
 *
 * Baris tanpa nilai (aset, jasa, non-stok) tidak muncul di hasil.
 */
final class DeliveryNoteLineAmounts {
    /**
     * @return array<string, float> nilai per baris, key = id baris, hanya yang bukan nol
     */
    public static function forDocument(DeliveryNote $deliveryNote, bool $isReturn): array {
        $amounts = [];

        foreach ($deliveryNote->items as $item) {
            $amount = self::forItem($item, $isReturn);
            if (abs($amount) > 1e-9) {
                $amounts[(string) $item->getKey()] = $amount;
            }
        }

        return $amounts;
    }

    public static function forItem(DeliveryNoteItem $item, bool $isReturn): float {
        $rates = $isReturn
            ? ($item->returnAgainstItem?->valuation_rates ?? [])
            : ($item->valuation_rates ?? []);

        return (float) array_sum(array_map(
            fn ($v): float => (float) ($v['rate'] ?? 0) * (float) ($v['quantity'] ?? 0),
            $rates,
        ));
    }

    /**
     * @param  array<string, float>  $amounts
     */
    public static function total(array $amounts): float {
        return (float) array_sum($amounts);
    }
}
