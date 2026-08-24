<?php

namespace App\Http\Middleware;

use App\Enums\Permission;
use App\Models\Core\Desk;
use App\Models\Core\DeskMenuItem;
use App\Models\Core\MenuItem;
use App\Models\User\User;
use App\Services\Core\Desk\DeskResolverService;
use App\Services\Core\PermissionChecker;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Route as RouteFacade;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Exception\RouteNotFoundException;

class ResolveActiveDesk {
    public function __construct(private DeskResolverService $resolver) {}

    /**
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response {
        $user = $request->user();
        if (! $user) {
            return $next($request);
        }

        // Route desk.*/desks.* adalah jalan keluar dari kondisi "belum punya
        // Desk apa pun" (mis. buat desk personal pertama) — jangan resolve
        // desk aktif di sini, karena user yang benar-benar tanpa Desk sama
        // sekali justru butuh mengakses endpoint ini dulu.
        $routeName = $request->route()?->getName();
        if ($routeName && (\str_starts_with($routeName, 'desk.') || \str_starts_with($routeName, 'desks.'))) {
            return $next($request);
        }

        $checker = PermissionChecker::forUser($request);

        try {
            $desk = $this->resolver->resolve($request, $user, $checker);
        } catch (\RuntimeException $e) {
            // User benar-benar tidak punya Desk visible sama sekali (mis.
            // data seeder Desk belum ada). Bukan kondisi fatal — biarkan
            // request lanjut tanpa konteks Desk, bukan block seluruh akses.
            return $next($request);
        }

        Inertia::share([
            'activeDesk' => $desk->only(['id', 'name', 'icon', 'background_color', 'foreground_color']),
            'deskList'   => $this->resolver->visibleDesksFor($user, $checker, $request)
                ->map->only(['id', 'name', 'icon', 'background_color', 'foreground_color'])
                ->values(),
            'menuItems' => $this->buildMenuTree($desk, $checker),
        ]);

        return $next($request)->withCookie(
            cookie('active_desk', $desk->id, 60 * 24 * 30),
        );
    }

    private function buildMenuTree(Desk $desk, PermissionChecker $checker): array {
        $topLevel = $desk->menuItemPivots()
            ->whereNull('parent_id')
            ->with(['menuItem', 'children.menuItem'])
            ->get();

        return $topLevel
            ->map(fn (DeskMenuItem $pivot) => $this->buildMenuItem($pivot, $checker))
            ->filter()
            ->values()
            ->all();
    }

    /**
     * $pivot->menuItem null berarti baris ini grup virtual (label/icon
     * custom per-desk, tanpa route/model) — selalu jadi Collapsible trigger
     * murni kalau punya children, atau di-drop kalau kosong (tidak pernah
     * py url sendiri).
     */
    private function buildMenuItem(DeskMenuItem $pivot, PermissionChecker $checker): ?array {
        $menuItem = $pivot->menuItem;

        if ($menuItem?->model && ! $checker->can($menuItem->model, Permission::Select)) {
            return null;
        }

        $children = $pivot->children
            ->map(fn (DeskMenuItem $child) => $this->buildMenuItem($child, $checker))
            ->filter()
            ->values();

        $url = $menuItem ? $this->resolveUrl($menuItem) : null;

        if (! $url && $children->isEmpty()) {
            return null;
        }

        return [
            'title'     => $menuItem?->label ?? $pivot->label,
            'icon'      => $pivot->icon ?? $menuItem?->icon,
            'url'       => $url,
            'routeName' => $menuItem?->route_name,
            'model'     => $menuItem?->model,
            'items'     => $children->isNotEmpty() ? $children->all() : null,
        ];
    }

    /**
     * $item->url_override (opsional, URL LITERAL — path + query string apa
     * adanya, divalidasi format dasar saat seeding, lihat DeskSeeder::menuItem())
     * adalah PRIORITAS TERTINGGI: kalau diisi, dipakai LANGSUNG sebagai href
     * tanpa lewat route() sama sekali — skip seluruh logic route_name di bawah.
     * Beda dari route_name (nama route, di-resolve via route()), ini untuk
     * tujuan spesifik yang tidak direpresentasikan sebagai route+parameter
     * biasa (mis. halaman detail record tertentu, index dengan query filter
     * default).
     *
     * Kalau url_override kosong, $item->route_name bisa berupa nama route
     * persis, ATAU pola wildcard (mis. "users.*", Requirement 4 AC 4) — untuk
     * sidebar butuh SATU URL konkret sebagai tujuan klik. WHERE wildcard,
     * kandidat "*.index" SELALU dicoba lebih dulu (route listing adalah tujuan
     * klik sidebar yang wajar, bukan create/edit/show) — urutan alfabetis
     * murni tidak aman dipakai sebagai proxy prioritas karena "create" ('c')
     * mendahului "index" ('i') dan beberapa route create di project ini punya
     * parameter OPSIONAL (mis. "items.create" dengan "{ref?}"), sehingga lolos
     * generate tanpa exception walau bukan tujuan yang benar. Kalau tidak ada
     * kandidat "*.index" yang berhasil di-generate, baru fallback ke kandidat
     * lain terurut alfabetis sampai ada yang berhasil tanpa parameter wajib.
     */
    private function resolveUrl(MenuItem $item): ?string {
        if ($item->url_override !== null) {
            return $item->url_override;
        }

        $routeName = $item->route_name;

        if (! \str_contains($routeName, '*')) {
            try {
                return route($routeName);
            } catch (RouteNotFoundException $e) {
                Log::warning("MenuItem route_name tidak dapat di-resolve: {$routeName}", ['exception' => $e]);

                return null;
            }
        }

        $candidates = collect(RouteFacade::getRoutes())
            ->map(fn ($route) => $route->getName())
            ->filter()
            ->unique()
            ->filter(fn ($name) => fnmatch($routeName, $name))
            ->sort()
            ->sortByDesc(fn ($name) => \str_ends_with($name, '.index'));

        foreach ($candidates as $candidate) {
            try {
                return route($candidate);
            } catch (\Throwable $e) {
                continue;
            }
        }

        Log::warning("MenuItem route_name wildcard tidak menemukan route tanpa parameter wajib: {$routeName}");

        return null;
    }
}
