<?php

namespace Tests\Feature\Finances\Tax;

use App\Console\Commands\Finances\UnclassifiedTaxReportCommand;
use App\Models\Finances\Tax;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use ReflectionMethod;
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

    public function test_order_and_quotation_usage_counts_every_pivot_tax_not_only_the_primary_one(): void {
        $primary = Tax::query()->create(['name' => 'Pajak utama', 'rate' => 11]);
        $second  = Tax::query()->create(['name' => 'Pajak kedua', 'rate' => 2]);

        // Dua item order dengan dua pajak masing-masing, satu item quotation dengan pajak kedua saja.
        DB::statement('PRAGMA defer_foreign_keys = ON'); // ditunda sampai commit; transaksi tes di-rollback
        foreach ([['sales_order_item_taxes', 'sales_order_item_id', 'so-1', $primary, 0], ['sales_order_item_taxes', 'sales_order_item_id', 'so-1', $second, 1],
            ['purchase_order_item_taxes', 'purchase_order_item_id', 'po-1', $primary, 0], ['purchase_order_item_taxes', 'purchase_order_item_id', 'po-1', $second, 1],
            ['quotation_item_taxes', 'quotation_item_id', 'q-1', $second, 0]] as [$table, $key, $itemId, $tax, $position]) {
            DB::table($table)->insert(['id' => (string) Str::ulid(), $key => $itemId, 'tax_id' => $tax->getKey(), 'position' => $position, 'created_at' => now(), 'updated_at' => now()]);
        }

        $output = $this->report();

        $this->assertMatchesRegularExpression('/Pajak utama\s*\|\s*11\s*\|\s*0\s*\|\s*0\s*\|\s*2\s*\|\s*0\s*\|/', $output, 'Pajak utama: satu baris order penjualan dan satu order pembelian.');
        $this->assertMatchesRegularExpression('/Pajak kedua\s*\|\s*2\s*\|\s*0\s*\|\s*0\s*\|\s*3\s*\|\s*0\s*\|/', $output, 'Pajak non-utama ikut terhitung, termasuk dari quotation.');
    }

    public function test_a_missing_pivot_table_falls_back_to_counting_the_legacy_item_column(): void {
        $command = new UnclassifiedTaxReportCommand;
        $count   = new ReflectionMethod($command, 'countUsage');

        Schema::create('tmp_report_items', function ($table): void {
            $table->string('id');
            $table->string('tax_id')->nullable();
        });
        DB::table('tmp_report_items')->insert([['id' => 'a', 'tax_id' => 'T1'], ['id' => 'b', 'tax_id' => 'T1']]);

        $withoutPivotTable = [['table' => 'tmp_report_items', 'column' => 'tax_id', 'withoutPivot' => ['table' => 'tmp_report_missing_pivot', 'key' => 'item_id']]];
        $this->assertSame(['T1' => 2], $count->invoke($command, $withoutPivotTable, ['T1']), 'Pivot belum ada: item lama dihitung seluruhnya, bukan 0.');

        Schema::create('tmp_report_pivot', function ($table): void {
            $table->string('item_id');
        });
        DB::table('tmp_report_pivot')->insert(['item_id' => 'a']);
        $withPivotTable = [['table' => 'tmp_report_items', 'column' => 'tax_id', 'withoutPivot' => ['table' => 'tmp_report_pivot', 'key' => 'item_id']]];
        $this->assertSame(['T1' => 1], $count->invoke($command, $withPivotTable, ['T1']), 'Pivot ada: hanya item tanpa baris pivot.');
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
