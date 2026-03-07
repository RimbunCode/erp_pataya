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
    Schema::create('dashboard_widgets', function (Blueprint $table) {
      $table->ulid('id')->primary();
      $table->string('width');
      $table->foreignUlid('dashboard_id')->references('id')->on('dashboards')->cascadeOnDelete();
      $table->foreignUlid('widget_id')->nullable()->references('id')->on('widgets')->cascadeOnDelete();
      $table->foreignUlid('parent_id')->nullable()->references('id')->on('dashboard_widgets')->cascadeOnDelete();
      $table->string('type')->nullable(); //untuk Nested Layout Wannabe
      $table->json('config')->nullable();
      $table->tinyInteger('order')->default(0);
      $table->boolean('is_visible')->default(true);
      $table->softDeletes();
      $table->timestamps();
    });
  }

  /**
   * Reverse the migrations.
   */
  public function down(): void {
    Schema::dropIfExists('dashboard_widgets');
  }
};
