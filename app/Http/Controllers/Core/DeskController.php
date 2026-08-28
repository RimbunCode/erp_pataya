<?php

namespace App\Http\Controllers\Core;

use App\Enums\DeskType;
use App\Enums\Permission;
use App\Http\Controllers\Controller;
use App\Http\Requests\Core\DashboardWidgetRequest;
use App\Models\Core\Desk;
use App\Models\Core\DeskAssignable;
use App\Models\Core\DeskMenuItem;
use App\Models\Core\DeskUserPreference;
use App\Models\Core\MenuItem;
use App\Models\DashboardWidget;
use App\Models\User\Permission as PermissionModel;
use App\Services\Core\Desk\DeskResolverService;
use App\Services\Core\Desk\MenuItemUrlResolver;
use App\Services\Core\PermissionChecker;
use App\Services\Core\PrintTemplate\HTMLSanitizerService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route as RouteFacade;
use Inertia\Inertia;
use Symfony\Component\Routing\Exception\ResourceNotFoundException;

class DeskController extends Controller {
    public function __construct(Request $request, private DeskResolverService $resolver) {
        parent::__construct($request, Desk::class);
    }

    /**
     * Requirement 3 AC 3: `index` selalu bypass guard permission formal —
     * visibilitas datanya sendiri diatur query branching di index() (semua
     * user terautentikasi tetap berhak akses /desks untuk desk pribadinya).
     * Requirement 3 AC 4: `show`/`update`/`destroy` bypass HANYA jika Desk
     * bertipe Custom dan dimiliki user yang sedang login (self-service,
     * analog UserController::exceptPermission — Desk tidak punya kolom
     * created_by_id sehingga mekanisme only_creator generik di base
     * Controller tidak berlaku untuknya).
     */
    protected function exceptPermission(string $method) {
        // index, switch, setDefault, create, store: tidak ada aksi CRUD
        // formal yang relevan digated di sini — visibilitas/otorisasi
        // masing-masing sudah dijamin oleh guard internal method itu sendiri
        // (visibleDesksFor() pada switch()/setDefault(), query branching pada
        // index(), redirect murni pada create()). store() KHUSUS: setiap user
        // terautentikasi berhak membuat desk personal (Requirement 5 AC 2)
        // terlepas dari Permission Desk formal — permission Create HANYA
        // menentukan APAKAH boleh membuat mode "dibagikan" (dicek manual di
        // dalam store() sendiri via $canShare), bukan gerbang store() itu sendiri.
        // desk-dashboard-builder Requirement 5: home()/updateDashboardWidgets()
        // punya otorisasi sendiri (canEdit berbasis hasWritePermission ATAU
        // owner Custom Desk, dicek manual di dalam method masing-masing) —
        // BUKAN gerbang permission formal Desk CRUD biasa (bisa diakses baca
        // oleh siapapun yang boleh lihat Desk itu, edit dibatasi terpisah).
        if (\in_array($method, ['index', 'switch', 'setDefault', 'create', 'store', 'reorder', 'home', 'updateDashboardWidgets'])) {
            return true;
        }

        if (! \in_array($method, ['show', 'update', 'destroy'])) {
            return null;
        }

        $desk = RouteFacade::getCurrentRoute()->parameter('desk');
        $desk = \is_string($desk) ? Desk::find($desk) : $desk;

        return $desk && $desk->type === DeskType::Custom && $desk->owner_id === request()->user()->id ? true : null;
    }

    public function index(Request $request) {
        // Requirement /desks direvisi: TANPA breadcrumb sama sekali (feedback
        // user pasca-implementasi — tampilan berantakan saat breadcrumb tampil
        // bersamaan dengan BranchSwitcher di halaman grid ini).
        Inertia::share(['breadcrumbs' => null]);

        $user    = $request->user();
        $checker = PermissionChecker::forUser($request);

        $hasWritePermission  = $checker->can(Desk::class, Permission::Write);
        $hasDeletePermission = $checker->can(Desk::class, Permission::Delete);

        // Requirement 10 AC 1-3: urutan default dari desks.order, di-override
        // per-user oleh desk_user_preferences (kalau ada baris utk desk itu).
        $preferences = DeskUserPreference::where('user_id', $user->id)->get()->keyBy('desk_id');

        $desks = ($checker->can(Desk::class, Permission::Select) ? Desk::query()->get() : $this->resolver->visibleDesksFor($user, $checker, $request))
            ->sortBy(fn (Desk $desk) => $preferences->get($desk->id)?->order ?? $desk->order)
            ->values()
            ->map(function (Desk $desk) use ($user, $hasWritePermission, $hasDeletePermission, $preferences) {
                $isOwnCustom = $desk->type === DeskType::Custom && $desk->owner_id === $user->id;

                return [
                    ...$desk->only(['id', 'name', 'icon', 'background_color', 'foreground_color', 'type']),
                    'isDefault' => $desk->id === $user->default_desk_id,
                    // Requirement 10 AC 4-8: preferensi tampil/sembunyi PER-USER,
                    // dikirim SELALU (termasuk desk hidden) — FE yang filter mana
                    // yang dirender di grid utama vs area tersembunyi mode edit.
                    'isHidden' => $preferences->get($desk->id)?->is_hidden ?? false,
                    // Requirement 7 AC 5-6: pemilik custom desk boleh edit tanpa
                    // permission formal; pemegang Permission Desk Write boleh
                    // edit SEMUA desk (termasuk System).
                    'canEdit' => $isOwnCustom || $hasWritePermission,
                    // Requirement 7 AC 7: Desk System TIDAK PERNAH bisa dihapus
                    // terlepas dari permission apa pun.
                    'canDelete' => $desk->type === DeskType::Custom
                        && ($isOwnCustom || $hasDeletePermission),
                ];
            });

        return Inertia::render('Core/DeskList', [
            'desks'        => $desks->values(),
            'allMenuItems' => $this->menuItemOptions(),
            'canShare'     => $checker->can(Desk::class, Permission::Create),
        ]);
    }

    /**
     * Reorder + toggle sembunyikan Desk pada grid /desks (mode edit) — SELALU
     * per-preferensi user yang sedang login (desk_user_preferences), TIDAK
     * pernah mengubah data global (Desk::order tetap sbg fallback default,
     * TIDAK diubah oleh method ini). Hanya boleh menyimpan preferensi utk
     * Desk yang visible bagi user itu sendiri.
     */
    public function reorder(Request $request) {
        $request->validate([
            'desks'             => ['required', 'array'],
            'desks.*.id'        => ['required', 'string'],
            'desks.*.is_hidden' => ['required', 'boolean'],
        ]);

        $user           = $request->user();
        $checker        = PermissionChecker::forUser($request);
        $visibleDeskIds = ($checker->can(Desk::class, Permission::Select) ? Desk::query()->get() : $this->resolver->visibleDesksFor($user, $checker, $request))
            ->pluck('id');

        foreach ($request->input('desks') as $index => $row) {
            if (! $visibleDeskIds->contains($row['id'])) {
                continue;
            }

            DeskUserPreference::updateOrCreate(
                ['user_id' => $user->id, 'desk_id' => $row['id']],
                ['order' => $index, 'is_hidden' => $row['is_hidden']],
            );
        }

        return back();
    }

    /**
     * Requirement 7 AC 3-4: opsi MenuItem yang BELUM dipilih untuk picker
     * "Tambah Menu" — dikirim flat dengan `parent_id` (Modul asal) supaya
     * FE yang mengelompokkan per-Accordion.
     */
    /**
     * Bug ditemukan: prop ini SEBELUMNYA tidak menyertakan `url`, padahal
     * blok dashboard (shortcut & link_card_item) memakainya untuk href —
     * akibatnya setiap link bertipe `menu_item` di dashboard tidak pernah
     * bisa diklik. URL di-resolve lewat service yang SAMA dengan sidebar.
     */
    private function menuItemOptions() {
        $urlResolver = app(MenuItemUrlResolver::class);

        return MenuItem::query()
            ->get(['id', 'label', 'icon', 'parent_id', 'route_name', 'url_override'])
            ->map(fn (MenuItem $item) => [
                ...$item->only(['id', 'label', 'icon', 'parent_id']),
                'url' => $urlResolver->resolve($item),
            ]);
    }

    private function menuItemsValidationRules(): array {
        return [
            'menu_items'                => ['sometimes', 'array'],
            'menu_items.*.menu_item_id' => ['nullable', 'string', 'exists:menu_items,id'],
            'menu_items.*.label'        => ['required_without:menu_items.*.menu_item_id', 'nullable', 'string', 'max:255'],
            'menu_items.*.icon'         => ['nullable', 'string'],
            'menu_items.*.children'     => ['sometimes', 'array'],
            // Anak TIDAK BOLEH grup virtual — 1 level artinya hanya parent
            // yang boleh murni visual, mencegah nesting lebih dalam.
            'menu_items.*.children.*.menu_item_id' => ['required', 'string', 'exists:menu_items,id'],
            'menu_items.*.children.*.icon'         => ['nullable', 'string'],
        ];
    }

    /**
     * Full-replace pivot desk_menu_item dari payload nested FE — konsisten
     * pola assignables()->delete()+create ulang yang sudah dipakai di
     * store()/update() untuk assignable (bukan diff/upsert).
     */
    private function saveMenuItems(Desk $desk, array $rows): void {
        $desk->menuItemPivots()->delete();

        foreach ($rows as $order => $row) {
            $parent = DeskMenuItem::create([
                'desk_id'      => $desk->id,
                'menu_item_id' => $row['menu_item_id'] ?? null,
                'label'        => empty($row['menu_item_id']) ? ($row['label'] ?? null) : null,
                'icon'         => $row['icon'] ?? null,
                'order'        => $order,
            ]);

            foreach ($row['children'] ?? [] as $childOrder => $child) {
                DeskMenuItem::create([
                    'desk_id'      => $desk->id,
                    'menu_item_id' => $child['menu_item_id'],
                    'icon'         => $child['icon'] ?? null,
                    'order'        => $childOrder,
                    'parent_id'    => $parent->id,
                ]);
            }
        }
    }

    /**
     * Struktur nested untuk field Menu di form Desk — label/icon resolve
     * dari MenuItem asli kalau ada, atau kolom pivot langsung (grup virtual).
     */
    private function menuItemsForForm(Desk $desk): array {
        return $desk->menuItemPivots()
            ->whereNull('parent_id')
            ->with(['menuItem', 'children.menuItem'])
            ->get()
            ->map(fn (DeskMenuItem $pivot) => [
                'id'           => $pivot->id,
                'menu_item_id' => $pivot->menu_item_id,
                'label'        => $pivot->menu_item_id ? $pivot->menuItem->label : $pivot->label,
                'icon'         => $pivot->icon ?? $pivot->menuItem?->icon,
                'children'     => $pivot->children->map(fn (DeskMenuItem $child) => [
                    'id'           => $child->id,
                    'menu_item_id' => $child->menu_item_id,
                    'label'        => $child->menuItem->label,
                    'icon'         => $child->icon ?? $child->menuItem->icon,
                ])->values(),
            ])
            ->values()
            ->all();
    }

    public function create() {
        return redirect()->route('desks.index');
    }

    public function store(Request $request) {
        $request->validate([
            'name'                          => ['required', 'string', 'max:255'],
            'icon'                          => ['required', 'string'],
            'background_color'              => ['nullable', 'string'],
            'foreground_color'              => ['nullable', 'string'],
            'is_default'                    => ['sometimes', 'boolean'],
            'is_personal_only'              => ['sometimes', 'boolean'],
            'is_shared_all'                 => ['sometimes', 'boolean'],
            'assignables'                   => ['sometimes', 'array'],
            'assignables.*.assignable'      => ['required_with:assignables', 'array'],
            'assignables.*.assignable.type' => ['required_with:assignables', 'string', 'in:role,user'],
            'assignables.*.assignable.id'   => ['required_with:assignables', 'string'],
            ...$this->menuItemsValidationRules(),
        ]);

        $checker     = PermissionChecker::forUser($request);
        $canShare    = $checker->can(Desk::class, Permission::Create);
        $isPersonal  = ! $canShare || $request->boolean('is_personal_only', true);
        $isSharedAll = $canShare && ! $isPersonal && $request->boolean('is_shared_all');

        $desk = Desk::create([
            'name'             => $request->name,
            'icon'             => $request->icon,
            'background_color' => $request->background_color,
            'foreground_color' => $request->foreground_color,
            'type'             => DeskType::Custom,
            'owner_id'         => $request->user()->id,
            'is_personal_only' => $isPersonal,
            'is_shared_all'    => $isSharedAll,
            // Desk baru selalu ditaruh di akhir grid /desks, bukan awal
            // (default kolom order=0 akan menaruhnya paling depan).
            'order' => Desk::max('order') + 1,
        ]);

        if ($isPersonal) {
            $desk->assignables()->create(['assignable_type' => 'user', 'assignable_id' => $request->user()->id]);
        } elseif (! $isSharedAll) {
            foreach ($request->input('assignables', []) as $row) {
                $desk->assignables()->create([
                    'assignable_type' => $row['assignable']['type'],
                    'assignable_id'   => $row['assignable']['id'],
                ]);
            }
        }

        $this->saveMenuItems($desk, $request->input('menu_items', []));

        if ($request->boolean('is_default')) {
            $request->user()->update(['default_desk_id' => $desk->id]);
        }

        return redirect()->route('desks.index');
    }

    public function show(Request $request, Desk $desk) {
        $checker = PermissionChecker::forUser($request);

        // Requirement 6 direvisi (feedback user pasca-implementasi): halaman
        // show Desk SELALU tanpa sidebar/BranchSwitcher/DeskSwitcher, TANPA
        // kecuali (dulu System/shared dapat layout penuh — sekarang tidak).
        // Breadcrumb di-share manual (BUKAN via setBreadcrumbs() generik,
        // yang pakai $model->route/translateKey mentah) supaya labelnya
        // "Desks" yang terbaca, bukan key i18n mentah 'core.desk.title'
        // (belum ada file lang utk key itu).
        Inertia::share([
            'breadcrumbs' => [
                ['name' => 'Desks', 'link' => route('desks.index')],
                ['name' => $desk->name],
            ],
        ]);

        return Inertia::render('Core/Desk/Show', [
            'desk' => [
                ...$desk->only([
                    'id', 'name', 'icon', 'background_color', 'foreground_color',
                    'type', 'owner_id', 'is_personal_only', 'is_shared_all', 'is_disabled',
                ]),
                'isDefault'   => $desk->id === $request->user()->default_desk_id,
                'assignables' => $desk->assignables()->with('assignable')->get()
                    ->map(fn (DeskAssignable $row) => [
                        'id'         => $row->id,
                        'assignable' => $row->assignable?->only(['id', 'type', 'name']),
                    ]),
                'menu_items' => $this->menuItemsForForm($desk),
            ],
            'allMenuItems'       => $this->menuItemOptions(),
            'canShare'           => $checker->can(Desk::class, Permission::Create) || $checker->can(Desk::class, Permission::Write),
            'hasWritePermission' => $checker->can(Desk::class, Permission::Write),
        ]);
    }

    public function update(Request $request, Desk $desk) {
        $request->validate([
            'name'                          => ['required', 'string', 'max:255'],
            'icon'                          => ['required', 'string'],
            'background_color'              => ['nullable', 'string'],
            'foreground_color'              => ['nullable', 'string'],
            'is_default'                    => ['sometimes', 'boolean'],
            'is_personal_only'              => ['sometimes', 'boolean'],
            'is_shared_all'                 => ['sometimes', 'boolean'],
            'is_disabled'                   => ['sometimes', 'boolean'],
            'assignables'                   => ['sometimes', 'array'],
            'assignables.*.assignable'      => ['required_with:assignables', 'array'],
            'assignables.*.assignable.type' => ['required_with:assignables', 'string', 'in:role,user'],
            'assignables.*.assignable.id'   => ['required_with:assignables', 'string'],
            ...$this->menuItemsValidationRules(),
        ]);

        $checker            = PermissionChecker::forUser($request);
        $hasWritePermission = $checker->can(Desk::class, Permission::Write);
        $canShare           = $checker->can(Desk::class, Permission::Create) || $hasWritePermission;
        $isPersonal         = $desk->type === DeskType::System ? false : (! $canShare || $request->boolean('is_personal_only', true));
        $isSharedAll        = $canShare && ! $isPersonal && $request->boolean('is_shared_all');

        $desk->update([
            'name'             => $request->name,
            'icon'             => $request->icon,
            'background_color' => $request->background_color,
            'foreground_color' => $request->foreground_color,
            'is_personal_only' => $isPersonal,
            'is_shared_all'    => $isSharedAll,
            // Requirement 8 AC 6: nonaktifkan Desk HANYA boleh diubah pemegang
            // Permission Desk Write — owner tanpa permission formal tidak
            // boleh nonaktifkan desk-nya sendiri (beda dari edit field lain).
            'is_disabled' => $hasWritePermission ? $request->boolean('is_disabled') : $desk->is_disabled,
        ]);

        if ($desk->type !== DeskType::System) {
            if ($isPersonal) {
                $desk->assignables()->delete();
                $desk->assignables()->create([
                    'assignable_type' => 'user',
                    'assignable_id'   => $desk->owner_id ?? $request->user()->id,
                ]);
            } elseif (! $isSharedAll) {
                $desk->assignables()->delete();
                foreach ($request->input('assignables', []) as $row) {
                    $desk->assignables()->create([
                        'assignable_type' => $row['assignable']['type'],
                        'assignable_id'   => $row['assignable']['id'],
                    ]);
                }
            } else {
                $desk->assignables()->delete();
            }
        }

        $this->saveMenuItems($desk, $request->input('menu_items', []));

        if ($request->boolean('is_default')) {
            $request->user()->update(['default_desk_id' => $desk->id]);
        }

        return redirect()->route('desks.show', $desk);
    }

    public function switch(Request $request) {
        $request->validate([
            'desk_id'               => ['required', 'string'],
            'redirect_to_dashboard' => ['sometimes', 'boolean'],
        ]);

        $user = $request->user();
        $desk = $this->resolver->visibleDesksFor($user)->firstWhere('id', $request->desk_id);

        abort_unless($desk, 403);

        $cookie = cookie('active_desk', $desk->id, 60 * 24 * 30);

        // Dipicu eksplisit dari halaman /desks (DeskList.jsx) — asal klik
        // SELALU /desks, yang bukan MenuItem desk manapun, jadi TIDAK PERNAH
        // relevan (currentPageIrrelevantToDesk() lewat Referer jadi mubazir di
        // sini, redirect dashboard sudah pasti benar tanpa perlu dicek).
        if ($request->boolean('redirect_to_dashboard')) {
            return redirect()->route('dashboard')->withCookie($cookie);
        }

        if ($this->currentPageIrrelevantToDesk($request, $desk)) {
            return redirect()->route('dashboard')->withCookie($cookie);
        }

        return back()->withCookie($cookie);
    }

    /**
     * Requirement 6 AC 4 pengecualian: halaman asal (Referer) tidak boleh
     * "meninggalkan" user di halaman yang tidak lagi relevan setelah pindah
     * Desk. WHERE Referer tidak dapat di-resolve ke route bernama atau route
     * tersebut tidak terdaftar sebagai MenuItem sama sekali, dianggap relevan
     * (tidak ada dasar untuk memutuskan sebaliknya).
     */
    private function currentPageIrrelevantToDesk(Request $request, Desk $desk): bool {
        $referer = $request->headers->get('referer');
        if (! $referer) {
            return false;
        }

        try {
            $refererRequest = Request::create($referer);
            $routeName      = RouteFacade::getRoutes()->match($refererRequest)->getName();
        } catch (ResourceNotFoundException) {
            return false;
        }

        if (! $routeName) {
            return false;
        }

        $menuItem = MenuItem::forRoute($routeName);
        if (! $menuItem) {
            return false;
        }

        return ! $menuItem->desks()->where('desks.id', $desk->id)->exists();
    }

    public function setDefault(Request $request, Desk $desk) {
        $user = $request->user();

        abort_unless(
            $this->resolver->visibleDesksFor($user)->contains('id', $desk->id),
            403,
        );

        $user->update(['default_desk_id' => $desk->id]);

        return back();
    }

    /**
     * desk-dashboard-builder: route "dashboard" (name existing) — landing
     * page per-Desk, render Dashboard hasil resolveDashboard(). Desk aktif
     * diambil dari request attribute yang di-set ResolveActiveDesk.
     * Menggantikan total DashboardController::view() lama (union banyak
     * Dashboard per-user via user_dashboards) — 1 Desk aktif = 1 Dashboard.
     */
    public function home(Request $request) {
        $desk = $request->attributes->get('resolvedDesk');
        abort_unless($desk, 404);

        // Breadcrumb selalu "Home > DeskSwitcher > Dashboard" — label statis
        // "Dashboard", BUKAN $dashboard->title (mis. "Core Dashboard") yang
        // sudah terwakili DeskSwitcher itu sendiri (nama Desk aktif).
        Inertia::share(['breadcrumbs' => [['name' => 'Dashboard']]]);

        $dashboard = $desk->resolveDashboard();
        // Eager-load 2 tingkat (Requirement 1.6: depth maksimal 2) — root ->
        // children (link_card / block lain di dalam section) -> grandchildren
        // (link_card_item di dalam link_card yang ada di dalam section).
        $dashboard->load([
            'widgets' => fn ($q) => $q->whereNull('parent_id')
                ->orderBy('order')
                ->with(['widget', 'children.widget', 'children.children.widget']),
        ]);

        $this->hydrateQuickListModels($dashboard->widgets);

        return Inertia::render('Dashboard/Dashboard', [
            'dashboard' => $dashboard,
            'canEdit'   => $this->canEditDashboard($desk, $request),
            // desk-dashboard-builder Requirement 2.11: sumber opsi LinkPicker
            // (link_type=menu_item) — pola sama seperti share() di show()/create().
            'allMenuItems' => $this->menuItemOptions(),
        ]);
    }

    /**
     * desk-dashboard-builder Requirement 5.1: pemilik Custom Desk milik
     * sendiri ATAU pemegang Permission Write formal atas Desk — pola sama
     * dengan exceptPermission() show/update/destroy di atas.
     */
    private function canEditDashboard(Desk $desk, Request $request): bool {
        $isOwnCustom = $desk->type === DeskType::Custom && $desk->owner_id === $request->user()->id;
        $checker     = PermissionChecker::forUser($request);

        return $isOwnCustom || $checker->can(Desk::class, Permission::Write);
    }

    /**
     * desk-dashboard-builder Requirement 3, 5.3: full-replace seluruh baris
     * DashboardWidget milik Dashboard ini — pola sama seperti
     * menuItemPivots() di store()/update() (delete lalu create ulang).
     *
     * Requirement 1.6: kedalaman maksimal 2 level (section -> link_card ->
     * link_card_item, ATAU section -> block lain) berarti create HARUS 3
     * pass berurutan berdasar parent_ref — child pass-N butuh id hasil
     * create pass-(N-1) untuk resolve parent_id-nya sendiri via $refToId.
     */
    public function updateDashboardWidgets(DashboardWidgetRequest $request) {
        $desk = $request->attributes->get('resolvedDesk');
        abort_unless($desk, 404);
        abort_unless($this->canEditDashboard($desk, $request), 403);

        $dashboard = $desk->resolveDashboard();
        $rows      = $request->validated('widgets');

        $textLikeSanitizer = new HTMLSanitizerService(extraAllowedTags: ['blockquote', 'pre', 'code', 's', 'u', 'hr']);
        // "p" wajib ada di whitelist — TipTap SELALU membungkus teks dalam
        // <p> (paragraph node), bahkan untuk konten satu-baris seperti label
        // section. Tanpa "p", HTMLSanitizerService menghapus SELURUH root
        // elemen (beserta text node di dalamnya) karena root document selalu
        // berbentuk <p>...</p> — bug nyata ditemukan saat verifikasi visual
        // (label section tersimpan html:"" walau json terisi benar).
        $labelSanitizer = new HTMLSanitizerService(allowedTagsOverride: ['p', 'span', 'strong', 'em', 'u', 's', 'br']);

        foreach ($rows as $idx => $row) {
            $rows[$idx] = $this->sanitizeRowHtml($row, $textLikeSanitizer, $labelSanitizer);
        }

        DB::beginTransaction();
        $dashboard->widgets()->delete();

        $refToId   = [];
        $createRow = function (array $row, int $order, ?string $parentId) use ($dashboard, &$refToId) {
            $created = $dashboard->widgets()->create([
                'type'       => $row['type'],
                'widget_id'  => $row['widget']['id'] ?? null,
                'config'     => $row['config'] ?? null,
                'width'      => $row['width'],
                'order'      => $order,
                'parent_id'  => $parentId,
                'is_visible' => $row['is_visible'] ?? true,
            ]);
            if (! empty($row['ref'])) {
                $refToId[$row['ref']] = $created->id;
            }
        };

        // Pass 1: root — section, dan block manapun yang tidak dinestingkan.
        foreach ($rows as $order => $row) {
            if (empty($row['parent_ref'])) {
                $createRow($row, $order, null);
            }
        }
        // Pass 2: level-1 — link_card di dalam section, ATAU block lain
        // (chart/text/shortcut/dst) di dalam section.
        foreach ($rows as $order => $row) {
            if (! empty($row['parent_ref']) && isset($refToId[$row['parent_ref']]) && ($row['type'] ?? null) !== 'link_card_item') {
                $createRow($row, $order, $refToId[$row['parent_ref']]);
            }
        }
        // Pass 3: level-2 — link_card_item. parent_ref-nya (menunjuk suatu
        // link_card) baru pasti tersedia di $refToId setelah pass 2 selesai,
        // karena link_card induknya bisa saja baru dibuat di pass 2 (kalau
        // link_card itu sendiri berada di dalam section).
        foreach ($rows as $order => $row) {
            if (($row['type'] ?? null) === 'link_card_item') {
                $createRow($row, $order, $refToId[$row['parent_ref']] ?? null);
            }
        }

        DB::commit();

        return response()->noContent();
    }

    /**
     * Blok `quick_list` menyimpan `config.model_id` untuk query, dan
     * `config.model` (record Permission utuh) HANYA untuk ditampilkan di
     * LinkModel saat form dibuka.
     *
     * Bug: konfigurasi lama — dan konfigurasi apa pun yang objeknya tidak
     * lengkap — membuat LinkModel gagal menampilkan nilainya, lalu memanggil
     * onValueChange(null) yang menghapus pilihan model begitu dialog dibuka.
     * Karena itu record-nya dimuat ulang di sini setiap kali halaman
     * dirender, sehingga frontend selalu menerima objek yang bisa
     * ditampilkan tanpa bergantung pada bentuk data yang tersimpan.
     */
    private function hydrateQuickListModels(mixed $widgets): void {
        $quickLists = collect();

        $collect = function ($items) use (&$collect, $quickLists) {
            foreach ($items as $item) {
                if ($item->type === 'quick_list') {
                    $quickLists->push($item);
                }
                if ($item->relationLoaded('children')) {
                    $collect($item->children);
                }
            }
        };
        $collect($widgets);

        $permissionIds = $quickLists
            ->map(fn (DashboardWidget $row) => $row->config['model_id'] ?? null)
            ->filter()
            ->unique();

        if ($permissionIds->isEmpty()) {
            return;
        }

        $permissions = PermissionModel::query()->whereKey($permissionIds)->get()->keyBy('id');

        foreach ($quickLists as $row) {
            $permission = $permissions->get($row->config['model_id'] ?? null);
            if (! $permission) {
                continue;
            }

            $row->config = [...$row->config, 'model' => $permission->toArray()];
        }
    }

    /**
     * desk-dashboard-builder Requirement 2a, 2.1b, 2.1c: sanitasi HTML
     * per-tipe SEBELUM disimpan — sanitasi client TIDAK CUKUP karena bukan
     * satu-satunya jalur data mencapai penyimpanan.
     */
    private function sanitizeRowHtml(array $row, HTMLSanitizerService $textLikeSanitizer, HTMLSanitizerService $labelSanitizer): array {
        if (($row['type'] ?? null) === 'text' && ! empty($row['config']['html'] ?? null)) {
            $row['config']['html'] = $textLikeSanitizer->sanitize($row['config']['html'])->sanitizedHTML;
        }

        if (($row['type'] ?? null) === 'section') {
            if (! empty($row['config']['label']['html'] ?? null)) {
                $row['config']['label']['html'] = $labelSanitizer->sanitize($row['config']['label']['html'])->sanitizedHTML;
            }
        }

        // Feedback user: description Link Card & Quick List kini memakai
        // TiptapEditor (sebelumnya teks polos), jadi ikut jalur sanitasi
        // yang sama dengan description Section — bentuknya {json, html}.
        if (\in_array($row['type'] ?? null, ['section', 'link_card', 'quick_list'], true)
            && ! empty($row['config']['description']['html'] ?? null)) {
            $row['config']['description']['html'] = $textLikeSanitizer->sanitize($row['config']['description']['html'])->sanitizedHTML;
        }

        return $row;
    }
}
