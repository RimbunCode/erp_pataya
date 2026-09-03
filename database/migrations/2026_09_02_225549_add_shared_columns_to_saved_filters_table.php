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
        Schema::table('saved_filters', function (Blueprint $table) {
            $table->boolean('is_shared')->default(false)->after('is_saved');
            $table->boolean('is_default')->default(false)->after('is_shared');
            $table->string('sort')->nullable()->after('filter');
            // Prasyarat HasExampleData (dibawa trait App\Traits\DataTable).
            $table->boolean('is_example')->default(false)->after('sort');

            $table->index(['model', 'is_shared']);
            $table->index(['model', 'is_default']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void {
        Schema::table('saved_filters', function (Blueprint $table) {
            $table->dropIndex(['model', 'is_shared']);
            $table->dropIndex(['model', 'is_default']);
            $table->dropColumn(['is_shared', 'is_default', 'sort', 'is_example']);
        });
    }
};
