<?php

namespace Tests\Feature\Finances\Ledger;

use Illuminate\Database\Migrations\Migration;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use RuntimeException;
use Tests\Support\BuildsFinanceFixtures;
use Tests\TestCase;

/**
 * Finance Fase 1, Task 9.1 (Rilis 2; Requirement 13.5): migration NOT NULL `general_ledgers.journal_id` menolak jalan
 * bila masih ada baris tanpa jurnal (aktif maupun soft-deleted), aman diulang, dan dapat dibalik.
 */
class JournalIdNotNullMigrationTest extends TestCase {
    use BuildsFinanceFixtures, RefreshDatabase;

    private Migration $migration;

    protected function setUp(): void {
        parent::setUp();

        $this->setUpFinanceFixtures();
        $this->migration = require base_path('database/migrations/2026_11_21_100002_make_journal_id_not_null_on_general_ledgers_table.php');
    }

    private function journalIdIsNullable(): bool {
        return (bool) collect(Schema::getColumns('general_ledgers'))->firstWhere('name', 'journal_id')['nullable'];
    }

    private function insertLedgerRow(?string $journalId, bool $softDeleted = false): void {
        $suffix    = fake()->unique()->numerify('####');
        $accountId = $this->makeAccount("1{$suffix}", "Kas {$suffix}")->id;
        $against   = $this->makeAccount("4{$suffix}", "Penjualan {$suffix}", 'income', 'credit')->id;

        DB::table('general_ledgers')->insert([
            'id'                 => (string) Str::ulid(),
            'code'               => 'GL-' . fake()->unique()->numerify('######'),
            'account_id'         => $accountId,
            'against_account_id' => $against,
            'journal_id'         => $journalId,
            'referenceable_type' => 'App\\Models\\Finances\\SalesInvoice',
            'referenceable_id'   => (string) Str::ulid(),
            'transaction_date'   => now(),
            'debit'              => 100,
            'credit'             => 0,
            'created_at'         => now(),
            'updated_at'         => now(),
            'deleted_at'         => $softDeleted ? now() : null,
        ]);
    }

    public function test_fresh_schema_has_journal_id_not_null(): void {
        $this->assertFalse($this->journalIdIsNullable());
    }

    public function test_up_refuses_when_an_active_row_has_no_journal_and_leaves_the_schema_unchanged(): void {
        $this->allowLegacyLedgerRows();
        $this->insertLedgerRow(null);

        try {
            $this->migration->up();
            $this->fail('RuntimeException diharapkan.');
        } catch (RuntimeException $e) {
            $this->assertStringContainsString('finance:backfill-journals', $e->getMessage());
        }

        $this->assertTrue($this->journalIdIsNullable());
    }

    public function test_up_refuses_when_only_a_soft_deleted_row_has_no_journal(): void {
        $this->allowLegacyLedgerRows();
        $this->insertLedgerRow(null, softDeleted: true);

        $this->expectException(RuntimeException::class);
        $this->migration->up();
    }

    public function test_up_succeeds_when_no_row_lacks_a_journal_and_is_safe_to_run_again(): void {
        $this->allowLegacyLedgerRows();
        $this->assertTrue($this->journalIdIsNullable());

        $this->migration->up();
        $this->assertFalse($this->journalIdIsNullable());

        $this->migration->up(); // idempoten
        $this->assertFalse($this->journalIdIsNullable());
    }

    public function test_down_restores_nullable_and_is_safe_to_run_again(): void {
        $this->migration->down();
        $this->assertTrue($this->journalIdIsNullable());

        $this->migration->down(); // idempoten
        $this->assertTrue($this->journalIdIsNullable());
    }
}
