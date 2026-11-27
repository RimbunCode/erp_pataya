<?php

namespace App\Services\Finances\Accounting;

use App\Models\Finances\Tax;
use App\Models\Finances\TaxRuleVersion;
use App\Services\Finances\Posting\Contexts\TaxComponentLine;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Log;

/**
 * Menyusun `TaxComponentLine` dari NILAI TERSIMPAN item invoice (Finance Fase 3, Task 6.2; Requirement 7.1-7.3, 7.9).
 * Dipakai pabrik konteks Sales Invoice dan Purchase Invoice. Item dikelompokkan per (pajak, versi aturan); jumlah
 * komponen = Σ `tax_amount` tersimpan (tidak dihitung ulang, sehingga Σ pajak jurnal = Σ tersimpan), dan `lineShares`
 * memuat `tax_amount` per item agar baris pendapatan/beban dapat dikurangi tepat.
 *
 * `classified` = kategori bukan `unclassified` dan `behavior = additive` (P-6: tidak menebak klasifikasi).
 * `isCreditable` = `taxes.is_creditable` DAN PKP untuk pembelian; selalu true untuk penjualan. Peran dari versi aturan
 * (`output_role` untuk penjualan, `input_role` untuk pembelian); item tanpa versi (legacy) membentuk komponen tanpa
 * `ruleVersionId` sehingga tidak dipisah.
 */
final class InvoiceTaxComponentsBuilder {
    /**
     * @param  iterable<Model>  $items  baris invoice (atribut `tax_id`, `tax_rule_version_id`, `tax_amount`)
     * @param  bool  $purchase  true untuk Purchase Invoice (peran `input_role`, kreditabilitas PKP)
     * @return list<TaxComponentLine>
     */
    public function build(iterable $items, bool $purchase, bool $companyIsPkp): array {
        $groups = [];
        foreach ($items as $item) {
            if (blank($item->tax_id)) {
                continue;
            }

            $taxId     = (string) $item->tax_id;
            $versionId = blank($item->tax_rule_version_id) ? null : (string) $item->tax_rule_version_id;
            $key       = $taxId . '|' . ($versionId ?? '');

            $groups[$key] ??= ['tax_id' => $taxId, 'version_id' => $versionId, 'amount' => 0.0, 'shares' => []];
            $share = (float) $item->tax_amount;
            $groups[$key]['amount'] += $share;
            $groups[$key]['shares'][(string) $item->getKey()] = $share;
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
