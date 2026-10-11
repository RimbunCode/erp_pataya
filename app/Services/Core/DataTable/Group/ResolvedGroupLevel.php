<?php

namespace App\Services\Core\DataTable\Group;

/**
 * Satu level group yang SUDAH lolos gate `groupable` & siap dipakai SQL --
 * keluaran GroupLevelResolver. Semua nilai efektif (granularity/range sudah
 * divalidasi & diberi default), jadi query, `groupMeta` FE, dan `defaultGroups`
 * membaca satu sumber kebenaran yang sama.
 */
final readonly class ResolvedGroupLevel {
    /**
     * @param  string  $column  nama kolom di dataTableColumns (utk relasi: nama AKSESOR, mis. "customer")
     * @param  array<string, mixed>  $config  config kolom (dataTableColumns)
     * @param  string  $sqlColumn  kolom SQL riil tanpa prefix tabel (utk relasi: FK, mis. "customer_id")
     * @param  string  $qualified  `$sqlColumn` berprefix tabel ("dtg_records.customer_id")
     * @param  array{0: string, 1: array}|null  $bucket  [ekspresi SQL raw, bindings] utk date/number, selain itu null
     */
    public function __construct(
        public string $column,
        public ?string $type,
        public array $config,
        public string $sqlColumn,
        public string $qualified,
        public ?string $granularity,
        public int|float|null $range,
        public ?array $bucket,
    ) {}

    public function isRelation(): bool {
        return $this->type === 'relation';
    }

    /**
     * Bentuk `Groups` (kontrak lintas lapisan) dgn nilai EFEKTIF.
     *
     * @return array{column: string, granularity: ?string, range: int|float|null}
     */
    public function toGroup(): array {
        return ['column' => $this->column, 'granularity' => $this->granularity, 'range' => $this->range];
    }
}
