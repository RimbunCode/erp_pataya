<?php

namespace Tests\Feature\Core;

use App\Enums\DeskType;
use App\Enums\Permission as PermissionEnum;
use App\Models\Core\Desk;
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
        $role = Role::create(['name' => 'role-' . uniqid()]);
        $user->roles()->attach($role->id);

        $permission = Permission::create([
            'name'        => 'Manage Desk',
            'model'       => Desk::class,
            'module'      => 'Core',
            'permissions' => [PermissionEnum::Create->value],
        ]);

        RolePermission::create([
            'role_id'       => $role->id,
            'permission_id' => $permission->id,
            'model'         => Desk::class,
            'module'        => 'Core',
            'name'          => 'Manage Desk',
            'level'         => 0,
            'only_creator'  => false,
            'permissions'   => [PermissionEnum::Create->value => true],
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

    public function test_user_without_desk_create_permission_is_forbidden_from_role_scoped_assignment(): void {
        $user = User::factory()->create();
        $desk = Desk::factory()->create(['type' => DeskType::Custom, 'owner_id' => $user->id]);
        $role = Role::create(['name' => 'target-role-' . uniqid()]);

        $response = $this->actingAs($user)
            ->withCookie('lang', 'en')
            ->post(route('desk.roles.store', $desk), ['role_id' => $role->id]);

        $response->assertForbidden();
        $this->assertFalse($desk->roles()->where('roles.id', $role->id)->exists());
    }

    public function test_user_with_desk_create_permission_can_assign_role_scoped_desk(): void {
        $user = User::factory()->create();
        $this->grantDeskCreatePermission($user);
        $desk = Desk::factory()->create(['type' => DeskType::Custom, 'owner_id' => $user->id]);
        $role = Role::create(['name' => 'target-role-' . uniqid()]);

        $response = $this->actingAs($user)
            ->withCookie('lang', 'en')
            ->post(route('desk.roles.store', $desk), ['role_id' => $role->id]);

        $response->assertRedirect();
        $this->assertTrue($desk->roles()->where('roles.id', $role->id)->exists());
    }
}
