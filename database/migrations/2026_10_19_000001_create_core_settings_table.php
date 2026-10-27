<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void {
        Schema::create('core_settings', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->boolean('singleton')->default(true)->unique();
            $table->string('company_name')->nullable();
            $table->string('short_name')->nullable();
            $table->string('email')->nullable();
            $table->string('phone')->nullable();
            $table->text('street')->nullable();
            $table->string('city')->nullable();
            $table->string('state')->nullable();
            $table->string('zip_code')->nullable();
            $table->string('country_id', 2)->nullable();
            $table->foreign('country_id')->references('code')->on('countries')->nullOnDelete();
            $table->string('bank_name')->nullable();
            $table->string('bank_account_name')->nullable();
            $table->string('bank_account_number')->nullable();
            $table->string('default_currency_id', 10)->nullable();
            $table->foreign('default_currency_id')->references('code')->on('currencies')->restrictOnDelete();
            $table->string('default_number_format')->default('#.###,##');
            $table->string('timezone')->default('Asia/Jakarta');
            $table->unsignedInteger('num_per_page')->default(25);
            $table->json('per_page_options')->nullable();
            $table->foreignUlid('company_image_id')->nullable()->constrained('files')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void {
        Schema::dropIfExists('core_settings');
    }
};
