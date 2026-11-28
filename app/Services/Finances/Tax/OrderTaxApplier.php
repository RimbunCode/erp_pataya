<?php

namespace App\Services\Finances\Tax;

use App\Models\Finances\Tax;
use App\Models\Finances\TaxRuleVersion;
use App\Services\Finances\DocumentDiscountCalculator;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;

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
     * @return array{net: float, tax: float, withholding: float}
     */
    public function apply(Model $document, Collection $items, array $taxes, array $taxRules, array $itemTaxIds, mixed $date, ?string $currencyCode): array {
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
     * @param  Collection<int, Model>  $items  item tersimpan dan di-refresh
     * @return array{net: float, tax: float, withholding: float}
     */
    public function applyStored(Model $document, Collection $items, mixed $date, ?string $currencyCode): array {
        $rows       = [];
        $itemTaxIds = [];
        foreach ($items as $item) {
            $item->unsetRelation('taxLines');
            $ids                                  = array_map(fn (array $line): string => $line['tax_id'], InvoiceItemTaxLines::of($item));
            $itemTaxIds[(string) $item->getKey()] = $ids;
            $rows[]                               = ['taxes' => array_map(fn (string $id): array => ['id' => $id], $ids)];
        }

        $taxes = $this->loadTaxes($rows, true);

        return $this->apply($document, $items, $taxes, $this->rules->resolveForRows($rows, $taxes, $date), $itemTaxIds, $date, $currencyCode);
    }
}
