<?php

namespace Tests\Feature\Core;

use App\Enums\DeskType;
use App\Enums\Permission as PermissionEnum;
use App\Models\Core\Desk;
use App\Models\Core\MenuItem;
use App\Models\Purchase\PurchaseRequest;
use App\Models\User\Permission;
use App\Models\User\Role;
use App\Models\User\RolePermission;
use App\Models\User\User;
use BeyondCode\QueryDetector\QueryDetectorMiddleware;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ResolveActiveDeskTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        $this->withoutMiddleware([
            QueryDetectorMiddleware::class,
        ]);
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
        $response->assertInertia(
            fn ($page) => $page
                ->where('activeDesk.id', $desk->id)
                ->where('activeDesk.name', 'My Desk')
                ->has('deskList')
                ->has('menuItems', 5)
                ->where('menuItems.0.title', 'Dashboard')
                ->where('menuItems.1.title', $menuItem->label)
                ->where('menuItems.2.title', 'Approvals')
                ->where('menuItems.3.title', 'ToDo')
                ->where('menuItems.4.title', 'Manual Book'),
        );
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
        $response->assertInertia(fn ($page) => $page->has('menuItems', 4));
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
        $response->assertInertia(
            fn ($page) => $page
                ->has('menuItems', 5)
                ->where('menuItems.1.title', 'Only Child')
                ->where('menuItems.1.items', null),
        );
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
}
