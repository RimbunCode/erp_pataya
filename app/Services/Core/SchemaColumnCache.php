<?php

namespace App\Services\Core;

use Illuminate\Support\Facades\Schema;

/**
 * Cache in-memory (statis, per proses PHP) daftar kolom DB per tabel --
 * `Schema::getColumnListing()`/`Schema::hasColumn()` membaca skema (query
 * `information_schema.columns` di MySQL, `pragma_table_xinfo` di SQLite),
 * mahal bila diulang. Ditemukan lewat Clockwork: >1 pemanggil independen
 * (`HasExampleData::bootHasExampleData()` global scope -- jalan di SETIAP
 * query model manapun yang pakai trait ini -- dan
 * `DataTableColumnSelector::localColumns()`) masing-masing memanggil
 * `Schema::hasColumn()` mentah tanpa cache, jadi tabel yang sama
 * di-introspeksi berkali-kali dalam SATU request. Satu-satunya sumber
 * kebenaran sekarang -- pemanggil baru WAJIB lewat sini, jangan panggil
 * `Schema::getColumnListing()`/`Schema::hasColumn()` langsung lagi.
 */
class SchemaColumnCache {
    /** @var array<string, list<string>> */
    private static array $columns = [];

    /**
     * @return list<string>
     */
    public static function columns(string $table): array {
        return self::$columns[$table] ??= Schema::getColumnListing($table);
    }

    public static function hasColumn(string $table, string $column): bool {
        return \in_array($column, self::columns($table), true);
    }

    /** Dipanggil test/artisan command yang mengubah skema di tengah proses. */
    public static function forget(?string $table = null): void {
        if ($table === null) {
            self::$columns = [];

            return;
        }
        unset(self::$columns[$table]);
    }
}
