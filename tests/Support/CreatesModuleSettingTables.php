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

        $salesSettingColumns = [
            'default_source_warehouse_id'      => fn ($table) => $table->ulid('default_source_warehouse_id')->nullable(),
            'default_payment_term_template_id' => fn ($table) => $table->ulid('default_payment_term_template_id')->nullable(),
            'over_delivery_tolerance_percent'  => fn ($table) => $table->decimal('over_delivery_tolerance_percent', 5, 2)->nullable()->default(null),
            'over_billing_tolerance_percent'   => fn ($table) => $table->decimal('over_billing_tolerance_percent', 5, 2)->nullable()->default(null),
            'rate_change_action'               => fn ($table) => $table->string('rate_change_action')->default('none'),
            'below_cost_action'                => fn ($table) => $table->string('below_cost_action')->default('none'),
        ];
        $missingSalesSettingColumns = array_filter(
            $salesSettingColumns,
            fn ($addColumn, $column): bool => ! Schema::hasColumn('sales_settings', $column),
            ARRAY_FILTER_USE_BOTH,
        );

        if ($missingSalesSettingColumns !== []) {
            Schema::table('sales_settings', function ($table) use ($missingSalesSettingColumns): void {
                foreach ($missingSalesSettingColumns as $addColumn) {
                    $addColumn($table);
                }
            });
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
