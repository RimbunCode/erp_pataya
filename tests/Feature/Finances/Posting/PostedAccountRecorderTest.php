<?php

namespace Tests\Feature\Finances\Posting;

use App\Enums\FormStatus;
use App\Enums\PostingDocumentType;
use App\Models\Finances\Account;
use App\Models\Finances\Journal;
use App\Models\Finances\PostingProfile;
use App\Models\Inventory\StockEntry;
use App\Services\Finances\Ledger\JournalService;
use App\Services\Finances\Posting\AccountRoleResolver;
use App\Services\Finances\Posting\CanceledSourceGuard;
use App\Services\Finances\Posting\Contexts\LineAttributes;
use App\Services\Finances\Posting\Contexts\PostingContext;
use App\Services\Finances\Posting\PostedAccountNote;
use App\Services\Finances\Posting\PostedAccountNotes;
use App\Services\Finances\Posting\PostedAccountRecorder;
use App\Services\Finances\Posting\PostedAccountRecorderRegistry;
use App\Services\Finances\Posting\PostingProfileService;
use App\Services\Finances\Posting\PostingRuleRegistry;
use App\Services\Finances\Posting\PostingService;
use App\Services\Finances\Posting\RoleJournalDraft;
use App\Services\Finances\Posting\RoleLine;
use App\Services\Finances\Posting\Rules\PostingRule;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use Tests\Support\BuildsFinanceFixtures;
use Tests\TestCase;

/**
 * Finance Fase 2, Task 12.1 (Requirement 13.2): `PostingService` mencatat akun hasil resolve dan memanggil
 * `PostedAccountRecorderRegistry` di transaksi yang sama dengan jurnal, hanya pada hasil `posted`.
 */
class PostedAccountRecorderTest extends TestCase {
    use BuildsFinanceFixtures, RefreshDatabase;

    private Account $receivable;
    private Account $revenue;
    private Account $revenueNonStock;
    private StockEntry $source;

    protected function setUp(): void {
        parent::setUp();

        $this->setUpFinanceFixtures([PostingProfile::class, StockEntry::class]);

        $this->receivable      = $this->makeAccount('1210', 'Piutang', 'asset');
        $this->revenue         = $this->makeAccount('4110', 'Penjualan Barang', 'income', 'credit');
        $this->revenueNonStock = $this->makeAccount('4120', 'Penjualan Jasa', 'income', 'credit');

        $profiles = app(PostingProfileService::class);
        $profiles->activate($profiles->createDraft('Profil', '2026-01-01', null, [
            'receivable' => $this->receivable->id,
            'revenue'    => $this->revenue->id,
        ], [
            ['role' => 'revenue', 'account_id' => $this->revenueNonStock->id, 'is_stock_item' => false],
        ]));

        $this->source = $this->makeStockEntry();
        SpyRecorder::reset();
    }

    protected function tearDown(): void {
        SpyRecorder::reset();
        parent::tearDown();
    }

    /**
     * Rule uji: satu jurnal `main`; piutang sebesar `total`, satu baris pendapatan per baris konteks.
     */
    private function service(?PostedAccountRecorderRegistry $recorders): PostingService {
        $rule = new class implements PostingRule
        {
            public function documentType(): PostingDocumentType {
                return PostingDocumentType::SalesInvoice;
            }

            public function build(PostingContext $ctx): array {
                if ((float) $ctx->amounts['total'] <= 0) {
                    return [];
                }

                $lines = [RoleLine::debit('receivable', $ctx->amounts['total'])];
                foreach ($ctx->lines as $line) {
                    $lines[] = RoleLine::credit('revenue', $line->amount('amount'), null, $line);
                }

                return [new RoleJournalDraft('main', $lines)];
            }
        };

        return new PostingService(new PostingRuleRegistry([$rule]), app(AccountRoleResolver::class), app(JournalService::class), app(CanceledSourceGuard::class), $recorders);
    }

    private function registry(): PostedAccountRecorderRegistry {
        return new PostedAccountRecorderRegistry(app(), [PostingDocumentType::SalesInvoice->value => SpyRecorder::class]);
    }

    /**
     * @param  list<LineAttributes>  $lines
     */
    private function ctx(float $total, array $lines): PostingContext {
        return new PostingContext(PostingDocumentType::SalesInvoice, $this->source::class, $this->source->getKey(), CarbonImmutable::parse('2026-11-12 10:00:00'), null, ['total' => $total], [], [], $lines);
    }

    private function stockLine(string $lineId, float $amount): LineAttributes {
        return new LineAttributes(['amount' => $amount], 'goods', true, null, $lineId);
    }

    private function serviceLine(string $lineId, float $amount): LineAttributes {
        return new LineAttributes(['amount' => $amount], 'service', false, null, $lineId);
    }

    public function test_notes_record_role_account_and_line_before_merging(): void {
        $outcome = $this->service($this->registry())->post($this->ctx(300, [
            $this->stockLine('L1', 100), $this->stockLine('L2', 100), $this->serviceLine('L3', 100),
        ]));

        $notes = $outcome->accountNotes;
        $this->assertSame(1, Journal::count());
        $this->assertSame($this->receivable->id, $notes->accountFor('receivable'));
        $this->assertNull($notes->forRole('receivable')[0]->lineId);
        $this->assertCount(3, $notes->forRole('revenue'));
        $this->assertSame(['L1' => $this->revenue->id, 'L2' => $this->revenue->id, 'L3' => $this->revenueNonStock->id], $notes->byLine('revenue'));
        $this->assertNull($notes->uniformAccountFor('revenue'), 'akun beragam -> header null');
        $this->assertCount(4, $notes->forPurpose('main'));
        $this->assertSame([], $notes->forPurpose('lain'));
        $this->assertNull($notes->accountFor('expense'));
    }

    public function test_uniform_account_when_all_lines_use_the_same_account(): void {
        $outcome = $this->service($this->registry())->post($this->ctx(200, [$this->stockLine('L1', 100), $this->stockLine('L2', 100)]));

        $this->assertSame($this->revenue->id, $outcome->accountNotes->uniformAccountFor('revenue'));
        $this->assertSame($this->revenue->id, $outcome->accountNotes->accountFor('revenue'));
    }

    public function test_notes_helpers_on_plain_data(): void {
        $notes = new PostedAccountNotes([
            new PostedAccountNote('p', 'revenue', 'A', 'L1'),
            new PostedAccountNote('p', 'revenue', 'B', null),
        ]);

        $this->assertFalse($notes->isEmpty());
        $this->assertTrue((new PostedAccountNotes)->isEmpty());
        $this->assertSame(['L1' => 'A'], $notes->byLine('revenue'));
        $this->assertNull($notes->uniformAccountFor('revenue'));
        $this->assertNull((new PostedAccountNotes)->uniformAccountFor('revenue'));
    }

    public function test_recorder_is_called_once_inside_the_transaction_on_posted(): void {
        $baseLevel = DB::transactionLevel();
        $this->service($this->registry())->post($this->ctx(100, [$this->stockLine('L1', 100)]));

        $this->assertSame(1, SpyRecorder::$calls);
        $this->assertSame($baseLevel + 1, SpyRecorder::$levelDuringCall, 'recorder berjalan di dalam transaksi posting');
        $this->assertSame(1, SpyRecorder::$journalsSeen, 'jurnal sudah tertulis saat recorder dipanggil');
        $this->assertSame($this->revenue->id, SpyRecorder::$lastNotes?->uniformAccountFor('revenue'));
    }

    public function test_recorder_is_not_called_on_already_posted(): void {
        $service = $this->service($this->registry());
        $ctx     = $this->ctx(100, [$this->stockLine('L1', 100)]);
        $service->post($ctx);
        SpyRecorder::reset();

        $outcome = $service->post($ctx);

        $this->assertTrue($outcome->isAlreadyPosted());
        $this->assertSame(0, SpyRecorder::$calls);
    }

    public function test_recorder_is_not_called_when_skipped(): void {
        $this->source->update(['status' => [FormStatus::CANCELED]]);

        $outcome = $this->service($this->registry())->post($this->ctx(100, [$this->stockLine('L1', 100)]));

        $this->assertTrue($outcome->isSkipped());
        $this->assertSame(0, SpyRecorder::$calls);
    }

    public function test_recorder_is_not_called_when_there_are_no_drafts(): void {
        $outcome = $this->service($this->registry())->post($this->ctx(0, []));

        $this->assertTrue($outcome->isPosted());
        $this->assertSame([], $outcome->journals);
        $this->assertSame(0, SpyRecorder::$calls);
    }

    public function test_failing_recorder_rolls_back_the_journals(): void {
        SpyRecorder::$fail = true;

        try {
            $this->service($this->registry())->post($this->ctx(100, [$this->stockLine('L1', 100)]));
            $this->fail('Recorder yang melempar harus menggagalkan posting.');
        } catch (RuntimeException $e) {
            $this->assertSame('recorder gagal', $e->getMessage());
        }

        $this->assertSame(0, Journal::count());
    }

    public function test_preview_does_not_write_or_call_the_recorder(): void {
        $drafts = $this->service($this->registry())->preview($this->ctx(100, [$this->stockLine('L1', 100)]));

        $this->assertCount(1, $drafts);
        $this->assertSame(0, Journal::count());
        $this->assertSame(0, SpyRecorder::$calls);
    }

    public function test_service_without_registry_still_posts(): void {
        $outcome = $this->service(null)->post($this->ctx(100, [$this->stockLine('L1', 100)]));

        $this->assertTrue($outcome->isPosted());
        $this->assertSame(1, Journal::count());
    }

    public function test_registry_skips_missing_classes_and_resolves_existing_ones(): void {
        $registry = new PostedAccountRecorderRegistry(app(), [
            PostingDocumentType::SalesInvoice->value    => 'App\\Tidak\\Ada\\RecorderPalsu',
            PostingDocumentType::PurchaseInvoice->value => SpyRecorder::class,
        ]);

        $this->assertFalse($registry->has(PostingDocumentType::SalesInvoice));
        $this->assertNull($registry->recorderFor(PostingDocumentType::SalesInvoice));
        $this->assertNull($registry->recorderFor(PostingDocumentType::StockEntry), 'tanpa entri peta');
        $registry->record($this->ctx(100, []), new PostedAccountNotes); // dilewati tanpa error
        $this->assertSame(0, SpyRecorder::$calls);

        $this->assertInstanceOf(SpyRecorder::class, $registry->recorderFor(PostingDocumentType::PurchaseInvoice));
    }

    public function test_every_default_map_entry_points_to_an_existing_recorder_of_the_same_type(): void {
        // Registry melewati class yang tidak ada tanpa error; tes ini mencegah salah ketik/rename membuat write-back mati.
        $registry = new PostedAccountRecorderRegistry(app());

        foreach ($registry->map() as $typeValue => $class) {
            $type = PostingDocumentType::from($typeValue);
            $this->assertTrue(class_exists($class), "Recorder {$class} tidak ada.");
            $this->assertTrue($registry->has($type));
            $this->assertSame($type, $registry->recorderFor($type)->documentType());
        }
    }

    public function test_default_map_has_the_agreed_document_types(): void {
        $this->assertSame(
            ['sales_invoice', 'purchase_invoice', 'payment_entry', 'stock_entry', 'asset_value_adjustment', 'delivery_note', 'purchase_receipt'],
            array_keys((new PostedAccountRecorderRegistry(app()))->map()),
        );
    }
}

/**
 * Recorder uji: merekam pemanggilan dan keadaan transaksi.
 */
class SpyRecorder implements PostedAccountRecorder {
    public static int $calls                     = 0;
    public static int $levelDuringCall           = 0;
    public static int $journalsSeen              = 0;
    public static bool $fail                     = false;
    public static ?PostedAccountNotes $lastNotes = null;

    public static function reset(): void {
        self::$calls           = 0;
        self::$levelDuringCall = 0;
        self::$journalsSeen    = 0;
        self::$fail            = false;
        self::$lastNotes       = null;
    }

    public function documentType(): PostingDocumentType {
        return PostingDocumentType::SalesInvoice;
    }

    public function record(PostingContext $ctx, PostedAccountNotes $notes): void {
        self::$calls++;
        self::$levelDuringCall = DB::transactionLevel();
        self::$journalsSeen    = Journal::query()->withoutGlobalScopes()->count();
        self::$lastNotes       = $notes;

        if (self::$fail) {
            throw new RuntimeException('recorder gagal');
        }
    }
}
