<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('stock_ledger_entries', function (Blueprint $table) {
            $table->boolean('is_valuated')->default(false)->after('change_in_stock_value');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('stock_ledger_entries', function (Blueprint $table) {
            $table->dropColumn('is_valuated');
        });
    }
};
