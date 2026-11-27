<?php

namespace App\Services\Finances\Tax;

use App\Models\Finances\Tax;
use App\Models\Finances\TaxRuleVersion;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Throwable;

/**
 * Data panel baca-saja "Rincian Pajak" pada halaman detail Sales/Purchase Invoice (Finance Fase 3, Requirement 5.5,
 * 5.6, 10.2). Seluruh angka berasal dari `tax_breakdown` tersimpan (atau dari nilai item tersimpan untuk invoice
 * tanpa snapshot); panel TIDAK menghitung pajak dan frontend hanya menampilkan. Tidak pernah menulis dan tidak
 * pernah melempar: kegagalan menjadi `state` `error`, bukan halaman 500.
 *
 * `state`:
 * - `snapshot`: invoice punya `tax_breakdown` (dibuat saat approve, immutable).
 * - `legacy`: invoice sudah di-approve tetapi tanpa snapshot (dibuat sebelum fase ini); penjelasan dibangun dari
 *   nilai item tersimpan lewat `DocumentTaxSnapshot` (komponen tanpa `rule_version_id` ditandai legacy).
 * - `pending`: invoice belum di-approve; baris memperlihatkan nilai item tersimpan, snapshot dibuat saat approve.
 * - `none`: tidak ada baris berpajak.
 * - `error`: penjelasan tidak dapat dibangun.
 *
 * Versi aturan yang dirujuk tetapi tidak ada (Requirement 5.6) ditandai `version.missing` dan tidak menimbulkan galat.
 * `canViewVersions` true hanya bila pembaca boleh membaca Pajak dan Versi Aturan (tautan ke halaman Pajak).
 *
 * @phpstan-type PanelRow array{line: int|null, tax_id: string, tax_name: string, category: string, behavior: string, base_amount: string, dpp_factor: string, dpp_amount: string, rate: string, tax_amount: string, rounding_adjustment: string, is_legacy: bool, warnings: list<string>, version: array{id: string, number: int|null, rounding_mode: string|null, missing: bool}|null}
 */
final class TaxBreakdownPanel {
    public function __construct(private readonly DocumentTaxSnapshot $snapshot) {}

    /**
     * @return array{state: string, warnings: list<string>, rows: list<PanelRow>, totals: array{additive: string, withholding: string}|null, minor_unit: int, can_view_versions: bool}
     */
    public function build(Model $document): array {
        try {
            // Dimuat segar (bukan `getRelationValue`): panel dibangun lewat deferred prop setelah respons halaman.
            $items   = $document->items()->get();
            $stored  = $document->getAttribute('tax_breakdown');
            $minor   = DocumentTaxSnapshot::minorUnitFor($document->getAttribute('currency_code'));
            $state   = 'snapshot';
            $payload = \is_array($stored) ? $stored : null;

            if ($payload === null) {
                $built = $this->snapshot->build($items, CarbonImmutable::parse($document->getAttribute('date')), $minor);
                if ($built === null) {
                    return $this->result('none', minorUnit: $minor);
                }
                $payload = $built->toArray();
                $state   = $document->getAttribute('submitted_at') === null ? 'pending' : 'legacy';
            }

            return $this->fromPayload($payload, $state, $items, $minor);
        } catch (Throwable $e) {
            report($e);

            return $this->result('error');
        }
    }

    /**
     * @param  array<string, mixed>  $payload  bentuk `TaxResult::toArray()`, ditambah `warnings` tingkat dokumen
     * @param  Collection<int, Model>  $items
     * @return array{state: string, warnings: list<string>, rows: list<PanelRow>, totals: array{additive: string, withholding: string}|null, minor_unit: int, can_view_versions: bool}
     */
    private function fromPayload(array $payload, string $state, Collection $items, int $fallbackMinor): array {
        $components  = array_values(array_filter((array) ($payload['components'] ?? []), 'is_array'));
        $lineNumbers = $items->values()->mapWithKeys(fn (Model $item, int $index): array => [(string) $item->getKey() => $index + 1])->all();
        $versionIds  = array_values(array_unique(array_filter(array_map(
            fn (array $component): ?string => isset($component['rule_version_id']) ? (string) $component['rule_version_id'] : null,
            $components,
        ))));
        $versions = $versionIds === [] ? collect() : TaxRuleVersion::query()->whereIn('id', $versionIds)->get()->keyBy('id');

        $rows = array_map(fn (array $component): array => $this->row($component, $lineNumbers, $versions), $components);

        return $this->result(
            $state,
            warnings: array_values(array_unique(array_map('strval', (array) ($payload['warnings'] ?? [])))),
            rows: $rows,
            totals: $rows === [] ? null : [
                'additive'    => (string) ($payload['total_additive'] ?? '0'),
                'withholding' => (string) ($payload['total_withholding'] ?? '0'),
            ],
            minorUnit: (int) ($payload['minor_unit'] ?? $fallbackMinor),
        );
    }

    /**
     * @param  array<string, mixed>  $component
     * @param  array<string, int>  $lineNumbers
     * @param  Collection<string, TaxRuleVersion>  $versions
     * @return PanelRow
     */
    private function row(array $component, array $lineNumbers, Collection $versions): array {
        $versionId = isset($component['rule_version_id']) ? (string) $component['rule_version_id'] : null;
        $version   = $versionId === null ? null : $versions->get($versionId);
        $ref       = isset($component['line_ref']) ? (string) $component['line_ref'] : null;

        return [
            'line'                => $ref === null ? null : ($lineNumbers[$ref] ?? null),
            'tax_id'              => (string) ($component['tax_id'] ?? ''),
            'tax_name'            => (string) ($component['tax_name'] ?? ''),
            'category'            => (string) ($component['category'] ?? Tax::CATEGORY_UNCLASSIFIED),
            'behavior'            => (string) ($component['behavior'] ?? Tax::BEHAVIOR_ADDITIVE),
            'base_amount'         => (string) ($component['base_amount'] ?? '0'),
            'dpp_factor'          => (string) ($component['dpp_factor'] ?? ''),
            'dpp_amount'          => (string) ($component['dpp_amount'] ?? '0'),
            'rate'                => (string) ($component['rate'] ?? '0'),
            'tax_amount'          => (string) ($component['tax_amount'] ?? '0'),
            'rounding_adjustment' => (string) ($component['rounding_adjustment'] ?? '0'),
            'is_legacy'           => $versionId === null,
            'warnings'            => array_values(array_map('strval', (array) ($component['warnings'] ?? []))),
            'version'             => $versionId === null ? null : [
                'id'            => $versionId,
                'number'        => $version?->version,
                'rounding_mode' => $version?->rounding_mode,
                'missing'       => $version === null,
            ],
        ];
    }

    /**
     * @param  list<string>  $warnings
     * @param  list<PanelRow>  $rows
     * @param  array{additive: string, withholding: string}|null  $totals
     * @return array{state: string, warnings: list<string>, rows: list<PanelRow>, totals: array{additive: string, withholding: string}|null, minor_unit: int, can_view_versions: bool}
     */
    private function result(string $state, array $warnings = [], array $rows = [], ?array $totals = null, int $minorUnit = 2): array {
        return [
            'state'             => $state,
            'warnings'          => $warnings,
            'rows'              => $rows,
            'totals'            => $totals,
            'minor_unit'        => $minorUnit,
            'can_view_versions' => $this->canViewVersions(),
        ];
    }

    private function canViewVersions(): bool {
        try {
            Tax::_checkPermission('read');
            TaxRuleVersion::_checkPermission('read');
        } catch (HttpException) {
            return false;
        }

        return true;
    }
}
