<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void {
        Schema::table('asset_category_accounts', function (Blueprint $table) {
            $table->foreignUlid('gain_loss_disposal_account_id')->nullable()
                ->references('id')->on('accounts')->nullOnDelete();
        });
    }

    public function down(): void {
        Schema::table('asset_category_accounts', function (Blueprint $table) {
            $table->dropForeign(['gain_loss_disposal_account_id']);
            $table->dropColumn('gain_loss_disposal_account_id');
        });
    }
};
