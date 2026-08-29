<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void {
        Schema::dropIfExists('widgets');
    }

    /**
     * Rollback merekonstruksi skema tabel `widgets` (bukan data — data lama
     * sudah dikonfirmasi bebas drop, lihat design.md Overview) supaya
     * migration 2026_08_29_100300 (alter dashboard_widgets) yang rollback
     * SETELAHNYA punya tabel `widgets` untuk FK `widget_id`.
     */
    public function down(): void {
        Schema::create('widgets', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('title');
            $table->string('type');
            $table->string('calculation_type')->nullable();
            $table->string('time_based_on')->nullable();
            $table->string('time_interval')->nullable();
            $table->string('timespan')->nullable();
            $table->string('value_based_on')->nullable();
            $table->string('group_by_type')->nullable();
            $table->string('group_by_base_on')->nullable();
            $table->string('aggregate_function_based_on')->nullable();
            $table->json('filters')->nullable();
            $table->json('config')->nullable();
            $table->text('description')->nullable();
            $table->foreignUlid('created_by_id')->nullable()->references('id')->on('users')->nullOnDelete();
            $table->foreignUlid('model_id')->nullable()->references('id')->on('permissions')->nullOnDelete();
            $table->string('model_class')->nullable();
            $table->boolean('is_example')->default(false);
            $table->index('is_example');
            $table->boolean('have_transactions')->default(false);
            $table->softDeletes();
            $table->timestamps();
        });
    }
};
