<?php

namespace Tests\Feature\Asset;

use App\Models\Asset\Asset;
use App\Models\Asset\AssetValueAdjustment;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use RuntimeException;
use Tests\TestCase;

/**
 * Finance Fase 2, Task 12.3: migrasi `make_difference_account_nullable_on_asset_value_adjustments_table` membuat kolom
 * akun selisih boleh null; `down()` hanya mengembalikan NOT NULL bila tidak ada baris tanpa akun.
 */
class AssetValueAdjustmentAccountNullableMigrationTest extends TestCase {
    use RefreshDatabase;

    private function migration(): Migration {
        $files = glob(database_path('migrations/*_make_difference_account_nullable_on_asset_value_adjustments_table.php'));
        $this->assertCount(1, $files);

        return require $files[0];
    }

    private function isNullable(): bool {
        return (bool) collect(Schema::getColumns('asset_value_adjustments'))->firstWhere('name', 'difference_account_id')['nullable'];
    }

    public function test_column_is_nullable_after_migrating(): void {
        $this->assertTrue($this->isNullable());
    }

    public function test_down_restores_not_null_and_up_makes_it_nullable_again(): void {
        $migration = $this->migration();

        $migration->down();
        $this->assertFalse($this->isNullable());

        $migration->up();
        $this->assertTrue($this->isNullable());

        // Aman dijalankan ulang.
        $migration->up();
        $this->assertTrue($this->isNullable());
    }

    public function test_down_refuses_before_any_ddl_when_rows_without_account_exist(): void {
        DB::table('asset_value_adjustments')->insert([
            'id'                  => (string) Str::ulid(),
            'code'                => 'AVA-NOACC',
            'asset_id'            => Asset::factory()->create()->id,
            'date'                => now()->toDateString(),
            'current_asset_value' => 0,
            'new_asset_value'     => 0,
            'created_at'          => now(),
            'updated_at'          => now(),
        ]);
        $this->assertSame(1, AssetValueAdjustment::query()->count());

        try {
            $this->migration()->down();
            $this->fail('down() harus menolak saat ada baris tanpa akun.');
        } catch (RuntimeException $e) {
            $this->assertStringContainsString('asset_value_adjustments.difference_account_id', $e->getMessage());
            $this->assertStringContainsString('1 baris', $e->getMessage());
        }

        $this->assertTrue($this->isNullable());
    }
}
