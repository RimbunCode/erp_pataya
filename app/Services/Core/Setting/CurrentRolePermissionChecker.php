<?php

namespace App\Services\Core\Setting;

use App\Models\User\RolePermission;
use App\Models\User\User;
use Illuminate\Database\Eloquent\Builder;

class CurrentRolePermissionChecker {
    /** @param list<string> $actions */
    public function allows(?User $user, string $model, array $actions, int $level = 0): bool {
        if ($user === null || $actions === []) {
            return false;
        }

        return RolePermission::query()
            ->where('model', $model)
            ->where('level', $level)
            ->whereHas('role', fn (Builder $roles): Builder => $roles
                ->where('is_disabled', false)
                ->whereHas('users', fn (Builder $users): Builder => $users->whereKey($user->getKey())))
            ->get(['permissions'])
            ->contains(fn (RolePermission $permission): bool => array_any(
                $actions,
                fn (string $action): bool => (bool) ($permission->permissions[$action] ?? false),
            ));
    }
}
