<?php

namespace Tests\Feature\Finances\Posting;

use App\Enums\PostingDocumentType;
use App\Events\Asset\AssetDepreciationDue;
use App\Events\Asset\AssetScrapped;
use App\Events\Asset\AssetSoldViaInvoice;
use App\Events\Asset\AssetValueAdjustmentApproved;
use App\Events\Finances\PurchaseInvoiceGeneralLedgerPostingRequested;
use App\Events\Finances\SalesInvoiceGeneralLedgerPostingRequested;
use App\Events\Inventory\DeliveryNoteGeneralLedgerPostingRequested;
use App\Events\Purchase\PurchaseReceiptGeneralLedgerPostingRequested;
use App\Listeners\Asset\Depreciation\PostDepreciationEntry;
use App\Listeners\Asset\Depreciation\PostScrapWriteOff;
use App\Listeners\Asset\Depreciation\PostValueAdjustmentEntry;
use App\Listeners\Asset\Rental\PostAssetDisposalGainLoss;
use App\Listeners\Finances\Ledger\PostPurchaseInvoiceGeneralLedger;
use App\Listeners\Finances\Ledger\PostSalesInvoiceGeneralLedger;
use App\Listeners\Inventory\Ledger\PostDeliveryNoteGeneralLedger;
use App\Listeners\Purchase\Ledger\PostPurchaseReceiptGeneralLedger;
use App\Models\Finances\FinanceSetting;
use App\Models\Finances\PostingParityLog;
use App\Services\Finances\Posting\PostingExecutionResolver;
use App\Services\Finances\Posting\PostingExecutionRouter;
use App\Services\Finances\Posting\PostingExecutionService;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Events\CallQueuedListener;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Session;
use InvalidArgumentException;
use PHPUnit\Framework\Attributes\DataProvider;
use RuntimeException;
use stdClass;
use Tests\Support\BuildsFinanceFixtures;
use Tests\TestCase;
use Throwable;

/**
 * Finance Fase 2, Task 10 (Requirement 9; D-1 opsi C, 2026-11-21): posting GL berjalan inline (sinkron, dalam transaksi
 * dokumen) secara default untuk semua jenis dokumen; `queue` hanya lewat sakelar `PostingExecutionService`.
 */
class PostingExecutionTest extends TestCase {
    use BuildsFinanceFixtures, RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        $this->setUpFinanceFixtures([PostingParityLog::class]);
        Cache::flush();
    }

    private function grant(bool $allowed): void {
        Session::put('permissions', [
            PostingParityLog::class => [0 => [['model' => PostingParityLog::class, 'level' => 0, 'only_creator' => false, 'permissions' => array_filter(['select' => true, 'switch_posting_mode' => $allowed])]]],
        ]);
    }

    /**
     * @return array<string, array{0: class-string, 1: class-string}>
     */
    public static function routedEvents(): array {
        return [
            'sales invoice'          => [SalesInvoiceGeneralLedgerPostingRequested::class, PostSalesInvoiceGeneralLedger::class],
            'purchase invoice'       => [PurchaseInvoiceGeneralLedgerPostingRequested::class, PostPurchaseInvoiceGeneralLedger::class],
            'delivery note'          => [DeliveryNoteGeneralLedgerPostingRequested::class, PostDeliveryNoteGeneralLedger::class],
            'purchase receipt'       => [PurchaseReceiptGeneralLedgerPostingRequested::class, PostPurchaseReceiptGeneralLedger::class],
            'asset depreciation'     => [AssetDepreciationDue::class, PostDepreciationEntry::class],
            'asset scrap'            => [AssetScrapped::class, PostScrapWriteOff::class],
            'asset value adjustment' => [AssetValueAdjustmentApproved::class, PostValueAdjustmentEntry::class],
            'asset disposal'         => [AssetSoldViaInvoice::class, PostAssetDisposalGainLoss::class],
        ];
    }

    public function test_default_setting_has_every_document_type_inline(): void {
        $setting = FinanceSetting::current();

        $this->assertSame(PostingDocumentType::values(), array_keys($setting->posting_executions));
        $this->assertSame(['inline'], array_values(array_unique($setting->posting_executions)));

        foreach (PostingDocumentType::cases() as $type) {
            $this->assertSame('inline', app(PostingExecutionResolver::class)->for($type));
        }
    }

    public function test_row_without_executions_reads_as_inline(): void {
        FinanceSetting::current();
        DB::table('finance_settings')->update(['posting_executions' => null]);
        PostingExecutionResolver::forget();

        $this->assertSame('inline', app(PostingExecutionResolver::class)->for(PostingDocumentType::SalesInvoice));
    }

    #[DataProvider('routedEvents')]
    public function test_each_posting_event_has_exactly_one_listener_registered(string $event, string $listener): void {
        // Satu pendaftaran (router) per event: dua pendaftaran akan memposting dua kali.
        $this->assertCount(1, app('events')->getListeners($event));
    }

    public function test_router_runs_the_listener_inline_by_default_without_queueing(): void {
        Queue::fake();
        RoutedProbeListener::$handled = [];
        $event                        = new stdClass;

        app(PostingExecutionRouter::class)->route(RoutedProbeListener::class, PostingDocumentType::SalesInvoice, $event);

        $this->assertSame([$event], RoutedProbeListener::$handled);
        Queue::assertNothingPushed();
    }

    public function test_router_queues_the_listener_after_switch_and_back_inline_after_switching_back(): void {
        Queue::fake();
        RoutedProbeListener::$handled = [];
        $this->grant(true);
        $router = app(PostingExecutionRouter::class);

        app(PostingExecutionService::class)->switch(PostingDocumentType::SalesInvoice, 'queue');
        $router->route(RoutedProbeListener::class, PostingDocumentType::SalesInvoice, new stdClass);

        $this->assertSame([], RoutedProbeListener::$handled);
        Queue::assertPushed(CallQueuedListener::class, fn (CallQueuedListener $job): bool => $job->class === RoutedProbeListener::class && $job->method === 'handle' && $job->tries === 3);

        app(PostingExecutionService::class)->switch(PostingDocumentType::SalesInvoice, 'inline');
        $router->route(RoutedProbeListener::class, PostingDocumentType::SalesInvoice, new stdClass);

        $this->assertCount(1, RoutedProbeListener::$handled);
    }

    public function test_inline_failure_propagates_so_the_document_transaction_rolls_back(): void {
        $this->expectException(RuntimeException::class);
        app(PostingExecutionRouter::class)->route(RoutedFailingListener::class, PostingDocumentType::SalesInvoice, new stdClass);
    }

    public function test_inline_failure_outside_any_document_transaction_is_recorded_via_failed_instead_of_thrown(): void {
        RoutedFailingListener::$failedWith = null;
        // Tes berjalan di dalam transaksi `RefreshDatabase`: kedalaman itu dianggap "di luar transaksi dokumen".
        $router = new PostingExecutionRouter(app(PostingExecutionResolver::class), DB::transactionLevel());

        $router->route(RoutedFailingListener::class, PostingDocumentType::AssetScrap, new stdClass);

        $this->assertInstanceOf(RuntimeException::class, RoutedFailingListener::$failedWith);
    }

    public function test_inline_failure_inside_a_document_transaction_still_propagates_with_an_outer_level_baseline(): void {
        $router = new PostingExecutionRouter(app(PostingExecutionResolver::class), DB::transactionLevel());

        $this->expectException(RuntimeException::class);
        DB::transaction(fn () => $router->route(RoutedFailingListener::class, PostingDocumentType::AssetScrap, new stdClass));
    }

    public function test_switch_changes_only_the_requested_type_and_invalidates_the_cache(): void {
        $this->grant(true);
        $resolver = app(PostingExecutionResolver::class);
        $this->assertSame('inline', $resolver->for(PostingDocumentType::SalesInvoice)); // mengisi cache

        app(PostingExecutionService::class)->switch(PostingDocumentType::SalesInvoice, 'queue');

        $this->assertSame('queue', $resolver->for(PostingDocumentType::SalesInvoice));
        $this->assertSame('inline', $resolver->for(PostingDocumentType::PurchaseInvoice));
        $this->assertTrue($resolver->isQueued(PostingDocumentType::SalesInvoice));
    }

    public function test_switch_requires_the_switch_posting_mode_permission(): void {
        $this->grant(false);

        try {
            app(PostingExecutionService::class)->switch(PostingDocumentType::SalesInvoice, 'queue');
            $this->fail('AuthorizationException diharapkan.');
        } catch (AuthorizationException) {
            // diharapkan
        }

        $this->assertSame('inline', app(PostingExecutionResolver::class)->for(PostingDocumentType::SalesInvoice));
    }

    public function test_switch_rejects_unknown_execution(): void {
        $this->grant(true);

        $this->expectException(InvalidArgumentException::class);
        app(PostingExecutionService::class)->switch(PostingDocumentType::SalesInvoice, 'sometime');
    }
}

class RoutedProbeListener {
    /** @var list<object> */
    public static array $handled = [];

    public int $tries = 3;

    public function handle(object $event): void {
        self::$handled[] = $event;
    }
}

class RoutedFailingListener {
    public static ?Throwable $failedWith = null;

    public function handle(object $event): void {
        throw new RuntimeException('posting gagal');
    }

    public function failed(object $event, Throwable $e): void {
        self::$failedWith = $e;
    }
}
