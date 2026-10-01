<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * `amount` (generated quantity * price) dikonversi jadi kolom biasa oleh
     * migration berikutnya, convert_quotation_item_amount_to_stored_column.
     */
    public function up(): void {
        Schema::table('quotation_items', function (Blueprint $table) {
            $table->foreignUlid('item_unit_id')->nullable()->after('item_id')
                ->references('id')->on('item_units')->nullOnDelete();
            $table->string('remark')->nullable()->after('description');
            $table->foreignUlid('tax_id')->nullable()->after('price')
                ->references('id')->on('taxes')->nullOnDelete();
            $table->double('tax_rate')->default(0)->after('tax_id');
            $table->double('basic_amount')->default(0)->after('tax_rate');
            $table->double('tax_amount')->default(0)->after('basic_amount');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void {
        Schema::table('quotation_items', function (Blueprint $table) {
            $table->dropForeign(['item_unit_id']);
            $table->dropForeign(['tax_id']);
        });

        Schema::table('quotation_items', function (Blueprint $table) {
            $table->dropColumn([
                'item_unit_id',
                'remark',
                'tax_id',
                'tax_rate',
                'basic_amount',
                'tax_amount',
            ]);
        });
    }
};
