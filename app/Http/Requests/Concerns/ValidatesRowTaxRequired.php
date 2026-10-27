<?php

namespace App\Http\Requests\Concerns;

use App\Enums\DefaultsDocumentType;
use App\Models\Asset\Asset;
use App\Models\Inventory\ItemVariant;
use App\Services\Core\Setting\DocumentDefaultsResolver;
use Illuminate\Contracts\Validation\Validator;

/**
 * Pajak per baris wajib diisi, kecuali aturan default bersyarat "tanpa pajak" eksplisit
 * (default_tax_rules.tax_id = null) cocok untuk jenis dokumen dan atribut barang baris itu
 * (spec module-conditional-defaults, Requirement 1.5). Berlaku di FormRequest simpan; approve,
 * amend, dan dokumen lama tidak diperiksa ulang.
 */
trait ValidatesRowTaxRequired {
    /**
     * @param  array<int|string, array<string, mixed>>  $rows
     * @param  array<int|string, ?string>  $itemIdByRow  Item (induk) tiap baris, atau null bila tak diketahui
     */
    protected function validateRowTaxRequired(Validator $validator, DefaultsDocumentType $type, array $rows, array $itemIdByRow): void {
        $missing = array_filter($rows, fn ($row): bool => blank($row['tax']['id'] ?? null));
        if ($missing === []) {
            return;
        }

        $itemIds  = array_values(array_unique(array_filter(array_map(fn ($index) => $itemIdByRow[$index] ?? null, array_keys($missing)))));
        $resolved = $itemIds === [] ? [] : app(DocumentDefaultsResolver::class)->resolveForItems($type, $itemIds);

        foreach (array_keys($missing) as $index) {
            $itemId = $itemIdByRow[$index] ?? null;
            if ($itemId !== null && ($resolved[$itemId]['tax_optional'] ?? false)) {
                continue;
            }

            $validator->errors()->add("items.{$index}.tax.id", __('validation.required', ['attribute' => 'tax']));
        }
    }

    /**
     * Item (induk) dari baris yang membawa `item.id` (ItemVariant) atau `asset.id` (Asset).
     *
     * @param  array<int|string, array<string, mixed>>  $rows
     * @return array<int|string, ?string>
     */
    protected function itemIdsOfRows(array $rows): array {
        $variantIds = array_filter(array_map(fn ($row) => $row['item']['id'] ?? null, $rows));
        $assetIds   = array_filter(array_map(fn ($row) => $row['asset']['id'] ?? null, $rows));
        $variants   = $variantIds === [] ? collect() : ItemVariant::query()->whereIn('id', array_unique($variantIds))->pluck('item_id', 'id');
        $assets     = $assetIds === [] ? collect() : Asset::query()->whereIn('id', array_unique($assetIds))->pluck('item_id', 'id');

        $result = [];
        foreach ($rows as $index => $row) {
            $result[$index] = filled($row['item']['id'] ?? null)
                ? ($variants[$row['item']['id']] ?? null)
                : (filled($row['asset']['id'] ?? null) ? ($assets[$row['asset']['id']] ?? null) : null);
        }

        return $result;
    }
}
