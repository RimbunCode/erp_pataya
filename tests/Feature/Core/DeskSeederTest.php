<?php

namespace Tests\Feature\Core;

use App\Enums\DeskType;
use App\Models\Core\Desk;
use App\Models\Core\MenuItem;
use Database\Seeders\DeskSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

class DeskSeederTest extends TestCase {
    use RefreshDatabase;

    public function test_seeder_creates_ten_system_desks(): void {
        (new DeskSeeder)->run();

        $this->assertSame(10, Desk::where('type', DeskType::System->value)->count());
    }

    public function test_seeder_menu_items_have_resolvable_route_names(): void {
        (new DeskSeeder)->run();

        $registeredRouteNames = collect(Route::getRoutes())
            ->map(fn ($route) => $route->getName())
            ->filter()
            ->unique()
            ->all();

        $unresolvable = [];
        foreach (MenuItem::all() as $menuItem) {
            $routeName = $menuItem->route_name;

            // Wildcard (mis. "users.*") — Requirement 4 AC 4: valid selama ADA
            // minimal satu route terdaftar yang cocok pola-nya (fnmatch),
            // bukan literal route name yang bisa langsung di-resolve route().
            if (\str_contains($routeName, '*')) {
                $matches = \array_filter($registeredRouteNames, fn ($name) => \fnmatch($routeName, $name));
                if (empty($matches)) {
                    $unresolvable[] = $routeName;
                }

                continue;
            }

            try {
                route($routeName);
            } catch (\Throwable $e) {
                $unresolvable[] = $routeName;
            }
        }

        $this->assertEmpty($unresolvable, 'route_name tidak resolvable: ' . implode(', ', $unresolvable));
    }

    public function test_seeder_is_idempotent_when_run_twice(): void {
        (new DeskSeeder)->run();
        $firstDeskCount     = Desk::count();
        $firstMenuItemCount = MenuItem::count();

        (new DeskSeeder)->run();

        $this->assertSame($firstDeskCount, Desk::count());
        $this->assertSame($firstMenuItemCount, MenuItem::count());
    }

    public function test_item_menu_is_assigned_to_both_sales_and_inventory_desk(): void {
        (new DeskSeeder)->run();

        $itemMenu    = MenuItem::where('route_name', 'items.*')->firstOrFail();
        $deskDomains = $itemMenu->desks()->pluck('domain')->map(fn ($d) => $d->value)->all();

        $this->assertContains('sales', $deskDomains);
        $this->assertContains('inventory', $deskDomains);
    }
}
