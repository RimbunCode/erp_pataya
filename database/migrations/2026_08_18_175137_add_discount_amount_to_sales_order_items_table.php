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
        // Tambah discount_amount SEBELUM konversi basic_amount -- backend selalu
        // menulis discount_amount eksplisit (default 0 untuk baris tanpa diskon).
        Schema::table('sales_order_items', function (Blueprint $table) {
            $table->double('discount_amount')->default(0)->after('basic_amount');
        });

        $existing = DB::table('sales_order_items')
            ->select('id', 'basic_amount')
            ->get();

        // Urutan drop (yang bergantung dulu): amount_base_currency -> tax_amount_base_currency
        // -> basic_amount_base_currency -> amount -> tax_amount -> basic_amount. Tiap drop di
        // Schema::table() terpisah karena SQLite table-rebuild per panggilan akan gagal jika
        // masih ada generated column lain yang mereferensikan kolom yang sedang di-drop.
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
            $table->dropColumn('basic_amount');
        });

        // Selaraskan dengan pola PurchaseOrderItem/SalesInvoiceItem: basic_amount
        // kembali jadi generated KOTOR (quantity * price), diskon disimpan terpisah
        // di discount_amount. tax_amount/amount TETAP kolom biasa (ditulis Service
        // layer dari hasil DocumentDiscountCalculator, sama seperti PurchaseOrderItem).
        Schema::table('sales_order_items', function (Blueprint $table) {
            $table->double('basic_amount')->storedAs('quantity * price')->after('price_base_currency');
        });

        // *_base_currency dihitung dari (basic_amount - discount_amount) -- NET setelah
        // diskon -- bukan basic_amount kotor, supaya konsisten dengan nilai currency asli
        // (tax_amount/amount) yang juga net. Selaras keputusan: base_currency harus
        // reflect diskon yang sama seperti nilai currency dokumen.
        Schema::table('sales_order_items', function (Blueprint $table) {
            $table->double('basic_amount_base_currency')
                ->storedAs('IF(exchange_rate IS NULL, basic_amount - discount_amount, (basic_amount - discount_amount) * exchange_rate)')
                ->after('amount');
        });

        Schema::table('sales_order_items', function (Blueprint $table) {
            $table->double('tax_amount_base_currency')->storedAs('tax_amount * IF(exchange_rate IS NULL, 1, exchange_rate)')->after('basic_amount_base_currency');
        });

        Schema::table('sales_order_items', function (Blueprint $table) {
            $table->double('amount_base_currency')->storedAs('basic_amount_base_currency + tax_amount_base_currency')->after('tax_amount_base_currency');
        });

        // discount_amount untuk baris existing: basic_amount lama (sebelum migration
        // ini) SUDAH net (hasil alokasi diskon PR #185) -- discount_amount =
        // basic_amount_kotor_baru - basic_amount_lama_net, supaya data historis
        // tetap konsisten (Total tidak berubah untuk dokumen lama).
        foreach ($existing as $row) {
            $freshBasicAmount = DB::table('sales_order_items')->where('id', $row->id)->value('basic_amount');
            $discountAmount   = round($freshBasicAmount - $row->basic_amount, 2);
            if ($discountAmount != 0) {
                DB::table('sales_order_items')
                    ->where('id', $row->id)
                    ->update(['discount_amount' => $discountAmount]);
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void {
        $existing = DB::table('sales_order_items')
            ->select('id', 'basic_amount', 'discount_amount')
            ->get();

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
            $table->dropColumn('basic_amount');
        });

        Schema::table('sales_order_items', function (Blueprint $table) {
            $table->double('basic_amount')->default(0)->after('price_base_currency');
        });

        foreach ($existing as $row) {
            DB::table('sales_order_items')
                ->where('id', $row->id)
                ->update(['basic_amount' => $row->basic_amount - $row->discount_amount]);
        }

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

        Schema::table('sales_order_items', function (Blueprint $table) {
            $table->dropColumn('discount_amount');
        });
    }
};
