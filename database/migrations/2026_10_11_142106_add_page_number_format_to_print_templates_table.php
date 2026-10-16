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
        Schema::table('print_templates', function (Blueprint $table) {
            $table->string('page_number_format')->nullable()->after('page_number');
        });

        DB::table('print_templates')
            ->whereNotNull('page_number')
            ->whereNull('page_number_format')
            ->update(['page_number_format' => ':page / :total']);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void {
        Schema::table('print_templates', function (Blueprint $table) {
            $table->dropColumn('page_number_format');
        });
    }
};
