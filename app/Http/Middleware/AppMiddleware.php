<?php

namespace App\Http\Middleware;

use App\Models\Core\Country;
use App\Models\Core\Preference;
use App\Models\User\RolePermission;
use Closure;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Middleware;
use Symfony\Component\HttpFoundation\Response;

class AppMiddleware extends Middleware {
    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response {
        $user = $request->user();
        if ($user) {
            $currentBranch = $request->session()->get('currentBranch');
            if ($currentBranch === null) {
                $currentBranch = $user->default_branch_id;
                $request->session()->put('currentBranch', $currentBranch);
            }
            $branches                 = $user->branches()->get();
            $permissions              = $request->session()->get('permissions');
            $permissionsVersion       = $request->session()->get('permissions_version');
            $latestPermissionsVersion = $this->resolvePermissionsVersion($user->id);
            if ($permissions === null || $permissionsVersion !== $latestPermissionsVersion) {
                $permissions = $this->resolvePermissions($user->id);
                $request->session()->put('permissions', $permissions);
                $request->session()->put('permissions_version', $latestPermissionsVersion);
            }

            $activeBranch = $branches->firstWhere('id', $currentBranch)
              ?? $branches->firstWhere('id', $user->default_branch_id);

            Inertia::share([
                'permissions'    => $permissions,
                'branchSettings' => [
                    'branches'      => $branches,
                    'currentBranch' => $activeBranch,
                ],
            ]);
        }

        return parent::handle($request, $next);
    }

    public function share(Request $request): array {
        $preferences = Preference::query()->pluck('value', 'key');
        $countryId   = $preferences->get('country_id');
        $countryName = $countryId !== null
          ? Country::query()->whereKey($countryId)->value('name')
          : null;

        return [
            ...parent::share($request),
            'preferences' => [
                ...$preferences->all(),
                'country_name' => $countryName,
            ],
        ];
    }

    private function resolvePermissions(string $userId): array {
        return RolePermission::select('role_permissions.model', 'role_permissions.permissions', 'role_permissions.level', 'role_permissions.only_creator')
            ->join('user_role', 'user_role.role_id', '=', 'role_permissions.role_id')
            ->where('user_role.user_id', $userId)
            ->get()
            ->groupBy([
                'model',
                'level',
                fn ($permission) => $permission->only_creator ? 'true' : 'false',
            ])
            ->map(fn ($levels) => $levels->map(fn ($onlyCreators) => $onlyCreators->map(function ($permissions) {
                $dataPermissions = [];
                foreach ($permissions as $permission) {
                    foreach ($permission->permissions as $key => $value) {
                        $dataPermissions[$key] = ($dataPermissions[$key] ?? false) || $value;
                    }
                }

                $masterData = $permissions->first();

                return [
                    'model'        => $masterData->model,
                    'level'        => $masterData->level,
                    'only_creator' => $masterData->only_creator,
                    'permissions'  => $dataPermissions,
                ];
            })))
            ->toArray();
    }

    private function resolvePermissionsVersion(string $userId): string {
        $permissions = RolePermission::query()
            ->join('user_role', 'user_role.role_id', '=', 'role_permissions.role_id')
            ->where('user_role.user_id', $userId)
            ->selectRaw('COUNT(role_permissions.id) as permission_count')
            ->selectRaw('COUNT(DISTINCT user_role.role_id) as role_count')
            ->selectRaw('MAX(role_permissions.updated_at) as max_permission_updated_at')
            ->selectRaw('MAX(user_role.updated_at) as max_user_role_updated_at')
            ->first();

        return implode('|', [
            (string) ($permissions?->permission_count ?? 0),
            (string) ($permissions?->role_count ?? 0),
            (string) ($permissions?->max_permission_updated_at ?? '0'),
            (string) ($permissions?->max_user_role_updated_at ?? '0'),
        ]);
    }
}
