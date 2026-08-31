<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void {
        Schema::table('dashboard_widgets', function (Blueprint $table) {
            $table->dropColumn('width');
        });

        Schema::table('dashboard_widgets', function (Blueprint $table) {
            $table->renameColumn('col_span', 'width');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void {
        Schema::table('dashboard_widgets', function (Blueprint $table) {
            $table->renameColumn('width', 'col_span');
        });

        Schema::table('dashboard_widgets', function (Blueprint $table) {
            $table->string('width')->default('full');
        });
    }
};
