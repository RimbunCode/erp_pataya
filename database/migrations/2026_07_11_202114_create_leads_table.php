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
        Schema::create('leads', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('company_name');
            $table->string('contact_name')->nullable();
            $table->string('email')->nullable();
            $table->string('phone')->nullable();
            $table->foreignUlid('lead_source_id')->nullable()->references('code')->on('lead_sources')->nullOnDelete();
            $table->string('status')->default('new');
            $table->text('notes')->nullable();
            $table->foreignUlid('assigned_to_id')->nullable()->references('id')->on('users')->nullOnDelete();
            $table->string('street')->nullable();
            $table->string('city')->nullable();
            $table->string('province')->nullable();
            $table->string('zip_code')->nullable();
            $table->foreignUlid('country_id')->nullable()->references('code')->on('countries')->nullOnDelete();
            $table->foreignUlid('converted_customer_id')->nullable()->references('id')->on('customers')->nullOnDelete();
            $table->timestamp('converted_at')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void {
        Schema::dropIfExists('leads');
    }
};
