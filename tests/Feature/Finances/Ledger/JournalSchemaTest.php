<?php

namespace Tests\Feature\Finances\Ledger;

use App\Models\Core\Currency;
use App\Models\Finances\FinanceSetting;
use App\Models\Finances\FiscalPeriod;
use App\Models\Finances\FiscalYear;
use App\Models\Finances\Journal;
use App\Models\Finances\JournalVoucher;
use App\Models\User\Permission;
use App\Services\Core\Setting\SettingsService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * Finance Fase 1, Task 2: skema aditif tabel jurnal dan periode fiskal. Fokus F-12 (Requirement 1.7):
 * `DataTable::initPermissions()` menambah kolom saat runtime, jadi tabel baru harus mendeklarasikan eksplisit
 * kolom-kolom itu supaya `initPermissions()` no-op pada deploy pertamanya.
 */
class JournalSchemaTest extends TestCase {
    use RefreshDatabase;

    /**
     * @return array{columns: array<string, array<string, mixed>>, indexes: array<string, array<string, mixed>>}
     */
    private function snapshot(string $table): array {
        $columns = [];
        foreach (Schema::getColumns($table) as $column) {
            $columns[$column['name']] = [
                'type'     => $column['type'],
                'nullable' => $column['nullable'],
                'default'  => $column['default'],
            ];
        }
        ksort($columns);

        $indexes = [];
        foreach (Schema::getIndexes($table) as $index) {
            $indexes[$index['name']] = ['columns' => $index['columns'], 'unique' => $index['unique'], 'primary' => $index['primary']];
        }
        ksort($indexes);

        return ['columns' => $columns, 'indexes' => $indexes];
    }

    public function test_init_permissions_is_a_noop_on_new_tables(): void {
        foreach ([Journal::class, FiscalYear::class, FiscalPeriod::class, JournalVoucher::class] as $model) {
            $table  = (new $model)->getTable();
            $before = $this->snapshot($table);

            $model::initPermissions();

            $this->assertSame($before, $this->snapshot($table), "initPermissions() mengubah skema tabel {$table}.");
        }
    }

    public function test_runtime_columns_are_declared_exactly_as_init_permissions_would_add_them(): void {
        $journals = $this->snapshot('journals');

        // Model non-submitable dengan `$generateCodeSeries`: is_example (+indeks), code (NOT NULL, unik), have_transactions.
        $this->assertFalse($journals['columns']['code']['nullable']);
        $this->assertTrue($journals['indexes']['journals_code_unique']['unique']);
        $this->assertSame(['code'], $journals['indexes']['journals_code_unique']['columns']);
        $this->assertSame(['is_example'], $journals['indexes']['journals_is_example_index']['columns']);
        $this->assertArrayHasKey('have_transactions', $journals['columns']);
        $this->assertArrayNotHasKey('deleted_at', $journals['columns'], 'Jurnal tidak boleh punya soft delete.');
        foreach (['submitted_at', 'canceled_at', 'revision_number', 'amended_from_id', 'additional_data', 'submitted_format', 'parent_id', 'lft', 'rgt', 'depth'] as $forbidden) {
            $this->assertArrayNotHasKey($forbidden, $journals['columns'], "Kolom {$forbidden} bukan milik model non-submitable/non-tree.");
        }

        foreach (['fiscal_years', 'fiscal_periods'] as $table) {
            $snapshot = $this->snapshot($table);
            $this->assertArrayNotHasKey('code', $snapshot['columns'], "{$table} tidak memakai kode series.");
            $this->assertSame(['is_example'], $snapshot['indexes']["{$table}_is_example_index"]['columns']);
            $this->assertArrayHasKey('have_transactions', $snapshot['columns']);
        }
    }

    public function test_journals_table_has_the_columns_of_requirement_1_1(): void {
        $expected = [
            'id', 'code', 'transaction_date', 'fiscal_period_id', 'branch_id', 'status', 'source_type', 'source_id',
            'posting_key', 'reverses_journal_id', 'reversed_by_journal_id', 'reversal_reason', 'currency_code',
            'description', 'total_debit', 'total_credit', 'posted_at', 'posted_by_id', 'legacy_origin',
            'legacy_unbalanced', 'created_at', 'updated_at',
        ];
        foreach ($expected as $column) {
            $this->assertTrue(Schema::hasColumn('journals', $column), "journals.{$column} tidak ada.");
        }

        $indexes = $this->snapshot('journals')['indexes'];
        $this->assertTrue($indexes['journals_posting_key_unique']['unique']);
        $this->assertSame(['source_type', 'source_id'], $indexes['journals_source_type_source_id_index']['columns']);
    }

    public function test_general_ledgers_gain_nullable_journal_columns_and_nullable_against_account(): void {
        $columns = $this->snapshot('general_ledgers')['columns'];

        foreach (['journal_id', 'line_no', 'foreign_currency_code', 'foreign_debit', 'foreign_credit', 'exchange_rate'] as $column) {
            $this->assertArrayHasKey($column, $columns, "general_ledgers.{$column} tidak ada.");
            $this->assertTrue($columns[$column]['nullable'], "general_ledgers.{$column} harus nullable (tabel sudah berisi data).");
        }
        $this->assertTrue($columns['against_account_id']['nullable'], 'Requirement 1.3: against_account_id nullable.');
        $this->assertFalse($columns['account_id']['nullable']);
    }

    public function test_currencies_minor_unit_migration_is_idempotent_and_leaves_unknown_codes_at_default(): void {
        $minorUnit = collect(Schema::getColumns('currencies'))->firstWhere('name', 'minor_unit');
        $this->assertSame('2', trim((string) $minorUnit['default'], "'"));

        foreach (['IDR', 'JPY', 'KWD', 'XXX'] as $code) {
            Currency::create(['code' => $code, 'name' => $code]);
        }

        $migration = require base_path('database/migrations/2026_11_04_100006_add_minor_unit_to_currencies_table.php');
        $migration->up();
        $migration->up();

        $this->assertSame([360, 2], $this->currencyUnit('IDR'));
        $this->assertSame([392, 0], $this->currencyUnit('JPY'));
        $this->assertSame([414, 3], $this->currencyUnit('KWD'));
        $this->assertSame([null, 2], $this->currencyUnit('XXX'), 'Mata uang tak dikenal tetap default 2 tanpa kode numerik.');
    }

    /**
     * @return array{0: int|null, 1: int}
     */
    private function currencyUnit(string $code): array {
        $row = Currency::query()->whereKey($code)->firstOrFail();

        return [$row->numeric_code === null ? null : (int) $row->numeric_code, (int) $row->minor_unit];
    }

    public function test_enforce_fiscal_period_setting_defaults_to_off(): void {
        $setting = app(SettingsService::class)->get(FinanceSetting::class);
        $this->assertFalse($setting->enforce_fiscal_period);

        app(SettingsService::class)->update(FinanceSetting::class, ['enforce_fiscal_period' => true]);
        $this->assertTrue(app(SettingsService::class)->get(FinanceSetting::class)->refresh()->enforce_fiscal_period);
    }

    public function test_permissions_are_registered_with_reverse_and_period_actions(): void {
        Journal::initPermissions();
        FiscalYear::initPermissions();
        FiscalPeriod::initPermissions();

        $journal = Permission::where('model', Journal::class)->firstOrFail();
        foreach (['select', 'read', 'export', 'print', 'reverse'] as $permission) {
            $this->assertContains($permission, $journal->permissions, "Journal harus memiliki izin {$permission}.");
        }
        foreach (['write', 'delete', 'create'] as $permission) {
            $this->assertNotContains($permission, $journal->permissions, "Journal tidak boleh memiliki izin {$permission} (ledger read-only).");
        }

        foreach ([FiscalYear::class, FiscalPeriod::class] as $model) {
            $permission = Permission::where('model', $model)->firstOrFail();
            foreach (['select', 'read', 'write', 'close_period', 'reopen_period'] as $action) {
                $this->assertContains($action, $permission->permissions, "{$model} harus memiliki izin {$action}.");
            }
        }
    }
}
