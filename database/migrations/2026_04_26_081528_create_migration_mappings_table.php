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
        Schema::create('migration_mappings', function (Blueprint $table) {
            $table->id();
            $table->string('table_name');
            $table->string('old_id');
            $table->char('new_ulid', 26);
            $table->timestamps();

            $table->unique(['table_name', 'old_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void {
        Schema::dropIfExists('migration_mappings');
    }
};
