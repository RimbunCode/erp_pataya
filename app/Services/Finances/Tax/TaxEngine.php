<?php

namespace App\Services\Finances\Tax;

use App\Exceptions\Finances\InvalidTaxRuleVersionException;
use App\Exceptions\Finances\NoEffectiveTaxRuleException;
use App\Models\Finances\Tax;
use App\Models\Finances\TaxRuleVersion;
use App\Services\Finances\Ledger\MinorUnit;
use InvalidArgumentException;
use RangeException;

/**
 * Tax Engine (Finance Fase 3, Requirement 4): menghitung pajak per baris berdasarkan versi aturan yang berlaku pada
 * tanggal dokumen, dan menjelaskan hasilnya.
 *
 * Perhitungan: `dpp = basis × pembilang/penyebut`; `pajak = dpp × tarif/100`; pembulatan HALF_UP ke minor unit
 * mata uang dokumen (Q-P3-7), per baris (`per_line`) atau sekali per versi di akhir dokumen dengan selisih dibebankan pada baris
 * terbesar (`per_document`), sehingga jumlah komponen = jumlah dokumen (Requirement 4.3).
 *
 * Aritmetika memakai bilangan bulat minor unit dengan faktor sebagai rasio bilangan bulat (tarif dikali 10^4,
 * `decimal(9,4)`): tidak ada perkalian `float` yang memengaruhi nilai akhir. Pecahan direduksi dengan gcd sebelum
 * dikalikan agar rentang nilai yang didukung tetap besar; di luar rentang, `RangeException` dilempar (bukan hasil
 * salah diam-diam).
 *
 * Murni selain pemanggilan resolver (dan pembacaan master `Tax` untuk komponen legacy); tidak mengenal akun dan
 * tidak memanggil model Sales/Purchase/Inventory (Requirement 4.4-4.5, P-9).
 */
final class TaxEngine {
    private const RATE_SCALE                = 10_000;
    private const PERCENT_DIVISOR           = 100;
    private const OVERFLOW_HEADROOM         = 4;
    public const WARNING_PERSISTED_MISMATCH = 'persisted_vs_engine_mismatch';

    public function __construct(private readonly TaxRuleResolver $resolver) {}

    /**
     * Satu baris (Requirement 4.1): `TaxResult` dokumen satu baris. Versi di-resolve pada `$input->date`.
     *
     * @throws NoEffectiveTaxRuleException
     */
    public function calculate(TaxInput $input): TaxResult {
        return $this->calculateDocument([$input]);
    }

    /**
     * Seluruh baris dokumen: komponen per baris, ditambah total dan penjelasan.
     *
     * @param  list<TaxInput>  $inputs
     *
     * @throws NoEffectiveTaxRuleException
     */
    public function calculateDocument(array $inputs): TaxResult {
        $minorUnit = $this->commonMinorUnit($inputs);

        /** @var list<array{input: TaxInput, version: TaxRuleVersion, baseMinor: int, dppMinor: int, taxMinor: int, adjustment: int}> $lines */
        $lines = [];
        foreach ($inputs as $input) {
            $version = $this->resolver->resolve($input->taxId, $input->date);
            $lines[] = $this->computeLine($input, $version);
        }

        $this->applyDocumentRounding($lines);

        $components  = [];
        $explanation = [];
        foreach ($lines as $line) {
            $component    = $this->buildComponent($line, $minorUnit);
            $components[] = $component;
            array_push($explanation, ...$this->explainLine($line, $component, $minorUnit));
        }

        return $this->assemble($components, $explanation, $minorUnit);
    }

    /**
     * Menjelaskan nilai yang SUDAH tersimpan di dokumen (sebelum Bagian B kolom generated, sesudahnya hasil engine saat
     * simpan, menjadi sumber kebenaran). Komponen memuat nilai tersimpan apa adanya (dibulatkan ke minor unit); engine
     * hanya menghitung ulang dan menambah peringatan `persisted_vs_engine_mismatch` bila selisih per baris melebihi satu
     * minor unit. Untuk versi `per_document`, sisa pembulatan dokumen yang dibebankan pada baris terbesar ikut dihitung
     * (sama seperti `calculateDocument()`) dan dicatat pada `roundingAdjustment`, sehingga baris itu tidak salah
     * ditandai berbeda. Angka dokumen tidak pernah diubah (design.md, `tax_breakdown` pada approve).
     *
     * @param  list<TaxInput>  $inputs
     * @param  array<string, array{tax_rate: float|int|string, dpp_amount: float|int|string, tax_amount: float|int|string, rule_version_id?: string|null}>  $persisted  per `lineRef`
     */
    public function describePersisted(array $inputs, array $persisted): TaxResult {
        $minorUnit = $this->commonMinorUnit($inputs);

        $adjustments = $this->persistedRoundingAdjustments($inputs, $persisted);

        $components  = [];
        $explanation = [];
        foreach ($inputs as $input) {
            $ref = $input->lineRef ?? throw new InvalidArgumentException('describePersisted() requires a lineRef on every input.');
            $row = $persisted[$ref] ?? throw new InvalidArgumentException("No persisted values for line {$ref}.");

            $line         = $this->persistedLine($input, $row, $minorUnit, $adjustments[$ref] ?? 0);
            $components[] = $line['component'];
            array_push($explanation, ...$line['explanation']);
        }

        return $this->assemble($components, $explanation, $minorUnit);
    }

    /**
     * Menghitung ulang dari versi yang di-snapshot dan membandingkan dengan angka di snapshot (Requirement 4.6).
     * Komponen legacy (tanpa versi) atau yang versinya tidak lagi tersedia dilewati dan dilaporkan.
     *
     * @throws \JsonException
     */
    public function verify(TaxResult|string $result): VerificationReport {
        $result    = \is_string($result) ? TaxResult::fromJson($result) : $result;
        $minorUnit = $result->minorUnit;

        $differences = [];
        $skipped     = [];
        $verified    = 0;

        foreach ($result->components as $component) {
            if ($component->isLegacy()) {
                $skipped[] = ['line_ref' => $component->lineRef, 'tax_id' => $component->taxId, 'reason' => 'legacy'];

                continue;
            }

            $version = $this->resolver->findVersion($component->ruleVersionId);
            if ($version === null) {
                $skipped[] = ['line_ref' => $component->lineRef, 'tax_id' => $component->taxId, 'reason' => 'version_unavailable'];

                continue;
            }

            $verified++;
            $baseMinor = MinorUnit::toMinor($component->baseAmount, $minorUnit);
            $expected  = $this->compute($baseMinor, (int) $version->dpp_numerator, (int) $version->dpp_denominator, $this->scaledRate($version->rate));

            $snapshotDpp = MinorUnit::toMinor($component->dppAmount, $minorUnit);
            $snapshotTax = MinorUnit::toMinor($component->taxAmount, $minorUnit);
            // Selisih pembulatan `per_document` sengaja dibebankan pada baris terbesar: tidak dihitung sebagai salah.
            $taxTolerance = 1 + abs(MinorUnit::toMinor($component->roundingAdjustment, $minorUnit));

            foreach ([
                ['dpp_amount', $snapshotDpp, $expected['dpp'], 1],
                ['tax_amount', $snapshotTax, $expected['tax'], $taxTolerance],
            ] as [$field, $snapshot, $recomputed, $tolerance]) {
                if (abs($snapshot - $recomputed) > $tolerance) {
                    $differences[] = [
                        'line_ref'         => $component->lineRef,
                        'tax_id'           => $component->taxId,
                        'field'            => $field,
                        'snapshot'         => MinorUnit::fromMinor($snapshot, $minorUnit),
                        'recomputed'       => MinorUnit::fromMinor($recomputed, $minorUnit),
                        'difference_minor' => $snapshot - $recomputed,
                    ];
                }
            }
        }

        return new VerificationReport($differences === [], $differences, $skipped, $verified);
    }

    /**
     * @return array{input: TaxInput, version: TaxRuleVersion, baseMinor: int, dppMinor: int, taxMinor: int, adjustment: int}
     */
    private function computeLine(TaxInput $input, TaxRuleVersion $version): array {
        $baseMinor = MinorUnit::toMinor($input->baseAmount, $input->minorUnit);
        $computed  = $this->compute($baseMinor, (int) $version->dpp_numerator, (int) $version->dpp_denominator, $this->scaledRate($version->rate));

        return [
            'input'      => $input,
            'version'    => $version,
            'baseMinor'  => $baseMinor,
            'dppMinor'   => $computed['dpp'],
            'taxMinor'   => $computed['tax'],
            'adjustment' => 0,
        ];
    }

    /**
     * Inti hitung: bilangan bulat minor unit masuk, bilangan bulat minor unit keluar.
     *
     * @return array{dpp: int, tax: int}
     */
    private function compute(int $baseMinor, int $numerator, int $denominator, int $scaledRate): array {
        if ($numerator < 1 || $denominator < 1) {
            throw InvalidTaxRuleVersionException::invalidDppFactor();
        }

        return [
            'dpp' => $this->mulDiv($baseMinor, $numerator, $denominator),
            // pajak = basis × n/d × (tarif×10^4)/(10^4 × 100); tarif dikali 10^4 menjaga bilangan bulat.
            'tax' => $this->mulDiv($baseMinor, $numerator * $scaledRate, $denominator * self::RATE_SCALE * self::PERCENT_DIVISOR),
        ];
    }

    /**
     * Pembulatan `per_document`: jumlahkan basis per versi, bulatkan sekali, dan bebankan selisih terhadap jumlah
     * pembulatan per baris pada baris dengan basis terbesar (baris pertama bila sama).
     *
     * @param  list<array{input: TaxInput, version: TaxRuleVersion, baseMinor: int, dppMinor: int, taxMinor: int, adjustment: int}>  $lines
     */
    private function applyDocumentRounding(array &$lines): void {
        $groups = [];
        foreach ($lines as $index => $line) {
            if ($line['version']->rounding_mode === TaxRuleVersion::ROUNDING_PER_DOCUMENT) {
                $groups[$line['version']->getKey()][] = $index;
            }
        }

        foreach ($groups as $indexes) {
            $version  = $lines[$indexes[0]]['version'];
            $baseSum  = array_sum(array_map(fn (int $i): int => $lines[$i]['baseMinor'], $indexes));
            $lineSum  = array_sum(array_map(fn (int $i): int => $lines[$i]['taxMinor'], $indexes));
            $exact    = $this->compute($baseSum, (int) $version->dpp_numerator, (int) $version->dpp_denominator, $this->scaledRate($version->rate))['tax'];
            $residual = $exact - $lineSum;
            if ($residual === 0) {
                continue;
            }

            $largest = $indexes[0];
            foreach ($indexes as $i) {
                if (abs($lines[$i]['baseMinor']) > abs($lines[$largest]['baseMinor'])) {
                    $largest = $i;
                }
            }

            $lines[$largest]['taxMinor'] += $residual;
            $lines[$largest]['adjustment'] += $residual;
        }
    }

    /**
     * @param  array{input: TaxInput, version: TaxRuleVersion, baseMinor: int, dppMinor: int, taxMinor: int, adjustment: int}  $line
     */
    private function buildComponent(array $line, int $minorUnit): TaxComponent {
        $version = $line['version'];
        $tax     = $this->taxOf($version);

        return new TaxComponent(
            taxId: (string) $tax->getKey(),
            taxName: (string) $tax->name,
            category: (string) $tax->category,
            behavior: (string) $tax->behavior,
            ruleVersionId: (string) $version->getKey(),
            baseAmount: MinorUnit::fromMinor($line['baseMinor'], $minorUnit),
            dppFactor: $version->dppFactorLabel(),
            dppAmount: MinorUnit::fromMinor($line['dppMinor'], $minorUnit),
            rate: $this->rateLabel($version->rate),
            taxAmount: MinorUnit::fromMinor($line['taxMinor'], $minorUnit),
            roleOutput: (string) $version->output_role,
            roleInput: (string) $version->input_role,
            isCreditable: (bool) $tax->is_creditable,
            roundingAdjustment: MinorUnit::fromMinor($line['adjustment'], $minorUnit),
            lineRef: $line['input']->lineRef,
        );
    }

    /**
     * Sisa pembulatan `per_document` per `lineRef` untuk baris yang versinya ditemukan, dihitung seperti
     * `calculateDocument()` (hanya versi `per_document` yang punya sisa).
     *
     * @param  list<TaxInput>  $inputs
     * @param  array<string, array{rule_version_id?: string|null}>  $persisted
     * @return array<string, int> minor unit
     */
    private function persistedRoundingAdjustments(array $inputs, array $persisted): array {
        $lines = [];
        foreach ($inputs as $input) {
            $versionId = $persisted[(string) $input->lineRef]['rule_version_id'] ?? null;
            $version   = $versionId === null ? null : $this->resolver->findVersion($versionId);
            if ($version !== null && $version->rounding_mode === TaxRuleVersion::ROUNDING_PER_DOCUMENT) {
                $lines[] = $this->computeLine($input, $version);
            }
        }

        if ($lines === []) {
            return [];
        }

        $this->applyDocumentRounding($lines);

        $adjustments = [];
        foreach ($lines as $line) {
            if ($line['adjustment'] !== 0) {
                $adjustments[(string) $line['input']->lineRef] = $line['adjustment'];
            }
        }

        return $adjustments;
    }

    /**
     * Komponen dari nilai tersimpan, dengan peringatan bila engine berbeda lebih dari satu minor unit per baris.
     *
     * @param  array{tax_rate: float|int|string, dpp_amount: float|int|string, tax_amount: float|int|string, rule_version_id?: string|null}  $row
     * @return array{component: TaxComponent, explanation: list<array<string, mixed>>}
     */
    private function persistedLine(TaxInput $input, array $row, int $minorUnit, int $adjustment = 0): array {
        $versionId = $row['rule_version_id'] ?? null;
        $version   = $versionId === null ? null : $this->resolver->findVersion($versionId);
        $tax       = $version !== null ? $this->taxOf($version) : $this->legacyTax($input->taxId);

        $numerator   = $version !== null ? (int) $version->dpp_numerator : TaxRuleVersion::LEGACY_DPP_NUMERATOR;
        $denominator = $version !== null ? (int) $version->dpp_denominator : TaxRuleVersion::LEGACY_DPP_DENOMINATOR;
        $scaledRate  = $this->scaledRate($row['tax_rate']);

        $baseMinor = MinorUnit::toMinor($input->baseAmount, $minorUnit);
        $expected  = $this->compute($baseMinor, $numerator, $denominator, $scaledRate);
        $expected['tax'] += $adjustment;
        $storedDpp = MinorUnit::toMinor($row['dpp_amount'], $minorUnit);
        $storedTax = MinorUnit::toMinor($row['tax_amount'], $minorUnit);
        $mismatch  = abs($storedDpp - $expected['dpp']) > 1 || abs($storedTax - $expected['tax']) > 1;
        $legacy    = $version === null;

        $component = new TaxComponent(
            taxId: (string) $tax->getKey(),
            taxName: (string) $tax->name,
            category: (string) $tax->category,
            behavior: (string) $tax->behavior,
            ruleVersionId: $version === null ? null : (string) $version->getKey(),
            baseAmount: MinorUnit::fromMinor($baseMinor, $minorUnit),
            dppFactor: $numerator . '/' . $denominator,
            dppAmount: MinorUnit::fromMinor($storedDpp, $minorUnit),
            rate: $this->rateLabel($row['tax_rate']),
            taxAmount: MinorUnit::fromMinor($storedTax, $minorUnit),
            roleOutput: $version !== null ? (string) $version->output_role : TaxRuleVersion::DEFAULT_OUTPUT_ROLE,
            roleInput: $version !== null ? (string) $version->input_role : TaxRuleVersion::DEFAULT_INPUT_ROLE,
            isCreditable: (bool) $tax->is_creditable,
            roundingAdjustment: MinorUnit::fromMinor($adjustment, $minorUnit),
            warnings: $mismatch ? [self::WARNING_PERSISTED_MISMATCH] : [],
            lineRef: $input->lineRef,
        );

        $explanation = [
            [
                'key'        => $legacy ? 'rule_legacy' : 'rule_applied',
                'line_ref'   => $input->lineRef,
                'tax'        => $tax->name,
                'version_id' => $component->ruleVersionId,
                'rate'       => $component->rate,
                'dpp_factor' => $component->dppFactor,
            ],
            ['key' => 'dpp_computed', 'line_ref' => $input->lineRef, 'base' => $component->baseAmount, 'dpp_factor' => $component->dppFactor, 'dpp' => $component->dppAmount],
            ['key' => 'tax_computed', 'line_ref' => $input->lineRef, 'dpp' => $component->dppAmount, 'rate' => $component->rate, 'tax' => $component->taxAmount],
        ];
        if ($mismatch) {
            $explanation[] = [
                'key'        => 'persisted_mismatch',
                'line_ref'   => $input->lineRef,
                'stored_tax' => $component->taxAmount,
                'engine_tax' => MinorUnit::fromMinor($expected['tax'], $minorUnit),
            ];
        }

        return ['component' => $component, 'explanation' => $explanation];
    }

    /**
     * @param  array{input: TaxInput, version: TaxRuleVersion, baseMinor: int, dppMinor: int, taxMinor: int, adjustment: int}  $line
     * @return list<array<string, mixed>>
     */
    private function explainLine(array $line, TaxComponent $component, int $minorUnit): array {
        $version = $line['version'];

        $steps = [
            [
                'key'            => 'rule_applied',
                'line_ref'       => $component->lineRef,
                'tax'            => $component->taxName,
                'version'        => $version->version,
                'version_id'     => $component->ruleVersionId,
                'effective_from' => $version->effective_from?->toDateString(),
                'rate'           => $component->rate,
                'dpp_factor'     => $component->dppFactor,
                'rounding_mode'  => $version->rounding_mode,
            ],
            ['key' => 'dpp_computed', 'line_ref' => $component->lineRef, 'base' => $component->baseAmount, 'dpp_factor' => $component->dppFactor, 'dpp' => $component->dppAmount],
            ['key' => 'tax_computed', 'line_ref' => $component->lineRef, 'dpp' => $component->dppAmount, 'rate' => $component->rate, 'tax' => MinorUnit::fromMinor($line['taxMinor'] - $line['adjustment'], $minorUnit)],
        ];

        if ($line['adjustment'] !== 0) {
            $steps[] = [
                'key'        => 'rounding_adjusted',
                'line_ref'   => $component->lineRef,
                'mode'       => $version->rounding_mode,
                'adjustment' => $component->roundingAdjustment,
                'tax'        => $component->taxAmount,
            ];
        }

        return $steps;
    }

    /**
     * @param  list<TaxComponent>  $components
     * @param  list<array<string, mixed>>  $explanation
     */
    private function assemble(array $components, array $explanation, int $minorUnit): TaxResult {
        $additive    = 0;
        $withholding = 0;
        foreach ($components as $component) {
            $minor = MinorUnit::toMinor($component->taxAmount, $minorUnit);
            if ($component->behavior === Tax::BEHAVIOR_WITHHOLDING) {
                $withholding += $minor;
            } else {
                $additive += $minor;
            }
        }

        $totalAdditive    = MinorUnit::fromMinor($additive, $minorUnit);
        $totalWithholding = MinorUnit::fromMinor($withholding, $minorUnit);

        $explanation[] = ['key' => 'totals', 'total_additive' => $totalAdditive, 'total_withholding' => $totalWithholding];

        return new TaxResult($components, $totalAdditive, $totalWithholding, $explanation, $minorUnit);
    }

    /**
     * @param  list<TaxInput>  $inputs
     */
    private function commonMinorUnit(array $inputs): int {
        if ($inputs === []) {
            return 2;
        }

        $minorUnit = $inputs[0]->minorUnit;
        foreach ($inputs as $input) {
            if ($input->minorUnit !== $minorUnit) {
                throw new InvalidArgumentException('All tax inputs of one document must share the document currency minor unit.');
            }
        }

        return $minorUnit;
    }

    /**
     * Versi dari resolver selalu memuat pajak induknya (termasuk yang terhapus lunak).
     */
    private function taxOf(TaxRuleVersion $version): Tax {
        return $version->tax ?? $this->resolver->findTax((string) $version->tax_id) ?? throw InvalidTaxRuleVersionException::unknownTax();
    }

    private function legacyTax(string $taxId): Tax {
        return $this->resolver->findTax($taxId) ?? throw InvalidTaxRuleVersionException::unknownTax();
    }

    private function scaledRate(float|int|string $rate): int {
        if (! is_numeric($rate)) {
            throw InvalidTaxRuleVersionException::invalidRate();
        }

        return (int) round((float) $rate * self::RATE_SCALE);
    }

    private function rateLabel(float|int|string $rate): string {
        return number_format((float) $rate, 4, '.', '');
    }

    /**
     * `round(nilai × mul ÷ div)` HALF_UP (menjauhi nol) dengan bilangan bulat. Pecahan direduksi dengan gcd; hasil
     * perkalian di luar rentang aman ditolak.
     *
     * @throws RangeException
     */
    private function mulDiv(int $value, int $mul, int $div): int {
        if ($value === 0 || $mul === 0) {
            return 0;
        }

        $gcd = $this->gcd($mul, $div);
        $mul = intdiv($mul, $gcd);
        $div = intdiv($div, $gcd);

        if (abs($value) > intdiv(intdiv(PHP_INT_MAX, self::OVERFLOW_HEADROOM), $mul)) {
            throw new RangeException('Tax base is outside the supported range.');
        }

        $numerator = abs($value) * $mul;
        $quotient  = intdiv(2 * $numerator + $div, 2 * $div);

        return $value < 0 ? -$quotient : $quotient;
    }

    private function gcd(int $a, int $b): int {
        while ($b !== 0) {
            [$a, $b] = [$b, $a % $b];
        }

        return abs($a) ?: 1;
    }
}
