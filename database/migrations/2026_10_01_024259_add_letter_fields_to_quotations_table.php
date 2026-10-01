<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * `type` disimpan sebagai string biasa (tanpa Enum PHP), mengikuti pola
     * `discount_on` pada SalesOrder. Semua kolom lain nullable: kewajibannya
     * divalidasi di FormRequest karena dokumen draft boleh tersimpan setengah jadi.
     */
    public function up(): void {
        Schema::table('quotations', function (Blueprint $table) {
            $table->string('type')->default('spare_part')->after('opportunity_id');
            $table->string('attn')->nullable()->after('type');
            $table->string('subject')->nullable()->after('attn');
            $table->string('issued_city')->nullable()->after('subject');
            $table->text('introduction')->nullable()->after('issued_city');
            $table->double('basic_amount')->default(0)->after('valid_until');
            $table->double('tax_amount')->default(0)->after('basic_amount');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void {
        Schema::table('quotations', function (Blueprint $table) {
            $table->dropColumn([
                'type',
                'attn',
                'subject',
                'issued_city',
                'introduction',
                'basic_amount',
                'tax_amount',
            ]);
        });
    }
};
