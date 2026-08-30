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
use App\Models\Core\Chart;
use App\Models\Core\Country;
use App\Models\Core\Currency;
use App\Models\Core\Desk;
use App\Models\Core\EmailTemplate;
use App\Models\Core\File;
use App\Models\Core\FormatingSeries;
use App\Models\Core\Log;
use App\Models\Core\MenuItem;
use App\Models\Core\NumberCard;
use App\Models\Core\Preference;
use App\Models\Core\PrintTemplate;
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
                'label' => $label,
                // Feedback user: grup di-skip (unwrap jadi flat) kalau cuma
                // punya 1 child DI DESK TERTENTU (lihat
                // ResolveActiveDesk::groupByMenuItemParent()) — keanggotaan
                // grup per-desk BISA beda2 tergantung item mana yg attach ke
                // desk itu, jadi icon TIDAK BISA di-skip saat seed (statis,
                // global), harus selalu icon asli item ini supaya tetap benar
                // saat kebetulan ke-unwrap flat di sebagian desk.
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
        // Folder murni pengelompokan (Requirement picker MenuItem Desk) —
        // dibuat SEBELUM child-nya karena menuItem() butuh
        // $this->menuGroups[$group] sudah terisi.
        //
        // Feedback user: grup HANYA dibuat kalau memang ada kedekatan
        // konsep NYATA antar item (mis. Items+Attributes+Categories =
        // "Item Master") — BUKAN "1 domain = 1 folder besar" (dulu SEMUA
        // 10 item Inventory dijejalkan ke satu folder "Inventories"; itu
        // sama percumanya dgn tanpa grouping sama sekali, menghilangkan
        // manfaat Desk-based management yang justru dimaksudkan memecah
        // per-konteks). Item yang TIDAK cukup dekat konsepnya ke item lain
        // di domain yang sama dibiarkan FLAT (top-level, tanpa grup).
        $this->menuGroup('Item Master', 'PackageIcon', Domain::Inventory);
        $this->menuGroup('Stock & Movements', 'PackageCheck', Domain::Inventory);
        $this->menuGroup('Asset Master', 'Boxes', Domain::Asset);
        $this->menuGroup('Maintenance', 'Wrench', Domain::Asset);
        $this->menuGroup('Purchases', 'ShoppingBagIcon', Domain::Purchase);
        $this->menuGroup('Sales', 'Receipt', Domain::Sales);
        $this->menuGroup('Accounting', 'Calculator', Domain::Finances);
        $this->menuGroup('Payments', 'CreditCard', Domain::Finances);
        $this->menuGroup('Invoices', 'FileText', Domain::Finances);
        $this->menuGroup('Users', 'Users2', Domain::User);
        $this->menuGroup('General', 'Building2', Domain::Core);
        $this->menuGroup('Workflow', 'Workflow', Domain::Core);
        $this->menuGroup('Templates', 'LayoutTemplate', Domain::Core);
        $this->menuGroup('Dashboard Widgets', 'Gauge', Domain::Core);

        // Dashboard/Approvals/ToDo/Manual Book — TIDAK di-seed di sini lagi.
        // Feedback user: 4 menu ini wajib ada di SEMUA desk (termasuk custom
        // yang dibuat user, bukan cuma system desk) dan TIDAK boleh muncul di
        // picker/editor menu Form Desk. Disuntik langsung di kode render-time
        // (ResolveActiveDesk::buildMenuTree() — satu titik yang membangun
        // prop `menuItems` utk SEMUA desk, system maupun custom), BUKAN
        // sebagai row MenuItem/DeskMenuItem — supaya otomatis tidak pernah
        // muncul sebagai opsi yang bisa dihapus/diedit user.

        // Inventory: Item Master — definisi produk/katalog, genuinely terkait
        $this->menuItem('Items', 'PackageIcon', 'items.*', Item::class, [Domain::Inventory, Domain::Sales, Domain::Purchase], 1, group: 'Item Master');
        $this->menuItem('Item Alternatives', 'PackageIcon', 'itemAlternatives.*', ItemAlternative::class, [Domain::Inventory], 2, group: 'Item Master');
        $this->menuItem('Attributes', 'PackageIcon', 'attributes.*', Attribute::class, [Domain::Inventory], 3, group: 'Item Master');
        $this->menuItem('Categories', 'PackageIcon', 'categories.*', Category::class, [Domain::Inventory], 4, group: 'Item Master');
        $this->menuItem('Units', 'PackageIcon', 'units.*', Unit::class, [Domain::Inventory], 5, group: 'Item Master');

        // Inventory: Warehouses berdiri sendiri — soal LOKASI, beda konsep
        // dari Item Master (definisi produk) maupun Stock & Movements (transaksi)
        $this->menuItem('Warehouses', 'Warehouse', 'warehouses.*', Warehouse::class, [Domain::Inventory, Domain::Sales, Domain::Purchase], 6);

        // Inventory: Stock & Movements — transaksi pergerakan stok
        $this->menuItem('Stock Entries', 'PackageCheck', 'stockEntries.*', StockEntry::class, [Domain::Inventory], 7, group: 'Stock & Movements');
        $this->menuItem('Purchase Receipts', 'PackageCheck', 'purchaseReceipts.*', PurchaseReceipt::class, [Domain::Purchase, Domain::Inventory], 8, group: 'Stock & Movements');
        $this->menuItem('Delivery Notes', 'PackageCheck', 'deliveryNotes.*', DeliveryNote::class, [Domain::Inventory, Domain::Sales], 9, group: 'Stock & Movements');
        $this->menuItem('Stock Ledgers', 'PackageCheck', 'stockLedgers.*', StockLedgerEntry::class, [Domain::Inventory], 10, group: 'Stock & Movements');

        // Assets: Asset Master — definisi aset. Feedback user: Assets juga
        // relevan di desk Service (aset yg diservis) — Categories/Locations
        // TIDAK diminta, tetap Asset-only.
        $this->menuItem('Assets', 'Boxes', 'assets.*', Asset::class, [Domain::Asset, Domain::Service], 1, group: 'Asset Master');
        $this->menuItem('Asset Categories', 'Boxes', 'assetCategories.*', AssetCategory::class, [Domain::Asset], 2, group: 'Asset Master');
        $this->menuItem('Asset Locations', 'Boxes', 'assetLocations.*', AssetLocation::class, [Domain::Asset], 3, group: 'Asset Master');

        // Assets: transaksi berdiri sendiri — bukan master data, bukan maintenance
        $this->menuItem('Asset Value Adjustments', 'ArrowUpDown', 'assetValueAdjustments.*', AssetValueAdjustment::class, [Domain::Asset], 4);
        $this->menuItem('Asset Movements', 'Truck', 'assetMovements.*', AssetMovement::class, [Domain::Asset], 5);

        // Assets: Maintenance. Feedback user: Maintenance Teams + Asset
        // Maintenance juga relevan di desk Service (Asset Services sudah
        // duluan ada di sana) — di desk Service ketiganya otomatis tetap
        // ke-grup "Maintenance" (3 anak, syarat >1 item terpenuhi).
        $this->menuItem('Maintenance Teams', 'Wrench', 'assetMaintenanceTeams.*', AssetMaintenanceTeam::class, [Domain::Asset, Domain::Service], 6, group: 'Maintenance');
        $this->menuItem('Asset Maintenance', 'Wrench', 'assetMaintenances.*', AssetMaintenance::class, [Domain::Asset, Domain::Service], 7, group: 'Maintenance');
        $this->menuItem('Asset Services', 'Wrench', 'assetServices.*', AssetService::class, [Domain::Asset, Domain::Service], 8, group: 'Maintenance');

        // Services — primary Service (section tunggal, tidak butuh folder)
        $this->menuItem('Work Orders', 'ServiceIcon', 'workOrders.*', WorkOrder::class, [Domain::Service], 1);

        // Purchases — Requests+Orders tetap 1 grup kecil (alur procurement).
        // Suppliers feedback user: keluarkan dari grup (relasi vendor beda
        // konsep dari dokumen transaksi procurement) + dipakai juga di
        // Finances (konteks pembayaran vendor) — icon beda dari grup
        // 'Purchases' krn sama2 flat/top-level di desk Purchase.
        $this->menuItem('Suppliers', 'Handshake', 'suppliers.*', Supplier::class, [Domain::Purchase, Domain::Finances], 1);
        $this->menuItem('Purchase Requests', 'ShoppingBagIcon', 'purchaseRequests.*', PurchaseRequest::class, [Domain::Purchase], 2, group: 'Purchases');
        $this->menuItem('Purchase Orders', 'ShoppingBagIcon', 'purchaseOrders.*', PurchaseOrder::class, [Domain::Purchase], 3, group: 'Purchases');

        // Sales — Orders+Internal Orders tetap 1 grup kecil. Customers
        // feedback user: keluarkan dari grup (relasi pelanggan beda konsep
        // dari dokumen transaksi) — juga dipakai di Finances.
        $this->menuItem('Customers', 'CustomerIcon', 'customers.*', Customer::class, [Domain::Sales, Domain::Finances], 1);
        $this->menuItem('Sales Orders', 'Receipt', 'salesOrders.*', SalesOrder::class, [Domain::Sales], 2, group: 'Sales');
        $this->menuItem('Internal Orders', 'Receipt', 'internalOrders.*', InternalOrder::class, [Domain::Sales], 3, group: 'Sales');

        // Finances: Accounting
        $this->menuItem('Accounts', 'Calculator', 'accounts.*', Account::class, [Domain::Finances], 1, group: 'Accounting');
        $this->menuItem('General Ledgers', 'Calculator', 'generalLedgers.*', GeneralLedger::class, [Domain::Finances], 2, group: 'Accounting');

        // Finances: Payments
        $this->menuItem('Payment Methods', 'CreditCard', 'paymentMethods.*', PaymentMethod::class, [Domain::Finances], 3, group: 'Payments');
        $this->menuItem('Payment Term Templates', 'CreditCard', 'paymentTermTemplates.*', PaymentTermTemplate::class, [Domain::Finances], 4, group: 'Payments');
        $this->menuItem('Payment Entries', 'CreditCard', 'paymentEntries.*', PaymentEntry::class, [Domain::Finances], 5, group: 'Payments');

        // Finances: Invoices
        $this->menuItem('Purchase Invoices', 'FileText', 'purchaseInvoices.*', PurchaseInvoice::class, [Domain::Finances, Domain::Purchase], 6, group: 'Invoices');
        $this->menuItem('Sales Invoices', 'FileText', 'salesInvoices.*', SalesInvoice::class, [Domain::Finances, Domain::Sales], 7, group: 'Invoices');
        $this->menuItem('Taxes', 'FileText', 'taxes.*', Tax::class, [Domain::Finances], 8, group: 'Invoices');

        // Users — 2 item terkait erat
        $this->menuItem('Manage Users', 'Users2', 'users.*', User::class, [Domain::User], 1, group: 'Users');
        $this->menuItem('Roles', 'Users2', 'roles.*', Role::class, [Domain::User], 2, group: 'Users');

        // Tickets — primary Helpdesk (section tunggal, tidak butuh folder)
        $this->menuItem('Tickets', 'TicketsIcon', 'tickets.*', null, [Domain::Helpdesk], 1);

        // Settings: General — config level perusahaan/lokasi/mata uang
        $this->menuItem('Company', 'Building2', 'companies.*', Preference::class, [Domain::Core], 14, group: 'General');
        $this->menuItem('Branches', 'Building2', 'branches.*', Branch::class, [Domain::Core], 15, group: 'General');
        $this->menuItem('Countries', 'Building2', 'countries.*', Country::class, [Domain::Core], 16, group: 'General');
        $this->menuItem('Currencies', 'Building2', 'currencies.*', Currency::class, [Domain::Core], 17, group: 'General');
        // 'Manage Dashboards' (dashboards.*) DIHAPUS — bug lain ditemukan sesi
        // ini: halaman CRUD Dashboard lama & route-nya sudah dihapus total
        // (commit "hapus halaman CRUD Dashboard lama yang sudah orphaned"),
        // menu ini ketinggalan tidak ikut dibersihkan, jadi nunjuk route mati.

        // Settings: Workflow — pengaturan proses/penomoran
        $this->menuItem('Formating Series', 'Workflow', 'formatingSeries.*', FormatingSeries::class, [Domain::Core], 18, group: 'Workflow');
        $this->menuItem('Approval Schemes', 'Workflow', 'approvalSchemes.*', ApprovalScheme::class, [Domain::Core], 19, group: 'Workflow');

        // Settings: Templates — dokumen/komunikasi
        $this->menuItem('Print Templates', 'LayoutTemplate', 'printTemplates.*', PrintTemplate::class, [Domain::Core], 20, group: 'Templates');
        $this->menuItem('Email Templates', 'LayoutTemplate', 'emailTemplates.*', EmailTemplate::class, [Domain::Core], 21, group: 'Templates');

        // Settings: Dashboard Widgets
        // number-card-chart-redesign: Widget lama pecah jadi 2 entity terpisah
        // — bug ditemukan sesi ini: menu Settings lama ('Widgets' -> Widget::class)
        // tidak pernah diperbarui saat Widget dihapus, DeskSeeder fatal error
        // krn class-nya sudah tidak ada. Sekaligus menutup gap: /settings/numberCards
        // & /settings/charts sejak awal tidak punya menu entry sama sekali.
        $this->menuItem('Number Card', 'Gauge', 'numberCards.*', NumberCard::class, [Domain::Core], 22, group: 'Dashboard Widgets');
        $this->menuItem('Chart', 'Gauge', 'charts.*', Chart::class, [Domain::Core], 23, group: 'Dashboard Widgets');

        // Settings: Files berdiri sendiri — bukan bagian empat sub-grup di atas
        $this->menuItem('Files', 'Folder', 'files.*', File::class, [Domain::Core], 24);

        // Logs — feedback user: posisi di bawah, setelah Files (section
        // tunggal, tidak butuh folder)
        $this->menuItem('Logs', 'HistoryIcon', 'logs.*', Log::class, [Domain::Core], 25);
    }
}
