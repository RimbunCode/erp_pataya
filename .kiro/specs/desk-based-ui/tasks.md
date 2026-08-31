# Implementation Plan: Desk-Based UI

## Overview

Implementasi berjalan bottom-up: skema DB & model dasar dulu (tanpa dependency), lalu `DeskResolverService` (logic murni, testable terisolasi tanpa HTTP), lalu middleware yang memakainya, lalu Controller + endpoint, lalu seeder migrasi `navList` → data, baru terakhir frontend (sidebar dinamis, Desk Switcher, halaman `/desks`, tombol Home) yang menyatukan semuanya. Checkpoint jalan di tiap wave besar, bukan ditumpuk di akhir.

## Tasks

- [x] 1. Skema database & Enum dasar
  - [x] 1.1 Buat enum `App\Enums\Domain` dan `App\Enums\DeskType`
    - `app/Enums/Domain.php`: TitleCase keys — `Core`, `Sales`, `Purchase`, `Inventory`, `Finances`, `Service`, `Helpdesk`, `User`, `Migration`
    - `app/Enums/DeskType.php`: TitleCase keys — `System`, `Custom`
    - _Requirements: 1.1_

  - [x] 1.2 Migration `create_desks_table`
    - Kolom sesuai design.md Data Models: `id` (ulid PK), `name`, `icon`, `color` (nullable), `domain` (nullable), `type`, `owner_id` (FK users, nullable, `nullOnDelete`), `dashboard_id` (FK dashboards, nullable, `nullOnDelete`), `softDeletes()`, `timestamps()`
    - _Requirements: 1.1_

  - [x] 1.3 Migration `create_menu_items_table`
    - Kolom: `id` (ulid PK), `label`, `icon`, `route_name`, `model` (nullable), `parent_id` (FK menu_items, nullable, `nullOnDelete`), `order`, `primary_desk_id` (FK desks, **wajib**, tanpa nullable, `cascadeOnDelete` — lihat catatan implementasi), `softDeletes()`, `timestamps()`
    - **Catatan implementasi**: `primary_desk_id` pakai `cascadeOnDelete()` (bukan `nullOnDelete`) karena kolom non-nullable — jika Desk pemiliknya dihapus, MenuItem tersebut ikut terhapus (bukan orphan tanpa primary desk)
    - _Requirements: 1.2_

  - [x] 1.4 Migration `create_desk_menu_item_table`, `create_desk_user_table`, `create_desk_role_table`
    - Ketiganya pivot, FK `cascade` penuh (bukan `nullOnDelete`) — lihat design.md catatan cascade vs nullOnDelete
    - `desk_menu_item`: tambah kolom `order`, `icon` (nullable)
    - **Catatan implementasi**: `cascadeOnDelete()` DB-level TIDAK terpicu oleh soft-delete (`Desk` pakai `SoftDeletes`, jadi `delete()` = UPDATE bukan DELETE) — cascade pivot aktual dilakukan lewat listener `DetachDeskAssignments` (lihat 1.7), bukan mengandalkan FK constraint semata
    - _Requirements: 1.3, 1.4_

  - [x] 1.5 Migration tambah kolom `default_desk_id` pada tabel `users`
    - FK ke `desks`, nullable, `nullOnDelete`
    - **Catatan implementasi**: SQLite alter table pada `users` gagal karena VIEW `assignables` (dibuat migration lain) mereferensikan tabel ini — SQLite legacy-alter butuh rename tabel yang tidak bisa terjadi selama masih direferensikan view. Fix: migration ini drop view sebelum alter, recreate setelahnya (guard `DB::getDriverName() === 'sqlite'`, MySQL production tidak terpengaruh)
    - _Requirements: 1.5_

  - [x] 1.6 Model `App\Models\Core\Desk` dan `App\Models\Core\MenuItem`
    - `Desk`: trait `DataTable, HasFactory, HasUlids, SoftDeletes`; relasi `menuItems()`, `owner()`, `dashboard()`, `users()`, `roles()` — lihat design.md Components and Interfaces untuk signature lengkap
    - `MenuItem`: trait `HasFactory, HasUlids, SoftDeletes` (TANPA `DataTable`); relasi `parent()`, `children()`, `primaryDesk()`, `desks()`
    - **Catatan implementasi**: relasi many-to-many `menuItems()`/`users()`/`roles()`/`desks()` pakai `->using()` dengan custom Pivot model (`DeskMenuItem`, `DeskUser`, `DeskRole` — pola sama `App\Models\UserDashboard`) karena pivot pakai ulid PK; `attach()` polos tanpa custom Pivot tidak mengisi kolom `id` (ulid hanya auto-generate lewat model event `HasUlids`, bukan lewat query builder insert biasa)
    - Tambah relasi `defaultDesk()` di `App\Models\User\User` (pola sama `defaultBranch()`)
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 1.7 Event `DeskDeleted` + listener (bukan Observer — sesuai aturan project: side-effect baru pakai Event/Listener)
    - `App\Events\Core\DeskDeleted` di-dispatch dari `Desk::booted()` pada hook `static::deleting()`
    - `App\Listeners\Core\Desk\ClearDefaultDeskForUsers` — null-kan `users.default_desk_id` yang mengarah ke Desk dihapus
    - `App\Listeners\Core\Desk\DetachDeskAssignments` — detach pivot `menuItems`/`users`/`roles` (menggantikan cascade FK yang tidak terpicu oleh soft-delete, lihat catatan 1.4)
    - Registrasi manual di `EventServiceProvider::$listen` (auto-discover di-disable via `withEvents(discover:false)` di `bootstrap/app.php`)
    - _Requirements: 1.7_

  - [x] 1.8 Write unit test model & listener
    - **Test: relasi pivot `Desk`/`MenuItem`** — `menuItems()`, `desks()`, `users()`, `roles()` mengembalikan data benar termasuk kolom pivot (`order`, `icon`)
    - **Test: cascade delete pivot saat Desk dihapus** — `desk_menu_item`/`desk_user`/`desk_role` ikut terhapus (lewat listener, bukan FK cascade murni)
    - **Test: listener null-kan `default_desk_id`** — user dengan `default_desk_id` mengarah ke Desk yang dihapus, assert jadi `null` setelahnya; user lain dgn default desk berbeda TIDAK terpengaruh
    - **Test: cast enum** — `type`/`domain` ter-cast ke `DeskType`/`Domain` setelah `refresh()`
    - **Validates: Requirements 1.6, 1.7** — `tests/Feature/Core/DeskModelTest.php`, 6 test PASS (12 assertions)

- [x] 2. Checkpoint - Pastikan skema & model dasar tests pass
  - `php artisan test --compact tests/Feature/Core/DeskModelTest.php` — 6 passed (12 assertions). Migration jalan bersih di SQLite in-memory (test suite), termasuk fix workaround view `assignables`.

- [x] 3. `DeskResolverService`
  - [x] 3.1 Buat `App\Services\Core\Desk\DeskResolverService`
    - Method `resolve(Request $request, User $user): Desk`, `visibleDesksFor(User $user): Collection` — lihat design.md pseudocode lengkap
    - `fromCookie()`, `fromUserDefault()`, `fromCurrentRoute()`, `firstVisible()` — private, sesuai fallback chain Requirement 4 AC 3 (4 langkah: cookie → default → route_name → first-visible; fallback by-model DIHAPUS dari scope, lihat catatan design.md "Keputusan yang direvisi")
    - `visibleDesksFor()`: Desk system → visible jika user punya permission ke ≥1 `MenuItem`-nya (pakai `PermissionChecker`); Desk custom → visible jika `owner_id` = user ATAU ada baris `desk_role` yang role-nya dimiliki user
    - **Catatan implementasi**: `PermissionChecker::forUser($request)` TIDAK dipakai — method itu resolve dari `$request->user()` (user request/session aktif), bukan parameter `$user` yang di-pass ke `visibleDesksFor()`. Dipakai `new PermissionChecker(AppMiddleware::resolvePermissionsFor($user->id))` langsung agar hasil murni fungsi dari parameter, tidak bergantung diam-diam pada auth state global — juga menghindari bug nyata jika `visibleDesksFor()` dipanggil untuk user selain yang sedang login
    - **Catatan implementasi**: query `visibleDesksFor()` butuh guard eksplisit `whereRaw('1=0')` saat `accessibleModels()` kosong — closure `where()` kosong pada query builder Laravel TIDAK menghasilkan "tidak match apa pun", melainkan tidak menambah constraint sama sekali (match semua row)
    - **Bug ditemukan & diperbaiki (feedback user langsung, 2026-08-20)**: fallback chain awal cuma validasi Desk kandidat (cookie/default) "ada & visible", TIDAK validasi apakah route yang sedang diakses relevan dengan Desk itu — akibatnya desk aktif "menyandera" akses ke fitur di desk lain (contoh dilaporkan: desk aktif "Service", akses `/purchaseRequests` — desk tetap "Service" walau `PurchaseRequest` tidak terdaftar di sana sama sekali). **Requirements.md diperbarui** (Requirement 4 AC 3.1-3.2) untuk menegaskan syarat relevansi ini secara eksplisit — gap ada di teks requirement, bukan cuma implementasi. Fix: `fromCookie()`/`fromUserDefault()` diganti pemanggilannya ke `visibleAndRelevant()` (bukan `visible()` polos) — method baru yang, SELAIN cek visible, juga cek `$menuItem->desks()->where('desks.id', $desk->id)->exists()` untuk `MenuItem` yang cocok dengan route saat ini (kalau route tidak terdaftar sebagai `MenuItem` sama sekali, syarat relevansi diabaikan — bukan berarti gagal)
    - _Requirements: 4.1, 4.2, 4.3, 2.1, 2.2, 2.3_

  - [x] 3.2 Write unit test `DeskResolverService`
    - **Test: fallback chain berhenti di langkah pertama valid** — kombinasi cookie valid/invalid × default valid/invalid × route match/tidak, assert hasil `resolve()` sesuai langkah pertama yang valid, TIDAK lompat ke langkah berikutnya
    - **Test: `visibleDesksFor()` untuk Desk system** — user dengan permission ke 1 `MenuItem` → Desk visible; user tanpa permission apa pun ke `MenuItem` Desk itu → tidak visible
    - **Test: `visibleDesksFor()` untuk Desk custom personal** — hanya owner yang melihatnya
    - **Test: `visibleDesksFor()` untuk Desk custom role-scoped** — user dengan role terkait melihatnya, user lain tidak
    - **Property test: idempotensi** — dua kali `resolve()` berurutan dengan state sama menghasilkan Desk yang sama
    - **Test: throws saat user tanpa Desk accessible sama sekali** (`\RuntimeException`, lihat design.md Error Handling)
    - **Validates: Requirements 4.1, 4.2, 4.3, 2.1, 2.2, 2.3 — Property 1, Property 2, Property 3 (design.md)** — `tests/Feature/Core/DeskResolverServiceTest.php`, 9 test PASS (12 assertions)

- [x] 4. Checkpoint - Pastikan DeskResolverService tests pass
  - `php artisan test --compact tests/Feature/Core/DeskResolverServiceTest.php` — 9 passed (12 assertions).

- [x] 5. Middleware `ResolveActiveDesk`
  - [x] 5.1 Buat `App\Http\Middleware\ResolveActiveDesk`
    - Inject `DeskResolverService`, panggil `resolve()`, set cookie `active_desk` (30 hari) via `$next($request)->withCookie(cookie(...))` (pola konsisten `LanguageMiddleware`, bukan `Cookie::queue()` di titik "before")
    - `buildMenuTree($desk, $user)`: bentuk output identik `navList` (`{title, icon, url, urlPattern, model, items[]}`), filter `MenuItem` yang modelnya tidak accessible via `PermissionChecker` (Requirement 2 AC 4)
    - Resolusi `icon`: top-level pakai override `desk_menu_item.icon` (fallback `menu_items.icon`); child/nested TIDAK mewarisi pivot icon (pivot hanya relevan di assignment desk-level top, bukan struktur nested)
    - Resolusi `url` dari `route($menuItem->route_name)`, catch `Symfony\Component\Routing\Exception\RouteNotFoundException` (BUKAN `Illuminate\Routing\Exceptions\UrlGenerationException` — exception asli yang dilempar `UrlGenerator::route()` saat nama route tak terdaftar) → skip item + log warning
    - `Inertia::share(['activeDesk' => ..., 'deskList' => ..., 'menuItems' => ...])`
    - _Requirements: 4.5, 4.6, 2.4_

  - [x] 5.2 Registrasi middleware
    - Alias `'desk' => ResolveActiveDesk::class` di `bootstrap/app.php`
    - Ditambahkan ke grup middleware `routes/web.php`: `Route::middleware(['auth', 'lang', 'onboarded', 'app', 'desk'])`
    - _Requirements: 4.2_

  - [x] 5.3 Write feature test `ResolveActiveDeskTest`
    - **Test: cookie `active_desk` ter-set/refresh pada response** setelah request melalui middleware
    - **Test: props Inertia `activeDesk`/`deskList`/`menuItems`** ter-share dengan bentuk & isi benar
    - **Test: `MenuItem` dengan `route_name` tidak terdaftar** tidak menggagalkan seluruh render (item di-skip)
    - **Catatan implementasi**: test butuh `withCookie('lang', 'en')` (middleware `lang` di grup route redirect ke `/lang` tanpa cookie ini) dan `withoutMiddleware([QueryDetectorMiddleware::class])` di `setUp()` — paket `beyondcode/laravel-query-detector` menghapus binding `viewData()` yang dipakai `assertInertia()` dalam test environment (bug pre-existing project, pola workaround sudah dipakai `StockLedgerControllerTest` dkk, bukan ditemukan/dibuat baru di sini)
    - **Validates: Requirements 4.5, 4.6, 2.4** — `tests/Feature/Core/ResolveActiveDeskTest.php`, 3 test PASS (31 assertions)

- [x] 6. Checkpoint - Pastikan middleware tests pass
  - `php artisan test --compact tests/Feature/Core/ResolveActiveDeskTest.php` — 3 passed (31 assertions).

- [x] 7. `DeskController` & permission gate
  - [x] 7.1 Daftarkan `Desk` sebagai model permission
    - **Sepenuhnya otomatis, tanpa kode tambahan**: `PermissionSeeder::run()` men-scan seluruh class `App\Models` yang pakai trait `DataTable` (`class_uses_recursive()`) dan panggil `$className::initPermissions()` (`app/Traits/DataTable.php:464`). Karena `Desk` (task 1.6) sudah pakai `DataTable`, otomatis eligible diberi `RolePermission`.
    - _Requirements: 3.2_

  - [x] 7.2 Buat `App\Http\Controllers\Core\DeskController`
    - TIDAK extends base `Controller` abstract (permission-check generiknya untuk CRUD model standar, tidak cocok endpoint custom dengan aturan visibility sendiri)
    - `index()` — Inertia render `Core/DeskList`, props `visibleDesksFor()` + flag `isDefault`
    - `store(Request $request)` — dua mode: tanpa `role_id` → Desk personal (tanpa gate); dengan `role_id` → Desk role-scoped baru (gate `Desk.create`) — **ditambah dari desain awal**, lihat Requirement 3 AC 5 (klarifikasi user selama implementasi: bagaimana user ber-permission membuat Desk role-scoped dari nol, bukan cuma assign role ke Desk existing)
    - `switch(Request $request)` — validasi visibility via `visibleDesksFor()`, set cookie via `back()->withCookie(...)`, 403 bila tidak visible
    - **Revisi (feedback user langsung, 2026-08-20)**: `switch()` sekarang bisa redirect ke `route('dashboard')` (bukan selalu `back()`) — dicek via `currentPageIrrelevantToDesk()`: resolve nama route dari header `Referer` (lewat `Route::getRoutes()->match()` atas `Request` sintetis dari URL Referer, catch `ResourceNotFoundException`), cari `MenuItem` untuk route itu, cek apakah `MenuItem` tersebut terdaftar di Desk TUJUAN (bukan Desk asal) — kalau TIDAK terdaftar, redirect ke dashboard; kalau Referer tidak dapat di-resolve atau route tidak terdaftar sebagai `MenuItem` sama sekali, dianggap tetap relevan (`back()` seperti semula). Requirement baru ditambahkan (Requirement 6 AC 4 pengecualian) untuk menegaskan ini di requirements.md. Sisi frontend (`DeskSwitcher.jsx`) turut disesuaikan: `onSuccess` callback `router.post()` sekarang cek `window.location.pathname` sebelum vs sesudah request — kalau URL berubah (server sudah redirect), skip `router.reload()` manual (sudah otomatis fresh via Inertia mengikuti redirect)
    - `setDefault(Request $request, Desk $desk)` — validasi visibility, update `users.default_desk_id`, 403 bila tidak visible
    - `storeRoleScoped(Request $request, Desk $desk)` — assign Desk **existing** ke role tambahan (beda dari `store()` mode role_id yang bikin Desk baru), gate `Desk.create` sama
    - _Requirements: 2.4, 3.1, 3.3, 3.4, 3.5, 5.4_

  - [x] 7.3 Routes `/desks`, `/desk/switch`, `/desk/{desk}/default`, `/desk/{desk}/roles`
    - Named routes (`desks.index`, `desks.store`, `desk.switch`, `desk.setDefault`, `desk.roles.store`) — daftarkan di `routes/web.php` dalam grup middleware yang sudah termasuk `desk` (task 5.2)
    - _Requirements: 5.2, 5.3, 5.5_

  - [x] 7.4 Write feature test `DeskControllerTest`
    - **Test: `switch()` sukses untuk Desk visible, 403 untuk Desk tidak visible**
    - **Test: `setDefault()` sukses untuk Desk visible, 403 untuk Desk tidak visible**
    - **Test: user tanpa permission `Desk.create` tetap bisa buat Desk personal, tapi 403 untuk assign role-scoped**
    - **Test: user DENGAN permission `Desk.create` bisa assign role-scoped**
    - **Bug ditemukan & diperbaiki selama task ini**: `ResolveActiveDesk` middleware men-throw exception (`firstVisible()`) untuk user yang benar-benar belum punya Desk visible — ini memblokir akses ke `desks.store` itu sendiri (satu-satunya jalan keluar dari kondisi tsb). Fix: middleware skip resolusi sepenuhnya untuk route bernama `desk.*`/`desks.*` (lihat design.md "Pengecualian resolusi untuk route Desk sendiri", requirements.md Requirement 4 AC 2 pengecualian)
    - **Validates: Requirements 2.4, 3.1, 3.3, 3.4, 3.5 — Property 4 (design.md)** — `tests/Feature/Core/DeskControllerTest.php`, 7 test PASS (14 assertions)

- [x] 8. Checkpoint - Pastikan DeskController tests pass
  - `php artisan test --compact tests/Feature/Core/DeskControllerTest.php` — 7 passed (14 assertions). Regresi ulang `ResolveActiveDeskTest`/`DeskResolverServiceTest`/`DeskModelTest` setelah fix middleware — 18 passed (55 assertions), tidak ada regresi.

- [x] 9. Dashboard per Desk
  - [x] 9.1 Auto-create `Dashboard` kosong saat Desk diakses tanpa `dashboard_id`
    - Method eksplisit `Desk::resolveDashboard()` (BUKAN accessor otomatis pada relasi `dashboard()` biasa — auto-create harus dipanggil sengaja oleh Controller, bukan side-effect tiap kali relasi diakses, termasuk dari Tinker/seeder)
    - **Keputusan ditunda user (2026-08-19)**: integrasi ke `DashboardController::view()` (halaman `/dashboard-view` existing render seluruh dashboard user via `user_dashboards`, konsep berbeda dari "1 Desk = 1 Dashboard") sengaja TIDAK dikerjakan di task ini — lihat requirements.md bagian Out of Scope. Task ini hanya menyediakan mekanisme model-nya.
    - _Requirements: 7.1, 7.2_

  - [x] 9.2 Write feature test `DeskDashboardTest`
    - **Test: Desk baru tanpa `dashboard_id` → dashboard kosong otomatis dibuat & tertaut saat `resolveDashboard()` dipanggil**
    - **Test: Desk dengan `dashboard_id` sudah ada → tidak membuat duplikat**
    - **Validates: Requirements 7.1, 7.2** — `tests/Feature/Core/DeskDashboardTest.php`, 2 test PASS (4 assertions)

- [x] 10. Seeder migrasi `navList` → data
  - [x] 10.1 Buat seeder Desk system (10 domain, termasuk `Asset` — lihat 10.2)
    - Satu `Desk` per domain (`Core`, `Sales`, `Purchase`, `Inventory`, `Asset`, `Finances`, `Service`, `Helpdesk`, `User`, `Migration`), `type = System`
    - _Requirements: 1.8_

  - [x] 10.2 Petakan seluruh entri `navList` (`resources/js/Components/Sidebar/AppSidebar.jsx`) jadi baris `menu_items` + `desk_menu_item`
    - `database/seeders/DeskSeeder.php` — seluruh 13 grup `navList` (Dashboard, Inventories, Assets, Services, Purchases, Customers, Sales, Finances, Approvals, Users, Tickets, ToDo, Logs, Settings), 45 `MenuItem` total, `route_name` diverifikasi terhadap `php artisan route:list` (bukan tebakan)
    - Assignment lintas-desk (interpretasi domain-natural, dijalankan tanpa menunggu approval eksplisit karena murni soal prioritas tampilan bukan correctness struktural — dilaporkan ke user untuk direvisi bila perlu): `Item`/`Warehouse` → Inventory+Sales+Purchase; `PurchaseReceipt` → Purchase+Inventory; `DeliveryNote` → Inventory+Sales; `AssetService` → Asset+Service; `Customer` → Sales+Finances; `PurchaseInvoice`/`SalesInvoice` → Finances+Purchase/Sales; `Dashboard`/`Approvals`/`ToDo` → seluruh desk (lintas-domain by nature)
    - **Domain `Asset` ditambahkan ke enum `Domain`** (keputusan user selama implementasi) — grup navList "Assets" tidak punya representasi di 9 domain awal CLAUDE.md
    - **Bug ditemukan & diperbaiki (feedback user langsung, 2026-08-20)**: route non-index (`users.show`, `.edit`, `.destroy`, dst — semua route selain `.index`) TIDAK ter-resolve ke desk manapun, karena seeder cuma daftarkan `route_name` literal `{resource}.index`, dan `DeskResolverService`/`DeskController` cocokkan `route_name` exact-match. Dilaporkan via contoh nyata: akses `/users/{id}` (route `users.show`) tidak mengarahkan ke desk "User Management". **Requirements.md diperbarui** (Requirement 4 AC 4 ditulis ulang total) untuk mendukung pola wildcard `*` pada `MenuItem.route_name` (mis. `users.*`, `*.categories.*`), menggantikan pendekatan awal (pendaftaran manual satu-per-satu tiap non-index route — dinilai tidak scalable untuk 45+ `MenuItem`). Implementasi: method baru `MenuItem::forRoute(string $routeName): ?MenuItem` (exact match diprioritaskan, baru `fnmatch()` wildcard, dipilih yang PALING SPESIFIK — jumlah karakter literal terbanyak — bila beberapa pola cocok sekaligus) menggantikan `MenuItem::where('route_name', ...)` di `DeskResolverService::fromCurrentRoute()`/`visibleAndRelevant()` DAN `DeskController::currentPageIrrelevantToDesk()`. **Seluruh 50 baris `menuItem()` di `DeskSeeder.php` diganti dari `{resource}.index` ke `{resource}.*`** (regex bulk-replace, diverifikasi tidak ada risiko false-match krn wildcard match SELURUH string route name, prefix mirip antar-resource beda tidak collide) — otomatis mencakup semua route CRUD standar (show/edit/create/destroy/dst) tanpa daftar manual
    - _Requirements: 1.8, 4.4_

  - [x] 10.3 Write feature test `DeskSeederTest`
    - **Test: 10 Desk system terbuat** (satu per domain, termasuk Asset)
    - **Test: setiap `route_name` di `menu_items` hasil seeder valid** (resolvable lewat `route()`)
    - **Test: seeder idempotent saat dijalankan dua kali** (`firstOrCreate`/`updateOrCreate`, tidak duplikat)
    - **Test: `Item` ter-assign ke Desk Sales maupun Inventory** (verifikasi contoh eksplisit requirements.md)
    - **Validates: Requirements 1.8** — `tests/Feature/Core/DeskSeederTest.php`, 4 test PASS (6 assertions)

- [x] 11. Checkpoint - Pastikan seeder tests pass & data lengkap
  - `php artisan test --compact tests/Feature/Core/DeskSeederTest.php` — 4 passed (6 assertions). Verifikasi manual seluruh 50 `route_name` terhadap `php artisan route:list --json` — tidak ada yang missing.

- [x] 12. Frontend — sidebar dinamis & Desk Switcher
  - [x] 12.1 Buat `resources/js/lib/deskIcons.jsx`
    - **Catatan implementasi**: ekstensi `.jsx` (bukan `.js` seperti direncanakan) — file mengandung JSX (2 icon custom SVG inline: `ServiceIcon`, `CustomerIcon`, dipindah dari `navList` lama yang tidak punya representasi `lucide-react`), konvensi project mensyaratkan `.jsx` untuk file yang render JSX (lihat `resources/js/lib/inertiaToast.jsx`)
    - Map nama string → komponen `lucide-react` + 2 custom SVG, mencakup seluruh icon yang dipakai `navList` lama
    - _Requirements: 6.1_

  - [x] 12.2 Modifikasi `resources/js/Components/Sidebar/AppSidebar.jsx`
    - Hapus const `navList` hardcoded; ambil `menuItems` dari `usePage().props`, resolve `item.icon` (string, termasuk rekursif ke `item.items`) lewat `deskIcons.jsx` sebelum diteruskan ke `NavMain`
    - `NavMain.jsx` TIDAK diubah (kontrak props sudah sama bentuknya)
    - _Requirements: 6.1, 6.2_

  - [x] 12.3 Buat `resources/js/Components/Sidebar/DeskSwitcher.jsx`
    - **Catatan implementasi**: TIDAK reuse struktur `BranchSwitcher.jsx` apa adanya — `BranchSwitcher` pakai `SidebarMenuButton`/`useSidebar` yang cuma valid dalam context provider `<Sidebar>` (dia ditempatkan di `SidebarHeader`, bukan Navbar). Karena Requirement 6.3 minta Desk Switcher di Navbar (bukan sidebar), `DeskSwitcher.jsx` ditulis pakai dropdown biasa (`Button` + `DropdownMenu`) tanpa dependency Sidebar context
    - On-select → `POST desk.switch` + `router.reload({only:['activeDesk','deskList','menuItems']})`
    - Ditempatkan di `Navbar.jsx`
    - **Revisi desain putaran 3 (feedback user langsung, 2026-08-19)**: sempat dipindah ke `SidebarHeader` (styling `SidebarMenuButton` identik `BranchSwitcher`) lalu DIBATALKAN — user putuskan tetap di Navbar, tapi posisinya di DALAM breadcrumb, sesudah tombol Home (`Home > DeskSwitcher > breadcrumb-path...`). Restyle: `<button>` native compact (bukan `SidebarMenuButton`/shadcn `Button`). Grup `Home`+`DeskSwitcher` dibungkus `Breadcrumb`/`BreadcrumbList`/`BreadcrumbItem`/`BreadcrumbSeparator` resmi (bukan `div`+`ChevronRight` manual) — markup semantik benar (`nav[aria-label=breadcrumb] > ol > li`), separator otomatis dari komponen
    - **Revisi desain putaran 4 (feedback user langsung, 2026-08-19)**: hapus icon `ChevronsUpDown`, tambah `cursor-pointer`, hapus `focus-visible`/`data-[state=open]` bg residual — cuma `hover:bg-muted` + `outline-none`
    - **Revisi desain putaran 5 (feedback user langsung, 2026-08-19)**: icon desk (`resolveIcon()`, dari `lib/deskIcons.jsx`) tidak menerima prop size — dibungkus `[&>svg]:size-4` di `className` trigger agar seragam persis dengan icon `Home` (diverifikasi `getBoundingClientRect()`: 16×16px keduanya)
    - **Eksperimen putaran 4-6 (interaksi hover+lock) DIBATALKAN sepenuhnya (2026-08-20)**: sempat diimplementasikan `open`/`onOpenChange` controlled state + `onMouseEnter`/`onMouseLeave` (auto-open/close via hover) + klik untuk "mengunci" dropdown terbuka. Selama implementasi ditemukan bug kritis `ReferenceError` (rename fungsi tanpa update pemanggil JSX — root cause "glitch" yang dilaporkan, BUKAN soal CSS/timing) dan detail teknis Radix `DropdownMenuTrigger` (`onPointerDown` internal yang butuh `onPointerDownCapture` untuk di-intercept, bukan `onClick`) — keduanya berhasil diperbaiki & diverifikasi bekerja (lihat riwayat commit/diff sesi ini), TAPI user memutuskan kompleksitas ini tidak diperlukan. **Final: kembali ke `DropdownMenu` uncontrolled murni** (tanpa `open`/`onOpenChange`, tanpa `useState`/`useRef`/handler kustom) — perilaku default Radix, klik toggle buka/tutup, klik-luar/Escape/pilih-item tutup. Pelajaran dicatat untuk sesi mendatang: kalau kebutuhan serupa muncul lagi, source `@radix-ui/react-dropdown-menu` di `node_modules` adalah referensi tercepat untuk memahami event internal sebelum menulis workaround
    - _Requirements: 6.3, 6.4_

  - [x] 12.4 Tambah tombol Home di `Navbar.jsx`
    - `<Link href={route('desks.index')}>` dengan icon `Home` (lucide-react), ditempatkan sebelum `breadcrumbsMenu`, di luar `BreadcrumbList`
    - **Revisi (putaran 3)**: sekarang di DALAM `BreadcrumbItem`/`BreadcrumbLink` bersama `DeskSwitcher` (lihat 12.3) — bukan lagi elemen `Link` polos di luar breadcrumb
    - _Requirements: 6.5_

  - [x] 12.6 Pindahkan `LanguageSwitcher`/`ToggleTheme`/`ChangelogBadge` dari Navbar ke `UserInfo` dropdown (feedback user, 2026-08-19)
    - **Tidak** memodifikasi `LanguageSwitcher.jsx`/`ToggleTheme.jsx` existing — keduanya dipakai di 5 tempat lain (Login/Register/SetupUser/halaman Language + Navbar). Dibuat 2 komponen baru: `LanguageSwitcherSub.jsx`, `ToggleThemeSub.jsx` — struktur `DropdownMenuSub`/`DropdownMenuSubTrigger`/`DropdownMenuSubContent` (Radix resmi, bukan `DropdownMenu` bersarang mentah) supaya submenu buka tanpa nutup dropdown `UserInfo` duluan
    - `ChangelogBadge` (sebelumnya fungsi lokal di `Navbar.jsx`, tidak di-export) dipindah total jadi `DropdownMenuItem` biasa di `UserInfo.jsx` (bukan submenu — murni link navigasi, badge count tetap tampil sbg span di kanan item)
    - `UserInfo.jsx` struktur akhir: Label (info user) → separator → grup "Manage Account" → separator → grup baru (Bahasa/Tema/Changelog) → separator → "Log out"
    - Tambah key locale baru `theme.theme` (`lang/en/theme.php`, `lang/id/theme.php`) — sebelumnya cuma ada `light`/`dark`/`system`, belum ada label utk trigger submenu itu sendiri. `LocaleKeysTest` tetap PASS (key tersinkron kedua locale)
    - _Requirements: (di luar requirements.md formal — permintaan UX tambahan user selama implementasi)_

  - [x] 12.5 Verifikasi manual browser (pengganti test frontend otomatis)
    - Tidak ada test otomatis JS — proyek tidak punya infra test JS untuk komponen React (dikonfirmasi: tidak ada `*.test.jsx`, hanya `*.test.js` untuk util murni)
    - **Percobaan awal via `composer run dev:simple`/Herd gagal** (port 8000-8008 semua gagal listen — waktu itu disimpulkan sebagai keterbatasan sandbox). **Berhasil diverifikasi ulang setelah user menyalakan permission tambahan**: `php artisan serve` dipanggil langsung (bukan lewat `npx concurrently`) berhasil listen normal — root cause aslinya di wrapper `concurrently`/npm, bukan sandbox network. Perlu `npm run build` (production, bukan `npm run dev`) karena Vite dev server juga tidak bisa dipakai di sandbox, dan hapus file `public/hot` (sisa proses `npm run dev` sebelumnya yang membuat Laravel mengarah ke asset dev-server yang sudah mati)
    - **Verifikasi via `mcp__Claude_Browser__*` (accessibility tree, bukan screenshot pixel — pane tidak displayed ke user) terhadap seluruh alur end-to-end**: login (`admin`/`admin`) → redirect `/desks` (belum ada `default_desk_id`) → grid card 7 Desk system visible sesuai permission role "System Manager" → klik card Sales → masuk dashboard dengan sidebar berisi 10 `MenuItem` sesuai seeder (termasuk `Item`/`Warehouse` lintas-domain) → Desk Switcher di navbar menampilkan 7 desk, pilih Inventory → sidebar berganti total tanpa full-page-reload (partial reload Inertia terbukti jalan) → `/desks` → dropdown "Opsi desk" → "Jadikan Default" → `default_desk_id` ter-update (dikonfirmasi dari payload response Inertia, bukan cuma asumsi UI) → badge "Default" pindah ke card yang benar
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 13. Frontend — halaman `/desks` & alur login
  - [x] 13.1 Buat `resources/js/Pages/Core/DeskList.jsx`
    - Grid card (shadcn `Card`/`Badge`): icon (via `deskIcons.jsx`), nama, warna, badge "Default" bila `isDefault`, tombol "Jadikan Default" (`POST desk.setDefault`, disembunyikan bila sudah default)
    - Klik card (selain tombol, `event.stopPropagation()` di tombol) → `POST desk.switch` lalu `router.visit()` ke dashboard Desk
    - **Revisi desain putaran 1 (verifikasi visual browser, 2026-08-19)**: (a) `AppLayout` dapat prop `hideSidebar` — halaman `/desks` render tanpa `AppSidebar` (elemen `<Sidebar>` dikondisikan, `SidebarProvider` tetap membungkus agar context `useSidebar()` tersedia untuk `BranchSwitcher`/`SidebarTrigger` di manapun dipakai); (b) `Navbar` dapat prop `hideSidebar` — saat `true`, sembunyikan `SidebarTrigger` + tombol Home + separator terkait, dan render `BranchSwitcher` (dipindah dari `SidebarHeader`) di sisi kanan sejajar `DeskSwitcher`; (c) tombol "Jadikan Default" pindah dari tombol permanen di card body ke `DropdownMenu` (trigger ikon `EllipsisVertical`, pojok kanan atas card header) — `stopPropagation()` di trigger dan content dropdown agar tidak memicu klik-card (`desk.switch`)
    - **Revisi desain putaran 2 (feedback user langsung, 2026-08-19)**: (a) `BranchSwitcher` dapat prop `className` (di-teruskan ke `SidebarMenu`, plus `w-full` di `SidebarMenuButton`) — dipindah dari sisi kanan Navbar (sejajar `DeskSwitcher`) ke sisi kiri (sebelum `breadcrumbsMenu`), lebar `w-full max-w-64`; (b) card grid `DeskList.jsx` diganti total dari shadcn `Card` (kotak, border, header/content terpisah) jadi `div` polos tanpa border — layout icon besar (`size-16 rounded-2xl`) di atas, label + badge "Default" di bawah (vertical stack, center-aligned), grid lebih rapat (`grid-cols-2` s/d `grid-cols-6` — cocok utk banyak item kecil, bukan card lebar); dropdown "Opsi desk" jadi overlay `absolute top-1 right-1` dengan `opacity-0 group-hover:opacity-100` (muncul saat hover/focus/dropdown-terbuka, konsisten pola file-manager icon-grid)
    - _Requirements: 5.3, 5.4, 5.5_

  - [x] 13.2 Modifikasi alur redirect setelah login
    - `app/Http/Controllers/Auth/AuthenticatedSessionController.php` (Breeze) — method baru `postLoginRedirectUrl(User $user)`, dipanggil dari KEDUA titik redirect existing: `store()` (login password) dan `handleProviderCallback()` (OAuth Socialite) — requirement "setelah login" mencakup kedua alur, bukan cuma password
    - WHEN `default_desk_id` valid & visible (via `DeskResolverService::visibleDesksFor()`) → redirect ke dashboard; WHEN tidak → redirect ke `route('desks.index')`
    - _Requirements: 5.1, 5.2_

  - [x] 13.3 Write feature test `LoginRedirectDeskTest`
    - **Catatan implementasi**: route `POST /login` TIDAK punya nama (`Route::post('login', ...)` tanpa `->name()`) — test pakai path literal `/login`, bukan `route('login.store')`. Field form login adalah `usernameOrEmail` (bukan `username`/`email` terpisah — `LoginRequest` auto-detect tipe input)
    - **Test: login dengan `default_desk_id` valid → redirect ke dashboard Desk tersebut**
    - **Test: login tanpa `default_desk_id` → redirect ke `/desks`**
    - **Test: login dengan `default_desk_id` tidak visible (desk milik user lain) → redirect ke `/desks`**
    - **Validates: Requirements 5.1, 5.2** — `tests/Feature/Core/LoginRedirectDeskTest.php`, 3 test PASS (6 assertions)

- [x] 14. Checkpoint - Full regression & verifikasi manual browser
  - **Regresi serius ditemukan & diperbaiki**: middleware `desk` didaftarkan di grup route besar yang dipakai HAMPIR SEMUA route existing (`routes/web.php`). `DeskResolverService::firstVisible()` melempar `\RuntimeException` untuk user tanpa Desk visible sama sekali — karena ratusan test existing (mis. `PurchaseOrderPermissionTest`) membuat user via factory langsung tanpa setup data Desk (mereka tidak tahu-menahu soal fitur ini), exception ini bocor ke test tersebut dan menggagalkan puluhan test di luar scope Desk. Fix dua bagian (instruksi user):
    1. `DeskSeeder::class` didaftarkan di `DatabaseSeeder::run()` — `php artisan db:seed` / fresh install otomatis dapat data Desk baseline
    2. `ResolveActiveDesk::handle()` men-catch `\RuntimeException` dari `resolve()` — request tetap lanjut ke `$next()` tanpa share props Desk (bukan block akses), untuk kasus test/environment yang belum ter-seed. Service layer (`DeskResolverService`) tetap fail-fast (dipakai test resolver internal); middleware layer permisif (tidak boleh block fitur tak terkait)
    - Test baru: `test_request_proceeds_without_desk_context_when_user_has_no_visible_desk` di `ResolveActiveDeskTest.php`
  - **Regresi kedua ditemukan & diperbaiki (query N+1/duplikat memicu false-positive `QueryDetectorMiddleware`)**: 4 test pre-existing gagal di full-suite run pertama (`TodoTest::test_create_page_defaults_assignee_to_logged_in_user`, `PurchaseOrderCanUpdateScopeTest::test_show_payload_contains_can_update_and_disabled_on`, + 2 test `AuthenticatedSessionControllerProviderCallbackTest` — kategori beda, lihat poin berikutnya). Root cause genuine (bukan cuma lolos detector): `ResolveActiveDesk`/`DeskResolverService` (a) query `MenuItem->children()` per-item dalam loop (N+1 asli — fix: eager-load `->with('children')` di query top-level, akses via property bukan method call), (b) panggil `visibleDesksFor()` berkali-kali dalam satu request tanpa cache (fix: memoize per `$user->id` dalam instance service), (c) query `$user->roles()->pluck('roles.id')` yang miripSQL dengan `$user->idRoles()->pluck('roles.id')` milik `HandleInertiaRequests` (sudah di-cache ke session `shared_user_role_ids` dengan versioning) — fix: `DeskResolverService::resolveRoleIds()` baca cache session itu dulu (`$request->hasSession()` guard), fallback query langsung hanya kalau session/request tidak tersedia (dipakai `DeskResolverServiceTest` yang bikin `Request` manual). `PermissionChecker` juga di-resolve sekali di middleware (`PermissionChecker::forUser($request)`, reuse cache session `permissions` milik `AppMiddleware`) lalu di-pass eksplisit ke seluruh chain (`resolve()`, `visibleDesksFor()`, `buildMenuTree()`) — bukan di-resolve ulang di titik manapun.
  - **2 test `AuthenticatedSessionControllerProviderCallbackTest` gagal karena perubahan perilaku DISENGAJA** (bukan bug): `test_existing_active_user_logs_in_and_redirects_to_dashboard` dan `test_registering_via_provider_with_email_of_existing_user_links_account` meng-assert redirect ke `route('dashboard')` — user di test tsb tidak punya `default_desk_id`, sesuai Requirement 5 AC 2 seharusnya diarahkan ke `route('desks.index')`. Assertion diupdate menyesuaikan behavior baru (bukan revert logic).
  - Jalankan `php -d memory_limit=1024M vendor/bin/phpunit` (full suite — `php artisan test` wrapper tidak meneruskan flag `-d memory_limit` ke subprocess PHPUnit, pola sama seperti dicatat di spec `approval-system-rewrite`), pastikan tidak ada regresi di luar scope Desk. **Hasil final: 1401 tests, 3763 assertions, 0 failures, 0 errors, 2 skipped (pre-existing, tidak terkait Desk).**
  - Verifikasi manual browser: TIDAK BISA dilakukan — domain baru (`herd link`) diblokir kebijakan domain sandbox browser tool, dan domain `erp.test` (main worktree, sudah ter-approve) menjalankan kode lama, bukan worktree ini. Dilaporkan sebagai keterbatasan lingkungan ke user, bukan diselesaikan diam-diam.
  - Konfirmasi ke user sebelum lanjut ke lint/pint (sesuai aturan project: lint hanya dijalankan setelah SEMUA task selesai). `vendor/bin/pint --dirty --format agent` sudah dijalankan ulang setelah fix terakhir — `{"result":"pass"}`, tidak ada perubahan format tersisa.

## Notes

- Task 10.2 (migrasi `navList` → seeder) berpotensi paling banyak butuh keputusan manual (pemetaan `url` → `route_name`, penentuan `primary_desk_id` per fitur) — jika ditemukan fitur yang ambigu (relevan ke banyak domain tanpa domain "utama" jelas), catat dan tanyakan ke user, jangan menebak. Termasuk memastikan route non-index (`.show`/`.edit`) yang perlu resolusi desk terdaftar sebagai `MenuItem` sendiri (Requirement 4 AC 4, menggantikan fallback by-model yang dihapus dari scope).
- Task 12.5 dan 13.x frontend: proyek ini belum dikonfirmasi punya test JS otomatis untuk komponen React — jika tidak ada infra test JS, verifikasi manual di task 14 menggantikan automated test untuk bagian frontend murni (bukan pengganti test backend Requirement terkait).
- Setelah task 14 checkpoint PASS: jalankan `vendor/bin/pint --dirty --format agent` untuk seluruh file PHP yang diubah/dibuat (aturan project: lint hanya di akhir, bukan per task).

## Post-Implementation Fixes (setelah task 14 checkpoint, feedback user langsung)

- [x] 15. Bug #1 — Desk aktif "menyandera" akses fitur di desk lain
  - **Gejala dilaporkan user**: desk aktif "Service", akses langsung `/purchaseRequests` (fitur milik desk lain) — desk aktif tetap "Service" alih-alih pindah ke desk yang relevan; switch desk manual dari halaman tidak relevan juga tidak redirect keluar.
  - **Root cause**: gap di `requirements.md` sendiri, bukan cuma bug implementasi — definisi "valid" pada fallback chain (Requirement 4 AC 3) tidak eksplisit soal syarat relevansi route terhadap Desk kandidat dari cookie/default. `requirements.md` diperbarui dulu (AC 3.1-3.2) sebelum kode.
  - **Fix**: `DeskResolverService::visibleAndRelevant()` (baru) — selain cek visible, cek juga `MenuItem` yang cocok route saat ini terdaftar di `$desk->menuItems()`; dipakai oleh `fromCookie()`/`fromUserDefault()` (lihat catatan task 3.1 di atas). `DeskController::switch()` — redirect ke `dashboard` (bukan `back()`) bila `currentPageIrrelevantToDesk()` true (parse Referer via `Route::getRoutes()->match()`).
  - _Requirements: 4 AC 3.1, 3.2; 6 AC 4_

- [x] 16. Bug #2 — Route non-index (`.show`, `.edit`) tidak resolve ke desk yang benar
  - **Gejala dilaporkan user**: `/users/{id}` (route `users.show`) tidak mengarahkan ke desk User Management — seeder cuma daftarkan `users.index` sebagai `MenuItem`, exact match gagal untuk route lain di resource yang sama.
  - **Keputusan user**: dukung wildcard eksplisit pada `route_name` (`users.*`, `*.categories.*`) — bukan prefix-match otomatis, bukan pendaftaran manual satu-satu per route.
  - **Fix**: `MenuItem::forRoute()` (baru) — exact match dulu, fallback `fnmatch()` terhadap seluruh `MenuItem` yang `route_name`-nya mengandung `*`, kalau multiple match dipilih paling spesifik (`strlen` literal terbanyak setelah `*` dihapus). `requirements.md` Requirement 4 AC 4 ditulis ulang total untuk mendokumentasikan aturan wildcard ini. `DeskSeeder.php` — seluruh 50 baris `{resource}.index` diubah ke `{resource}.*`.
  - **Migrasi data dev**: DB dev (MySQL) sempat 101 row `MenuItem` duplikat karena `updateOrCreate(['route_name' => ...])` pakai `route_name` sebagai identity key — begitu value berubah (`.index` → `.*`), row lama jadi orphan. Fix: truncate `desks`/`menu_items` via Eloquent `forceDelete()` (bukan raw truncate, supaya listener `DeskDeleted` jalan dan null-kan `default_desk_id` user yang menunjuk desk terhapus), lalu re-seed fresh.
  - _Requirements: 4 AC 4_

- [x] 17. Bug #3 — Sidebar item tidak ter-highlight aktif (index/show/nested)
  - **Gejala dilaporkan user**: item sidebar tidak ter-highlight "aktif" saat berada di halaman index/show/nested; regresi lanjutan dari fix #16 — `ResolveActiveDesk::resolveUrl()` masih panggil `route($item->route_name)` langsung dengan value yang sekarang berisi wildcard (selalu throw, `$url` selalu null, item tanpa children hilang dari sidebar).
  - **Root cause arsitektur (insight user)**: pendekatan awal (backend generate `urlPattern` string dari URL resolved, frontend re-match pakai `checkUrlPath()` regex custom) menduplikasi logic wildcard matching di 2 tempat (backend `fnmatch()` utk resolve URL, frontend regex utk cek aktif) — 2 representasi (URL string vs route name) yang harus disinkronkan manual, sumber bug berulang. Project sudah pakai Ziggy (`tightenco/ziggy`) yang expose seluruh daftar route ke frontend dan native support `route().current(pattern)` (wildcard, sama seperti dipakai `fnmatch()` backend) — tidak perlu reimplementasi wildcard matching di kedua sisi.
  - **Fix**: `ResolveActiveDesk::buildMenuItem()` — kirim `routeName` (nama route mentah, termasuk wildcard) ke frontend, hapus `urlPattern`. `url` (href konkret via `resolveUrl()` loop-kandidat) tetap dipertahankan terpisah — beda keperluan (href vs isActive-check). `NavMain.jsx` (**satu-satunya file diubah dari kontrak awal task 12.2** — catatan "`NavMain.jsx` TIDAK diubah" di task 12.2 sudah tidak berlaku) — `checkUrlPath(item.urlPattern)` diganti `route().current(item.routeName)` untuk top-level item maupun subItem.
  - _Requirements: (di luar requirements.md formal — perbaikan konsistensi state UI, bukan behavior baru)_

- [x] 18. Checkpoint — Test & verifikasi manual browser pasca Bug #3
  - `php -d memory_limit=1024M vendor/bin/phpunit` untuk seluruh 8 file test Desk (`DeskControllerTest`, `DeskDashboardTest`, `DeskModelTest`, `DeskResolverServiceTest`, `DeskSeederTest`, `MenuItemForRouteTest`, `ResolveActiveDeskTest`, `LoginRedirectDeskTest`) — **46 test PASS (126 assertions)**, tidak ada regresi dari perubahan `buildMenuItem()` (props share) maupun `NavMain.jsx`.
  - `npm run build` — build production sukses, tidak ada error kompilasi dari perubahan `NavMain.jsx`.
  - **Verifikasi manual browser** (`mcp__Claude_Browser__*`, `php artisan serve` + accessibility tree/JS eval, pola sama task 12.5): dicek langsung `data-sidebar="menu-button"[data-active]` (atribut shadcn Sidebar, sumber kebenaran visual highlight) vs `window.route().current()` di 2 skenario nyata:
    - `/items` (`route().current()` = `items.index`) → sidebar "Items" `data-active="true"`, seluruh item lain `"false"`
    - `/items/{id}` (`route().current()` = `items.show`, **skenario persis yang dilaporkan bug**) → sidebar "Items" TETAP `data-active="true"` — wildcard `items.*` cocok `items.show` lewat Ziggy native, terverifikasi runtime (bukan cuma baca TypeScript definition)
    - `/salesOrders` (`route().current()` = `salesOrders.index`) → sidebar "Sales Orders" `data-active="true"`, item lain tetap `"false"` (tidak ada regresi "lebih dari satu aktif" akibat wildcard longgar)
    - Skenario nested (submenu `item.items`) TIDAK bisa diuji end-to-end — `DeskSeeder.php` saat ini flat, belum ada `MenuItem` dengan `parent_id` terisi (di luar scope migrasi awal, lihat komentar baris 150 seeder). Logic `NavMain.jsx` untuk subItem dikonfirmasi lewat code review: memakai `route().current()` yang identik dengan top-level, jadi behavior-nya sudah terbukti benar secara transitif.
  - `vendor/bin/pint --dirty --format agent` — `{"result":"pass"}`, tidak ada perubahan format tersisa.

- [x] 19. Bug #4 — Link sidebar mengarah ke halaman `create`, bukan `index`
  - **Gejala dilaporkan user**: klik "Items"/"Sales Orders" di sidebar mengarah ke `/items/create`, `/salesOrders/create` — bukan `/items`, `/salesOrders`.
  - **Root cause**: `resolveUrl()` (dipertahankan terpisah dari isActive-check sejak fix Bug #3, lihat task 17) memilih kandidat wildcard via `->sort()` alfabetis MURNI lalu ambil kandidat pertama yang berhasil `route()` tanpa exception. Asumsi lama di komentar kode ("index-like route biasanya yang pertama match secara alfabetis") SALAH secara sistematis — urutan alfabetis sebenarnya `create` → `destroy` → `edit` → `index` → `show` → `store` → `update`, jadi `items.create` ('c') SELALU didahulukan atas `items.index` ('i'). Route `create` di project ini sering punya parameter OPSIONAL (mis. `items.create` dengan `{ref?}`, dipakai fitur clone-dari-record), sehingga lolos syarat "berhasil di-generate tanpa exception" walau bukan tujuan yang benar untuk link sidebar.
  - **Fix**: `ResolveActiveDesk::resolveUrl()` — tambah `->sortByDesc(fn ($name) => \str_ends_with($name, '.index'))` setelah `->sort()`, memastikan kandidat `*.index` SELALU dicoba lebih dulu sebelum fallback ke urutan alfabetis kandidat lain.
  - **Verifikasi**: `tests/Feature/Core/ResolveActiveDeskTest.php` + `DeskSeederTest.php` — 9 test PASS (62 assertions). Browser: `href` seluruh item sidebar dicek via `document.querySelectorAll('[data-sidebar="menu-button"]')` — semua mengarah ke path index (`/items`, `/salesOrders`, `/customers`, dst), bukan `/create`; navigasi manual ke `/items` mengonfirmasi halaman index (judul "Items") ter-render, bukan form create.
  - _Requirements: (di luar requirements.md formal — bug resolusi URL, bukan behavior baru)_

- [x] 20. Enhancement — Kolom `url_override` (href sidebar eksplisit) + `$model` jadi `::class`
  - **Permintaan user**: (a) tambah kolom eksplisit di `MenuItem`/`DeskSeeder::menuItem()` untuk href sidebar spesifik yang tidak bisa direpresentasikan lewat heuristik wildcard+`.index` (mis. resource tanpa route `.index`); `route_name` wildcard TIDAK dihapus, tetap dipakai untuk relevansi desk & isActive-check. (b) ganti `$model` string literal (`'App\\Models\\Inventory\\Item'`) jadi class-string `::class` di seluruh `seedMenuItems()` — string manual rawan typo/rename tanpa validasi apa pun, `::class` divalidasi PHP compiler saat class di-load.
  - **Iterasi desain (klarifikasi user, 2026-08-20)**: draft pertama kolom bernama `url_route_name` (nama ROUTE eksplisit non-wildcard, divalidasi via `route()` saat seeding) — user klarifikasi ini REDUNDAN dengan `route_name` yang sudah bisa exact-match non-wildcard. Kebutuhan sebenarnya: URL LITERAL (path + query string apa adanya, mis. `/users/2/detail`, `/salesOrders?status=open`) — BUKAN nama route sama sekali, karena `route()` Laravel tidak menerima URL/path sebagai argumen (hanya nama route terdaftar). Migration & kolom di-rename total ke `url_override` sebelum sempat dipakai di data manapun (file migration masih untracked git, aman diedit langsung tanpa migration baru).
  - **Fix — `url_override`**: migration `add_url_override_to_menu_items_table` — kolom `string`, `nullable`, `after('route_name')`. `DeskSeeder::menuItem()` — parameter baru `?string $urlOverride = null`, divalidasi format dasar saat seeding (`str_starts_with($urlOverride, '/')`, throw `RuntimeException` kalau tidak — BUKAN divalidasi via `route()` karena memang bukan nama route). `ResolveActiveDesk::resolveUrl(MenuItem $item)` — signature diubah dari `string $routeName` ke `MenuItem $item` supaya bisa akses kedua kolom; `url_override` dicek PALING PERTAMA (prioritas tertinggi, sesuai keputusan user) — kalau terisi, dipakai langsung sebagai href, skip seluruh logic `route_name`/`route()` sepenuhnya.
  - **Fix — FQCN `::class`**: seluruh 32 baris `$this->menuItem(...)` di `seedMenuItems()` — argumen `$model` diganti dari string literal (`'App\\Models\\...\\X'`) jadi `X::class`. Diverifikasi lebih dulu via script sementara (`class_exists()` untuk seluruh 47 class dipakai) — semua valid sebelum penggantian massal dilakukan, supaya tidak ada Fatal Error tersembunyi dari typo lama yang justru baru ketahuan lewat `::class`. **Catatan gaya penulisan**: draft awal ditulis FQCN inline (`\App\Models\...\X::class`, tanpa `use` baru) sesuai kesepakatan awal demi menghindari header panjang — TAPI `vendor/bin/pint --dirty` (preset resmi `"laravel"`, rule `global_namespace_import` bawaan preset, BUKAN config custom project ini) otomatis mengubahnya balik jadi `use` statement + nama pendek saat lint dijalankan. User dikonfirmasi & menerima hasil Pint ini — sekarang 47 baris `use` alfabetis di header `DeskSeeder.php`, nama pendek `X::class` di tiap baris `menuItem()`. Pelajaran: preset linter project bisa override kesepakatan gaya penulisan verbal — cek hasil Pint sebelum anggap "selesai sesuai kesepakatan".
  - **Catatan implementasi**: TIDAK ada resource existing yang saat ini mengisi `url_override` — dicek via `php artisan route:list` untuk beberapa resource yang dicurigai tidak punya `.index` (`approvalInstances`, `printTemplates`, `logs`, `widgets`), semuanya ternyata sudah punya route `.index`. Kolom ini murni infrastruktur untuk kebutuhan masa depan (resource baru yang benar-benar tidak punya `.index`, atau butuh landing page dengan filter/parameter spesifik).
  - **Verifikasi**: migration `up()`/`down()` dijalankan bolak-balik bersih di DB dev (rollback saat rename kolom, migrate ulang setelah rename). `php artisan db:seed --class=DeskSeeder` sukses tanpa error (validasi FQCN + format `url_override` lolos). Test suite Desk lengkap — **29 test PASS (101 assertions)**, tidak ada regresi.
  - _Requirements: (di luar requirements.md formal — enhancement infrastruktur seeder/resolusi URL, bukan behavior baru)_

- [x] 21. Bug #5 — Klik desk dari `/desks` memicu 2 request Inertia
  - **Gejala dilaporkan user**: pilih desk dari halaman `/desks` (grid awal) memicu 2 request — user telusuri sendiri: `DeskController::switch()` selalu `return back()` (kecuali kasus `currentPageIrrelevantToDesk()`), lalu FE (`DeskList.jsx`) memanggil `router.visit(route('dashboard'))` LAGI di `onSuccess` sebagai request Inertia terpisah.
  - **Root cause ganda**: (a) FE `DeskList.jsx::openDesk()` — POST `desk.switch` (server `return back()`, render ulang `/desks`) DIIKUTI `onSuccess: () => router.visit(route('dashboard'))` sebagai visit KEDUA yang terpisah. (b) Backend `currentPageIrrelevantToDesk()` sebenarnya SUDAH mendeteksi `/desks` sebagai "tidak relevan" ke desk manapun (bukan `MenuItem` terdaftar) — tapi FE tetap panggil `router.visit()` tambahan tanpa tahu server sudah redirect, sehingga tetap 2 request nyata (POST switch yang di-redirect server + GET dashboard manual FE) walau salah satunya sebenarnya redundan.
  - **Keputusan user**: bukan endpoint terpisah untuk "select dari /desks" — tetap SATU route `desk.switch`, tambah parameter opsional untuk membedakan intent pemanggilnya.
  - **Fix**: `DeskController::switch()` — parameter baru `redirect_to_dashboard` (boolean, `sometimes`, dibaca via `$request->boolean()`). Kalau `true`, langsung `redirect()->route('dashboard')` TANPA memanggil `currentPageIrrelevantToDesk()` sama sekali (asal panggilan ini SELALU `/desks`, yang secara definisi tidak pernah relevan ke desk manapun — cek Referer jadi mubazir). `DeskList.jsx::openDesk()` — kirim `redirect_to_dashboard: true`, **hapus** `onSuccess: () => router.visit(...)` sepenuhnya (server sudah redirect, FE tidak perlu visit manual lagi). `DeskSwitcher.jsx` (navbar) **TIDAK diubah** — tetap kirim `desk_id` saja tanpa flag baru, tetap pakai jalur `back()`/`currentPageIrrelevantToDesk()` lama (perilakunya sudah benar untuk kasus itu: switch dari halaman manapun selain `/desks`).
  - **Verifikasi**: 2 test baru di `DeskControllerTest.php` — `test_switch_redirects_to_dashboard_when_redirect_to_dashboard_flag_set` (membuktikan flag SKIP pengecekan relevansi walau Referer sebenarnya relevan) dan `test_switch_redirects_to_dashboard_when_flag_set_without_referer` (skenario asli: tanpa header Referer sama sekali). Total `DeskControllerTest.php` — **11 test PASS (30 assertions)**, tidak ada regresi pada 9 test existing. Browser: klik desk "Purchase" dari `/desks` — hasil akhir langsung `/dashboard-view` dengan breadcrumb "Purchase" (desk berhasil aktif), tanpa perantara render ulang `/desks` yang terlihat sebelumnya.
  - _Requirements: (di luar requirements.md formal — optimasi request, bukan behavior baru)_

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3"] },
    { "id": 2, "tasks": ["1.4", "1.5"] },
    { "id": 3, "tasks": ["1.6"] },
    { "id": 4, "tasks": ["1.7"] },
    { "id": 5, "tasks": ["1.8"] },
    { "id": 6, "tasks": ["3.1"] },
    { "id": 7, "tasks": ["3.2"] },
    { "id": 8, "tasks": ["5.1"] },
    { "id": 9, "tasks": ["5.2"] },
    { "id": 10, "tasks": ["5.3"] },
    { "id": 11, "tasks": ["7.1"] },
    { "id": 12, "tasks": ["7.2"] },
    { "id": 13, "tasks": ["7.3"] },
    { "id": 14, "tasks": ["7.4"] },
    { "id": 15, "tasks": ["9.1"] },
    { "id": 16, "tasks": ["9.2"] },
    { "id": 17, "tasks": ["10.1"] },
    { "id": 18, "tasks": ["10.2"] },
    { "id": 19, "tasks": ["10.3"] },
    { "id": 20, "tasks": ["12.1"] },
    { "id": 21, "tasks": ["12.2", "12.3", "12.4"] },
    { "id": 22, "tasks": ["12.5"] },
    { "id": 23, "tasks": ["13.1", "13.2"] },
    { "id": 24, "tasks": ["13.3"] }
  ]
}
```
