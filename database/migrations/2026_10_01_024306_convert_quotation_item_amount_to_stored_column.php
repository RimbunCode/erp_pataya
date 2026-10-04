<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * `amount` semula generated column (quantity * price). Setelah ada pajak
     * rumusnya basic_amount + tax_amount dan dihitung di QuotationService,
     * sehingga harus jadi kolom biasa. Pola mengikuti
     * convert_sales_order_items_amounts_to_stored_columns.
     */
    public function up(): void {
        // Nilai lama WAJIB dibaca ke memori sebelum drop, kalau tidak angka
        // Quotation yang sudah ada hilang.
        $existing = DB::table('quotation_items')
            ->select('id', 'amount')
            ->get();

        // Schema::table() terpisah per drop: SQLite table-rebuild gagal bila
        // masih ada generated column lain yang mereferensikan kolom yang di-drop.
        Schema::table('quotation_items', function (Blueprint $table) {
            $table->dropColumn('amount');
        });

        Schema::table('quotation_items', function (Blueprint $table) {
            $table->double('amount')->default(0)->after('tax_amount');
        });

        foreach ($existing as $row) {
            // Sebelum ada pajak, basic_amount sama dengan amount.
            DB::table('quotation_items')
                ->where('id', $row->id)
                ->update([
                    'basic_amount' => $row->amount,
                    'amount'       => $row->amount,
                ]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void {
        Schema::table('quotation_items', function (Blueprint $table) {
            $table->dropColumn('amount');
        });

        Schema::table('quotation_items', function (Blueprint $table) {
            $table->double('amount')->storedAs('quantity * price')->after('tax_amount');
        });
    }
};
