<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void {
        Schema::table('purchase_settings', function (Blueprint $table): void {
            $table->foreignUlid('default_payment_term_template_id')
                ->nullable()
                ->constrained('payment_term_templates')
                ->nullOnDelete();
        });

        Schema::table('sales_settings', function (Blueprint $table): void {
            $table->foreignUlid('default_payment_term_template_id')
                ->nullable()
                ->constrained('payment_term_templates')
                ->nullOnDelete();
        });
    }

    public function down(): void {
        Schema::table('sales_settings', function (Blueprint $table): void {
            $table->dropForeign(['default_payment_term_template_id']);
            $table->dropColumn('default_payment_term_template_id');
        });

        Schema::table('purchase_settings', function (Blueprint $table): void {
            $table->dropForeign(['default_payment_term_template_id']);
            $table->dropColumn('default_payment_term_template_id');
        });
    }
};
