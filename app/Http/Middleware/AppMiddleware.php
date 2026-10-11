<?php

namespace App\Http\Middleware;

use App\Models\User\Permission;
use App\Models\User\RolePermission;
use Closure;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Middleware;
use Symfony\Component\HttpFoundation\Response;

class AppMiddleware extends Middleware {
    /** Detik. Batas basi prop bersama yang tak ikut versi permission (once prop). */
    private const SHARED_PROPS_TTL = 300;

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
            $permissions              = $request->session()->get('permissions');
            $permissionsVersion       = $request->session()->get('permissions_version');
            $latestPermissionsVersion = $this->resolvePermissionsVersion($user->id);
            if ($permissions === null || $permissionsVersion !== $latestPermissionsVersion) {
                $permissions = self::resolvePermissionsFor($user->id);
                $request->session()->put('permissions', $permissions);
                $request->session()->put('permissions_version', $latestPermissionsVersion);
            }

            // Ketiganya once prop: dikirim sekali lalu dipakai ulang browser selama
            // kuncinya sama, jadi pindah halaman tak mengirim ulang (permissions ~18 KB)
            // maupun menjalankan query-nya. Closure juga hanya dipanggil kalau prop
            // diproses respons (reload parsial/XHR tak menyentuhnya). Kunci:
            //  - permissions: user + versi permission (versi dicek tiap request di atas,
            //    jadi perubahan hak akses langsung mengganti kunci => tak perlu TTL).
            //  - ignorePermissionModels: sama + TTL (hampir statis).
            //  - branchSettings: user + cabang aktif (ganti cabang => kirim ulang) + TTL
            //    utk perubahan penugasan cabang/nama cabang oleh admin.
            $onceKey = fn (string $prop, string ...$parts): string => $prop . ':' . md5(implode('|', [$user->id, ...$parts]));

            Inertia::share([
                'permissions' => Inertia::once(fn () => $permissions)
                    ->as($onceKey('permissions', $latestPermissionsVersion)),
                'ignorePermissionModels' => Inertia::once(fn () => Permission::where('ignore_permission', true)->pluck('model'))
                    ->as($onceKey('ignorePermissionModels', $latestPermissionsVersion))
                    ->until(self::SHARED_PROPS_TTL),
                'branchSettings' => Inertia::once(function () use ($user, $currentBranch) {
                    // without()+withoutGlobalScope('country'): dropdown branch
                    // selector cuma butuh id/name/is_main_branch, tapi
                    // Branch::$with (property model, beda dari global scope)
                    // selalu eager-load 2 relasi Country -- N+1 kalau tak
                    // dihindari eksplisit di sini.
                    $branches = $user->branches()
                        ->withoutGlobalScope('country')
                        ->without(['billingCountry', 'shippingCountry'])
                        ->get();

                    // Serialisasi Branch memuat relasi negara LAGI per cabang walau
                    // without() di atas: aksesor getBillingAddressAttribute()
                    // (juga yang ada di $appends) membaca billingCountry, dan Eloquent
                    // menerapkan aksesor ke KOLOM `billing_address` yang namanya sama.
                    // Frontend hanya memakai id/name/is_main_branch. makeHidden (bukan
                    // setAppends): LinkModel::getArrayableAppends() menimpa $appends
                    // tiap serialisasi, sedangkan filter hidden tetap berlaku.
                    $branches->makeHidden(['billing_address', 'billingAddress', 'shippingAddress']);

                    return [
                        'branches'      => $branches,
                        'currentBranch' => $branches->firstWhere('id', $currentBranch)
                            ?? $branches->firstWhere('id', $user->default_branch_id),
                    ];
                })
                    ->as($onceKey('branchSettings', (string) $currentBranch))
                    ->until(self::SHARED_PROPS_TTL),
            ]);
        }

        return parent::handle($request, $next);
    }

    public static function resolvePermissionsFor(string $userId): array {
        return RolePermission::select('role_permissions.model', 'role_permissions.permissions', 'role_permissions.level', 'role_permissions.only_creator')
            ->join('user_role', 'user_role.role_id', '=', 'role_permissions.role_id')
            ->join('roles', 'roles.id', '=', 'user_role.role_id')
            ->where('user_role.user_id', $userId)
            ->where('roles.is_disabled', false)
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
