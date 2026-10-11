<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Penagihan item di luar PO (spec purchase-invoice-off-po-items):
     * `purchase_invoice_items.purchase_receipt_item_id` = baris receipt berdiri
     * sendiri yang ditagih; `purchase_receipt_items.billed_quantity` = total
     * kuantitas baris receipt yang sudah ditagih invoice.
     */
    public function up(): void {
        Schema::table('purchase_invoice_items', function (Blueprint $table) {
            $table->foreignUlid('purchase_receipt_item_id')->nullable()
                ->after('purchase_order_item_id')
                ->references('id', 'pii_receipt_item_index')
                ->on('purchase_receipt_items')
                ->nullOnDelete();
        });
        Schema::table('purchase_receipt_items', function (Blueprint $table) {
            $table->double('billed_quantity')->default(0)->after('returned_quantity');
            // Denormalisasi dari receipt induk: filter PO pada dropdown baris receipt
            // (LinkModel) memakai kolom nyata. Diisi PurchaseReceiptService saat simpan.
            $table->foreignUlid('purchase_order_id')->nullable()
                ->after('purchase_receipt_id')
                ->references('id', 'pri_purchase_order_index')
                ->on('purchase_orders')
                ->nullOnDelete();
        });
        DB::statement('UPDATE purchase_receipt_items SET purchase_order_id = (SELECT purchase_receipts.purchase_order_id FROM purchase_receipts WHERE purchase_receipts.id = purchase_receipt_items.purchase_receipt_id)');
    }

    public function down(): void {
        // SQLite tidak mendukung drop foreign key by name -> pakai bentuk kolom
        // (tabel dibangun ulang); driver lain tetap memakai nama constraint.
        $isSqlite = DB::getDriverName() === 'sqlite';

        Schema::table('purchase_receipt_items', function (Blueprint $table) use ($isSqlite) {
            $table->dropForeign($isSqlite ? ['purchase_order_id'] : 'pri_purchase_order_index');
            $table->dropColumn(['billed_quantity', 'purchase_order_id']);
        });
        Schema::table('purchase_invoice_items', function (Blueprint $table) use ($isSqlite) {
            $table->dropForeign($isSqlite ? ['purchase_receipt_item_id'] : 'pii_receipt_item_index');
            $table->dropColumn('purchase_receipt_item_id');
        });
    }
};
