<?php

namespace Tests\Feature\Finances\Tax;

use App\Models\Finances\Tax;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Finance Fase 3, Task 3.2 dan 3.3: `finance:report-unclassified-taxes` (Requirement 10.5). Hanya membaca; tidak
 * mengubah data, dan tidak menebak klasifikasi.
 */
class UnclassifiedTaxReportCommandTest extends TestCase {
    use RefreshDatabase;

    private function report(): string {
        $this->assertSame(0, Artisan::call('finance:report-unclassified-taxes'));

        return Artisan::output();
    }

    private function useAsDefaultRule(Tax $tax, int $times): void {
        for ($i = 0; $i < $times; $i++) {
            DB::table('default_tax_rules')->insert([
                'id'         => (string) Str::ulid(),
                'module'     => 'sales',
                'tax_id'     => $tax->getKey(),
                'priority'   => $i,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    public function test_it_lists_unclassified_taxes_with_their_usage(): void {
        $used   = Tax::query()->create(['name' => 'PPN 11', 'rate' => 11]);
        $unused = Tax::query()->create(['name' => 'PPh 23', 'rate' => 2]);
        $this->useAsDefaultRule($used, 3);

        $output = $this->report();

        $this->assertStringContainsString('PPN 11', $output);
        $this->assertStringContainsString('PPh 23', $output);
        $this->assertStringContainsString('Pajak belum diklasifikasi: 2', $output);
        $this->assertMatchesRegularExpression('/PPN 11\s*\|\s*11\s*\|\s*0\s*\|\s*0\s*\|\s*0\s*\|\s*3\s*\|/', $output, 'Tiga rujukan default untuk PPN 11.');
        $this->assertMatchesRegularExpression('/PPh 23\s*\|\s*2\s*\|\s*0\s*\|\s*0\s*\|\s*0\s*\|\s*0\s*\|/', $output);
        $this->assertSame($unused->getKey(), Tax::query()->where('name', 'PPh 23')->value('id'));
    }

    public function test_classified_and_deleted_taxes_are_left_out(): void {
        Tax::query()->create(['name' => 'PPN terklasifikasi', 'rate' => 12, 'category' => Tax::CATEGORY_PPN_STANDARD]);
        Tax::query()->create(['name' => 'Pajak dihapus', 'rate' => 5])->delete();
        Tax::query()->create(['name' => 'Masih unclassified', 'rate' => 1]);

        $output = $this->report();

        $this->assertStringContainsString('Masih unclassified', $output);
        $this->assertStringNotContainsString('PPN terklasifikasi', $output);
        $this->assertStringNotContainsString('Pajak dihapus', $output);
        $this->assertStringContainsString('Pajak belum diklasifikasi: 1', $output);
    }

    public function test_it_says_so_when_every_tax_is_classified(): void {
        Tax::query()->create(['name' => 'PPN 12', 'rate' => 12, 'category' => Tax::CATEGORY_PPN_STANDARD]);

        $this->assertStringContainsString('Semua pajak sudah diklasifikasi.', $this->report());
    }

    public function test_it_changes_nothing(): void {
        $tax = Tax::query()->create(['name' => 'PPN 11', 'rate' => 11]);

        $this->report();

        $fresh = $tax->fresh();
        $this->assertSame(Tax::CATEGORY_UNCLASSIFIED, $fresh->category, 'Laporan tidak menetapkan klasifikasi.');
        $this->assertSame(Tax::BEHAVIOR_ADDITIVE, $fresh->behavior);
        $this->assertEquals(11.0, $fresh->rate);
    }
}
