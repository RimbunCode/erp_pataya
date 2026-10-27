<?php

namespace App\Services\Purchase;

use App\Models\Inventory\ItemVariant;
use App\Models\Purchase\PurchaseOrderItem;
use App\Services\Core\Setting\ToleranceCalculator;

/**
 * Batas toleransi penerimaan berlebih per PO Item (spec module-defaults-and-controls,
 * Requirement 7.1) untuk satu Purchase Receipt. Dipakai bersama oleh
 * PurchaseReceiptRequest (saat simpan) dan PurchaseReceiptService::onApproved (di bawah lock).
 *
 * Dua hal yang dijaga di sini:
 *  - Seluruh pemenuhan atas satu PO Item dijumlahkan dalam satu batas: kuantitas baris
 *    normal (`quantity`) ditambah porsi yang digantikan baris pengganti (`replaced_quantity`).
 *  - Satuan dinormalisasi. `PurchaseReceiptService::recordFulfilment` menaikkan
 *    `received_quantity` dalam satuan stok (qty x cf / cf stok) sedangkan `quantity` PO Item
 *    dalam satuan PO Item, jadi seluruh perbandingan dilakukan dalam satuan stok
 *    (cf = `item_units.conversion_factor` satuan default item).
 */
class PurchaseReceiptToleranceGuard {
    public function __construct(private readonly ToleranceCalculator $calculator) {}

    /**
     * @param  iterable<int|string, array<string, mixed>>  $rows  baris receipt: `purchase_order_item_id`, `quantity`,
     *                                                            `conversion_factor`, `replaces_purchase_order_item_id`, `replaced_quantity`
     * @param  array<string, true>  $skipSourceIds  PO Item yang sudah ditolak oleh pemeriksaan lain
     * @return array<string, array{index: int|string, remaining: float, limit: float}> pelanggaran per PO Item
     *                                                                                 (satuan PO Item), index = baris pertama yang memakainya
     */
    public function violations(iterable $rows, ?float $tolerance, array $skipSourceIds = [], bool $lock = false): array {
        if ($tolerance === null) {
            return [];
        }

        $baseQuantity     = [];
        $replacedQuantity = [];
        $firstIndex       = [];
        foreach ($rows as $index => $row) {
            $sourceId = $row['purchase_order_item_id'] ?? null;
            if ($sourceId) {
                $baseQuantity[$sourceId] = ($baseQuantity[$sourceId] ?? 0) + (float) ($row['quantity'] ?? 0) * (float) ($row['conversion_factor'] ?? 1 ?: 1);
                $firstIndex[$sourceId] ??= $index;

                continue;
            }

            $replacesId = $row['replaces_purchase_order_item_id'] ?? null;
            if ($replacesId) {
                $replacedQuantity[$replacesId] = ($replacedQuantity[$replacesId] ?? 0) + (float) ($row['replaced_quantity'] ?? 0);
                $firstIndex[$replacesId] ??= $index;
            }
        }

        $sourceIds = array_values(array_unique([...array_keys($baseQuantity), ...array_keys($replacedQuantity)]));
        if ($sourceIds === []) {
            return [];
        }

        $sources = PurchaseOrderItem::query()
            ->whereIn('id', $sourceIds)
            ->when($lock, fn ($query) => $query->lockForUpdate())
            ->get()
            ->keyBy('id');
        $stockFactors = $this->stockFactors($sources->pluck('item_id')->unique()->all());

        $violations = [];
        foreach ($sourceIds as $sourceId) {
            $source = $sources->get($sourceId);
            if (! $source || isset($skipSourceIds[$sourceId])) {
                continue;
            }

            $sourceFactor = (float) ($source->conversion_factor ?: 1);
            $stockFactor  = $stockFactors[$source->item_id] ?? 1.0;
            $requested    = (($baseQuantity[$sourceId] ?? 0) + ($replacedQuantity[$sourceId] ?? 0) * $sourceFactor) / $stockFactor;
            $sourceTotal  = (float) $source->quantity * $sourceFactor / $stockFactor;
            $received     = (float) $source->received_quantity;

            if (! $this->calculator->exceeds($requested, $sourceTotal, $received, $tolerance)) {
                continue;
            }

            $toSourceUnit = $stockFactor / $sourceFactor;

            $violations[$sourceId] = [
                'index'     => $firstIndex[$sourceId],
                'remaining' => max(0, $sourceTotal - $received) * $toSourceUnit,
                'limit'     => (float) $this->calculator->allowed($sourceTotal, $received, $tolerance) * $toSourceUnit,
            ];
        }

        return $violations;
    }

    /**
     * @param  array<int, string>  $variantIds
     * @return array<string, float> conversion_factor satuan default per varian item
     */
    private function stockFactors(array $variantIds): array {
        if ($variantIds === []) {
            return [];
        }

        $factors = [];
        foreach (ItemVariant::query()->with('defaultUom')->whereIn('id', $variantIds)->get() as $variant) {
            $factors[$variant->id] = (float) ($variant->defaultUom?->conversion_factor ?: 1);
        }

        return $factors;
    }
}
