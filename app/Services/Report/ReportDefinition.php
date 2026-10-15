<?php

namespace App\Services\Report;

use App\Models\Model;
use App\Models\Scopes\DataTableScope;
use Closure;
use Illuminate\Support\Collection;

/**
 * Definisi satu laporan untuk jalur export dan hitung ulang (spec modul-laporan, Req 5.6 dan 7).
 *
 * Semua laporan memakai bentuk yang sama, sehingga export dan hitung ulang tidak perlu
 * mengetahui detail tiap laporan. Penghitung ulang (recount) menjumlahkan baris hasil filter
 * di aplikasi, sebagai pembanding bebas terhadap KPI yang dihitung SQL.
 */
final class ReportDefinition {
    /**
     * @param  class-string  $permissionModel  modul sumber, untuk izin select (Req 6.1)
     * @param  class-string  $rowModel  model baca-saja (view laporan)
     * @param  list<string>  $filterKeys  parameter query yang dibaca laporan
     * @param  Closure(array<string, string|null>): ReportFilter  $makeFilter
     * @param  Closure(ReportFilter): ReportKpi  $kpi
     * @param  Closure(Collection): array<string, int|float>  $recount
     * @param  array<string, string>  $kpiLabels  nama KPI => label
     * @param  array<string, string>  $columns  atribut baris => label kolom export
     */
    public function __construct(
        public readonly string $key,
        public readonly string $title,
        public readonly string $permissionModel,
        public readonly string $rowModel,
        public readonly array $filterKeys,
        public readonly Closure $makeFilter,
        public readonly Closure $kpi,
        public readonly Closure $recount,
        public readonly array $kpiLabels,
        public readonly array $columns,
    ) {}

    /**
     * Seluruh baris hasil filter, diurutkan seperti tabel. Dipakai export (Req 7.2) dan
     * hitung ulang akurat (Req 5.6), dengan kondisi cabang dan filter yang sama dengan tabel.
     *
     * @return Collection<int, Model>
     */
    public function rows(ReportFilter $filter): Collection {
        $query = ($this->rowModel)::query();
        DataTableScope::applyBranchFilter($query);
        $filter->applyTo($query);

        return $query->orderBy(($this->rowModel)::getDefaultSortColumn())->get();
    }
}
