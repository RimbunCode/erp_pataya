<?php

namespace App\Http\Middleware;

use App\Services\Admin\AdminPermissionService;
use App\Services\Auth\RoleResolver;
use Illuminate\Http\Request;
use Inertia\Middleware;
use Tighten\Ziggy\Ziggy;

class HandleInertiaRequests extends Middleware {
    public function __construct(
        private RoleResolver $roleResolver,
        private AdminPermissionService $adminPermissionService,
    ) {}

    /**
     * The root template that is loaded on the first page visit.
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determine the current asset version.
     */
    public function version(Request $request): ?string {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array {
        $isDebug                   = config('app.debug');
        $flashKeys                 = $request->session()->has('_flash') ? $request->session()->get('_flash')['old'] : [];
        $user                      = $request->user();
        $sharedUser                = null;
        $activeRole                = null;
        $adminPermissions          = [];
        $canManageAdminPermissions = false;

        if ($user) {
            $userRoles = $this->roleResolver->normalizeRoles($user->roles->pluck('name')->toArray());

            $sharedUser              = $user->toArray();
            $sharedUser['image_url'] = $user->image_url;
            $sharedUser['roles']     = $userRoles;
            $activeRole              = $this->roleResolver->resolveActiveRoleFromRequestPath(
                $userRoles,
                $request->path(),
                $request->cookie(RoleResolver::LAST_ACTIVE_ROLE_COOKIE),
            );

            if (\in_array('admin', $userRoles, true)) {
                $adminPermissions          = $this->adminPermissionService->resolveUserPermissionNames($user);
                $canManageAdminPermissions = \in_array('super_admin', $adminPermissions, true);
            }
        } elseif ($request->session()->get('mock_auth')) {
            $sharedUser = $request->session()->get('mock_user');
        }

        return [
            ...parent::share($request),
            'auth' => [
                'user'                         => $sharedUser,
                'active_role'                  => $activeRole,
                'admin_permissions'            => $adminPermissions,
                'can_manage_admin_permissions' => $canManageAdminPermissions,
            ],
            'notifications' => function () use ($user) {
                if (! $user) {
                    return ['unread_count' => 0, 'menu_badges' => (object) [], 'items' => []];
                }

                $unread = $user->unreadNotifications()
                    ->latest()
                    ->take(20)
                    ->get()
                    ->map(fn ($n) => [
                        'id'         => $n->id,
                        'type'       => $n->data['type'] ?? 'info',
                        'title'      => $n->data['title'] ?? '',
                        'body'       => $n->data['body'] ?? '',
                        'action_url' => $n->data['action_url'] ?? '#',
                        'menu_key'   => $n->data['menu_key'] ?? null,
                        'created_at' => $n->created_at->diffForHumans(),
                    ]);

                $menuBadges = $unread
                    ->filter(fn ($n) => ! empty($n['menu_key']))
                    ->groupBy('menu_key')
                    ->map->count()
                    ->toArray();

                return [
                    'unread_count' => $user->unreadNotifications()->count(),
                    'menu_badges'  => $menuBadges ?: (object) [],
                    'items'        => $unread->values(),
                ];
            },
            'lang'  => $request->cookie('lang') ?? 'en',
            'ziggy' => fn () => [
                ...(new Ziggy)->toArray(),
                'location' => $request->url(),
                'query'    => \count($request->query()) > 0 ? $request->query() : null,
            ],
            'flash' => \array_filter(
                $request->session()->all(),
                fn ($key) => \in_array($key, $flashKeys),
                \ARRAY_FILTER_USE_KEY,
            ),
            ...($isDebug ? ['debug' => $isDebug] : []),
        ];
    }
}
