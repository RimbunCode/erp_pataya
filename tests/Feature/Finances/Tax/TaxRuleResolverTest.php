<?php

namespace Tests\Feature\Finances\Tax;

use App\Exceptions\Finances\NoEffectiveTaxRuleException;
use App\Models\Finances\Tax;
use App\Models\Finances\TaxRuleVersion;
use App\Services\Finances\Tax\TaxRuleResolver;
use App\Services\Finances\Tax\TaxRuleVersionService;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Finance Fase 3, Task 4.3: pemilihan versi aturan menurut tanggal (Requirement 3), termasuk batas tanggal (P-3),
 * gagal tertutup tanpa tarif tebakan, dan cache per request.
 */
class TaxRuleResolverTest extends TestCase {
    use RefreshDatabase;

    private TaxRuleVersionService $service;
    private TaxRuleResolver $resolver;

    protected function setUp(): void {
        parent::setUp();

        $this->service  = app(TaxRuleVersionService::class);
        $this->resolver = app(TaxRuleResolver::class);
    }

    private function activeVersion(Tax $tax, string $from, ?string $to = null, float $rate = 11): TaxRuleVersion {
        return $this->service->activate($this->service->createDraft($tax, [
            'effective_from'  => $from,
            'effective_to'    => $to,
            'rate'            => $rate,
            'dpp_numerator'   => 11,
            'dpp_denominator' => 12,
        ]));
    }

    private function date(string $day): CarbonImmutable {
        return CarbonImmutable::parse($day);
    }

    public function test_boundary_dates_belong_to_exactly_one_version(): void {
        $tax = Tax::query()->create(['name' => 'PPN', 'rate' => 11]);
        $v1  = $this->activeVersion($tax, '2026-01-01', '2026-06-30');
        $v2  = $this->activeVersion($tax, '2026-07-01', null, 12);

        $this->assertSame($v1->getKey(), $this->resolver->resolve($tax, $this->date('2026-01-01'))->getKey(), 'Hari pertama versi 1.');
        $this->assertSame($v1->getKey(), $this->resolver->resolve($tax, $this->date('2026-06-30'))->getKey(), 'Hari terakhir versi 1.');
        $this->assertSame($v2->getKey(), $this->resolver->resolve($tax, $this->date('2026-07-01'))->getKey(), 'Hari pertama versi 2.');
        $this->assertSame($v2->getKey(), $this->resolver->resolve($tax, $this->date('2035-12-31'))->getKey(), 'Tanpa batas akhir.');
    }

    public function test_time_of_day_does_not_move_a_date_across_the_boundary(): void {
        $tax = Tax::query()->create(['name' => 'PPN', 'rate' => 11]);
        $v1  = $this->activeVersion($tax, '2026-01-01', '2026-06-30');
        $this->activeVersion($tax, '2026-07-01', null, 12);

        $lateOnLastDay = CarbonImmutable::parse('2026-06-30 23:59:59');

        $this->assertSame($v1->getKey(), $this->resolver->resolve($tax, $lateOnLastDay)->getKey());
    }

    public function test_it_accepts_a_tax_model_or_its_id(): void {
        $tax     = Tax::query()->create(['name' => 'PPN', 'rate' => 11]);
        $version = $this->activeVersion($tax, '2026-01-01');

        $this->assertSame($version->getKey(), $this->resolver->resolve($tax, $this->date('2026-02-01'))->getKey());
        $this->assertSame($version->getKey(), $this->resolver->resolve((string) $tax->getKey(), $this->date('2026-02-01'))->getKey());
    }

    public function test_a_date_before_the_first_version_fails_closed(): void {
        $tax = Tax::query()->create(['name' => 'PPN 11', 'rate' => 11]);
        $this->activeVersion($tax, '2026-01-01');

        try {
            $this->resolver->resolve($tax, $this->date('2025-12-31'));
            $this->fail('Resolver tidak boleh menebak tarif untuk tanggal tanpa versi berlaku.');
        } catch (NoEffectiveTaxRuleException $e) {
            $this->assertSame((string) $tax->getKey(), $e->taxId);
            $this->assertStringContainsString('PPN 11', $e->getMessage());
            $this->assertStringContainsString('2025-12-31', $e->getMessage());
        }
    }

    public function test_a_tax_without_any_version_fails_closed(): void {
        $tax = Tax::query()->create(['name' => 'PPN', 'rate' => 11]);

        $this->expectException(NoEffectiveTaxRuleException::class);
        $this->resolver->resolve($tax, $this->date('2026-02-01'));
    }

    public function test_draft_and_retired_versions_are_never_resolved(): void {
        $tax     = Tax::query()->create(['name' => 'PPN', 'rate' => 11]);
        $retired = $this->service->retire($this->activeVersion($tax, '2026-01-01', '2026-03-31'));
        $this->service->createDraft($tax, ['effective_from' => '2026-04-01', 'rate' => 11, 'dpp_numerator' => 11, 'dpp_denominator' => 12]);

        $this->assertSame(TaxRuleVersion::STATUS_RETIRED, $retired->status);
        $this->expectException(NoEffectiveTaxRuleException::class);
        $this->resolver->resolve($tax, $this->date('2026-02-01'));
    }

    public function test_a_soft_deleted_tax_is_still_resolvable_for_historical_documents(): void {
        $tax     = Tax::query()->create(['name' => 'PPN lama', 'rate' => 10]);
        $version = $this->activeVersion($tax, '2024-01-01', null, 10);
        $tax->delete();

        $resolved = $this->resolver->resolve((string) $tax->getKey(), $this->date('2024-06-01'));

        $this->assertSame($version->getKey(), $resolved->getKey());
        $this->assertSame('PPN lama', $resolved->tax->name);
    }

    public function test_results_are_cached_per_tax_and_date_until_flushed(): void {
        $tax = Tax::query()->create(['name' => 'PPN', 'rate' => 11]);
        $this->activeVersion($tax, '2026-01-01');
        $day = $this->date('2026-02-01');

        $this->resolver->resolve($tax, $day);

        $queries = 0;
        DB::listen(function () use (&$queries): void {
            $queries++;
        });

        $this->resolver->resolve($tax, $day);
        $this->assertSame(0, $queries, 'Pemanggilan kedua (tax, tanggal) yang sama tidak boleh menyentuh database.');

        $this->resolver->resolve($tax, $this->date('2026-02-02'));
        $this->assertGreaterThan(0, $queries, 'Tanggal lain di-resolve ulang.');

        $queries = 0;
        $this->resolver->flush();
        $this->resolver->resolve($tax, $day);
        $this->assertGreaterThan(0, $queries, 'Setelah flush() cache dibuang.');
    }

    public function test_has_any_version_counts_every_status(): void {
        $withDraftOnly = Tax::query()->create(['name' => 'A', 'rate' => 11]);
        $withNothing   = Tax::query()->create(['name' => 'B', 'rate' => 11]);
        $this->service->createDraft($withDraftOnly, ['effective_from' => '2026-01-01', 'rate' => 11]);

        $this->assertTrue($this->resolver->hasAnyVersion($withDraftOnly));
        $this->assertFalse($this->resolver->hasAnyVersion($withNothing));
    }

    public function test_find_version_and_find_tax_serve_historical_snapshots(): void {
        $tax     = Tax::query()->create(['name' => 'PPN lama', 'rate' => 10]);
        $version = $this->service->retire($this->activeVersion($tax, '2024-01-01', null, 10));
        $tax->delete();

        $found = $this->resolver->findVersion((string) $version->getKey());

        $this->assertNotNull($found, 'Versi pensiun tetap dapat dibaca untuk penjelasan dokumen lama.');
        $this->assertSame('PPN lama', $found->tax->name, 'Pajak terhapus lunak ikut dimuat.');
        $this->assertSame((string) $tax->getKey(), $this->resolver->findTax((string) $tax->getKey())?->getKey());
        $this->assertNull($this->resolver->findVersion('01JNONEXISTENT0000000000000'));
        $this->assertNull($this->resolver->findTax('01JNONEXISTENT0000000000000'));
    }

    public function test_the_resolver_is_shared_within_a_request_scope(): void {
        $this->assertSame(app(TaxRuleResolver::class), app(TaxRuleResolver::class), 'scoped() menjaga satu instans per request/job.');
    }
}
