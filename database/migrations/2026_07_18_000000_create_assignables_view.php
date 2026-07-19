<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void {
        DB::statement("
            CREATE VIEW assignables AS
            SELECT id, 'user' AS type, name FROM users WHERE deleted_at IS NULL
            UNION ALL
            SELECT id, 'role' AS type, name FROM roles WHERE deleted_at IS NULL
        ");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void {
        DB::statement('DROP VIEW IF EXISTS assignables');
    }
};
