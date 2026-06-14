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
        Schema::create('approval_scheme_step_approvers', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('approval_scheme_step_id')->references('id')->on('approval_scheme_steps')->cascadeOnDelete();
            $table->string('approver_type');
            $table->ulidMorphs('approverable', 'scheme_step_approver_approverable_index');
            $table->json('config')->nullable();
            $table->softDeletes();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void {
        Schema::dropIfExists('approval_scheme_step_approvers');
    }
};
