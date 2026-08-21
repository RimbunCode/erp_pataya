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

    public function test_middleware_shares_inertia_props(): void {
        $user = User::factory()->create();
        $desk = Desk::factory()->create(['type' => DeskType::Custom, 'owner_id' => $user->id, 'name' => 'My Desk']);
        $user->update(['default_desk_id' => $desk->id]);

        $menuItem = MenuItem::factory()->create(['primary_desk_id' => $desk->id, 'route_name' => 'dashboard']);
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
                ->has('menuItems', 1)
                ->where('menuItems.0.title', $menuItem->label),
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
        $response->assertInertia(fn ($page) => $page->has('menuItems', 0));
    }

    public function test_request_proceeds_without_desk_context_when_user_has_no_visible_desk(): void {
        $user = User::factory()->create();

        $response = $this->actingAs($user)
            ->withCookie('lang', 'en')
            ->get(route('dashboard'));

        $response->assertOk();
        $response->assertInertia(
            fn ($page) => $page
                ->missing('activeDesk')
                ->missing('deskList')
                ->missing('menuItems'),
        );
    }
}
