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
    Schema::create('approval_instance_steps', function (Blueprint $table) {
      $table->ulid('id')->primary();
      $table->tinyInteger('sequence');
      $table->foreignUlid('approval_instance_id')->references('id')->on('approval_instances')->cascadeOnDelete();
      $table->string('approver_type');
      $table->ulidMorphs('approverable', 'instance_step_approverable_index');
      $table->json('config')->nullable();
      $table->boolean('is_advanced')->default(false);
      $table->string('status')->default('waiting');
      $table->foreignUlid('acted_by_id')->nullable()->references('id')->on('users')->nullOnDelete();
      $table->timestamp('acted_at')->nullable();
      $table->text('notes')->nullable();
      $table->softDeletes();
      $table->timestamps();
    });
  }

  /**
   * Reverse the migrations.
   */
  public function down(): void {
    Schema::dropIfExists('approval_instance_steps');
  }
};
