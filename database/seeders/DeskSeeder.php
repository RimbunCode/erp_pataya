<?php

namespace Database\Seeders;

use App\Enums\DeskType;
use App\Enums\Domain;
use App\Models\Asset\Asset;
use App\Models\Asset\AssetCategory;
use App\Models\Asset\AssetLocation;
use App\Models\Asset\AssetMovement;
use App\Models\Asset\AssetService;
use App\Models\Asset\AssetValueAdjustment;
use App\Models\Asset\Maintenance\AssetMaintenance;
use App\Models\Asset\Maintenance\AssetMaintenanceTeam;
use App\Models\Core\ApprovalScheme;
use App\Models\Core\Branch;
use App\Models\Core\Country;
use App\Models\Core\Currency;
use App\Models\Core\Dashboard;
use App\Models\Core\Desk;
use App\Models\Core\EmailTemplate;
use App\Models\Core\File;
use App\Models\Core\FormatingSeries;
use App\Models\Core\Log;
use App\Models\Core\MenuItem;
use App\Models\Core\Preference;
use App\Models\Core\PrintTemplate;
use App\Models\Core\Widget;
use App\Models\Finances\Account;
use App\Models\Finances\GeneralLedger;
use App\Models\Finances\PaymentEntry;
use App\Models\Finances\PaymentMethod;
use App\Models\Finances\PaymentTermTemplate;
use App\Models\Finances\PurchaseInvoice;
use App\Models\Finances\SalesInvoice;
use App\Models\Finances\Tax;
use App\Models\Inventory\Attribute;
use App\Models\Inventory\Category;
use App\Models\Inventory\DeliveryNote;
use App\Models\Inventory\Item;
use App\Models\Inventory\ItemAlternative;
use App\Models\Inventory\StockEntry;
use App\Models\Inventory\StockLedgerEntry;
use App\Models\Inventory\Unit;
use App\Models\Inventory\Warehouse;
use App\Models\Purchase\PurchaseOrder;
use App\Models\Purchase\PurchaseReceipt;
use App\Models\Purchase\PurchaseRequest;
use App\Models\Purchase\Supplier;
use App\Models\Sales\Customer;
use App\Models\Sales\InternalOrder;
use App\Models\Sales\SalesOrder;
use App\Models\Service\WorkOrder;
use App\Models\User\Role;
use App\Models\User\User;
use Illuminate\Database\Seeder;

/**
 * Migrasi data `navList` (`resources/js/Components/Sidebar/AppSidebar.jsx`)
 * menjadi Desk system + MenuItem dinamis (Requirement 1.8). Setiap Desk
 * system dibuat satu per domain; MenuItem di-assign ke desk domain paling
 * relevan lewat pivot desk_menu_item, termasuk assignment lintas-desk untuk
 * fitur yang dipakai beberapa domain (mis. Item juga relevan di Sales).
 */
class DeskSeeder extends Seeder {
    private array $desks = [];

    /** @var array<string, MenuItem> folder murni (parent_id target), keyed by label */
    private array $menuGroups = [];

    public function run(): void {
        $this->createSystemDesks();
        $this->seedMenuItems();
    }

    private function createSystemDesks(): void {
        $defs = [
            Domain::Core->value      => ['domain' => Domain::Core, 'name' => 'Core', 'icon' => 'LayoutDashboard', 'background_color' => '#334155', 'foreground_color' => '#ffffff'],
            Domain::Sales->value     => ['domain' => Domain::Sales, 'name' => 'Sales', 'icon' => 'Receipt', 'background_color' => '#2563eb', 'foreground_color' => '#ffffff'],
            Domain::Purchase->value  => ['domain' => Domain::Purchase, 'name' => 'Purchase', 'icon' => 'ShoppingBagIcon', 'background_color' => '#d97706', 'foreground_color' => '#ffffff'],
            Domain::Inventory->value => ['domain' => Domain::Inventory, 'name' => 'Inventory', 'icon' => 'PackageIcon', 'background_color' => '#16a34a', 'foreground_color' => '#ffffff'],
            Domain::Asset->value     => ['domain' => Domain::Asset, 'name' => 'Asset', 'icon' => 'Boxes', 'background_color' => '#ea580c', 'foreground_color' => '#ffffff'],
            Domain::Finances->value  => ['domain' => Domain::Finances, 'name' => 'Finances', 'icon' => 'HandCoins', 'background_color' => '#059669', 'foreground_color' => '#ffffff'],
            Domain::Service->value   => ['domain' => Domain::Service, 'name' => 'Service', 'icon' => 'Wrench', 'background_color' => '#7c3aed', 'foreground_color' => '#ffffff'],
            Domain::Helpdesk->value  => ['domain' => Domain::Helpdesk, 'name' => 'Helpdesk', 'icon' => 'TicketsIcon', 'background_color' => '#e11d48', 'foreground_color' => '#ffffff'],
            Domain::User->value      => ['domain' => Domain::User, 'name' => 'User Management', 'icon' => 'Users2', 'background_color' => '#0891b2', 'foreground_color' => '#ffffff'],
            Domain::Migration->value => ['domain' => Domain::Migration, 'name' => 'Migration', 'icon' => 'HistoryIcon', 'background_color' => '#4b5563', 'foreground_color' => '#ffffff'],
        ];

        foreach ($defs as $domainValue => $attrs) {
            $this->desks[$domainValue] = Desk::firstOrCreate(
                ['domain' => $domainValue, 'type' => DeskType::System->value],
                $attrs + ['type' => DeskType::System],
            );
        }
    }

    private function desk(Domain $domain): Desk {
        return $this->desks[$domain->value];
    }

    /**
     * @param  Domain[]  $desks  desk pertama = primary_desk_id
     * @param  string|null  $urlOverride  URL LITERAL (path + query string apa adanya, mis.
     *                                    "/users/2/detail", "/salesOrders?status=open") untuk
     *                                    href sidebar — BUKAN nama route (itu tugas route_name/
     *                                    ResolveActiveDesk::resolveUrl()). Opsional, isi hanya
     *                                    kalau butuh tujuan spesifik yang tidak bisa direpresentasikan
     *                                    sebagai route+parameter biasa. Prioritas TERTINGGI: kalau
     *                                    diisi, dipakai langsung sebagai href, skip resolveUrl()
     *                                    sepenuhnya. Divalidasi format dasar saat seeding (harus
     *                                    absolute path diawali "/") — bukan divalidasi lewat route()
     *                                    karena memang bukan nama route.
     */
    private function menuItem(string $label, string $icon, string $routeName, ?string $model, array $desks, int $order = 0, ?string $urlOverride = null, ?string $group = null): void {
        $primary = $this->desk($desks[0]);

        if ($urlOverride !== null && ! \str_starts_with($urlOverride, '/')) {
            throw new \RuntimeException("DeskSeeder: url_override '{$urlOverride}' pada MenuItem '{$label}' harus absolute path diawali '/'.");
        }

        $menuItem = MenuItem::updateOrCreate(
            ['route_name' => $routeName],
            [
                'label'           => $label,
                'icon'            => $icon,
                'model'           => $model,
                'order'           => $order,
                'primary_desk_id' => $primary->id,
                'url_override'    => $urlOverride,
                'parent_id'       => $group ? $this->menuGroups[$group]->id : null,
            ],
        );

        foreach ($desks as $index => $domain) {
            $menuItem->desks()->syncWithoutDetaching([
                $this->desk($domain)->id => ['order' => $order],
            ]);
        }
    }

    /**
     * Folder murni pengelompokan MenuItem "per Modul" (mis. "Inventories",
     * "Settings") — route_name SINTETIS (tidak terdaftar di router, TIDAK
     * pernah di-resolve jadi href sungguhan), model selalu null (tidak
     * digate permission), TIDAK di-assign ke desk manapun via desks() (folder
     * ini bukan pilihan langsung di picker MenuItem — hanya jadi parent_id
     * target bagi child-nya lewat parameter $group pada menuItem()).
     */
    private function menuGroup(string $label, string $icon, Domain $domain): void {
        $this->menuGroups[$label] = MenuItem::updateOrCreate(
            ['route_name' => '_group.' . \str($label)->slug()],
            [
                'label'           => $label,
                'icon'            => $icon,
                'model'           => null,
                'order'           => 0,
                'primary_desk_id' => $this->desk($domain)->id,
            ],
        );
    }

    private function seedMenuItems(): void {
        // Folder murni pengelompokan "per Modul" (Requirement picker MenuItem
        // Desk) — dibuat SEBELUM child-nya karena menuItem() butuh
        // $this->menuGroups[$group] sudah terisi.
        $this->menuGroup('Inventories', 'PackageIcon', Domain::Inventory);
        $this->menuGroup('Assets', 'Boxes', Domain::Asset);
        $this->menuGroup('Purchases', 'ShoppingBagIcon', Domain::Purchase);
        $this->menuGroup('Sales', 'Receipt', Domain::Sales);
        $this->menuGroup('Finances', 'HandCoins', Domain::Finances);
        $this->menuGroup('Users', 'Users2', Domain::User);
        $this->menuGroup('Settings', 'Settings2', Domain::Core);

        // Dashboard — muncul di semua desk, primary Core
        $this->menuItem('Dashboard', 'LayoutDashboard', 'dashboard', null, [
            Domain::Core, Domain::Sales, Domain::Purchase, Domain::Inventory,
            Domain::Asset, Domain::Finances, Domain::Service, Domain::Helpdesk, Domain::User,
        ], 0);

        // Inventories — primary Inventory; Items/Warehouses juga relevan Sales & Purchase
        $this->menuItem('Items', 'PackageIcon', 'items.*', Item::class, [Domain::Inventory, Domain::Sales, Domain::Purchase], 1, group: 'Inventories');
        $this->menuItem('Item Alternatives', 'PackageIcon', 'itemAlternatives.*', ItemAlternative::class, [Domain::Inventory], 2, group: 'Inventories');
        $this->menuItem('Warehouses', 'PackageIcon', 'warehouses.*', Warehouse::class, [Domain::Inventory, Domain::Sales, Domain::Purchase], 3, group: 'Inventories');
        $this->menuItem('Attributes', 'PackageIcon', 'attributes.*', Attribute::class, [Domain::Inventory], 4, group: 'Inventories');
        $this->menuItem('Categories', 'PackageIcon', 'categories.*', Category::class, [Domain::Inventory], 5, group: 'Inventories');
        $this->menuItem('Units', 'PackageIcon', 'units.*', Unit::class, [Domain::Inventory], 6, group: 'Inventories');
        $this->menuItem('Stock Entries', 'PackageIcon', 'stockEntries.*', StockEntry::class, [Domain::Inventory], 7, group: 'Inventories');
        $this->menuItem('Purchase Receipts', 'PackageIcon', 'purchaseReceipts.*', PurchaseReceipt::class, [Domain::Purchase, Domain::Inventory], 8, group: 'Inventories');
        $this->menuItem('Delivery Notes', 'PackageIcon', 'deliveryNotes.*', DeliveryNote::class, [Domain::Inventory, Domain::Sales], 9, group: 'Inventories');
        $this->menuItem('Stock Ledgers', 'PackageIcon', 'stockLedgers.*', StockLedgerEntry::class, [Domain::Inventory], 10, group: 'Inventories');

        // Assets — primary Asset
        $this->menuItem('Assets', 'Boxes', 'assets.*', Asset::class, [Domain::Asset], 1, group: 'Assets');
        $this->menuItem('Asset Categories', 'Boxes', 'assetCategories.*', AssetCategory::class, [Domain::Asset], 2, group: 'Assets');
        $this->menuItem('Asset Locations', 'Boxes', 'assetLocations.*', AssetLocation::class, [Domain::Asset], 3, group: 'Assets');
        $this->menuItem('Asset Value Adjustments', 'Boxes', 'assetValueAdjustments.*', AssetValueAdjustment::class, [Domain::Asset], 4, group: 'Assets');
        $this->menuItem('Asset Movements', 'Boxes', 'assetMovements.*', AssetMovement::class, [Domain::Asset], 5, group: 'Assets');
        $this->menuItem('Maintenance Teams', 'Boxes', 'assetMaintenanceTeams.*', AssetMaintenanceTeam::class, [Domain::Asset], 6, group: 'Assets');
        $this->menuItem('Asset Maintenance', 'Boxes', 'assetMaintenances.*', AssetMaintenance::class, [Domain::Asset], 7, group: 'Assets');
        $this->menuItem('Asset Services', 'Boxes', 'assetServices.*', AssetService::class, [Domain::Asset, Domain::Service], 8, group: 'Assets');

        // Services — primary Service (section tunggal, tidak butuh folder)
        $this->menuItem('Work Orders', 'ServiceIcon', 'workOrders.*', WorkOrder::class, [Domain::Service], 1);

        // Purchases — primary Purchase
        $this->menuItem('Suppliers', 'ShoppingBagIcon', 'suppliers.*', Supplier::class, [Domain::Purchase], 1, group: 'Purchases');
        $this->menuItem('Purchase Requests', 'ShoppingBagIcon', 'purchaseRequests.*', PurchaseRequest::class, [Domain::Purchase], 2, group: 'Purchases');
        $this->menuItem('Purchase Orders', 'ShoppingBagIcon', 'purchaseOrders.*', PurchaseOrder::class, [Domain::Purchase], 3, group: 'Purchases');

        // Customers — primary Sales (dipakai juga di Finances utk invoicing context)
        $this->menuItem('Customers', 'CustomerIcon', 'customers.*', Customer::class, [Domain::Sales, Domain::Finances], 1, group: 'Sales');

        // Sales — primary Sales
        $this->menuItem('Sales Orders', 'Receipt', 'salesOrders.*', SalesOrder::class, [Domain::Sales], 2, group: 'Sales');
        $this->menuItem('Internal Orders', 'Receipt', 'internalOrders.*', InternalOrder::class, [Domain::Sales], 3, group: 'Sales');

        // Finances — primary Finances
        $this->menuItem('Accounts', 'HandCoins', 'accounts.*', Account::class, [Domain::Finances], 1, group: 'Finances');
        $this->menuItem('Payment Methods', 'HandCoins', 'paymentMethods.*', PaymentMethod::class, [Domain::Finances], 2, group: 'Finances');
        $this->menuItem('Payment Term Templates', 'HandCoins', 'paymentTermTemplates.*', PaymentTermTemplate::class, [Domain::Finances], 3, group: 'Finances');
        $this->menuItem('Payment Entries', 'HandCoins', 'paymentEntries.*', PaymentEntry::class, [Domain::Finances], 4, group: 'Finances');
        $this->menuItem('Purchase Invoices', 'HandCoins', 'purchaseInvoices.*', PurchaseInvoice::class, [Domain::Finances, Domain::Purchase], 5, group: 'Finances');
        $this->menuItem('Sales Invoices', 'HandCoins', 'salesInvoices.*', SalesInvoice::class, [Domain::Finances, Domain::Sales], 6, group: 'Finances');
        $this->menuItem('Taxes', 'HandCoins', 'taxes.*', Tax::class, [Domain::Finances], 7, group: 'Finances');
        $this->menuItem('General Ledgers', 'HandCoins', 'generalLedgers.*', GeneralLedger::class, [Domain::Finances], 8, group: 'Finances');

        // Approvals — muncul di semua desk (proses lintas-domain), primary Core
        $this->menuItem('Approvals', 'StampIcon', 'approvalInstances.*', null, [
            Domain::Core, Domain::Sales, Domain::Purchase, Domain::Inventory, Domain::Asset, Domain::Finances, Domain::Service,
        ], 11);

        // Users — primary User
        $this->menuItem('Manage Users', 'Users2', 'users.*', User::class, [Domain::User], 1, group: 'Users');
        $this->menuItem('Roles', 'Users2', 'roles.*', Role::class, [Domain::User], 2, group: 'Users');

        // Tickets — primary Helpdesk (section tunggal, tidak butuh folder)
        $this->menuItem('Tickets', 'TicketsIcon', 'tickets.*', null, [Domain::Helpdesk], 1);

        // ToDo — muncul di semua desk (personal task list), primary Core
        $this->menuItem('ToDo', 'ListTodo', 'todos.*', null, [
            Domain::Core, Domain::Sales, Domain::Purchase, Domain::Inventory, Domain::Asset, Domain::Finances, Domain::Service, Domain::Helpdesk, Domain::User,
        ], 12);

        // Logs — primary Core (section tunggal, tidak butuh folder)
        $this->menuItem('Logs', 'HistoryIcon', 'logs.*', Log::class, [Domain::Core], 13);

        // Settings — primary Core
        $this->menuItem('Company', 'Settings2', 'companies.*', Preference::class, [Domain::Core], 14, group: 'Settings');
        $this->menuItem('Branches', 'Settings2', 'branches.*', Branch::class, [Domain::Core], 15, group: 'Settings');
        $this->menuItem('Countries', 'Settings2', 'countries.*', Country::class, [Domain::Core], 16, group: 'Settings');
        $this->menuItem('Currencies', 'Settings2', 'currencies.*', Currency::class, [Domain::Core], 17, group: 'Settings');
        $this->menuItem('Manage Dashboards', 'Settings2', 'dashboards.*', Dashboard::class, [Domain::Core], 18, group: 'Settings');
        $this->menuItem('Formating Series', 'Settings2', 'formatingSeries.*', FormatingSeries::class, [Domain::Core], 19, group: 'Settings');
        $this->menuItem('Approval Schemes', 'Settings2', 'approvalSchemes.*', ApprovalScheme::class, [Domain::Core], 20, group: 'Settings');
        $this->menuItem('Print Templates', 'Settings2', 'printTemplates.*', PrintTemplate::class, [Domain::Core], 21, group: 'Settings');
        $this->menuItem('Email Templates', 'Settings2', 'emailTemplates.*', EmailTemplate::class, [Domain::Core], 22, group: 'Settings');
        $this->menuItem('Widgets', 'Settings2', 'widgets.*', Widget::class, [Domain::Core], 23, group: 'Settings');
        $this->menuItem('Files', 'Settings2', 'files.*', File::class, [Domain::Core], 24, group: 'Settings');
    }
}
