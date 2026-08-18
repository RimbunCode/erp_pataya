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
        Schema::table('general_ledgers', function (Blueprint $table) {
            $table->dateTime('transaction_date')->nullable()->after('credit');
        });

        DB::table('general_ledgers')
            ->whereNull('transaction_date')
            ->update(['transaction_date' => DB::raw('created_at')]);

        Schema::table('general_ledgers', function (Blueprint $table) {
            $table->dateTime('transaction_date')->nullable(false)->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void {
        Schema::table('general_ledgers', function (Blueprint $table) {
            $table->dropColumn('transaction_date');
        });
    }
};
