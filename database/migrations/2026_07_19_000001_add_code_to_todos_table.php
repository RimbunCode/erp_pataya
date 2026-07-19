<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void {
        Schema::table('todos', function (Blueprint $table) {
            $table->string('code')->nullable()->after('id');
        });

        DB::table('todos')->whereNull('code')->orderBy('id')->each(function ($todo) {
            DB::table('todos')->where('id', $todo->id)->update([
                'code' => 'TODO-LEGACY-' . $todo->id,
            ]);
        });

        Schema::table('todos', function (Blueprint $table) {
            $table->string('code')->nullable(false)->unique()->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void {
        Schema::table('todos', function (Blueprint $table) {
            $table->dropColumn('code');
        });
    }
};
