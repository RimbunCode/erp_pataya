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
        Schema::create('migration_checkpoints', function (Blueprint $table) {
            $table->string('migrator');
            $table->string('checkpoint_key');
            $table->string('last_processed_key');
            $table->unique(['migrator', 'checkpoint_key']);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void {
        Schema::dropIfExists('migration_checkpoints');
    }
};
