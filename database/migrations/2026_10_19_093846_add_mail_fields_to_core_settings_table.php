<?php

use App\Services\Core\Setting\PreferenceMigrator;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void {
        Schema::table('core_settings', function (Blueprint $table) {
            $table->string('mail_protocol')->nullable();
            $table->string('mail_encryption')->nullable();
            $table->string('mail_host')->nullable();
            $table->unsignedSmallInteger('mail_port')->nullable();
            $table->string('mail_username')->nullable();
            $table->text('mail_password')->nullable();
            $table->string('mail_from_address')->nullable();
            $table->string('mail_from_name')->nullable();
        });

        app(PreferenceMigrator::class)->run();
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void {
        Schema::table('core_settings', function (Blueprint $table) {
            $table->dropColumn(['mail_protocol', 'mail_encryption', 'mail_host', 'mail_port', 'mail_username', 'mail_password', 'mail_from_address', 'mail_from_name']);
        });
    }
};
