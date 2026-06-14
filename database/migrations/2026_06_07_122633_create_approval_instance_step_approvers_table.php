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
        Schema::create('approval_instance_step_approvers', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->ulid('approval_instance_step_id');
            $table->foreign('approval_instance_step_id', 'inst_step_approvers_step_id_fk')->references('id')->on('approval_instance_steps')->cascadeOnDelete();
            $table->string('approver_type');
            $table->ulidMorphs('approverable', 'instance_step_approver_approverable_index');
            $table->string('status')->default('pending');
            $table->foreignUlid('acted_by_id')->nullable()->references('id')->on('users')->nullOnDelete();
            $table->timestamp('acted_at')->nullable();
            $table->json('config')->nullable();
            $table->softDeletes();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void {
        Schema::dropIfExists('approval_instance_step_approvers');
    }
};
