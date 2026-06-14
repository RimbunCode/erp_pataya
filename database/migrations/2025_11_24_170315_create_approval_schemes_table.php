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
        Schema::create('approval_schemes', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('name');
            $table->foreignUlid('permission_id')->references('id')->on('permissions')->cascadeOnDelete();
            $table->string('name_model');
            $table->string('model');
            $table->boolean('is_active')->default(false);
            $table->string('trigger_on')->default('submit');
            $table->json('config')->nullable();
            $table->softDeletes();
            $table->timestamps();
            $table->unique(['name', 'deleted_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void {
        Schema::dropIfExists('approval_schemes');
    }
};
