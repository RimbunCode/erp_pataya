<?php

namespace Tests\Feature\Finances\Tax;

use App\Models\Finances\Tax;
use App\Models\Finances\TaxRuleVersion;
use Database\Seeders\TaxSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Finance Fase 3, Task 1.5 (Requirement 1.4): seed `PPN 12% (DPP Nilai Lain 11/12)` hanya bila belum ada pajak
 * `ppn_standard`, idempoten, dan tidak menimpa data.
 */
class TaxSeederTest extends TestCase {
    use RefreshDatabase;

    public function test_it_seeds_the_standard_ppn_with_an_active_version_one_using_the_11_12_factor(): void {
        $this->seed(TaxSeeder::class);

        $tax = Tax::query()->where('name', TaxSeeder::NAME)->firstOrFail();
        $this->assertEquals(12, $tax->rate);
        $this->assertSame(Tax::CATEGORY_PPN_STANDARD, $tax->category);
        $this->assertSame(Tax::BEHAVIOR_ADDITIVE, $tax->behavior);

        $versions = TaxRuleVersion::query()->where('tax_id', $tax->getKey())->get();
        $this->assertCount(1, $versions);
        $version = $versions->first();
        $this->assertSame(1, $version->version);
        $this->assertTrue($version->isActive(), 'Versi 1 lolos guard faktor 11/12 dan aktif.');
        $this->assertSame('11/12', $version->dppFactorLabel());
        $this->assertSame('12.0000', (string) $version->rate);
        $this->assertNull($version->effective_to);
    }

    public function test_running_the_seeder_twice_does_not_duplicate_the_tax_or_version(): void {
        $this->seed(TaxSeeder::class);
        $this->seed(TaxSeeder::class);

        $this->assertSame(1, Tax::query()->where('category', Tax::CATEGORY_PPN_STANDARD)->count());
        $this->assertSame(1, TaxRuleVersion::query()->count());
    }

    public function test_it_does_nothing_when_a_standard_ppn_already_exists(): void {
        $existing = Tax::query()->create(['name' => 'PPN Lama', 'rate' => 11, 'category' => Tax::CATEGORY_PPN_STANDARD]);

        $this->seed(TaxSeeder::class);

        $this->assertSame(1, Tax::query()->count());
        $this->assertSame('PPN Lama', $existing->fresh()->name);
        $this->assertEquals(11, $existing->fresh()->rate);
        $this->assertSame(0, TaxRuleVersion::query()->count(), 'Tidak menyentuh versi pajak yang sudah ada.');
    }

    public function test_a_soft_deleted_standard_ppn_also_blocks_the_seed(): void {
        $existing = Tax::query()->create(['name' => 'PPN Dihapus', 'rate' => 11, 'category' => Tax::CATEGORY_PPN_STANDARD]);
        $existing->delete();

        $this->seed(TaxSeeder::class);

        $this->assertSame(0, Tax::query()->count());
    }

    public function test_it_does_not_treat_unclassified_taxes_as_standard_ppn(): void {
        Tax::query()->create(['name' => 'PPN 11', 'rate' => 11]);

        $this->seed(TaxSeeder::class);

        $this->assertSame(2, Tax::query()->count());
    }
}
