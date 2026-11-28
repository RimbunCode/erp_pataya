<?php

namespace App\Services\Finances\Tax;

use App\Models\Finances\Tax;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;

/**
 * Menghitung dan menyimpan pajak item invoice lewat `TaxEngine` (Finance Fase 3, Bagian B, Requirement 12.3-12.4;
 * pajak majemuk per item, spek finance-multi-tax-per-item, Requirement 3). Satu-satunya penulis baris pivot
 * (`sales_invoice_item_taxes`/`purchase_invoice_item_taxes`, via relasi `taxLines`) dan agregat item.
 *
 * Basis semua pajak sebuah item = `basic_amount - discount_amount` (bersih setelah alokasi diskon dokumen), SAMA untuk
 * semua pajak item itu; tidak ada pajak atas pajak (Q-MT-6). Satu `TaxInput` dibuat per pasangan (item, pajak)
 * dengan `lineRef` gabungan `{itemId}#{taxId}`, dan `TaxEngine::calculateDocument()` dipanggil SEKALI untuk seluruh
 * dokumen sehingga pembulatan `per_document` berlaku lintas item dan lintas pajak berversi sama. Faktor DPP dan tarif
 * dari versi aturan pada tanggal dokumen (di-resolve engine); pembulatan sesuai `rounding_mode` versi.
 *
 * Tiap komponen ditulis ke pivot (`position` = urutan pilihan, 0 = Pajak Utama; baris pivot yang tak lagi dipilih
 * dihapus). Kolom item menjadi agregat: `tax_amount` = Σ pajak penambah, `withholding_amount` = Σ pajak potong
 * (pajak `withholding` TIDAK menambah total, Requirement 12.4), `dpp_amount` = DPP komponen berkategori PPN pertama;
 * bila tak ada PPN, komponen penambah pertama; bila tak ada penambah, komponen pertama (Q-MT-7), `amount` (Purchase
 * Invoice) = basis bersih + `tax_amount`. Item tanpa pajak: dpp, pajak, dan potongan 0 dan tanpa baris pivot.
 * Item dengan satu pajak menghasilkan angka identik dengan perilaku sebelum pajak majemuk.
 *
 * Tidak mengenal model dokumen: pemanggil menyerahkan item bergaya model (atribut `tax_id`, `basic_amount`) dan, untuk
 * pajak majemuk, daftar id pajak terurut per item.
 */
final class InvoiceItemTaxCalculator {
    private const AMOUNT_PRECISION = 6;

    public function __construct(private readonly TaxEngine $engine) {}

    /**
     * @param  Collection<int, Model>  $items  item yang sudah tersimpan (punya `basic_amount` dan kunci)
     * @param  array<int, float>  $discounts  diskon per baris terurut seperti `$items->values()` (`DocumentDiscountCalculator::invoiceItemDiscounts()`)
     * @param  bool  $hasAmountColumn  true untuk Purchase Invoice (kolom `amount` = bersih + pajak penambah)
     * @param  array<string, list<string>>  $itemTaxIds  id pajak terurut per kunci item; item yang tidak tercantum memakai `[tax_id]` kolom itemnya (bentuk satu pajak lama)
     * @param  bool  $writesDppColumns  false untuk item Quotation/Sales Order/Purchase Order (`OrderTaxApplier`): tabel itemnya tidak punya `dpp_amount`/`withholding_amount` (nilai itu hanya ada di pivot) dan `discount_amount` ditulis hanya bila kolomnya ada
     * @return array{net: float, dpp: float, tax: float, withholding: float} total dokumen: Σ basis bersih, Σ dpp, Σ pajak penambah, Σ pajak potong
     */
    public function apply(Collection $items, array $discounts, CarbonInterface $date, int $minorUnit, bool $hasAmountColumn, array $itemTaxIds = [], bool $writesDppColumns = true): array {
        $items = $items->values();

        $selected = [];
        $inputs   = [];
        foreach ($items as $index => $item) {
            $key = (string) $item->getKey();
            $ids = $itemTaxIds[$key] ?? (blank($item->tax_id) ? [] : [(string) $item->tax_id]);
            $net = (float) $item->basic_amount - ($discounts[$index] ?? 0.0);

            $selected[$key] = array_values($ids);
            foreach ($selected[$key] as $taxId) {
                $inputs[] = new TaxInput($taxId, $net, $date, $minorUnit, InvoiceItemTaxLines::refFor($key, $taxId));
            }
        }

        $components = [];
        if ($inputs !== []) {
            foreach ($this->engine->calculateDocument($inputs)->components as $component) {
                $components[(string) $component->lineRef] = $component;
            }
        }

        $totals = ['net' => 0.0, 'dpp' => 0.0, 'tax' => 0.0, 'withholding' => 0.0];
        foreach ($items as $index => $item) {
            $key      = (string) $item->getKey();
            $discount = $discounts[$index] ?? 0.0;
            $net      = (float) $item->basic_amount - $discount;

            $taxAmount   = 0.0;
            $withholding = 0.0;
            $ordered     = [];
            foreach ($selected[$key] as $position => $taxId) {
                $component = $components[InvoiceItemTaxLines::refFor($key, $taxId)] ?? null;
                if ($component === null) {
                    continue;
                }

                $computed = (float) $component->taxAmount;
                $withheld = $component->behavior === Tax::BEHAVIOR_WITHHOLDING;

                $ordered[$position] = [
                    'component'   => $component,
                    'tax_amount'  => $withheld ? 0.0 : $computed,
                    'withholding' => $withheld ? $computed : 0.0,
                ];
                $taxAmount += $ordered[$position]['tax_amount'];
                $withholding += $ordered[$position]['withholding'];
            }

            $dpp = $this->aggregateDpp($ordered);

            $attributes = [
                'discount_amount'    => $discount,
                'dpp_amount'         => $dpp,
                'tax_amount'         => $taxAmount,
                'withholding_amount' => $withholding,
            ];
            if (! $writesDppColumns) {
                unset($attributes['dpp_amount'], $attributes['withholding_amount']);
                if (! array_key_exists('discount_amount', $item->getAttributes())) {
                    unset($attributes['discount_amount']);
                }
            }
            if ($hasAmountColumn) {
                $attributes['amount'] = round($net + $taxAmount, self::AMOUNT_PRECISION);
            }

            $this->syncTaxLines($item, $ordered);
            if (method_exists($item, 'markAmountsComputed')) {
                $item->markAmountsComputed();
            }
            $item->forceFill($attributes)->save();

            $totals['net'] += $net;
            $totals['dpp'] += $dpp;
            $totals['tax'] += $taxAmount;
            $totals['withholding'] += $withholding;
        }

        return $totals;
    }

    /**
     * DPP agregat item (Q-MT-7): komponen berkategori PPN pertama; bila tak ada, komponen penambah pertama; bila tak
     * ada, komponen pertama menurut urutan pilihan. 0 bila item tanpa komponen.
     *
     * @param  array<int, array{component: TaxComponent, tax_amount: float, withholding: float}>  $ordered
     */
    private function aggregateDpp(array $ordered): float {
        if ($ordered === []) {
            return 0.0;
        }

        ksort($ordered);
        foreach ($ordered as $row) {
            if (\in_array($row['component']->category, Tax::PPN_CATEGORIES, true)) {
                return (float) $row['component']->dppAmount;
            }
        }
        foreach ($ordered as $row) {
            if ($row['component']->behavior !== Tax::BEHAVIOR_WITHHOLDING) {
                return (float) $row['component']->dppAmount;
            }
        }

        return (float) reset($ordered)['component']->dppAmount;
    }

    /**
     * Faktor DPP numerik dari label komponen (`11/12`, `1/1`); label tanpa penyebut dianggap bilangan apa adanya.
     */
    private static function factorOf(string $label): float {
        [$numerator, $denominator] = array_pad(explode('/', $label, 2), 2, '1');

        return (float) $numerator / max(1.0, (float) $denominator);
    }

    /**
     * Menulis baris pivot item sesuai pajak terpilih dan menghapus baris yang tak lagi dipilih.
     *
     * @param  array<int, array{component: TaxComponent, tax_amount: float, withholding: float}>  $ordered
     */
    private function syncTaxLines(Model $item, array $ordered): void {
        $keep = [];

        foreach ($ordered as $position => $row) {
            $component = $row['component'];
            $keep[]    = $component->taxId;

            $item->taxLines()->updateOrCreate(['tax_id' => $component->taxId], [
                'tax_rule_version_id' => $component->ruleVersionId,
                'position'            => $position,
                'tax_rate'            => (float) $component->rate,
                'dpp_factor'          => self::factorOf($component->dppFactor),
                'base_amount'         => (float) $component->baseAmount,
                'dpp_amount'          => (float) $component->dppAmount,
                'tax_amount'          => $row['tax_amount'],
                'withholding_amount'  => $row['withholding'],
            ]);
        }

        $item->taxLines()->whereNotIn('tax_id', $keep)->delete();
        $item->unsetRelation('taxLines');
    }
}
