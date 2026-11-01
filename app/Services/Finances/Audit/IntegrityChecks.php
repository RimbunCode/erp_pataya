<?php

namespace App\Services\Finances\Audit;

use Illuminate\Database\Connection;
use Illuminate\Database\Query\Builder;

/**
 * Pemeriksaan integritas baris `general_ledgers`: keseimbangan, nilai tak wajar, akun, dan duplikasi.
 * Semua kategori dihitung dengan agregasi database; hanya contoh yang diambil ke PHP.
 */
final class IntegrityChecks {
    private const GROUP_COLUMNS = ['referenceable_type', 'referenceable_id', 'transaction_date'];

    public function __construct(private Connection $db, private float $tolerance = 0.005) {}

    /**
     * @return array<string, mixed>
     */
    public function totals(): array {
        $sum = $this->activeLedger()
            ->selectRaw('COUNT(*) as row_count, COALESCE(SUM(debit), 0) as sum_debit, COALESCE(SUM(credit), 0) as sum_credit, MIN(transaction_date) as date_min, MAX(transaction_date) as date_max')
            ->first();

        $groups = $this->db->query()->fromSub(
            $this->activeLedger()->select(self::GROUP_COLUMNS)->groupBy(self::GROUP_COLUMNS),
            'g',
        )->count();

        $sumDebit  = round((float) $sum->sum_debit, 4);
        $sumCredit = round((float) $sum->sum_credit, 4);

        return [
            'rows'              => (int) $sum->row_count,
            'rows_soft_deleted' => $this->db->table('general_ledgers')->whereNotNull('deleted_at')->count(),
            'groups'            => $groups,
            'date_min'          => $sum->date_min,
            'date_max'          => $sum->date_max,
            'sum_debit'         => $sumDebit,
            'sum_credit'        => $sumCredit,
            'diff'              => round($sumDebit - $sumCredit, 4),
        ];
    }

    /**
     * Kelompok posting (referenceable + tanggal transaksi) yang |Σdebit − Σkredit| melebihi toleransi.
     *
     * @return array{count: int, total_diff: float, samples: list<array<string, mixed>>}
     */
    public function unbalancedGroups(int $limit): array {
        $base = $this->activeLedger()
            ->select(self::GROUP_COLUMNS)
            ->selectRaw('COUNT(*) as line_count, SUM(debit) as sum_debit, SUM(credit) as sum_credit, ABS(SUM(debit) - SUM(credit)) as diff')
            ->groupBy(self::GROUP_COLUMNS)
            // Literal float (bukan binding): SQLite mengikat parameter sebagai teks dan menganggap angka < teks.
            ->havingRaw(sprintf('ABS(SUM(debit) - SUM(credit)) > %.6F', $this->tolerance));

        $agg = $this->db->query()->fromSub($base, 'g')
            ->selectRaw('COUNT(*) as group_count, COALESCE(SUM(diff), 0) as total_diff')
            ->first();

        return [
            'count'      => (int) $agg->group_count,
            'total_diff' => round((float) $agg->total_diff, 4),
            'samples'    => $this->samples((clone $base)->orderByDesc('diff')->limit($limit)),
        ];
    }

    /**
     * Baris dengan debit dan kredit sama-sama nol, atau salah satunya negatif.
     *
     * @return array{count: int, samples: list<array<string, mixed>>}
     */
    public function zeroOrNegative(int $limit): array {
        $query = $this->activeLedger()->where(function (Builder $where) {
            $where->where(fn (Builder $zero) => $zero->where('debit', 0)->where('credit', 0))
                ->orWhere('debit', '<', 0)
                ->orWhere('credit', '<', 0);
        });

        return [
            'count'   => (clone $query)->count(),
            'samples' => $this->samples(
                (clone $query)->select(['id', 'referenceable_type', 'referenceable_id', 'debit', 'credit'])->orderBy('id')->limit($limit),
            ),
        ];
    }

    /**
     * Baris aktif yang `account_id` atau `against_account_id`-nya merujuk akun yang tidak ada atau soft-deleted.
     *
     * @return array{count: int, samples: list<array<string, mixed>>}
     */
    public function danglingAccounts(int $limit): array {
        $count   = 0;
        $samples = [];

        foreach (['account_id', 'against_account_id'] as $column) {
            $query = $this->db->table('general_ledgers as gl')
                ->leftJoin('accounts as a', 'a.id', '=', "gl.{$column}")
                ->whereNull('gl.deleted_at')
                ->where(fn (Builder $where) => $where->whereNull('a.id')->orWhereNotNull('a.deleted_at'));

            $count += (clone $query)->count();

            $found = $this->samples(
                (clone $query)
                    ->selectRaw('gl.id as id, gl.referenceable_type, gl.referenceable_id, gl.' . $column . ' as account_ref, a.deleted_at as account_deleted_at')
                    ->selectRaw('? as account_column', [$column])
                    ->orderBy('gl.id')
                    ->limit($limit),
            );
            $samples = array_slice([...$samples, ...$found], 0, $limit);
        }

        return ['count' => $count, 'samples' => $samples];
    }

    /**
     * Kombinasi (referenceable, akun, debit, kredit, tanggal) yang muncul lebih dari sekali.
     *
     * @return array{count: int, extra_rows: int, samples: list<array<string, mixed>>}
     */
    public function duplicates(int $limit): array {
        $columns = ['referenceable_type', 'referenceable_id', 'account_id', 'debit', 'credit', 'transaction_date'];

        $base = $this->activeLedger()
            ->select($columns)
            ->selectRaw('COUNT(*) as occurrences')
            ->groupBy($columns)
            ->havingRaw('COUNT(*) > 1');

        $agg = $this->db->query()->fromSub($base, 'g')
            ->selectRaw('COUNT(*) as group_count, COALESCE(SUM(occurrences - 1), 0) as extra_rows')
            ->first();

        return [
            'count'      => (int) $agg->group_count,
            'extra_rows' => (int) $agg->extra_rows,
            'samples'    => $this->samples((clone $base)->orderByDesc('occurrences')->orderBy('referenceable_id')->limit($limit)),
        ];
    }

    private function activeLedger(): Builder {
        return $this->db->table('general_ledgers')->whereNull('deleted_at');
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function samples(Builder $query): array {
        return $query->get()->map(fn ($row) => (array) $row)->all();
    }
}
