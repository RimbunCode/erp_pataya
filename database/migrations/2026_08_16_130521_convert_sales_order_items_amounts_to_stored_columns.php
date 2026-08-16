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
        $existing = DB::table('sales_order_items')
            ->select('id', 'basic_amount', 'tax_amount', 'amount')
            ->get();

        // Urutan drop (yang bergantung dulu): amount_base_currency -> tax_amount_base_currency
        // -> basic_amount_base_currency (ketiganya mereferensikan basic_amount/tax_amount/amount)
        // -> amount -> tax_amount -> basic_amount. Tiap drop di Schema::table() terpisah karena
        // SQLite table-rebuild per panggilan akan gagal jika masih ada generated column lain
        // yang mereferensikan kolom yang sedang di-drop.
        Schema::table('sales_order_items', function (Blueprint $table) {
            $table->dropColumn('amount_base_currency');
        });

        Schema::table('sales_order_items', function (Blueprint $table) {
            $table->dropColumn('tax_amount_base_currency');
        });

        Schema::table('sales_order_items', function (Blueprint $table) {
            $table->dropColumn('basic_amount_base_currency');
        });

        Schema::table('sales_order_items', function (Blueprint $table) {
            $table->dropColumn('amount');
        });

        Schema::table('sales_order_items', function (Blueprint $table) {
            $table->dropColumn('tax_amount');
        });

        Schema::table('sales_order_items', function (Blueprint $table) {
            $table->dropColumn('basic_amount');
        });

        Schema::table('sales_order_items', function (Blueprint $table) {
            $table->double('basic_amount')->default(0)->after('price_base_currency');
        });

        Schema::table('sales_order_items', function (Blueprint $table) {
            $table->double('tax_amount')->default(0)->after('basic_amount');
        });

        Schema::table('sales_order_items', function (Blueprint $table) {
            $table->double('amount')->default(0)->after('tax_amount');
        });

        Schema::table('sales_order_items', function (Blueprint $table) {
            $table->double('basic_amount_base_currency')
                ->storedAs('IF(exchange_rate IS NULL, basic_amount, basic_amount * exchange_rate)')
                ->after('amount');
        });

        Schema::table('sales_order_items', function (Blueprint $table) {
            $table->double('tax_amount_base_currency')->storedAs('basic_amount_base_currency * tax_rate / 100')->after('basic_amount_base_currency');
        });

        Schema::table('sales_order_items', function (Blueprint $table) {
            $table->double('amount_base_currency')->storedAs('basic_amount_base_currency + tax_amount_base_currency')->after('tax_amount_base_currency');
        });

        foreach ($existing as $row) {
            DB::table('sales_order_items')
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
        Schema::table('sales_order_items', function (Blueprint $table) {
            $table->dropColumn('amount_base_currency');
        });

        Schema::table('sales_order_items', function (Blueprint $table) {
            $table->dropColumn('tax_amount_base_currency');
        });

        Schema::table('sales_order_items', function (Blueprint $table) {
            $table->dropColumn('basic_amount_base_currency');
        });

        Schema::table('sales_order_items', function (Blueprint $table) {
            $table->dropColumn('amount');
        });

        Schema::table('sales_order_items', function (Blueprint $table) {
            $table->dropColumn('tax_amount');
        });

        Schema::table('sales_order_items', function (Blueprint $table) {
            $table->dropColumn('basic_amount');
        });

        Schema::table('sales_order_items', function (Blueprint $table) {
            $table->double('basic_amount')->storedAs('quantity * price')->after('price_base_currency');
        });

        Schema::table('sales_order_items', function (Blueprint $table) {
            $table->double('tax_amount')->storedAs('basic_amount * tax_rate / 100')->after('basic_amount');
        });

        Schema::table('sales_order_items', function (Blueprint $table) {
            $table->double('amount')->storedAs('basic_amount + tax_amount')->after('tax_amount');
        });

        Schema::table('sales_order_items', function (Blueprint $table) {
            $table->double('basic_amount_base_currency')
                ->storedAs('IF(exchange_rate IS NULL, basic_amount, basic_amount * exchange_rate)')
                ->after('amount');
        });

        Schema::table('sales_order_items', function (Blueprint $table) {
            $table->double('tax_amount_base_currency')->storedAs('basic_amount_base_currency * tax_rate / 100')->after('basic_amount_base_currency');
        });

        Schema::table('sales_order_items', function (Blueprint $table) {
            $table->double('amount_base_currency')->storedAs('basic_amount_base_currency + tax_amount_base_currency')->after('tax_amount_base_currency');
        });
    }
};
