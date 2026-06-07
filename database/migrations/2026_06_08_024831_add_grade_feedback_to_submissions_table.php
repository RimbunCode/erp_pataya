<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('submissions', function (Blueprint $table) {
            $table->unsignedTinyInteger('grade')->nullable()->after('status');
            $table->text('feedback')->nullable()->after('grade');
            $table->timestamp('graded_at')->nullable()->after('feedback');
        });
    }

    public function down(): void
    {
        Schema::table('submissions', function (Blueprint $table) {
            $table->dropColumn(['grade', 'feedback', 'graded_at']);
        });
    }
};
