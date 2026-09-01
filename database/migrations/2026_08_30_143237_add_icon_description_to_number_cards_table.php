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
        Schema::table('number_cards', function (Blueprint $table) {
            $table->string('icon')->nullable()->after('label');
            $table->json('description')->nullable()->after('icon');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void {
        Schema::table('number_cards', function (Blueprint $table) {
            $table->dropColumn(['icon', 'description']);
        });
    }
};
