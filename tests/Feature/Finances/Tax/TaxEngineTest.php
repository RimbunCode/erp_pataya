<?php

namespace Tests\Feature\Finances\Tax;

use App\Exceptions\Finances\NoEffectiveTaxRuleException;
use App\Models\Finances\FinanceSetting;
use App\Models\Finances\Tax;
use App\Models\Finances\TaxRuleVersion;
use App\Services\Core\Setting\SettingsService;
use App\Services\Finances\Ledger\MinorUnit;
use App\Services\Finances\Tax\TaxComponent;
use App\Services\Finances\Tax\TaxEngine;
use App\Services\Finances\Tax\TaxInput;
use App\Services\Finances\Tax\TaxResult;
use App\Services\Finances\Tax\TaxRuleVersionService;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;
use RangeException;
use Tests\TestCase;

/**
 * Finance Fase 3, Task 4.4-4.5: perhitungan, pembulatan, penjelasan, dan verifikasi ulang Tax Engine. Perubahan tarif
 * dan faktor DPP cukup lewat data (versi baru), tanpa mengubah kode (P-4).
 */
class TaxEngineTest extends TestCase {
    use RefreshDatabase;

    private TaxEngine $engine;
    private TaxRuleVersionService $versions;

    protected function setUp(): void {
        parent::setUp();

        $this->engine   = app(TaxEngine::class);
        $this->versions = app(TaxRuleVersionService::class);
    }

    private function enableCalc(): void {
        app(SettingsService::class)->updateInternal(FinanceSetting::class, ['tax_engine_calc_enabled' => true]);
    }

    /**
     * @param  array<string, mixed>  $tax
     * @param  array<string, mixed>  $version
     */
    private function setUpTax(array $tax = [], array $version = []): Tax {
        $model = Tax::query()->create([
            'name'     => 'PPN 11%',
            'rate'     => 11,
            'category' => Tax::CATEGORY_PPN_STANDARD,
            ...$tax,
        ]);

        $this->versions->activate($this->versions->createDraft($model, [
            'effective_from'  => '2026-01-01',
            'rate'            => $model->rate,
            'dpp_numerator'   => 11,
            'dpp_denominator' => 12,
            ...$version,
        ]));

        return $model;
    }

    private function input(Tax $tax, float|string $base, string $date = '2026-03-01', ?string $ref = null, int $minorUnit = 2): TaxInput {
        return new TaxInput((string) $tax->getKey(), (string) $base, CarbonImmutable::parse($date), $minorUnit, $ref);
    }

    /**
     * `calculate()` mengembalikan `TaxResult` satu baris (Requirement 4.1); test mengambil komponen tunggalnya.
     */
    private function singleComponent(TaxInput $input): TaxComponent {
        $result = $this->engine->calculate($input);
        $this->assertCount(1, $result->components);

        return $result->components[0];
    }

    public function test_calculates_ppn_with_the_eleven_twelfths_base(): void {
        $tax = $this->setUpTax();

        $component = $this->singleComponent($this->input($tax, 1000000));

        $this->assertSame('1000000.00', $component->baseAmount);
        $this->assertSame('11/12', $component->dppFactor);
        $this->assertSame('916666.67', $component->dppAmount);
        $this->assertSame('11.0000', $component->rate);
        $this->assertSame('100833.33', $component->taxAmount, 'Pajak dari basis eksak, dibulatkan sekali.');
        $this->assertSame('tax_output', $component->roleOutput);
        $this->assertSame('tax_input', $component->roleInput);
        $this->assertFalse($component->isLegacy());
        $this->assertSame(Tax::CATEGORY_PPN_STANDARD, $component->category);
    }

    public function test_calculate_is_a_single_line_document(): void {
        $tax   = $this->setUpTax();
        $input = $this->input($tax, 1000000, ref: 'only');

        $single   = $this->engine->calculate($input);
        $document = $this->engine->calculateDocument([$input]);

        $this->assertInstanceOf(TaxResult::class, $single);
        $this->assertEquals($document, $single);
        $this->assertSame('100833.33', $single->totalAdditive);
    }

    public function test_a_new_version_changes_rate_and_factor_by_data_only(): void {
        $this->enableCalc();
        $tax = $this->setUpTax();
        $v1  = TaxRuleVersion::query()->where('tax_id', $tax->getKey())->firstOrFail();

        // Tanpa mengubah kode: versi baru 12% dengan DPP penuh berlaku mulai 2027-01-01.
        $this->versions->activate($this->versions->createNewVersion($v1, '2027-01-01', null, ['rate' => 12, 'dpp_numerator' => 1, 'dpp_denominator' => 1]));

        $before = $this->singleComponent($this->input($tax, 1000, '2026-12-31'));
        $after  = $this->singleComponent($this->input($tax, 1000, '2027-01-01'));

        $this->assertSame('100.83', $before->taxAmount, '1000 x 11/12 x 11% sebelum cutover.');
        $this->assertSame('120.00', $after->taxAmount);
        $this->assertSame('1/1', $after->dppFactor);
        $this->assertNotSame($before->ruleVersionId, $after->ruleVersionId);
    }

    public function test_an_uncovered_date_fails_closed(): void {
        $tax = $this->setUpTax();

        $this->expectException(NoEffectiveTaxRuleException::class);
        $this->singleComponent($this->input($tax, 1000, '2025-12-31'));
    }

    public function test_negative_bases_for_returns_round_symmetrically(): void {
        $this->enableCalc();
        $tax = $this->setUpTax(version: ['dpp_numerator' => 1, 'dpp_denominator' => 1, 'rate' => 10]);

        $positive = $this->singleComponent($this->input($tax, '10.05'));
        $negative = $this->singleComponent($this->input($tax, '-10.05'));

        $this->assertSame('1.01', $positive->taxAmount, '1,005 dibulatkan HALF_UP.');
        $this->assertSame('-1.01', $negative->taxAmount);
    }

    public function test_zero_decimal_currencies_round_to_whole_units(): void {
        $this->enableCalc();
        $tax = $this->setUpTax(version: ['dpp_numerator' => 1, 'dpp_denominator' => 1, 'rate' => 10]);

        $component = $this->singleComponent($this->input($tax, 1005, minorUnit: 0));

        $this->assertSame('1005', $component->baseAmount);
        $this->assertSame('101', $component->taxAmount, '100,5 dibulatkan HALF_UP menjadi 101.');
    }

    public function test_per_line_rounding_rounds_every_line_independently(): void {
        $this->enableCalc();
        $tax = $this->setUpTax(version: ['dpp_numerator' => 1, 'dpp_denominator' => 1, 'rate' => 11, 'rounding_mode' => TaxRuleVersion::ROUNDING_PER_LINE]);

        $result = $this->engine->calculateDocument([
            $this->input($tax, '0.05', ref: 'a'),
            $this->input($tax, '0.05', ref: 'b'),
            $this->input($tax, '0.05', ref: 'c'),
        ]);

        $this->assertSame('0.03', $result->totalAdditive, '3 x round(0,0055) = 3 x 0,01.');
        $this->assertSame(['0.01', '0.01', '0.01'], array_map(fn ($c) => $c->taxAmount, $result->components));
    }

    public function test_per_document_rounding_rounds_once_and_assigns_the_residual_to_the_largest_line(): void {
        $this->enableCalc();
        $tax = $this->setUpTax(version: ['dpp_numerator' => 1, 'dpp_denominator' => 1, 'rate' => 11, 'rounding_mode' => TaxRuleVersion::ROUNDING_PER_DOCUMENT]);

        $result = $this->engine->calculateDocument([
            $this->input($tax, '0.05', ref: 'a'),
            $this->input($tax, '0.05', ref: 'b'),
            $this->input($tax, '0.05', ref: 'c'),
        ]);

        $this->assertSame('0.02', $result->totalAdditive, 'round(0,15 x 11%) = 0,02, bukan 3 x 0,01.');

        $sum = array_sum(array_map(fn ($c) => MinorUnit::toMinor($c->taxAmount, 2), $result->components));
        $this->assertSame(MinorUnit::toMinor($result->totalAdditive, 2), $sum, 'Jumlah komponen = total dokumen (Requirement 4.3).');
        $this->assertSame('-0.01', $result->components[0]->roundingAdjustment, 'Selisih dibebankan pada baris terbesar (baris pertama bila sama).');
        $this->assertSame('0.00', $result->components[1]->roundingAdjustment);
        $this->assertContains('rounding_adjusted', array_column($result->explanation, 'key'));
    }

    public function test_per_document_residual_goes_to_the_line_with_the_largest_base(): void {
        $this->enableCalc();
        $tax = $this->setUpTax(version: ['dpp_numerator' => 1, 'dpp_denominator' => 1, 'rate' => 11, 'rounding_mode' => TaxRuleVersion::ROUNDING_PER_DOCUMENT]);

        $result = $this->engine->calculateDocument([
            $this->input($tax, '0.05', ref: 'small-1'),
            $this->input($tax, '0.05', ref: 'small-2'),
            $this->input($tax, '0.07', ref: 'largest'),
        ]);

        $adjusted = array_values(array_filter($result->components, fn ($c) => $c->roundingAdjustment !== '0.00'));
        $this->assertCount(1, $adjusted);
        $this->assertSame('largest', $adjusted[0]->lineRef);
    }

    public function test_withholding_taxes_are_totalled_separately(): void {
        $this->enableCalc();
        $ppn = $this->setUpTax(version: ['dpp_numerator' => 1, 'dpp_denominator' => 1, 'rate' => 11]);
        $pph = $this->setUpTax(
            ['name' => 'PPh 23', 'rate' => 2, 'category' => Tax::CATEGORY_PPH_23, 'behavior' => Tax::BEHAVIOR_WITHHOLDING],
            ['dpp_numerator' => 1, 'dpp_denominator' => 1, 'rate' => 2],
        );

        $result = $this->engine->calculateDocument([$this->input($ppn, 1000, ref: '1'), $this->input($pph, 1000, ref: '1')]);

        $this->assertSame('110.00', $result->totalAdditive);
        $this->assertSame('20.00', $result->totalWithholding);
    }

    public function test_every_input_of_a_document_must_share_the_minor_unit(): void {
        $tax = $this->setUpTax();

        $this->expectException(InvalidArgumentException::class);
        $this->engine->calculateDocument([$this->input($tax, 100), $this->input($tax, 100, minorUnit: 0)]);
    }

    public function test_an_empty_document_has_zero_totals(): void {
        $result = $this->engine->calculateDocument([]);

        $this->assertSame([], $result->components);
        $this->assertSame('0.00', $result->totalAdditive);
        $this->assertSame('0.00', $result->totalWithholding);
    }

    public function test_values_beyond_the_safe_range_are_rejected_instead_of_wrapping(): void {
        $this->enableCalc();
        $tax = $this->setUpTax(version: ['dpp_numerator' => 65535, 'dpp_denominator' => 1, 'rate' => 100]);

        $this->expectException(RangeException::class);
        $this->singleComponent($this->input($tax, '1000000000000'));
    }

    public function test_the_result_explains_every_step_and_totals(): void {
        $tax = $this->setUpTax();

        $result = $this->engine->calculateDocument([$this->input($tax, 1000000, ref: 'line-1')]);

        $keys = array_column($result->explanation, 'key');
        $this->assertSame(['rule_applied', 'dpp_computed', 'tax_computed', 'totals'], $keys);
        $this->assertSame('line-1', $result->explanation[0]['line_ref']);
        $this->assertSame('1', (string) $result->explanation[0]['version']);
        $this->assertSame('2026-01-01', $result->explanation[0]['effective_from']);
        $this->assertSame('916666.67', $result->explanation[1]['dpp']);
    }

    public function test_the_result_survives_a_json_round_trip(): void {
        $tax    = $this->setUpTax();
        $result = $this->engine->calculateDocument([$this->input($tax, 1000000, ref: 'line-1'), $this->input($tax, 250.5, ref: 'line-2')]);

        $restored = TaxResult::fromJson($result->toJson());

        $this->assertEquals($result, $restored);
    }

    public function test_verify_accepts_a_fresh_result(): void {
        $tax    = $this->setUpTax();
        $result = $this->engine->calculateDocument([$this->input($tax, 1000000, ref: 'a'), $this->input($tax, 333.33, ref: 'b')]);

        $report = $this->engine->verify($result->toJson());

        $this->assertTrue($report->passed);
        $this->assertSame([], $report->differences);
        $this->assertSame(2, $report->verifiedComponents);
    }

    public function test_verify_reports_a_tampered_snapshot(): void {
        $tax                                    = $this->setUpTax();
        $payload                                = $this->engine->calculateDocument([$this->input($tax, 1000000, ref: 'a')])->toArray();
        $payload['components'][0]['tax_amount'] = '100900.00';

        $report = $this->engine->verify(TaxResult::fromArray($payload));

        $this->assertFalse($report->passed);
        $this->assertSame('tax_amount', $report->differences[0]['field']);
        $this->assertSame('a', $report->differences[0]['line_ref']);
        $this->assertSame('100833.33', $report->differences[0]['recomputed']);
    }

    public function test_verify_uses_the_snapshotted_version_not_the_current_rule(): void {
        $this->enableCalc();
        $tax    = $this->setUpTax();
        $v1     = TaxRuleVersion::query()->where('tax_id', $tax->getKey())->firstOrFail();
        $result = $this->engine->calculateDocument([$this->input($tax, 1000000, '2026-03-01', 'a')]);

        $this->versions->activate($this->versions->createNewVersion($v1, '2026-07-01', null, ['rate' => 12]));

        $this->assertTrue($this->engine->verify($result)->passed, 'Versi baru tidak boleh membuat dokumen lama tampak salah.');
    }

    public function test_verify_skips_legacy_components_and_missing_versions(): void {
        $tax                                         = $this->setUpTax();
        $payload                                     = $this->engine->calculateDocument([$this->input($tax, 1000, ref: 'legacy'), $this->input($tax, 2000, ref: 'orphan')])->toArray();
        $payload['components'][0]['rule_version_id'] = null;
        DB::table('tax_rule_versions')->delete();

        $report = $this->engine->verify(TaxResult::fromArray($payload));

        $this->assertTrue($report->passed);
        $this->assertSame(0, $report->verifiedComponents);
        $this->assertSame(['legacy', 'version_unavailable'], array_column($report->skipped, 'reason'));
    }

    public function test_describe_persisted_keeps_stored_numbers_and_flags_real_mismatches(): void {
        $tax     = $this->setUpTax();
        $inputs  = [$this->input($tax, 1000000, ref: 'ok'), $this->input($tax, 1000000, ref: 'off')];
        $version = TaxRuleVersion::query()->where('tax_id', $tax->getKey())->firstOrFail();

        $result = $this->engine->describePersisted($inputs, [
            // Kolom generated invoice berupa double tanpa pembulatan: 916666,666... dan 100833,333...
            'ok'  => ['tax_rate' => 11, 'dpp_amount' => 1000000 * 11 / 12, 'tax_amount' => 1000000 * 11 / 12 * 11 / 100, 'rule_version_id' => $version->getKey()],
            'off' => ['tax_rate' => 11, 'dpp_amount' => 916666.67, 'tax_amount' => 100900.0, 'rule_version_id' => $version->getKey()],
        ]);

        $this->assertSame('100833.33', $result->components[0]->taxAmount, 'Nilai tersimpan dibulatkan, bukan dihitung ulang.');
        $this->assertSame([], $result->components[0]->warnings);
        $this->assertSame('100900.00', $result->components[1]->taxAmount, 'Angka dokumen tidak diubah engine.');
        $this->assertSame(['persisted_vs_engine_mismatch'], $result->components[1]->warnings);
        $this->assertContains('persisted_mismatch', array_column($result->explanation, 'key'));
        $this->assertSame('201733.33', $result->totalAdditive);
    }

    public function test_describe_persisted_marks_components_without_a_version_as_legacy(): void {
        $tax    = $this->setUpTax();
        $inputs = [$this->input($tax, 1000000, ref: 'old')];

        $result = $this->engine->describePersisted($inputs, [
            'old' => ['tax_rate' => 11, 'dpp_amount' => 1000000 * 11 / 12, 'tax_amount' => 1000000 * 11 / 12 * 11 / 100],
        ]);

        $this->assertTrue($result->components[0]->isLegacy());
        $this->assertSame('11/12', $result->components[0]->dppFactor);
        $this->assertSame('rule_legacy', $result->explanation[0]['key']);
        $this->assertSame('100833.33', $result->totalAdditive);
    }

    public function test_describe_persisted_requires_a_line_reference_for_every_input(): void {
        $tax = $this->setUpTax();

        $this->expectException(InvalidArgumentException::class);
        $this->engine->describePersisted([$this->input($tax, 1000)], []);
    }

    /**
     * P-5: hasil engine (`per_line`, 11/12) tidak menyimpang lebih dari satu minor unit dari kolom generated invoice
     * (`double`, tanpa pembulatan: `dpp = basis x 11/12`, `pajak = dpp x tarif/100`). Pembandingan terhadap baris
     * invoice sungguhan ada di test snapshot Task 5.
     */
    public function test_engine_agrees_with_the_legacy_generated_column_arithmetic(): void {
        $tax = $this->setUpTax();
        mt_srand(20261121);

        for ($i = 0; $i < 200; $i++) {
            $base = mt_rand(1, 500_000_000) / 100;
            $rate = [0.0, 1.1, 2.0, 10.0, 11.0, 12.0][mt_rand(0, 5)];

            $legacyDpp = $base * 11 / 12;
            $legacyTax = $legacyDpp * $rate / 100;

            $component = new TaxInput((string) $tax->getKey(), (string) $base, CarbonImmutable::parse('2026-03-01'), 2, 'p');
            // Tarif data menyerupai baris invoice (`tax_rate`), bukan tarif versi, jadi dibandingkan lewat describePersisted().
            $persisted = $this->engine->describePersisted([$component], ['p' => ['tax_rate' => $rate, 'dpp_amount' => $legacyDpp, 'tax_amount' => $legacyTax]]);

            $this->assertSame([], $persisted->components[0]->warnings, "base={$base} rate={$rate}");
        }
    }
}
