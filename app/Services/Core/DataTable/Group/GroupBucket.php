<?php

namespace App\Services\Core\DataTable\Group;

use Illuminate\Support\Facades\DB;

/**
 * Ekspresi SQL bucket utk level group bertipe date/time/datetime (granularity)
 * dan number/currency (lebar range). Dipindah apa adanya dari DataTableScope
 * (spec datatable2-group-tree, task 3.1: refactor murni).
 */
class GroupBucket {
    /**
     * Ekspresi SQL raw (tanpa alias) utk bucket kolom date/time/datetime per
     * granularity -- portable di 2 driver yg dipakai project ini (sqlite:
     * test+lokal, mysql: produksi, lihat .env.example). Key hasil SEMUA
     * granularity sengaja string yg urut leksikografis = urut kronologis
     * (YYYY, YYYY-MM, YYYY-Qn, YYYY-Hn, YYYY-MM-DD) -- ORDER BY ekspresi ini
     * langsung ASC tanpa perlu CAST tambahan.
     */
    public static function dateExpression(string $column, string $granularity): string {
        if (DB::connection()->getDriverName() === 'sqlite') {
            return match ($granularity) {
                'day'     => "date($column)",
                'quarter' => "strftime('%Y', $column) || '-Q' || ((cast(strftime('%m', $column) as integer) + 2) / 3)",
                'half'    => "strftime('%Y', $column) || '-H' || ((cast(strftime('%m', $column) as integer) + 5) / 6)",
                'year'    => "strftime('%Y', $column)",
                default   => "strftime('%Y-%m', $column)", // month
            };
        }

        // MySQL/MariaDB (produksi, lihat .env.example).
        return match ($granularity) {
            'day'     => "date($column)",
            'quarter' => "concat(year($column), '-Q', quarter($column))",
            'half'    => "concat(year($column), '-H', ceil(month($column) / 6))",
            'year'    => "date_format($column, '%Y')",
            default   => "date_format($column, '%Y-%m')", // month
        };
    }

    /**
     * Ekspresi SQL raw + bindings utk floor(kolom / range) * range -- lower
     * bound tiap bucket number/currency. `?` di ekspresi diisi $rangeSize yg
     * SAMA berkali-kali (jumlah beda per driver, lihat di bawah), TIDAK
     * pernah diinterpolasi mentah.
     *
     * MySQL: FLOOR() native, portable. SQLite: FLOOR() TIDAK SELALU tersedia
     * (build PHP/PDO SQLite di environment ini butuh flag kompilasi
     * SQLITE_ENABLE_MATH_FUNCTIONS yg tak aktif -- ketauan dari error nyata
     * "no such function: floor" saat test) -- emulasi floor(a/b) portable
     * pakai CAST+koreksi tanda: truncation (CAST AS INTEGER) membulat ke
     * arah 0, utk nilai negatif dgn sisa non-bulat hasil truncation LEBIH
     * BESAR dari floor sebenarnya (mis. floor(-0.5)=-1, trunc(-0.5)=0) --
     * dikoreksi -1 via CASE WHEN saat quotient asli < hasil truncation-nya.
     *
     * @return array{0: string, 1: array}
     */
    public static function numberExpression(string $column, float $rangeSize): array {
        if (DB::connection()->getDriverName() === 'sqlite') {
            return [
                "(cast($column / ? as integer) - (case when $column / ? < cast($column / ? as integer) then 1 else 0 end)) * ?",
                [$rangeSize, $rangeSize, $rangeSize, $rangeSize],
            ];
        }

        return ["floor($column / ?) * ?", [$rangeSize, $rangeSize]];
    }

    /**
     * Granularity EFEKTIF utk kolom date/time/datetime: nilai yang diminta bila
     * termasuk GroupLevels::GRANULARITIES, selain itu 'month'. null utk tipe lain.
     */
    public static function effectiveGranularity(?string $type, mixed $requested): ?string {
        if (! \in_array($type, ['date', 'time', 'datetime'], true)) {
            return null;
        }

        return \in_array($requested, GroupLevels::GRANULARITIES, true) ? $requested : 'month';
    }

    /**
     * Lebar range EFEKTIF utk kolom number/currency: nilai yang diminta bila
     * numerik > 0, selain itu opsi pertama `groupRangeOptions` kolom (fallback
     * 100). null utk tipe lain. Angka dikembalikan APA ADANYA (int/float) --
     * dipakai jg utk dibagikan ke FE.
     */
    public static function effectiveRange(?string $type, array $groupConfig, mixed $requested): int|float|null {
        if (! \in_array($type, ['number', 'currency'], true)) {
            return null;
        }
        if (\is_numeric($requested) && (float) $requested > 0) {
            return $requested + 0;
        }

        return $groupConfig['groupRangeOptions'][0] ?? 100;
    }

    /**
     * Ekspresi SQL bucket utk level date/time/datetime (granularity) atau
     * number/currency (lebar range) dari nilai EFEKTIF (lihat effective*()).
     * Kolom scalar/relation biasa TIDAK butuh bucket (return null -- caller
     * pakai plain column).
     *
     * Rentang TIDAK PERNAH diinterpolasi mentah ke SQL -- selalu lewat binding
     * (?), konsisten dgn prinsip "jangan percaya input user di raw SQL".
     *
     * @return array{0: string, 1: array}|null [ekspresi SQL raw, bindings]
     */
    public static function expression(?string $type, string $columnQualified, ?string $granularity, int|float|null $range): ?array {
        if (\in_array($type, ['date', 'time', 'datetime'], true)) {
            return [self::dateExpression($columnQualified, $granularity ?? 'month'), []];
        }
        if (\in_array($type, ['number', 'currency'], true)) {
            return self::numberExpression($columnQualified, (float) ($range ?? 100));
        }

        return null;
    }
}
