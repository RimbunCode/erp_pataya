<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void {
        Schema::table('assets', function (Blueprint $table) {
            $table->decimal('rental_quantity', 15, 4)->default(0);
            $table->decimal('sold_quantity', 15, 4)->default(0);
        });
    }

    public function down(): void {
        Schema::table('assets', function (Blueprint $table) {
            $table->dropColumn(['rental_quantity', 'sold_quantity']);
        });
    }
};
