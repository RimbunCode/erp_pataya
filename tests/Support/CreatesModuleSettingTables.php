<?php

namespace Tests\Support;

use Illuminate\Support\Facades\Schema;
use LogicException;

trait CreatesModuleSettingTables {
    protected function createModuleSettingTables(): void {
        foreach (['countries', 'currencies', 'files', 'taxes', 'core_settings', 'finance_settings', 'sales_settings'] as $table) {
            if (Schema::hasTable($table)) {
                continue;
            }
            $migrations = glob(database_path('migrations/*_create_' . $table . '_table.php'));
            if (count($migrations) !== 1) {
                throw new LogicException('Expected one creation migration for ' . $table);
            }
            (require $migrations[0])->up();
        }

        if (! Schema::hasColumn('core_settings', 'mail_host')) {
            (require database_path('migrations/2026_10_19_093846_add_mail_fields_to_core_settings_table.php'))->up();
        }

        // Migrasi files asli tidak membawa kolom tree (ditambah runtime oleh
        // TreeView/initPermissions pada seed penuh); File::create butuh kolom
        // ini — pola yang sama dipakai LegacyPreferenceMapTest.
        Schema::table('files', function ($table): void {
            foreach (['lft', 'rgt'] as $column) {
                if (! Schema::hasColumn('files', $column)) {
                    $table->unsignedBigInteger($column)->nullable();
                }
            }
            if (! Schema::hasColumn('files', 'depth')) {
                $table->unsignedInteger('depth')->nullable();
            }
        });
    }
}
