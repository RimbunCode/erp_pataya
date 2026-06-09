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
        Schema::create('approval_scheme_steps', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->tinyInteger('sequence');
            $table->foreignUlid('approval_scheme_id')->references('id')->on('approval_schemes')->cascadeOnDelete();
            $table->string('approver_type');
            $table->ulidMorphs('approverable', 'approverable_index');
            $table->json('config')->nullable();
            $table->boolean('is_advanced')->default(false);
            $table->softDeletes();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void {
        Schema::dropIfExists('approval_scheme_steps');
    }
};
