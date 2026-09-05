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

    /** Feedback user: desk Migration dihapus (fitur migrasi data murni Artisan/backend, tanpa halaman web). */
    public function test_seeder_creates_nine_system_desks(): void {
        (new DeskSeeder)->run();

        $this->assertSame(9, Desk::where('type', DeskType::System->value)->count());
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

            // Folder murni pengelompokan "per Modul" (route_name sintetis
            // "_group.*", lihat DeskSeeder::menuGroup()) TIDAK PERNAH jadi
            // tujuan navigasi — tidak terdaftar di router BY DESIGN, bukan
            // bug. ResolveActiveDesk::resolveUrl() sudah toleran (catch +
            // log warning + url null) terhadap kasus ini.
            if (\str_starts_with($routeName, '_group.')) {
                continue;
            }

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

    /**
     * Feedback user: grup HANYA dibuat kalau ada kedekatan konsep nyata,
     * bukan "1 domain = 1 folder besar" — "Inventories" lama (10 item jadi
     * 1 folder) dipecah jadi "Item Master" (definisi produk) + "Stock &
     * Movements" (transaksi), Warehouses berdiri sendiri.
     */
    public function test_seeder_groups_menu_items_under_module_folders(): void {
        (new DeskSeeder)->run();

        $itemMasterGroup = MenuItem::where('route_name', '_group.item-master')->firstOrFail();

        $this->assertNull($itemMasterGroup->model);
        $this->assertNull($itemMasterGroup->parent_id);

        $itemMenu = MenuItem::where('route_name', 'items.*')->firstOrFail();
        $this->assertSame($itemMasterGroup->id, $itemMenu->parent_id);

        // Warehouses SENGAJA flat (beda konsep dari Item Master maupun
        // Stock & Movements) — tidak boleh punya parent_id.
        $warehousesMenu = MenuItem::where('route_name', 'warehouses.*')->firstOrFail();
        $this->assertNull($warehousesMenu->parent_id);

        // Section tunggal (hanya 1 item, mis. Tickets/Logs) SENGAJA tidak
        // diberi folder — memaksa grup utk anak tunggal cuma menambah 1
        // level klik tanpa manfaat pengelompokan nyata.
        $ticketsMenu = MenuItem::where('route_name', 'tickets.*')->firstOrFail();
        $this->assertNull($ticketsMenu->parent_id);

        // Feedback user: Suppliers/Customers keluar dari grup "Purchases"/
        // "Sales" — relasi vendor/pelanggan beda konsep dari dokumen
        // transaksi, sekaligus dipakai lintas desk (Finances).
        $suppliersMenu = MenuItem::where('route_name', 'suppliers.*')->firstOrFail();
        $this->assertNull($suppliersMenu->parent_id);

        $customersMenu = MenuItem::where('route_name', 'customers.*')->firstOrFail();
        $this->assertNull($customersMenu->parent_id);
    }

    /**
     * Feedback user: Suppliers juga relevan di desk Finances (konteks
     * pembayaran vendor); Assets/Maintenance Teams/Asset Maintenance juga
     * relevan di desk Service (aset yang sedang diservis).
     */
    public function test_seeder_assigns_cross_desk_menu_items_per_feedback(): void {
        (new DeskSeeder)->run();

        $supplierDomains = MenuItem::where('route_name', 'suppliers.*')->firstOrFail()
            ->desks()->pluck('domain')->map(fn ($d) => $d->value)->all();
        $this->assertContains('finances', $supplierDomains);
        $this->assertContains('purchase', $supplierDomains);

        foreach (['assets.*', 'assetMaintenanceTeams.*', 'assetMaintenances.*'] as $routeName) {
            $domains = MenuItem::where('route_name', $routeName)->firstOrFail()
                ->desks()->pluck('domain')->map(fn ($d) => $d->value)->all();
            $this->assertContains('service', $domains, "{$routeName} harus attach ke desk Service");
        }
    }
}
