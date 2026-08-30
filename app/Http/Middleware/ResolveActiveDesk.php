<?php

namespace App\Http\Middleware;

use App\Enums\Permission;
use App\Models\Core\Desk;
use App\Models\Core\DeskMenuItem;
use App\Models\Core\MenuItem;
use App\Models\User\User;
use App\Services\Core\Desk\DeskResolverService;
use App\Services\Core\Desk\MenuItemUrlResolver;
use App\Services\Core\PermissionChecker;
use Closure;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

class ResolveActiveDesk {
    public function __construct(
        private DeskResolverService $resolver,
        private MenuItemUrlResolver $urlResolver,
    ) {}

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
        // sekali justru butuh mengakses endpoint ini dulu. Route "dashboard"
        // (Desk Home, desk-dashboard-builder Requirement 4) TIDAK match
        // prefix ini (nama route-nya "dashboard"/"dashboard.widgets.update",
        // bukan "desk.*") — otomatis TIDAK bypass, sesuai kebutuhan (halaman
        // itu justru BUTUH desk aktif ter-resolve via 'resolvedDesk' di bawah).
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

        // desk-dashboard-builder: expose Desk aktif ke controller lain
        // (DeskController::home()/updateDashboardWidgets()) tanpa re-resolve.
        $request->attributes->set('resolvedDesk', $desk);

        Inertia::share([
            'activeDesk' => $desk->only(['id', 'name', 'icon', 'background_color', 'foreground_color']),
            // 'type' (system|custom) diikutkan — feedback user: DeskSwitcher
            // urutkan system dulu baru custom, dengan divider di antaranya.
            'deskList' => $this->resolver->visibleDesksFor($user, $checker, $request)
                ->map->only(['id', 'name', 'icon', 'background_color', 'foreground_color', 'type'])
                ->values(),
            'menuItems' => $this->buildMenuTree($desk, $checker),
        ]);

        return $next($request)->withCookie(
            cookie('active_desk', $desk->id, 60 * 24 * 30),
        );
    }

    /**
     * Feedback user: 4 menu ini (Dashboard, lalu di urutan terakhir Approvals/
     * ToDo/Manual Book) WAJIB ada di SEMUA desk — system maupun custom yang
     * dibuat user — dan TIDAK BOLEH muncul sebagai opsi yang bisa
     * dihapus/diedit di picker/editor Menu Form Desk. Disuntik di SINI
     * (satu-satunya titik yang membangun prop `menuItems` utk desk apa pun),
     * BUKAN sebagai row MenuItem/DeskMenuItem — supaya otomatis tidak pernah
     * tersimpan per-desk (karenanya juga otomatis tidak muncul di
     * DeskMenuItemManager, yang membaca dari DB).
     */
    private const MANDATORY_TOP = ['title' => 'Dashboard', 'icon' => 'LayoutDashboard', 'routeName' => 'dashboard'];

    private const MANDATORY_BOTTOM = [
        ['title' => 'Approvals', 'icon' => 'StampIcon', 'routeName' => 'approvalInstances.*'],
        ['title' => 'ToDo', 'icon' => 'ListTodo', 'routeName' => 'todos.*'],
        ['title' => 'Manual Book', 'icon' => 'BookOpen', 'routeName' => 'manualBook.*'],
    ];

    private function buildMenuTree(Desk $desk, PermissionChecker $checker): array {
        $topLevel = $desk->menuItemPivots()
            ->whereNull('parent_id')
            ->with(['menuItem.parent', 'children.menuItem'])
            ->get();

        $items = $this->groupByMenuItemParent($topLevel, $checker);

        return [
            $this->mandatoryMenuItem(self::MANDATORY_TOP),
            ...$items,
            ...array_map($this->mandatoryMenuItem(...), self::MANDATORY_BOTTOM),
        ];
    }

    /**
     * Bug ditemukan: DeskSeeder mengelompokkan menu system desk via
     * `MenuItem::parent_id` (`menuGroup()`/param `group:`, mis. folder
     * "Inventories"), TAPI method ini SEBELUMNYA cuma baca nesting dari
     * `DeskMenuItem::parent_id` (level PIVOT, dipakai custom desk lewat
     * drag-drop di DeskMenuItemManager) — folder grup-nya sendiri bahkan
     * tidak pernah di-attach ke desk manapun. Akibatnya SEMUA anak grup
     * (mis. 10 item "Inventories") tampil FLAT di sidebar sungguhan,
     * bukan nested collapsible seperti maksud seeder.
     *
     * Di sini pivot top-level dikelompokkan ULANG berdasar
     * `MenuItem::parent_id` (BEDA sumbu dari `DeskMenuItem::parent_id`,
     * yang tetap dihormati lewat `buildMenuItem()`'s `$pivot->children`
     * seperti sebelumnya) — pivot yang berbagi parent MenuItem yang sama
     * dibungkus jadi SATU node collapsible (label/icon dari parent
     * MenuItem). Berlaku juga utk custom desk (bukan cuma system) —
     * konsisten, custom desk otomatis dapat efek sama tanpa perlu user
     * bikin virtual group manual kalau kebetulan pilih MenuItem yang
     * memang sudah punya grup di seeder.
     *
     * Feedback user: jangan grouping kalau cuma 1 item — tapi keanggotaan
     * grup itu SENDIRI per-desk (satu MenuItem yg sama bisa attach ke
     * beberapa desk berbeda, dgn saudara grup yg berbeda2 di tiap desk;
     * lihat mis. "Assets" yg di desk Asset ikut grup "Asset Master" 3
     * anak, tapi di desk Service cuma dia sendirian dari grup itu). Jadi
     * cek jumlah CHILD SETELAH filter permission, bukan asumsi statis
     * dari seeder — kalau hasilnya cuma 1, unwrap jadi item flat biasa
     * (bukan node collapsible ber-anak 1).
     *
     * @return array<int, array>
     */
    private function groupByMenuItemParent($pivots, PermissionChecker $checker): array {
        $grouped = $pivots->groupBy(fn (DeskMenuItem $pivot) => $pivot->menuItem?->parent_id ?? $pivot->id);

        $items = [];
        foreach ($grouped as $pivotsInGroup) {
            $parentMenuItem = $pivotsInGroup->first()->menuItem?->parent;

            if (! $parentMenuItem) {
                foreach ($pivotsInGroup as $pivot) {
                    $built = $this->buildMenuItem($pivot, $checker);
                    if ($built) {
                        $items[] = $built;
                    }
                }

                continue;
            }

            $children = $pivotsInGroup
                ->map(fn (DeskMenuItem $pivot) => $this->buildMenuItem($pivot, $checker))
                ->filter()
                ->values();

            if ($children->count() === 1) {
                $items[] = $children->first();
            } elseif ($children->count() > 1) {
                $items[] = [
                    'title'     => $parentMenuItem->label,
                    'icon'      => $parentMenuItem->icon,
                    'url'       => null,
                    'routeName' => null,
                    'model'     => null,
                    'items'     => $children->all(),
                ];
            }
        }

        return $items;
    }

    /**
     * @param  array{title: string, icon: string, routeName: string}  $def
     */
    private function mandatoryMenuItem(array $def): array {
        return [
            'title'     => $def['title'],
            'icon'      => $def['icon'],
            'url'       => $this->urlResolver->resolve(new MenuItem(['route_name' => $def['routeName']])),
            'routeName' => $def['routeName'],
            'model'     => null,
            'items'     => null,
        ];
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
    /**
     * Delegasi ke MenuItemUrlResolver — logikanya dipakai bersama dengan
     * DeskController (prop allMenuItems untuk link dashboard), jadi tidak
     * lagi berdiri sendiri di sini.
     */
    private function resolveUrl(MenuItem $item): ?string {
        return $this->urlResolver->resolve($item);
    }
}
