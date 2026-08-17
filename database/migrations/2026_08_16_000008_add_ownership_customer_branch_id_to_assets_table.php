<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void {
        Schema::table('assets', function (Blueprint $table) {
            $table->foreignUlid('ownership_customer_branch_id')->nullable()->after('ownership_customer_id')
                ->references('id')->on('branches')->nullOnDelete();
        });
    }

    public function down(): void {
        Schema::table('assets', function (Blueprint $table) {
            $table->dropForeign(['ownership_customer_branch_id']);
            $table->dropColumn('ownership_customer_branch_id');
        });
    }
};
