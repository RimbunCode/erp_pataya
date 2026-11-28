<?php

namespace Tests\Feature\Finances\Currency;

use App\Enums\RateType;
use App\Exceptions\Finances\ImmutableRateException;
use App\Exceptions\Finances\InvalidJournalException;
use App\Models\Core\CoreSetting;
use App\Models\Finances\Account;
use App\Models\Finances\FiscalPeriod;
use App\Models\Finances\FiscalYear;
use App\Models\Finances\GeneralLedger;
use App\Models\Finances\Journal;
use App\Models\Finances\PostingProfile;
use App\Models\Finances\SalesInvoice;
use App\Services\Finances\Currency\DocumentExchangeRateResolver;
use App\Services\Finances\Ledger\ForeignAmount;
use App\Services\Finances\Ledger\JournalDraft;
use App\Services\Finances\Ledger\JournalLineDraft;
use App\Services\Finances\Ledger\JournalReversalService;
use App\Services\Finances\Ledger\JournalService;
use App\Services\Finances\SalesInvoiceService;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Tests\Support\BuildsFinanceFixtures;
use Tests\Support\EnablesEnginePosting;
use Tests\TestCase;

/**
 * Finance Fase 4, Task 4.4: jejak kurs pada dokumen dan baris jurnal; `exchange_rate_id` sebagai penanda kurs dirujuk
 * (keputusan pemilik produk 28 November 2026); validasi jurnal asing x kurs; invoice valas memposting nilai dasar.
 */
class DocumentExchangeRateTraceTest extends TestCase {
    use BuildsFinanceFixtures, CreatesExchangeRates, EnablesEnginePosting, RefreshDatabase;

    private Account $receivable;
    private Account $sales;

    protected function setUp(): void {
        parent::setUp();

        $this->setUpFinanceFixtures([SalesInvoice::class, PostingProfile::class, Journal::class, FiscalYear::class, FiscalPeriod::class]);
        $this->seedCurrencies();
        CoreSetting::current()->forceFill(['default_currency_id' => 'IDR'])->save();
        $this->receivable = $this->makeAccount('1200', 'Piutang Usaha', 'asset', 'debit', 'accounts_receivable');
        $this->sales      = $this->makeAccount('4000', 'Penjualan', 'income', 'credit', 'sales');
        $this->enableEnginePosting(['receivable' => $this->receivable, 'revenue' => $this->sales]);
    }

    private function resolver(): DocumentExchangeRateResolver {
        return app(DocumentExchangeRateResolver::class);
    }

    public function test_base_currency_document_has_rate_one_and_no_trace(): void {
        $result = $this->resolver()->resolve('IDR', '2026-11-27', 15500);

        $this->assertSame(1, $result['exchange_rate']);
        $this->assertNull($result['exchange_rate_id']);
        $this->assertNull($result['exchange_rate_type']);
        $this->assertNull($result['exchange_rate_date']);
        $this->assertNull($result['exchange_rate_source']);
    }

    public function test_foreign_document_without_typed_rate_takes_master_rate_and_trace(): void {
        $rate = $this->makeRate('USD', 'IDR', '15500', '2026-11-26', source: 'import');

        $result = $this->resolver()->resolve('USD', '2026-11-27', null);

        $this->assertSame('15500.00000000', $result['exchange_rate']);
        $this->assertSame($rate->id, $result['exchange_rate_id']);
        $this->assertSame('transaction', $result['exchange_rate_type']);
        $this->assertSame('2026-11-26', $result['exchange_rate_date']);
        $this->assertSame('import', $result['exchange_rate_source']);
    }

    public function test_zero_payment_default_rate_is_treated_as_empty(): void {
        $rate = $this->makeRate('USD', 'IDR', '15500', '2026-11-27');

        $result = $this->resolver()->resolve('USD', '2026-11-27', 0);

        $this->assertSame($rate->id, $result['exchange_rate_id']);
    }

    public function test_typed_rate_equal_to_master_keeps_master_trace(): void {
        $rate = $this->makeRate('USD', 'IDR', '15500', '2026-11-27');

        $result = $this->resolver()->resolve('USD', '2026-11-27', '15500.0');

        $this->assertSame($rate->id, $result['exchange_rate_id']);
        $this->assertSame('manual', $result['exchange_rate_source']);
    }

    public function test_typed_rate_that_differs_is_kept_as_manual_input_without_master_reference(): void {
        $this->makeRate('USD', 'IDR', '15500', '2026-11-27');

        $result = $this->resolver()->resolve('USD', '2026-11-27', 15600);

        $this->assertSame('15600', $result['exchange_rate']);
        $this->assertNull($result['exchange_rate_id']);
        $this->assertSame(DocumentExchangeRateResolver::SOURCE_MANUAL_INPUT, $result['exchange_rate_source']);
        $this->assertSame('2026-11-27', $result['exchange_rate_date']);
    }

    public function test_typed_rate_without_master_is_accepted_as_manual_input(): void {
        $result = $this->resolver()->resolve('USD', '2026-11-27', 15600);

        $this->assertNull($result['exchange_rate_id']);
        $this->assertSame(DocumentExchangeRateResolver::SOURCE_MANUAL_INPUT, $result['exchange_rate_source']);
    }

    public function test_foreign_document_without_any_rate_fails_closed(): void {
        $this->expectException(ValidationException::class);

        $this->resolver()->resolve('USD', '2026-11-27', null);
    }

    public function test_inverse_master_rate_gives_derived_document_rate_and_points_to_the_stored_row(): void {
        // Baris tersimpan IDR -> USD; kurs dokumen = 1/kurs (dasar per 1 USD), jejak menunjuk baris tersimpan.
        $stored = $this->makeRate('IDR', 'USD', '0.00008000', '2026-11-27');

        $result = $this->resolver()->resolve('USD', '2026-11-27', null);

        $this->assertSame('12500.00000000', $result['exchange_rate']);
        $this->assertSame($stored->id, $result['exchange_rate_id']);
    }

    public function test_referenced_state_comes_from_references_not_from_have_transactions(): void {
        $rate = $this->makeRate('USD', 'IDR', '15500', '2026-11-27');

        // Flag saja tidak membuat kurs dirujuk, dan reset flag tidak membuka kurs yang dirujuk.
        $rate->forceFill(['have_transactions' => true])->save();
        $this->assertFalse($rate->refresh()->isReferenced());

        $this->referenceRate($rate);
        DB::table('exchange_rates')->where('id', $rate->id)->update(['have_transactions' => false]);
        $this->assertTrue($rate->refresh()->isReferenced());

        $this->expectException(ImmutableRateException::class);
        $rate->forceFill(['rate' => '15600'])->save();
    }

    public function test_general_ledger_reference_marks_the_rate_referenced_and_restricts_delete(): void {
        $rate = $this->makeRate('USD', 'IDR', '15500', '2026-11-27');
        $this->postForeignJournal($rate->id, '100', '15500');

        $this->assertTrue($rate->refresh()->isReferenced());
        $this->assertFalse($rate->canDelete());

        try {
            $rate->delete();
            $this->fail('Kurs yang dirujuk jurnal tidak boleh dihapus.');
        } catch (ValidationException|ImmutableRateException) {
            $this->assertDatabaseHas('exchange_rates', ['id' => $rate->id]);
        }
    }

    public function test_database_foreign_key_rejects_deleting_a_referenced_rate_even_bypassing_the_model(): void {
        $rate = $this->makeRate('USD', 'IDR', '15500', '2026-11-27');
        $this->referenceRate($rate);

        $this->expectException(\Illuminate\Database\QueryException::class);
        DB::table('exchange_rates')->where('id', $rate->id)->delete();
    }

    public function test_document_cannot_reference_a_rate_that_no_longer_exists(): void {
        $rate = $this->makeRate('USD', 'IDR', '15500', '2026-11-27');
        $rate->delete();

        $this->expectException(\Illuminate\Database\QueryException::class);
        SalesInvoice::factory()->create(['exchange_rate_id' => $rate->id]);
    }

    private function postForeignJournal(?string $rateId, string $foreign, string $rate, ?string $base = null): Journal {
        $base ??= (string) ((float) $foreign * (float) $rate);
        $foreignAmount = new ForeignAmount('USD', $foreign, $rate, $rateId);

        return app(JournalService::class)->post(new JournalDraft(
            transactionDate: CarbonImmutable::parse('2026-11-27 10:00:00'),
            lines: [
                new JournalLineDraft($this->receivable->id, debit: $base, againstAccountId: $this->sales->id, foreign: $foreignAmount),
                new JournalLineDraft($this->sales->id, credit: $base, againstAccountId: $this->receivable->id),
            ],
            postingKey: 'test:' . uniqid(),
        ));
    }

    public function test_foreign_journal_line_stores_foreign_amount_rate_and_reference(): void {
        $rate    = $this->makeRate('USD', 'IDR', '15500', '2026-11-27');
        $journal = $this->postForeignJournal($rate->id, '100', '15500');

        $debit = GeneralLedger::query()->where('journal_id', $journal->id)->where('account_id', $this->receivable->id)->first();
        $other = GeneralLedger::query()->where('journal_id', $journal->id)->where('account_id', $this->sales->id)->first();

        $this->assertSame('USD', $debit->foreign_currency_code);
        $this->assertEquals(100, $debit->foreign_debit);
        $this->assertNull($debit->foreign_credit);
        $this->assertEquals(15500, $debit->exchange_rate);
        $this->assertSame($rate->id, $debit->exchange_rate_id);
        $this->assertNull($other->foreign_currency_code);
        $this->assertNull($other->exchange_rate_id);
    }

    public function test_foreign_journal_line_accepts_one_minor_unit_of_difference(): void {
        // 33,33 x 15,5 = 516,615 -> 516,62; baris dasar 516,61 (selisih 1 minor unit) masih sah.
        $journal = $this->postForeignJournal(null, '33.33', '15.5', '516.61');

        $this->assertDatabaseHas('general_ledgers', ['journal_id' => $journal->id, 'foreign_currency_code' => 'USD']);
    }

    public function test_foreign_journal_line_rejects_mismatch_beyond_one_minor_unit(): void {
        $this->expectException(InvalidJournalException::class);

        $this->postForeignJournal(null, '100', '15500', '1549999.00');
    }

    public function test_reversal_copies_foreign_data_on_the_swapped_side(): void {
        $rate    = $this->makeRate('USD', 'IDR', '15500', '2026-11-27');
        $journal = $this->postForeignJournal($rate->id, '100', '15500');

        $reversal = app(JournalReversalService::class)->reverse($journal);

        $line = GeneralLedger::query()->where('journal_id', $reversal->id)->where('account_id', $this->receivable->id)->first();
        $this->assertEquals(100, $line->foreign_credit);
        $this->assertNull($line->foreign_debit);
        $this->assertSame($rate->id, $line->exchange_rate_id);
    }


    public function test_foreign_invoice_posts_base_amounts_with_foreign_trace_on_receivable_line(): void {
        $rate    = $this->makeRate('USD', 'IDR', '15000', '2026-11-20');
        $invoice = $this->makeSalesInvoice($this->receivable, $this->sales, [
            'currency_code'      => 'USD',
            'base_currency_code' => 'IDR',
            'exchange_rate'      => 15000,
            'exchange_rate_id'   => $rate->id,
        ]);

        app(SalesInvoiceService::class)->onApproved($invoice);
        $invoice = $invoice->fresh();

        $receivable = $this->ledgerOf($invoice)->firstWhere('account_id', $this->receivable->id);
        $revenue    = $this->ledgerOf($invoice)->firstWhere('account_id', $this->sales->id);

        // 2 x 1.000 USD + pajak (nilai dokumen dalam USD) dikalikan 15.000 menjadi nilai dasar.
        $this->assertEqualsWithDelta($invoice->amount * 15000, $receivable->debit, 0.01);
        $this->assertEqualsWithDelta($receivable->debit, $revenue->credit, 0.01);
        $this->assertSame('USD', $receivable->foreign_currency_code);
        $this->assertEqualsWithDelta($invoice->amount, (float) $receivable->foreign_debit, 0.01);
        $this->assertEquals(15000, $receivable->exchange_rate);
        $this->assertSame($rate->id, $receivable->exchange_rate_id);
        $this->assertNull($revenue->foreign_currency_code);
        $this->assertTrue($rate->refresh()->isReferenced());
    }

    public function test_base_currency_invoice_has_no_foreign_columns_and_legacy_trace_stays_null(): void {
        $invoice = $this->makeSalesInvoice($this->receivable, $this->sales);

        app(SalesInvoiceService::class)->onApproved($invoice);

        $this->assertNull($invoice->fresh()->exchange_rate_id);
        $this->assertTrue($this->ledgerOf($invoice)->every(fn ($row) => $row->foreign_currency_code === null && $row->exchange_rate_id === null));
    }
}
