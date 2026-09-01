<?php

namespace Tests\Feature\Core;

use App\Models\Core\Dashboard;
use App\Models\Core\Desk;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DeskDashboardTest extends TestCase {
    use RefreshDatabase;

    public function test_resolve_dashboard_creates_empty_dashboard_when_desk_has_none(): void {
        $desk = Desk::factory()->create(['name' => 'My Desk', 'dashboard_id' => null]);

        $dashboard = $desk->resolveDashboard();

        $this->assertInstanceOf(Dashboard::class, $dashboard);
        $this->assertSame($dashboard->id, $desk->refresh()->dashboard_id);
    }

    public function test_resolve_dashboard_does_not_duplicate_when_already_exists(): void {
        $existingDashboard = Dashboard::create(['title' => 'Existing Dashboard']);
        $desk              = Desk::factory()->create(['dashboard_id' => $existingDashboard->id]);

        $dashboard = $desk->resolveDashboard();

        $this->assertSame($existingDashboard->id, $dashboard->id);
        $this->assertSame(1, Dashboard::count());
    }
}
