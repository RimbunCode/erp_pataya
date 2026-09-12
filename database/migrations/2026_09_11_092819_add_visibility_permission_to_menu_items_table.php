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
        Schema::table('menu_items', function (Blueprint $table) {
            // Node tree format PermissionChecker::satisfies() (any/all lintas
            // model). NULL -> fallback ke kolom `model` + Permission::Select
            // (behavior lama, lihat ResolveActiveDesk::buildMenuItem()).
            // Diisi -> MENIMPA sepenuhnya (kolom `model` tidak lagi dicek).
            $table->json('visibility_permission')->nullable()->after('model');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void {
        Schema::table('menu_items', function (Blueprint $table) {
            $table->dropColumn('visibility_permission');
        });
    }
};
