<?php

namespace Tests\Feature\Core;

use App\Models\Core\Desk;
use App\Models\Core\MenuItem;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MenuItemForRouteTest extends TestCase {
    use RefreshDatabase;

    public function test_exact_match_is_preferred_over_wildcard(): void {
        $desk = Desk::factory()->create();
        MenuItem::factory()->create(['primary_desk_id' => $desk->id, 'route_name' => 'users.*', 'label' => 'Wildcard']);
        $exact = MenuItem::factory()->create(['primary_desk_id' => $desk->id, 'route_name' => 'users.show', 'label' => 'Exact']);

        $resolved = MenuItem::forRoute('users.show');

        $this->assertSame($exact->id, $resolved->id);
    }

    public function test_wildcard_matches_route_not_registered_exactly(): void {
        $desk     = Desk::factory()->create();
        $menuItem = MenuItem::factory()->create(['primary_desk_id' => $desk->id, 'route_name' => 'users.*']);

        $resolved = MenuItem::forRoute('users.show');

        $this->assertSame($menuItem->id, $resolved->id);
    }

    public function test_wildcard_supports_nested_segments(): void {
        $desk     = Desk::factory()->create();
        $menuItem = MenuItem::factory()->create(['primary_desk_id' => $desk->id, 'route_name' => '*.categories.*']);

        $resolved = MenuItem::forRoute('inventory.categories.index');

        $this->assertSame($menuItem->id, $resolved->id);
    }

    public function test_most_specific_wildcard_wins_when_multiple_match(): void {
        $desk = Desk::factory()->create();
        MenuItem::factory()->create(['primary_desk_id' => $desk->id, 'route_name' => '*']);
        $specific = MenuItem::factory()->create(['primary_desk_id' => $desk->id, 'route_name' => 'users.*']);

        $resolved = MenuItem::forRoute('users.show');

        $this->assertSame($specific->id, $resolved->id);
    }

    public function test_returns_null_when_no_match_at_all(): void {
        $desk = Desk::factory()->create();
        MenuItem::factory()->create(['primary_desk_id' => $desk->id, 'route_name' => 'purchaseOrders.*']);

        $this->assertNull(MenuItem::forRoute('sales.show'));
    }
}
