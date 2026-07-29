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
        Schema::table('permissions', function (Blueprint $table) {
            $table->boolean('ignore_permission')->default(false)->after('allow_only_creator');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void {
        Schema::table('permissions', function (Blueprint $table) {
            $table->dropColumn('ignore_permission');
        });
    }
};
