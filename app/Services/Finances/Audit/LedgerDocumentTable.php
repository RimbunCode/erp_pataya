<?php

namespace App\Services\Finances\Audit;

use Illuminate\Database\Connection;
use Illuminate\Database\Eloquent\Model;

/**
 * Menerjemahkan `referenceable_type` (nama kelas) ke tabel dokumennya untuk audit.
 */
final class LedgerDocumentTable {
    /**
     * @return array{table: string, has_status: bool}|null null bila kelas atau tabelnya tidak ada
     */
    public static function describe(Connection $db, string $class): ?array {
        if (! class_exists($class) || ! is_subclass_of($class, Model::class)) {
            return null;
        }

        $table  = (new $class)->getTable();
        $schema = $db->getSchemaBuilder();

        if (! $schema->hasTable($table)) {
            return null;
        }

        return ['table' => $table, 'has_status' => $schema->hasColumn($table, 'status')];
    }
}
