<?php

namespace App\Services\Admin;

use App\Models\User\AdminUserPermission;
use App\Models\User\Permission;
use App\Models\User\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;

class AdminPermissionService {
    /**
     * @var array<int, string>
     */
    public const ALLOWED_PERMISSION_NAMES = [
        'finance_admin',
        'course_admin',
        'user_admin',
        'content_admin',
        'super_admin',
    ];

    /**
     * @var array<string, array<int, string>>
     */
    private array $resolvedPermissionNamesByUser = [];

    private ?bool $hasPermissionTables = null;

    /**
     * @return array<int, string>
     */
    public function resolveUserPermissionNames(User $user): array {
        if (! $this->hasPermissionTables()) {
            return [];
        }

        $userId = (string) $user->id;
        if ($userId !== '' && array_key_exists($userId, $this->resolvedPermissionNamesByUser)) {
            return $this->resolvedPermissionNamesByUser[$userId];
        }

        $permissions = $user->relationLoaded('adminPermissions')
            ? $user->adminPermissions
            : $user->adminPermissions()
                ->select('permissions.id', 'permissions.name')
                ->whereIn('permissions.name', self::ALLOWED_PERMISSION_NAMES)
                ->get();

        $permissionNames = $permissions
            ->pluck('name')
            ->map(fn ($permissionName) => (string) $permissionName)
            ->filter(fn (string $permissionName) => \in_array($permissionName, self::ALLOWED_PERMISSION_NAMES, true))
            ->unique()
            ->values()
            ->all();

        if ($userId !== '') {
            $this->resolvedPermissionNamesByUser[$userId] = $permissionNames;
        }

        return $permissionNames;
    }

    public function hasAny(User $user, string ...$requiredPermissionNames): bool {
        $required = collect($requiredPermissionNames)
            ->map(fn ($permissionName) => strtolower(trim((string) $permissionName)))
            ->filter(fn ($permissionName) => \in_array($permissionName, self::ALLOWED_PERMISSION_NAMES, true))
            ->unique()
            ->values()
            ->all();

        if (\count($required) === 0) {
            return true;
        }

        $currentPermissions = $this->resolveUserPermissionNames($user);
        if (\in_array('super_admin', $currentPermissions, true)) {
            return true;
        }

        return \count(array_intersect($required, $currentPermissions)) > 0;
    }

    public function canManageAdminPermissions(User $user): bool {
        return $this->hasAny($user, 'super_admin');
    }

    /**
     * @param  array<int, string>  $permissionNames
     */
    public function syncAdminPermissions(User $actor, User $targetAdmin, array $permissionNames): void {
        if (! $this->canManageAdminPermissions($actor)) {
            throw ValidationException::withMessages([
                'permissions' => 'Anda tidak memiliki izin untuk mengatur permission admin.',
            ]);
        }

        $targetRoleNames = $targetAdmin->roles()->pluck('name')->map(fn ($roleName) => strtolower((string) $roleName))->all();
        if (! \in_array('admin', $targetRoleNames, true)) {
            throw ValidationException::withMessages([
                'admin' => 'User target bukan admin.',
            ]);
        }

        $normalizedPermissionNames = collect($permissionNames)
            ->map(fn ($permissionName) => strtolower(trim((string) $permissionName)))
            ->filter(fn ($permissionName) => \in_array($permissionName, self::ALLOWED_PERMISSION_NAMES, true))
            ->unique()
            ->values()
            ->all();

        if (\in_array('super_admin', $normalizedPermissionNames, true)) {
            $normalizedPermissionNames = ['super_admin'];
        }

        $currentPermissionNames = $this->resolveUserPermissionNames($targetAdmin);
        $isRemovingSuperAdmin   = \in_array('super_admin', $currentPermissionNames, true)
            && ! \in_array('super_admin', $normalizedPermissionNames, true);

        if ($isRemovingSuperAdmin && $this->countSuperAdminUsersExcluding($targetAdmin->id) === 0) {
            throw ValidationException::withMessages([
                'permissions' => 'Tidak bisa menghapus super admin terakhir.',
            ]);
        }

        $permissionIds = Permission::query()
            ->whereIn('name', $normalizedPermissionNames)
            ->whereNull('deleted_at')
            ->pluck('id')
            ->map(fn ($permissionId) => (string) $permissionId)
            ->values()
            ->all();

        DB::transaction(function () use ($targetAdmin, $permissionIds): void {
            AdminUserPermission::query()
                ->where('user_id', $targetAdmin->id)
                ->get()
                ->each(fn (AdminUserPermission $assignment) => $assignment->delete());

            foreach ($permissionIds as $permissionId) {
                AdminUserPermission::query()->create([
                    'user_id'       => $targetAdmin->id,
                    'permission_id' => $permissionId,
                ]);
            }
        });
    }

    private function countSuperAdminUsersExcluding(?string $excludedUserId = null): int {
        return Permission::query()
            ->join('admin_user_permissions', 'admin_user_permissions.permission_id', '=', 'permissions.id')
            ->join('users', 'users.id', '=', 'admin_user_permissions.user_id')
            ->join('user_role', 'user_role.user_id', '=', 'users.id')
            ->join('roles', 'roles.id', '=', 'user_role.role_id')
            ->where('permissions.name', 'super_admin')
            ->whereNull('permissions.deleted_at')
            ->whereNull('admin_user_permissions.deleted_at')
            ->whereNull('users.deleted_at')
            ->where('roles.name', 'admin')
            ->when(
                filled($excludedUserId),
                fn ($query) => $query->where('admin_user_permissions.user_id', '!=', $excludedUserId),
            )
            ->distinct()
            ->count('admin_user_permissions.user_id');
    }

    private function hasPermissionTables(): bool {
        if ($this->hasPermissionTables !== null) {
            return $this->hasPermissionTables;
        }

        $this->hasPermissionTables = Schema::hasTable('admin_user_permissions') && Schema::hasTable('permissions');

        return $this->hasPermissionTables;
    }
}
