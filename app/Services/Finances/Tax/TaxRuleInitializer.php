<?php

namespace App\Services\Finances\Tax;

use App\Models\Finances\Tax;
use App\Models\Finances\TaxRuleVersion;
use Throwable;

/**
 * Backfill versi aturan awal untuk pajak yang sudah ada (Finance Fase 3, Requirement 6.1-6.3), logika di balik
 * `finance:init-tax-rules`. Setiap pajak (termasuk yang terhapus lunak, karena dokumen lama masih merujuknya) yang
 * belum punya versi apa pun mendapat versi 1 lewat `TaxRuleVersionService::createInitialVersion()`.
 *
 * Idempoten: pajak yang sudah punya versi berstatus apa pun dilewati, dan tidak ada versi yang pernah ditimpa
 * (Requirement 6.2). Laporan "mencurigakan" hanya menandai, tidak mengubah data (Requirement 6.3).
 *
 * Hanya mengenal pajak dan versi aturan; tidak menyentuh dokumen (P-9).
 */
final class TaxRuleInitializer {
    /** Faktor DPP yang diwariskan kolom generated invoice, dipakai untuk menghitung tarif efektif. */
    private const LEGACY_FACTOR = TaxRuleVersion::LEGACY_DPP_NUMERATOR / TaxRuleVersion::LEGACY_DPP_DENOMINATOR;

    /** Toleransi bilangan bulat untuk heuristik tarif efektif (persen). */
    private const WHOLE_PERCENT_TOLERANCE = 0.0001;

    public function __construct(private readonly TaxRuleVersionService $versions) {}

    /**
     * Memilah seluruh pajak: yang akan dibuatkan versi 1, yang dilewati (sudah punya versi), dan yang tidak dapat
     * dibackfill karena tarifnya di luar 0-100 (harus dibetulkan manual lebih dulu).
     *
     * @return array{create: list<array{tax: Tax, effective_rate: float, suspicious: bool}>, skipped: list<Tax>, invalid: list<Tax>}
     */
    public function analyze(): array {
        $taxes = Tax::query()->withTrashed()->orderBy('name')->orderBy('id')->get();

        $withVersions = TaxRuleVersion::query()->distinct()->pluck('tax_id')->flip();

        $create  = [];
        $skipped = [];
        $invalid = [];
        foreach ($taxes as $tax) {
            if ($withVersions->has($tax->getKey())) {
                $skipped[] = $tax;

                continue;
            }

            $rate = (float) $tax->rate;
            if ($rate < 0 || $rate > 100) {
                $invalid[] = $tax;

                continue;
            }

            $effective = $rate * self::LEGACY_FACTOR;
            $create[]  = [
                'tax'            => $tax,
                'effective_rate' => round($effective, 4),
                'suspicious'     => abs($effective - round($effective)) > self::WHOLE_PERCENT_TOLERANCE,
            ];
        }

        return ['create' => $create, 'skipped' => $skipped, 'invalid' => $invalid];
    }

    /**
     * Membuat versi 1 untuk setiap pajak pada laporan. Pajak yang ternyata sudah punya versi saat dikerjakan
     * (proses lain berjalan bersamaan) dilewati, bukan digandakan.
     *
     * @param  array{create: list<array{tax: Tax, effective_rate: float, suspicious: bool}>, skipped: list<Tax>, invalid: list<Tax>}  $report
     * @return array{created: list<TaxRuleVersion>, failed: list<array{tax: Tax, message: string}>}
     */
    public function apply(array $report): array {
        $created = [];
        $failed  = [];

        foreach ($report['create'] as $row) {
            $tax = $row['tax'];

            if (TaxRuleVersion::query()->where('tax_id', $tax->getKey())->exists()) {
                continue;
            }

            try {
                $created[] = $this->versions->createInitialVersion($tax);
            } catch (Throwable $e) {
                $failed[] = ['tax' => $tax, 'message' => $e->getMessage()];
            }
        }

        return ['created' => $created, 'failed' => $failed];
    }
}
