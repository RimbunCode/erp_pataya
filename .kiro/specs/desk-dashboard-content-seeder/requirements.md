# Requirements Document

## Introduction

`desk-based-ui` menyiapkan `Desk::resolveDashboard()` (Dashboard kosong otomatis per Desk system), `desk-dashboard-builder` menyediakan kanvas block editor-nya (9 tipe `DashboardWidget`: section, text, spacer, shortcut, link_card, link_card_item, quick_list, chart, card). Belum ada yang mengisi kontennya — Desk Home selalu kosong sampai user mengisi manual, sehingga tidak ada contoh konkret cara memakai kanvas ini secara bermakna, dan fitur-fitur penting tiap domain tidak langsung terlihat saat pertama kali membuka Desk.

Spec ini menambah method seeder baru di `database/seeders/DeskSeeder.php` yang mengisi 9 Desk system dengan konten dashboard nyata (card/chart/quick_list/link_card) berdasarkan model-model yang sudah terdaftar sebagai `MenuItem` desk tersebut — merepresentasikan fitur yang memang ada, bukan konten generik.

## Glossary

- **Desk system**: salah satu dari 9 Desk bawaan (Core, Sales, Purchase, Inventory, Asset, Finances, Service, Helpdesk, User Management), dibuat `DeskSeeder::createSystemDesks()`.
- **DashboardWidget**: satu block di kanvas Desk Home, salah satu dari 9 `type` (lihat `DashboardWidget::VALID_PARENTS`).
- **Chart/NumberCard**: entity terpisah menyimpan definisi query analitik (agregasi/grouping/timeseries), dirujuk `DashboardWidget` bertipe `chart`/`card` via `chart_id`/`number_card_id`.
- **Idempotensi "isi sekali"**: seeder hanya mengisi Dashboard yang BENAR-BENAR kosong (0 widget) — begitu berisi (dari seeder maupun edit user), run berikutnya tidak menimpa.

## Requirements

### Requirement 1: Seeder mengisi Dashboard kosong tiap Desk system

**User Story:** As a admin yang baru deploy/fresh-install sistem, I want tiap Desk system langsung punya dashboard berisi metrik relevan, so that saya tidak perlu menyusun manual dari nol untuk melihat contoh pemakaian yang benar.

#### Acceptance Criteria

1. WHEN `DeskSeeder::run()` dijalankan, THE sistem SHALL mengisi `DashboardWidget` untuk SETIAP 9 Desk system yang Dashboard-nya masih kosong (0 widget).
2. IF sebuah Desk system BELUM punya `dashboard_id` terisi, THEN THE sistem SHALL memanggil `Desk::resolveDashboard()` (perilaku existing) sebelum mengisi widget.
3. THE sistem SHALL TIDAK mengisi ulang/menimpa Dashboard yang SUDAH punya widget (baik dari run seeder sebelumnya maupun hasil edit manual user) — seeder SHALL skip total untuk Desk tersebut.
4. Jalankan `DeskSeeder::run()` DUA KALI berturut-turut SHALL menghasilkan jumlah widget yang SAMA PERSIS pada run kedua (tidak dobel).

### Requirement 2: Tiap Desk minimal punya 4 tipe block wajib

**User Story:** As a user yang membuka Desk Home pertama kali, I want melihat kombinasi card/chart/quick_list/link_card yang relevan, so that saya langsung paham fitur penting apa saja yang tersedia di domain ini.

#### Acceptance Criteria

1. THE sistem SHALL membuat MINIMAL 1 widget bertipe `card`, 1 `chart`, 1 `quick_list`, DAN 1 `link_card` (dengan minimal 1 `link_card_item` di dalamnya) untuk SETIAP 9 Desk system.
2. THE sistem SHALL TIDAK membuat widget bertipe `shortcut` sama sekali (dihapus eksplisit dari scope).
3. THE model/agregasi yang dipakai tiap card/chart/quick_list SHALL merujuk model yang SUDAH terdaftar sebagai `MenuItem` desk tersebut (lihat `DeskSeeder::seedMenuItems()`) — bukan model di luar domain desk itu.

### Requirement 3: Chart/NumberCard dibuat valid sesuai skema

**User Story:** As a developer, I want Chart/NumberCard hasil seeder valid terhadap aturan yang sama dengan form admin, so that data yang dihasilkan tidak korup/error saat dirender.

#### Acceptance Criteria

1. WHEN `chart_source_type = 'group_by'`, THE sistem SHALL mengisi `group_by_based_on` DAN `group_by_type`.
2. WHEN `NumberCard.function` BUKAN `'count'`, THE sistem SHALL mengisi `aggregate_function_based_on`.
3. WHEN `NumberCard.show_percentage_stats = true`, THE sistem SHALL mengisi `stats_time_interval`.
4. THE sistem SHALL mengeset `is_shared_all = true` pada SETIAP Chart/NumberCard hasil seeder (konten dashboard sistem dipakai bersama, bukan personal).
5. THE sistem SHALL mengisi `model_id` (FK ke `permissions`, via lookup `Permission::where('model', <FQCN>)->first()`) DAN `model_class` (string FQCN) untuk SETIAP Chart/NumberCard yang bersumber dari model dokumen (`source_type=document_type`/BUKAN `chart_source_type=custom`).

### Requirement 4: Fitur di luar jangkauan teknis saat ini TIDAK diimplementasikan

**User Story:** As a developer, I want batasan teknis yang sudah ditemukan didokumentasikan dengan jelas, so that tidak ada yang mencoba mengimplementasikan ulang sesuatu yang sudah terbukti tidak feasible tanpa perubahan infrastruktur.

#### Acceptance Criteria

1. THE sistem SHALL TIDAK membuat quick_list dengan filter "assigned to me" (per-viewer dinamis) — `quick_list.filters` bersifat statis untuk semua viewer, tidak ada mekanisme token current-user di `DashboardController::quickList()`.
2. THE sistem SHALL TIDAK membuat widget berbasis model `Stock` (fitur "item stok rendah") — `Stock` belum terdaftar di tabel `permissions` (`PermissionChecker->can(Stock::class, Select)` selalu `false`), DAN `quickList()` tidak mendukung filter kolom lintas-relasi (perbandingan dinamis ke `Item.stock_minimum` tidak feasible).

### Requirement 5: Konten spesifik per Desk

**User Story:** As a user tiap role (Sales Manager, Procurement Officer, Warehouse Staff, Asset Manager, Finance/Accountant, dst), I want dashboard desk saya menampilkan metrik yang genuinely actionable untuk pekerjaan saya, so that saya tidak perlu membuka banyak halaman lain untuk tahu apa yang butuh perhatian.

#### Acceptance Criteria

1. Desk **Sales** SHALL menampilkan: card total SO bulan ini (sum) dan total Customer (count); chart SO per status (group_by) dan trend SO+Internal Order (timeseries bulanan, terpisah); quick_list SO terbaru, Internal Order terbaru, dan Delivery Note yang belum terkirim; link_card berisi tautan Sales Orders/Internal Orders/Customers.
2. Desk **Purchase** SHALL menampilkan: card total PO bulan ini (sum) dan PR menunggu approval (count); chart trend PR→PO dan status PR serta PO terpisah (group_by); quick_list PR terbaru dan PO yang `required_date`-nya sudah lewat; link_card Purchase Requests/Purchase Orders/Purchase Receipts/Suppliers.
3. Desk **Inventory** SHALL menampilkan: card total Item dan total Warehouse (count); chart Item per kategori (group_by); quick_list Stock Entry, Purchase Receipt, dan Delivery Note terbaru (3 quick_list terpisah); link_card Items/Item Alternatives/Attributes/Categories/Units.
4. Desk **Asset** SHALL menampilkan: card total Asset aktif (count), Value Adjustment bulan ini (count, BUKAN sum), dan total Depresiasi Terakumulasi (sum); chart Asset per status (group_by) dan AssetService per bulan (timeseries); quick_list AssetService terbaru dan Asset Movement terbaru; link_card Asset Maintenance/Maintenance Teams/Asset Services.
5. Desk **Service** SHALL menampilkan: card Work Order open (count) dan AssetService bulan ini (count); chart WO per status (group_by) dan AssetService per bulan (timeseries); quick_list WO in-progress dan AssetService terbaru; link_card Asset Services/Asset Maintenance.
6. Desk **Finances** SHALL menampilkan: card Sales Invoice sum bulan ini, Purchase Invoice sum bulan ini, dan total saldo Account (sum); chart General Ledger per bulan (timeseries) dan Invoice per status (group_by); quick_list Sales Invoice belum lunas (AR, filter `outstanding_amount > 0`) DAN Purchase Invoice belum lunas (AP, filter sama) sebagai DUA quick_list terpisah; link_card Accounts/General Ledgers/Sales Invoices/Purchase Invoices/Payment Entries.
7. Desk **User Management** SHALL menampilkan: card total User dan total Role (count); chart User per Role (group_by) dan User baru per bulan (timeseries); quick_list User terbaru; link_card Manage Users/Roles.
8. Desk **Helpdesk** SHALL menampilkan: card Ticket open (count) dan Ticket dibuat bulan ini (count); chart Ticket per status (group_by) dan Ticket per bulan (timeseries); quick_list Ticket belum done diurutkan TERLAMA lebih dulu (`sort_direction=asc`, prioritas risiko SLA — BUKAN terbaru); link_card Tickets (open)/Tickets (semua).
9. Desk **Core** SHALL menampilkan: card total Branch, total File (count), dan aktivitas harian Log dengan `show_percentage_stats=true` dibanding kemarin; chart Log aktivitas per hari (timeseries); quick_list Log terbaru; link_card Company/Countries/Currencies/Formating Series/Approval Schemes/Print Templates/Email Templates.
