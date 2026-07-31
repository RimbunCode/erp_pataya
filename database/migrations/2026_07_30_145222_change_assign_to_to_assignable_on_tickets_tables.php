<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * assign_to_id sekarang menunjuk ke view `assignables` (User atau Role), jadi
     * FK fisik ke `users` harus dibuang. assign_to_type menyimpan jenisnya, sama
     * seperti pola todos.allocated_to_type.
     */
    public function up(): void {
        foreach (['tickets', 'ticket_responses'] as $table) {
            Schema::table($table, function (Blueprint $table) {
                $table->dropForeign(['assign_to_id']);
                $table->string('assign_to_type')->nullable()->after('assign_to_id');
            });

            DB::table($table)->whereNotNull('assign_to_id')->update(['assign_to_type' => 'user']);

            Schema::table($table, function (Blueprint $table) {
                $table->index(['assign_to_type', 'assign_to_id']);
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void {
        foreach (['tickets', 'ticket_responses'] as $tableName) {
            Schema::table($tableName, function (Blueprint $table) use ($tableName) {
                $table->dropIndex("{$tableName}_assign_to_type_assign_to_id_index");
                $table->dropColumn('assign_to_type');
                $table->foreign('assign_to_id')->references('id')->on('users')->nullOnDelete();
            });
        }
    }
};
