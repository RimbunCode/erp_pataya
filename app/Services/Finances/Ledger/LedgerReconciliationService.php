<?php

namespace App\Services\Finances\Ledger;

use App\Enums\JournalStatus;
use App\Services\Finances\Audit\GeneralLedgerAuditor;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

/**
 * Rekonsiliasi invarian ledger jurnal (Finance Fase 1, Requirement 10). Read-only: hanya `SELECT`.
 *
 * Pelanggaran (membuat `finance:reconcile-ledger` gagal): (a) jurnal non-legacy `posted`/`reversed` yang tak seimbang
 * berdasarkan baris aktif, (b) `total_debit`/`total_credit` jurnal tidak sama dengan Σ baris aktifnya, (c) baris (aktif maupun
 * soft-deleted) tanpa `journal_id` (sesudah backfill), (d) jurnal `posted` tanpa baris aktif. Informasi (bukan kegagalan): jurnal
 * `legacy_unbalanced` (sampai ditangani) dan temuan `GeneralLedgerAuditor` Fase 0 yang beririsan; auditor dipakai
 * apa adanya (kelompok referenceable + tanggal), sehingga perbedaannya dengan pengelompokan jurnal dilaporkan, bukan
 * disamakan.
 */
final class LedgerReconciliationService {
    public function __construct(private readonly JournalService $journals) {}

    /**
     * @param  bool  $ignoreUnjournaled  turunkan (c) menjadi informasi (mis. sebelum backfill dijalankan)
     * @return array{violations: array<string, array{count: int, samples: list<array<string, mixed>>}>, info: array<string, int>, failed: bool}
     */
    public function run(int $limit = 20, bool $ignoreUnjournaled = false): array {
        [, $minorUnit] = $this->journals->baseCurrency();
        // Setengah satuan minor unit: selisih lebih kecil dari ini hanyalah noise pembulatan, bukan ketakseimbangan.
        $threshold = 0.5 / (10 ** $minorUnit);

        $violations = [
            'a_unbalanced_journals'   => $this->unbalancedJournals($threshold, $limit),
            'b_total_mismatch'        => $this->totalMismatch($threshold, $limit),
            'c_lines_without_journal' => $this->linesWithoutJournal($limit),
            'd_posted_without_lines'  => $this->postedWithoutLines($limit),
        ];

        $info = [
            'legacy_unbalanced_journals' => DB::table('journals')->where('legacy_unbalanced', true)->count(),
            'voided_journals'            => DB::table('journals')->where('status', JournalStatus::Voided->value)->count(),
        ];

        if ($ignoreUnjournaled) {
            $info['lines_without_journal_ignored'] = $violations['c_lines_without_journal']['count'];
            $violations['c_lines_without_journal'] = ['count' => 0, 'samples' => []];
        }

        $report = (new GeneralLedgerAuditor)->run(['limit' => $limit]);
        foreach (['unbalanced_groups', 'zero_or_negative', 'dangling_account', 'orphan_reference', 'canceled_active_gl', 'duplicates'] as $section) {
            $info["audit_{$section}"] = (int) ($report->sections[$section]['count'] ?? 0);
        }

        return [
            'violations' => $violations,
            'info'       => $info,
            'failed'     => collect($violations)->contains(fn (array $violation) => $violation['count'] > 0),
        ];
    }

    /**
     * Agregat baris aktif per jurnal.
     */
    private function lineTotals(): Builder {
        return DB::table('general_ledgers')
            ->whereNull('deleted_at')
            ->whereNotNull('journal_id')
            ->selectRaw('journal_id, COALESCE(SUM(debit), 0) as sum_debit, COALESCE(SUM(credit), 0) as sum_credit')
            ->groupBy('journal_id');
    }

    /**
     * @return array{count: int, samples: list<array<string, mixed>>}
     */
    private function unbalancedJournals(float $threshold, int $limit): array {
        $query = DB::table('journals as j')
            ->joinSub($this->lineTotals(), 't', 't.journal_id', '=', 'j.id')
            ->where('j.legacy_origin', false)
            ->whereIn('j.status', [JournalStatus::Posted->value, JournalStatus::Reversed->value])
            ->whereRaw(sprintf('ABS(t.sum_debit - t.sum_credit) > %.6F', $threshold));

        return $this->result($query, ['j.id', 'j.code', 'j.status', 't.sum_debit', 't.sum_credit'], $limit);
    }

    /**
     * @return array{count: int, samples: list<array<string, mixed>>}
     */
    private function totalMismatch(float $threshold, int $limit): array {
        $query = DB::table('journals as j')
            ->leftJoinSub($this->lineTotals(), 't', 't.journal_id', '=', 'j.id')
            ->where('j.status', '!=', JournalStatus::Voided->value)
            ->where(function (Builder $where) use ($threshold) {
                $where->whereRaw(sprintf('ABS(j.total_debit - COALESCE(t.sum_debit, 0)) > %.6F', $threshold))
                    ->orWhereRaw(sprintf('ABS(j.total_credit - COALESCE(t.sum_credit, 0)) > %.6F', $threshold));
            });

        return $this->result($query, ['j.id', 'j.code', 'j.total_debit', 'j.total_credit', 't.sum_debit', 't.sum_credit'], $limit);
    }

    /**
     * @return array{count: int, samples: list<array<string, mixed>>}
     */
    private function linesWithoutJournal(int $limit): array {
        // Semua baris, termasuk soft-deleted: itulah yang diperiksa pengaman migration NOT NULL (Task 9.1).
        $query = DB::table('general_ledgers')->whereNull('journal_id');

        return $this->result($query, ['id', 'referenceable_type', 'referenceable_id', 'debit', 'credit', 'deleted_at'], $limit);
    }

    /**
     * @return array{count: int, samples: list<array<string, mixed>>}
     */
    private function postedWithoutLines(int $limit): array {
        $query = DB::table('journals as j')
            ->where('j.status', JournalStatus::Posted->value)
            ->whereNotExists(fn (Builder $exists) => $exists->selectRaw('1')
                ->from('general_ledgers as gl')
                ->whereColumn('gl.journal_id', 'j.id')
                ->whereNull('gl.deleted_at'));

        return $this->result($query, ['j.id', 'j.code', 'j.legacy_origin'], $limit);
    }

    /**
     * @param  list<string>  $columns
     * @return array{count: int, samples: list<array<string, mixed>>}
     */
    private function result(Builder $query, array $columns, int $limit): array {
        return [
            'count'   => (clone $query)->count(),
            'samples' => (clone $query)->select($columns)->limit($limit)->get()->map(fn ($row) => (array) $row)->all(),
        ];
    }
}
