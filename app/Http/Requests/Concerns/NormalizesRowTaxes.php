<?php

namespace App\Http\Requests\Concerns;

use App\Models\Finances\Tax;
use App\Services\Finances\Tax\ItemTaxSelection;
use Illuminate\Contracts\Validation\Validator;

/**
 * Kontrak pajak majemuk per item pada request dokumen order/quotation (spek finance-multi-tax-per-item, Requirement
 * 8 dan 14.1): `items.*.taxes` (array objek `{id}`), `tax` tunggal dinormalisasi menjadi `taxes: [tax]`, dan aturan
 * kombinasi (duplikat, lebih dari satu PPN standar, maksimal 5) dilaporkan pada `items.{i}.taxes`.
 *
 * Dipanggil dari `prepareForValidation()` dan `withValidator()` request pemakai.
 */
trait NormalizesRowTaxes {
    /**
     * `tax` tunggal menjadi `taxes: [tax]`; bila keduanya dikirim, `taxes` menang dan `tax` dibuang.
     */
    protected function normalizeRowTaxes(): void {
        $items = $this->input('items');
        if (! \is_array($items)) {
            return;
        }

        foreach ($items as $index => $row) {
            if (\is_array($row)) {
                $items[$index]['taxes'] = ItemTaxSelection::rowTaxes($row);
                unset($items[$index]['tax']);
            }
        }

        $this->merge(['items' => $items]);
    }

    /**
     * Aturan kombinasi pajak pada `items.{i}.taxes`.
     *
     * @param  array<int|string, mixed>  $rows
     */
    protected function validateRowTaxCombinations(Validator $validator, array $rows): void {
        $ids   = collect($rows)->flatMap(fn ($row): array => ItemTaxSelection::rowTaxIds((array) $row))->unique()->values()->all();
        $taxes = $ids === [] ? [] : Tax::query()->whereIn('id', $ids)->get()->keyBy('id')->all();

        foreach (ItemTaxSelection::errorsForRows($rows, $taxes) as $key => $messages) {
            foreach ($messages as $message) {
                $validator->errors()->add($key, $message);
            }
        }
    }

    /**
     * Pajak wajib minimal satu per baris (dokumen yang mewajibkan pajak, mis. Purchase Order dan Quotation).
     *
     * @param  array<int|string, mixed>  $rows
     */
    protected function validateRowTaxesPresent(Validator $validator, array $rows): void {
        foreach ($rows as $index => $row) {
            if (ItemTaxSelection::rowTaxes((array) $row) === []) {
                $validator->errors()->add("items.{$index}.taxes", ItemTaxSelection::message(ItemTaxSelection::VIOLATION_REQUIRED));
            }
        }
    }
}
