<?php

namespace Tests\Feature\Finances\Tax;

use App\Events\Core\AuditableModelSaved;
use App\Exceptions\Finances\InvalidTaxRuleVersionException;
use App\Exceptions\Finances\NoEffectiveTaxRuleException;
use App\Models\Finances\FinanceSetting;
use App\Models\Finances\Tax;
use App\Models\Finances\TaxRuleVersion;
use App\Services\Core\Setting\SettingsService;
use App\Services\Finances\Tax\TaxRuleResolver;
use App\Services\Finances\Tax\TaxRuleVersionService;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

/**
 * Finance Fase 3, Task 4.2: siklus hidup versi aturan pajak (draft -> active -> retired), larangan tumpang-tindih
 * (Requirement 2.2), versi penerus menutup versi lama (2.3) dan guard faktor DPP F-17 (2.7).
 */
class TaxRuleVersionServiceTest extends TestCase {
    use RefreshDatabase;

    private TaxRuleVersionService $service;

    protected function setUp(): void {
        parent::setUp();

        $this->service = app(TaxRuleVersionService::class);
    }

    private function tax(string $name = 'PPN', float $rate = 11): Tax {
        return Tax::query()->create(['name' => $name, 'rate' => $rate]);
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    private function draft(Tax $tax, string $from, array $overrides = []): TaxRuleVersion {
        return $this->service->createDraft($tax, [
            'effective_from'  => $from,
            'rate'            => 11,
            'dpp_numerator'   => 11,
            'dpp_denominator' => 12,
            ...$overrides,
        ]);
    }

    private function enableCalc(): void {
        app(SettingsService::class)->updateInternal(FinanceSetting::class, ['tax_engine_calc_enabled' => true]);
    }

    private function assertRejected(callable $callback, string $expectedMessage): void {
        try {
            $callback();
            $this->fail('Seharusnya InvalidTaxRuleVersionException dilempar.');
        } catch (InvalidTaxRuleVersionException $e) {
            $this->assertSame($expectedMessage, $e->getMessage());
        }
    }

    public function test_create_draft_numbers_versions_per_tax_and_starts_as_draft(): void {
        $ppn = $this->tax();
        $pph = $this->tax('PPh 23', 2);

        $first  = $this->draft($ppn, '2026-01-01');
        $second = $this->draft($ppn, '2026-07-01');
        $other  = $this->draft($pph, '2026-01-01', ['dpp_numerator' => 1, 'dpp_denominator' => 1, 'rate' => 2]);

        $this->assertSame([1, 2, 1], [$first->version, $second->version, $other->version]);
        $this->assertSame(TaxRuleVersion::STATUS_DRAFT, $first->status);
        $this->assertSame('11.0000', (string) $first->rate);
        $this->assertSame('11/12', $first->dppFactorLabel());
    }

    public function test_create_draft_rejects_values_outside_the_allowed_bounds(): void {
        $tax = $this->tax();

        $cases = [
            'rate di atas 100'         => [['rate' => 100.01], __('finances/taxRuleVersion.errors.invalid_rate')],
            'rate negatif'             => [['rate' => -1], __('finances/taxRuleVersion.errors.invalid_rate')],
            'rate bukan angka'         => [['rate' => 'abc'], __('finances/taxRuleVersion.errors.invalid_rate')],
            'pembilang nol'            => [['dpp_numerator' => 0], __('finances/taxRuleVersion.errors.invalid_dpp_factor')],
            'penyebut nol'             => [['dpp_denominator' => 0], __('finances/taxRuleVersion.errors.invalid_dpp_factor')],
            'faktor melebihi 65535'    => [['dpp_numerator' => 65536], __('finances/taxRuleVersion.errors.invalid_dpp_factor')],
            'mode pembulatan asing'    => [['rounding_mode' => 'banker'], __('finances/taxRuleVersion.errors.invalid_rounding', ['mode' => 'banker'])],
            'peran bukan snake_case'   => [['output_role' => 'Tax Output'], __('finances/taxRuleVersion.errors.invalid_role', ['role' => 'Tax Output'])],
            'atribut tak dikenal'      => [['status' => 'active'], __('finances/taxRuleVersion.errors.unknown_attribute', ['field' => 'status'])],
            'rentang tanggal terbalik' => [['effective_to' => '2025-12-31'], __('finances/taxRuleVersion.errors.invalid_range')],
        ];

        foreach ($cases as $label => [$overrides, $message]) {
            $this->assertRejected(fn () => $this->draft($tax, '2026-01-01', $overrides), $message);
        }

        $this->assertSame(0, TaxRuleVersion::query()->count(), 'Input tidak valid tidak boleh meninggalkan baris.');
    }

    public function test_create_draft_rejects_an_unknown_tax(): void {
        $this->assertRejected(
            fn () => $this->service->createDraft('01JNONEXISTENT0000000000000', ['effective_from' => '2026-01-01', 'rate' => 11]),
            __('finances/taxRuleVersion.errors.unknown_tax'),
        );
    }

    public function test_update_draft_changes_only_the_given_attributes(): void {
        $version = $this->draft($this->tax(), '2026-01-01', ['notes' => 'awal']);

        $updated = $this->service->updateDraft($version, ['rate' => 12]);

        $this->assertSame('12.0000', (string) $updated->rate);
        $this->assertSame('awal', $updated->notes);
        $this->assertSame('2026-01-01', $updated->effective_from->toDateString());
        $this->assertSame(11, $updated->dpp_numerator);
        $this->assertSame(TaxRuleVersion::STATUS_DRAFT, $updated->status);
    }

    public function test_only_draft_versions_can_be_edited_or_deleted(): void {
        $version = $this->service->activate($this->draft($this->tax(), '2026-01-01'));

        $this->assertRejected(fn () => $this->service->updateDraft($version, ['rate' => 12]), __('finances/taxRuleVersion.errors.not_draft', ['status' => 'active']));
        $this->assertRejected(fn () => $this->service->deleteDraft($version), __('finances/taxRuleVersion.errors.delete_not_draft'));
        $this->assertSame('11.0000', (string) $version->fresh()->rate, 'Versi aktif tidak boleh berubah.');
    }

    public function test_delete_draft_removes_the_row(): void {
        $version = $this->draft($this->tax(), '2026-01-01');

        $this->service->deleteDraft($version);

        $this->assertNull(TaxRuleVersion::query()->find($version->getKey()));
    }

    public function test_activate_marks_the_version_active_and_makes_it_resolvable(): void {
        $tax     = $this->tax();
        $version = $this->service->activate($this->draft($tax, '2026-01-01'));

        $this->assertTrue($version->isActive());
        $this->assertSame($version->getKey(), app(TaxRuleResolver::class)->resolve($tax, CarbonImmutable::parse('2026-03-15'))->getKey());
    }

    public function test_activate_requires_a_draft(): void {
        $version = $this->service->activate($this->draft($this->tax(), '2026-01-01'));

        $this->assertRejected(fn () => $this->service->activate($version), __('finances/taxRuleVersion.errors.not_draft', ['status' => 'active']));
    }

    public function test_successor_version_closes_the_previous_one_the_day_before(): void {
        $tax = $this->tax();
        $v1  = $this->service->activate($this->draft($tax, '2026-01-01'));
        $v2  = $this->service->activate($this->draft($tax, '2026-07-01'));

        $this->assertSame('2026-06-30', $v1->fresh()->effective_to->toDateString());
        $this->assertNull($v2->fresh()->effective_to);

        $resolver = app(TaxRuleResolver::class);
        $this->assertSame($v1->getKey(), $resolver->resolve($tax, CarbonImmutable::parse('2026-06-30'))->getKey(), 'Hari terakhir versi lama (P-3).');
        $this->assertSame($v2->getKey(), $resolver->resolve($tax, CarbonImmutable::parse('2026-07-01'))->getKey(), 'Hari pertama versi baru (P-3).');
    }

    public function test_activation_overlapping_more_than_one_active_version_is_rejected(): void {
        $tax = $this->tax();
        $this->service->activate($this->draft($tax, '2026-01-01', ['effective_to' => '2026-06-30']));
        $this->service->activate($this->draft($tax, '2026-07-01'));

        $overlap = $this->draft($tax, '2026-03-01');

        $this->assertRejected(
            fn () => $this->service->activate($overlap),
            __('finances/taxRuleVersion.errors.overlap', ['version' => 1, 'from' => '2026-01-01', 'to' => '2026-06-30']),
        );
        $this->assertTrue($overlap->fresh()->isDraft(), 'Aktivasi yang ditolak tidak boleh mengubah status.');
    }

    public function test_successor_must_start_after_the_version_it_closes(): void {
        $tax = $this->tax();
        $this->service->activate($this->draft($tax, '2026-05-01'));

        $earlier = $this->draft($tax, '2026-05-01');

        $this->assertRejected(
            fn () => $this->service->activate($earlier),
            __('finances/taxRuleVersion.errors.version_starts_before_previous', ['from' => '2026-05-01']),
        );
    }

    public function test_successor_may_not_end_before_the_open_ended_version_it_closes(): void {
        $tax = $this->tax();
        $this->service->activate($this->draft($tax, '2026-01-01'));

        $bounded = $this->draft($tax, '2026-07-01', ['effective_to' => '2026-12-31']);

        $this->assertRejected(
            fn () => $this->service->activate($bounded),
            __('finances/taxRuleVersion.errors.version_ends_before_previous', ['to' => __('finances/taxRuleVersion.open_ended')]),
        );
    }

    public function test_different_taxes_never_conflict(): void {
        $ppn = $this->tax();
        $pph = $this->tax('PPh 23', 2);

        $this->service->activate($this->draft($ppn, '2026-01-01'));
        // Guard F-17 berlaku untuk semua pajak (kolom generated invoice mengalikan 11/12 untuk setiap baris pajak).
        $version = $this->service->activate($this->draft($pph, '2026-01-01', ['rate' => 2]));

        $this->assertTrue($version->isActive());
        $this->assertSame(2, TaxRuleVersion::query()->where('status', TaxRuleVersion::STATUS_ACTIVE)->count());
    }

    public function test_retire_removes_the_version_from_resolution(): void {
        $tax      = $this->tax();
        $version  = $this->service->activate($this->draft($tax, '2026-01-01'));
        $resolver = app(TaxRuleResolver::class);
        $resolver->resolve($tax, CarbonImmutable::parse('2026-02-01'));

        $retired = $this->service->retire($version);

        $this->assertSame(TaxRuleVersion::STATUS_RETIRED, $retired->status);
        $this->expectException(NoEffectiveTaxRuleException::class);
        $resolver->resolve($tax, CarbonImmutable::parse('2026-02-01'));
    }

    public function test_only_an_active_version_can_be_retired(): void {
        $draft = $this->draft($this->tax(), '2026-01-01');

        $this->assertRejected(fn () => $this->service->retire($draft), __('finances/taxRuleVersion.errors.not_active', ['status' => 'draft']));
    }

    public function test_create_new_version_copies_the_source_and_applies_overrides(): void {
        $tax    = $this->tax();
        $source = $this->service->activate($this->draft($tax, '2026-01-01', ['rounding_mode' => TaxRuleVersion::ROUNDING_PER_DOCUMENT, 'notes' => 'dasar']));

        $copy = $this->service->createNewVersion($source, '2027-01-01', null, ['rate' => 12]);

        $this->assertSame(2, $copy->version);
        $this->assertTrue($copy->isDraft());
        $this->assertSame('12.0000', (string) $copy->rate);
        $this->assertSame('11/12', $copy->dppFactorLabel());
        $this->assertSame(TaxRuleVersion::ROUNDING_PER_DOCUMENT, $copy->rounding_mode);
        $this->assertSame('dasar', $copy->notes);
        $this->assertSame('2027-01-01', $copy->effective_from->toDateString());
    }

    public function test_dpp_factor_guard_blocks_non_legacy_factors_until_calc_is_enabled(): void {
        // Default setelah konversi Bagian B adalah true; guard hanya relevan bila setting dimatikan (mis. down() migrasi).
        app(SettingsService::class)->updateInternal(FinanceSetting::class, ['tax_engine_calc_enabled' => false]);
        $tax = $this->tax();

        // 1/1 (default kolom) bukan 11/12, jadi ditolak selama kolom generated dokumen masih mengalikan 11/12 tetap.
        $blocked = $this->draft($tax, '2026-01-01', ['dpp_numerator' => 1, 'dpp_denominator' => 1]);
        $this->assertRejected(fn () => $this->service->activate($blocked), __('finances/taxRuleVersion.errors.dpp_factor_locked', ['factor' => '1/1']));
        $this->assertTrue($blocked->fresh()->isDraft());

        // Pecahan ekuivalen menghasilkan angka yang sama, jadi diizinkan.
        $equivalent = $this->draft($tax, '2026-01-01', ['dpp_numerator' => 22, 'dpp_denominator' => 24]);
        $this->assertTrue($this->service->activate($equivalent)->isActive());
    }

    public function test_dpp_factor_guard_is_lifted_once_calc_is_enabled(): void {
        $this->enableCalc();
        $tax = $this->tax();

        $version = $this->service->activate($this->draft($tax, '2026-01-01', ['dpp_numerator' => 1, 'dpp_denominator' => 1]));

        $this->assertTrue($version->isActive());
    }

    public function test_guard_does_not_apply_to_drafts(): void {
        $draft = $this->draft($this->tax(), '2026-01-01', ['dpp_numerator' => 1, 'dpp_denominator' => 1]);

        $this->assertTrue($draft->isDraft(), 'Draft boleh menyimpan faktor apa pun; guard hanya saat aktivasi.');
    }

    public function test_create_initial_version_matches_the_backfill_contract(): void {
        $tax = $this->tax('PPN 11', 11);

        $version = $this->service->createInitialVersion($tax);

        $this->assertTrue($version->isActive());
        $this->assertSame(1, $version->version);
        $this->assertSame('1970-01-01', $version->effective_from->toDateString());
        $this->assertNull($version->effective_to);
        $this->assertSame('11.0000', (string) $version->rate);
        $this->assertSame('11/12', $version->dppFactorLabel());
        $this->assertSame(TaxRuleVersion::ROUNDING_PER_LINE, $version->rounding_mode);
        $this->assertSame('migrated; needs review', $version->notes);
    }

    public function test_create_initial_version_is_skipped_when_the_tax_already_has_a_version(): void {
        $tax = $this->tax('PPN 11', 11);
        $this->assertNotNull($this->service->createInitialVersion($tax));

        $this->assertNull($this->service->createInitialVersion($tax), 'Diperiksa di dalam kunci baris pajak: tidak menggandakan versi 1.');
        $this->assertSame(1, TaxRuleVersion::query()->where('tax_id', $tax->getKey())->count());
    }

    public function test_changes_are_recorded_through_the_audit_event(): void {
        Event::fake([AuditableModelSaved::class]);

        $version = $this->service->activate($this->draft($this->tax(), '2026-01-01'));
        $this->service->retire($version);

        // Pajak yang dibuat test ikut memicu event audit; hanya event versi aturan yang dihitung.
        $actions = Event::dispatched(AuditableModelSaved::class)
            ->filter(fn (array $args): bool => $args[0]->model instanceof TaxRuleVersion)
            ->map(fn (array $args): string => $args[0]->action)
            ->values()
            ->all();

        $this->assertSame(['created', 'activated', 'retired'], $actions);
    }
}
