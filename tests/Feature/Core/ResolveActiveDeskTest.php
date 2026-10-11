<?php

namespace Tests\Feature\Core;

use App\Enums\DeskType;
use App\Enums\Permission as PermissionEnum;
use App\Models\Core\Desk;
use App\Models\Core\MenuItem;
use App\Models\Purchase\PurchaseOrder;
use App\Models\Purchase\PurchaseRequest;
use App\Models\User\Permission;
use App\Models\User\Role;
use App\Models\User\RolePermission;
use App\Models\User\User;
use BeyondCode\QueryDetector\QueryDetectorMiddleware;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class ResolveActiveDeskTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        $this->withoutMiddleware([
            QueryDetectorMiddleware::class,
        ]);
    }

    /** @return array<string, mixed> */
    private function loadDeferredDeskProps(User $user): array {
        $initial = $this->actingAs($user)
            ->withCookie('lang', 'en')
            ->get(route('dashboard'));

        preg_match('#<script[^>]*type="application/json">(.*?)</script>#s', $initial->getContent(), $matches);
        $page = json_decode($matches[1], true, flags: JSON_THROW_ON_ERROR);

        return $this->actingAs($user)
            ->withCookie('lang', 'en')
            ->withHeaders([
                'X-Inertia'                   => 'true',
                'X-Inertia-Version'           => $page['version'] ?? '',
                'X-Inertia-Partial-Component' => 'Dashboard/Dashboard',
                'X-Inertia-Partial-Data'      => 'deskList,menuItems',
            ])
            ->get(route('dashboard'))
            ->assertOk()
            ->json('props');
    }

    public function test_middleware_sets_active_desk_cookie_on_response(): void {
        $user = User::factory()->create();
        $desk = Desk::factory()->create(['type' => DeskType::Custom, 'owner_id' => $user->id]);
        $user->update(['default_desk_id' => $desk->id]);

        $response = $this->actingAs($user)
            ->withCookie('lang', 'en')
            ->get(route('dashboard'));

        $response->assertCookie('active_desk', $desk->id);
    }

    /**
     * Feedback user: Dashboard/Approvals/ToDo/Manual Book disuntik di
     * buildMenuTree() (BUKAN row DB) — SELALU ada di posisi tetap: Dashboard
     * paling atas, 3 lainnya paling bawah. `route_name` custom di sini
     * SENGAJA bukan 'dashboard' (bentrok makna dgn item wajib yg disuntik).
     */
    public function test_middleware_shares_inertia_props(): void {
        $user = User::factory()->create();
        $desk = Desk::factory()->create(['type' => DeskType::Custom, 'owner_id' => $user->id, 'name' => 'My Desk']);
        $user->update(['default_desk_id' => $desk->id]);

        $menuItem = MenuItem::factory()->create(['primary_desk_id' => $desk->id, 'route_name' => 'todos.index']);
        $desk->menuItems()->attach($menuItem->id, ['order' => 0]);

        $response = $this->actingAs($user)
            ->withCookie('lang', 'en')
            ->get(route('dashboard'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->where('activeDesk.id', $desk->id)
            ->where('activeDesk.name', 'My Desk'));

        $props = $this->loadDeferredDeskProps($user);
        $this->assertCount(5, $props['menuItems']);
        $this->assertSame($menuItem->label, $props['menuItems'][1]['title']);
    }

    private function grantSelectPermission(User $user, string $model): void {
        $role = Role::create(['name' => 'role-' . uniqid()]);
        $user->roles()->attach($role->id);

        $permission = Permission::create([
            'name'        => 'Test Permission ' . uniqid(),
            'model'       => $model,
            'module'      => 'Test',
            'permissions' => [PermissionEnum::Select->value],
        ]);

        RolePermission::create([
            'role_id'       => $role->id,
            'permission_id' => $permission->id,
            'model'         => $model,
            'module'        => 'Test',
            'name'          => 'Test Permission',
            'level'         => 0,
            'only_creator'  => false,
            'permissions'   => [PermissionEnum::Select->value => true],
        ]);
    }

    /**
     * Perbaikan performa (ditemukan user via Clockwork, request Opportunities
     * ikut men-query Desk/MenuItem/DeskMenuItem/Branch/Permission yang gak
     * terkait): `deskList`/`menuItems` (ResolveActiveDesk) & `branchSettings`/
     * `ignorePermissionModels` (AppMiddleware) SEKARANG closure, bukan nilai
     * eager -- middleware ini eksekusi di SETIAP request terautentikasi (grup
     * route 'app','desk'), termasuk XHR groupPath expand & partial reload
     * DataTable2 yang tak pernah butuh prop ini. Dibuktikan lewat partial
     * reload Inertia SUNGGUHAN (header X-Inertia-Partial-Data TIDAK menyebut
     * menuItems/deskList/branchSettings/ignorePermissionModels) -- Inertia
     * (vendor, PropsResolver::shouldIncludeInPartialResponse()) skip manggil
     * closure prop yang tak diminta, jadi query di baliknya TERBUKTI tak
     * pernah jalan.
     */
    public function test_menu_tree_desk_list_and_branch_settings_not_queried_on_partial_reload_excluding_them(): void {
        $user = User::factory()->create();
        $desk = Desk::factory()->create(['type' => DeskType::Custom, 'owner_id' => $user->id]);
        $user->update(['default_desk_id' => $desk->id]);
        $menuItem = MenuItem::factory()->create(['primary_desk_id' => $desk->id, 'route_name' => 'todos.index']);
        $desk->menuItems()->attach($menuItem->id, ['order' => 0]);

        // `users.show` (bukan 'dashboard') -- DeskController::home() sendiri
        // query `menu_items` LAGI utk prop `allMenuItems` (tujuan lain, tak
        // terkait fix ini), jadi bukan target bersih utk buktikan "prop
        // TERTENTU tak diminta -> query di baliknya tak jalan".
        $response = $this->actingAs($user)
            ->withCookie('lang', 'en')
            ->withHeaders([
                'X-Inertia' => 'true',
                // Header versi WAJIB cocok, kalau tidak Inertia (vendor) balas
                // 409 (force full reload) SEBELUM request sempat jadi partial
                // sungguhan. Dihitung PERSIS spt Inertia\Middleware::version()
                // (vendor) -- Inertia::getVersion() sendiri tak andal dipanggil
                // SEBELUM request jalan (closure-nya baru di-resolve pertama
                // kali DALAM Middleware::handle()).
                'X-Inertia-Version' => file_exists(public_path('build/manifest.json'))
                    ? hash_file('xxh128', public_path('build/manifest.json'))
                    : '',
                'X-Inertia-Partial-Component' => 'Users/ManageUsers/Show',
                // Cuma minta prop 'user' -- BUKAN menuItems/deskList/
                // branchSettings/ignorePermissionModels.
                'X-Inertia-Partial-Data' => 'user',
            ]);

        DB::enableQueryLog();
        $response = $response->get(route('users.show', $user));
        $queries  = collect(DB::getQueryLog())->pluck('query')->implode(' | ');
        DB::disableQueryLog();

        $response->assertOk();
        // `desk_menu_items` HANYA di-query buildMenuTree() (menuItems) -- sinyal
        // presisi, beda dari `menu_items` (kolom generik, dipakai banyak fitur
        // lain di luar sidebar).
        $this->assertStringNotContainsStringIgnoringCase('desk_menu_items', $queries);
        $this->assertStringNotContainsStringIgnoringCase('"branches"', $queries);
        $this->assertStringNotContainsStringIgnoringCase('ignore_permission', $queries);
    }

    /**
     * Sisi lain fix yang sama: reload PENUH (bukan partial) TETAP dapat
     * menuItems/deskList/branchSettings seperti sebelumnya -- closure
     * cuma menunda eksekusi, bukan menghilangkan prop-nya utk kasus yang
     * genuinely butuh.
     */
    public function test_menu_tree_and_desk_list_still_present_on_full_reload(): void {
        $user = User::factory()->create();
        $desk = Desk::factory()->create(['type' => DeskType::Custom, 'owner_id' => $user->id, 'name' => 'My Desk']);
        $user->update(['default_desk_id' => $desk->id]);
        $menuItem = MenuItem::factory()->create(['primary_desk_id' => $desk->id, 'route_name' => 'todos.index']);
        $desk->menuItems()->attach($menuItem->id, ['order' => 0]);

        $response = $this->actingAs($user)
            ->withCookie('lang', 'en')
            ->get(route('dashboard'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->where('activeDesk.id', $desk->id)
            ->has('branchSettings')
            ->has('ignorePermissionModels'));

        $props = $this->loadDeferredDeskProps($user);
        $this->assertCount(5, $props['menuItems']);
        $this->assertCount(1, $props['deskList']);
    }

    public function test_active_desk_switches_when_route_not_registered_on_cookie_desk(): void {
        // Skenario dilaporkan user: cookie active_desk menunjuk desk "Service",
        // request masuk ke route yang MenuItem-nya cuma terdaftar di desk lain
        // ("Purchase") — resolusi harus pindah, bukan bertahan di desk cookie.
        $user = User::factory()->create();
        $this->grantSelectPermission($user, PurchaseRequest::class);

        $serviceDesk  = Desk::factory()->create(['type' => DeskType::Custom, 'owner_id' => $user->id]);
        $purchaseDesk = Desk::factory()->create(['type' => DeskType::Custom, 'owner_id' => $user->id, 'name' => 'Purchase']);

        $dashboardMenuItem = MenuItem::factory()->create(['primary_desk_id' => $serviceDesk->id, 'route_name' => 'dashboard']);
        $serviceDesk->menuItems()->attach($dashboardMenuItem->id, ['order' => 0]);

        $purchaseMenuItem = MenuItem::factory()->create(['primary_desk_id' => $purchaseDesk->id, 'route_name' => 'purchaseRequests.index']);
        $purchaseDesk->menuItems()->attach($purchaseMenuItem->id, ['order' => 0]);

        $response = $this->actingAs($user)
            ->withCookie('lang', 'en')
            ->withCookie('active_desk', $serviceDesk->id)
            ->get(route('purchaseRequests.index'));

        $response->assertOk();
        $response->assertCookie('active_desk', $purchaseDesk->id);
        $response->assertInertia(fn ($page) => $page->where('activeDesk.id', $purchaseDesk->id));
    }

    public function test_menu_item_with_unresolvable_route_name_is_skipped_without_failing(): void {
        $user = User::factory()->create();
        $desk = Desk::factory()->create(['type' => DeskType::Custom, 'owner_id' => $user->id]);
        $user->update(['default_desk_id' => $desk->id]);

        $broken = MenuItem::factory()->create([
            'primary_desk_id' => $desk->id,
            'route_name'      => 'route.that.does.not.exist',
        ]);
        $desk->menuItems()->attach($broken->id, ['order' => 0]);

        $response = $this->actingAs($user)
            ->withCookie('lang', 'en')
            ->get(route('dashboard'));

        $response->assertOk();
        // 4 item wajib (Dashboard/Approvals/ToDo/Manual Book) tetap tampil
        // walau satu-satunya menu custom desk ini broken & ke-drop.
        $props = $this->loadDeferredDeskProps($user);
        $this->assertCount(4, $props['menuItems']);
    }

    /**
     * Feedback user: grup jangan dipakai kalau cuma 1 item — tapi keanggotaan
     * grup itu per-desk (parent MenuItem yang sama bisa attach ke beberapa
     * desk dengan saudara yang beda2 tiap desk). Di sini parent group
     * ("Test Group") punya 1 child yang di-attach ke desk custom ini —
     * harus render FLAT (title = child, bukan title grup, tanpa nested items).
     */
    public function test_group_with_single_attached_child_is_unwrapped_to_flat_item(): void {
        $user = User::factory()->create();
        $desk = Desk::factory()->create(['type' => DeskType::Custom, 'owner_id' => $user->id]);
        $user->update(['default_desk_id' => $desk->id]);

        $group = MenuItem::factory()->create(['primary_desk_id' => $desk->id, 'route_name' => '_group.test-group', 'label' => 'Test Group']);
        $child = MenuItem::factory()->create(['primary_desk_id' => $desk->id, 'route_name' => 'todos.index', 'label' => 'Only Child', 'parent_id' => $group->id]);
        $desk->menuItems()->attach($child->id, ['order' => 0]);

        $response = $this->actingAs($user)
            ->withCookie('lang', 'en')
            ->get(route('dashboard'));

        $response->assertOk();
        $props = $this->loadDeferredDeskProps($user);
        $this->assertCount(5, $props['menuItems']);
        $this->assertSame('Only Child', $props['menuItems'][1]['title']);
        $this->assertNull($props['menuItems'][1]['items']);
    }

    /**
     * Bug ditemukan: ResolveActiveDesk::handle() sengaja tidak fatal saat
     * user tanpa Desk visible (lanjut $next($request) tanpa set
     * 'resolvedDesk') — tapi DeskController::home() dulu abort_unless(404)
     * langsung, jadi niat "proceed tanpa konteks Desk" itu dead-end 404
     * khusus di route 'dashboard'. Sekarang redirect ke desks.index (jalan
     * keluar yang sama dgn bypass prefix desk./desks. di middleware).
     */
    /**
     * Bug dilaporkan user: klik "Manage Account" (dropdown avatar, buka
     * users.show milik diri sendiri) memicu pindah Desk ke Desk pemilik
     * menu "Manage Users" (route_name "users.*"), padahal user tidak
     * bermaksud navigasi ke fitur itu.
     */
    public function test_viewing_own_profile_does_not_switch_active_desk(): void {
        $user = User::factory()->create();
        $this->grantSelectPermission($user, User::class);

        $currentDesk = Desk::factory()->create(['type' => DeskType::Custom, 'owner_id' => $user->id]);
        $usersDesk   = Desk::factory()->create(['type' => DeskType::Custom, 'owner_id' => $user->id, 'name' => 'User Admin']);

        $manageUsersMenuItem = MenuItem::factory()->create(['primary_desk_id' => $usersDesk->id, 'route_name' => 'users.*']);
        $usersDesk->menuItems()->attach($manageUsersMenuItem->id, ['order' => 0]);

        $response = $this->actingAs($user)
            ->withCookie('lang', 'en')
            ->withCookie('active_desk', $currentDesk->id)
            ->get(route('users.show', $user));

        $response->assertOk();
        $response->assertCookie('active_desk', $currentDesk->id);
        $response->assertInertia(fn ($page) => $page->where('activeDesk.id', $currentDesk->id));
    }

    public function test_redirects_to_desks_index_when_user_has_no_visible_desk(): void {
        $user = User::factory()->create();

        $response = $this->actingAs($user)
            ->withCookie('lang', 'en')
            ->get(route('dashboard'));

        $response->assertRedirect(route('desks.index'));
    }

    /**
     * spec item-request-auto-detect (lanjutan diskusi user): MenuItem dengan
     * `visibility_permission` (any lintas PurchaseRequest/PurchaseOrder) HARUS
     * tetap tampil untuk user yang HANYA punya izin salah satu -- ini fix atas
     * bug: model=PurchaseRequest tunggal akan sembunyikan menu dari user yang
     * cuma punya izin PurchaseOrder, walau backend controller-nya sendiri
     * (ItemRequestController::requirePermissionToViewList()) mengizinkan.
     */
    private function makeItemRequestMenuItem(Desk $desk): MenuItem {
        return MenuItem::factory()->create([
            'primary_desk_id'       => $desk->id,
            'route_name'            => 'itemRequests.index',
            'model'                 => null,
            'visibility_permission' => [
                'any' => [
                    [PurchaseRequest::class, PermissionEnum::Select],
                    [PurchaseOrder::class, PermissionEnum::Select],
                ],
            ],
        ]);
    }

    public function test_visibility_permission_shows_menu_with_only_purchase_order_select(): void {
        $user = User::factory()->create();
        $this->grantSelectPermission($user, PurchaseOrder::class);

        $desk = Desk::factory()->create(['type' => DeskType::Custom, 'owner_id' => $user->id]);
        $user->update(['default_desk_id' => $desk->id]);
        $menuItem = $this->makeItemRequestMenuItem($desk);
        $desk->menuItems()->attach($menuItem->id, ['order' => 0]);

        $response = $this->actingAs($user)
            ->withCookie('lang', 'en')
            ->get(route('dashboard'));

        $response->assertOk();
        $props = $this->loadDeferredDeskProps($user);
        $this->assertSame($menuItem->label, $props['menuItems'][1]['title']);
    }

    public function test_visibility_permission_shows_menu_with_only_purchase_request_select(): void {
        $user = User::factory()->create();
        $this->grantSelectPermission($user, PurchaseRequest::class);

        $desk = Desk::factory()->create(['type' => DeskType::Custom, 'owner_id' => $user->id]);
        $user->update(['default_desk_id' => $desk->id]);
        $menuItem = $this->makeItemRequestMenuItem($desk);
        $desk->menuItems()->attach($menuItem->id, ['order' => 0]);

        $response = $this->actingAs($user)
            ->withCookie('lang', 'en')
            ->get(route('dashboard'));

        $response->assertOk();
        $props = $this->loadDeferredDeskProps($user);
        $this->assertSame($menuItem->label, $props['menuItems'][1]['title']);
    }

    public function test_visibility_permission_hides_menu_without_either_permission(): void {
        $user = User::factory()->create();

        $desk = Desk::factory()->create(['type' => DeskType::Custom, 'owner_id' => $user->id]);
        $user->update(['default_desk_id' => $desk->id]);
        $menuItem = $this->makeItemRequestMenuItem($desk);
        $desk->menuItems()->attach($menuItem->id, ['order' => 0]);

        $response = $this->actingAs($user)
            ->withCookie('lang', 'en')
            ->get(route('dashboard'));

        $response->assertOk();
        // 4 item wajib (Dashboard/Approvals/ToDo/Manual Book) saja -- menu
        // Item Request ke-drop karena visibility_permission tidak terpenuhi.
        $props = $this->loadDeferredDeskProps($user);
        $this->assertCount(4, $props['menuItems']);
    }

    /**
     * Satu kunjungan Inertia (navigasi antar halaman) ke dashboard. `$loadedOnceKeys`
     * meniru header X-Inertia-Except-Once-Props yang dikirim client untuk prop `once`
     * yang sudah dimuat di halaman sebelumnya.
     *
     * @param  list<string>  $loadedOnceKeys
     * @return array<string, mixed>
     */
    private function inertiaVisit(User $user, array $loadedOnceKeys = [], ?string $deskCookie = null): array {
        // withHeaders() menetap antar request dalam satu test; tanpa reset, GET HTML
        // di bawah ikut membawa X-Inertia dari kunjungan sebelumnya (jadi JSON).
        $this->flushHeaders();
        $initial = $this->actingAs($user)->withCookie('lang', 'en')->get(route('dashboard'));
        preg_match('#<script[^>]*type="application/json">(.*?)</script>#s', $initial->getContent(), $matches);
        $version = json_decode($matches[1], true, flags: JSON_THROW_ON_ERROR)['version'] ?? '';

        $request = $this->actingAs($user)->withCookie('lang', 'en');
        if ($deskCookie !== null) {
            $request = $request->withCookie('active_desk', $deskCookie);
        }

        return $request->withHeaders([
            'X-Inertia'         => 'true',
            'X-Inertia-Version' => $version,
            ...($loadedOnceKeys !== [] ? ['X-Inertia-Except-Once-Props' => implode(',', $loadedOnceKeys)] : []),
        ])->get(route('dashboard'))->assertOk()->json();
    }

    private function userWithDesk(string $name = 'My Desk'): array {
        $user = User::factory()->create();
        $desk = Desk::factory()->create(['type' => DeskType::Custom, 'owner_id' => $user->id, 'name' => $name]);
        $user->update(['default_desk_id' => $desk->id]);

        return [$user, $desk];
    }

    /**
     * deskList & menuItems langsung ada di respons (tanpa defer, jadi tanpa
     * skeleton/kedip), lengkap dgn metadata once.
     *
     * @param  array<string, mixed>  $page
     */
    private function assertDeskPropsInline(array $page): void {
        $this->assertArrayHasKey('deskList', $page['props']);
        $this->assertArrayHasKey('menuItems', $page['props']);
        $this->assertArrayNotHasKey('desk', $page['deferredProps'] ?? [], 'sidebar tak boleh ter-defer.');
    }

    /**
     * Pindah halaman di Desk yang sama tak boleh memuat ulang sidebar: deskList &
     * menuItems berupa once prop -- kunjungan pertama langsung membawa isinya,
     * kunjungan berikutnya dgn header Except-Once-Props TIDAK mengirim ulang
     * dan TIDAK menandainya deferred.
     */
    public function test_desk_props_are_not_reloaded_when_client_already_has_them(): void {
        [$user] = $this->userWithDesk();

        $first = $this->inertiaVisit($user);
        $this->assertDeskPropsInline($first);
        $this->assertArrayHasKey('onceProps', $first);
        // AppMiddleware juga membagikan once prop (permissions, dst); di sini hanya prop desk.
        foreach (['deskList', 'menuItems'] as $prop) {
            $keys = $this->keysOf($first, $prop);
            $this->assertCount(1, $keys, "metadata once untuk {$prop}");
            $this->assertNotNull($first['onceProps'][$keys[0]]['expiresAt'], 'once prop harus punya TTL (batas basi).');
        }

        $second = $this->inertiaVisit($user, array_keys($first['onceProps']));
        $this->assertArrayNotHasKey('desk', $second['deferredProps'] ?? []);
        $this->assertArrayNotHasKey('menuItems', $second['props']);
        $this->assertArrayNotHasKey('deskList', $second['props']);
        $this->assertSame(array_keys($first['onceProps']), array_keys($second['onceProps']));
    }

    public function test_desk_props_reload_when_active_desk_changes(): void {
        [$user, $deskA] = $this->userWithDesk('Desk A');
        $deskB          = Desk::factory()->create(['type' => DeskType::Custom, 'owner_id' => $user->id, 'name' => 'Desk B']);

        $inDeskA = $this->inertiaVisit($user, deskCookie: $deskA->id);

        // Pindah desk: menu desk baru langsung ada di respons yang sama (tanpa defer).
        $inDeskB = $this->inertiaVisit($user, array_keys($inDeskA['onceProps']), $deskB->id);
        $this->assertDeskPropsInline($inDeskB);
        $this->assertNotSame(array_keys($inDeskA['onceProps']), array_keys($inDeskB['onceProps']));
    }

    public function test_desk_props_reload_when_desk_is_modified(): void {
        [$user, $desk] = $this->userWithDesk();
        $before        = $this->inertiaVisit($user);

        Carbon::setTestNow($desk->fresh()->updated_at->copy()->addHour());
        $desk->touch();

        $after = $this->inertiaVisit($user, array_keys($before['onceProps']));
        $this->assertDeskPropsInline($after);
    }

    /**
     * Jumlah query ke tabel yang hanya dipakai resolusi desk/menu selama $callback.
     *
     * @param  callable(): mixed  $callback
     */
    private function countDeskQueries(callable $callback): int {
        DB::enableQueryLog();
        $callback();
        $count = collect(DB::getQueryLog())
            ->pluck('query')
            ->filter(fn (string $q) => (bool) preg_match('/(from|join) ["`](desks|menu_items|desk_menu_item|desk_assignables)["`]/i', $q))
            ->count();
        DB::disableQueryLog();

        return $count;
    }

    private function currentInertiaVersion(User $user): string {
        $this->flushHeaders();
        $initial = $this->actingAs($user)->withCookie('lang', 'en')->get(route('dashboard'));
        preg_match('#<script[^>]*type="application/json">(.*?)</script>#s', $initial->getContent(), $matches);

        return json_decode($matches[1], true, flags: JSON_THROW_ON_ERROR)['version'] ?? '';
    }

    /** Satu request reload parsial ke halaman users.show milik user itu sendiri. */
    private function partialVisit(User $user, string $version, string $component, string $only): TestResponse {
        return $this->actingAs($user)->withCookie('lang', 'en')->withHeaders([
            'X-Inertia'                   => 'true',
            'X-Inertia-Version'           => $version,
            'X-Inertia-Partial-Component' => $component,
            'X-Inertia-Partial-Data'      => $only,
        ])->get(route('users.show', $user));
    }

    /**
     * Reload parsial yang tak meminta prop desk (semua request deferred lain, reload
     * DataTable) tak perlu menentukan desk aktif -- tak boleh ada query desk/menu.
     */
    public function test_partial_reload_without_desk_props_does_not_resolve_desk(): void {
        [$user]  = $this->userWithDesk();
        $version = $this->currentInertiaVersion($user);

        $queries = $this->countDeskQueries(fn () => $this->partialVisit($user, $version, 'Users/ManageUsers/Show', 'user')->assertOk());

        $this->assertSame(0, $queries);
    }

    public function test_partial_reload_requesting_desk_props_still_resolves_them(): void {
        [$user, $desk] = $this->userWithDesk('Desk Parsial');
        $version       = $this->currentInertiaVersion($user);

        $json = $this->partialVisit($user, $version, 'Users/ManageUsers/Show', 'activeDesk,deskList,menuItems')->assertOk()->json('props');

        $this->assertSame($desk->id, $json['activeDesk']['id']);
        $this->assertCount(1, $json['deskList']);
        $this->assertCount(4, $json['menuItems']); // 4 item wajib; desk uji tanpa menu kustom
    }

    /**
     * Header parsial yang tak cocok dgn komponen yang dirender (mis. setelah redirect
     * yang diikuti browser) membuat Inertia merespons PENUH -- desk & menu harus tetap ada.
     */
    public function test_mismatched_partial_component_still_returns_desk_props(): void {
        [$user, $desk] = $this->userWithDesk();
        $version       = $this->currentInertiaVersion($user);

        $json = $this->partialVisit($user, $version, 'Komponen/Lain/Yang/Bukan/Ini', 'user')->assertOk()->json('props');

        $this->assertSame($desk->id, $json['activeDesk']['id']);
        $this->assertArrayHasKey('menuItems', $json);
    }

    /** XHR JSON yang tak merender halaman tak butuh desk sama sekali. */
    public function test_json_xhr_request_does_not_resolve_desk(): void {
        [$user] = $this->userWithDesk();
        $this->flushHeaders();

        // withCredentials(): request JSON tak mengirim cookie `lang` tanpanya, dan
        // middleware `lang` mengalihkan (302) sebelum middleware desk pernah jalan.
        $queries = $this->countDeskQueries(function () use ($user) {
            $response = $this->actingAs($user)->withCookie('lang', 'en')->withCredentials()
                ->postJson(route('dashboard.quickList'), []);
            $response->assertStatus(422);
        });

        $this->assertSame(0, $queries);
    }

    public function test_full_page_load_still_resolves_desk_and_sets_cookie(): void {
        [$user, $desk] = $this->userWithDesk();

        $this->flushHeaders();
        $response = $this->actingAs($user)->withCookie('lang', 'en')->get(route('dashboard'));

        $response->assertOk()->assertCookie('active_desk', $desk->id);
    }

    /**
     * updated_at hanya presisi detik: dua simpan menu dalam detik yang sama tak boleh
     * menghasilkan kunci yang sama (sidebar basi sampai TTL habis). Waktu dibekukan
     * dan atribut desk tak berubah, jadi yang membedakan hanya baris pivot menu.
     */
    public function test_menu_only_edits_in_the_same_second_each_change_the_sidebar_key(): void {
        Carbon::setTestNow(Carbon::parse('2026-10-10 10:00:00'));
        [$user, $desk] = $this->userWithDesk();
        $itemA         = MenuItem::factory()->create();
        $itemB         = MenuItem::factory()->create();
        $desk->menuItemPivots()->create(['menu_item_id' => $itemA->id, 'order' => 0]);

        $previous = $this->inertiaVisit($user);

        foreach ([$itemB, $itemA] as $item) {
            $this->actingAs($user)->withCookie('lang', 'en')->put(route('desks.update', $desk), [
                'name'       => $desk->name,
                'icon'       => $desk->icon,
                'menu_items' => [['menu_item_id' => $item->id]],
            ]);

            $next = $this->inertiaVisit($user, array_keys($previous['onceProps']));

            // Hanya menu yang berubah: menuItems ikut inline di respons yang sama.
            $this->assertArrayHasKey('menuItems', $next['props'], 'menu hasil edit harus langsung terkirim');
            $this->assertArrayNotHasKey('desk', $next['deferredProps'] ?? []);
            $this->assertNotSame($this->keysOf($previous, 'menuItems'), $this->keysOf($next, 'menuItems'));
            $previous = $next;
        }
    }

    /** @return list<string> kunci once milik satu prop */
    private function keysOf(array $page, string $prop): array {
        return array_values(array_filter(
            array_keys($page['onceProps'] ?? []),
            fn (string $key) => str_starts_with($key, $prop . ':'),
        ));
    }

    public function test_desk_props_reload_when_permissions_change(): void {
        [$user] = $this->userWithDesk();
        $before = $this->inertiaVisit($user);

        $this->grantSelectPermission($user, PurchaseRequest::class);

        $after = $this->inertiaVisit($user, array_keys($before['onceProps']));
        $this->assertDeskPropsInline($after);
    }
}
