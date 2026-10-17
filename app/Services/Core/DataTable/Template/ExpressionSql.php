<?php

namespace App\Services\Core\DataTable\Template;

/**
 * Bangun potongan SQL untuk kolom `expression` (number / currency / progress).
 *
 * Ekspresi berasal HANYA dari kode developer (`configColumns`); input pengguna
 * tidak pernah digabung ke string ini -- nilai pembanding filter dikirim sebagai
 * binding oleh pemanggil.
 */
final class ExpressionSql {
    /** Tipe kolom yang boleh memakai `expression`. */
    public const EXPRESSION_TYPES = ['number', 'currency', 'progress'];

    /**
     * SQL kolom expression siap SELECT/WHERE/ORDER (tanpa alias).
     * `null` bila kolom tanpa `expression` valid atau tipenya tidak didukung.
     *
     * @param  array<string, mixed>  $column
     */
    public static function forColumn(array $column): ?string {
        $expr = $column['expression'] ?? null;
        $type = $column['type'] ?? null;

        if (! is_string($expr) || trim($expr) === '' || ! in_array($type, self::EXPRESSION_TYPES, true)) {
            return null;
        }

        return $type === 'progress' ? self::progress($expr) : "({$expr})";
    }

    /**
     * Clamp progress ke 0-100 dengan 2 desimal. Portabel MySQL & SQLite
     * (tanpa LEAST/GREATEST: SQLite memakai MIN/MAX skalar yang berbeda).
     * NULL tetap NULL (mis. pembagi nol via NULLIF).
     */
    public static function progress(string $expr): string {
        return "CASE WHEN ({$expr}) IS NULL THEN NULL"
            . " WHEN ({$expr}) < 0 THEN 0"
            . " WHEN ({$expr}) > 100 THEN 100"
            . " ELSE ROUND(({$expr}), 2) END";
    }
}
