<?php

namespace Tests\Feature\Finances\Ledger;

use App\Models\Finances\Account;
use App\Services\Finances\Audit\LedgerPrecisionChecker;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use RuntimeException;
use Tests\Support\BuildsFinanceFixtures;
use Tests\TestCase;

/**
 * Finance Fase 1, Task 8.1(b) dan 8.3: pra-pemeriksaan presisi (perintah + kelas bersama) dan migration konversi
 * `debit`/`credit` ke `decimal(20,4)` serta FK akun `restrictOnDelete`.
 */
class LedgerPrecisionTest extends TestCase {
    use BuildsFinanceFixtures, RefreshDatabase;

    private Account $cash;
    private Account $sales;

    protected function setUp(): void {
        parent::setUp();

        $this->setUpFinanceFixtures();
        $this->cash  = $this->makeAccount('1101', 'Cash');
        $this->sales = $this->makeAccount('4101', 'Sales', 'income', 'credit');
    }

    private function insertLine(float $debit, float $credit = 0.0, bool $softDeleted = false): void {
        DB::table('general_ledgers')->insert([
            'id'                 => (string) Str::ulid(),
            'code'               => 'GL-' . Str::upper(Str::random(8)),
            'referenceable_type' => 'Test',
            'referenceable_id'   => (string) Str::ulid(),
            'account_id'         => $this->cash->id,
            'against_account_id' => $this->sales->id,
            'debit'              => $debit,
            'credit'             => $credit,
            'transaction_date'   => now(),
            'created_at'         => now(),
            'updated_at'         => now(),
            'deleted_at'         => $softDeleted ? now() : null,
        ]);
    }

    private function migration(): object {
        return require base_path('database/migrations/2026_11_04_100008_convert_general_ledgers_amounts_to_decimal.php');
    }

    /**
     * @return array<string, string>
     */
    private function foreignKeyRules(): array {
        $rules = [];
        foreach (Schema::getForeignKeys('general_ledgers') as $foreignKey) {
            if (\in_array($foreignKey['columns'], [['account_id'], ['against_account_id']], true)) {
                $rules[$foreignKey['columns'][0]] = strtolower((string) $foreignKey['on_delete']);
            }
        }

        ksort($rules);

        return $rules;
    }

    public function test_checker_counts_strict_and_meaningful_hits_including_soft_deleted(): void {
        $this->insertLine(100.0);
        $this->insertLine(100.00000001);            // derau: hanya melampaui 1e-9
        $this->insertLine(0.0, 250.12345);          // pecahan bermakna (> 1e-5)
        $this->insertLine(5000000.5, 0.0, true);    // soft-deleted tetap dihitung

        $result = (new LedgerPrecisionChecker)->check();

        $this->assertSame(4, $result['total_baris']);
        $this->assertSame(2, $result['hit_ketat']);
        $this->assertSame(1, $result['hit_bermakna']);
        $this->assertEquals(5000000.5, $result['nilai_maks']);
    }

    public function test_checker_on_empty_table_returns_zeros(): void {
        $result = (new LedgerPrecisionChecker)->check(1e-5);

        $this->assertSame(0, $result['total_baris']);
        $this->assertSame(0, $result['hit_ketat']);
        $this->assertSame(0, $result['hit_bermakna']);
        $this->assertSame(0, $result['hit_ambang']);
        $this->assertSame(0.0, $result['nilai_maks']);
    }

    public function test_command_succeeds_when_no_meaningful_hit(): void {
        $this->insertLine(100.25);
        $this->insertLine(100.00000001);

        $this->artisan('finance:check-ledger-precision')
            ->expectsOutputToContain('Pra-pemeriksaan presisi lolos.')
            ->assertSuccessful();
    }

    public function test_command_fails_when_meaningful_hit_exists(): void {
        $this->insertLine(0.0, 1.00001234);

        $this->artisan('finance:check-ledger-precision')->assertFailed();
    }

    public function test_command_is_read_only(): void {
        $this->insertLine(0.0, 1.00001234);

        $this->artisan('finance:check-ledger-precision')->assertFailed();

        $this->assertSame(1, DB::table('general_ledgers')->count());
        $this->assertEquals(1.00001234, DB::table('general_ledgers')->value('credit'));
    }

    public function test_schema_after_migration_has_decimal_amounts_and_restrict_foreign_keys(): void {
        $columns = collect(Schema::getColumns('general_ledgers'))->keyBy('name');

        foreach (['debit', 'credit'] as $name) {
            $this->assertNotContains(strtolower((string) $columns[$name]['type_name']), ['double', 'float', 'real'], "{$name} masih floating.");
            $this->assertFalse($columns[$name]['nullable']);
        }

        $this->assertEquals(['account_id' => 'restrict', 'against_account_id' => 'restrict'], $this->foreignKeyRules());
        $this->assertTrue($columns['against_account_id']['nullable'], 'against_account_id harus tetap nullable (Q-P1-3).');
    }

    public function test_guard_refuses_before_any_ddl_and_leaves_schema_unchanged(): void {
        $migration = $this->migration();
        $migration->down();

        $this->assertEquals(['account_id' => 'cascade', 'against_account_id' => 'cascade'], $this->foreignKeyRules());

        $this->insertLine(0.0, 1.00001234);

        try {
            $migration->up();
            $this->fail('Pengaman presisi seharusnya menolak jalan.');
        } catch (RuntimeException $e) {
            $this->assertStringContainsString('hit_bermakna=1', $e->getMessage());
            $this->assertStringContainsString('nilai_maks', $e->getMessage());
        }

        // Tidak ada DDL yang sempat jalan: FK tetap cascade dan kolom tetap floating.
        $this->assertEquals(['account_id' => 'cascade', 'against_account_id' => 'cascade'], $this->foreignKeyRules());
        $columns = collect(Schema::getColumns('general_ledgers'))->keyBy('name');
        $this->assertContains(strtolower((string) $columns['debit']['type_name']), ['double', 'float', 'real']);
    }

    public function test_default_guard_threshold_is_strict(): void {
        $this->assertSame(1e-9, config('finance.ledger_precision_guard_threshold'));

        $migration = $this->migration();
        $migration->down();
        $this->insertLine(0.0, 1.000004); // selisih 4e-6: lolos ambang 1e-5, tetapi tidak 1e-9

        $this->expectException(RuntimeException::class);
        $migration->up();
    }

    public function test_up_resumes_when_only_one_amount_column_was_converted(): void {
        $migration = $this->migration();
        $migration->down();

        // Keadaan setengah jadi: ALTER `debit` selesai, ALTER `credit` belum (DDL MySQL tidak transaksional).
        Schema::table('general_ledgers', fn ($table) => $table->decimal('debit', 20, 4)->default(0)->change());
        $this->insertLine(10.25, 20.5);

        $migration->up();

        $columns = collect(Schema::getColumns('general_ledgers'))->keyBy('name');
        foreach (['debit', 'credit'] as $name) {
            $this->assertNotContains(strtolower((string) $columns[$name]['type_name']), ['double', 'float', 'real'], "{$name} masih floating.");
        }
    }

    public function test_up_refuses_values_that_overflow_decimal(): void {
        $migration = $this->migration();
        $migration->down();
        $this->insertLine(2.0e16);

        $this->expectException(RuntimeException::class);
        $migration->up();
    }

    public function test_guard_threshold_is_configurable_and_up_succeeds_once_relaxed(): void {
        $migration = $this->migration();
        $migration->down();
        $this->insertLine(0.0, 1.00001234);

        config(['finance.ledger_precision_guard_threshold' => 1e-3]);
        $migration->up();

        $this->assertEquals(['account_id' => 'restrict', 'against_account_id' => 'restrict'], $this->foreignKeyRules());
        $columns = collect(Schema::getColumns('general_ledgers'))->keyBy('name');
        $this->assertNotContains(strtolower((string) $columns['credit']['type_name']), ['double', 'float', 'real']);
        $this->assertSame(1, DB::table('general_ledgers')->count());
    }

    public function test_up_is_safe_to_run_again(): void {
        $migration = $this->migration();
        $this->insertLine(100.25);

        $migration->up();
        $migration->up();

        $this->assertEquals(['account_id' => 'restrict', 'against_account_id' => 'restrict'], $this->foreignKeyRules());
        $this->assertEquals(100.25, DB::table('general_ledgers')->value('debit'));
    }

    public function test_down_then_up_round_trip_keeps_amounts(): void {
        $migration = $this->migration();
        $this->insertLine(1234.5678, 0.0);

        $migration->down();
        $migration->up();

        $this->assertEquals(1234.5678, DB::table('general_ledgers')->value('debit'));
        $this->assertEquals(['account_id' => 'restrict', 'against_account_id' => 'restrict'], $this->foreignKeyRules());
    }

    public function test_down_refuses_values_double_cannot_preserve(): void {
        $this->insertLine(1.5e11);

        $this->expectException(RuntimeException::class);
        $this->migration()->down();
    }

    public function test_account_with_ledger_rows_cannot_be_hard_deleted_after_migration(): void {
        $this->insertLine(100.0);
        DB::statement('PRAGMA foreign_keys = ON');

        $this->expectException(QueryException::class);
        DB::table('accounts')->where('id', $this->cash->id)->delete();
    }
}
