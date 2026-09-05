# Requirements Document

## Introduction

Navigasi saat ini menampilkan seluruh menu semua modul (Inventories, Assets, Services, Purchases, Customers, Sales, Finances, Approvals, Users, Tickets, ToDo, Logs, Settings) dalam **satu sidebar flat**, bersumber dari array `navList` hardcoded di `resources/js/Components/Sidebar/AppSidebar.jsx`. Tidak ada pengelompokan berdasarkan konteks kerja user — semua item tampil bersamaan, menyulitkan pencarian fitur yang relevan dengan kebutuhan user saat itu. Route (`routes/web.php`) juga flat, tidak ber-prefix modul; pengelompokan yang ada murni komentar visual.

Redesign ini memperkenalkan konsep **Desk** (mirip workspace ERPNext) — pengelompokan menu berdasarkan domain kerja (Sales, Purchase, Inventory, Finances, dst) dan desk custom yang bisa dibuat user/role. Satu fitur bisa muncul di beberapa Desk (misal `Item` relevan di Desk Sales maupun Desk Inventory). Desk aktif disimpan di **cookie**, bukan di URL — URL fitur existing tidak berubah sama sekali.

**Di luar scope:** dashboard widget builder ala ERPNext Home (chart/card query-driven, spacer, grid, link, drag-drop antar tipe widget) — akan jadi spec lanjutan setelah struktur Desk ini berjalan. Spec ini hanya memastikan tiap Desk punya slot dashboard yang reuse model `Dashboard` existing.

## Glossary

- **Desk**: workspace/grouping menu berdasarkan domain kerja. Dua tipe: `system` (bawaan, satu per domain: Core, Sales, Purchase, Inventory, Asset, Finances, Service, Helpdesk, User, Migration — domain `Asset` ditambahkan ke enum `Domain` selama implementasi karena grup navigasi Assets sudah eksis di codebase meski belum tercantum di 9 domain awal CLAUDE.md) dan `custom` (dibuat user, personal atau role-scoped).
- **Desk system**: Desk bawaan, tidak bisa dihapus, visibility otomatis derived dari permission user ke menu item di dalamnya (tidak ada assignment eksplisit).
- **Desk custom personal**: Desk yang dibuat seorang user untuk dirinya sendiri, hanya visible ke pembuatnya.
- **Desk custom role-scoped**: Desk yang dibuat untuk sekelompok user berdasarkan role, visible ke semua user yang punya role tersebut.
- **`MenuItem`**: satu entri menu (label, icon, `route_name`, `model`) yang merujuk ke route/fitur existing — bukan fitur baru. Satu `MenuItem` bisa terhubung ke banyak Desk.
- **`primary_desk_id`**: kolom pada `MenuItem` yang menyatakan Desk "pemilik" fitur tersebut — dipakai sebagai fallback ketika desk aktif tidak bisa ditentukan dari cookie/preferensi user.
- **Desk aktif**: Desk yang sedang dipakai user untuk menampilkan sidebar & konteks navigasi saat ini, disimpan di cookie `active_desk`, di-resolve ulang oleh middleware pada tiap request bila cookie tidak ada/tidak valid.
- **`checkPermission()`**: helper existing (`resources/js/lib/utils.js`, mirror `PermissionChecker` di backend) yang menentukan apakah user punya akses ke suatu model+aksi. Tetap dipakai sebagai filter akhir pada menu, terlepas dari Desk.
- **`RolePermission`**: model existing yang menyimpan permission per role per model (`app/Models/User/RolePermission.php`). Sumber derivasi visibility Desk system dan gate pembuatan Desk custom role-scoped.
- **`Dashboard`**: model existing (`app/Models/Core/Dashboard.php`) dengan widget ter-ordered, di-reuse sebagai dashboard tiap Desk.

## Requirements

### Requirement 1: Struktur data Desk

**User Story:** As a developer, I want struktur data Desk yang mendukung desk bawaan maupun custom (personal/role-scoped), so that navigasi bisa dikelompokkan tanpa hardcode di frontend.

#### Acceptance Criteria

1. THE sistem SHALL menyediakan tabel `desks` dengan kolom `name`, `icon`, `color` (nullable), `domain` (nullable, enum sesuai domain existing project: Core/Sales/Purchase/Inventory/Asset/Finances/Service/Helpdesk/User/Migration), `type` (enum `system`/`custom`), `owner_id` (FK `users`, nullable), `dashboard_id` (FK `dashboards`, nullable).
2. THE sistem SHALL menyediakan tabel `menu_items` dengan kolom `label`, `icon`, `route_name` (nama route Ziggy, bukan raw URL), `model` (nullable), `parent_id` (self-referencing FK, nullable), `order`, `primary_desk_id` (FK `desks`, wajib).
3. THE sistem SHALL menyediakan pivot `desk_menu_item` (`desk_id`, `menu_item_id`, `order`, `icon` nullable) untuk relasi many-to-many antara Desk dan MenuItem, dengan `icon` sebagai override tampilan icon khusus pada Desk tersebut (default memakai `menu_items.icon` bila null).
4. THE sistem SHALL menyediakan pivot `desk_user` (`desk_id`, `user_id`) untuk assignment Desk custom personal, dan pivot `desk_role` (`desk_id`, `role_id`) untuk assignment Desk custom role-scoped.
5. THE sistem SHALL menambahkan kolom `default_desk_id` (FK `desks`, nullable) pada tabel `users`.
6. WHEN suatu `Desk` dihapus (soft delete), THE sistem SHALL menghapus (cascade) seluruh baris pivot `desk_menu_item`, `desk_user`, `desk_role` yang mereferensikannya.
7. IF `users.default_desk_id` merujuk pada `Desk` yang telah dihapus atau assignment-nya dicabut, THEN THE sistem SHALL me-null-kan `default_desk_id` tersebut pada saat penghapusan/pencabutan terjadi (bukan dicek ulang pada setiap request).
8. THE MenuItem yang sudah terdaftar di `navList` (`resources/js/Components/Sidebar/AppSidebar.jsx`) saat ini SHALL dimigrasikan menjadi data seeder `menu_items` dan `desks` (domain existing) — tidak ada fitur yang hilang dari navigasi akibat migrasi ini.

### Requirement 2: Visibility Desk

**User Story:** As a user, I want hanya melihat Desk yang relevan dengan hak akses saya, so that daftar Desk tidak dipenuhi workspace yang tidak bisa saya gunakan.

#### Acceptance Criteria

1. THE Desk bertipe `system` SHALL visible ke seorang user WHEN user tersebut memiliki permission (lewat `RolePermission`) terhadap minimal satu `model` pada `MenuItem` yang terhubung ke Desk tersebut.
2. THE Desk bertipe `custom` dengan `owner_id` terisi SHALL visible HANYA ke user dengan `id` yang sama dengan `owner_id`.
3. THE Desk bertipe `custom` yang memiliki baris pada pivot `desk_role` SHALL visible ke setiap user yang memiliki salah satu role pada pivot tersebut.
4. WHERE sebuah `MenuItem` terhubung ke suatu Desk namun user pengakses tidak memiliki permission terhadap `model` milik `MenuItem` tersebut, THE sistem SHALL TIDAK menyertakan `MenuItem` tersebut dalam data yang dikirim ke frontend untuk Desk itu (difilter di server, bukan hanya disembunyikan di client).

### Requirement 3: Pembuatan Desk custom & gate permission

**User Story:** As a user, I want membuat Desk custom milik saya sendiri tanpa izin khusus, dan sebagai admin saya ingin mengontrol siapa yang bisa membuat Desk role-scoped, so that personalisasi navigasi tetap terbuka tapi Desk yang berdampak ke banyak user tetap terkontrol.

#### Acceptance Criteria

1. THE sistem SHALL mengizinkan setiap user yang terautentikasi membuat Desk custom personal (`owner_id` = dirinya sendiri) tanpa memerlukan permission tambahan apapun.
2. THE model `Desk` SHALL didaftarkan sebagai model permission (memakai trait `DataTable`, konsisten dengan model lain yang diatur lewat `RolePermission`).
3. WHEN seorang user membuat/mengassign Desk custom role-scoped (mengisi pivot `desk_role`), THE sistem SHALL mensyaratkan permission `create` pada model `Desk` lewat `RolePermission`.
4. IF user tanpa permission `create` pada model `Desk` mencoba membuat/mengassign Desk role-scoped, THEN THE sistem SHALL menolak aksi tersebut dengan response 403.
5. THE endpoint pembuatan Desk SHALL mendukung dua mode dalam satu form: TANPA `role_id` (Desk personal, `owner_id` = user, tanpa gate permission) dan DENGAN `role_id` (Desk role-scoped, `owner_id` kosong, langsung ter-assign ke role tersebut, WAJIB melalui gate permission `create` pada Acceptance Criteria 3-4).

### Requirement 4: Resolusi Desk aktif

**User Story:** As a user, I want sistem secara otomatis menentukan Desk yang relevan saat saya membuka suatu fitur, so that saya tidak perlu memilih Desk secara manual setiap saat, dan URL fitur tidak perlu membawa informasi Desk.

#### Acceptance Criteria

1. THE Desk aktif SHALL disimpan pada cookie `active_desk`, bukan pada query string atau segmen URL.
2. WHEN sebuah request masuk melalui middleware group `web` (setelah `auth` dan `EnsureUserIsOnboarded`), THE sistem SHALL menjalankan resolusi Desk aktif melalui middleware baru sebelum request mencapai route handler.
   - PENGECUALIAN: request menuju route bernama `desks.*`/`desk.*` (endpoint Desk itu sendiri — Requirement 5.3, 6.3-6.4, 3.5) SHALL DILEWATI dari resolusi ini. Route tersebut adalah satu-satunya jalan keluar bagi user yang belum memiliki Desk visible sama sekali (mis. sebelum membuat Desk personal pertamanya) — mewajibkan resolusi di titik ini akan memblokir akses ke jalan keluarnya sendiri.
3. THE resolusi Desk aktif SHALL mengikuti urutan berikut, berhenti pada langkah pertama yang menghasilkan Desk valid dan visible bagi user (sesuai Requirement 2):
   1. Nilai cookie `active_desk`, JIKA merujuk pada Desk yang valid dan visible, DAN (jika route saat ini terdaftar sebagai suatu `MenuItem`) Desk tersebut memiliki `MenuItem` untuk route saat ini di antara `menuItems()`-nya. WHERE route saat ini tidak terdaftar sebagai `MenuItem` sama sekali (mis. halaman non-menu seperti `/desks` sendiri atau halaman generik), syarat kedua ini SHALL diabaikan — cookie tetap valid berdasarkan visibility saja.
   2. `users.default_desk_id` milik user, dengan syarat kesesuaian route yang sama seperti langkah 1.
   3. `MenuItem.primary_desk_id` dari `MenuItem` yang `route_name`-nya cocok dengan nama route saat ini (exact match ATAU wildcard match, lihat Acceptance Criteria 4).
   4. Desk pertama (berdasarkan urutan tertentu yang konsisten) yang visible bagi user.
   - **Rasional**: langkah 1-2 memprioritaskan preferensi desk aktif/default milik user, TAPI hanya selama route yang sedang diakses memang tersedia di desk tersebut — desk aktif tidak boleh "menyandera" akses ke fitur yang secara struktural tidak terdaftar di desk itu (misalnya route `PurchaseRequest` diakses saat desk aktif "Service", padahal `PurchaseRequest` tidak pernah di-assign ke desk "Service"). Kegagalan syarat ini pada suatu langkah SHALL dianggap sama seperti Desk pada langkah tersebut tidak valid — resolusi lanjut ke langkah berikutnya, BUKAN berhenti dengan error.
4. THE kolom `MenuItem.route_name` SHALL mendukung pola wildcard menggunakan karakter `*` (mis. `users.*` mencakup `users.index`/`users.show`/`users.edit`/dst, `*.categories.*` mencakup route bersarang seperti `inventory.categories.index`) — SETIAP pencocokan `route_name` di seluruh Requirement 4 (AC 3.1-3.3 dan pencarian relevansi di Requirement 6 AC 4) SHALL memeriksa exact match TERLEBIH DAHULU, baru wildcard match bila tidak ada exact match. WHERE beberapa `MenuItem` dengan pola wildcard sama-sama cocok dengan satu route, THE sistem SHALL memilih `MenuItem` dengan pola PALING SPESIFIK (jumlah karakter literal — non-`*` — terbanyak; mis. `users.show` lebih spesifik dari `users.*`, `users.*` lebih spesifik dari `*`). Ini menggantikan pendekatan awal (pendaftaran manual satu-per-satu tiap non-index route) yang dinilai tidak scalable untuk 45+ `MenuItem` di seeder.
5. WHEN sebuah Desk berhasil di-resolve melalui langkah 2, 3, atau 4 pada Acceptance Criteria 3, THE sistem SHALL menulis ulang cookie `active_desk` dengan Desk hasil resolusi tersebut.
6. THE sistem SHALL membagikan (share) ke Inertia: Desk aktif, daftar Desk yang visible bagi user (untuk switcher), dan daftar `MenuItem` milik Desk aktif (untuk sidebar) — pada setiap response halaman yang melalui middleware ini.

### Requirement 5: Alur setelah login

**User Story:** As a user, I want diarahkan langsung ke Desk yang biasa saya pakai setelah login, so that saya tidak perlu langkah tambahan untuk mencapai konteks kerja saya.

#### Acceptance Criteria

1. WHEN seorang user login DAN `users.default_desk_id` miliknya valid serta visible, THE sistem SHALL mengarahkan (redirect) user langsung ke halaman dashboard Desk tersebut.
2. WHEN seorang user login DAN `users.default_desk_id` miliknya kosong, tidak valid, atau tidak visible, THE sistem SHALL mengarahkan user ke halaman `/desks`.
3. THE halaman `/desks` SHALL menampilkan seluruh Desk yang visible bagi user dalam bentuk grid card (nama, icon, warna).
4. THE setiap card Desk pada halaman `/desks` SHALL menyediakan aksi eksplisit untuk menjadikan Desk tersebut sebagai `default_desk_id` milik user — aksi ini SHALL TIDAK terjadi otomatis hanya karena user membuka/masuk ke Desk tersebut.
5. THE halaman `/desks` SHALL dapat diakses secara manual oleh user kapan pun (tidak hanya saat tanpa default desk), misalnya melalui Desk Switcher pada Navbar.

### Requirement 6: Sidebar & navigasi per Desk

**User Story:** As a user, I want sidebar menampilkan hanya menu milik Desk yang sedang aktif, so that saya tidak perlu menyaring sendiri menu yang tidak relevan.

#### Acceptance Criteria

1. THE komponen `AppSidebar.jsx` SHALL merender menu berdasarkan data `MenuItem` yang dibagikan (share) untuk Desk aktif, BUKAN dari array `navList` hardcoded seperti sebelumnya.
2. THE `AppSidebar.jsx` SHALL tetap menerapkan `checkPermission()` sebagai filter tambahan pada menu yang diterima (defense-in-depth di sisi client), sesuai perilaku existing.
3. THE Navbar SHALL menyediakan Desk Switcher yang menampilkan daftar Desk visible bagi user dan memungkinkan perpindahan Desk aktif.
4. WHEN user memilih Desk lain melalui Desk Switcher, THE sistem SHALL memperbarui cookie `active_desk` dan memuat ulang data sidebar/Desk aktif melalui partial reload Inertia, TANPA memuat ulang seluruh halaman.
   - PENGECUALIAN: IF halaman yang sedang dibuka user merujuk pada suatu `MenuItem` YANG TIDAK terdaftar pada Desk baru yang dipilih, THEN THE sistem SHALL me-redirect (navigasi penuh, bukan partial reload) ke halaman dashboard Desk baru tersebut — konsisten dengan Requirement 4 AC 3 (desk aktif tidak boleh menyandera akses ke fitur yang tidak terdaftar di desk itu, berlaku juga arah sebaliknya: pindah desk tidak boleh meninggalkan user di halaman yang sudah tidak relevan dengan desk barunya).
5. THE Navbar SHALL menyediakan tombol Home di area breadcrumb yang, WHEN diklik, mengarahkan (navigasi) user ke halaman `/desks`.

### Requirement 7: Dashboard per Desk

**User Story:** As a user, I want setiap Desk punya dashboard sendiri, so that ringkasan informasi yang saya lihat relevan dengan konteks Desk yang sedang aktif.

#### Acceptance Criteria

1. THE sistem SHALL menautkan setiap Desk ke satu `Dashboard` (model existing) melalui kolom `desks.dashboard_id`.
2. WHEN sebuah Desk diakses dan `dashboard_id` miliknya kosong, THE sistem SHALL membuat `Dashboard` kosong baru secara otomatis dan menautkannya ke Desk tersebut.
3. THE spec ini TIDAK mencakup pembuatan widget baru (chart/card query-driven, spacer, grid, link) atau kemampuan drag-drop antar tipe widget — hanya menautkan Desk ke mekanisme `Dashboard`/`DashboardWidget` yang sudah ada.

## Non-Functional / Out of Scope

- Dashboard widget builder ala ERPNext Home (chart/card berbasis query, spacer, grid, link, drag-drop lintas tipe widget) — spec lanjutan terpisah.
- Perubahan struktur URL/routing fitur existing — seluruh route tetap sama; Desk murni layer presentasi navigasi.
- Migrasi data desk/menu_items dari environment production — seeder hanya untuk data desk system baseline (lihat Requirement 1.8); tidak ada migrasi data historis lain.
- **Integrasi tampilan `Desk::resolveDashboard()` ke halaman `/dashboard-view` (`DashboardController::view()`)** — halaman itu saat ini render seluruh dashboard milik user (many-to-many `user_dashboards`), berbeda konsep dari "1 Desk = 1 Dashboard" (Requirement 7). Keputusan bagaimana keduanya digabung (union vs replace) sengaja ditunda oleh user (2026-08-19) — spec ini hanya menyediakan mekanisme `resolveDashboard()` di model `Desk` (Requirement 7 AC 1-2), belum di-wire ke UI manapun.
