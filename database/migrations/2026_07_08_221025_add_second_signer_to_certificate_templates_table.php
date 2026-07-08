<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::table('certificate_templates', function (Blueprint $table) {
            $table->string('signer_name_2')->nullable()->after('signer_title');
            $table->string('signer_title_2')->nullable()->after('signer_name_2');
            $table->string('signature_image_path_2')->nullable()->after('signer_title_2');
        });
    }

    public function down(): void {
        Schema::table('certificate_templates', function (Blueprint $table) {
            $table->dropColumn(['signer_name_2', 'signer_title_2', 'signature_image_path_2']);
        });
    }
};
