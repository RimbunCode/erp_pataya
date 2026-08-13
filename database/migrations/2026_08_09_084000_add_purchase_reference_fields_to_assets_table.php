<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void {
        Schema::table('assets', function (Blueprint $table) {
            $table->foreignUlid('purchase_receipt_item_id')->nullable()
                ->after('item_id')->constrained('purchase_receipt_items')->nullOnDelete();
            $table->foreignUlid('purchase_invoice_item_id')->nullable()
                ->after('purchase_receipt_item_id')->constrained('purchase_invoice_items')->nullOnDelete();
        });
    }

    public function down(): void {
        Schema::table('assets', function (Blueprint $table) {
            $table->dropForeign(['purchase_receipt_item_id']);
            $table->dropForeign(['purchase_invoice_item_id']);
            $table->dropColumn(['purchase_receipt_item_id', 'purchase_invoice_item_id']);
        });
    }
};
