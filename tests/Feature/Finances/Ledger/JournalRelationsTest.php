<?php

namespace Tests\Feature\Finances\Ledger;

use App\Models\Core\Branch;
use App\Models\Core\CoreSetting;
use App\Models\Core\Currency;
use App\Models\Finances\Account;
use App\Models\Finances\FiscalPeriod;
use App\Models\Finances\FiscalYear;
use App\Models\Finances\GeneralLedger;
use App\Models\Finances\Journal;
use App\Services\Finances\Ledger\FiscalPeriodService;
use App\Services\Finances\Ledger\JournalDraft;
use App\Services\Finances\Ledger\JournalLineDraft;
use App\Services\Finances\Ledger\JournalReversalService;
use App\Services\Finances\Ledger\JournalService;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\Support\BuildsFinanceFixtures;
use Tests\TestCase;

/**
 * Finance Fase 1, Task 2/4: relasi model jurnal, `loadRelationsOnShow()`, dan bentuk skema yang portabel di SQLite
 * (nullability dan FK; tipe kolom `decimal` dan perilaku `ALTER` spesifik MySQL diuji koordinator di MySQL dev).
 * Juga `down()` migration `100004` (urutan lepas FK sebelum indeks, galat MySQL 1553).
 */
class JournalRelationsTest extends TestCase {
    use BuildsFinanceFixtures, RefreshDatabase;

    private Account $cash;
    private Account $revenue;

    protected function setUp(): void {
        parent::setUp();

        $this->setUpFinanceFixtures([Journal::class, FiscalYear::class, FiscalPeriod::class]);
        $this->cash    = $this->makeAccount('1100', 'Kas', 'asset', 'debit', 'cash');
        $this->revenue = $this->makeAccount('4100', 'Penjualan', 'income', 'credit');
    }

    private function postJournal(string $key = 'doc:1:default', string $date = '2026-11-04 09:00:00'): Journal {
        return app(JournalService::class)->post(new JournalDraft(
            CarbonImmutable::parse($date),
            [
                new JournalLineDraft($this->cash->id, 100, 0, againstAccountId: $this->revenue->id),
                new JournalLineDraft($this->revenue->id, 0, 100, againstAccountId: $this->cash->id),
            ],
            $this->branch,
            $key,
            $this->branch->id,
            'Penjualan',
        ));
    }

    public function test_journal_relations_resolve_to_the_expected_models(): void {
        Currency::create(['code' => 'IDR', 'name' => 'Rupiah', 'minor_unit' => 2]);
        CoreSetting::current()->forceFill(['default_currency_id' => 'IDR'])->save();
        $year = app(FiscalPeriodService::class)->generateYear(2026);

        $journal  = $this->postJournal();
        $reversal = app(JournalReversalService::class)->reverse($journal, CarbonImmutable::parse('2026-11-05 09:00:00'), 'Koreksi');
        $journal  = $journal->fresh();

        $this->assertInstanceOf(Branch::class, $journal->source);
        $this->assertTrue($journal->source->is($this->branch));
        $this->assertTrue($journal->branch->is($this->branch));
        $this->assertTrue($journal->postedBy->is($this->user));
        $this->assertSame('2026-11', $journal->fiscalPeriod->name);
        $this->assertTrue($journal->fiscalPeriod->fiscalYear->is($year));
        $this->assertSame('IDR', $journal->currency->code);
        $this->assertTrue($journal->reversedBy->is($reversal));
        $this->assertTrue($reversal->fresh()->reverses->is($journal));
        $this->assertNull($journal->reverses);

        $this->assertCount(2, $journal->lines);
        $this->assertSame([1, 2], $journal->lines->pluck('line_no')->all());
        $this->assertTrue($journal->lines->first()->journal->is($journal));
        $this->assertTrue(GeneralLedger::where('journal_id', $journal->id)->first()->journal->is($journal));
    }

    public function test_fiscal_models_relations(): void {
        $year   = app(FiscalPeriodService::class)->generateYear(2026);
        $period = app(FiscalPeriodService::class)->resolve(CarbonImmutable::parse('2026-11-10'));
        app(FiscalPeriodService::class)->close($period);

        $this->assertCount(12, $year->periods);
        $this->assertTrue($period->fresh()->fiscalYear->is($year));
        $this->assertTrue($period->fresh()->closedBy->is($this->user));
    }

    public function test_load_relations_on_show_names_only_defined_relations(): void {
        $journal   = $this->postJournal();
        $relations = Journal::loadRelationsOnShow();

        $this->assertSame(['fiscalPeriod', 'branch', 'source', 'reverses', 'reversedBy', 'postedBy'], $relations);

        $loaded = $journal->fresh()->load($relations);
        foreach ($relations as $relation) {
            $this->assertTrue($loaded->relationLoaded($relation), "Relasi {$relation} tidak termuat.");
        }
    }

    public function test_general_ledgers_foreign_keys_and_nullability(): void {
        $columns = collect(Schema::getColumns('general_ledgers'))->keyBy('name');
        foreach (['journal_id', 'line_no', 'foreign_currency_code', 'foreign_debit', 'foreign_credit', 'exchange_rate', 'against_account_id'] as $column) {
            $this->assertTrue($columns[$column]['nullable'], "general_ledgers.{$column} harus nullable.");
        }

        $foreignKeys = collect(Schema::getForeignKeys('general_ledgers'));
        $journalFk   = $foreignKeys->first(fn (array $fk) => $fk['columns'] === ['journal_id']);
        $currencyFk  = $foreignKeys->first(fn (array $fk) => $fk['columns'] === ['foreign_currency_code']);

        $this->assertNotNull($journalFk, 'FK journal_id tidak ada.');
        $this->assertSame('journals', $journalFk['foreign_table']);
        $this->assertSame('restrict', strtolower($journalFk['on_delete']), 'Jurnal tidak boleh terhapus bila masih punya baris.');
        $this->assertNotNull($currencyFk, 'FK foreign_currency_code tidak ada.');
        $this->assertSame('currencies', $currencyFk['foreign_table']);
        $this->assertSame('restrict', strtolower($currencyFk['on_delete']));
    }

    public function test_journals_and_fiscal_tables_foreign_keys(): void {
        $expected = [
            'journals'       => ['fiscal_period_id' => 'fiscal_periods', 'reverses_journal_id' => 'journals', 'reversed_by_journal_id' => 'journals', 'currency_code' => 'currencies'],
            'fiscal_periods' => ['fiscal_year_id' => 'fiscal_years'],
        ];

        foreach ($expected as $table => $columns) {
            $foreignKeys = collect(Schema::getForeignKeys($table));
            foreach ($columns as $column => $referencedTable) {
                $fk = $foreignKeys->first(fn (array $key) => $key['columns'] === [$column]);
                $this->assertNotNull($fk, "FK {$table}.{$column} tidak ada.");
                $this->assertSame($referencedTable, $fk['foreign_table']);
                $this->assertSame('restrict', strtolower($fk['on_delete']), "{$table}.{$column} harus restrict.");
            }
        }
    }

    public function test_journal_columns_are_defined_for_the_ledger_amounts(): void {
        $columns = collect(Schema::getColumns('journals'))->keyBy('name');

        foreach (['total_debit', 'total_credit'] as $column) {
            // SQLite melaporkan `numeric`, MySQL `decimal(20,4)` (presisi diuji koordinator di MySQL dev).
            $this->assertMatchesRegularExpression('/^(numeric|decimal)/i', (string) $columns[$column]['type'], "journals.{$column} harus bertipe desimal.");
            $this->assertFalse($columns[$column]['nullable']);
        }
        $this->assertFalse($columns['status']['nullable']);
        $this->assertFalse($columns['code']['nullable']);
        $this->assertTrue($columns['posting_key']['nullable']);
    }

    public function test_general_ledger_migration_down_drops_foreign_keys_before_indexes_and_up_restores_it(): void {
        $migration = require base_path('database/migrations/2026_11_04_100004_add_journal_columns_to_general_ledgers_table.php');

        $migration->down();

        foreach (['journal_id', 'line_no', 'foreign_currency_code', 'foreign_debit', 'foreign_credit', 'exchange_rate'] as $column) {
            $this->assertFalse(Schema::hasColumn('general_ledgers', $column), "{$column} seharusnya terhapus.");
        }
        $indexColumns = collect(Schema::getIndexes('general_ledgers'))->pluck('columns')->map(fn (array $columns) => implode(',', $columns));
        $this->assertContains('account_id', $indexColumns->all(), 'Indeks tunggal account_id (penopang FK akun di MySQL) harus ada setelah down().');
        $this->assertNotContains('account_id,transaction_date', $indexColumns->all());
        $this->assertNotContains('journal_id,line_no', $indexColumns->all());

        $migration->up();

        $this->assertTrue(Schema::hasColumn('general_ledgers', 'journal_id'));
        $this->assertTrue(collect(Schema::getForeignKeys('general_ledgers'))->contains(fn (array $fk) => $fk['columns'] === ['journal_id']));
    }
}
