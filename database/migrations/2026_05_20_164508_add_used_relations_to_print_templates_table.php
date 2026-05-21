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
        Schema::table('print_templates', function (Blueprint $table) {
            $table->json('used_relations')->nullable()->after('template');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void {
        Schema::table('print_templates', function (Blueprint $table) {
            $table->dropColumn('used_relations');
        });
    }
};
