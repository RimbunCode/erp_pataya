<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * SQLite alter table via rename-copy gagal bila ada VIEW yang mereferensikan
     * tabel tersebut (`assignables`, dibuat migration create_assignables_view).
     * Drop dulu, recreate setelah alter — hanya perlu di SQLite (MySQL ALTER
     * TABLE tidak melalui rename, tidak terpengaruh).
     */
    public function up(): void {
        $isSqlite = DB::getDriverName() === 'sqlite';

        if ($isSqlite) {
            DB::statement('DROP VIEW IF EXISTS assignables');
        }

        Schema::table('users', function (Blueprint $table) {
            $table->foreignUlid('default_desk_id')->nullable()->after('id')->references('id')->on('desks')->nullOnDelete();
        });

        if ($isSqlite) {
            DB::statement("
                CREATE VIEW assignables AS
                SELECT id, 'user' AS type, name, deleted_at FROM users
                UNION ALL
                SELECT id, 'role' AS type, name, deleted_at FROM roles
            ");
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void {
        $isSqlite = DB::getDriverName() === 'sqlite';

        if ($isSqlite) {
            DB::statement('DROP VIEW IF EXISTS assignables');
        }

        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['default_desk_id']);
            $table->dropColumn('default_desk_id');
        });

        if ($isSqlite) {
            DB::statement("
                CREATE VIEW assignables AS
                SELECT id, 'user' AS type, name, deleted_at FROM users
                UNION ALL
                SELECT id, 'role' AS type, name, deleted_at FROM roles
            ");
        }
    }
};
