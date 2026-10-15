<?php

namespace Tests\Support;

use App\Models\Core\Branch;
use App\Models\Inventory\ItemVariant;
use App\Models\Inventory\StockLedgerEntry;
use App\Models\Purchase\PurchaseReceipt;
use Database\Factories\Purchase\PurchaseOrderFactory;
use Database\Factories\Sales\SalesOrderFactory;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * Helper data uji untuk laporan modul-laporan. Data ditulis langsung lewat DB
 * supaya tidak bergantung pada alur dokumen (SO, PO, dan lain-lain) yang belum
 * tentu ikut tersedia di setiap tes.
 */
trait InsertsReportData {
    /**
     * Izin select pada Stock (modul Inventory) untuk user uji.
     */
    protected function withInventoryAccess(): static {
        return $this->withModelAccess(StockLedgerEntry::class);
    }

    /**
     * Izin select pada model sumber tertentu untuk user uji (Req 6.1).
     *
     * @param  class-string  $modelClass
     */
    protected function withModelAccess(string $modelClass): static {
        return $this->withSession([
            'permissions' => [
                $modelClass => [
                    0 => [
                        [
                            'model'        => $modelClass,
                            'level'        => 0,
                            'only_creator' => false,
                            'permissions'  => ['select' => true, 'read' => true],
                        ],
                    ],
                ],
            ],
            'permissions_version' => '0|0|0|0',
            'currentBranch'       => null,
        ]);
    }

    /**
     * Insert satu baris ke tabel, hanya kolom yang ada di skema tes.
     *
     * @param  array<string, mixed>  $row
     */
    protected function reportInsertRow(string $table, array $row): void {
        // Kolom generated (hidden 2 atau 3 di table_xinfo SQLite) tidak boleh diisi; nilainya
        // dihitung oleh DB dari kolom lain.
        $writable = collect(DB::select("PRAGMA table_xinfo(\"{$table}\")"))
            ->filter(fn ($column) => (int) $column->hidden === 0)
            ->pluck('name')
            ->all();

        DB::table($table)->insert(array_intersect_key($row, array_flip($writable)));
    }

    /**
     * Sales Order beserta barisnya. Header dibuat lewat factory, item lewat DB.
     *
     * @param  array<string, mixed>  $attributes
     * @param  list<array<string, mixed>>  $items  kolom item (quantity, basic_amount, dst.)
     */
    protected function reportSalesOrder(array $attributes = [], array $items = []): string {
        $order = SalesOrderFactory::new()->create($attributes);

        foreach ($items as $item) {
            $itemId = $item['item_id'] ?? $this->reportItemVariant();
            // basic_amount di skema tes adalah generated column (quantity * price), jadi tidak
            // diisi. tax_amount dan amount adalah kolom biasa yang diisi aplikasi, sehingga
            // dihitung di sini dengan rumus yang sama seperti SalesOrderService.
            $row = array_merge([
                'quantity'           => 1,
                'delivered_quantity' => 0,
                'price'              => 0,
                'tax_rate'           => 0,
                'discount_amount'    => 0,
            ], $item);
            $basic = $row['quantity'] * $row['price'];
            $tax   = $basic * $row['tax_rate'] / 100;

            $this->reportInsertRow('sales_order_items', array_merge($row, [
                'id'             => (string) Str::ulid(),
                'sales_order_id' => $order->id,
                'item_id'        => $itemId,
                'item_unit_id'   => $this->reportItemUnit($itemId),
                'tax_amount'     => $tax,
                'amount'         => $basic + $tax,
                'created_at'     => now(),
                'updated_at'     => now(),
            ], ['item_id' => $itemId]));
        }

        return $order->id;
    }

    /**
     * Purchase Order beserta barisnya. Header lewat factory, item lewat DB (rate, bukan price).
     *
     * @param  array<string, mixed>  $attributes
     * @param  list<array<string, mixed>>  $items  kolom item (quantity, rate, tax_rate, dst.)
     */
    protected function reportPurchaseOrder(array $attributes = [], array $items = []): string {
        $order = PurchaseOrderFactory::new()->create($attributes);

        foreach ($items as $item) {
            $itemId = $item['item_id'] ?? $this->reportItemVariant();
            $row    = array_merge([
                'quantity'          => 1,
                'received_quantity' => 0,
                'rate'              => 0,
                'tax_rate'          => 0,
                'discount_amount'   => 0,
            ], $item);
            $basic = $row['quantity'] * $row['rate'];
            $tax   = $basic * $row['tax_rate'] / 100;

            $this->reportInsertRow('purchase_order_items', array_merge($row, [
                'id'                => (string) Str::ulid(),
                'purchase_order_id' => $order->id,
                'item_id'           => $itemId,
                'item_unit_id'      => $this->reportItemUnit($itemId),
                'tax_amount'        => $tax,
                'amount'            => $basic + $tax,
                'created_at'        => now(),
                'updated_at'        => now(),
            ], ['item_id' => $itemId]));
        }

        return $order->id;
    }

    protected function reportBranch(bool $isMain): string {
        return Branch::create([
            'name'           => ($isMain ? 'Cabang Utama ' : 'Cabang ') . Str::upper(Str::random(3)),
            'code'           => 'BR-' . Str::upper(Str::random(4)),
            'is_main_branch' => $isMain,
        ])->id;
    }

    protected function reportWarehouse(?string $branchId = null): string {
        $warehouseId = (string) Str::ulid();
        DB::table('warehouses')->insert([
            'id'         => $warehouseId,
            'branch_id'  => $branchId ?? Branch::query()->first()?->id ?? $this->reportBranch(true),
            'name'       => 'Gudang ' . Str::upper(Str::random(3)),
            'code'       => 'WH-' . Str::upper(Str::random(4)),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return $warehouseId;
    }

    /**
     * Item variant beserta satuan dasarnya, lalu kembalikan id item variant.
     */
    protected function reportItemVariant(): string {
        return ItemVariant::factory()->create()->id;
    }

    /**
     * Satuan dan konversi item (item_units) untuk kolom item_unit_id.
     */
    protected function reportItemUnit(string $itemVariantId): string {
        $unitId = (string) Str::ulid();
        DB::table('units')->insert([
            'id'         => $unitId,
            'code'       => 'U-' . Str::upper(Str::random(4)),
            'name'       => 'Pcs',
            'is_default' => 0,
            'is_example' => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $itemUnitId = (string) Str::ulid();
        DB::table('item_units')->insert([
            'id'                => $itemUnitId,
            'item_id'           => ItemVariant::query()->findOrFail($itemVariantId)->item_id,
            'unit_id'           => $unitId,
            'conversion_factor' => 1,
            'is_default'        => 1,
            'order'             => 0,
            'created_at'        => now(),
            'updated_at'        => now(),
        ]);

        return $itemUnitId;
    }

    /**
     * Satu baris stock_ledger_entries. Atribut yang tidak disebut diisi nilai aman.
     *
     * @param  array<string, mixed>  $attributes
     */
    protected function reportLedgerEntry(array $attributes): string {
        $id     = (string) Str::ulid();
        $itemId = $attributes['item_id'] ?? $this->reportItemVariant();

        // Kolom `code` dan `have_transactions` ditambahkan generic migration di prod,
        // belum ada di skema tes. Kolom yang tidak ada di skema dibuang supaya tes
        // tidak gagal karena kolom tambahan itu.
        $row = array_merge([
            'id'                         => $id,
            'code'                       => 'SLE-' . Str::upper(Str::random(8)),
            'item_id'                    => $itemId,
            'warehouse_id'               => $this->reportWarehouse(),
            'item_unit_id'               => $this->reportItemUnit($itemId),
            'conversion_factor'          => 1,
            'quantity_change'            => 0,
            'quantity_after_transaction' => 0,
            'valuation_rate'             => 0,
            'balance_stock_value'        => 0,
            'change_in_stock_value'      => 0,
            'is_valuated'                => 1,
            'transaction_date'           => now(),
            'stock_queue'                => '[]',
            'referenceable_type'         => PurchaseReceipt::class,
            'referenceable_id'           => (string) Str::ulid(),
            'have_transactions'          => 0,
            'is_example'                 => 0,
            'created_at'                 => now(),
            'updated_at'                 => now(),
        ], $attributes);

        $columns = Schema::getColumnListing('stock_ledger_entries');
        DB::table('stock_ledger_entries')->insert(array_intersect_key($row, array_flip($columns)));

        return $id;
    }
}
