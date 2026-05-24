<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void {
        if (! Schema::hasTable('admin_user_permissions') || ! Schema::hasTable('permissions') || ! Schema::hasTable('roles') || ! Schema::hasTable('user_role')) {
            return;
        }

        $superAdminPermissionId = DB::table('permissions')
            ->where('name', 'super_admin')
            ->whereNull('deleted_at')
            ->value('id');

        if (! is_string($superAdminPermissionId) || $superAdminPermissionId === '') {
            return;
        }

        $adminRoleIds = DB::table('roles')
            ->where('name', 'admin')
            ->whereNull('deleted_at')
            ->pluck('id');

        if ($adminRoleIds->isEmpty()) {
            return;
        }

        $adminUserIds = DB::table('user_role')
            ->whereIn('role_id', $adminRoleIds->all())
            ->pluck('user_id')
            ->unique()
            ->values();

        if ($adminUserIds->isEmpty()) {
            return;
        }

        $now = now();

        foreach ($adminUserIds as $adminUserId) {
            $existing = DB::table('admin_user_permissions')
                ->where('user_id', $adminUserId)
                ->where('permission_id', $superAdminPermissionId)
                ->whereNull('deleted_at')
                ->exists();

            if ($existing) {
                continue;
            }

            DB::table('admin_user_permissions')->insert([
                'id'            => (string) Str::ulid(),
                'user_id'       => $adminUserId,
                'permission_id' => $superAdminPermissionId,
                'created_at'    => $now,
                'updated_at'    => $now,
                'deleted_at'    => null,
            ]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void {
        if (! Schema::hasTable('admin_user_permissions') || ! Schema::hasTable('permissions')) {
            return;
        }

        $superAdminPermissionId = DB::table('permissions')
            ->where('name', 'super_admin')
            ->whereNull('deleted_at')
            ->value('id');

        if (! is_string($superAdminPermissionId) || $superAdminPermissionId === '') {
            return;
        }

        DB::table('admin_user_permissions')
            ->where('permission_id', $superAdminPermissionId)
            ->delete();
    }
};
