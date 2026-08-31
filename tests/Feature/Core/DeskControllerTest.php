<?php

namespace Tests\Feature\Core;

use App\Enums\DeskType;
use App\Enums\Permission as PermissionEnum;
use App\Models\Core\Desk;
use App\Models\Core\DeskMenuItem;
use App\Models\Core\DeskUserPreference;
use App\Models\Core\MenuItem;
use App\Models\User\Permission;
use App\Models\User\Role;
use App\Models\User\RolePermission;
use App\Models\User\User;
use BeyondCode\QueryDetector\QueryDetectorMiddleware;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DeskControllerTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        $this->withoutMiddleware([
            QueryDetectorMiddleware::class,
        ]);
    }

    private function grantDeskCreatePermission(User $user): void {
        $this->grantDeskPermissions($user, [PermissionEnum::Create]);
    }

    /**
     * @param  PermissionEnum[]  $permissions
     */
    private function grantDeskPermissions(User $user, array $permissions): void {
        $role = Role::create(['name' => 'role-' . uniqid()]);
        $user->roles()->attach($role->id);

        $permission = Permission::create([
            'name'        => 'Manage Desk',
            'model'       => Desk::class,
            'module'      => 'Core',
            'permissions' => array_map(fn ($p) => $p->value, $permissions),
        ]);

        RolePermission::create([
            'role_id'       => $role->id,
            'permission_id' => $permission->id,
            'model'         => Desk::class,
            'module'        => 'Core',
            'name'          => 'Manage Desk',
            'level'         => 0,
            'only_creator'  => false,
            'permissions'   => collect($permissions)->mapWithKeys(fn ($p) => [$p->value => true])->all(),
        ]);
    }

    public function test_switch_updates_cookie_for_visible_desk(): void {
        $user = User::factory()->create();
        $desk = Desk::factory()->create(['type' => DeskType::Custom, 'owner_id' => $user->id]);

        $response = $this->actingAs($user)
            ->withCookie('lang', 'en')
            ->post(route('desk.switch'), ['desk_id' => $desk->id]);

        $response->assertCookie('active_desk', $desk->id);
    }

    public function test_switch_redirects_to_dashboard_when_current_page_not_registered_on_new_desk(): void {
        // Skenario dilaporkan user: sedang di halaman "purchaseRequests.index"
        // pada desk Purchase, pindah ke desk Service (yang tidak punya
        // MenuItem utk route itu) — harus di-redirect ke dashboard, bukan
        // tertinggal di halaman yang sudah tidak relevan.
        $user         = User::factory()->create();
        $serviceDesk  = Desk::factory()->create(['type' => DeskType::Custom, 'owner_id' => $user->id]);
        $purchaseDesk = Desk::factory()->create(['type' => DeskType::Custom, 'owner_id' => $user->id]);

        $menuItem = MenuItem::factory()->create([
            'primary_desk_id' => $purchaseDesk->id,
            'route_name'      => 'purchaseRequests.index',
        ]);
        $menuItem->desks()->attach($purchaseDesk->id);

        $refererUrl = route('purchaseRequests.index');

        $response = $this->actingAs($user)
            ->withCookie('lang', 'en')
            ->withHeader('referer', $refererUrl)
            ->post(route('desk.switch'), ['desk_id' => $serviceDesk->id]);

        $response->assertRedirect(route('dashboard'));
        $response->assertCookie('active_desk', $serviceDesk->id);
    }

    public function test_switch_stays_on_current_page_when_registered_on_new_desk(): void {
        $user         = User::factory()->create();
        $purchaseDesk = Desk::factory()->create(['type' => DeskType::Custom, 'owner_id' => $user->id]);

        $menuItem = MenuItem::factory()->create([
            'primary_desk_id' => $purchaseDesk->id,
            'route_name'      => 'purchaseRequests.index',
        ]);
        $menuItem->desks()->attach($purchaseDesk->id);

        $refererUrl = route('purchaseRequests.index');

        $response = $this->actingAs($user)
            ->withCookie('lang', 'en')
            ->withHeader('referer', $refererUrl)
            ->post(route('desk.switch'), ['desk_id' => $purchaseDesk->id]);

        $response->assertRedirect($refererUrl);
        $response->assertCookie('active_desk', $purchaseDesk->id);
    }

    public function test_switch_redirects_to_dashboard_when_redirect_to_dashboard_flag_set(): void {
        // Dipicu dari DeskList.jsx (halaman /desks) — asal klik SELALU /desks,
        // yang bukan MenuItem desk manapun, jadi TIDAK PERNAH relevan. FE
        // kirim redirect_to_dashboard=true supaya server langsung redirect()
        // ke dashboard tanpa menunggu SPA melakukan router.visit() tambahan
        // (dulu 2 request Inertia terpisah: POST switch + GET dashboard).
        $user         = User::factory()->create();
        $purchaseDesk = Desk::factory()->create(['type' => DeskType::Custom, 'owner_id' => $user->id]);

        $menuItem = MenuItem::factory()->create([
            'primary_desk_id' => $purchaseDesk->id,
            'route_name'      => 'purchaseRequests.index',
        ]);
        $menuItem->desks()->attach($purchaseDesk->id);

        // Referer sengaja diisi route YANG RELEVAN dengan desk tujuan — kalau
        // redirect_to_dashboard benar-benar skip currentPageIrrelevantToDesk(),
        // hasil TETAP redirect dashboard walau seharusnya "relevan" andai flag
        // tidak dikirim (lihat test_switch_stays_on_current_page_when_registered_on_new_desk).
        $refererUrl = route('purchaseRequests.index');

        $response = $this->actingAs($user)
            ->withCookie('lang', 'en')
            ->withHeader('referer', $refererUrl)
            ->post(route('desk.switch'), ['desk_id' => $purchaseDesk->id, 'redirect_to_dashboard' => true]);

        $response->assertRedirect(route('dashboard'));
        $response->assertCookie('active_desk', $purchaseDesk->id);
    }

    public function test_switch_redirects_to_dashboard_when_flag_set_without_referer(): void {
        // Skenario asli: klik desk dari /desks, tanpa header Referer sama
        // sekali (mis. dikirim langsung via fetch/XHR tanpa Referer, atau
        // browser strip Referer krn kebijakan privasi).
        $user = User::factory()->create();
        $desk = Desk::factory()->create(['type' => DeskType::Custom, 'owner_id' => $user->id]);

        $response = $this->actingAs($user)
            ->withCookie('lang', 'en')
            ->post(route('desk.switch'), ['desk_id' => $desk->id, 'redirect_to_dashboard' => true]);

        $response->assertRedirect(route('dashboard'));
        $response->assertCookie('active_desk', $desk->id);
    }

    public function test_switch_rejects_desk_not_visible_to_user(): void {
        $user      = User::factory()->create();
        $otherUser = User::factory()->create();
        $desk      = Desk::factory()->create(['type' => DeskType::Custom, 'owner_id' => $otherUser->id]);

        $response = $this->actingAs($user)
            ->withCookie('lang', 'en')
            ->post(route('desk.switch'), ['desk_id' => $desk->id]);

        $response->assertForbidden();
    }

    public function test_set_default_updates_user_default_desk_for_visible_desk(): void {
        $user = User::factory()->create();
        $desk = Desk::factory()->create(['type' => DeskType::Custom, 'owner_id' => $user->id]);

        $response = $this->actingAs($user)
            ->withCookie('lang', 'en')
            ->post(route('desk.setDefault', $desk));

        $response->assertRedirect();
        $this->assertSame($desk->id, $user->refresh()->default_desk_id);
    }

    public function test_set_default_rejects_desk_not_visible_to_user(): void {
        $user      = User::factory()->create();
        $otherUser = User::factory()->create();
        $desk      = Desk::factory()->create(['type' => DeskType::Custom, 'owner_id' => $otherUser->id]);

        $response = $this->actingAs($user)
            ->withCookie('lang', 'en')
            ->post(route('desk.setDefault', $desk));

        $response->assertForbidden();
        $this->assertNull($user->refresh()->default_desk_id);
    }

    public function test_user_without_permission_can_still_create_personal_desk(): void {
        $user = User::factory()->create();

        $response = $this->actingAs($user)
            ->withCookie('lang', 'en')
            ->post(route('desks.store'), [
                'name' => 'My Personal Desk',
                'icon' => 'LayoutDashboard',
            ]);

        $response->assertRedirect(route('desks.index'));
        $this->assertDatabaseHas('desks', [
            'name'     => 'My Personal Desk',
            'owner_id' => $user->id,
            'type'     => DeskType::Custom->value,
        ]);
    }

    public function test_user_without_permission_creates_desk_as_personal_with_self_assignable(): void {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->withCookie('lang', 'en')
            ->post(route('desks.store'), [
                'name' => 'Solo Desk',
                'icon' => 'LayoutDashboard',
            ]);

        $desk = Desk::where('name', 'Solo Desk')->firstOrFail();
        $this->assertTrue($desk->is_personal_only);
        $this->assertSame(1, $desk->assignables()->count());
        $this->assertTrue($desk->assignables()->where('assignable_type', 'user')->where('assignable_id', $user->id)->exists());
    }

    public function test_user_with_permission_can_create_shared_desk_with_assignables(): void {
        $user = User::factory()->create();
        $this->grantDeskCreatePermission($user);
        $role = Role::create(['name' => 'shared-role-' . uniqid()]);

        $this->actingAs($user)
            ->withCookie('lang', 'en')
            ->post(route('desks.store'), [
                'name'             => 'Team Desk',
                'icon'             => 'LayoutDashboard',
                'is_personal_only' => false,
                'assignables'      => [
                    ['assignable' => ['id' => $role->id, 'type' => 'role']],
                ],
            ]);

        $desk = Desk::where('name', 'Team Desk')->firstOrFail();
        $this->assertFalse($desk->is_personal_only);
        $this->assertTrue($desk->assignables()->where('assignable_type', 'role')->where('assignable_id', $role->id)->exists());
    }

    public function test_index_bypasses_permission_guard_for_user_without_any_desk_permission(): void {
        $user = User::factory()->create();

        $response = $this->actingAs($user)
            ->withCookie('lang', 'en')
            ->get(route('desks.index'));

        $response->assertOk();
    }

    public function test_index_shows_all_desks_for_user_with_select_permission(): void {
        $user = User::factory()->create();
        $this->grantDeskPermissions($user, [PermissionEnum::Select]);
        Desk::factory()->count(3)->create(['type' => DeskType::Custom]);

        $response = $this->actingAs($user)
            ->withCookie('lang', 'en')
            ->get(route('desks.index'));

        $response->assertInertia(fn ($page) => $page->has('desks', 3));
    }

    public function test_index_shows_only_visible_desks_for_user_without_select_permission(): void {
        $user = User::factory()->create();
        Desk::factory()->count(3)->create(['type' => DeskType::Custom]);
        $ownDesk = Desk::factory()->create(['type' => DeskType::Custom, 'owner_id' => $user->id]);

        $response = $this->actingAs($user)
            ->withCookie('lang', 'en')
            ->get(route('desks.index'));

        $response->assertInertia(fn ($page) => $page->has('desks', 1)
            ->where('desks.0.id', $ownDesk->id));
    }

    public function test_owner_can_show_own_custom_desk_without_formal_permission(): void {
        $user = User::factory()->create();
        $desk = Desk::factory()->create(['type' => DeskType::Custom, 'owner_id' => $user->id]);

        $response = $this->actingAs($user)
            ->withCookie('lang', 'en')
            ->get(route('desks.show', $desk));

        $response->assertOk();
    }

    public function test_stranger_without_permission_is_forbidden_from_showing_others_custom_desk(): void {
        $owner    = User::factory()->create();
        $stranger = User::factory()->create();
        $desk     = Desk::factory()->create(['type' => DeskType::Custom, 'owner_id' => $owner->id]);

        $response = $this->actingAs($stranger)
            ->withCookie('lang', 'en')
            ->get(route('desks.show', $desk));

        $response->assertForbidden();
    }

    public function test_user_with_select_permission_can_show_any_desk(): void {
        $user = User::factory()->create();
        $this->grantDeskPermissions($user, [PermissionEnum::Select, PermissionEnum::Read]);
        $desk = Desk::factory()->create(['type' => DeskType::Custom]);

        $response = $this->actingAs($user)
            ->withCookie('lang', 'en')
            ->get(route('desks.show', $desk));

        $response->assertOk();
    }

    public function test_owner_can_update_own_custom_desk_without_formal_permission(): void {
        $user = User::factory()->create();
        $desk = Desk::factory()->create(['type' => DeskType::Custom, 'owner_id' => $user->id]);

        $response = $this->actingAs($user)
            ->withCookie('lang', 'en')
            ->put(route('desks.update', $desk), ['name' => 'Renamed', 'icon' => $desk->icon]);

        $response->assertRedirect();
        $this->assertSame('Renamed', $desk->refresh()->name);
    }

    public function test_stranger_without_permission_is_forbidden_from_updating_others_custom_desk(): void {
        $owner    = User::factory()->create();
        $stranger = User::factory()->create();
        $desk     = Desk::factory()->create(['type' => DeskType::Custom, 'owner_id' => $owner->id]);

        $response = $this->actingAs($stranger)
            ->withCookie('lang', 'en')
            ->put(route('desks.update', $desk), ['name' => 'Hacked', 'icon' => $desk->icon]);

        $response->assertForbidden();
    }

    public function test_owner_can_destroy_own_custom_desk_without_formal_permission(): void {
        $user = User::factory()->create();
        $desk = Desk::factory()->create(['type' => DeskType::Custom, 'owner_id' => $user->id]);

        $response = $this->actingAs($user)
            ->withCookie('lang', 'en')
            ->delete(route('desks.destroy', $desk));

        $response->assertRedirect();
        $this->assertSoftDeleted($desk);
    }

    public function test_stranger_without_permission_is_forbidden_from_destroying_others_custom_desk(): void {
        $owner    = User::factory()->create();
        $stranger = User::factory()->create();
        $desk     = Desk::factory()->create(['type' => DeskType::Custom, 'owner_id' => $owner->id]);

        $response = $this->actingAs($stranger)
            ->withCookie('lang', 'en')
            ->delete(route('desks.destroy', $desk));

        $response->assertForbidden();
        $this->assertDatabaseHas('desks', ['id' => $desk->id, 'deleted_at' => null]);
    }

    public function test_user_with_delete_permission_can_destroy_any_custom_desk(): void {
        $user = User::factory()->create();
        $this->grantDeskPermissions($user, [PermissionEnum::Delete]);
        $desk = Desk::factory()->create(['type' => DeskType::Custom]);

        $response = $this->actingAs($user)
            ->withCookie('lang', 'en')
            ->delete(route('desks.destroy', $desk));

        $response->assertRedirect();
        $this->assertSoftDeleted($desk);
    }

    public function test_toggling_to_personal_wipes_shared_assignables_and_replaces_with_owner(): void {
        $user = User::factory()->create();
        $this->grantDeskPermissions($user, [PermissionEnum::Create, PermissionEnum::Write]);
        $role = Role::create(['name' => 'wiped-role-' . uniqid()]);
        $desk = Desk::factory()->create(['type' => DeskType::Custom, 'owner_id' => $user->id, 'is_personal_only' => false]);
        $desk->assignables()->create(['assignable_type' => 'role', 'assignable_id' => $role->id]);

        $this->actingAs($user)
            ->withCookie('lang', 'en')
            ->put(route('desks.update', $desk), [
                'name'             => $desk->name,
                'icon'             => $desk->icon,
                'is_personal_only' => true,
            ]);

        $desk->refresh();
        $this->assertTrue($desk->is_personal_only);
        $this->assertSame(1, $desk->assignables()->count());
        $this->assertTrue($desk->assignables()->where('assignable_type', 'user')->where('assignable_id', $user->id)->exists());
    }

    public function test_update_with_is_shared_all_wipes_specific_assignables(): void {
        $user = User::factory()->create();
        $this->grantDeskPermissions($user, [PermissionEnum::Create, PermissionEnum::Write]);
        $role = Role::create(['name' => 'wiped-role-' . uniqid()]);
        $desk = Desk::factory()->create(['type' => DeskType::Custom, 'owner_id' => $user->id, 'is_personal_only' => false]);
        $desk->assignables()->create(['assignable_type' => 'role', 'assignable_id' => $role->id]);

        $this->actingAs($user)
            ->withCookie('lang', 'en')
            ->put(route('desks.update', $desk), [
                'name'             => $desk->name,
                'icon'             => $desk->icon,
                'is_personal_only' => false,
                'is_shared_all'    => true,
            ]);

        $desk->refresh();
        $this->assertFalse($desk->is_personal_only);
        $this->assertTrue($desk->is_shared_all);
        $this->assertSame(0, $desk->assignables()->count());
    }

    public function test_update_disables_desk_when_write_permission_holder(): void {
        $user = User::factory()->create();
        $this->grantDeskPermissions($user, [PermissionEnum::Write]);
        $desk = Desk::factory()->create(['type' => DeskType::Custom]);

        $this->actingAs($user)
            ->withCookie('lang', 'en')
            ->put(route('desks.update', $desk), [
                'name'        => $desk->name,
                'icon'        => $desk->icon,
                'is_disabled' => true,
            ]);

        $this->assertTrue($desk->refresh()->is_disabled);
    }

    public function test_update_ignores_is_disabled_from_owner_without_write_permission(): void {
        $user = User::factory()->create();
        $desk = Desk::factory()->create(['type' => DeskType::Custom, 'owner_id' => $user->id]);

        $this->actingAs($user)
            ->withCookie('lang', 'en')
            ->put(route('desks.update', $desk), [
                'name'        => $desk->name,
                'icon'        => $desk->icon,
                'is_disabled' => true,
            ]);

        $this->assertFalse($desk->refresh()->is_disabled);
    }

    public function test_update_system_desk_ignores_personal_only_and_assignable_fields(): void {
        $user = User::factory()->create();
        $this->grantDeskPermissions($user, [PermissionEnum::Write]);
        $desk = Desk::factory()->create(['type' => DeskType::System]);

        $this->actingAs($user)
            ->withCookie('lang', 'en')
            ->put(route('desks.update', $desk), [
                'name'             => $desk->name,
                'icon'             => $desk->icon,
                'is_personal_only' => true,
            ]);

        $desk->refresh();
        $this->assertFalse($desk->is_personal_only);
        $this->assertSame(0, $desk->assignables()->count());
    }

    public function test_reorder_saves_per_user_preference_order(): void {
        $user  = User::factory()->create();
        $deskA = Desk::factory()->create(['type' => DeskType::Custom, 'owner_id' => $user->id]);
        $deskB = Desk::factory()->create(['type' => DeskType::Custom, 'owner_id' => $user->id]);

        $this->actingAs($user)
            ->withCookie('lang', 'en')
            ->post(route('desk.reorder'), [
                'desks' => [
                    ['id' => $deskB->id, 'is_hidden' => false],
                    ['id' => $deskA->id, 'is_hidden' => false],
                ],
            ]);

        $this->assertSame(0, DeskUserPreference::where('user_id', $user->id)->where('desk_id', $deskB->id)->value('order'));
        $this->assertSame(1, DeskUserPreference::where('user_id', $user->id)->where('desk_id', $deskA->id)->value('order'));
        // Desk::order (global fallback) TIDAK ikut berubah — preferensi murni per-user.
        $this->assertSame(0, $deskA->refresh()->order);
        $this->assertSame(0, $deskB->refresh()->order);
    }

    public function test_reorder_saves_is_hidden_preference(): void {
        $user = User::factory()->create();
        $desk = Desk::factory()->create(['type' => DeskType::Custom, 'owner_id' => $user->id]);

        $this->actingAs($user)
            ->withCookie('lang', 'en')
            ->post(route('desk.reorder'), [
                'desks' => [['id' => $desk->id, 'is_hidden' => true]],
            ]);

        $this->assertTrue(DeskUserPreference::where('user_id', $user->id)->where('desk_id', $desk->id)->value('is_hidden'));
    }

    public function test_reorder_ignores_desk_not_visible_to_user(): void {
        $user        = User::factory()->create();
        $otherUser   = User::factory()->create();
        $ownDesk     = Desk::factory()->create(['type' => DeskType::Custom, 'owner_id' => $user->id]);
        $foreignDesk = Desk::factory()->create(['type' => DeskType::Custom, 'owner_id' => $otherUser->id]);

        $this->actingAs($user)
            ->withCookie('lang', 'en')
            ->post(route('desk.reorder'), [
                'desks' => [
                    ['id' => $foreignDesk->id, 'is_hidden' => true],
                    ['id' => $ownDesk->id, 'is_hidden' => false],
                ],
            ]);

        $this->assertNull(DeskUserPreference::where('user_id', $user->id)->where('desk_id', $foreignDesk->id)->first());
        $this->assertNotNull(DeskUserPreference::where('user_id', $user->id)->where('desk_id', $ownDesk->id)->first());
    }

    public function test_index_hides_desk_marked_hidden_by_user_preference_but_still_includes_it_in_payload(): void {
        $user = User::factory()->create();
        $desk = Desk::factory()->create(['type' => DeskType::Custom, 'owner_id' => $user->id]);
        DeskUserPreference::create(['user_id' => $user->id, 'desk_id' => $desk->id, 'order' => 0, 'is_hidden' => true]);

        $response = $this->actingAs($user)
            ->withCookie('lang', 'en')
            ->get(route('desks.index'));

        $response->assertInertia(fn ($page) => $page
            ->where('desks.0.id', $desk->id)
            ->where('desks.0.isHidden', true));
    }

    public function test_update_saves_menu_item_with_virtual_group_and_nested_child(): void {
        $user     = User::factory()->create();
        $desk     = Desk::factory()->create(['type' => DeskType::Custom, 'owner_id' => $user->id]);
        $menuItem = MenuItem::factory()->create();

        $this->actingAs($user)
            ->withCookie('lang', 'en')
            ->put(route('desks.update', $desk), [
                'name'       => $desk->name,
                'icon'       => $desk->icon,
                'menu_items' => [
                    [
                        'label'    => 'Grup Custom',
                        'icon'     => 'FolderIcon',
                        'children' => [
                            ['menu_item_id' => $menuItem->id, 'icon' => 'CustomIcon'],
                        ],
                    ],
                ],
            ]);

        $parent = DeskMenuItem::where('desk_id', $desk->id)->whereNull('parent_id')->firstOrFail();
        $this->assertNull($parent->menu_item_id);
        $this->assertSame('Grup Custom', $parent->label);
        $this->assertSame('FolderIcon', $parent->icon);

        $child = DeskMenuItem::where('desk_id', $desk->id)->whereNotNull('parent_id')->firstOrFail();
        $this->assertSame($parent->id, $child->parent_id);
        $this->assertSame($menuItem->id, $child->menu_item_id);
        $this->assertSame('CustomIcon', $child->icon);
    }

    public function test_update_full_replaces_menu_items_on_resubmit(): void {
        $user      = User::factory()->create();
        $desk      = Desk::factory()->create(['type' => DeskType::Custom, 'owner_id' => $user->id]);
        $menuItemA = MenuItem::factory()->create();
        $menuItemB = MenuItem::factory()->create();

        $desk->menuItemPivots()->create(['menu_item_id' => $menuItemA->id, 'order' => 0]);

        $this->actingAs($user)
            ->withCookie('lang', 'en')
            ->put(route('desks.update', $desk), [
                'name'       => $desk->name,
                'icon'       => $desk->icon,
                'menu_items' => [
                    ['menu_item_id' => $menuItemB->id],
                ],
            ]);

        $pivots = DeskMenuItem::where('desk_id', $desk->id)->get();
        $this->assertCount(1, $pivots);
        $this->assertSame($menuItemB->id, $pivots->first()->menu_item_id);
    }

    public function test_update_rejects_child_as_virtual_group(): void {
        $user = User::factory()->create();
        $desk = Desk::factory()->create(['type' => DeskType::Custom, 'owner_id' => $user->id]);

        $response = $this->actingAs($user)
            ->withCookie('lang', 'en')
            ->put(route('desks.update', $desk), [
                'name'       => $desk->name,
                'icon'       => $desk->icon,
                'menu_items' => [
                    [
                        'label'    => 'Grup Custom',
                        'children' => [
                            ['label' => 'Anak Virtual Tidak Boleh'],
                        ],
                    ],
                ],
            ]);

        $response->assertSessionHasErrors('menu_items.0.children.0.menu_item_id');
    }

    public function test_show_returns_nested_menu_items_structure(): void {
        $user     = User::factory()->create();
        $desk     = Desk::factory()->create(['type' => DeskType::Custom, 'owner_id' => $user->id]);
        $menuItem = MenuItem::factory()->create(['label' => 'Item Asli']);

        $parent = $desk->menuItemPivots()->create(['label' => 'Grup Custom', 'icon' => 'FolderIcon', 'order' => 0]);
        $desk->menuItemPivots()->create([
            'menu_item_id' => $menuItem->id,
            'parent_id'    => $parent->id,
            'order'        => 0,
        ]);

        $response = $this->actingAs($user)
            ->withCookie('lang', 'en')
            ->get(route('desks.show', $desk));

        $response->assertInertia(fn ($page) => $page
            ->where('desk.menu_items.0.label', 'Grup Custom')
            ->where('desk.menu_items.0.children.0.label', 'Item Asli'));
    }
}
