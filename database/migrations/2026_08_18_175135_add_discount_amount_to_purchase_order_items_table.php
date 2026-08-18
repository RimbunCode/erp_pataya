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
        // menulis discount_amount eksplisit (default 0 untuk baris tanpa diskon),
        // jadi urutan tambah kolom tidak masalah untuk data existing.
        Schema::table('purchase_order_items', function (Blueprint $table) {
            $table->double('discount_amount')->default(0)->after('basic_amount');
        });

        // Selaraskan dengan pola PurchaseInvoiceItem (lihat migration
        // add_discount_amount_to_purchase_invoice_items_table): basic_amount
        // kembali jadi generated KOTOR (quantity * rate), diskon dokumen disimpan
        // terpisah di discount_amount -- bukan menimpa basic_amount seperti sejak
        // migration convert_purchase_order_items_amounts_to_stored_columns
        // (spec dpp-discount-and-tax-compliance). tax_amount/amount TETAP kolom
        // biasa (bukan generated) -- beda dari PurchaseInvoiceItem yang punya
        // dpp_amount sebagai basis pajak; PurchaseOrderItem tidak punya kolom
        // perantara semacam itu, tax_amount hasil alokasi proporsional
        // DocumentDiscountCalculator tetap ditulis Service layer.
        $existing = DB::table('purchase_order_items')
            ->select('id', 'basic_amount')
            ->get();

        Schema::table('purchase_order_items', function (Blueprint $table) {
            $table->dropColumn('basic_amount');
        });

        Schema::table('purchase_order_items', function (Blueprint $table) {
            $table->double('basic_amount')->storedAs('quantity * rate')->after('rate');
        });

        // discount_amount untuk baris existing: basic_amount lama (sebelum
        // migration ini) SUDAH net (hasil alokasi diskon PR #185) -- jadi
        // discount_amount = basic_amount_kotor_baru - basic_amount_lama_net,
        // supaya data historis tetap konsisten (Total tidak berubah untuk
        // dokumen lama).
        foreach ($existing as $row) {
            $freshBasicAmount = DB::table('purchase_order_items')->where('id', $row->id)->value('basic_amount');
            $discountAmount   = round($freshBasicAmount - $row->basic_amount, 2);
            if ($discountAmount != 0) {
                DB::table('purchase_order_items')
                    ->where('id', $row->id)
                    ->update(['discount_amount' => $discountAmount]);
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void {
        $existing = DB::table('purchase_order_items')
            ->select('id', 'basic_amount', 'discount_amount')
            ->get();

        Schema::table('purchase_order_items', function (Blueprint $table) {
            $table->dropColumn('basic_amount');
        });

        Schema::table('purchase_order_items', function (Blueprint $table) {
            $table->double('basic_amount')->default(0)->after('rate');
        });

        foreach ($existing as $row) {
            DB::table('purchase_order_items')
                ->where('id', $row->id)
                ->update(['basic_amount' => $row->basic_amount - $row->discount_amount]);
        }

        Schema::table('purchase_order_items', function (Blueprint $table) {
            $table->dropColumn('discount_amount');
        });
    }
};
