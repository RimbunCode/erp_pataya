<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::table('certificate_templates', function (Blueprint $table) {
            $table->longText('front_content')->nullable()->after('placeholders');
            $table->longText('back_content')->nullable()->after('front_content');
            $table->string('signer_name')->nullable()->after('back_content');
            $table->string('signer_title')->nullable()->after('signer_name');
            $table->string('signature_image_path')->nullable()->after('signer_title');
            $table->string('logo_path')->nullable()->after('signature_image_path');
        });

        // gdoc_template_id perlu jadi nullable karena jalur template internal (dompdf)
        // tidak punya Google Doc ID. Pakai raw SQL supaya tidak menambah dependency doctrine/dbal.
        $driver = DB::connection()->getDriverName();

        if ($driver === 'mysql') {
            DB::statement('ALTER TABLE certificate_templates MODIFY gdoc_template_id VARCHAR(255) NULL');
        } elseif ($driver === 'sqlite') {
            // SQLite tidak punya ALTER COLUMN, jadi kolom nullable dibuat via rebuild tabel.
            DB::statement("
                CREATE TABLE certificate_templates_tmp (
                    id varchar not null,
                    name varchar not null,
                    gdoc_template_id varchar null,
                    course_id varchar null,
                    placeholders text null,
                    front_content text null,
                    back_content text null,
                    signer_name varchar null,
                    signer_title varchar null,
                    signature_image_path varchar null,
                    logo_path varchar null,
                    is_active tinyint(1) not null default '1',
                    created_by varchar not null,
                    created_at datetime null,
                    updated_at datetime null,
                    deleted_at datetime null,
                    primary key (id)
                )
            ");
            DB::statement('
                INSERT INTO certificate_templates_tmp
                    (id, name, gdoc_template_id, course_id, placeholders, front_content, back_content, signer_name, signer_title, signature_image_path, logo_path, is_active, created_by, created_at, updated_at, deleted_at)
                SELECT
                    id, name, gdoc_template_id, course_id, placeholders, front_content, back_content, signer_name, signer_title, signature_image_path, logo_path, is_active, created_by, created_at, updated_at, deleted_at
                FROM certificate_templates
            ');
            DB::statement('DROP TABLE certificate_templates');
            DB::statement('ALTER TABLE certificate_templates_tmp RENAME TO certificate_templates');
        } else {
            DB::statement('ALTER TABLE certificate_templates ALTER COLUMN gdoc_template_id DROP NOT NULL');
        }
    }

    public function down(): void {
        Schema::table('certificate_templates', function (Blueprint $table) {
            $table->dropColumn([
                'front_content',
                'back_content',
                'signer_name',
                'signer_title',
                'signature_image_path',
                'logo_path',
            ]);
        });

        if (DB::connection()->getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE certificate_templates MODIFY gdoc_template_id VARCHAR(255) NOT NULL DEFAULT ''");
        }
    }
};
