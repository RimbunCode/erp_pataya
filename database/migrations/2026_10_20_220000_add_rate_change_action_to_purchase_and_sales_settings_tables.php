<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void {
        Schema::table('purchase_settings', function (Blueprint $table) {
            $table->string('rate_change_action')->default('none');
        });

        Schema::table('sales_settings', function (Blueprint $table) {
            $table->string('rate_change_action')->default('none');
        });
    }

    public function down(): void {
        Schema::table('purchase_settings', function (Blueprint $table) {
            $table->dropColumn('rate_change_action');
        });

        Schema::table('sales_settings', function (Blueprint $table) {
            $table->dropColumn('rate_change_action');
        });
    }
};
