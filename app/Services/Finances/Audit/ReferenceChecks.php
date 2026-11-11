<?php

namespace App\Services\Finances\Audit;

use Illuminate\Database\Connection;
use Illuminate\Database\Query\Builder;

/**
 * Pemeriksaan hubungan baris `general_ledgers` dengan dokumen sumbernya (`referenceable`).
 *
 * Definisi (design Fase 0, "Catatan pembatalan"): saat cancel, hook `Submitable` men-soft-delete baris GL
 * dokumen. Maka soft-delete pada dokumen `canceled` dianggap *diharapkan*; soft-delete pada dokumen lain
 * adalah anomali; dokumen `canceled` yang masih punya GL aktif adalah anomali (indikasi F-16).
 */
final class ReferenceChecks {
    public function __construct(private Connection $db) {}

    /**
     * @return array{expected: array<string, mixed>, unexpected: array<string, mixed>}
     */
    public function softDeleted(int $limit): array {
        $expected   = ['count' => 0, 'samples' => []];
        $unexpected = ['count' => 0, 'samples' => []];

        foreach ($this->referenceTypes() as $type) {
            $deleted = $this->db->table('general_ledgers')->where('referenceable_type', $type)->whereNotNull('deleted_at');
            $doc     = LedgerDocumentTable::describe($this->db, $type);

            if ($doc !== null && $doc['has_status']) {
                $canceledIds = $this->canceledIds($doc['table']);
                $this->add($expected, (clone $deleted)->whereIn('referenceable_id', $canceledIds), $limit);
                $this->add($unexpected, (clone $deleted)->whereNotIn('referenceable_id', $canceledIds), $limit);

                continue;
            }

            $this->add($unexpected, $deleted, $limit);
        }

        return ['expected' => $expected, 'unexpected' => $unexpected];
    }

    /**
     * Baris GL aktif yang dokumen sumbernya tidak ditemukan (atau `referenceable_type` tidak dikenal).
     *
     * @return array{count: int, samples: list<array<string, mixed>>}
     */
    public function orphanReferences(int $limit): array {
        $section = ['count' => 0, 'samples' => []];

        foreach ($this->referenceTypes() as $type) {
            $active = $this->db->table('general_ledgers')->where('referenceable_type', $type)->whereNull('deleted_at');
            $doc    = LedgerDocumentTable::describe($this->db, $type);

            if ($doc === null) {
                $this->add($section, $active, $limit, ['note' => 'tipe tidak dikenal']);

                continue;
            }

            $table = $doc['table'];
            $this->add($section, $active->whereNotExists(
                fn (Builder $exists) => $exists->selectRaw('1')->from($table)->whereColumn("{$table}.id", 'general_ledgers.referenceable_id'),
            ), $limit);
        }

        return $section;
    }

    /**
     * Dokumen `canceled` yang masih memiliki baris GL aktif (F-16).
     *
     * @return array{count: int, samples: list<array<string, mixed>>}
     */
    public function canceledWithActiveLedger(int $limit): array {
        $section = ['count' => 0, 'samples' => []];

        foreach ($this->referenceTypes() as $type) {
            $doc = LedgerDocumentTable::describe($this->db, $type);

            if ($doc === null || ! $doc['has_status']) {
                continue;
            }

            $table = $doc['table'];
            $query = $this->db->table($table)
                ->whereJsonContains('status', 'canceled')
                ->whereExists(fn (Builder $exists) => $exists->selectRaw('1')->from('general_ledgers')
                    ->where('general_ledgers.referenceable_type', $type)
                    ->whereColumn('general_ledgers.referenceable_id', "{$table}.id")
                    ->whereNull('general_ledgers.deleted_at'));

            $section['count'] += (clone $query)->count();
            $found = (clone $query)->select("{$table}.id as referenceable_id")->orderBy("{$table}.id")->limit($limit)->get()
                ->map(fn ($row) => ['referenceable_type' => $type, 'referenceable_id' => $row->referenceable_id])->all();
            $section['samples'] = array_slice([...$section['samples'], ...$found], 0, $limit);
        }

        return $section;
    }

    /**
     * @return list<string>
     */
    private function referenceTypes(): array {
        return $this->db->table('general_ledgers')->distinct()->orderBy('referenceable_type')->pluck('referenceable_type')->all();
    }

    private function canceledIds(string $table): Builder {
        return $this->db->table($table)->select('id')->whereJsonContains('status', 'canceled');
    }

    /**
     * @param  array{count: int, samples: list<array<string, mixed>>}  $section
     * @param  array<string, mixed>  $extra
     */
    private function add(array &$section, Builder $query, int $limit, array $extra = []): void {
        $section['count'] += (clone $query)->count();

        $found = (clone $query)
            ->select(['id', 'referenceable_type', 'referenceable_id', 'debit', 'credit', 'deleted_at'])
            ->orderBy('id')->limit($limit)->get()
            ->map(fn ($row) => [...AmountColumns::normalize((array) $row), ...$extra])->all();

        $section['samples'] = array_slice([...$section['samples'], ...$found], 0, $limit);
    }
}
