<?php

namespace App\Services\Finances\Tax;

use App\Models\Finances\Tax;
use App\Models\Finances\TaxRuleVersion;
use App\Services\Finances\DocumentDiscountCalculator;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Arr;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

/**
 * Perhitungan pajak Quotation, Sales Order, dan Purchase Order lewat `TaxEngine` (spek finance-multi-tax-per-item,
 * Requirement 14.2-14.3, keputusan Q-MT-12 Opsi A). Order memakai mesin dan rumus yang sama dengan invoice
 * (`InvoiceItemTaxCalculator`): faktor DPP dan tarif dari versi aturan pada tanggal dokumen, banyak pajak per item,
 * dan baris pivot `taxLines`, sehingga total order = total invoice yang dibuat darinya.
 *
 * Perbedaan dengan invoice: tabel item order tidak punya kolom `dpp_amount` dan `withholding_amount` (keduanya hanya
 * ada di pivot), dan total dokumen order = basis bersih + pajak penambah (pajak potong tampil terpisah dan tidak
 * menambah atau mengurangi total, Requirement 14.3). Pajak tanpa versi aturan berlaku menggagalkan permintaan
 * sebelum menulis apa pun (Q-P3-5). Dokumen order lama tidak dihitung ulang sampai disimpan ulang.
 *
 * Diskon dokumen dialokasikan dengan `DocumentDiscountCalculator::invoiceItemDiscounts()` (rumus sama dengan klien).
 */
final class OrderTaxApplier {
    public function __construct(
        private readonly DocumentTaxRules $rules,
        private readonly InvoiceItemTaxCalculator $calculator,
    ) {}

    /**
     * @param  array<int|string, array<string, mixed>>  $rows  baris request (`taxes.*.id` atau `tax.id` tunggal)
     * @param  bool  $withTrashed  true untuk dokumen tersimpan yang pajaknya mungkin sudah dihapus lunak
     * @return array<string, Tax>
     */
    public function loadTaxes(array $rows, bool $withTrashed = false): array {
        $ids = collect($rows)->flatMap(fn (array $row): array => ItemTaxSelection::rowTaxIds($row))->unique()->values()->all();

        if ($ids === []) {
            return [];
        }

        $query = $withTrashed ? Tax::query()->withTrashed() : Tax::query();

        return $query->whereIn('id', $ids)->get()->keyBy('id')->all();
    }

    /**
     * Menjaga aturan kombinasi (kunci `items.{i}.taxes`) dan me-resolve versi aturan semua pajak pada tanggal dokumen.
     * Dipanggil sebelum penulisan apa pun.
     *
     * @param  array<int|string, array<string, mixed>>  $rows
     * @param  array<string, Tax>  $taxes
     * @return array<string, TaxRuleVersion>
     */
    public function resolveRules(array $rows, array $taxes, mixed $date): array {
        ItemTaxSelection::assertRows($rows, $taxes);

        return $this->rules->resolveForRows($rows, $taxes, $date);
    }

    /**
     * Mengalokasikan diskon dokumen, menghitung pajak tiap item lewat `TaxEngine`, dan menulis pivot serta agregat
     * item (`discount_amount`, `tax_amount`, `amount`).
     *
     * @param  Collection<int, Model>  $items  item yang sudah tersimpan dan di-refresh (`basic_amount` terisi)
     * @param  array<string, Tax>  $taxes
     * @param  array<string, TaxRuleVersion>  $taxRules  hasil `resolveRules()`
     * @param  array<string, list<string>>  $itemTaxIds  id pajak terurut per kunci item
     * @param  array<string, array<string, string>>  $pinnedVersions  versi aturan terkunci per kunci item lalu `tax_id` (Quotation yang diedit mempertahankan pajak yang tidak diganti)
     * @return array{net: float, tax: float, withholding: float}
     */
    public function apply(Model $document, Collection $items, array $taxes, array $taxRules, array $itemTaxIds, mixed $date, ?string $currencyCode, array $pinnedVersions = []): array {
        $lineRules = $this->rules->lineParameters($taxRules, $taxes);
        $discounts = DocumentDiscountCalculator::invoiceItemDiscounts($document, $items, $lineRules, $itemTaxIds);

        $totals = $this->calculator->apply(
            $items,
            $discounts,
            CarbonImmutable::parse($date ?? 'now'),
            DocumentTaxSnapshot::minorUnitFor($currencyCode),
            true,
            $itemTaxIds,
            false,
            $pinnedVersions,
        );

        return [
            'net'         => (float) $totals['net'],
            'tax'         => (float) $totals['tax'],
            'withholding' => (float) $totals['withholding'],
        ];
    }

    /**
     * Mengganti himpunan pajak sebuah item tersimpan (pivot) dengan id pajak terurut: baris yang tak dipilih dihapus,
     * baris baru dibuat kosong (nilainya diisi `apply()`/`applyStored()`), `position` mengikuti urutan. Dipakai
     * sinkronisasi baris order dari invoice (pajak baris mengikuti pajak yang ditagihkan).
     *
     * @param  list<string>  $taxIds
     */
    public function setItemTaxSet(Model $item, array $taxIds): void {
        $item->taxLines()->whereNotIn('tax_id', $taxIds)->delete();
        foreach (array_values($taxIds) as $position => $taxId) {
            $item->taxLines()->updateOrCreate(['tax_id' => $taxId], ['position' => $position]);
        }
        $item->unsetRelation('taxLines');
    }

    /**
     * Menghitung ulang dokumen order tersimpan dari pajak yang sudah melekat pada itemnya (pivot, dengan fallback kolom
     * item), mis. setelah sinkronisasi baris dari invoice.
     *
     * Dokumen lama tidak dihitung ulang sampai diedit (Q-MT-12): bila `$onlyItemIds` diberikan dan dokumen TANPA diskon
     * dokumen, hanya item yang tercantum yang dihitung ulang; angka tersimpan item lain dipakai apa adanya untuk total
     * (basis bersih = `basic_amount - discount_amount`, pajak = `tax_amount`). Dengan diskon dokumen, alokasi lintas
     * item membuat semua item ikut dihitung ulang. `taxLines` semua item dimuat dengan SATU query (tanpa N+1).
     *
     * Pajak tanpa versi aturan berlaku pada tanggal dokumen menggagalkan penghitungan (Q-P3-5) dengan pesan kunci
     * `items` yang menyebut dokumen perlu aturan pajak, bukan indeks baris request yang tak bermakna di jalur ini.
     *
     * @param  Collection<int, Model>  $items  item tersimpan dan di-refresh (Eloquent Collection)
     * @param  list<string>|null  $onlyItemIds  id item yang berubah; null = semua item
     * @return array{net: float, tax: float, withholding: float}
     *
     * @throws ValidationException
     */
    public function applyStored(Model $document, Collection $items, mixed $date, ?string $currencyCode, ?array $onlyItemIds = null): array {
        $items->load('taxLines');

        $partial = $onlyItemIds !== null && blank($document->discount_on);
        $targets = $partial
            ? $items->filter(fn (Model $item): bool => \in_array((string) $item->getKey(), $onlyItemIds, true))->values()
            : $items;

        $totals = ['net' => 0.0, 'tax' => 0.0, 'withholding' => 0.0];
        if ($targets->isNotEmpty()) {
            $rows       = [];
            $itemTaxIds = [];
            foreach ($targets as $item) {
                $ids                                  = array_map(fn (array $line): string => $line['tax_id'], InvoiceItemTaxLines::of($item));
                $itemTaxIds[(string) $item->getKey()] = $ids;
                $rows[]                               = ['taxes' => array_map(fn (string $id): array => ['id' => $id], $ids)];
            }

            $taxes = $this->loadTaxes($rows, true);

            try {
                $rules = $this->rules->resolveForRows($rows, $taxes, $date);
            } catch (ValidationException $e) {
                throw ValidationException::withMessages([
                    'items' => __('finances/taxRuleVersion.errors.order_resync_rule_missing', ['detail' => implode(' ', Arr::flatten($e->errors()))]),
                ]);
            }

            $totals = $this->apply($document, $targets, $taxes, $rules, $itemTaxIds, $date, $currencyCode);
        }

        if ($partial) {
            $targetKeys = $targets->map(fn (Model $item): string => (string) $item->getKey())->all();
            foreach ($items as $item) {
                if (\in_array((string) $item->getKey(), $targetKeys, true)) {
                    continue;
                }
                $totals['net'] += (float) $item->basic_amount - (float) ($item->discount_amount ?? 0);
                $totals['tax'] += (float) $item->tax_amount;
                $totals['withholding'] += (float) $item->taxLines->sum('withholding_amount');
            }
        }

        return $totals;
    }
}
