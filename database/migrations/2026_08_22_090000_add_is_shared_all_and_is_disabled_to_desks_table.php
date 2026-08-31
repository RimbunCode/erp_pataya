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
        Schema::table('desks', function (Blueprint $table) {
            $table->boolean('is_shared_all')->default(false)->after('is_personal_only');
            $table->boolean('is_disabled')->default(false)->after('is_shared_all');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void {
        Schema::table('desks', function (Blueprint $table) {
            $table->dropColumn(['is_shared_all', 'is_disabled']);
        });
    }
};
