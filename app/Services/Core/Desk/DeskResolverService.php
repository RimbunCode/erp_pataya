<?php

namespace App\Services\Core\Desk;

use App\Enums\DeskType;
use App\Enums\Permission;
use App\Http\Middleware\AppMiddleware;
use App\Models\Core\Desk;
use App\Models\Core\MenuItem;
use App\Models\User\User;
use App\Services\Core\PermissionChecker;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

class DeskResolverService {
    /** Session key sama dengan HandleInertiaRequests::SESSION_USER_ROLE_IDS_KEY (private di sana) — reuse cache, bukan query roles() baru. */
    private const SESSION_USER_ROLE_IDS_KEY = 'shared_user_role_ids';

    /** @var array<string, Collection> memoize per user->id — hindari query berulang dalam satu request */
    private array $visibleDesksCache = [];

    public function resolve(Request $request, User $user, ?PermissionChecker $checker = null): Desk {
        $checker ??= new PermissionChecker(AppMiddleware::resolvePermissionsFor($user->id));

        return $this->fromCookie($request, $user, $checker)
            ?? $this->fromUserDefault($request, $user, $checker)
            ?? $this->fromCurrentRoute($request, $user, $checker)
            ?? $this->firstVisible($request, $user, $checker);
    }

    public function visibleDesksFor(User $user, ?PermissionChecker $checker = null, ?Request $request = null): Collection {
        if (isset($this->visibleDesksCache[$user->id])) {
            return $this->visibleDesksCache[$user->id];
        }

        $checker          = $checker ?? new PermissionChecker(AppMiddleware::resolvePermissionsFor($user->id));
        $roleIds          = $this->resolveRoleIds($user, $request);
        $accessibleModels = $this->accessibleModels($checker);

        $desks = Desk::query()
            ->where(function ($query) use ($accessibleModels) {
                $query->where('type', DeskType::System);

                if (empty($accessibleModels)) {
                    $query->whereRaw('1 = 0');

                    return;
                }

                $query->whereHas('menuItems', function ($menuQuery) use ($accessibleModels) {
                    $menuQuery->whereNotNull('model')
                        ->whereIn('model', $accessibleModels);
                });
            })
            ->orWhere(function ($query) use ($user) {
                $query->where('type', DeskType::Custom)
                    ->where('owner_id', $user->id);
            })
            ->orWhere(function ($query) use ($roleIds) {
                $query->where('type', DeskType::Custom)
                    ->whereHas('roles', fn ($roleQuery) => $roleQuery->whereIn('roles.id', $roleIds));
            })
            ->get();

        return $this->visibleDesksCache[$user->id] = $desks;
    }

    /**
     * Reuse cache session dari HandleInertiaRequests (`idRoles()`, sudah di-resolve
     * & di-share tiap request ber-auth) alih-alih query `roles()` baru — hindari
     * query duplikat-mirip yang memicu false-positive QueryDetector di test env.
     *
     * @return array<int, string>
     */
    private function resolveRoleIds(User $user, ?Request $request): array {
        $cached = $request?->hasSession() ? $request->session()->get(self::SESSION_USER_ROLE_IDS_KEY) : null;

        return \is_array($cached) ? $cached : $user->roles()->pluck('roles.id')->all();
    }

    private function accessibleModels(PermissionChecker $checker): array {
        return MenuItem::query()
            ->whereNotNull('model')
            ->distinct()
            ->pluck('model')
            ->filter(fn ($model) => $checker->can($model, Permission::Select))
            ->values()
            ->all();
    }

    private function fromCookie(Request $request, User $user, PermissionChecker $checker): ?Desk {
        $deskId = $request->cookie('active_desk');
        if (! $deskId) {
            return null;
        }

        return $this->visibleAndRelevant($deskId, $request, $user, $checker);
    }

    private function fromUserDefault(Request $request, User $user, PermissionChecker $checker): ?Desk {
        if (! $user->default_desk_id) {
            return null;
        }

        return $this->visibleAndRelevant($user->default_desk_id, $request, $user, $checker);
    }

    /**
     * Sama seperti visible(), TAPI juga mensyaratkan route saat ini relevan
     * dengan Desk kandidat — Desk aktif/default tidak boleh "menyandera"
     * akses ke fitur yang tidak terdaftar padanya (Requirement 4 AC 3.1-3.2).
     * WHERE route tidak terdaftar sebagai MenuItem sama sekali, syarat
     * relevansi ini diabaikan (route non-menu, mis. halaman generik).
     */
    private function visibleAndRelevant(string $deskId, Request $request, User $user, PermissionChecker $checker): ?Desk {
        $desk = $this->visible($deskId, $user, $checker, $request);
        if (! $desk) {
            return null;
        }

        $routeName = $request->route()?->getName();
        if (! $routeName) {
            return $desk;
        }

        $menuItem = MenuItem::forRoute($routeName);
        if (! $menuItem) {
            return $desk;
        }

        return $menuItem->desks()->where('desks.id', $desk->id)->exists() ? $desk : null;
    }

    private function fromCurrentRoute(Request $request, User $user, PermissionChecker $checker): ?Desk {
        $routeName = $request->route()?->getName();
        if (! $routeName) {
            return null;
        }

        $menuItem = MenuItem::forRoute($routeName);
        if (! $menuItem) {
            return null;
        }

        return $this->visible($menuItem->primary_desk_id, $user, $checker, $request);
    }

    private function firstVisible(Request $request, User $user, PermissionChecker $checker): Desk {
        $desk = $this->visibleDesksFor($user, $checker, $request)->first();

        if (! $desk) {
            throw new \RuntimeException("User {$user->id} tidak memiliki akses ke Desk manapun.");
        }

        return $desk;
    }

    private function visible(string $deskId, User $user, PermissionChecker $checker, Request $request): ?Desk {
        return $this->visibleDesksFor($user, $checker, $request)->firstWhere('id', $deskId);
    }
}
