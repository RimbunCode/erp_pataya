<?php

namespace App\Services\Report;

use Illuminate\Database\Eloquent\Builder;

/**
 * Kontrak filter dasar laporan. Kondisi populasi laporan ditulis hanya di sini;
 * jalur tabel (DataTableScope) dan jalur KPI sama-sama memanggil applyTo().
 */
abstract class ReportFilter {
    /**
     * Terapkan seluruh kondisi filter dasar ke builder.
     */
    abstract public function applyTo(Builder $query): Builder;

    /**
     * Ringkasan filter aktif (label => nilai) untuk header export dan isi Ticket.
     *
     * @return array<string, string>
     */
    abstract public function toSummary(): array;
}
