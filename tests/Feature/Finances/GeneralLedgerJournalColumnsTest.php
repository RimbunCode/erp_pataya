<?php

namespace Tests\Feature\Finances;

use App\Models\Finances\FiscalPeriod;
use App\Models\Finances\FiscalYear;
use App\Models\Finances\GeneralLedger;
use App\Models\Finances\Journal;
use App\Models\Inventory\StockEntry;
use App\Services\Core\DataTableConfigValidator;
use App\Services\Finances\Ledger\JournalDraft;
use App\Services\Finances\Ledger\JournalLineDraft;
use App\Services\Finances\Ledger\JournalService;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;
use Tests\Support\BuildsFinanceFixtures;
use Tests\TestCase;

/**
 * Finance Fase 1, Task 10.4 (Requirement 11.3): halaman General Ledger menampilkan kolom `Journal` dan
 * "Beberapa akun" bila `against_account_id` null (jurnal 3 baris atau lebih), tanpa mengubah perilaku lama.
 */
class GeneralLedgerJournalColumnsTest extends TestCase {
    use BuildsFinanceFixtures, RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        $this->setUpFinanceFixtures([Journal::class, FiscalYear::class, FiscalPeriod::class, StockEntry::class]);
    }

    /**
     * @return array<string, array<string, mixed>>
     */
    private function columns(): array {
        return collect(GeneralLedger::computeColumnsFlat(true))->keyBy('name')->all();
    }

    public function test_config_columns_pass_the_datatable_validator(): void {
        $this->assertSame([], DataTableConfigValidator::validate(GeneralLedger::class));
        $this->assertSame([], DataTableConfigValidator::validate(Journal::class));
    }

    public function test_journal_link_column_is_a_visible_relation_to_journals(): void {
        $journal = $this->columns()['journal'];

        $this->assertSame('relation', $journal['type']);
        $this->assertTrue($journal['show']);
        $this->assertSame('journals.show', $journal['route']);
    }

    public function test_against_account_view_column_falls_back_to_multiple_accounts_label_via_template(): void {
        $columns = $this->columns();

        $view = $columns['against_account_view'];
        $this->assertTrue($view['show']);
        $this->assertStringContainsString(':against_account.account_name', $view['template']);
        $this->assertStringContainsString(':multiple_accounts|trans', $view['template']);
        $this->assertSame('finances.generalLedger.multiple_accounts_state', $view['valueTrans']);

        $this->assertSame('number', $columns['multiple_accounts']['type']);
        $this->assertFalse($columns['multiple_accounts']['show']);
        $this->assertFalse($columns['against_account']['show'], 'Kolom relasi tetap ada untuk filter tetapi tersembunyi.');

        $this->assertSame('Multiple accounts', __('finances/generalLedger.multiple_accounts_state.1', [], 'en'));
        $this->assertSame('Beberapa akun', __('finances/generalLedger.multiple_accounts_state.1', [], 'id'));
    }

    public function test_index_rows_expose_journal_relation_and_multiple_accounts_flag(): void {
        $cash    = $this->makeAccount('1100', 'Kas');
        $revenue = $this->makeAccount('4100', 'Penjualan', 'income', 'credit');
        $tax     = $this->makeAccount('2100', 'Utang Pajak', 'liability', 'credit');

        $journal = app(JournalService::class)->post(new JournalDraft(
            CarbonImmutable::parse('2026-11-04 09:00:00'),
            [
                new JournalLineDraft($cash->id, 111000, 0),
                new JournalLineDraft($revenue->id, 0, 100000),
                new JournalLineDraft($tax->id, 0, 11000),
            ],
        ));
        $legacy = $this->makeLedger($this->makeStockEntry(), $cash, $revenue, 50, 0);

        $grant = [0 => [['model' => GeneralLedger::class, 'level' => 0, 'only_creator' => false, 'permissions' => ['select' => true, 'read' => true]]]];

        $this->withSession(['permissions' => [GeneralLedger::class => $grant], 'permissions_version' => '0|0|0|0', 'currentBranch' => null])
            ->withCookie('lang', 'en')
            ->actingAs($this->user)
            ->get(route('generalLedgers.index'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Finances/GeneralLedger')
                ->where('data.data', function ($rows) use ($journal, $legacy) {
                    $rows   = collect($rows);
                    $multi  = $rows->where('journal_id', $journal->id);
                    $single = $rows->firstWhere('id', $legacy->id);

                    return $multi->count() === 3
                        && $multi->every(fn ($row) => (int) $row['multiple_accounts'] === 1 && ($row['against_account'] ?? null) === null)
                        && $multi->every(fn ($row) => ($row['journal']['code'] ?? null) === $journal->code)
                        && $single !== null
                        && (int) $single['multiple_accounts'] === 0
                        && $single['against_account']['account_name'] === 'Penjualan'
                        && ($single['journal'] ?? null) === null;
                }));
    }

    public function test_show_includes_the_journal_relation(): void {
        $cash    = $this->makeAccount('1100', 'Kas');
        $revenue = $this->makeAccount('4100', 'Penjualan', 'income', 'credit');
        $journal = app(JournalService::class)->post(new JournalDraft(
            CarbonImmutable::parse('2026-11-04 09:00:00'),
            [new JournalLineDraft($cash->id, 100, 0, againstAccountId: $revenue->id), new JournalLineDraft($revenue->id, 0, 100, againstAccountId: $cash->id)],
        ));
        $line  = GeneralLedger::query()->where('journal_id', $journal->id)->orderBy('line_no')->firstOrFail();
        $grant = [0 => [['model' => GeneralLedger::class, 'level' => 0, 'only_creator' => false, 'permissions' => ['select' => true, 'read' => true]]]];

        $this->withSession(['permissions' => [GeneralLedger::class => $grant], 'permissions_version' => '0|0|0|0', 'currentBranch' => null])
            ->withCookie('lang', 'en')
            ->actingAs($this->user)
            ->get(route('generalLedgers.show', $line))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Finances/GeneralLedgers/Show')
                ->where('generalLedger.journal.id', $journal->id)
                ->where('generalLedger.journal.code', $journal->code));
    }
}
