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
use App\Services\Core\Desk\DeskResolverService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Routing\Route;
use Tests\TestCase;

class DeskResolverServiceTest extends TestCase {
    use RefreshDatabase;

    private DeskResolverService $resolver;

    protected function setUp(): void {
        parent::setUp();
        $this->resolver = new DeskResolverService;
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

    private function requestWithCookie(?string $deskId = null, ?string $routeName = null): Request {
        $request = Request::create('/');
        if ($deskId) {
            $request->cookies->set('active_desk', $deskId);
        }
        if ($routeName) {
            $route = new Route('GET', '/', []);
            $route->name($routeName);
            $request->setRouteResolver(fn () => $route);
        }

        return $request;
    }

    public function test_resolve_uses_cookie_when_valid_and_visible(): void {
        $user = User::factory()->create();
        $this->grantSelectPermission($user, 'App\\Models\\Test\\Foo');

        $desk = Desk::factory()->create(['type' => DeskType::System]);
        MenuItem::factory()->create([
            'primary_desk_id' => $desk->id,
            'model'           => 'App\\Models\\Test\\Foo',
        ])->desks()->attach($desk->id);

        $otherDesk = Desk::factory()->create(['type' => DeskType::Custom, 'owner_id' => $user->id]);

        $request = $this->requestWithCookie($desk->id);

        $resolved = $this->resolver->resolve($request, $user);

        $this->assertSame($desk->id, $resolved->id);
    }

    public function test_resolve_falls_back_to_user_default_when_cookie_invalid(): void {
        $user        = User::factory()->create();
        $defaultDesk = Desk::factory()->create(['type' => DeskType::Custom, 'owner_id' => $user->id]);
        $user->update(['default_desk_id' => $defaultDesk->id]);

        $request = $this->requestWithCookie('nonexistent-cookie-value');

        $resolved = $this->resolver->resolve($request, $user);

        $this->assertSame($defaultDesk->id, $resolved->id);
    }

    public function test_resolve_ignores_cookie_when_route_not_registered_on_that_desk(): void {
        // Skenario dilaporkan user: desk aktif "Service" (cookie), akses route
        // yang MenuItem-nya cuma terdaftar di desk "Purchase" — resolusi HARUS
        // pindah ke desk Purchase, bukan bertahan di desk Service.
        $user = User::factory()->create();

        $serviceDesk  = Desk::factory()->create(['type' => DeskType::Custom, 'owner_id' => $user->id]);
        $purchaseDesk = Desk::factory()->create(['type' => DeskType::Custom, 'owner_id' => $user->id]);

        $menuItem = MenuItem::factory()->create([
            'primary_desk_id' => $purchaseDesk->id,
            'route_name'      => 'purchaseRequests.index',
        ]);
        $menuItem->desks()->attach($purchaseDesk->id);

        $request = $this->requestWithCookie($serviceDesk->id, 'purchaseRequests.index');

        $resolved = $this->resolver->resolve($request, $user);

        $this->assertSame($purchaseDesk->id, $resolved->id);
    }

    public function test_resolve_keeps_cookie_when_route_is_registered_on_that_desk(): void {
        $user = User::factory()->create();
        $desk = Desk::factory()->create(['type' => DeskType::Custom, 'owner_id' => $user->id]);

        $menuItem = MenuItem::factory()->create([
            'primary_desk_id' => $desk->id,
            'route_name'      => 'purchaseRequests.index',
        ]);
        $menuItem->desks()->attach($desk->id);

        $request = $this->requestWithCookie($desk->id, 'purchaseRequests.index');

        $resolved = $this->resolver->resolve($request, $user);

        $this->assertSame($desk->id, $resolved->id);
    }

    public function test_resolve_keeps_cookie_when_route_is_not_registered_as_any_menu_item(): void {
        $user = User::factory()->create();
        $desk = Desk::factory()->create(['type' => DeskType::Custom, 'owner_id' => $user->id]);

        // route saat ini tidak punya MenuItem sama sekali (halaman generik)
        $request = $this->requestWithCookie($desk->id, 'some.generic.route');

        $resolved = $this->resolver->resolve($request, $user);

        $this->assertSame($desk->id, $resolved->id);
    }

    public function test_resolve_falls_back_to_route_name_when_no_cookie_or_default(): void {
        $user = User::factory()->create();
        $desk = Desk::factory()->create(['type' => DeskType::Custom, 'owner_id' => $user->id]);
        MenuItem::factory()->create([
            'primary_desk_id' => $desk->id,
            'route_name'      => 'items.index',
        ]);

        $request = $this->requestWithCookie(null, 'items.index');

        $resolved = $this->resolver->resolve($request, $user);

        $this->assertSame($desk->id, $resolved->id);
    }

    public function test_resolve_falls_back_to_first_visible_when_nothing_else_matches(): void {
        $user = User::factory()->create();
        $desk = Desk::factory()->create(['type' => DeskType::Custom, 'owner_id' => $user->id]);

        $request = $this->requestWithCookie(null, 'unregistered.route');

        $resolved = $this->resolver->resolve($request, $user);

        $this->assertSame($desk->id, $resolved->id);
    }

    public function test_resolve_throws_when_user_has_no_visible_desk(): void {
        $user = User::factory()->create();
        Desk::factory()->create(['type' => DeskType::System]);

        $request = $this->requestWithCookie();

        $this->expectException(\RuntimeException::class);
        $this->resolver->resolve($request, $user);
    }

    public function test_resolve_is_idempotent_for_same_state(): void {
        $user = User::factory()->create();
        $desk = Desk::factory()->create(['type' => DeskType::Custom, 'owner_id' => $user->id]);

        $request = $this->requestWithCookie($desk->id);

        $first  = $this->resolver->resolve($request, $user);
        $second = $this->resolver->resolve($request, $user);

        $this->assertSame($first->id, $second->id);
    }

    public function test_visible_desks_for_system_desk_requires_permission_on_menu_item_model(): void {
        $userWithPermission    = User::factory()->create();
        $userWithoutPermission = User::factory()->create();
        $this->grantSelectPermission($userWithPermission, 'App\\Models\\Test\\Bar');

        $desk     = Desk::factory()->create(['type' => DeskType::System]);
        $menuItem = MenuItem::factory()->create([
            'primary_desk_id' => $desk->id,
            'model'           => 'App\\Models\\Test\\Bar',
        ]);
        $desk->menuItems()->attach($menuItem->id, ['order' => 0]);

        $this->assertTrue($this->resolver->visibleDesksFor($userWithPermission)->contains('id', $desk->id));
        $this->assertFalse($this->resolver->visibleDesksFor($userWithoutPermission)->contains('id', $desk->id));
    }

    public function test_visible_desks_for_custom_personal_only_visible_to_owner(): void {
        $owner    = User::factory()->create();
        $stranger = User::factory()->create();
        $desk     = Desk::factory()->create(['type' => DeskType::Custom, 'owner_id' => $owner->id]);

        $this->assertTrue($this->resolver->visibleDesksFor($owner)->contains('id', $desk->id));
        $this->assertFalse($this->resolver->visibleDesksFor($stranger)->contains('id', $desk->id));
    }

    public function test_visible_desks_for_custom_role_scoped_visible_to_role_members(): void {
        $member    = User::factory()->create();
        $nonMember = User::factory()->create();
        $role      = Role::create(['name' => 'desk-role-' . uniqid()]);
        $member->roles()->attach($role->id);

        $desk = Desk::factory()->create(['type' => DeskType::Custom]);
        $desk->assignables()->create(['assignable_type' => 'role', 'assignable_id' => $role->id]);

        $this->assertTrue($this->resolver->visibleDesksFor($member)->contains('id', $desk->id));
        $this->assertFalse($this->resolver->visibleDesksFor($nonMember)->contains('id', $desk->id));
    }

    public function test_visible_desks_for_custom_directly_assigned_to_user(): void {
        $assignedUser = User::factory()->create();
        $otherUser    = User::factory()->create();
        $desk         = Desk::factory()->create(['type' => DeskType::Custom]);
        $desk->assignables()->create(['assignable_type' => 'user', 'assignable_id' => $assignedUser->id]);

        $this->assertTrue($this->resolver->visibleDesksFor($assignedUser)->contains('id', $desk->id));
        $this->assertFalse($this->resolver->visibleDesksFor($otherUser)->contains('id', $desk->id));
    }

    public function test_visible_desks_for_custom_shared_all_visible_to_any_authenticated_user(): void {
        $anyUser = User::factory()->create();
        $desk    = Desk::factory()->create(['type' => DeskType::Custom, 'is_shared_all' => true]);

        $this->assertTrue($this->resolver->visibleDesksFor($anyUser)->contains('id', $desk->id));
    }

    public function test_visible_desks_excludes_disabled_desk_even_for_owner(): void {
        $owner = User::factory()->create();
        $desk  = Desk::factory()->create(['type' => DeskType::Custom, 'owner_id' => $owner->id, 'is_disabled' => true]);

        $this->assertFalse($this->resolver->visibleDesksFor($owner)->contains('id', $desk->id));
    }

    public function test_visible_desks_excludes_disabled_system_desk(): void {
        $user = User::factory()->create();
        $this->grantSelectPermission($user, 'App\\Models\\Test\\Foo');

        $desk     = Desk::factory()->create(['type' => DeskType::System, 'is_disabled' => true]);
        $menuItem = MenuItem::factory()->create([
            'primary_desk_id' => $desk->id,
            'model'           => 'App\\Models\\Test\\Foo',
        ]);
        $desk->menuItems()->attach($menuItem->id, ['order' => 0]);

        $this->assertFalse($this->resolver->visibleDesksFor($user)->contains('id', $desk->id));
    }

    public function test_deleting_desk_cascades_assignables(): void {
        $user = User::factory()->create();
        $desk = Desk::factory()->create(['type' => DeskType::Custom]);
        $desk->assignables()->create(['assignable_type' => 'user', 'assignable_id' => $user->id]);

        $desk->delete();

        $this->assertDatabaseMissing('desk_assignables', ['desk_id' => $desk->id]);
    }
}
