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
        Schema::table('fileables', function (Blueprint $table) {
            $table->boolean('is_generated_pdf')->default(false)->after('fileable_type');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void {
        Schema::table('fileables', function (Blueprint $table) {
            $table->dropColumn('is_generated_pdf');
        });
    }
};
