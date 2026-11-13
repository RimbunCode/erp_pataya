<?php

namespace Tests\Feature\Finances\Posting;

use App\Enums\FormStatus;
use App\Enums\PostingDocumentType;
use App\Exceptions\Finances\InvalidJournalException;
use App\Exceptions\Finances\PartialPostingException;
use App\Exceptions\Finances\UnbalancedJournalException;
use App\Exceptions\Finances\UnknownPostingDocumentTypeException;
use App\Models\Core\GlPostingStatus;
use App\Models\Finances\Account;
use App\Models\Finances\GeneralLedger;
use App\Models\Finances\Journal;
use App\Models\Finances\PostingProfile;
use App\Models\Inventory\StockEntry;
use App\Services\Finances\Ledger\JournalDraft;
use App\Services\Finances\Ledger\JournalLineDraft;
use App\Services\Finances\Ledger\JournalService;
use App\Services\Finances\Posting\AccountRoleResolver;
use App\Services\Finances\Posting\CanceledSourceGuard;
use App\Services\Finances\Posting\Contexts\LineAttributes;
use App\Services\Finances\Posting\Contexts\PostingContext;
use App\Services\Finances\Posting\PostingOutcome;
use App\Services\Finances\Posting\PostingProfileService;
use App\Services\Finances\Posting\PostingRuleRegistry;
use App\Services\Finances\Posting\PostingService;
use App\Services\Finances\Posting\RoleJournalDraft;
use App\Services\Finances\Posting\RoleLine;
use App\Services\Finances\Posting\Rules\PostingRule;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Tests\Support\BuildsFinanceFixtures;
use Tests\TestCase;

/**
 * Finance Fase 2, Task 4.4-4.5: `PostingService::preview()/post()` (Requirement 5). P-4 idempoten, sebagian ada ->
 * `PartialPostingException`, atomik multi-jurnal, guard dokumen `canceled` (F-16), jurnal nol setelah pembulatan tidak
 * dibuat, penggabungan baris peka-barang tetap seimbang (P-12).
 */
class PostingServiceTest extends TestCase {
    use BuildsFinanceFixtures, RefreshDatabase;

    private Account $receivable;
    private Account $revenue;
    private Account $revenueNonStock;
    private Account $stock;
    private Account $srnb;
    private Account $payable;
    private StockEntry $source;

    protected function setUp(): void {
        parent::setUp();

        $this->setUpFinanceFixtures([PostingProfile::class, StockEntry::class]);

        $this->receivable      = $this->makeAccount('1210', 'Piutang', 'asset');
        $this->revenue         = $this->makeAccount('4110', 'Penjualan Barang', 'income', 'credit');
        $this->revenueNonStock = $this->makeAccount('4120', 'Penjualan Jasa', 'income', 'credit');
        $this->stock           = $this->makeAccount('1241', 'Persediaan', 'asset');
        $this->srnb            = $this->makeAccount('2150', 'SRNB', 'liability', 'credit');
        $this->payable         = $this->makeAccount('2211', 'Hutang', 'liability', 'credit');

        $profiles = app(PostingProfileService::class);
        $profiles->activate($profiles->createDraft('Profil', '2026-01-01', null, [
            'receivable'                    => $this->receivable->id,
            'revenue'                       => $this->revenue->id,
            'stock'                         => $this->stock->id,
            'stock_received_but_not_billed' => $this->srnb->id,
            'expense'                       => $this->srnb->id,
            'payable'                       => $this->payable->id,
        ], [
            ['role' => 'revenue', 'account_id' => $this->revenueNonStock->id, 'is_stock_item' => false],
        ]));

        $this->source = $this->makeStockEntry();
    }

    /**
     * Bukti keseimbangan dari baris-barisnya (bukan dari kolom total, yang dibentuk dari sisi debit).
     */
    private function assertJournalBalanced(Journal $journal, float $expectedTotal): void {
        $lines  = GeneralLedger::query()->where('journal_id', $journal->id)->get();
        $debit  = round((float) $lines->sum('debit'), 4);
        $credit = round((float) $lines->sum('credit'), 4);

        $this->assertEqualsWithDelta($expectedTotal, $debit, 1e-9);
        $this->assertEqualsWithDelta($debit, $credit, 1e-9, 'Σdebit baris = Σkredit baris');
    }

    /**
     * Rule tiga purpose (`first`, `second`, `third`), masing-masing pasangan stok/SRNB 100.
     *
     * @param  list<string>  $purposes
     */
    private function serviceWithPurposes(array $purposes): PostingService {
        $rule = new class($purposes) implements PostingRule
        {
            /** @param list<string> $purposes */
            public function __construct(private array $purposes) {}

            public function documentType(): PostingDocumentType {
                return PostingDocumentType::PurchaseInvoice;
            }

            public function build(PostingContext $ctx): array {
                return array_map(fn (string $purpose): RoleJournalDraft => new RoleJournalDraft($purpose, [
                    RoleLine::debit('stock', 100),
                    RoleLine::credit('stock_received_but_not_billed', 100),
                ]), $this->purposes);
            }
        };

        return new PostingService(new PostingRuleRegistry([$rule]), app(AccountRoleResolver::class), app(JournalService::class), app(CanceledSourceGuard::class));
    }

    /**
     * Saat jurnal `first` selesai dibuat, proses "lain" menulis `$rivalPurpose` (meniru balapan setelah pra-pemeriksaan).
     */
    private function rivalWritesWhenFirstIsCreated(string $rivalPurpose): void {
        $armed = true;
        Event::listen('eloquent.created: ' . Journal::class, function (Journal $journal) use (&$armed, $rivalPurpose): void {
            if (! $armed || ! str_ends_with((string) $journal->posting_key, ':first')) {
                return;
            }
            $armed = false;
            app(JournalService::class)->post(new JournalDraft(
                transactionDate: CarbonImmutable::parse('2026-11-12 10:00:00'),
                lines: [new JournalLineDraft($this->stock->id, debit: 100), new JournalLineDraft($this->srnb->id, credit: 100)],
                postingKey: $this->key($rivalPurpose),
                sourceType: StockEntry::class,
                sourceId: (string) $this->source->getKey(),
            ));
        });
    }

    private function key(string $purpose): string {
        return StockEntry::class . ':' . $this->source->getKey() . ':' . $purpose;
    }

    private function service(): PostingService {
        return app(PostingService::class);
    }

    /**
     * @param  array<string, float|int>  $amounts
     * @param  array<string, mixed>  $flags
     * @param  list<LineAttributes>  $lines
     */
    private function ctx(PostingDocumentType $type, array $amounts, array $flags = [], array $lines = []): PostingContext {
        return new PostingContext($type, $this->source::class, $this->source->getKey(), CarbonImmutable::parse('2026-11-12 10:00:00'), null, $amounts, $flags, [], $lines);
    }

    public function test_preview_resolves_real_accounts_and_writes_nothing(): void {
        $drafts = $this->service()->preview($this->ctx(PostingDocumentType::PurchaseInvoice, ['total' => 1000, 'stock_total' => 600]));

        $this->assertCount(2, $drafts);
        $this->assertSame($this->key('stock'), $drafts[0]->postingKey);
        $this->assertSame($this->stock->id, $drafts[0]->lines[0]->accountId);
        $this->assertEquals(600, $drafts[0]->lines[0]->debit);
        $this->assertSame($this->srnb->id, $drafts[0]->lines[1]->accountId);
        $this->assertSame($this->srnb->id, $drafts[0]->lines[0]->againstAccountId);
        $this->assertSame($this->source::class, $drafts[0]->sourceType);

        $this->assertSame(0, Journal::count());
    }

    public function test_post_writes_all_journals_with_posting_keys(): void {
        $outcome  = $this->service()->post($this->ctx(PostingDocumentType::PurchaseInvoice, ['total' => 1000, 'stock_total' => 600]));
        $journals = $outcome->journals;

        $this->assertSame(PostingOutcome::POSTED, $outcome->status);
        $this->assertCount(2, $journals);
        $this->assertSame(2, Journal::count());
        $this->assertSame(
            [$this->key('expense'), $this->key('stock')],
            Journal::query()->orderBy('posting_key')->pluck('posting_key')->all(),
        );

        $expense = Journal::query()->where('posting_key', 'like', '%:expense')->firstOrFail();
        $lines   = GeneralLedger::query()->where('journal_id', $expense->id)->orderByDesc('debit')->get();
        $this->assertSame($this->srnb->id, $lines[0]->account_id);
        $this->assertEquals(1000, $lines[0]->debit);
        $this->assertSame($this->payable->id, $lines[1]->account_id);
        $this->assertEquals(1000, $lines[1]->credit);
    }

    public function test_post_is_idempotent_p4(): void {
        $ctx   = $this->ctx(PostingDocumentType::PurchaseInvoice, ['total' => 1000, 'stock_total' => 600]);
        $first = $this->service()->post($ctx);
        $again = $this->service()->post($ctx);
        $this->assertSame(PostingOutcome::POSTED, $first->status);
        $this->assertSame(PostingOutcome::ALREADY_POSTED, $again->status);
        $first = $first->journals;
        $again = $again->journals;

        $this->assertSame(2, Journal::count());
        $this->assertSame(array_map(fn (Journal $j): string => $j->id, $first), array_map(fn (Journal $j): string => $j->id, $again));
        $this->assertSame(4, GeneralLedger::count());
    }

    public function test_partially_existing_journals_are_reported_not_completed(): void {
        $ctx = $this->ctx(PostingDocumentType::PurchaseInvoice, ['total' => 1000, 'stock_total' => 600]);
        $this->service()->post($ctx);

        $stockJournal = Journal::query()->where('posting_key', 'like', '%:stock')->firstOrFail();
        DB::table('general_ledgers')->where('journal_id', $stockJournal->id)->delete();
        DB::table('journals')->where('id', $stockJournal->id)->delete();

        try {
            $this->service()->post($ctx);
            $this->fail('PartialPostingException diharapkan.');
        } catch (PartialPostingException $e) {
            $this->assertCount(1, $e->existingKeys);
            $this->assertStringEndsWith(':expense', $e->existingKeys[0]);
            $this->assertStringEndsWith(':stock', $e->missingKeys[0]);
        }

        $this->assertSame(1, Journal::count(), 'Sisanya tidak ditulis diam-diam.');
    }

    public function test_failure_of_a_later_journal_rolls_back_the_earlier_one(): void {
        $broken = new class implements PostingRule
        {
            public function documentType(): PostingDocumentType {
                return PostingDocumentType::PurchaseInvoice;
            }

            public function build(PostingContext $ctx): array {
                return [
                    new RoleJournalDraft('first', [RoleLine::debit('stock', 100), RoleLine::credit('stock_received_but_not_billed', 100)]),
                    new RoleJournalDraft('second', [RoleLine::debit('stock', 100), RoleLine::credit('stock_received_but_not_billed', 40)]),
                ];
            }
        };
        $service = new PostingService(new PostingRuleRegistry([$broken]), app(AccountRoleResolver::class), app(JournalService::class), app(CanceledSourceGuard::class));

        try {
            $service->post($this->ctx(PostingDocumentType::PurchaseInvoice, ['total' => 100]));
            $this->fail('Jurnal kedua tak seimbang harus gagal.');
        } catch (UnbalancedJournalException|InvalidJournalException) {
            // diharapkan
        }

        $this->assertSame(0, Journal::count(), 'Jurnal pertama harus ikut tergulung (atomik).');
        $this->assertSame(0, GeneralLedger::count());
    }

    public function test_unknown_document_type_is_rejected(): void {
        $service = new PostingService(new PostingRuleRegistry([]), app(AccountRoleResolver::class), app(JournalService::class), app(CanceledSourceGuard::class));

        $this->expectException(UnknownPostingDocumentTypeException::class);
        $service->post($this->ctx(PostingDocumentType::SalesInvoice, ['total' => 100]));
    }

    public function test_canceled_source_is_skipped_and_pending_status_becomes_skipped(): void {
        $this->source->update(['status' => [FormStatus::CANCELED]]);
        GlPostingStatus::create(['referenceable_type' => $this->source::class, 'referenceable_id' => $this->source->getKey(), 'status' => 'pending']);

        $result = $this->service()->post($this->ctx(PostingDocumentType::PurchaseReceipt, ['total' => 500]));

        $this->assertSame(PostingOutcome::SKIPPED, $result->status);
        $this->assertSame([], $result->journals);
        $this->assertSame(0, Journal::count());
        $this->assertSame('skipped', GlPostingStatus::query()->where('referenceable_id', $this->source->getKey())->value('status')->value ?? null);
    }

    public function test_amount_that_rounds_to_zero_creates_no_journal(): void {
        $ctx = $this->ctx(PostingDocumentType::PurchaseReceipt, ['total' => 0.001]);

        $this->assertSame([], $this->service()->preview($ctx));
        $zero = $this->service()->post($ctx);
        $this->assertSame(PostingOutcome::POSTED, $zero->status);
        $this->assertSame([], $zero->journals);
        $this->assertSame(0, Journal::count());
    }

    public function test_line_sensitive_lines_merge_per_account_and_stay_balanced_p12(): void {
        $lines = [
            new LineAttributes(['amount' => 33.33], isStockItem: true),
            new LineAttributes(['amount' => 33.33], isStockItem: true),
            new LineAttributes(['amount' => 33.34], isStockItem: false),
            new LineAttributes(['amount' => 0.01], isStockItem: false),
        ];
        $ctx = $this->ctx(PostingDocumentType::SalesInvoice, ['total' => 100.01], lines: $lines);

        $drafts = $this->service()->preview($ctx);
        $this->assertCount(1, $drafts);
        $byAccount = [];
        foreach ($drafts[0]->lines as $line) {
            $byAccount[$line->accountId] = [(float) $line->debit, (float) $line->credit];
        }

        $this->assertCount(3, $byAccount, 'Baris dengan akun sama digabung (revenue stok 2 baris -> 1).');
        $this->assertEqualsWithDelta(66.66, $byAccount[$this->revenue->id][1], 1e-9);
        $this->assertEqualsWithDelta(33.35, $byAccount[$this->revenueNonStock->id][1], 1e-9);
        $this->assertEqualsWithDelta(100.01, $byAccount[$this->receivable->id][0], 1e-9);

        $journals = $this->service()->post($ctx)->journals;
        $this->assertJournalBalanced($journals[0], 100.01);
    }

    public function test_split_rounding_difference_is_absorbed_so_the_journal_balances(): void {
        // Dua baris 0,335 pada akun berbeda: dibulatkan satu per satu 0,34 + 0,34 = 0,68, sedangkan total 0,67.
        $lines = [
            new LineAttributes(['amount' => 0.335], isStockItem: true),
            new LineAttributes(['amount' => 0.335], isStockItem: false),
        ];
        $ctx = $this->ctx(PostingDocumentType::SalesInvoice, ['total' => 0.67], lines: $lines);

        $journals = $this->service()->post($ctx)->journals;

        $this->assertCount(1, $journals);
        $this->assertJournalBalanced($journals[0], 0.67);
    }

    public function test_duplicate_race_with_all_keys_present_returns_the_existing_journals(): void {
        $this->rivalWritesWhenFirstIsCreated('second');

        $outcome  = $this->serviceWithPurposes(['first', 'second'])->post($this->ctx(PostingDocumentType::PurchaseInvoice, ['total' => 100]));
        $journals = $outcome->journals;
        $this->assertSame(PostingOutcome::ALREADY_POSTED, $outcome->status);

        $this->assertCount(2, $journals);
        $this->assertSame(2, Journal::count());
        $this->assertEqualsCanonicalizing([$this->key('first'), $this->key('second')], array_map(fn (Journal $j): string => $j->posting_key, $journals));
    }

    public function test_duplicate_race_with_some_keys_missing_is_partial_and_rolls_back(): void {
        $this->rivalWritesWhenFirstIsCreated('second');

        try {
            $this->serviceWithPurposes(['first', 'second', 'third'])->post($this->ctx(PostingDocumentType::PurchaseInvoice, ['total' => 100]));
            $this->fail('PartialPostingException diharapkan.');
        } catch (PartialPostingException $e) {
            $this->assertStringEndsWith(':third', $e->missingKeys[0]);
        }
    }

    public function test_canceled_guard_reads_the_source_inside_the_posting_transaction(): void {
        $levels = [];
        DB::listen(function ($query) use (&$levels): void {
            if (str_contains($query->sql, 'stock_entries')) {
                $levels[] = DB::transactionLevel();
            }
        });

        $this->service()->post($this->ctx(PostingDocumentType::PurchaseReceipt, ['total' => 500]));

        // Bukti terbatas: SQLite mengabaikan FOR UPDATE dan race sungguhan tak dapat disimulasikan di sini; yang
        // dibuktikan adalah pembacaan status sumber terjadi di dalam transaksi (tempat kunci baris berlaku di MySQL).
        $this->assertNotEmpty($levels, 'Guard harus membaca sumber.');
        $this->assertSame([], array_filter($levels, fn (int $level): bool => $level < 1), 'Status sumber dibaca di luar transaksi.');
    }

    public function test_guard_document_other_than_the_source_decides_the_skip_and_targets_its_status_row(): void {
        // Sumber = aset (di sini StockEntry sebagai pengganti), penjaga = Sales Invoice (di sini StockEntry kedua).
        $guard = $this->makeStockEntry([FormStatus::CANCELED]);
        GlPostingStatus::create(['referenceable_type' => $guard::class, 'referenceable_id' => $guard->getKey(), 'status' => 'pending']);
        GlPostingStatus::create(['referenceable_type' => $this->source::class, 'referenceable_id' => $this->source->getKey(), 'status' => 'pending']);

        $ctx = new PostingContext(
            PostingDocumentType::PurchaseReceipt,
            $this->source::class,
            $this->source->getKey(),
            CarbonImmutable::parse('2026-11-12 10:00:00'),
            null,
            ['total' => 500],
            guardDocument: ['type' => $guard::class, 'id' => $guard->getKey()],
        );

        $outcome = $this->service()->post($ctx);

        $this->assertSame(PostingOutcome::SKIPPED, $outcome->status);
        $this->assertSame(0, Journal::count());
        $this->assertSame('skipped', GlPostingStatus::query()->where('referenceable_id', $guard->getKey())->firstOrFail()->status->value);
        $this->assertSame('pending', GlPostingStatus::query()->where('referenceable_id', $this->source->getKey())->firstOrFail()->status->value, 'Baris status sumber tidak disentuh.');
    }

    public function test_canceled_source_does_not_skip_when_a_live_guard_document_is_given(): void {
        $this->source->update(['status' => [FormStatus::CANCELED]]);
        $guard = $this->makeStockEntry();

        $ctx = new PostingContext(
            PostingDocumentType::PurchaseReceipt,
            $this->source::class,
            $this->source->getKey(),
            CarbonImmutable::parse('2026-11-12 10:00:00'),
            null,
            ['total' => 500],
            guardDocument: ['type' => $guard::class, 'id' => $guard->getKey()],
        );

        $this->assertSame(PostingOutcome::POSTED, $this->service()->post($ctx)->status);
        $this->assertSame(1, Journal::count());
    }

    public function test_duplicate_race_path_rereads_existing_keys_with_a_locking_read(): void {
        // Bukti terbatas (SQLite, satu proses): FOR UPDATE diabaikan dan REPEATABLE READ tak dapat disimulasikan; yang
        // dibuktikan adalah jalur duplikat membaca ulang kunci lewat query khusus yang dikunci (lihat existingJournals).
        $this->rivalWritesWhenFirstIsCreated('second');
        $selects = 0;
        DB::listen(function ($query) use (&$selects): void {
            if (str_starts_with(strtolower($query->sql), 'select') && str_contains($query->sql, 'posting_key') && str_contains($query->sql, 'journals')) {
                $selects++;
            }
        });

        $outcome = $this->serviceWithPurposes(['first', 'second'])->post($this->ctx(PostingDocumentType::PurchaseInvoice, ['total' => 100]));

        $this->assertSame(PostingOutcome::ALREADY_POSTED, $outcome->status);
        $this->assertGreaterThanOrEqual(2, $selects, 'Pra-pemeriksaan dan pembacaan ulang setelah duplikat.');
    }
}
