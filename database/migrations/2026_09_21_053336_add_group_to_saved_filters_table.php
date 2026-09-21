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
        Schema::table('saved_filters', function (Blueprint $table) {
            // Bentuk: {"column": string, "granularity": string|null, "range": number|null}.
            // null = saved filter tidak mengatur group (jangan override group
            // aktif saat diterapkan -- preseden sama dengan `sort`).
            $table->json('group')->nullable()->after('sort');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void {
        Schema::table('saved_filters', function (Blueprint $table) {
            $table->dropColumn('group');
        });
    }
};
