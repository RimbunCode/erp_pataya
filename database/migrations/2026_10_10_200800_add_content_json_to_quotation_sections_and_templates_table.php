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
        Schema::table('quotation_sections', function (Blueprint $table) {
            $table->json('content_json')->nullable()->after('content');
        });

        Schema::table('quotation_section_templates', function (Blueprint $table) {
            $table->json('content_json')->nullable()->after('content');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void {
        Schema::table('quotation_sections', function (Blueprint $table) {
            $table->dropColumn('content_json');
        });

        Schema::table('quotation_section_templates', function (Blueprint $table) {
            $table->dropColumn('content_json');
        });
    }
};
