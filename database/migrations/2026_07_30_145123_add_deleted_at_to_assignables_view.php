<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Buang filter deleted_at dari view agar assignee yang sudah di-soft-delete
     * tetap bisa di-lookup by-id (riwayat, mis. Ticket/Todo show page). Kolom
     * deleted_at ikut disertakan agar pemanggil (scopeLinkModel) bisa menyaring
     * sendiri untuk kebutuhan dropdown/picker.
     */
    public function up(): void {
        DB::statement('DROP VIEW IF EXISTS assignables');
        DB::statement("
            CREATE VIEW assignables AS
            SELECT id, 'user' AS type, name, deleted_at FROM users
            UNION ALL
            SELECT id, 'role' AS type, name, deleted_at FROM roles
        ");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void {
        DB::statement('DROP VIEW IF EXISTS assignables');
        DB::statement("
            CREATE VIEW assignables AS
            SELECT id, 'user' AS type, name FROM users WHERE deleted_at IS NULL
            UNION ALL
            SELECT id, 'role' AS type, name FROM roles WHERE deleted_at IS NULL
        ");
    }
};
