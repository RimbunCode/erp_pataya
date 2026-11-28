<?php

namespace App\Services\Finances\Accounting;

use App\Enums\AccountRole;
use App\Models\Finances\Tax;
use App\Models\Finances\TaxRuleVersion;
use App\Services\Finances\Posting\Contexts\TaxComponentLine;
use App\Services\Finances\Tax\InvoiceItemTaxLines;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Log;

/**
 * Menyusun `TaxComponentLine` dari NILAI TERSIMPAN item invoice (Finance Fase 3, Task 6.2; Requirement 7.1-7.3, 7.9).
 * Dipakai pabrik konteks Sales Invoice dan Purchase Invoice. Sumber: baris pajak item (pivot `taxLines`, pajak
 * majemuk per item, spek finance-multi-tax-per-item Requirement 5.1), dikelompokkan per (pajak, versi aturan); jumlah
 * komponen = Σ `tax_amount` pivot tersimpan (tidak dihitung ulang, sehingga Σ pajak jurnal = Σ pivot = Σ agregat
 * item), dan `lineShares` memuat `tax_amount` pivot per item agar baris pendapatan/beban dapat dikurangi tepat. Item
 * ber-`tax_id` tanpa pivot dibaca sebagai satu pajak dari kolom item (`InvoiceItemTaxLines`, jaring pengaman baca).
 *
 * `classified` = kategori bukan `unclassified` dan `behavior = additive` (P-6: tidak menebak klasifikasi).
 * `isCreditable` = `taxes.is_creditable` DAN PKP untuk pembelian; selalu true untuk penjualan. Peran dari versi aturan
 * (`output_role` untuk penjualan, `input_role` untuk pembelian); item tanpa versi (legacy) membentuk komponen tanpa
 * `ruleVersionId` sehingga tidak dipisah.
 */
final class InvoiceTaxComponentsBuilder {
    /**
     * @param  iterable<Model>  $items  baris invoice (relasi `taxLines`; atau atribut `tax_id`, `tax_rule_version_id`, `tax_amount`)
     * @param  bool  $purchase  true untuk Purchase Invoice (peran `input_role`, kreditabilitas PKP)
     * @return list<TaxComponentLine>
     */
    public function build(iterable $items, bool $purchase, bool $companyIsPkp): array {
        $groups = [];
        foreach ($items as $item) {
            foreach (InvoiceItemTaxLines::of($item) as $line) {
                $taxId     = $line['tax_id'];
                $versionId = $line['tax_rule_version_id'];
                $key       = $taxId . '|' . ($versionId ?? '');

                $groups[$key] ??= ['tax_id' => $taxId, 'version_id' => $versionId, 'amount' => 0.0, 'shares' => []];
                $share = $line['tax_amount'];
                $groups[$key]['amount'] += $share;
                $groups[$key]['shares'][(string) $item->getKey()] = $share;
            }
        }

        if ($groups === []) {
            return [];
        }

        $taxes    = Tax::query()->withTrashed()->whereIn('id', array_unique(array_column($groups, 'tax_id')))->get()->keyBy('id');
        $versions = TaxRuleVersion::query()->whereIn('id', array_filter(array_unique(array_column($groups, 'version_id'))))->get()->keyBy('id');

        $components = [];
        foreach ($groups as $group) {
            $tax     = $taxes->get($group['tax_id']);
            $version = $group['version_id'] === null ? null : $versions->get($group['version_id']);
            $default = $purchase ? TaxRuleVersion::DEFAULT_INPUT_ROLE : TaxRuleVersion::DEFAULT_OUTPUT_ROLE;
            $role    = $version === null ? $default : ($purchase ? $version->input_role : $version->output_role);

            $components[] = new TaxComponentLine(
                ruleVersionId: $version?->getKey(),
                role: (string) ($role ?: $default),
                amount: round($group['amount'], 6),
                isCreditable: ! $purchase || ($tax !== null && (bool) $tax->is_creditable && $companyIsPkp),
                classified: $tax !== null && $tax->category !== Tax::CATEGORY_UNCLASSIFIED && $tax->behavior === Tax::BEHAVIOR_ADDITIVE,
                lineShares: $group['shares'],
                taxId: $group['tax_id'],
            );
        }

        return $components;
    }

    /**
     * Komponen pajak potong (`withholding`, Bagian B, Requirement 12.4): Σ `withholding_amount` tersimpan per (pajak,
     * versi). Peran tetap `withholding_receivable` (penjualan) atau `withholding_payable` (pembelian), D-12. Tidak
     * bergantung pada cutover pemisahan pajak: nilai itu SUDAH dikeluarkan dari `amount` dokumen, jadi jurnal harus
     * memotong `receivable`/`payable` sebesar itu agar seimbang.
     *
     * @param  iterable<Model>  $items  baris invoice (relasi `taxLines`; atau atribut `tax_id`, `tax_rule_version_id`, `withholding_amount`)
     * @return list<TaxComponentLine>
     */
    public function withholdingComponents(iterable $items, bool $purchase): array {
        $groups = [];
        foreach ($items as $item) {
            foreach (InvoiceItemTaxLines::of($item) as $line) {
                $amount = $line['withholding_amount'];
                if ($amount <= 0) {
                    continue;
                }

                $versionId = $line['tax_rule_version_id'];
                $key       = $line['tax_id'] . '|' . ($versionId ?? '');

                $groups[$key] ??= ['tax_id' => $line['tax_id'], 'version_id' => $versionId, 'amount' => 0.0];
                $groups[$key]['amount'] += $amount;
            }
        }

        $role = ($purchase ? AccountRole::WithholdingPayable : AccountRole::WithholdingReceivable)->value;

        return array_values(array_map(static fn (array $group): TaxComponentLine => new TaxComponentLine(
            ruleVersionId: $group['version_id'],
            role: $role,
            amount: round($group['amount'], 6),
            isCreditable: false,
            classified: false,
            taxId: $group['tax_id'],
            withholding: true,
        ), $groups));
    }

    /**
     * Mencatat komponen yang TIDAK dipisah pada dokumen pasca-cutover (`unsplit_tax`, Requirement 7.3) agar terlihat:
     * tetap tertanam di `revenue`/`expense` (bentuk lama).
     *
     * @param  list<TaxComponentLine>  $components
     */
    public function logUnsplit(array $components, bool $purchase, string $documentType, string $sourceId): void {
        foreach ($components as $component) {
            if ($component->amount > 0 && ! $component->isSplittable($purchase)) {
                Log::info('posting.unsplit_tax', [
                    'document_type'   => $documentType,
                    'source_id'       => $sourceId,
                    'tax_id'          => $component->taxId,
                    'rule_version_id' => $component->ruleVersionId,
                    'amount'          => $component->amount,
                    'reason'          => match (true) {
                        ! $component->classified           => 'unclassified_or_withholding',
                        $component->ruleVersionId === null => 'no_rule_version',
                        default                            => 'not_creditable',
                    },
                ]);
            }
        }
    }
}
