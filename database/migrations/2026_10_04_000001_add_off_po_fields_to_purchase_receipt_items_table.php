<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Baris Purchase Receipt di luar PO (spec purchase-receipt-off-po-items):
     * `replaces_purchase_order_item_id` = PO Item yang digantikan baris ini,
     * `replaced_quantity` = kuantitas PO Item itu (satuan PO Item) yang dianggap
     * terpenuhi. Keduanya null untuk baris normal dan baris berdiri sendiri.
     */
    public function up(): void {
        Schema::table('purchase_receipt_items', function (Blueprint $table) {
            $table->foreignUlid('replaces_purchase_order_item_id')->nullable()
                ->after('purchase_order_item_id')
                ->references('id', 'pri_replaces_po_item_index')
                ->on('purchase_order_items')
                ->nullOnDelete();
            $table->double('replaced_quantity')->nullable()->after('quantity');
        });
    }

    public function down(): void {
        // SQLite tidak mendukung drop foreign key by name -> pakai bentuk kolom.
        $isSqlite = DB::getDriverName() === 'sqlite';

        Schema::table('purchase_receipt_items', function (Blueprint $table) use ($isSqlite) {
            $table->dropForeign($isSqlite ? ['replaces_purchase_order_item_id'] : 'pri_replaces_po_item_index');
            $table->dropColumn(['replaces_purchase_order_item_id', 'replaced_quantity']);
        });
    }
};
