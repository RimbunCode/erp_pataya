<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void {
        Schema::create('assets', function (Blueprint $table) {
            $table->ulid('id')->primary();

            // Identitas
            $table->string('asset_name');
            $table->string('code')->unique();
            $table->foreignUlid('asset_category_id')->references('id')->on('asset_categories')->restrictOnDelete();
            $table->foreignUlid('asset_location_id')->references('id')->on('asset_locations')->restrictOnDelete();
            $table->string('asset_type')->default('existing_asset');
            $table->foreignUlid('item_id')->nullable()->references('id')->on('items')->nullOnDelete();
            $table->integer('asset_quantity')->default(1);

            // Ownership
            $table->string('ownership_type')->default('company');
            $table->ulid('ownership_company_id')->nullable();
            $table->ulid('ownership_supplier_id')->nullable();
            $table->ulid('ownership_customer_id')->nullable();

            // Lokasi & Penanggung Jawab
            $table->foreignUlid('custodian_id')->nullable()->references('id')->on('users')->nullOnDelete();

            // Pembelian & Nilai
            $table->date('purchase_date')->nullable();
            $table->date('available_for_use_date')->nullable();
            $table->date('disposal_date')->nullable();
            $table->foreignUlid('purchase_receipt_id')->nullable()->references('id')->on('purchase_receipts')->nullOnDelete();
            $table->foreignUlid('purchase_invoice_id')->nullable()->references('id')->on('purchase_invoices')->nullOnDelete();
            $table->decimal('net_purchase_amount', 15, 2)->default(0);
            $table->decimal('gross_purchase_amount', 15, 2)->default(0);
            $table->decimal('additional_asset_cost', 15, 2)->default(0);

            // Depresiasi (flat, single-book)
            $table->boolean('calculate_depreciation')->default(false);
            $table->boolean('is_depreciable')->nullable()->default(false);
            $table->decimal('opening_accumulated_depreciation', 15, 2)->default(0);
            $table->integer('opening_number_of_booked_depreciations')->default(0);
            $table->string('depreciation_method')->nullable();
            $table->integer('frequency_of_depreciation')->nullable();
            $table->integer('total_number_of_depreciations')->nullable();
            $table->integer('total_number_of_booked_depreciations')->nullable();
            $table->date('next_depreciation_date')->nullable();
            $table->decimal('expected_value_after_useful_life', 15, 2)->default(0);
            $table->decimal('salvage_value_percentage', 5, 2)->nullable();
            $table->decimal('rate_of_depreciation', 5, 2)->nullable();
            $table->boolean('daily_prorata_based')->default(false);
            $table->integer('increase_in_asset_life')->nullable();

            // Asuransi
            $table->string('insurance_policy_number')->nullable();
            $table->string('insurance_insurer')->nullable();
            $table->decimal('insurance_insured_value', 15, 2)->nullable();
            $table->date('insurance_start_date')->nullable();
            $table->date('insurance_end_date')->nullable();
            $table->boolean('insurance_comprehensive')->nullable();

            // Status & Lifecycle (Submitable)
            $table->json('status')->nullable();
            $table->boolean('maintenance_required')->default(false);
            $table->foreignUlid('journal_entry_for_scrap_id')->nullable()->references('id')->on('general_ledgers')->nullOnDelete();

            // Submitable fields
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('canceled_at')->nullable();
            $table->foreignUlid('amended_from_id')->nullable()->references('id')->on('assets')->nullOnDelete();
            $table->integer('revision_number')->default(0);
            $table->foreignUlid('created_by_id')->nullable()->references('id')->on('users')->nullOnDelete();
            $table->json('additional_data')->nullable();
            $table->boolean('is_example')->default(false);
            $table->index('is_example');

            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void {
        Schema::dropIfExists('assets');
    }
};
