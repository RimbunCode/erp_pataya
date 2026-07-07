<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::table('courses', function (Blueprint $table) {
            $table->string('graduation_scheme')->default('attendance')->after('certificate_type');
            $table->unsignedTinyInteger('min_passing_score')->default(61)->after('graduation_scheme');
        });
    }

    public function down(): void {
        Schema::table('courses', function (Blueprint $table) {
            $table->dropColumn(['graduation_scheme', 'min_passing_score']);
        });
    }
};
