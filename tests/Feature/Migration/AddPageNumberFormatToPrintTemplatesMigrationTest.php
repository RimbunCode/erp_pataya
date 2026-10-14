<?php

namespace Tests\Feature\Migration;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

class AddPageNumberFormatToPrintTemplatesMigrationTest extends TestCase {
    use RefreshDatabase;

    private function migration(): object {
        return require database_path('migrations/2026_10_11_142106_add_page_number_format_to_print_templates_table.php');
    }

    public function test_adds_page_number_format_column(): void {
        $this->assertTrue(Schema::hasColumn('print_templates', 'page_number_format'));
    }

    public function test_down_drops_column_and_up_backfills_only_rows_with_page_number(): void {
        $migration = $this->migration();
        $migration->down();
        $this->assertFalse(Schema::hasColumn('print_templates', 'page_number_format'));

        $withNumber    = (string) Str::ulid();
        $withoutNumber = (string) Str::ulid();

        foreach ([[$withNumber, 'bottom_right'], [$withoutNumber, null]] as [$id, $pageNumber]) {
            DB::table('print_templates')->insert([
                'id'          => $id,
                'name'        => 'T ' . $id,
                'model'       => 'App\\Models\\Sales\\SalesOrder',
                'page_number' => $pageNumber,
                'created_at'  => now(),
                'updated_at'  => now(),
            ]);
        }

        $migration->up();

        $this->assertTrue(Schema::hasColumn('print_templates', 'page_number_format'));
        $this->assertSame(':page / :total', DB::table('print_templates')->where('id', $withNumber)->value('page_number_format'));
        $this->assertNull(DB::table('print_templates')->where('id', $withoutNumber)->value('page_number_format'));
    }
}
