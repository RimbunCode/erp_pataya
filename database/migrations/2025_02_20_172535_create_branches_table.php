<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('branches', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('code')->nullable();
            $table->string('name');
            $table->nullableUlidMorphs('branchable');
            $table->boolean('is_main_branch')->default(false);
            $table->boolean('is_disabled')->default(false);
            $table->text('shipping_street')->nullable();
            $table->text('shipping_city')->nullable();
            $table->text('shipping_state')->nullable();
            $table->text('shipping_zip_code')->nullable();
            $table->text('shipping_country_id')->nullable();
            $table->enum('billing_address', ['same_main', 'same_shipping', 'separate'])->nullable();
            $table->text('billing_street')->nullable();
            $table->text('billing_city')->nullable();
            $table->text('billing_state')->nullable();
            $table->text('billing_zip_code')->nullable();
            $table->text('billing_country_id')->nullable();
            $table->timestamps();
            $table->softDeletes();
            $table->unique(['name', 'branchable_id', 'deleted_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('branches');
    }
};
