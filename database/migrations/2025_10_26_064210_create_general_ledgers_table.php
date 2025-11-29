<?php
use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
  use DataTable, HasUlids, SoftDeletes;

  /**
   * Run the migrations.
   */
  public function up(): void {
    Schema::create('general_ledgers', function (Blueprint $table) {
      $table->ulid('id')->primary();
      $table->ulidMorphs('referenceable', 'referenceable_index');
      $table->foreignUlid('account_id')->references('id')->on('accounts')->cascadeOnDelete();
      $table->foreignUlid('against_account_id')->references('id')->on('accounts')->cascadeOnDelete();
      $table->foreignUlid('branch_id')->nullable()->references('id')->on('branches')->nullOnDelete();
      $table->nullableUlidMorphs('partyable', 'partyable_index');
      $table->double('debit')->default(0);
      $table->double('credit')->default(0);
      $table->text('description')->nullable();
      $table->timestamps();
      $table->softDeletes();
    });
  }

  /**
   * Reverse the migrations.
   */
  public function down(): void {
    Schema::dropIfExists('general_ledgers');
  }
};
