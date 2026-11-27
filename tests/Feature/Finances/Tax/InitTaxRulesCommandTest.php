<?php

namespace Tests\Feature\Finances\Tax;

use App\Models\Finances\Tax;
use App\Models\Finances\TaxRuleVersion;
use App\Services\Finances\Tax\TaxRuleResolver;
use App\Services\Finances\Tax\TaxRuleVersionService;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Tests\TestCase;

/**
 * Finance Fase 3, Task 3.1 dan 3.3: `finance:init-tax-rules` (Requirement 6.1-6.3). Membuat versi 1 per pajak,
 * idempoten (P-6), tidak menimpa, `--dry-run` tidak menulis, dan menandai tarif yang mencurigakan terhadap 11/12.
 */
class InitTaxRulesCommandTest extends TestCase {
    use RefreshDatabase;

    /**
     * @param  array<string, mixed>  $options
     */
    private function runCommand(array $options = [], int $expectedExit = 0): string {
        $this->assertSame($expectedExit, Artisan::call('finance:init-tax-rules', $options));

        return Artisan::output();
    }

    private function tax(string $name, float $rate): Tax {
        return Tax::query()->create(['name' => $name, 'rate' => $rate]);
    }

    public function test_it_creates_an_active_version_one_for_every_tax_without_versions(): void {
        $ppn = $this->tax('PPN 12', 12);
        $pph = $this->tax('PPh 23', 2);

        $this->runCommand();

        foreach ([$ppn, $pph] as $tax) {
            $versions = TaxRuleVersion::query()->where('tax_id', $tax->getKey())->get();
            $this->assertCount(1, $versions);

            $version = $versions->first();
            $this->assertSame(1, $version->version);
            $this->assertTrue($version->isActive());
            $this->assertSame('1970-01-01', $version->effective_from->toDateString());
            $this->assertNull($version->effective_to);
            $this->assertSame('11/12', $version->dppFactorLabel());
            $this->assertSame(TaxRuleVersion::ROUNDING_PER_LINE, $version->rounding_mode);
            $this->assertSame('migrated; needs review', $version->notes);
        }

        $this->assertSame('12.0000', (string) TaxRuleVersion::query()->where('tax_id', $ppn->getKey())->value('rate'));
        $this->assertSame('2.0000', (string) TaxRuleVersion::query()->where('tax_id', $pph->getKey())->value('rate'));
    }

    public function test_soft_deleted_taxes_also_get_a_version_because_old_documents_still_reference_them(): void {
        $old = $this->tax('PPN lama', 10);
        $old->delete();

        $output = $this->runCommand();

        $this->assertSame(1, TaxRuleVersion::query()->where('tax_id', $old->getKey())->count());
        $this->assertStringContainsString('PPN lama (dihapus)', $output);
    }

    public function test_it_is_idempotent_and_never_overwrites_existing_versions(): void {
        $this->tax('PPN 12', 12);
        $customized = $this->tax('PPN khusus', 5);
        $versions   = app(TaxRuleVersionService::class);
        $draft      = $versions->createDraft($customized, ['effective_from' => '2026-05-01', 'rate' => 5, 'dpp_numerator' => 11, 'dpp_denominator' => 12, 'notes' => 'dibuat akuntan']);

        $this->runCommand();
        $afterFirst = TaxRuleVersion::query()->orderBy('tax_id')->orderBy('version')->get(['id', 'tax_id', 'version', 'status', 'notes'])->toArray();

        $second      = $this->runCommand();
        $afterSecond = TaxRuleVersion::query()->orderBy('tax_id')->orderBy('version')->get(['id', 'tax_id', 'version', 'status', 'notes'])->toArray();

        $this->assertSame($afterFirst, $afterSecond, 'Menjalankan ulang tidak boleh mengubah atau menambah versi.');
        $this->assertStringContainsString('Versi 1 dibuat: 0.', $second);

        $kept = $draft->fresh();
        $this->assertTrue($kept->isDraft(), 'Pajak yang sudah punya versi (apa pun statusnya) dilewati.');
        $this->assertSame('dibuat akuntan', $kept->notes);
        $this->assertSame(1, TaxRuleVersion::query()->where('tax_id', $customized->getKey())->count());
    }

    public function test_dry_run_reports_without_writing(): void {
        $this->tax('PPN 12', 12);

        $output = $this->runCommand(['--dry-run' => true]);

        $this->assertSame(0, TaxRuleVersion::query()->count());
        $this->assertStringContainsString('PPN 12', $output);
        $this->assertStringContainsString('Mode dry-run', $output);
    }

    public function test_it_flags_rates_whose_effective_rate_is_not_a_whole_percent(): void {
        $this->tax('PPN 11', 11);
        $this->tax('PPN 12', 12);
        $this->tax('PPh 23', 2);
        $this->tax('Bebas', 0);

        $output = $this->runCommand(['--dry-run' => true]);

        $this->assertStringContainsString('PPN 11: rate 11 menjadi 10.0833% efektif', $output, 'rate 11 x 11/12 = 10,0833%.');
        $this->assertStringContainsString('PPh 23: rate 2 menjadi 1.8333% efektif', $output, 'PPh yang ikut dikalikan 11/12 juga dilaporkan.');
        $this->assertStringNotContainsString('PPN 12: rate', $output, 'rate 12 x 11/12 = 11% efektif (bilangan bulat).');
        $this->assertStringNotContainsString('Bebas: rate', $output);
    }

    public function test_the_report_never_changes_tax_data(): void {
        $tax = $this->tax('PPN 11', 11);

        $this->runCommand();

        $this->assertEquals(11.0, $tax->fresh()->rate, 'taxes.rate tidak diubah (Requirement 6.3).');
        $this->assertSame(Tax::CATEGORY_UNCLASSIFIED, $tax->fresh()->category, 'Klasifikasi tidak ditebak.');
    }

    public function test_rates_outside_zero_to_one_hundred_are_reported_and_skipped(): void {
        $broken = $this->tax('Salah', 150);
        $good   = $this->tax('PPN 12', 12);

        $output = $this->runCommand();

        $this->assertSame(0, TaxRuleVersion::query()->where('tax_id', $broken->getKey())->count());
        $this->assertSame(1, TaxRuleVersion::query()->where('tax_id', $good->getKey())->count(), 'Satu pajak bermasalah tidak menghentikan yang lain.');
        $this->assertStringContainsString('Salah: rate 150', $output);
    }

    public function test_the_created_version_is_resolvable_for_any_document_date(): void {
        $tax = $this->tax('PPN 12', 12);

        $this->runCommand();

        $resolver = app(TaxRuleResolver::class);
        $this->assertSame('11/12', $resolver->resolve($tax, now())->dppFactorLabel());
        $this->assertSame('11/12', $resolver->resolve($tax, CarbonImmutable::parse('2019-01-01'))->dppFactorLabel());
    }
}
