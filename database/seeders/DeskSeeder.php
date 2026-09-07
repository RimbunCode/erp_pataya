<?php

namespace Database\Seeders;

use App\Enums\DeskType;
use App\Enums\Domain;
use App\Models\Asset\Asset;
use App\Models\Asset\AssetCategory;
use App\Models\Asset\AssetDepreciationSchedule;
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
use App\Models\Core\Dashboard;
use App\Models\Core\Desk;
use App\Models\Core\EmailTemplate;
use App\Models\Core\File;
use App\Models\Core\FormatingSeries;
use App\Models\Core\Log;
use App\Models\Core\MenuItem;
use App\Models\Core\NumberCard;
use App\Models\Core\Preference;
use App\Models\Core\PrintTemplate;
use App\Models\Core\SavedFilter;
use App\Models\DashboardWidget;
use App\Models\Finances\Account;
use App\Models\Finances\GeneralLedger;
use App\Models\Finances\PaymentEntry;
use App\Models\Finances\PaymentMethod;
use App\Models\Finances\PaymentTermTemplate;
use App\Models\Finances\PurchaseInvoice;
use App\Models\Finances\SalesInvoice;
use App\Models\Finances\Tax;
use App\Models\Helpdesk\Ticket;
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
use App\Models\User\Permission as PermissionModel;
use App\Models\User\Role;
use App\Models\User\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

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

    /** @var array<string,string|null> cache model FQCN -> Permission.id */
    private array $permissionIdCache = [];

    private ?string $adminUserId = null;

    public function run(): void {
        $this->createSystemDesks();
        $this->seedMenuItems();
        $this->seedDashboards();
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
        // Maintenance juga relevan di desk Service — di desk Service keduanya
        // otomatis tetap ke-grup "Maintenance" (2 anak, syarat >1 item
        // terpenuhi). Asset Services SUDAH TIDAK di sini — lihat menuItem
        // "Work Orders" di bawah (WorkOrder lama digantikan AssetService).
        $this->menuItem('Maintenance Teams', 'Wrench', 'assetMaintenanceTeams.*', AssetMaintenanceTeam::class, [Domain::Asset, Domain::Service], 6, group: 'Maintenance');
        $this->menuItem('Asset Maintenance', 'Wrench', 'assetMaintenances.*', AssetMaintenance::class, [Domain::Asset, Domain::Service], 7, group: 'Maintenance');

        // Services — primary Service (section tunggal, tidak butuh folder).
        // AssetService dipromosikan jadi "Work Orders" (menggantikan WorkOrder
        // lama) — keluar dari grup Maintenance, prioritas 1 sama seperti
        // WorkOrder sebelumnya. Model/route/table AssetService TIDAK berubah,
        // cuma label tampilan (lihat AssetService::$alias untuk Permission.name).
        $this->menuItem('Work Orders', 'ServiceIcon', 'assetServices.*', AssetService::class, [Domain::Asset, Domain::Service], 1);

        // WorkOrder lama disembunyikan (BUKAN dihapus — model/data/route tetap
        // ada, cuma tidak muncul di menu). MenuItem lama di-soft-delete supaya
        // env yang sudah pernah ke-seed (staging/production) ikut ter-update
        // saat db:seed dijalankan ulang di deploy berikutnya.
        MenuItem::where('route_name', 'workOrders.*')->delete();

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
        $this->menuItem('Filter Templates', 'Filter', 'filterTemplates.*', SavedFilter::class, [Domain::Core], 22, group: 'Templates');

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

    // ========================================================================
    // Dashboard content seeder (spec desk-dashboard-content-seeder)
    // ========================================================================

    /**
     * Isi Dashboard tiap Desk system dengan konten bermakna — HANYA kalau
     * Dashboard-nya BENAR-BENAR kosong (0 widget). Begitu ada widget apapun
     * (dari run seeder sebelumnya, ATAU hasil edit manual user lewat
     * desk-dashboard-builder), skip total untuk desk itu — seeder ini TIDAK
     * PERNAH menimpa/menghapus ulang, supaya edit user tidak hilang saat
     * `db:seed` dijalankan ulang (mis. saat deploy).
     */
    private function seedDashboards(): void {
        foreach ($this->desks as $desk) {
            $dashboard = $desk->dashboard_id
                ? Dashboard::find($desk->dashboard_id)
                : $desk->resolveDashboard();
            if (! $dashboard || $dashboard->widgets()->count() > 0) {
                continue;
            }

            $method = 'seedDashboardFor' . Str::studly($desk->domain->value);
            if (method_exists($this, $method)) {
                $this->{$method}($dashboard);
            }
        }
    }

    private function adminUserId(): ?string {
        return $this->adminUserId ??= User::query()->value('id');
    }

    private function permissionId(string $modelClass): ?string {
        return $this->permissionIdCache[$modelClass] ??=
            PermissionModel::where('model', $modelClass)->value('id');
    }

    /**
     * Tree filter FilterEvaluator `{root:{k,o,v,c}}` — dipakai Chart/
     * NumberCard.filters DAN DashboardWidget(quick_list).config.filters
     * (format sama, konsumen beda: FilterEvaluator::apply() vs
     * DashboardController::quickList() yang flatten dulu via flattenFilters()
     * FE, tapi bentuk tree-nya identik — lihat resources/js/Hooks/
     * useNestedFilters.jsx: GROUP_CHILDREN='c', ITEM_KEY='k', ITEM_OPERATOR=
     * 'o', ITEM_VALUE='v').
     *
     * @param  list<array{0:string,1:string,2:mixed}|array<string,mixed>>  $items  triple [field,operator,value] ATAU node k/o/v mentah (mis. hasil monthCondition())
     */
    private function filterTree(array $items): array {
        $children = [];
        foreach ($items as $i => $item) {
            $children["f{$i}"] = isset($item['k'])
                ? $item
                : ['k' => $item[0], 'o' => $item[1], 'v' => $item[2]];
        }

        return ['root' => ['k' => 'and', 'c' => $children]];
    }

    /** Kondisi "field jatuh di bulan berjalan" — FilterEvaluator wajib in_period utk kolom date/datetime. */
    private function monthCondition(string $field): array {
        return ['k' => $field, 'o' => 'in_period', 'v' => [
            'period'    => 'day',
            'operator'  => 'between',
            'startDate' => now()->startOfMonth()->toDateString(),
            'endDate'   => now()->endOfMonth()->toDateString(),
        ]];
    }

    /** Kondisi "field jatuh hari ini". */
    private function todayCondition(string $field): array {
        return ['k' => $field, 'o' => 'in_period', 'v' => [
            'period'    => 'day',
            'operator'  => 'is',
            'startDate' => now()->toDateString(),
        ]];
    }

    /**
     * Bikin NumberCard + DashboardWidget bertipe 'card' sekaligus.
     * Validasi kondisional (Requirement 3.2/3.3 spec desk-dashboard-content-seeder)
     * ditegakkan DI KODE, bukan cuma dokumentasi.
     */
    private function card(Dashboard $dashboard, array $attrs, ?string $parentId, int $order, int $width = 3): DashboardWidget {
        $function = $attrs['function'] ?? 'count';
        if ($function !== 'count' && empty($attrs['aggregate_function_based_on'])) {
            throw new \RuntimeException("card(): function='{$function}' wajib aggregate_function_based_on — [{$attrs['label']}]");
        }
        if (! empty($attrs['show_percentage_stats']) && empty($attrs['stats_time_interval'])) {
            throw new \RuntimeException("card(): show_percentage_stats wajib stats_time_interval — [{$attrs['label']}]");
        }
        if (! empty($attrs['model_class']) && empty($attrs['model_id'])) {
            $attrs['model_id'] = $this->permissionId($attrs['model_class']);
        }

        $numberCard = NumberCard::create($attrs + [
            'source_type'   => $attrs['source_type'] ?? 'document_type',
            'function'      => $function,
            'is_shared_all' => true,
            'created_by_id' => $this->adminUserId(),
        ]);

        return DashboardWidget::create([
            'dashboard_id'   => $dashboard->id,
            'parent_id'      => $parentId,
            'type'           => 'card',
            'number_card_id' => $numberCard->id,
            'order'          => $order,
            'width'          => $width,
            'is_visible'     => true,
        ]);
    }

    /** Bikin Chart + DashboardWidget bertipe 'chart' sekaligus. */
    private function chart(Dashboard $dashboard, array $attrs, ?string $parentId, int $order, int $width = 6): DashboardWidget {
        $sourceType = $attrs['chart_source_type'] ?? 'count';
        if ($sourceType === 'group_by' && (empty($attrs['group_by_based_on']) || empty($attrs['group_by_type']))) {
            throw new \RuntimeException("chart(): group_by wajib group_by_based_on+group_by_type — [{$attrs['chart_name']}]");
        }
        if (! empty($attrs['model_class']) && empty($attrs['model_id'])) {
            $attrs['model_id'] = $this->permissionId($attrs['model_class']);
        }

        $chart = Chart::create($attrs + [
            'chart_source_type' => $sourceType,
            'visual_type'       => $attrs['visual_type'] ?? 'line',
            'is_shared_all'     => true,
            'created_by_id'     => $this->adminUserId(),
        ]);

        return DashboardWidget::create([
            'dashboard_id' => $dashboard->id,
            'parent_id'    => $parentId,
            'type'         => 'chart',
            'chart_id'     => $chart->id,
            'order'        => $order,
            'width'        => $width,
            'is_visible'   => true,
        ]);
    }

    /** DashboardWidget generik (section/text/spacer/quick_list/link_card/link_card_item). */
    private function widget(Dashboard $dashboard, string $type, array $config, ?string $parentId, int $order, int $width = 12): DashboardWidget {
        return DashboardWidget::create([
            'dashboard_id' => $dashboard->id,
            'parent_id'    => $parentId,
            'type'         => $type,
            'config'       => $config,
            'order'        => $order,
            'width'        => $width,
            'is_visible'   => true,
        ]);
    }

    /** Config quick_list — filter opsional HANYA kolom fisik model root (DashboardController::quickList()). */
    private function quickListConfig(string $label, string $modelClass, array $columns, ?array $filters, string $sortBy, string $sortDirection = 'desc', int $limit = 5): array {
        return [
            'label'          => $label,
            'model_id'       => $this->permissionId($modelClass),
            'model_class'    => $modelClass,
            'columns'        => $columns,
            'filters'        => $filters,
            'sort_by'        => $sortBy,
            'sort_direction' => $sortDirection,
            'limit'          => $limit,
        ];
    }

    /** Section pembuka "Ringkasan" — dipakai tiap desk, order selalu 0. */
    private function openingSection(Dashboard $dashboard, string $label): string {
        $section = $this->widget($dashboard, 'section', [
            'label'       => ['json' => null, 'html' => "<strong>{$label}</strong>"],
            'description' => null,
        ], null, 0, 12);

        return $section->id;
    }

    private function seedDashboardForSales(Dashboard $dashboard): void {
        $this->openingSection($dashboard, 'Ringkasan Sales');

        $this->card($dashboard, [
            'label'                       => 'Total SO Bulan Ini',
            'function'                    => 'sum',
            'aggregate_function_based_on' => 'amount',
            'model_class'                 => SalesOrder::class,
            'filters'                     => $this->filterTree([$this->monthCondition('date')]),
        ], null, 1);
        $this->card($dashboard, [
            'label'       => 'Total Customer',
            'function'    => 'count',
            'model_class' => Customer::class,
        ], null, 2);

        $this->chart($dashboard, [
            'chart_name'        => 'Sales Order per Status',
            'chart_source_type' => 'group_by',
            'group_by_based_on' => 'status',
            'group_by_type'     => 'count',
            'visual_type'       => 'pie',
            'model_class'       => SalesOrder::class,
        ], null, 3);
        $this->chart($dashboard, [
            'chart_name'        => 'Trend Sales Order',
            'chart_source_type' => 'count',
            'timeseries'        => true,
            'based_on'          => 'date',
            'time_interval'     => 'monthly',
            'visual_type'       => 'line',
            'model_class'       => SalesOrder::class,
        ], null, 4);
        $this->chart($dashboard, [
            'chart_name'        => 'Trend Internal Order',
            'chart_source_type' => 'count',
            'timeseries'        => true,
            'based_on'          => 'date',
            'time_interval'     => 'monthly',
            'visual_type'       => 'line',
            'model_class'       => InternalOrder::class,
        ], null, 5);

        $this->widget($dashboard, 'quick_list', $this->quickListConfig(
            'Sales Order Terbaru',
            SalesOrder::class,
            ['code', 'customer', 'date', 'amount'],
            null,
            'date',
        ), null, 6, 6);
        $this->widget($dashboard, 'quick_list', $this->quickListConfig(
            'Internal Order Terbaru',
            InternalOrder::class,
            ['code', 'date'],
            null,
            'date',
        ), null, 7, 6);
        $this->widget($dashboard, 'quick_list', $this->quickListConfig(
            'Delivery Note Belum Terkirim',
            DeliveryNote::class,
            ['code', 'customer', 'created_at'],
            $this->filterTree([['status', 'like', 'to_deliver']]),
            'created_at',
        ), null, 8, 12);

        $linkCard = $this->widget($dashboard, 'link_card', ['label' => 'Laporan'], null, 9, 12);
        $this->linkCardItems($dashboard, $linkCard->id, [
            'Sales Orders'    => 'salesOrders.*',
            'Internal Orders' => 'internalOrders.*',
            'Customers'       => 'customers.*',
        ]);
    }

    private function seedDashboardForPurchase(Dashboard $dashboard): void {
        $this->openingSection($dashboard, 'Ringkasan Purchase');

        $this->card($dashboard, [
            'label'                       => 'Total PO Bulan Ini',
            'function'                    => 'sum',
            'aggregate_function_based_on' => 'amount',
            'model_class'                 => PurchaseOrder::class,
            'filters'                     => $this->filterTree([$this->monthCondition('date')]),
        ], null, 1);
        $this->card($dashboard, [
            'label'       => 'PR Menunggu Approval',
            'function'    => 'count',
            'model_class' => PurchaseRequest::class,
            'filters'     => $this->filterTree([['status', 'like', 'pending']]),
        ], null, 2);

        $this->chart($dashboard, [
            'chart_name'        => 'Trend Purchase Order',
            'chart_source_type' => 'count',
            'timeseries'        => true,
            'based_on'          => 'date',
            'time_interval'     => 'monthly',
            'visual_type'       => 'line',
            'model_class'       => PurchaseOrder::class,
        ], null, 3);
        $this->chart($dashboard, [
            'chart_name'        => 'Purchase Request per Status',
            'chart_source_type' => 'group_by',
            'group_by_based_on' => 'status',
            'group_by_type'     => 'count',
            'visual_type'       => 'pie',
            'model_class'       => PurchaseRequest::class,
        ], null, 4);
        $this->chart($dashboard, [
            'chart_name'        => 'Purchase Order per Status',
            'chart_source_type' => 'group_by',
            'group_by_based_on' => 'status',
            'group_by_type'     => 'count',
            'visual_type'       => 'pie',
            'model_class'       => PurchaseOrder::class,
        ], null, 5);

        $this->widget($dashboard, 'quick_list', $this->quickListConfig(
            'Purchase Request Terbaru',
            PurchaseRequest::class,
            ['code', 'date'],
            null,
            'date',
        ), null, 6, 6);
        $this->widget($dashboard, 'quick_list', $this->quickListConfig(
            'PO Sudah Lewat Tanggal Dibutuhkan',
            PurchaseOrder::class,
            ['code', 'supplier', 'required_date'],
            $this->filterTree([['required_date', '<', now()->toDateString()]]),
            'required_date',
            'asc',
        ), null, 7, 6);

        $linkCard = $this->widget($dashboard, 'link_card', ['label' => 'Procurement'], null, 8, 12);
        $this->linkCardItems($dashboard, $linkCard->id, [
            'Purchase Requests' => 'purchaseRequests.*',
            'Purchase Orders'   => 'purchaseOrders.*',
            'Purchase Receipts' => 'purchaseReceipts.*',
            'Suppliers'         => 'suppliers.*',
        ]);
    }

    private function seedDashboardForInventory(Dashboard $dashboard): void {
        $this->openingSection($dashboard, 'Ringkasan Inventory');

        $this->card($dashboard, ['label' => 'Total Item', 'function' => 'count', 'model_class' => Item::class], null, 1);
        $this->card($dashboard, ['label' => 'Total Warehouse', 'function' => 'count', 'model_class' => Warehouse::class], null, 2);

        $this->chart($dashboard, [
            'chart_name'        => 'Item per Kategori',
            'chart_source_type' => 'group_by',
            'group_by_based_on' => 'category',
            'group_by_type'     => 'count',
            'visual_type'       => 'bar',
            'model_class'       => Item::class,
        ], null, 3);

        $this->widget($dashboard, 'quick_list', $this->quickListConfig(
            'Stock Entry Terbaru',
            StockEntry::class,
            ['code', 'date'],
            null,
            'date',
        ), null, 4, 4);
        $this->widget($dashboard, 'quick_list', $this->quickListConfig(
            'Purchase Receipt Terbaru',
            PurchaseReceipt::class,
            ['code', 'date'],
            null,
            'date',
        ), null, 5, 4);
        $this->widget($dashboard, 'quick_list', $this->quickListConfig(
            'Delivery Note Terbaru',
            DeliveryNote::class,
            ['code', 'created_at'],
            null,
            'created_at',
        ), null, 6, 4);

        $linkCard = $this->widget($dashboard, 'link_card', ['label' => 'Item Master'], null, 7, 12);
        $this->linkCardItems($dashboard, $linkCard->id, [
            'Items'             => 'items.*',
            'Item Alternatives' => 'itemAlternatives.*',
            'Attributes'        => 'attributes.*',
            'Categories'        => 'categories.*',
            'Units'             => 'units.*',
        ]);
    }

    private function seedDashboardForAsset(Dashboard $dashboard): void {
        $this->openingSection($dashboard, 'Ringkasan Asset');

        $this->card($dashboard, [
            'label'   => 'Total Asset Aktif', 'function' => 'count', 'model_class' => Asset::class,
            'filters' => $this->filterTree([['status', 'like', 'active']]),
        ], null, 1);
        $this->card($dashboard, [
            'label'   => 'Value Adjustment Bulan Ini', 'function' => 'count', 'model_class' => AssetValueAdjustment::class,
            'filters' => $this->filterTree([$this->monthCondition('date')]),
        ], null, 2);
        $this->card($dashboard, [
            'label'                       => 'Total Depresiasi Terakumulasi',
            'function'                    => 'sum',
            'aggregate_function_based_on' => 'depreciation_amount',
            'model_class'                 => AssetDepreciationSchedule::class,
        ], null, 3);

        $this->chart($dashboard, [
            'chart_name'        => 'Asset per Status',
            'chart_source_type' => 'group_by',
            'group_by_based_on' => 'status',
            'group_by_type'     => 'count',
            'visual_type'       => 'pie',
            'model_class'       => Asset::class,
        ], null, 4);
        $this->chart($dashboard, [
            'chart_name'        => 'Work Order per Bulan',
            'chart_source_type' => 'count',
            'timeseries'        => true,
            'based_on'          => 'failure_date',
            'time_interval'     => 'monthly',
            'visual_type'       => 'bar',
            'model_class'       => AssetService::class,
        ], null, 5);

        $this->widget($dashboard, 'quick_list', $this->quickListConfig(
            'Work Order Terbaru',
            AssetService::class,
            ['code', 'failure_date'],
            null,
            'failure_date',
        ), null, 6, 6);
        $this->widget($dashboard, 'quick_list', $this->quickListConfig(
            'Asset Movement Terbaru',
            AssetMovement::class,
            ['created_at'],
            null,
            'created_at',
        ), null, 7, 6);

        $linkCard = $this->widget($dashboard, 'link_card', ['label' => 'Maintenance'], null, 8, 12);
        $this->linkCardItems($dashboard, $linkCard->id, [
            'Asset Maintenance' => 'assetMaintenances.*',
            'Maintenance Teams' => 'assetMaintenanceTeams.*',
            'Work Orders'       => 'assetServices.*',
        ]);
    }

    private function seedDashboardForService(Dashboard $dashboard): void {
        $this->openingSection($dashboard, 'Ringkasan Service');

        // WorkOrder lama sudah digantikan AssetService (lihat menuItem "Work
        // Orders" di seedMenuItems) — dashboard ini konsolidasi ke AssetService
        // saja, tidak lagi menampilkan WorkOrder::class secara terpisah.
        $this->card($dashboard, [
            'label'   => 'Work Order Bulan Ini', 'function' => 'count', 'model_class' => AssetService::class,
            'filters' => $this->filterTree([$this->monthCondition('failure_date')]),
        ], null, 1);

        $this->chart($dashboard, [
            'chart_name'        => 'Work Order per Bulan',
            'chart_source_type' => 'count',
            'timeseries'        => true,
            'based_on'          => 'failure_date',
            'time_interval'     => 'monthly',
            'visual_type'       => 'bar',
            'model_class'       => AssetService::class,
        ], null, 2);

        $this->widget($dashboard, 'quick_list', $this->quickListConfig(
            'Work Order Terbaru',
            AssetService::class,
            ['code', 'failure_date'],
            null,
            'failure_date',
        ), null, 3, 12);

        $linkCard = $this->widget($dashboard, 'link_card', ['label' => 'Maintenance'], null, 4, 12);
        $this->linkCardItems($dashboard, $linkCard->id, [
            'Work Orders'       => 'assetServices.*',
            'Asset Maintenance' => 'assetMaintenances.*',
        ]);
    }

    private function seedDashboardForFinances(Dashboard $dashboard): void {
        $this->openingSection($dashboard, 'Ringkasan Finances');

        $this->card($dashboard, [
            'label'       => 'Sales Invoice Bulan Ini', 'function' => 'sum', 'aggregate_function_based_on' => 'amount',
            'model_class' => SalesInvoice::class, 'filters' => $this->filterTree([$this->monthCondition('date')]),
        ], null, 1);
        $this->card($dashboard, [
            'label'       => 'Purchase Invoice Bulan Ini', 'function' => 'sum', 'aggregate_function_based_on' => 'amount',
            'model_class' => PurchaseInvoice::class, 'filters' => $this->filterTree([$this->monthCondition('date')]),
        ], null, 2);
        $this->card($dashboard, [
            'label'       => 'Total Saldo Account', 'function' => 'sum', 'aggregate_function_based_on' => 'balance_amount',
            'model_class' => Account::class,
        ], null, 3);

        $this->chart($dashboard, [
            'chart_name'        => 'General Ledger per Bulan',
            'chart_source_type' => 'count',
            'timeseries'        => true,
            'based_on'          => 'date',
            'time_interval'     => 'monthly',
            'visual_type'       => 'line',
            'model_class'       => GeneralLedger::class,
        ], null, 4);
        $this->chart($dashboard, [
            'chart_name'        => 'Sales Invoice per Status',
            'chart_source_type' => 'group_by',
            'group_by_based_on' => 'status',
            'group_by_type'     => 'count',
            'visual_type'       => 'pie',
            'model_class'       => SalesInvoice::class,
        ], null, 5);

        $this->widget($dashboard, 'quick_list', $this->quickListConfig(
            'Sales Invoice Belum Lunas (AR)',
            SalesInvoice::class,
            ['code', 'customer', 'outstanding_amount'],
            $this->filterTree([['outstanding_amount', '>', 0]]),
            'outstanding_amount',
            'desc',
        ), null, 6, 6);
        $this->widget($dashboard, 'quick_list', $this->quickListConfig(
            'Purchase Invoice Belum Lunas (AP)',
            PurchaseInvoice::class,
            ['code', 'outstanding_amount'],
            $this->filterTree([['outstanding_amount', '>', 0]]),
            'outstanding_amount',
            'desc',
        ), null, 7, 6);

        $linkCard = $this->widget($dashboard, 'link_card', ['label' => 'Accounting & Invoices'], null, 8, 12);
        $this->linkCardItems($dashboard, $linkCard->id, [
            'Accounts'          => 'accounts.*',
            'General Ledgers'   => 'generalLedgers.*',
            'Sales Invoices'    => 'salesInvoices.*',
            'Purchase Invoices' => 'purchaseInvoices.*',
            'Payment Entries'   => 'paymentEntries.*',
        ]);
    }

    private function seedDashboardForUser(Dashboard $dashboard): void {
        $this->openingSection($dashboard, 'Ringkasan User Management');

        $this->card($dashboard, ['label' => 'Total User', 'function' => 'count', 'model_class' => User::class], null, 1);
        $this->card($dashboard, ['label' => 'Total Role', 'function' => 'count', 'model_class' => Role::class], null, 2);

        // Chart "User per Role" DIHILANGKAN dari desain awal: User::roles()
        // adalah belongsToMany (pivot), sedangkan ChartService::getGroupByChartConfig()
        // cuma resolve FK fisik utk relasi belongsTo — tidak jalan utk pivot.
        $this->chart($dashboard, [
            'chart_name'        => 'User Baru per Bulan',
            'chart_source_type' => 'count',
            'timeseries'        => true,
            'based_on'          => 'created_at',
            'time_interval'     => 'monthly',
            'visual_type'       => 'line',
            'model_class'       => User::class,
        ], null, 3);

        $this->widget($dashboard, 'quick_list', $this->quickListConfig(
            'User Terbaru',
            User::class,
            ['name', 'email', 'created_at'],
            null,
            'created_at',
        ), null, 4, 12);

        $linkCard = $this->widget($dashboard, 'link_card', ['label' => 'Users'], null, 5, 12);
        $this->linkCardItems($dashboard, $linkCard->id, [
            'Manage Users' => 'users.*',
            'Roles'        => 'roles.*',
        ]);
    }

    private function seedDashboardForHelpdesk(Dashboard $dashboard): void {
        $this->openingSection($dashboard, 'Ringkasan Helpdesk');

        $this->card($dashboard, [
            'label'   => 'Ticket Open', 'function' => 'count', 'model_class' => Ticket::class,
            'filters' => $this->filterTree([['status', 'like', 'in_progress']]),
        ], null, 1);
        $this->card($dashboard, [
            'label'   => 'Ticket Dibuat Bulan Ini', 'function' => 'count', 'model_class' => Ticket::class,
            'filters' => $this->filterTree([$this->monthCondition('created_at')]),
        ], null, 2);

        $this->chart($dashboard, [
            'chart_name'        => 'Ticket per Status',
            'chart_source_type' => 'group_by',
            'group_by_based_on' => 'status',
            'group_by_type'     => 'count',
            'visual_type'       => 'pie',
            'model_class'       => Ticket::class,
        ], null, 3);
        $this->chart($dashboard, [
            'chart_name'        => 'Ticket per Bulan',
            'chart_source_type' => 'count',
            'timeseries'        => true,
            'based_on'          => 'created_at',
            'time_interval'     => 'monthly',
            'visual_type'       => 'line',
            'model_class'       => Ticket::class,
        ], null, 4);

        // Sengaja BUKAN "belum done" (butuh negasi — quickList() tidak
        // dukung not_like) — "sedang dikerjakan" urutan terlama, prioritas
        // risiko SLA (bukan terbaru).
        $this->widget($dashboard, 'quick_list', $this->quickListConfig(
            'Ticket Sedang Dikerjakan (Terlama Dulu)',
            Ticket::class,
            ['code', 'subject', 'created_at'],
            $this->filterTree([['status', 'like', 'in_progress']]),
            'created_at',
            'asc',
        ), null, 5, 12);

        $linkCard = $this->widget($dashboard, 'link_card', ['label' => 'Tickets'], null, 6, 12);
        $this->linkCardItems($dashboard, $linkCard->id, [
            'Semua Tickets' => 'tickets.*',
        ]);
    }

    private function seedDashboardForCore(Dashboard $dashboard): void {
        $this->openingSection($dashboard, 'Ringkasan Core');

        $this->card($dashboard, ['label' => 'Total Branch', 'function' => 'count', 'model_class' => Branch::class], null, 1);
        $this->card($dashboard, ['label' => 'Total File', 'function' => 'count', 'model_class' => File::class], null, 2);
        $this->card($dashboard, [
            'label'                 => 'Aktivitas Hari Ini', 'function' => 'count', 'model_class' => Log::class,
            'filters'               => $this->filterTree([$this->todayCondition('created_at')]),
            'show_percentage_stats' => true,
            'stats_time_interval'   => 'daily',
        ], null, 3);

        $this->chart($dashboard, [
            'chart_name'        => 'Aktivitas per Hari',
            'chart_source_type' => 'count',
            'timeseries'        => true,
            'based_on'          => 'created_at',
            'time_interval'     => 'daily',
            'visual_type'       => 'line',
            'model_class'       => Log::class,
        ], null, 4);

        $this->widget($dashboard, 'quick_list', $this->quickListConfig(
            'Log Terbaru',
            Log::class,
            ['event', 'created_at'],
            null,
            'created_at',
        ), null, 5, 12);

        $linkCard = $this->widget($dashboard, 'link_card', ['label' => 'Pengaturan Cepat'], null, 6, 12);
        $this->linkCardItems($dashboard, $linkCard->id, [
            'Company'          => 'companies.*',
            'Countries'        => 'countries.*',
            'Currencies'       => 'currencies.*',
            'Formating Series' => 'formatingSeries.*',
            'Approval Schemes' => 'approvalSchemes.*',
            'Print Templates'  => 'printTemplates.*',
            'Email Templates'  => 'emailTemplates.*',
        ]);
    }

    /**
     * Bikin `link_card_item` untuk tiap [label => route_name] — resolve ke
     * MenuItem existing (sudah diseed `seedMenuItems()`) supaya `link_to`
     * konsisten dgn navigasi sidebar, bukan URL hardcode baru.
     */
    private function linkCardItems(Dashboard $dashboard, string $linkCardId, array $items): void {
        $order = 0;
        foreach ($items as $label => $routeName) {
            $menuItem = MenuItem::where('route_name', $routeName)->first();
            if (! $menuItem) {
                continue;
            }
            $this->widget($dashboard, 'link_card_item', [
                'label'     => $label,
                'link_type' => 'menu_item',
                'link_to'   => $menuItem->id,
            ], $linkCardId, $order++, 4);
        }
    }
}
