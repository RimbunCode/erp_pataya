<?php

namespace App\Services\Finances\Ledger;

use App\Enums\JournalStatus;
use App\Events\Core\AuditableModelSaved;
use App\Exceptions\Finances\ClosedPeriodException;
use App\Exceptions\Finances\InvalidJournalException;
use App\Exceptions\Finances\JournalAlreadyReversedException;
use App\Models\Finances\GeneralLedger;
use App\Models\Finances\Journal;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;

/**
 * Satu-satunya cara koreksi jurnal (Finance Fase 1, Requirement 5, FR-L4): jurnal pembalik tertaut dua arah ke
 * jurnal asal, diposting lewat `JournalService::post()` sehingga tunduk pada semua validasi (keseimbangan, akun,
 * periode).
 *
 * Pembaruan status/tautan memakai query builder (bukan model) secara sengaja: guard immutability model menolak
 * `update`, dan ini adalah jalur terkontrol yang diuji (Requirement 4.3). `reverses_journal_id` diisi lewat update
 * kedua karena jurnal pembalik harus ada dulu sebelum dirujuk (FK sirkular).
 *
 * Izin `reverse` (Requirement 5.8) ditegakkan di controller (Task 10.1), bukan di service ini. Tanggal pembalik yang
 * jatuh pada periode tertutup ditolak oleh `JournalService::post()` menurut Requirement 6.5/6.6 (hanya bila
 * `finance_enforce_fiscal_period` aktif).
 */
final class JournalReversalService {
    public const REVERSAL_PURPOSE = 'reversal';

    public function __construct(private readonly JournalService $journals) {}

    /**
     * @throws JournalAlreadyReversedException bila jurnal sudah dibalik atau void
     * @throws InvalidJournalException bila jurnal pembalik, legacy tak seimbang, atau tanpa baris aktif
     * @throws ClosedPeriodException bila tanggal pembalik jatuh pada periode tertutup (enforce aktif)
     */
    public function reverse(Journal $journal, ?CarbonInterface $date = null, ?string $reason = null): Journal {
        return DB::transaction(function () use ($journal, $date, $reason): Journal {
            $original = Journal::query()->withoutGlobalScopes()->whereKey($journal->getKey())->lockForUpdate()->firstOrFail();

            $this->assertReversible($original);

            $lines = GeneralLedger::query()->where('journal_id', $original->id)->orderBy('line_no')->get();
            if ($lines->isEmpty()) {
                throw InvalidJournalException::noActiveLines();
            }

            $reversal = $this->journals->post(new JournalDraft(
                transactionDate: $date ?? now(),
                lines: $lines->map(fn (GeneralLedger $line) => new JournalLineDraft(
                    accountId: $line->account_id,
                    debit: $line->credit,
                    credit: $line->debit,
                    description: $this->prefixed($line->description),
                    againstAccountId: $line->against_account_id,
                    partyType: $line->partyable_type,
                    partyId: $line->partyable_id,
                ))->all(),
                postingKey: ($original->posting_key ?? "journal:{$original->id}") . ':' . self::REVERSAL_PURPOSE,
                branchId: $original->branch_id,
                description: $this->prefixed($original->description ?? $original->code),
                sourceType: $original->source_type,
                sourceId: $original->source_id,
            ));

            Journal::query()->withoutGlobalScopes()->whereKey($original->id)->update([
                'status'                 => JournalStatus::Reversed->value,
                'reversed_by_journal_id' => $reversal->id,
            ]);
            Journal::query()->withoutGlobalScopes()->whereKey($reversal->id)->update([
                'reverses_journal_id' => $original->id,
                'reversal_reason'     => $reason,
            ]);

            event(new AuditableModelSaved(
                $original,
                'reversed',
                ['status' => JournalStatus::Posted->value],
                [
                    'status'                 => JournalStatus::Reversed->value,
                    'reversed_by_journal_id' => $reversal->id,
                    'reversal_code'          => $reversal->code,
                    'reason'                 => $reason,
                ],
            ));

            return $reversal->refresh();
        });
    }

    /**
     * Apakah jurnal dapat dibalik menurut status dan tautannya (tanpa menyentuh periode atau baris). Dipakai UI untuk
     * menampilkan tombol Balik; `reverse()` tetap memvalidasi ulang di dalam transaksi dengan kunci baris.
     */
    public function canReverse(Journal $journal): bool {
        try {
            $this->assertReversible($journal);
        } catch (InvalidJournalException|JournalAlreadyReversedException) {
            return false;
        }

        return true;
    }

    private function assertReversible(Journal $original): void {
        if ($original->reverses_journal_id !== null) {
            throw InvalidJournalException::reversalOfReversal();
        }

        if (\in_array($original->status, [JournalStatus::Reversed->value, JournalStatus::Voided->value], true)) {
            throw JournalAlreadyReversedException::make($original->code);
        }

        if ($original->legacy_unbalanced) {
            throw InvalidJournalException::legacyUnbalanced();
        }

        if ($original->status !== JournalStatus::Posted->value) {
            throw InvalidJournalException::notReversible((string) $original->status);
        }
    }

    private function prefixed(?string $text): ?string {
        return $text === null ? null : __('finances/journal.reversal_prefix') . $text;
    }
}
