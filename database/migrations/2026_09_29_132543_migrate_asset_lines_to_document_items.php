<?php

use App\Models\Sales\SalesOrderItem;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void {
        $this->assertConvertibleLines('sales_invoice_item_assets', 'sales_invoice_items', 'sales_invoice_item_id');
        $this->assertConvertibleLines('delivery_note_item_assets', 'delivery_note_items', 'delivery_note_item_id');
        $sources = $this->sourceSalesOrderAssets();

        foreach (['sales_order_items', 'sales_invoice_items', 'delivery_note_items'] as $tableName) {
            Schema::table($tableName, function (Blueprint $table) {
                $table->foreignUlid('item_id')->nullable()->change();
                $table->foreignUlid('asset_id')->nullable()->references('id')->on('assets')->nullOnDelete();
                $table->index('asset_id');
            });
        }

        foreach (['sales_invoice_items', 'delivery_note_items'] as $tableName) {
            Schema::table($tableName, function (Blueprint $table) {
                $table->timestamp('processed_at')->nullable();
            });
        }

        $this->migrateAssetLines(
            'sales_invoice_item_assets',
            'sales_invoice_items',
            'sales_invoice_item_id',
            'App\\Models\\Finances\\SalesInvoiceItemAsset',
            'App\\Models\\Finances\\SalesInvoiceItem',
        );
        $this->migrateAssetLines(
            'delivery_note_item_assets',
            'delivery_note_items',
            'delivery_note_item_id',
            'App\\Models\\Inventory\\DeliveryNoteItemAsset',
            'App\\Models\\Inventory\\DeliveryNoteItem',
        );
        $this->migrateSourceSalesOrderItems($sources);

        Schema::dropIfExists('sales_invoice_item_assets');
        Schema::dropIfExists('delivery_note_item_assets');
    }

    private function assertConvertibleLines(string $source, string $target, string $parentKey): void {
        if (! Schema::hasTable($source)) {
            return;
        }

        $ambiguous = DB::table($source)
            ->whereNull('deleted_at')
            ->select($parentKey)
            ->groupBy($parentKey)
            ->havingRaw('COUNT(*) > 1')
            ->first();

        if ($ambiguous) {
            throw new RuntimeException("Cannot migrate {$source}: multiple assets belong to one document item.");
        }

        foreach (DB::table($source)->whereNull('deleted_at')->orderBy('id')->cursor() as $line) {
            $parent = DB::table($target)->where('id', $line->{$parentKey})->first();
            if (! $parent || abs((float) $parent->quantity - (float) $line->quantity) > 0.0001) {
                throw new RuntimeException("Cannot migrate {$source} row {$line->id}: quantity or parent mismatch.");
            }
        }
    }

    private function migrateAssetLines(
        string $source,
        string $target,
        string $parentKey,
        string $sourceType,
        string $targetType,
    ): void {
        if (! Schema::hasTable($source)) {
            return;
        }

        foreach (DB::table($source)->whereNull('deleted_at')->orderBy('id')->cursor() as $line) {
            DB::table($target)->where('id', $line->{$parentKey})->update([
                'item_id'           => null,
                'asset_id'          => $line->asset_id,
                'item_unit_id'      => null,
                'conversion_factor' => 1,
                'processed_at'      => $line->processed_at,
            ]);
        }

        if (Schema::hasTable('gl_posting_statuses')) {
            DB::table('gl_posting_statuses')
                ->where('referenceable_type', $sourceType)
                ->whereIn('referenceable_id', DB::table($source)->select('id'))
                ->update([
                    'referenceable_type' => $targetType,
                    'referenceable_id'   => DB::raw("(SELECT {$parentKey} FROM {$source} WHERE {$source}.id = gl_posting_statuses.referenceable_id)"),
                ]);
        }
    }

    private function sourceSalesOrderAssets(): array {
        $sources = [];

        if (Schema::hasTable('sales_invoice_item_assets')) {
            foreach (DB::table('sales_invoice_item_assets as lines')
                ->join('sales_invoice_items as items', 'items.id', '=', 'lines.sales_invoice_item_id')
                ->whereNull('lines.deleted_at')
                ->whereNotNull('items.sales_order_item_id')
                ->select('items.sales_order_item_id as source_id', 'lines.asset_id')
                ->cursor() as $row) {
                $sources[] = $row;
            }
        }

        if (Schema::hasTable('delivery_note_item_assets')) {
            foreach (DB::table('delivery_note_item_assets as lines')
                ->join('delivery_note_items as items', 'items.id', '=', 'lines.delivery_note_item_id')
                ->whereNull('lines.deleted_at')
                ->where('items.referenceable_type', SalesOrderItem::class)
                ->select('items.referenceable_id as source_id', 'lines.asset_id')
                ->cursor() as $row) {
                $sources[] = $row;
            }
        }

        $assetsBySource = [];
        foreach ($sources as $row) {
            if (isset($assetsBySource[$row->source_id]) && $assetsBySource[$row->source_id] !== $row->asset_id) {
                throw new RuntimeException("Cannot migrate SalesOrderItem {$row->source_id}: multiple assets use one source row.");
            }
            $assetsBySource[$row->source_id] = $row->asset_id;
        }

        return $assetsBySource;
    }

    private function migrateSourceSalesOrderItems(array $assetsBySource): void {
        foreach ($assetsBySource as $sourceId => $assetId) {
            DB::table('sales_order_items')->where('id', $sourceId)->update([
                'item_id'           => null,
                'asset_id'          => $assetId,
                'item_unit_id'      => null,
                'conversion_factor' => 1,
            ]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void {
        foreach (['sales_order_items', 'sales_invoice_items', 'delivery_note_items'] as $table) {
            if (DB::table($table)->whereNotNull('asset_id')->exists() || DB::table($table)->whereNull('item_id')->exists()) {
                throw new RuntimeException('Cannot reverse this migration while asset data is present; restore from backup first.');
            }
        }

        if (Schema::hasTable('gl_posting_statuses') && DB::table('gl_posting_statuses')
            ->whereIn('referenceable_type', [
                'App\\Models\\Finances\\SalesInvoiceItem',
                'App\\Models\\Inventory\\DeliveryNoteItem',
            ])
            ->exists()) {
            throw new RuntimeException('Cannot reverse this migration while migrated GL posting statuses are present; restore from backup first.');
        }

        Schema::create('sales_invoice_item_assets', function (Blueprint $table): void {
            $table->ulid('id')->primary();
            $table->foreignUlid('sales_invoice_item_id')->references('id')->on('sales_invoice_items')->cascadeOnDelete();
            $table->foreignUlid('asset_id')->references('id')->on('assets')->restrictOnDelete();
            $table->decimal('quantity', 15, 4);
            $table->timestamp('processed_at')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('delivery_note_item_assets', function (Blueprint $table): void {
            $table->ulid('id')->primary();
            $table->foreignUlid('delivery_note_item_id')->references('id')->on('delivery_note_items')->cascadeOnDelete();
            $table->foreignUlid('asset_id')->references('id')->on('assets')->restrictOnDelete();
            $table->decimal('quantity', 15, 4);
            $table->timestamp('processed_at')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        foreach (['sales_order_items', 'sales_invoice_items', 'delivery_note_items'] as $tableName) {
            Schema::table($tableName, function (Blueprint $table): void {
                $table->dropForeign(['asset_id']);
                $table->dropIndex(['asset_id']);
                $table->dropColumn('asset_id');
                $table->foreignUlid('item_id')->nullable(false)->change();
            });
        }

        foreach (['sales_invoice_items', 'delivery_note_items'] as $tableName) {
            Schema::table($tableName, function (Blueprint $table): void {
                $table->dropColumn('processed_at');
            });
        }
    }
};
