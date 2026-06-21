<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('users', 'inactive_reason')) {
            return;
        }

        Schema::table('users', function (Blueprint $table) {
            $table->text('inactive_reason')->nullable()->after('status');
            $table->foreignUlid('inactive_by')->nullable()->references('id')->on('users')->nullOnDelete()->after('inactive_reason');
            $table->timestamp('inactive_at')->nullable()->after('inactive_by');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['inactive_by']);
            $table->dropColumn(['inactive_reason', 'inactive_by', 'inactive_at']);
        });
    }
};
