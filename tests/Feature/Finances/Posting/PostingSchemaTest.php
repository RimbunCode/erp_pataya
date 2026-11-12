<?php

namespace Tests\Feature\Finances\Posting;

use App\Models\Finances\PostingParityLog;
use App\Models\Finances\PostingProfile;
use App\Models\Finances\PostingProfileAccount;
use App\Models\Finances\PostingProfileRule;
use App\Models\User\Permission;
use App\Traits\DataTable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * Finance Fase 2, Task 2.2-2.3: skema tabel Posting Engine dan F-12 (Requirement 11.2): `initPermissions()` menambah
 * kolom saat runtime, jadi tabel `DataTable` baru harus mendeklarasikannya eksplisit supaya no-op. Sengaja memakai
 * `RefreshDatabase` polos (bukan `setUpFinanceFixtures`, yang menambah `is_example` ke semua tabel lebih dulu dan
 * akan menyembunyikan kolom yang hilang).
 */
class PostingSchemaTest extends TestCase {
    use RefreshDatabase;

    /**
     * @return array{columns: array<string, array<string, mixed>>, indexes: array<string, array<string, mixed>>}
     */
    private function snapshot(string $table): array {
        $columns = [];
        foreach (Schema::getColumns($table) as $column) {
            $columns[$column['name']] = [
                'type'     => $column['type'],
                'nullable' => $column['nullable'],
                'default'  => $column['default'],
            ];
        }
        ksort($columns);

        $indexes = [];
        foreach (Schema::getIndexes($table) as $index) {
            $indexes[$index['name']] = ['columns' => $index['columns'], 'unique' => $index['unique'], 'primary' => $index['primary']];
        }
        ksort($indexes);

        return ['columns' => $columns, 'indexes' => $indexes];
    }

    public function test_init_permissions_is_a_noop_on_new_datatable_tables(): void {
        foreach ([PostingProfile::class, PostingParityLog::class] as $model) {
            $table  = (new $model)->getTable();
            $before = $this->snapshot($table);

            $model::initPermissions();

            $this->assertSame($before, $this->snapshot($table), "initPermissions() mengubah skema tabel {$table}.");
        }
    }

    public function test_runtime_columns_are_declared_exactly_as_init_permissions_would_add_them(): void {
        foreach (['posting_profiles', 'posting_parity_logs'] as $table) {
            $snapshot = $this->snapshot($table);

            $this->assertArrayNotHasKey('code', $snapshot['columns'], "{$table} tidak memakai kode series.");
            $this->assertSame(['is_example'], $snapshot['indexes']["{$table}_is_example_index"]['columns']);
            $this->assertArrayHasKey('have_transactions', $snapshot['columns']);
            foreach (['submitted_at', 'canceled_at', 'revision_number', 'amended_from_id', 'additional_data', 'submitted_format', 'parent_id', 'lft', 'rgt', 'depth'] as $forbidden) {
                $this->assertArrayNotHasKey($forbidden, $snapshot['columns'], "Kolom {$forbidden} bukan milik model non-submitable/non-tree.");
            }
        }

        foreach (['posting_profile_accounts', 'posting_profile_rules'] as $table) {
            $this->assertArrayNotHasKey('is_example', $this->snapshot($table)['columns'], "{$table} tidak memakai DataTable.");
        }
    }

    public function test_tables_have_the_columns_and_constraints_of_the_design(): void {
        $profiles = $this->snapshot('posting_profiles');
        foreach (['id', 'name', 'effective_from', 'effective_to', 'status', 'version', 'previous_profile_id', 'notes', 'created_at', 'updated_at'] as $column) {
            $this->assertArrayHasKey($column, $profiles['columns'], "posting_profiles.{$column}");
        }
        $this->assertTrue($profiles['columns']['effective_to']['nullable']);
        $this->assertTrue($profiles['columns']['previous_profile_id']['nullable']);
        $this->assertArrayNotHasKey('branch_id', $profiles['columns'], 'Profil bersifat global.');

        $accounts = $this->snapshot('posting_profile_accounts');
        $this->assertTrue($accounts['indexes']['posting_profile_accounts_profile_role_unique']['unique']);
        $this->assertSame(['posting_profile_id', 'role'], $accounts['indexes']['posting_profile_accounts_profile_role_unique']['columns']);

        $rules = $this->snapshot('posting_profile_rules');
        foreach (['document_type', 'variant', 'item_type', 'is_stock_item', 'item_category_id'] as $nullable) {
            $this->assertTrue($rules['columns'][$nullable]['nullable'], "posting_profile_rules.{$nullable} harus nullable.");
        }
        $this->assertFalse($rules['columns']['role']['nullable']);
        $this->assertFalse($rules['columns']['account_id']['nullable']);
        $this->assertTrue($rules['indexes']['posting_profile_rules_conditions_unique']['unique']);
        $this->assertSame(
            ['posting_profile_id', 'role', 'document_type', 'variant', 'item_type', 'is_stock_item', 'item_category_id'],
            $rules['indexes']['posting_profile_rules_conditions_unique']['columns'],
        );

        $logs = $this->snapshot('posting_parity_logs');
        foreach (['document_type', 'source_type', 'source_id', 'status', 'legacy', 'engine', 'diff', 'created_at'] as $column) {
            $this->assertArrayHasKey($column, $logs['columns'], "posting_parity_logs.{$column}");
        }
        $this->assertArrayNotHasKey('updated_at', $logs['columns']);
        $this->assertSame(['document_type', 'status', 'created_at'], $logs['indexes']['posting_parity_logs_type_status_created_index']['columns']);
    }

    public function test_index_names_fit_the_mysql_identifier_limit(): void {
        foreach (['posting_profiles', 'posting_profile_accounts', 'posting_profile_rules', 'posting_parity_logs'] as $table) {
            foreach (array_keys($this->snapshot($table)['indexes']) as $name) {
                $this->assertLessThanOrEqual(64, strlen($name), "Nama indeks {$name} melebihi 64 karakter (MySQL).");
            }
            foreach (Schema::getForeignKeys($table) as $foreignKey) {
                $this->assertLessThanOrEqual(64, strlen((string) $foreignKey['name']), "Nama FK {$foreignKey['name']} melebihi 64 karakter (MySQL).");
            }
        }
    }

    public function test_permissions_match_requirement_11_3(): void {
        PostingProfile::initPermissions();
        PostingParityLog::initPermissions();

        $profile = Permission::withoutGlobalScopes()->where('model', PostingProfile::class)->firstOrFail();
        $this->assertSame(['select', 'read', 'write', 'activate'], $profile->permissions);
        $this->assertSame('Posting Profiles', $profile->name);
        $this->assertSame('Finances', $profile->module);

        $log = Permission::withoutGlobalScopes()->where('model', PostingParityLog::class)->firstOrFail();
        $this->assertSame(['select', 'read'], $log->permissions);
        $this->assertSame('Posting Parity Logs', $log->name);
    }

    public function test_child_models_are_not_registered_as_permission_models(): void {
        $this->assertNotContains(
            DataTable::class,
            class_uses_recursive(PostingProfileAccount::class),
        );
        $this->assertNotContains(
            DataTable::class,
            class_uses_recursive(PostingProfileRule::class),
        );
    }
}
