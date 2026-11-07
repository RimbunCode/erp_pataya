<?php

namespace App\Services\Finances\Ledger;

use App\Enums\JournalStatus;
use App\Models\Core\FormatingSeries;
use App\Models\Finances\GeneralLedger;
use App\Models\Finances\Journal;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;
use RangeException;
use RuntimeException;
use Throwable;

/**
 * Backfill baris `general_ledgers` lama (tanpa `journal_id`) menjadi jurnal legacy (Finance Fase 1, Requirement 9, D-8).
 *
 * Pengelompokan: per dokumen sumber (`referenceable_type` + `referenceable_id`), dipecah per hari kalender dalam
 * zona waktu perusahaan (`FiscalPeriodService::businessDay()`, Q-P1-5) hanya bila dokumen punya posting di hari
 * berbeda; pasangan yang hanya berbeda detik tetap satu kelompok (N-3). Hari dihitung di PHP, bukan `DATE()` di SQL.
 * Baris soft-deleted (dokumen yang dibatalkan lewat perilaku legacy `Submitable`) juga diproses, tetapi selalu
 * di kelompok terpisah dari baris aktif dokumen yang sama dan menjadi jurnal legacy berstatus `voided` (keputusan
 * pemilik produk 2026-11-04, I-1), agar setiap baris punya `journal_id` dan migration NOT NULL (Task 9) dapat jalan.
 *
 * Yang ditulis hanya: baris `journals` baru (`legacy_origin = true`), serta `journal_id`/`line_no` pada baris GL lewat
 * jalur yang diizinkan guard (`GeneralLedger::BACKFILL_ASSIGNABLE`). `debit`, `credit`, `account_id`,
 * `transaction_date`, dan `code` baris tidak berubah (Requirement 9.5). Kelompok tak seimbang diberi
 * `legacy_unbalanced = true` tanpa koreksi nilai (Requirement 9.3). Setiap kelompok diproses dalam transaksinya
 * sendiri dan baris yang sudah ber-`journal_id` dilewati, sehingga perintah idempoten dan dapat dilanjutkan.
 *
 * Baris contoh (`is_example = true`) ikut digabungkan (global scope `exclude_example_data` dilepas): bila tidak,
 * baris itu tetap tanpa `journal_id` dan migration NOT NULL (Task 9) akan menolak jalan.
 *
 * @phpstan-type Snapshot array{rows: int, sum_debit: float, sum_credit: float, accounts: array<string, array{rows: int, debit: float, credit: float}>}
 */
final class JournalBackfillService {
    private const EXAMPLE_SCOPE = 'exclude_example_data';

    public function __construct(
        private readonly FiscalPeriodService $periods,
        private readonly JournalService $journals,
    ) {}

    /**
     * @param  int  $chunk  jumlah dokumen yang dimuat per putaran (kursor keyset)
     * @param  int|null  $limit  batas jumlah jurnal yang dibuat (atau yang akan dibuat pada dry-run)
     * @return array<string, mixed> laporan (lihat kunci di bawah)
     */
    public function run(bool $dryRun = false, int $chunk = 1000, ?int $limit = null): array {
        $chunk = max(1, $chunk);

        if (! $dryRun) {
            Journal::ensureNumberingSeries();
        }

        [$currencyCode, $minorUnit] = $this->journals->baseCurrency();

        $report = [
            'dry_run'             => $dryRun,
            'documents'           => 0,
            'journals'            => 0,
            'lines'               => 0,
            'unbalanced_journals' => 0,
            'failures'            => [],
            'limit_reached'       => false,
            'voided_journals'     => 0,
            'soft_deleted_rows'   => $this->countRows(softDeleted: true),
            'years'               => $dryRun ? $this->yearRange() : $this->generateYears(),
            'before'              => $this->snapshot(),
        ];

        $last = null;
        while (! $report['limit_reached']) {
            $documents = $this->nextDocuments($chunk, $last);
            if ($documents->isEmpty()) {
                break;
            }

            foreach ($documents as $document) {
                $last = [$document->referenceable_type, $document->referenceable_id];
                $report['documents']++;

                foreach ($this->dayGroups($document->referenceable_type, $document->referenceable_id) as $group) {
                    $ids = $group['ids'];

                    if ($limit !== null && $report['journals'] >= $limit) {
                        $report['limit_reached'] = true;

                        break 2;
                    }

                    try {
                        $outcome = $dryRun
                            ? $this->previewGroup($ids, $minorUnit)
                            : DB::transaction(fn () => $this->backfillGroup($document->referenceable_type, $document->referenceable_id, $ids, $minorUnit, $currencyCode));
                    } catch (Throwable $e) {
                        if (\count($report['failures']) < 20) {
                            $report['failures'][] = "{$document->referenceable_type}:{$document->referenceable_id}: {$e->getMessage()}";
                        }

                        continue;
                    }

                    if ($outcome === null) {
                        continue; // Sudah ber-journal_id (dijalankan ulang/paralel).
                    }

                    $report['journals']++;
                    $report['lines'] += $outcome['lines'];
                    $report['unbalanced_journals'] += $outcome['unbalanced'] ? 1 : 0;
                    $report['voided_journals'] += $outcome['voided'] ? 1 : 0;
                }
            }
        }

        $report['after']                = $dryRun ? $report['before'] : $this->snapshot();
        $report['rows_without_journal'] = [
            'active'       => $this->countRows(softDeleted: false, withoutJournal: true),
            'soft_deleted' => $this->countRows(softDeleted: true, withoutJournal: true),
        ];
        $report['mismatched_accounts'] = $dryRun ? [] : $this->mismatches($report['before'], $report['after']);

        return $report;
    }

    /**
     * Dokumen (referenceable) berikutnya yang masih punya baris (aktif maupun soft-deleted) tanpa `journal_id`, dengan
     * kursor keyset agar dry-run (yang tidak menulis apa pun) dan proses nyata sama-sama maju. Biaya: satu `GROUP BY`
     * per putaran atas baris tanpa `journal_id` (indeks `referenceable_type`/`referenceable_id`), sehingga waktu total
     * kira-kira linear terhadap jumlah dokumen dibagi `--chunk`, ditambah satu kueri baris per dokumen.
     *
     * @param  array{0: string, 1: string}|null  $after
     * @return \Illuminate\Support\Collection<int, object{referenceable_type: string, referenceable_id: string}>
     */
    private function nextDocuments(int $chunk, ?array $after): \Illuminate\Support\Collection {
        return DB::table('general_ledgers')
            ->whereNull('journal_id')
            ->when($after !== null, fn ($query) => $query->where(function ($where) use ($after) {
                $where->where('referenceable_type', '>', $after[0])
                    ->orWhere(fn ($same) => $same->where('referenceable_type', $after[0])->where('referenceable_id', '>', $after[1]));
            }))
            ->select('referenceable_type', 'referenceable_id')
            ->groupBy('referenceable_type', 'referenceable_id')
            ->orderBy('referenceable_type')
            ->orderBy('referenceable_id')
            ->limit($chunk)
            ->get();
    }

    /**
     * Id baris satu dokumen, dikelompokkan per (status hapus, hari kalender zona perusahaan). Baris aktif dan baris
     * soft-deleted tidak pernah digabung; urut menaik per hari, baris aktif lebih dulu pada hari yang sama.
     *
     * @return list<array{ids: list<string>}>
     */
    private function dayGroups(string $type, string $id): array {
        $rows = $this->documentRows($type, $id)->get(['id', 'transaction_date', 'deleted_at']);

        return $rows
            ->groupBy(fn (GeneralLedger $row) => $this->periods->businessDay($row->transaction_date) . '|' . ($row->deleted_at === null ? '0' : '1'))
            ->sortKeys()
            ->map(fn (Collection $group) => ['ids' => $group->pluck('id')->all()])
            ->values()
            ->all();
    }

    private function documentRows(string $type, string $id): Builder {
        return GeneralLedger::query()
            ->withTrashed()
            ->withoutGlobalScope(self::EXAMPLE_SCOPE)
            ->whereNull('journal_id')
            ->where('referenceable_type', $type)
            ->where('referenceable_id', $id)
            ->orderBy('created_at')
            ->orderBy('id');
    }

    /**
     * Dry-run: hitung saja tanpa menulis.
     *
     * @param  list<string>  $ids
     * @return array{lines: int, unbalanced: bool, voided: bool}|null
     */
    private function previewGroup(array $ids, int $minorUnit): ?array {
        $rows = GeneralLedger::query()->withTrashed()->withoutGlobalScope(self::EXAMPLE_SCOPE)->whereNull('journal_id')->whereIn('id', $ids)->get();

        return $rows->isEmpty() ? null : ['lines' => $rows->count(), 'unbalanced' => ! $this->isBalanced($rows, $minorUnit), 'voided' => $rows->first()->deleted_at !== null];
    }

    /**
     * @param  list<string>  $ids
     * @return array{lines: int, unbalanced: bool, voided: bool}|null null bila semua baris sudah ber-`journal_id`
     *
     * @throws RuntimeException bila status hapus baris campuran (grup basi); dicatat sebagai kegagalan dan
     *                          transaksinya digulung, jalankan ulang agar baris dikelompokkan ulang
     */
    private function backfillGroup(string $type, string $id, array $ids, int $minorUnit, ?string $currencyCode): ?array {
        $rows = $this->documentRows($type, $id)->whereIn('id', $ids)->lockForUpdate()->get();
        if ($rows->isEmpty()) {
            return null;
        }

        // Status dari baris yang sudah dikunci, bukan dari pengelompokan tanpa kunci: dokumen dapat dibatalkan (baris
        // di-soft-delete oleh hook `Submitable`) di antara keduanya (Requirement 9.4, 9.7).
        $deletedCount = $rows->filter(fn (GeneralLedger $row) => $row->deleted_at !== null)->count();
        if ($deletedCount !== 0 && $deletedCount !== $rows->count()) {
            throw new RuntimeException('Status hapus baris berubah selama backfill (campuran aktif dan soft-deleted); jalankan ulang agar dikelompokkan ulang.');
        }
        $voided = $deletedCount > 0;

        $balanced = $this->isBalanced($rows, $minorUnit);
        $first    = $rows->first();
        $earliest = $rows->min('transaction_date');
        $period   = $this->periods->resolve($earliest);

        $journal = Journal::forceCreate([
            'code'              => FormatingSeries::generate(Journal::class, []),
            'transaction_date'  => $earliest,
            'fiscal_period_id'  => $period?->id,
            'branch_id'         => $rows->pluck('branch_id')->filter()->first(),
            'status'            => ($voided ? JournalStatus::Voided : JournalStatus::Posted)->value,
            'source_type'       => $type,
            'source_id'         => $id,
            'currency_code'     => $currencyCode,
            'total_debit'       => number_format($rows->sum('debit'), 4, '.', ''),
            'total_credit'      => number_format($rows->sum('credit'), 4, '.', ''),
            'posted_at'         => $rows->min('created_at') ?? now(),
            'legacy_origin'     => true,
            'legacy_unbalanced' => ! $balanced,
            'is_example'        => $rows->every(fn (GeneralLedger $row) => (bool) $row->is_example),
        ]);

        foreach ($rows->values() as $index => $row) {
            // Jalur backfill yang diizinkan guard: hanya `journal_id` dan `line_no`.
            $row->forceFill(['journal_id' => $journal->id, 'line_no' => $index + 1])->save();
        }

        return ['lines' => $rows->count(), 'unbalanced' => ! $balanced, 'voided' => $voided];
    }

    /**
     * Seimbang menurut minor unit mata uang dasar (Requirement 9.3). Nilai di luar rentang aman dianggap tak
     * seimbang agar dilaporkan, bukan menggagalkan backfill.
     *
     * @param  Collection<int, GeneralLedger>  $rows
     */
    private function isBalanced(Collection $rows, int $minorUnit): bool {
        try {
            $difference = 0;
            foreach ($rows as $row) {
                $difference += MinorUnit::toMinor((float) $row->debit, $minorUnit) - MinorUnit::toMinor((float) $row->credit, $minorUnit);
            }

            return $difference === 0;
        } catch (RangeException|InvalidArgumentException) {
            return false;
        }
    }

    /**
     * Tahun fiskal kalender yang menutupi rentang `transaction_date` GL (dalam zona perusahaan) sampai akhir tahun
     * berjalan (Requirement 6.8). Tahun non-kalender bernama sama atau yang tumpang-tindih dilaporkan sebagai
     * peringatan; periode untuk rentang itu tidak dibuat dan `fiscal_period_id` jurnal terkait tetap null.
     *
     * @return array{from: int|null, to: int|null, generated: list<string>, warnings: list<string>}
     */
    private function generateYears(): array {
        $range = $this->yearRange();
        if ($range['from'] === null) {
            return $range;
        }

        for ($year = $range['from']; $year <= $range['to']; $year++) {
            try {
                $this->periods->generateYear($year);
                $range['generated'][] = (string) $year;
            } catch (ValidationException $e) {
                $range['warnings'][] = "{$year}: " . implode(' ', collect($e->errors())->flatten()->all());
            }
        }

        return $range;
    }

    /**
     * @return array{from: int|null, to: int|null, generated: list<string>, warnings: list<string>}
     */
    private function yearRange(): array {
        $min = DB::table('general_ledgers')->min('transaction_date');
        if ($min === null) {
            return ['from' => null, 'to' => null, 'generated' => [], 'warnings' => []];
        }

        $from = (int) substr($this->periods->businessDay(CarbonImmutable::parse((string) $min, (string) config('app.timezone'))), 0, 4);
        $to   = (int) substr($this->periods->businessDay(CarbonImmutable::now()), 0, 4);

        return ['from' => $from, 'to' => max($from, $to), 'generated' => [], 'warnings' => []];
    }

    /**
     * Jumlah baris `general_ledgers` (raw, semua global scope dilepas).
     */
    private function countRows(bool $softDeleted, bool $withoutJournal = false): int {
        $query = DB::table('general_ledgers');
        $softDeleted ? $query->whereNotNull('deleted_at') : $query->whereNull('deleted_at');
        if ($withoutJournal) {
            $query->whereNull('journal_id');
        }

        return $query->count();
    }

    /**
     * Jumlah baris aktif dan Σdebit/Σkredit per akun (raw), untuk rekonsiliasi sebelum/sesudah (Requirement 9.8).
     *
     * @return array{rows: int, sum_debit: float, sum_credit: float, accounts: array<string, array{rows: int, debit: float, credit: float}>}
     */
    private function snapshot(): array {
        $accounts = [];
        $rows     = 0;
        $debit    = 0.0;
        $credit   = 0.0;

        $aggregates = DB::table('general_ledgers')
            ->whereNull('deleted_at')
            ->selectRaw('account_id, COUNT(*) as row_count, COALESCE(SUM(debit), 0) as sum_debit, COALESCE(SUM(credit), 0) as sum_credit')
            ->groupBy('account_id')
            ->get();

        foreach ($aggregates as $aggregate) {
            $accounts[$aggregate->account_id] = [
                'rows'   => (int) $aggregate->row_count,
                'debit'  => round((float) $aggregate->sum_debit, 4),
                'credit' => round((float) $aggregate->sum_credit, 4),
            ];
            $rows += (int) $aggregate->row_count;
            $debit += (float) $aggregate->sum_debit;
            $credit += (float) $aggregate->sum_credit;
        }

        return ['rows' => $rows, 'sum_debit' => round($debit, 4), 'sum_credit' => round($credit, 4), 'accounts' => $accounts];
    }

    /**
     * Akun yang jumlah baris atau Σdebit/Σkreditnya berbeda antara sebelum dan sesudah (seharusnya kosong).
     *
     * @param  array<string, mixed>  $before
     * @param  array<string, mixed>  $after
     * @return list<string>
     */
    private function mismatches(array $before, array $after): array {
        $mismatches = [];
        foreach (array_unique([...array_keys($before['accounts']), ...array_keys($after['accounts'])]) as $accountId) {
            $a = $before['accounts'][$accountId] ?? ['rows' => 0, 'debit' => 0.0, 'credit' => 0.0];
            $b = $after['accounts'][$accountId] ?? ['rows' => 0, 'debit' => 0.0, 'credit' => 0.0];

            if ($a['rows'] !== $b['rows'] || abs($a['debit'] - $b['debit']) > 0.00005 || abs($a['credit'] - $b['credit']) > 0.00005) {
                $mismatches[] = $accountId;
            }
        }

        return $mismatches;
    }
}
