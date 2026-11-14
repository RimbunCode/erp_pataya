<?php

namespace Tests\Feature\Finances\Posting;

use App\Enums\FormStatus;
use App\Models\Finances\Account;
use App\Models\Finances\PostingParityLog;
use App\Models\Finances\PostingProfile;
use App\Models\Finances\PurchaseInvoice;
use App\Models\Finances\PurchaseInvoiceItem;
use App\Models\Inventory\ItemVariant;
use App\Models\Model as BaseModel;
use App\Models\Purchase\PurchaseOrder;
use App\Models\Purchase\PurchaseReceipt;
use App\Services\Finances\Accounting\PurchaseInvoicePostingContextFactory;
use App\Services\Finances\Ledger\JournalService;
use App\Services\Finances\Posting\PostingService;
use App\Services\Purchase\Accounting\PurchaseReceiptPostingContextFactory;
use Closure;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\Group;
use Tests\Support\AssertsPostingParity;
use Tests\Support\BuildsFinanceFixtures;
use Tests\TestCase;

/**
 * Finance Fase 2, Task 9.1 (Requirement 11.1): overhead ENGINE terhadap jalur lama pada seed data uji (sqlite in-memory),
 * Purchase Receipt (satu jurnal) dan Purchase Invoice bercabang stok (dua jurnal).
 *
 * Metodologi:
 * - Fixture (dokumen, baris, akun, profil) dibuat DI LUAR pengukuran; yang diukur hanya jalur posting.
 * - Basis = jalur Fase 1 murni: isi closure legacy (kunci akun `account_type` + `postPair`) dipanggil LANGSUNG tanpa
 *   gateway, bukan mode `off` yang sudah memuat biaya gateway (mode, guard).
 * - Engine = pabrik konteks + `PostingService::post()` (resolver profil, rule, `JournalService`), dokumen yang berbeda
 *   tetapi setara (kunci jurnal tidak boleh bentrok). `PostingService` di-resolve BARU per dokumen (resolver dingin, cache
 *   dalam-memori `AccountRoleResolver` kosong) seperti tiap job produksi yang memanggil `app()` baru.
 * - Dua ronde bergantian (basis lalu engine, engine lalu basis) agar urutan/pemanasan tidak condong; dilaporkan per ronde dan nilai maksimum (rasio query terburuk yang ditegakkan).
 *
 * Metrik yang DITEGAKKAN hanya proksi deterministik: rasio jumlah query engine/basis <= 1,25 (Requirement 11.1 menyebut waktu
 * rata-rata; waktu dinding dilaporkan tetapi tidak ditegakkan karena bergantung mesin dan beban). Rasio waktu dan query
 * dicetak ke STDERR. Hasil terakhir pada mesin pengembangan ada di laporan sprint.
 *
 * Tidak berjalan di CI default: dilewati kecuali env `RUN_POSTING_BENCHMARK=1` (grup `benchmark`):
 * `RUN_POSTING_BENCHMARK=1 vendor/bin/phpunit tests/Feature/Finances/Posting/PostingEngineOverheadTest.php`.
 */
#[Group('benchmark')]
class PostingEngineOverheadTest extends TestCase {
    use AssertsPostingParity, BuildsFinanceFixtures, RefreshDatabase;

    private const ITERATIONS = 15;

    private Account $stock;
    private Account $srnb;
    private Account $payable;
    private PurchaseOrder $purchaseOrder;

    protected function setUp(): void {
        parent::setUp();

        if (getenv('RUN_POSTING_BENCHMARK') !== '1') {
            $this->markTestSkipped('Benchmark Task 9.1: set RUN_POSTING_BENCHMARK=1 untuk menjalankan (tidak berjalan di CI default).');
        }

        $this->setUpFinanceFixtures([PostingProfile::class, PostingParityLog::class, PurchaseInvoice::class, PurchaseOrder::class]);

        $this->stock   = $this->makeAccount('1300', 'Persediaan', 'asset', 'debit', 'stock');
        $this->srnb    = $this->makeAccount('2100', 'SRNB', 'liability', 'credit', 'stock_received_but_not_billed');
        $this->payable = $this->makeAccount('2000', 'Utang Usaha', 'liability', 'credit', 'accounts_payable');

        $this->activateParityProfile([
            'stock'                         => $this->stock,
            'stock_received_but_not_billed' => $this->srnb,
            'expense'                       => $this->srnb,
            'payable'                       => $this->payable,
        ]);

        $this->purchaseOrder = BaseModel::withoutEvents(fn () => PurchaseOrder::create(['code' => 'PO-BENCH-1', 'date' => now(), 'status' => [FormStatus::SUBMITTED], 'created_by_id' => $this->user->id]));
    }

    /**
     * Memakai query log koneksi (bukan `DB::listen`, yang tidak dapat dilepas): log di-reset sebelum dan sesudah tiap ukuran.
     *
     * @return array{queries: int, ms: float}
     */
    private function measure(Closure $run): array {
        DB::flushQueryLog();
        DB::enableQueryLog();

        $start = hrtime(true);
        $run();
        $ms = (hrtime(true) - $start) / 1e6;

        $queries = \count(DB::getQueryLog());
        DB::disableQueryLog();
        DB::flushQueryLog();

        return ['queries' => $queries, 'ms' => $ms];
    }

    /**
     * @return list<PurchaseReceipt>
     */
    private function makeReceipts(int $count): array {
        $receipts = [];
        for ($i = 0; $i < $count; $i++) {
            $id = (string) Str::ulid();
            DB::table('purchase_receipts')->insert(['id' => $id, 'date' => now(), 'created_at' => now(), 'updated_at' => now()]);
            $receipts[] = PurchaseReceipt::withoutEvents(fn () => PurchaseReceipt::find($id));
        }

        return $receipts;
    }

    /**
     * @return list<PurchaseInvoice>
     */
    private function makeInvoices(int $count): array {
        $invoices = [];
        for ($i = 0; $i < $count; $i++) {
            $invoice = PurchaseInvoice::create([
                'date'              => now(), 'expanse_head_account_id' => $this->srnb->id, 'credit_account_id' => $this->payable->id,
                'purchase_order_id' => $this->purchaseOrder->id, 'branch_id' => $this->branch->id, 'status' => [FormStatus::SUBMITTED],
            ]);
            PurchaseInvoiceItem::create(['purchase_invoice_id' => $invoice->id, 'item_id' => ItemVariant::factory()->create()->id, 'quantity' => 2, 'rate' => 1000, 'tax_rate' => 10]);
            $invoices[] = $invoice;
        }

        return $invoices;
    }

    public function test_engine_overhead_against_the_phase_1_baseline_stays_within_requirement_11_1(): void {
        $journals = app(JournalService::class);
        $date     = now();

        // Dokumen dibuat di luar pengukuran: dua set setara (basis dan engine) per jenis, dua ronde.
        $sets = [
            'purchase_receipt' => [
                'documents' => [$this->makeReceipts(self::ITERATIONS * 2), $this->makeReceipts(self::ITERATIONS * 2)],
                'legacy'    => function ($receipt) use ($journals, $date): void {
                    // Isi closure legacy PostPurchaseReceiptGeneralLedger, dipanggil langsung tanpa gateway.
                    $debit  = Account::lockForUpdate()->where('root_type', 'asset')->where('account_type', 'stock')->latest()->first();
                    $credit = Account::lockForUpdate()->where('root_type', 'liability')->where('account_type', 'stock_received_but_not_billed')->latest()->first();
                    $journals->postPair($debit->id, $credit->id, 1200.0, $receipt, $date);
                },
                'engine' => fn ($receipt) => app(PostingService::class)->post(app(PurchaseReceiptPostingContextFactory::class)->forPosting($receipt, 1200.0, false, $date), checkCanceled: false),
            ],
            'purchase_invoice' => [
                'documents' => [$this->makeInvoices(self::ITERATIONS * 2), $this->makeInvoices(self::ITERATIONS * 2)],
                'legacy'    => function ($invoice) use ($journals, $date): void {
                    // Isi closure legacy PostPurchaseInvoiceGeneralLedger (cabang stok + expense), tanpa gateway.
                    $stock = Account::lockForUpdate()->where('root_type', 'asset')->where('account_type', 'stock')->latest()->first();
                    $srnb  = Account::lockForUpdate()->where('root_type', 'liability')->where('account_type', 'stock_received_but_not_billed')->latest()->first();
                    $journals->postPair($stock->id, $srnb->id, 1500.0, $invoice, $date, purpose: 'stock');
                    $debit  = Account::where('id', $this->srnb->id)->lockForUpdate()->firstOrFail();
                    $credit = Account::where('id', $this->payable->id)->lockForUpdate()->firstOrFail();
                    $journals->postPair($debit->id, $credit->id, 2183.33, $invoice, $date, purpose: 'expense');
                },
                'engine' => fn ($invoice) => app(PostingService::class)->post(app(PurchaseInvoicePostingContextFactory::class)->forPosting($invoice, 1500.0, 2183.33, false, $date), checkCanceled: false),
            ],
        ];

        $report = [];
        foreach ($sets as $label => $set) {
            $rounds = [];

            // Dua ronde bergantian urutan; ronde 0: basis dulu, ronde 1: engine dulu. Ronde memakai dokumen yang berbeda.
            foreach ([0, 1] as $round) {
                $order  = $round === 0 ? ['legacy', 'engine'] : ['engine', 'legacy'];
                $result = [];
                foreach ($order as $path) {
                    $documents     = \array_slice($set['documents'][$path === 'legacy' ? 0 : 1], $round * self::ITERATIONS, self::ITERATIONS);
                    $run           = $set[$path];
                    $result[$path] = $this->measure(function () use ($documents, $run): void {
                        foreach ($documents as $document) {
                            DB::transaction(fn () => $run($document));
                        }
                    });
                }
                $rounds[] = [
                    'queries_legacy' => $result['legacy']['queries'], 'queries_engine' => $result['engine']['queries'],
                    'query_ratio'    => round($result['engine']['queries'] / max($result['legacy']['queries'], 1), 3),
                    'ms_legacy'      => round($result['legacy']['ms'], 1), 'ms_engine' => round($result['engine']['ms'], 1),
                    'time_ratio'     => round($result['engine']['ms'] / max($result['legacy']['ms'], 0.001), 3),
                ];
            }

            $report[$label] = ['rounds' => $rounds, 'max_query_ratio' => max(array_column($rounds, 'query_ratio')), 'max_time_ratio' => max(array_column($rounds, 'time_ratio'))];
        }

        fwrite(STDERR, "\n[benchmark Task 9.1] iterasi/ronde=" . self::ITERATIONS . ' ' . json_encode($report, JSON_UNESCAPED_SLASHES) . "\n");

        foreach ($report as $label => $row) {
            $this->assertLessThanOrEqual(1.25, $row['max_query_ratio'], "{$label}: query engine tidak boleh lebih dari 125% basis jalur Fase 1 (Requirement 11.1, proksi).");
        }
    }
}
