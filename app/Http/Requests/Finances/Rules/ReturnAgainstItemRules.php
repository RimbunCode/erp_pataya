<?php

namespace App\Http\Requests\Finances\Rules;

use Illuminate\Contracts\Validation\Validator;
use Illuminate\Support\Facades\DB;

/**
 * Validasi baris retur invoice (Sales/Purchase): baris asal (`return_against_item_id`) harus
 * milik invoice yang diretur dan total kuantitas retur per baris asal tidak boleh melebihi
 * sisa yang belum diretur (`quantity − returned_quantity`).
 */
final class ReturnAgainstItemRules {
    /**
     * @param  array<int|string,mixed>  $rows  payload `items`
     * @param  string  $itemsTable  mis. `sales_invoice_items`
     * @param  string  $documentKey  FK baris ke invoice, mis. `sales_invoice_id`
     */
    public static function validate(Validator $validator, array $rows, ?string $returnAgainstId, string $itemsTable, string $documentKey): void {
        $sourceIds = [];
        foreach ($rows as $index => $row) {
            $sourceId = $row['return_against_item_id'] ?? null;
            if (blank($sourceId)) {
                continue;
            }
            if (blank($returnAgainstId)) {
                $validator->errors()->add("items.{$index}.return_against_item_id", __('finances/returnAgainst.not_a_return'));

                continue;
            }
            $sourceIds[$index] = $sourceId;
        }

        if ($sourceIds === []) {
            return;
        }

        $sources = DB::table($itemsTable)
            ->whereIn('id', array_unique($sourceIds))
            ->whereNull('deleted_at')
            ->get(['id', $documentKey, 'quantity', 'returned_quantity'])
            ->keyBy('id');

        $requested = [];
        foreach ($sourceIds as $index => $sourceId) {
            $source = $sources->get($sourceId);
            if (! $source || $source->{$documentKey} !== $returnAgainstId) {
                $validator->errors()->add("items.{$index}.return_against_item_id", __('finances/returnAgainst.item_not_in_invoice'));

                continue;
            }

            $requested[$sourceId] = ($requested[$sourceId] ?? 0) + (float) ($rows[$index]['quantity'] ?? 0);
            $remaining            = (float) $source->quantity - (float) $source->returned_quantity;
            if ($requested[$sourceId] > $remaining + 0.0001) {
                $validator->errors()->add("items.{$index}.quantity", __('finances/returnAgainst.quantity_exceeds_remaining', ['max' => $remaining]));
            }
        }
    }
}
