<?php

namespace Tests\Feature\Finances\Ledger;

use App\Enums\FormStatus;
use App\Exceptions\Finances\ImmutableLedgerException;
use App\Models\Finances\Account;
use App\Models\Finances\FiscalPeriod;
use App\Models\Finances\FiscalYear;
use App\Models\Finances\GeneralLedger;
use App\Models\Finances\Journal;
use App\Models\Finances\PaymentSchedule;
use App\Models\Finances\SalesInvoice;
use App\Services\Finances\Ledger\JournalDraft;
use App\Services\Finances\Ledger\JournalLineDraft;
use App\Services\Finances\Ledger\JournalService;
use App\Services\Finances\SalesInvoiceService;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Tests\Support\BuildsFinanceFixtures;
use Tests\TestCase;

/**
 * Finance Fase 1, Task 4.5 (P-5): `update`/`delete`/`forceDelete` pada baris dan jurnal terposting lewat model selalu
 * ditolak; baris legacy tanpa `journal_id` tidak berubah perilakunya; hanya `journal_id` dan `line_no` yang boleh
 * diisi pada baris legacy (jalur backfill). Guard ini bukan perlindungan dari query builder atau SQL langsung
 * (Requirement 4.4, D-7); pengecualian legacy cancel `Submitable` (Requirement 4.5) dibuktikan di bawah.
 */
class LedgerImmutabilityTest extends TestCase {
    use BuildsFinanceFixtures, RefreshDatabase;

    private Account $cash;
    private Account $revenue;
    private Journal $journal;

    protected function setUp(): void {
        parent::setUp();

        $this->setUpFinanceFixtures([Journal::class, FiscalYear::class, FiscalPeriod::class, SalesInvoice::class, PaymentSchedule::class]);
        $this->cash    = $this->makeAccount('1100', 'Kas', 'asset', 'debit', 'cash');
        $this->revenue = $this->makeAccount('4100', 'Penjualan', 'income', 'credit');

        $this->journal = app(JournalService::class)->post(new JournalDraft(
            CarbonImmutable::parse('2026-11-04 09:00:00'),
            [
                new JournalLineDraft($this->cash->id, 100, 0, againstAccountId: $this->revenue->id),
                new JournalLineDraft($this->revenue->id, 0, 100, againstAccountId: $this->cash->id),
            ],
            $this->branch,
        ));
    }

    private function postedLine(): GeneralLedger {
        return GeneralLedger::query()->where('journal_id', $this->journal->id)->orderBy('line_no')->firstOrFail();
    }

    private function legacyLine(): GeneralLedger {
        return $this->makeLedger($this->branch, $this->cash, $this->revenue, 40, 0);
    }

    public function test_p5_updating_a_posted_line_through_the_model_is_rejected(): void {
        $line = $this->postedLine();

        foreach ([['debit' => 999], ['description' => 'ubah'], ['journal_id' => null], ['account_id' => $this->revenue->id]] as $changes) {
            try {
                $line->update($changes);
                $this->fail('Update baris terposting harus ditolak: ' . json_encode($changes));
            } catch (ImmutableLedgerException) {
                $this->addToAssertionCount(1);
            }
            $line->refresh();
        }

        $fresh = $this->postedLine();
        $this->assertSame(100.0, $fresh->debit);
        $this->assertSame($this->cash->id, $fresh->account_id);
        $this->assertSame($this->journal->id, $fresh->journal_id);
    }

    public function test_p5_deleting_or_force_deleting_a_posted_line_is_rejected(): void {
        $line = $this->postedLine();

        // Dengan guard generik LinkModel (default) penghapusan lewat model sudah ditolak (ValidationException);
        // ImmutableLedgerException adalah pengaman sendiri yang berlaku walau guard generik dimatikan lewat config.
        foreach ([true, false] as $genericGuard) {
            config(['have_transactions.enforce_delete_guard' => $genericGuard]);

            foreach (['delete', 'forceDelete'] as $method) {
                try {
                    $line->{$method}();
                    $this->fail("{$method} harus ditolak (guard generik: " . json_encode($genericGuard) . ').');
                } catch (ImmutableLedgerException|ValidationException $e) {
                    $this->assertInstanceOf($genericGuard ? ValidationException::class : ImmutableLedgerException::class, $e);
                }
            }
        }

        $this->assertSame(2, GeneralLedger::withTrashed()->where('journal_id', $this->journal->id)->count());
        $this->assertSame(0, GeneralLedger::onlyTrashed()->count());
    }

    public function test_p5_updating_a_journal_through_the_model_is_rejected(): void {
        // `status` dilindungi mass assignment ($guarded): `update()` mengabaikannya, jadi uji lewat `forceFill`.
        foreach ([['description' => 'ubah'], ['status' => 'voided']] as $changes) {
            try {
                $this->journal->forceFill($changes)->save();
                $this->fail('Update jurnal harus ditolak: ' . json_encode($changes));
            } catch (ImmutableLedgerException) {
                $this->addToAssertionCount(1);
            }
            $this->journal->refresh();
        }

        $this->assertSame('posted', Journal::first()->status);
    }

    public function test_p5_deleting_a_journal_through_the_model_is_rejected(): void {
        foreach ([true, false] as $genericGuard) {
            config(['have_transactions.enforce_delete_guard' => $genericGuard]);

            try {
                $this->journal->delete();
                $this->fail('Delete jurnal harus ditolak.');
            } catch (ImmutableLedgerException|ValidationException $e) {
                $this->assertInstanceOf($genericGuard ? ValidationException::class : ImmutableLedgerException::class, $e);
            }
        }

        $this->assertSame(1, Journal::count());
        $this->assertSame('posted', Journal::first()->status);
    }

    public function test_legacy_lines_without_journal_keep_their_behaviour(): void {
        $legacy = $this->legacyLine();

        $legacy->update(['description' => 'koreksi legacy', 'debit' => 41]);
        $this->assertSame(41.0, $legacy->fresh()->debit);

        // Penghapusan lewat model ditolak guard generik LinkModel sejak sebelum Fase 1 (`canDelete()` = false) dan
        // tidak berubah; tanpa guard generik, baris legacy tetap dapat di-soft-delete (guard Fase 1 hanya untuk
        // baris ber-journal_id).
        try {
            $legacy->delete();
            $this->fail('Guard generik LinkModel harus menolak.');
        } catch (ValidationException) {
            $this->addToAssertionCount(1);
        }

        config(['have_transactions.enforce_delete_guard' => false]);
        $legacy->delete();
        $this->assertSoftDeleted('general_ledgers', ['id' => $legacy->id]);
    }

    public function test_backfill_path_may_assign_only_journal_id_and_line_no_to_a_legacy_line(): void {
        $legacy = $this->legacyLine();

        // Perubahan lain bersamaan dengan journal_id ditolak.
        try {
            $legacy->forceFill(['journal_id' => $this->journal->id, 'line_no' => 3, 'debit' => 1])->save();
            $this->fail('Perubahan tambahan harus ditolak.');
        } catch (ImmutableLedgerException) {
            $this->addToAssertionCount(1);
        }
        $this->assertNull($legacy->fresh()->journal_id);

        $legacy = $legacy->fresh();
        $legacy->forceFill(['journal_id' => $this->journal->id, 'line_no' => 3])->save();
        $this->assertSame($this->journal->id, $legacy->fresh()->journal_id);
        $this->assertSame(3, $legacy->fresh()->line_no);

        // Setelah terisi, baris sudah dilindungi.
        $this->expectException(ImmutableLedgerException::class);
        $legacy->fresh()->update(['journal_id' => null]);
    }

    public function test_query_builder_bulk_updates_are_not_blocked_documented_legacy_cancel_exception(): void {
        // Hook `Submitable` men-soft-delete baris GL dokumen yang dibatalkan lewat update massal (Requirement 4.5);
        // guard model tidak dipicu oleh query builder. Pengecualian ini dihapus pada Fase 2 (reversal saat cancel).
        $affected = GeneralLedger::where('referenceable_type', $this->branch::class)
            ->where('referenceable_id', $this->branch->id)
            ->update(['deleted_at' => now()]);

        $this->assertSame(2, $affected);
        $this->assertSame(2, GeneralLedger::onlyTrashed()->where('journal_id', $this->journal->id)->count());
    }

    public function test_real_submitable_cancel_hook_soft_deletes_journal_lines_without_immutable_exception(): void {
        $receivable = $this->makeAccount('1200', 'Piutang Usaha', 'asset', 'debit', 'accounts_receivable');
        $invoice    = $this->makeSalesInvoice($receivable, $this->revenue);

        $journal = app(JournalService::class)->postPair($receivable->id, $this->revenue->id, 500, $invoice, CarbonImmutable::parse('2026-11-04 09:00:00'));
        $this->assertNotNull($journal);
        $this->assertSame(2, GeneralLedger::where('journal_id', $journal->id)->count());

        // Hook `Submitable::saving` (cancel dokumen) men-soft-delete baris GL lewat update massal query builder:
        // pengecualian legacy (Requirement 4.5) harus berjalan tanpa `ImmutableLedgerException`.
        app(SalesInvoiceService::class)->cancel($invoice->fresh());

        $this->assertContains(FormStatus::CANCELED, $invoice->fresh()->status);
        $this->assertSame(0, GeneralLedger::where('journal_id', $journal->id)->count(), 'Baris tidak terlihat oleh query standar.');
        $this->assertSame(2, GeneralLedger::onlyTrashed()->where('journal_id', $journal->id)->count());
        $this->assertSame('posted', $journal->fresh()->status, 'Penandaan `voided` adalah Task 6.8 (belum dikerjakan).');
    }
}
