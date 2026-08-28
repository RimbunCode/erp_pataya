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
        Schema::table('dashboard_widgets', function (Blueprint $table) {
            $table->unsignedTinyInteger('col_span')->default(12)->after('width');
        });

        DB::table('dashboard_widgets')->where('width', 'half')->update(['col_span' => 6]);
        DB::table('dashboard_widgets')->where('width', 'full')->update(['col_span' => 12]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void {
        Schema::table('dashboard_widgets', function (Blueprint $table) {
            $table->dropColumn('col_span');
        });
    }
};
