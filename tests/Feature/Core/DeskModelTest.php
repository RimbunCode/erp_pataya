<?php

namespace Tests\Feature\Core;

use App\Enums\DeskType;
use App\Enums\Domain;
use App\Models\Core\Desk;
use App\Models\Core\MenuItem;
use App\Models\User\Role;
use App\Models\User\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DeskModelTest extends TestCase {
    use RefreshDatabase;

    public function test_menu_items_relation_returns_pivot_order_and_icon(): void {
        $desk  = Desk::factory()->create();
        $itemA = MenuItem::factory()->create(['primary_desk_id' => $desk->id]);
        $itemB = MenuItem::factory()->create(['primary_desk_id' => $desk->id]);

        $desk->menuItems()->attach($itemA->id, ['order' => 1, 'icon' => 'CustomIcon']);
        $desk->menuItems()->attach($itemB->id, ['order' => 0, 'icon' => null]);

        $ordered = $desk->menuItems()->get();

        $this->assertSame([$itemB->id, $itemA->id], $ordered->pluck('id')->all());
        $this->assertSame('CustomIcon', $ordered->firstWhere('id', $itemA->id)->pivot->icon);
        $this->assertNull($ordered->firstWhere('id', $itemB->id)->pivot->icon);
    }

    public function test_users_and_roles_relations_return_assigned_records(): void {
        $desk = Desk::factory()->create(['type' => DeskType::Custom]);
        $user = User::factory()->create();
        $role = Role::create(['name' => 'desk-role-test-' . uniqid()]);

        $desk->users()->attach($user->id);
        $desk->roles()->attach($role->id);

        $this->assertTrue($desk->users()->get()->contains('id', $user->id));
        $this->assertTrue($desk->roles()->get()->contains('id', $role->id));
    }

    public function test_deleting_desk_cascades_pivot_rows(): void {
        $desk     = Desk::factory()->create();
        $menuItem = MenuItem::factory()->create(['primary_desk_id' => Desk::factory()->create()->id]);
        $user     = User::factory()->create();
        $role     = Role::create(['name' => 'desk-role-cascade-' . uniqid()]);

        $desk->menuItems()->attach($menuItem->id, ['order' => 0]);
        $desk->users()->attach($user->id);
        $desk->roles()->attach($role->id);

        $desk->delete();

        $this->assertDatabaseMissing('desk_menu_item', ['desk_id' => $desk->id]);
        $this->assertDatabaseMissing('desk_user', ['desk_id' => $desk->id]);
        $this->assertDatabaseMissing('desk_role', ['desk_id' => $desk->id]);
    }

    public function test_deleting_desk_nulls_default_desk_id_for_users(): void {
        $desk = Desk::factory()->create();
        $user = User::factory()->create(['default_desk_id' => $desk->id]);

        $desk->delete();

        $this->assertNull($user->refresh()->default_desk_id);
    }

    public function test_deleting_desk_does_not_affect_other_users_default_desk(): void {
        $desk      = Desk::factory()->create();
        $otherDesk = Desk::factory()->create();
        $otherUser = User::factory()->create(['default_desk_id' => $otherDesk->id]);

        $desk->delete();

        $this->assertSame($otherDesk->id, $otherUser->refresh()->default_desk_id);
    }

    public function test_desk_domain_and_type_cast_to_enum(): void {
        $desk = Desk::factory()->create([
            'type'   => DeskType::System,
            'domain' => Domain::Sales,
        ]);

        $fresh = $desk->refresh();

        $this->assertSame(DeskType::System, $fresh->type);
        $this->assertSame(Domain::Sales, $fresh->domain);
    }
}
