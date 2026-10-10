<?php

namespace Tests\Feature\Asset\AssetItems;

use App\Models\Finances\SalesInvoiceItem;
use App\Models\Sales\SalesOrderItem;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\Test;
use RuntimeException;
use Tests\TestCase;

class AssetLinesMigrationTest extends TestCase {
    private string $previousConnection;

    protected function setUp(): void {
        parent::setUp();

        $this->previousConnection = config('database.default');
        config([
            'database.connections.asset_lines_migration_test' => [
                'driver'                  => 'sqlite',
                'database'                => ':memory:',
                'prefix'                  => '',
                'foreign_key_constraints' => true,
            ],
            'database.default' => 'asset_lines_migration_test',
        ]);
        DB::purge('asset_lines_migration_test');

        $this->createLegacySchema();
    }

    protected function tearDown(): void {
        DB::disconnect('asset_lines_migration_test');
        DB::purge('asset_lines_migration_test');
        config(['database.default' => $this->previousConnection]);

        parent::tearDown();
    }

    #[Test]
    public function migrates_asset_lines_source_items_and_gl_statuses_before_dropping_child_tables(): void {
        $sourceId       = (string) Str::ulid();
        $invoiceId      = (string) Str::ulid();
        $deliveryId     = (string) Str::ulid();
        $invoiceLineId  = (string) Str::ulid();
        $deletedLineId  = (string) Str::ulid();
        $deliveryLineId = (string) Str::ulid();
        $assetId        = (string) Str::ulid();
        $ignoredAssetId = (string) Str::ulid();
        $itemVariantId  = (string) Str::ulid();

        DB::table('assets')->insert([
            ['id' => $assetId],
            ['id' => $ignoredAssetId],
        ]);
        DB::table('sales_order_items')->insert([
            'id'                => $sourceId,
            'item_id'           => $itemVariantId,
            'item_unit_id'      => 'legacy-so-unit',
            'conversion_factor' => 12,
            'quantity'          => 2,
        ]);
        DB::table('sales_invoice_items')->insert([
            'id'                  => $invoiceId,
            'sales_order_item_id' => $sourceId,
            'item_id'             => $itemVariantId,
            'item_unit_id'        => 'legacy-si-unit',
            'conversion_factor'   => 12,
            'quantity'            => 2,
        ]);
        DB::table('delivery_note_items')->insert([
            'id'                 => $deliveryId,
            'referenceable_type' => SalesOrderItem::class,
            'referenceable_id'   => $sourceId,
            'item_id'            => $itemVariantId,
            'item_unit_id'       => 'legacy-dn-unit',
            'conversion_factor'  => 12,
            'quantity'           => 2,
        ]);
        DB::table('sales_invoice_item_assets')->insert([
            [
                'id'                    => $invoiceLineId,
                'sales_invoice_item_id' => $invoiceId,
                'asset_id'              => $assetId,
                'quantity'              => 2,
                'processed_at'          => '2026-09-29 10:00:00',
                'deleted_at'            => null,
            ],
            [
                'id'                    => $deletedLineId,
                'sales_invoice_item_id' => $invoiceId,
                'asset_id'              => $ignoredAssetId,
                'quantity'              => 999,
                'processed_at'          => null,
                'deleted_at'            => '2026-09-28 10:00:00',
            ],
        ]);
        DB::table('delivery_note_item_assets')->insert([
            'id'                    => $deliveryLineId,
            'delivery_note_item_id' => $deliveryId,
            'asset_id'              => $assetId,
            'quantity'              => 2,
            'processed_at'          => null,
            'deleted_at'            => null,
        ]);
        DB::table('gl_posting_statuses')->insert([
            ['id' => 'active-status', 'referenceable_type' => 'App\\Models\\Finances\\SalesInvoiceItemAsset', 'referenceable_id' => $invoiceLineId],
            ['id' => 'deleted-status', 'referenceable_type' => 'App\\Models\\Finances\\SalesInvoiceItemAsset', 'referenceable_id' => $deletedLineId],
        ]);

        $this->migration()->up();

        $this->assertDatabaseHas('sales_order_items', [
            'id'                => $sourceId,
            'item_id'           => null,
            'asset_id'          => $assetId,
            'item_unit_id'      => null,
            'conversion_factor' => 1,
        ], 'asset_lines_migration_test');
        $this->assertDatabaseHas('sales_invoice_items', [
            'id'                => $invoiceId,
            'item_id'           => null,
            'asset_id'          => $assetId,
            'processed_at'      => '2026-09-29 10:00:00',
            'item_unit_id'      => null,
            'conversion_factor' => 1,
        ], 'asset_lines_migration_test');
        $this->assertDatabaseHas('delivery_note_items', [
            'id'                => $deliveryId,
            'item_id'           => null,
            'asset_id'          => $assetId,
            'item_unit_id'      => null,
            'conversion_factor' => 1,
        ], 'asset_lines_migration_test');
        $this->assertDatabaseHas('gl_posting_statuses', [
            'id'                 => 'active-status',
            'referenceable_type' => SalesInvoiceItem::class,
            'referenceable_id'   => $invoiceId,
        ], 'asset_lines_migration_test');
        $this->assertDatabaseHas('gl_posting_statuses', [
            'id'                 => 'deleted-status',
            'referenceable_type' => SalesInvoiceItem::class,
            'referenceable_id'   => $invoiceId,
        ], 'asset_lines_migration_test');
        $this->assertFalse(Schema::hasTable('sales_invoice_item_assets'));
        $this->assertFalse(Schema::hasTable('delivery_note_item_assets'));
    }

    #[Test]
    public function restores_legacy_schema_when_rollback_has_no_asset_data_to_recover(): void {
        $migration = $this->migration();

        $migration->up();
        $migration->down();

        $this->assertTrue(Schema::hasTable('sales_invoice_item_assets'));
        $this->assertTrue(Schema::hasTable('delivery_note_item_assets'));
        foreach (['sales_order_items', 'sales_invoice_items', 'delivery_note_items'] as $table) {
            $this->assertFalse(Schema::hasColumn($table, 'asset_id'));
            $itemId = collect(DB::select("PRAGMA table_info('{$table}')"))->firstWhere('name', 'item_id');
            $this->assertSame(1, (int) $itemId->notnull);
        }
        $this->assertFalse(Schema::hasColumn('sales_invoice_items', 'processed_at'));
        $this->assertFalse(Schema::hasColumn('delivery_note_items', 'processed_at'));
    }

    #[Test]
    public function refuses_rollback_before_discarding_migrated_asset_data(): void {
        $migration = $this->migration();
        $migration->up();

        $assetId = (string) Str::ulid();
        DB::table('assets')->insert(['id' => $assetId]);
        DB::table('sales_order_items')->insert([
            'id'       => (string) Str::ulid(),
            'item_id'  => null,
            'asset_id' => $assetId,
            'quantity' => 1,
        ]);

        try {
            $migration->down();
            $this->fail('Rollback must preserve direct Asset rows that cannot be mapped back losslessly.');
        } catch (RuntimeException $exception) {
            $this->assertStringContainsString('asset data', $exception->getMessage());
        }

        $this->assertTrue(Schema::hasColumn('sales_order_items', 'asset_id'));
        $this->assertFalse(Schema::hasTable('sales_invoice_item_assets'));
    }

    #[Test]
    public function refuses_ambiguous_active_asset_lines_before_changing_the_schema(): void {
        $parentId = (string) Str::ulid();
        DB::table('sales_invoice_items')->insert([
            'id'       => $parentId,
            'item_id'  => (string) Str::ulid(),
            'quantity' => 2,
        ]);
        DB::table('sales_invoice_item_assets')->insert([
            ['id' => (string) Str::ulid(), 'sales_invoice_item_id' => $parentId, 'asset_id' => (string) Str::ulid(), 'quantity' => 1, 'deleted_at' => null],
            ['id' => (string) Str::ulid(), 'sales_invoice_item_id' => $parentId, 'asset_id' => (string) Str::ulid(), 'quantity' => 1, 'deleted_at' => null],
        ]);

        try {
            $this->migration()->up();
            $this->fail('Ambiguous child rows must stop the migration before schema changes.');
        } catch (RuntimeException $exception) {
            $this->assertStringContainsString('multiple assets', $exception->getMessage());
        }

        $this->assertFalse(Schema::hasColumn('sales_invoice_items', 'asset_id'));
        $this->assertTrue(Schema::hasTable('sales_invoice_item_assets'));
    }

    private function createLegacySchema(): void {
        Schema::create('assets', function (Blueprint $table): void {
            $table->ulid('id')->primary();
        });
        Schema::create('sales_order_items', function (Blueprint $table): void {
            $table->ulid('id')->primary();
            $table->ulid('item_id');
            $table->ulid('item_unit_id')->nullable();
            $table->double('conversion_factor')->default(1);
            $table->double('quantity');
        });
        Schema::create('sales_invoice_items', function (Blueprint $table): void {
            $table->ulid('id')->primary();
            $table->ulid('sales_order_item_id')->nullable();
            $table->ulid('item_id');
            $table->ulid('item_unit_id')->nullable();
            $table->double('conversion_factor')->default(1);
            $table->double('quantity');
        });
        Schema::create('delivery_note_items', function (Blueprint $table): void {
            $table->ulid('id')->primary();
            $table->string('referenceable_type')->nullable();
            $table->ulid('referenceable_id')->nullable();
            $table->ulid('item_id');
            $table->ulid('item_unit_id')->nullable();
            $table->double('conversion_factor')->default(1);
            $table->double('quantity');
        });
        Schema::create('sales_invoice_item_assets', function (Blueprint $table): void {
            $table->ulid('id')->primary();
            $table->ulid('sales_invoice_item_id');
            $table->ulid('asset_id');
            $table->double('quantity');
            $table->timestamp('processed_at')->nullable();
            $table->timestamp('deleted_at')->nullable();
        });
        Schema::create('delivery_note_item_assets', function (Blueprint $table): void {
            $table->ulid('id')->primary();
            $table->ulid('delivery_note_item_id');
            $table->ulid('asset_id');
            $table->double('quantity');
            $table->timestamp('processed_at')->nullable();
            $table->timestamp('deleted_at')->nullable();
        });
        Schema::create('gl_posting_statuses', function (Blueprint $table): void {
            $table->ulid('id')->primary();
            $table->string('referenceable_type');
            $table->ulid('referenceable_id');
        });
    }

    private function migration(): object {
        return require database_path('migrations/2026_09_29_132543_migrate_asset_lines_to_document_items.php');
    }
}
