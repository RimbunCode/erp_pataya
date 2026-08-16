<?php

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
        $existing = DB::table('purchase_order_items')
            ->select('id', 'basic_amount', 'tax_amount', 'amount')
            ->get();

        // `amount` mereferensikan `tax_amount` yang mereferensikan `basic_amount` --
        // harus di-drop berurutan (yang bergantung dulu) di Schema::table() terpisah,
        // karena SQLite melakukan table-rebuild per panggilan dan gagal jika ada
        // generated column lain yang masih mereferensikan kolom yang sedang di-drop.
        Schema::table('purchase_order_items', function (Blueprint $table) {
            $table->dropColumn('amount');
        });

        Schema::table('purchase_order_items', function (Blueprint $table) {
            $table->dropColumn('tax_amount');
        });

        Schema::table('purchase_order_items', function (Blueprint $table) {
            $table->dropColumn('basic_amount');
        });

        Schema::table('purchase_order_items', function (Blueprint $table) {
            $table->double('basic_amount')->default(0)->after('rate');
        });

        Schema::table('purchase_order_items', function (Blueprint $table) {
            $table->double('tax_amount')->default(0)->after('basic_amount');
        });

        Schema::table('purchase_order_items', function (Blueprint $table) {
            $table->double('amount')->default(0)->after('tax_amount');
        });

        foreach ($existing as $row) {
            DB::table('purchase_order_items')
                ->where('id', $row->id)
                ->update([
                    'basic_amount' => $row->basic_amount,
                    'tax_amount'   => $row->tax_amount,
                    'amount'       => $row->amount,
                ]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void {
        $existing = DB::table('purchase_order_items')
            ->select('id', 'basic_amount', 'tax_amount', 'amount')
            ->get();

        Schema::table('purchase_order_items', function (Blueprint $table) {
            $table->dropColumn('amount');
        });

        Schema::table('purchase_order_items', function (Blueprint $table) {
            $table->dropColumn('tax_amount');
        });

        Schema::table('purchase_order_items', function (Blueprint $table) {
            $table->dropColumn('basic_amount');
        });

        Schema::table('purchase_order_items', function (Blueprint $table) {
            $table->double('basic_amount')->storedAs('quantity * rate')->after('rate');
        });

        Schema::table('purchase_order_items', function (Blueprint $table) {
            $table->double('tax_amount')->storedAs('basic_amount * tax_rate / 100')->after('basic_amount');
        });

        Schema::table('purchase_order_items', function (Blueprint $table) {
            $table->double('amount')->storedAs('basic_amount + tax_amount')->after('tax_amount');
        });
    }
};
