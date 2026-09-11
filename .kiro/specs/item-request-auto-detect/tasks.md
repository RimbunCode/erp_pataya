# Implementation Plan: Item Request Auto-Detect

## Overview

Implementasi mengikuti layer di `design.md`: migration+model `item_request_coverages` dulu, lalu `ItemRequestService` (query deteksi shortage on-demand dari SalesOrderItem/InternalOrderItem berstatus `draft` + AssetServiceConsumedItem, formula `Stock.ready_quantity` identik kriteria block-submit existing), lalu staging/prefill (extend pola `ref=type/id` di `PurchaseRequestController`/`PurchaseOrderController::create()`), lalu listener restore-on-cancel, lalu Desk/menu registration, terakhir FE. TIDAK ada perubahan ke struktur `SalesOrderItem`/`InternalOrderItem`/`AssetServiceConsumedItem`/`AssetService`/`Stock` di task manapun — semua read-only.

## Tasks

- [x] 1. Data Layer — migration & model `ItemRequestCoverage`
  - [x] 1.1 Migration `create_item_request_coverages_table`
    - ULID primary, `nullableUlidMorphs('source')`, `nullableUlidMorphs('covering')`, `quantity_covered` double default 0, `created_by_id` foreignUlid nullable, `timestamps()`, `softDeletes()`
    - Index `['source_type', 'source_id']` sudah otomatis dari `nullableUlidMorphs()` (tidak perlu index eksplisit tambahan)
    - _Requirements: 4.4_

  - [x] 1.2 Model `App\Models\Purchase\ItemRequestCoverage`
    - `use HasUlids, SoftDeletes`, `$guarded = ['id']`, cast `quantity_covered` float
    - Relasi `source(): MorphTo` dan `covering(): MorphTo`
    - _Requirements: 4.4_

  - [x] 1.3 Write unit tests for `ItemRequestCoverage` model
    - **Test: relasi morphTo `source`/`covering` resolve benar** (diuji dengan `AssetServiceConsumedItem` sbg source, `PurchaseRequestItem` sbg covering — representatif, `PurchaseOrder`/`Supplier` punya quirk factory pre-existing di luar scope)
    - Factory `ItemRequestCoverageFactory` baru
    - 4 test, semua PASS
    - _Requirements: 4.4_

- [x] 2. Checkpoint - Ensure migration & model tests pass
  - `php artisan test --compact tests/Unit/Purchase/ItemRequestCoverageTest.php` — 4 passed.

- [x] 3. Service Layer — deteksi shortage (`ItemRequestService::getShortageRows()`)
  - [x] 3.1 Query Source Document SalesOrderItem/InternalOrderItem
    - **[KOREKSI saat implementasi]** `whereRaw('json_overlaps(...))')` diverifikasi TIDAK jalan di SQLite (function tidak ada — bug laten tak-tertest di `SalesOrderService`/`InternalOrderService` existing, dicatat di `design.md`). Pakai `whereJsonContains('status', FormStatus::DRAFT->value)` — cross-DB, semantik sama.
    - `required_quantity` = `quantity` baris (bukan `undelivered_quantity` — dokumen masih draft)
    - `available_quantity` = `Stock.ready_quantity` pada `(item_variant_id, source_warehouse_id)`
    - _Requirements: 1.0, 1.1, 1.2, 1.3_

  - [x] 3.2 Exclusion rule AssetService-referenced SO/IO
    - Exclude baris dengan `referenceable_type IN [AssetService::class, AssetServiceConsumedItem::class]`
    - _Requirements: 1.5_

  - [x] 3.3 Query Source Document AssetServiceConsumedItem
    - Resolve warehouse: `AssetService::resolvedAsset()` → `Asset::branch()` → semua `Warehouse::where('branch_id', ...)`
    - `available_quantity` = `SUM Stock.ready_quantity` lintas semua warehouse hasil resolusi
    - _Requirements: 1.4_

  - [x] 3.4 Kurangi shortage dengan `covered_quantity` & gabungkan hasil query
    - `covered_quantity` via `ItemRequestCoverage` + `morphWith()` ke `purchaseRequest`/`purchaseOrder`, exclude status `canceled`/`rejected`
    - Filter `warehouse_ids[]`, `branch_ids[]`, `source_types[]` diterapkan
    - _Requirements: 1.6, 1.7, 2.1, 2.2, 2.3, 2.4_

  - [x] 3.5 Write unit tests for `ItemRequestService::getShortageRows()` (Property 1, Property 4)
    - 9 test, semua PASS: draft shortage terdeteksi, submitted TIDAK terdeteksi, shortage tidak pernah negatif (Property 1), exclude referenceable AssetService (Property 4), AssetService multi-warehouse Branch teragregasi, completed AssetService excluded, coverage aktif mengurangi + baris hilang saat fully covered, coverage dari PR canceled diabaikan, filter warehouse/branch/source_type
    - **Validates: Requirements 1.0, 1.1, 1.4, 1.5, 1.6, 1.7, 2.1-2.4**

- [x] 4. Checkpoint - Ensure `ItemRequestService::getShortageRows()` tests pass
  - `php artisan test --compact tests/Unit/Purchase/ItemRequestServiceTest.php` — 9 passed.

- [x] 5. Service Layer — staging batch, prefill, & coverage recording
  - [x] 5.1 `ItemRequestService::stageBatch(array $selections): string`
    - Validasi ULANG tiap selection terhadap `getShortageRows()` real-time, clamp quantity, simpan ke session (token ULID)
    - _Requirements: 3.1, 4.6, NFR2_

  - [x] 5.2 `ItemRequestService::resolveBatch(string $token): array`
    - `session()->pull()` (single-use), map ke format `defaultData['items']` mengikuti pola case `workOrder`/`assetService` existing di `PurchaseOrderController::create()`
    - `referenceable_type`/`referenceable_id` mengarah ke Source Document ASLI
    - _Requirements: 3.2, 3.3_

  - [x] 5.3 `ItemRequestService::recordCoverage()` + wiring ke `PurchaseRequestService`/`PurchaseOrderService`
    - Hook ditaruh di `PurchaseRequestService::create()` (setelah `$pr->items()->create($item)`) dan `PurchaseOrderService::create()` (setelah `$itemModel->refresh()`), via helper `recordItemRequestCoverage()`
    - _Requirements: 4.1, 4.6, NFR2_

  - [x] 5.4 Write unit/feature tests for staging & coverage (Property 2)
    - 6 test, semua PASS: stage+resolve round-trip, single-use token, clamp quantity (race condition), skip baris yang sudah tidak shortage, token tidak dikenal → kosong, **end-to-end lewat `PurchaseRequestService`/`PurchaseOrderService::create()` sungguhan** (bukan `ItemRequestCoverage::create()` langsung) membuktikan wiring 5.3 benar-benar terpasang
    - **[Temuan sampingan]** Bug pre-existing tak terkait spec ini ditemukan & di-spawn sbg task terpisah: `Supplier::create()` selalu gagal (trait `TreeView` butuh kolom `lft`/`rgt`/`depth` yang tidak pernah dimigrasikan) — di-workaround di test pakai raw DB insert
    - **Validates: Requirements 3.1-3.3, 4.1, 4.2, 4.3, 4.6**

- [x] 6. Checkpoint - Ensure staging & coverage tests pass
  - `php artisan test --compact tests/Unit/Purchase/ItemRequestStagingTest.php` — 6 passed.

- [x] 7. Controller, Routes & Prefill Integration
  - [x] 7.1 `App\Http\Controllers\Purchase\ItemRequestController` + routes
    - **[KOREKSI saat implementasi]** `Model::dataTable()` TIDAK dipakai — terverifikasi tidak cocok untuk union 3 tabel (lihat koreksi design.md §Components). `index()` pakai `LengthAwarePaginator` manual + `filterOptions` (Warehouse/Branch/SourceType list) untuk filter FE
    - `stageBatch()` validasi payload, redirect ke `ref=itemRequestBatch/{token}`
    - Permission digate via `PurchaseRequest::class` (Item Request bukan 1 Eloquent model — lihat komentar constructor)
    - Route `itemRequests.index` (GET), `itemRequests.stageBatch` (POST) terdaftar di `routes/web.php` grup Purchase
    - _Requirements: 2.1-2.4, 3.1, 3.2, 3.3, 3.4_

  - [x] 7.2 Extend `PurchaseRequestController::create()` & `PurchaseOrderController::create()`
    - `case 'itemRequestBatch':` ditambah di kedua switch existing, panggil `ItemRequestService::resolveBatch($split[1])`
    - _Requirements: 3.2, 3.3_

  - [x] 7.3 Write feature tests for `ItemRequestController` & extended `create()`
    - 5 test, semua PASS: index shortage rows, stage+create PR prefill benar, stage+create PO prefill benar, permission gate blokir tanpa `select`, regression create tanpa ref tetap kosong
    - **[Ditarik maju]** Task 13.1 (halaman FE `Purchase/ItemRequests/Index.jsx`) dikerjakan lebih awal di sini — feature test Inertia butuh file `.jsx` + Vite manifest ter-build supaya `assertOk()` tidak 500. Ketemu juga: `node_modules` worktree ini stale (`react-zoom-pan-pinch` belum terinstall meski ada di `package.json`) — `npm install` memperbaikinya, tidak terkait fitur ini
    - **Validates: Requirements 2.1-2.4, 3.1-3.4**

- [x] 8. Checkpoint - Ensure controller & routing tests pass
  - `php artisan test --compact tests/Feature/Purchase/ItemRequestControllerTest.php` — 5 passed.

- [x] 9. ~~Event & Listener~~ — TIDAK DIPERLUKAN (restorasi sudah otomatis)
  - [x] 9.1 ~~`RemoveItemRequestCoverageOnCancel` listener~~ — **DIBATALKAN, terbukti tidak diperlukan**
    - Verifikasi kode: `DocumentCanceled` kondisional pada `$model->approvalable`, yang `null` kalau tidak ada `ApprovalScheme` aktif (`ApprovalInstance::makeInstance()`, `app/Models/Core/ApprovalInstance.php:78-82`) — listener di event ini TIDAK RELIABLE
    - `ItemRequestService::isCoveringActive()` sudah cek status covering document LIVE (bukan cache) tiap `getShortageRows()` dipanggil — restorasi otomatis TANPA listener/event/penghapusan row apa pun
    - _Requirements: 4.5 (terpenuhi lewat mekanisme Task 3.4, bukan task terpisah)_

  - [x] 9.2 ~~Write feature test for cancel restore~~ — **sudah tercakup Task 3.5**
    - Property 3 sudah divalidasi test `coverage_from_a_canceled_purchase_request_is_ignored` (`tests/Unit/Purchase/ItemRequestServiceTest.php`) — PR berstatus `canceled`, coverage-nya diabaikan, shortage penuh muncul lagi
    - **Validates: Requirement 4.5**

- [x] 10. Checkpoint - Ensure listener tests pass
  - Tidak ada listener baru dibuat — checkpoint ini otomatis lulus (lihat Task 4, sudah PASS).

- [x] 11. Module & Desk Placement
  - [x] 11.1 Registrasi menu "Item Request" di `DeskSeeder`
    - `menuItem('Item Requests', 'PackageSearch', 'itemRequests.*', PurchaseRequest::class, [Domain::Purchase, Domain::Inventory, Domain::Sales, Domain::Service, Domain::Asset], 0)` — FLAT (bukan grup 'Purchases', konsepnya cross-domain, mirip 'Warehouses')
    - Model gate `PurchaseRequest::class` (bukan `null`) — konsisten sama permission gate `ItemRequestController`
    - _Requirements: 5.1, 5.2_

  - [x] 11.2 Write test seeder/permission registration
    - Ditambahkan ke `tests/Feature/Core/DeskSeederTest.php` (file test seeder existing, bukan file baru) — assert 5 desk domain benar + `parent_id` null
    - **Validates: Requirement 5.2**

- [x] 12. Checkpoint - Ensure Desk/menu tests pass
  - `php artisan test --compact tests/Feature/Core/DeskSeederTest.php` — semua PASS (termasuk test existing yang tidak diubah, regresi aman).

- [x] 13. Frontend — halaman Item Request
  - [x] 13.1 `resources/js/Pages/Purchase/ItemRequests/Index.jsx`
    - **[KOREKSI]** BUKAN DataTable2 (lihat koreksi Task 7.1) — tabel HTML custom + primitif `Select`/`Checkbox`/`Button`/`Pagination`
    - Filter Warehouse/Branch/Source Type via `Select`, reload lewat `router.get` (`preserveState`)
    - Checkbox multi-select per baris + tombol "Buat PR"/"Buat PO" (disabled kalau belum ada baris terpilih)
    - Tombol → `router.post('itemRequests.stageBatch', {document_type, selections})` → redirect server-side
    - **[Ditarik maju]** File ini dibuat lebih awal saat Task 7.3 (feature test Inertia butuh halaman fisik + Vite build)
    - Sekaligus dibuat: `lang/en/purchase/itemRequest.php`, `lang/id/purchase/itemRequest.php`
    - _Requirements: 2.1-2.4, 3.1-3.4_

  - [x] 13.2 Write component tests (`.rtl.test.jsx`) for Index page
    - 5 test, semua PASS: empty state, render baris dari props, tombol disabled tanpa seleksi, centang+Buat PR kirim payload benar, centang+Buat PO kirim `document_type` benar
    - **[Catatan]** Checkbox project ini custom `role="forminput"` (bukan `role="checkbox"` standar) — dicek dulu ke `checkbox.jsx` sebelum query test, bukan asumsi
    - **Validates: Requirements 2.1-2.4, 3.1, 3.2, 3.3, 3.4**

- [x] 14. Final checkpoint - Ensure all tests pass (backend + frontend)
  - Full run BE (dipecah per-batch, PHP CLI 128MB OOM di batch besar — bug lingkungan pre-existing, bukan dari spec ini) + FE, semua 0 gagal:
    - Purchase (Unit+Feature+DeskSeeder): PASS — 23 passed, 199 assertions
    - Sales (Unit+Feature, regression — tidak diedit, hanya dibaca): PASS — semua sub-batch hijau
    - Asset (Unit+Feature, regression — tidak diedit, hanya dibaca): PASS — 15 passed, 590 assertions
    - FE Vitest (domain Purchase): PASS — 17 file, 159 test
    - FE Vitest (Index.jsx baru): PASS — 5 test
  - **[Temuan lingkungan, di luar scope spec]** `node_modules` worktree stale (`react-zoom-pan-pinch` belum terinstall) — `npm install` sudah memperbaiki. `Supplier::create()` selalu gagal (trait `TreeView` tanpa kolom `lft`/`rgt`/`depth`) — di-spawn sbg task terpisah (`task_77e18aae`).

## Notes

- Setiap task mereferensi requirement spesifik untuk traceability.
- Checkpoint tiap group memastikan validasi inkremental sebelum lanjut layer berikutnya.
- Tidak ada perubahan skema ke `SalesOrderItem`, `InternalOrderItem`, `AssetServiceConsumedItem`, `AssetService`, `Stock` di task manapun (batasan eksplisit dari user).
- Task 7.1 (shape response `DataTable`) punya ASUMSI yang ditandai di `design.md` — perlu cross-check langsung ke `app/Traits/DataTable.php` saat dikerjakan, bukan asumsi ulang.
- Group 13 (Frontend) baru bisa mulai setelah route `itemRequests.stageBatch` (Task 7.1) tersedia — tidak bisa dikerjakan paralel murni dengan Group 7.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["1.3"] },
    { "id": 3, "tasks": ["3.1"] },
    { "id": 4, "tasks": ["3.2", "3.3"] },
    { "id": 5, "tasks": ["3.4"] },
    { "id": 6, "tasks": ["3.5"] },
    { "id": 7, "tasks": ["5.1"] },
    { "id": 8, "tasks": ["5.2", "5.3"] },
    { "id": 9, "tasks": ["5.4"] },
    { "id": 10, "tasks": ["7.1"] },
    { "id": 11, "tasks": ["7.2"] },
    { "id": 12, "tasks": ["7.3"] },
    { "id": 13, "tasks": ["9.1"] },
    { "id": 14, "tasks": ["9.2"] },
    { "id": 15, "tasks": ["11.1"] },
    { "id": 16, "tasks": ["11.2"] },
    { "id": 17, "tasks": ["13.1"] },
    { "id": 18, "tasks": ["13.2"] }
  ]
}
```

## Pengujian Visual (browser sungguhan)

Setup: `.env` terisolasi untuk worktree ini (SQLite dedicated, bukan MySQL dev DB bersama — hindari risiko ke sesi lain), migrate + seed (`PermissionSeeder`, `AdministratorSeeder`, `DeskSeeder`; `AccountSeeder` di-skip — gagal karena `CountrySeeder` butuh REST Countries API eksternal yang 401, unrelated ke spec ini), `npm run build`, serve via `php artisan serve --no-reload` (config `serve` di `.claude/launch.json`, sudah ada sebelumnya).

Alur diverifikasi end-to-end di browser:
1. Login (`admin`/`admin`) → Desks index tampil 9 system desk.
2. Masuk Desk Purchase → sidebar menampilkan menu **"Item Requests"** (`/itemRequests`) — konfirmasi Task 11 (Desk placement) benar secara visual, bukan cuma lewat assertion test.
3. Halaman Item Request render sempurna: filter Warehouse/Branch/Source Type (dropdown Select berfungsi, diuji klik langsung), header kolom (Item/Sumber/Warehouse/Branch/Dibutuhkan/Sudah Dicover/Tersedia/Shortage), tombol "Buat PR"/"Buat PO" di header, empty state "Tidak ada kebutuhan item yang shortage." saat DB kosong.
4. **Bug ditemukan & diperbaiki saat visual testing**: breadcrumb salah tampil "Purchase Requests" (numpang `translateKey` dari model gate `PurchaseRequest::class`). Fix: `ItemRequestController::index()` share breadcrumb manual dengan `translateKey` sendiri (`purchase.itemRequest.title`) alih-alih `setBreadcrumbs()` tanpa argumen. Setelah fix: breadcrumb tampil benar "Purchase > Item Request".
5. Demo end-to-end dgn data dummy (1 SalesOrder draft, quantity 10, stock 3): baris shortage=7 muncul benar di tabel, centang baris → tombol "Create PR"/"Create PO" aktif dgn counter, klik "Create PR" → redirect ke form create PurchaseRequest dengan item+quantity(7, BUKAN 10)+unit ter-prefill otomatis, submit sukses jadi draft PR.
6. **Bug kedua ditemukan lewat pertanyaan user** (bukan dari test otomatis): gate permission awal `enforcePermission('stageBatch') => 'create'` SELALU cek terhadap `PurchaseRequest::class` (fixed dari constructor), padahal `stageBatch()` bisa target PurchaseRequest ATAU PurchaseOrder tergantung `document_type` di payload. Base `Controller::__construct()` cuma dukung gate 1 model tetap, gak ada mekanisme OR lintas model. Akibatnya user yang HANYA punya izin `create` PurchaseOrder (tanpa PurchaseRequest) diblokir 403 walau mau bikin PO; sebaliknya user yang HANYA punya izin PurchaseRequest malah lolos bikin PO padahal gak berhak. Bug SAMA juga di visibility menu sidebar (`ResolveActiveDesk::buildMenuItem()` cek `Permission::Select` ke 1 model MenuItem tetap).
   - **Fix**: `exceptPermission()` skip gate otomatis constructor untuk `index`/`stageBatch`, diganti manual check per-method — `requirePermissionToViewList()` (OR: select PurchaseRequest ATAU PurchaseOrder, user belum tentu sudah memutuskan mau bikin yang mana) dan `requirePermissionForDocumentType()` (SPESIFIK sesuai `document_type` di payload, BUKAN OR — izin PO tidak otomatis memberi izin PR).
   - Menu `DeskSeeder`: `model` diganti dari `PurchaseRequest::class` jadi `null` (pola sama seperti menu 'Tickets' existing) — visibility menu gak lagi restrict ke 1 model, izin granular tetap ditegakkan backend.
   - 4 test baru ditambah di `ItemRequestControllerTest.php` (user hanya-PO bisa lihat list & stage PO tapi diblokir stage PR, user hanya-PR diblokir stage PO) — total 9 test PASS.

7. **Bug #2 — fix final (menyempurnakan poin 6 di atas)**: pendekatan interim `model diganti null` di poin 6 menghilangkan bug 403 tapi memunculkan bug baru — menu SELALU tampil ke siapapun yang punya akses Desk, tidak digate permission apapun sampai user klik dan kena 403 (ditemukan user: *"selalu tampil dong menunya namun saat diakses 403"*). Base `MenuItem.model` cuma bisa gate 1 model tetap dengan `Permission::Select`, tidak ada OR lintas model di level menu.
   - **Fix**: kolom baru `menu_items.visibility_permission` (JSON, nullable) — kosong = fallback ke `model`+`Permission::Select` seperti biasa; terisi = override total, dibaca lewat `PermissionChecker::satisfies()` (any/all tree, sudah dipakai di level controller). `PermissionChecker::satisfiesAction()` ditambah dukungan string mentah (bukan cuma instance `Permission`) — kolom JSON di-`json_decode()` balik jadi string biasa, backed enum tidak auto-rehydrate.
   - `ResolveActiveDesk::buildMenuItem()`: `visibility_permission` diprioritaskan kalau ada, baru fallback ke cek `model`.
   - `DeskSeeder`: menu 'Item Requests' pakai `visibility_permission: {any: [[PurchaseRequest, Select], [PurchaseOrder, Select]]}` — OR beneran, bukan `model = null`.
   - 2 test baru `PermissionCheckerTest.php` (string mentah dari JSON), 3 test baru `ResolveActiveDeskTest.php` (tampil dgn hanya izin PO, tampil dgn hanya izin PR, hilang tanpa keduanya). Regression: `DeskSeederTest.php`, `ItemRequestControllerTest.php` tetap hijau. Total 40 test PASS.

8. **Feedback user (perbaikan lanjutan, bukan bug)**: dua penyempurnaan diminta setelah demo —
   - **Draft PR/PO belum dianggap coverage**: `ItemRequestService::isCoveringActive()` sebelumnya hanya exclude status `canceled`/`rejected` — PR/PO yang masih `draft` (dibuat tapi belum disubmit) sudah menghilangkan baris shortage, padahal draft bukan komitmen nyata. Fix: tambah exclude `FormStatus::DRAFT`. Test baru `coverage_from_a_draft_purchase_request_is_ignored` (`ItemRequestServiceTest.php`); `active_coverage_reduces_shortage_and_fully_covered_row_disappears` diubah status covering PR dari `DRAFT` ke `SUBMITTED` (assumsi lama sudah salah menurut requirement baru); `ItemRequestStagingTest.php` alur end-to-end disesuaikan — assert baris TETAP muncul selama PR masih draft, baru hilang setelah `status` diubah ke `SUBMITTED`.
   - **Kolom "Source" jadi link ke dokumen sumber**: sebelumnya cuma label statis ("Sales Order"/dst). `ItemRequestService::makeRow()` ditambah field `source_document` (`id`, `code`, `thisModel`, `route`) diambil dari model dokumen sumber (`SalesOrder`/`InternalOrder`/`AssetService`) via accessor `thisModel`/`route` bawaan `LinkModel` trait (`app/Traits/LinkModel.php`) — pola sama persis dgn kolom `relation` di `Table2.jsx`. FE `Index.jsx`: komponen `SourceCell` cek `canGlobal(thisModel, "read")` (`usePermission` hook) sebelum render `<Link>`, kalau tidak punya izin cuma tampil teks kode dokumen (bukan link). Diverifikasi visual langsung di browser (`http://localhost:8012/itemRequests` login admin) — klik "SO-DEMO-0001" berhasil navigasi ke halaman show SalesOrder-nya. 2 test baru `Index.rtl.test.jsx` (link tampil dgn izin `read`, teks polos tanpa izin) + 2 assertion baru di `ItemRequestServiceTest.php` (field `source_document` terisi benar utk SalesOrder & AssetService).
   - Regression penuh: BE 40 test (`PermissionCheckerTest` 14, `ResolveActiveDeskTest` 10, `DeskSeederTest` 7, `ItemRequestControllerTest` 9) + `ItemRequestServiceTest` 10 + `ItemRequestStagingTest` 6 + `ItemRequestCoverageTest` 4, FE `Index.rtl.test.jsx` 7 — semua PASS.

9. **Feedback user (lanjutan poin 8)**: "linkable ke halaman show dokumen terkait, hanya kalau punya akses (pola Table2)" diminta diterapkan ke SEMUA kolom relasi tabel ini, bukan cuma Source. Kolom Item (ItemVariant), Warehouse (bisa multi utk baris AssetService), dan Branch sebelumnya cuma teks polos.
   - **Fix BE**: `ItemRequestService::makeRow()` ditambah `item_document`, `branch_document` (single), `warehouse_documents` (array, selaras indeks dgn `warehouse_ids`/`warehouse_names`). Helper baru `documentRef(?Model $model)` — DRY pembentukan `{id, thisModel, route}` dari accessor `LinkModel`, dipakai jg utk pola yang sama.
   - **Fix FE**: `SourceCell` digeneralisasi jadi `RelationCell({label, document, canGlobal})` (dipakai Item/Source/Branch) + `WarehouseCell` baru (map per-warehouse, masing-masing independen digate — mungkin campur: 1 warehouse linkable krn ada izin, warehouse lain di baris sama plain text kalau modelnya beda izin — walau dalam praktiknya semua Warehouse sama modelnya, cuma beda instance, jadi konsisten per row).
   - 3 test baru `Index.rtl.test.jsx` (Item, Branch, Warehouse termasuk kasus campur linkable/tidak) + assertion baru di `ItemRequestServiceTest.php` utk 2 test deteksi shortage existing. Diverifikasi visual di browser: keempat kolom (Item/Source/Warehouse/Branch) tampil biru & klik "Demo Warehouse" berhasil navigasi ke show Warehouse.
   - Regression penuh tetap hijau: 10 `ItemRequestServiceTest` (41 assertion) + 6 `ItemRequestStagingTest` + 9 `ItemRequestControllerTest` (79 assertion gabungan) + 10 FE `Index.rtl.test.jsx`.

10. **Feedback user (UI tombol aksi)**: bentuk tombol "Buat PR"/"Buat PO" (2 tombol setara) diganti jadi `ButtonGroup` split-button — Buat PR jadi tombol utama (`variant="primary"` default), Buat PO dipindah ke `DropdownMenu` di balik chevron. Pola diambil persis dari `FormPage.jsx:933-1015` (tombol Print + dropdown template).
    - FE `Index.jsx`: `ButtonGroup` + `DropdownMenu`/`DropdownMenuTrigger`/`DropdownMenuContent`/`DropdownMenuItem` dari `@/Components/ui/*`. Tambah translation key `purchase.itemRequest.actions.moreActions` (aria-label chevron, en+id).
    - Test `Index.rtl.test.jsx` disesuaikan: assert trigger chevron (bukan tombol PO langsung) disabled tanpa seleksi; test klik PO diubah jadi buka dropdown dulu (`findByRole("menuitem", ...)`) baru klik.
    - Diverifikasi visual: Buat PR tampil solid (primary) + chevron nempel tanpa gap, klik chevron buka dropdown berisi "Buat PO (n)".

11. **Bug ditemukan lewat pertanyaan user** (pola sama dgn Bug #1/#2 di poin 6-7 — FE gak gate visibility sesuai permission backend): tombol "Buat PR"/"Buat PO" (setelah jadi `ButtonGroup` di poin 10) tampil UNCONDITIONAL ke semua user berapapun izinnya — backend `requirePermissionForDocumentType()` tetap 403 kalau user gak punya izin `create` model targetnya, tapi FE gak ada gate apapun sebelum itu (user baru tau lewat error 403 setelah klik).
    - **Fix**: `ItemRequestController::index()` kirim prop baru `documentModels` (`{purchaseRequest: PurchaseRequest::class, purchaseOrder: PurchaseOrder::class}`) — FQCN dari backend, BUKAN hardcode string di FE (selaras pola `source_document`/`item_document`/dst). `Index.jsx` hitung `canCreatePurchaseRequest`/`canCreatePurchaseOrder` via `canGlobal(documentModels.xxx, "create")`, render kondisional: kedua izin → `ButtonGroup` (PR utama + PO dropdown) seperti biasa; cuma salah satu → tombol tunggal tanpa dropdown; tidak keduanya → tidak ada tombol sama sekali (bukan disabled — memang gak relevan ditampilkan).
    - 3 test baru `Index.rtl.test.jsx` (hanya izin PR, hanya izin PO, tanpa izin sama sekali). Test existing (disabled state, klik PR, klik PO) disesuaikan: `beforeEach` default grant `create` di KEDUA model + prop `documentModels` ditambahkan ke tiap render call yang relevan. Total 13 test PASS. Regression `ItemRequestControllerTest.php` (9 test, prop baru gak ganggu assertion existing).

12. **Feedback user (filter pakai MultiSelect + fitur baru komponen shared)**: filter Warehouse/Branch/Dokumen Sumber sebelumnya `Select` single-value dgn sentinel `ALL_VALUE`. Diganti `MultiSelect` (`resources/js/Components/MultiSelect.jsx`, dipakai lintas project) — sekalian 3 kapabilitas baru ditambah ke komponennya (bukan cuma dipakai di halaman ini):
    - **`showAllOption`**: baris "All"/"Semua" di atas daftar option — check pilih semua, uncheck kosongkan semua, sebagian terpilih → checkbox jadi `indeterminate` (native Radix `data-state=indeterminate`, bukan CSS trick). Hanya tampil saat TIDAK sedang searching (select-all ambigu terhadap hasil filter parsial). Saat semua terpilih, ringkasan di input jadi label All (bukan daftar semua nama satu-satu).
    - **`allOptionLabel`**: override label default `t("core.form.all")` (key baru ditambah `lang/{en,id}/core/form.php`).
    - **`defaultValue`**: array atau nilai tunggal (auto-dibungkus array) — jadi value efektif kapan pun prop `value` null/undefined, supaya consumer yang butuh "tidak pernah kosong begitu saja" tidak perlu jaga sendiri di tiap call site.
    - **Bug ditemukan SAAT verifikasi visual browser (BUKAN dari RTL test — semua 65 test PASS tapi bug tetap ada)**: klik checkbox opsi (termasuk baris All) di browser sungguhan meng-toggle lalu langsung toggle balik (net no-op) — network log menunjukkan 2 request `router.get` beruntun per 1 klik (add lalu remove). Root cause: struktur lama `<CommandItem asChild><label htmlFor={checkboxId}><Checkbox onCheckedChange={...}/></label></CommandItem>` punya 2 jalur klik independen yang SAMA-SAMA toggle: (1) `CommandItem.onSelect` via bubuling klik ke `<label>`, DAN (2) native browser "label-for-control click forwarding" — klik di mana pun dalam `<label htmlFor>` men-dispatch klik SINTETIS TERPISAH ke elemen berlabel (`Checkbox`), yang lalu bubble LAGI ke label → `onSelect` terpanggil 2x per 1 klik user. RTL test tetap hijau karena jsdom TIDAK mengimplementasikan native label-forwarding ini utk custom element non-`<input>` (Radix Checkbox = `<button>`), jadi bug ini murni environment-specific -- cuma kelihatan di real browser.
      - **Fix**: `<label htmlFor>` diganti `<div>` biasa (bukan elemen labelable) + `aria-label` langsung di `Checkbox` (gantikan asosiasi native label). `onCheckedChange` dihapus dari `Checkbox` (jadi murni presentational, `checked` controlled) — `CommandItem.onSelect` jadi SATU-SATUNYA sumber toggle. `tabIndex={-1}` ditambah ke `Checkbox` (bukan tab-stop independen — navigasi keyboard tetap lewat arrow+Enter di `<Command>`, sudah ada custom handler-nya).
      - Diverifikasi ulang di browser sungguhan (bukan cuma re-run test): tambah 3 warehouse dummy via tinker (total 4), klik checkbox individual & baris All berkali-kali (termasuk klik LANGSUNG di area Checkbox, skenario terburuk) — state settle benar & stabil, indeterminate muncul saat sebagian terpilih, placeholder jadi "Semua" saat semua terpilih.
    - 10 test baru `MultiSelect.rtl.test.jsx` (showAllOption: pilih semua/uncheck semua/indeterminate/placeholder All/hilang-saat-tanpa-prop/hilang-saat-searching; defaultValue: fallback array/fallback nilai tunggal+value null/diabaikan kalau value eksplisit terisi) + 2 test baru `Index.rtl.test.jsx` (integrasi filter warehouse: pilih 1 opsi & klik All memanggil `router.get` dgn array benar). Regression: `MultiSelect` 16 test, `Index.rtl.test.jsx` 15 test, consumer lain (`Form.rtl.test.jsx`, `ValueField.rtl.test.jsx`, `ItemVariantLinkModel`, `ItemLinkModel`) 85 test gabungan — semua PASS.
    - Translation key `filters.allWarehouses`/`allBranches`/`allSourceTypes` (per-domain, statis) sempat DIHAPUS krn awalnya dianggap tergantikan generic `core.form.all` — **dikembalikan lagi di poin 13** karena `allOptionLabel` justru dirancang utk kasus ini (override per-domain, bukan cuma generic).

13. **Feedback user (3 hal: debounce, realtime checkbox, timing onValueChange)**: setelah poin 12, filter tiap centang langsung fetch server (visible "Memproses..." tiap klik) -- user minta (a) debounce beberapa detik, (b) checkbox TETAP realtime visual, (c) `onValueChange` MultiSelect ditunda sampai popover ditutup (bukan per-toggle). Sekaligus user minta label All per-filter dikembalikan ke istilah domain (bukan generic "Semua").
    - **Fix MultiSelect (opt-in, prop baru `changeOnBlur`, default `false` -- SEMUA consumer lain di project TIDAK terdampak)**: saat `true`, toggle checkbox cuma update state lokal `values` (visual realtime, lewat `setValuesLocalOnly` baru) TANPA panggil `onValueChange`. `onValueChange` baru dipanggil SEKALI di efek close-popover (`useEffect` yang sudah ada, dicek `open`), dan HANYA jika value benar berubah sejak dibuka (snapshot via `openSnapshotRef`) -- buka-tutup tanpa apa² diubah tidak memicu apa pun. Tombol clear (X) SENGAJA dikecualikan dari `changeOnBlur` -- selalu commit langsung (`setValuesLocalOnly` + `onValueChange` manual), krn itu aksi eksplisit tunggal bukan bagian rentetan toggle.
    - **Fix Index.jsx (debounce)**: `applyFilter()` gak lagi langsung `router.get()` -- di-debounce `FILTER_DEBOUNCE_MS = 1500`ms via `setTimeout` (pola sama persis `useLinkModelOptions.js` search debounce, cuma beda durasi). Perubahan ke filter BERBEDA dalam window debounce di-MERGE via `pendingFiltersRef` (bukan saling menimpa) -- ganti Warehouse lalu langsung Branch dalam <1.5s jadi SATU request gabungan, bukan 2 terpisah. Ketiga MultiSelect filter diberi `changeOnBlur` + `allOptionLabel` per-domain (`filters.allWarehouses`/`allBranches`/`allSourceTypes`, dikembalikan dari poin 12).
    - **Gotcha testing**: percobaan pertama pakai `vi.useFakeTimers()` + `userEvent(advanceTimers:...)` -- 3 test TIMEOUT 15 detik, fake timers macet dgn scheduler internal Radix/cmdk (kemungkinan RAF-based). Diganti ke real timers + `waitFor` dari `@testing-library/react` (act()-aware, pola sama [[reference_vi_waitfor_not_act_aware]] di memory project) -- delay debounce beneran ditunggu nyata (~1.5-3 detik per test), tapi reliable.
    - 4 test baru `MultiSelect.rtl.test.jsx` (changeOnBlur: toggle tak langsung fire, checkbox tetap realtime, tutup tanpa perubahan tak fire, clear button selalu langsung). 3 test baru `Index.rtl.test.jsx` (tak langsung fire sampai tutup+debounce lewat, klik All + label kustom per-domain, 2 filter beda digabung 1 request). Regression: `MultiSelect` 20 test, `Index.rtl.test.jsx` 16 test, consumer lain 90 test gabungan -- semua PASS. `LocaleKeysTest` PASS (key dikembalikan simetris en/id).
    - Diverifikasi visual browser: checkbox update instan tanpa "Memproses...", baru fetch ~1.5 detik setelah popover ditutup, placeholder jadi ringkasan tunggal ("Warehouse Selatan") saat 1 dipilih, "Semua Warehouse" (bukan generic) saat baris All di-tampilkan.

14. **Bug ditemukan lewat pertanyaan user** ("mengapa Input MultiSelect tidak realtime saat check option berubah"): root cause BUKAN di changeOnBlur/debounce (itu memang jeda sengaja) -- tapi `placeholder={placeholder ?? (values?.length ? labelOfValues(values) : "")}`. Semua caller (termasuk Item Request) SELALU kirim prop `placeholder` eksplisit ("Warehouse", dst) yang NON-null -- `??` jadi tidak PERNAH jatuh ke cabang `labelOfValues(values)`, jadi selama popover terbuka (input dikosongkan utk searching) yang tampil SELALU teks placeholder statis, bukan ringkasan pilihan yg live. Ringkasan baru muncul setelah popover DITUTUP (`search` di-set jadi VALUE asli, menang atas placeholder) -- itu sumber kesan "nunggu blur".
    - **Fix**: badge count kecil (`<span className="badge secondary">`) di sebelah tombol clear, muncul HANYA saat `open && values.length > 0` -- update live tiap toggle krn baca `values` state lokal langsung (tidak lewat placeholder yg ke-mask). Tidak mengubah placeholder logic itu sendiri (masih dipakai consumer lain, biarkan).
    - 3 test baru `MultiSelect.rtl.test.jsx` (badge sembunyi saat tertutup, badge muncul+update live saat terbuka, badge hilang lagi di 0 terpilih).

15. **Feature request user (tag-input style commit, bukan bug)**: selain searching biasa, Input MultiSelect diminta JUGA berfungsi kayak tag-input -- ketik label PERSIS cocok dgn salah satu option, lalu delimiter (default ",", dikonfigurasi via prop `delimiters`) ATAU blur (klik luar/Tab) -> option itu otomatis ke-check, teks pencarian dikosongkan lagi siap ketik option berikutnya.
    - **Fix**: `tryCommitTypedMatch(text)` -- cari option yg label-nya match persis (case-insensitive, trimmed) teks yg diketik; kalau ketemu & belum terpilih, `toggleValue()`. Dipanggil dari 2 tempat: (a) `onChange` Input, saat karakter yg baru diketik adalah salah satu `delimiters` (default `[","]`, prop boleh string tunggal atau array) -- teks SEBELUM delimiter itu yg dicoba di-match; (b) `onBlur` Input baru (belum ada sebelumnya) -- commit dari SISA teks yg lagi diketik saat fokus hilang.
    - **Side-effect penting yang WAJIB ditangani**: `onBlur` sekarang punya efek nyata (commit + `setOpen(false)`) -- tanpa penjagaan, KLIK CHECKBOX APAPUN di dalam popover jg akan mem-blur Input (browser default: mousedown di elemen non-focusable memindah/menghapus fokus dari elemen yg lagi fokus), bikin popover LANGSUNG NUTUP habis 1 klik (regresi fatal ke alur multi-pilih). Fix: `onMouseDown={(e) => e.preventDefault()}` di `CommandList` -- mencegah browser memindah fokus saat mousedown di area popover TANPA mencegah event click/onSelect itu sendiri (pola standar combobox).
    - 7 test baru `MultiSelect.rtl.test.jsx`: commit via delimiter default, case-insensitive+trim, commit via blur tanpa delimiter, teks tak-match dibiarkan (delimiter gak "termakan"), prop `delimiters` kustom, lanjut searching stlh commit, DAN regression guard eksplisit "klik checkbox tidak menutup popover" (memverifikasi fix mousedown di atas).
    - Regression penuh: `MultiSelect` 30 test, `Index.rtl.test.jsx` 16 test, consumer lain (`Form`/`ValueField`/`ItemVariantLinkModel`/`ItemLinkModel`) 70 test gabungan -- semua PASS. Pint bersih (tidak ada file PHP di batch ini).
    - Diverifikasi visual browser end-to-end: ketik "Warehouse Utara," -> auto-check + badge "1" + input kosong lagi; lanjut "Warehouse Timur," -> badge "2"; ketik "Warehouse Selatan" (tanpa delimiter) lalu klik luar -> badge sempat "2" (belum commit), setelah blur jadi ter-check juga & fetch debounce jalan seperti biasa.

16. **Koreksi user atas poin 15**: desain `delimiters` di poin 15 ("ketik+delimiter/blur commit, teks di-reset kosong lagi") DITOLAK -- bukan yang dimaksud user. Model yang benar: Input adalah REPRESENTASI TEKS LANGSUNG dari selection, sinkron DUA ARAH, TIDAK PERNAH direset kosong paksa.
    - **Model baru**: (a) ketik `"Demo Warehouse,Warehouse Utara,"` berurutan -> KEDUA option ke-check, teks TETAP utuh (bisa lanjut ketik entry berikutnya di string yang sama); (b) EDIT teks entry yang sudah ke-check (hapus/ubah huruf) -> begitu teksnya gak lagi persis match label, option itu OTOMATIS ke-uncheck LIVE (tiap keystroke, gak nunggu blur/delimiter); (c) klik checkbox langsung -> teks di input ikut diregenerasi (gabungan label terpilih, sinkron dua arah); (d) blur -- entry terakhir yang lagi diketik (belum diakhiri delimiter) dicoba di-commit juga, TAPI sisa yang tetap gak match apapun DIBUANG (bukan dibiarkan) -- dikonfirmasi eksplisit lewat `AskUserQuestion` (2 pertanyaan: sync checkbox<->teks? "Ya dua arah"; sisa teks tak-match saat blur? "Dibuang otomatis").
    - **Rewrite arsitektur signifikan** (`resources/js/Components/MultiSelect.jsx`): `search` gak lagi "buffer sementara yang di-reset ke `""` saat popover dibuka" -- sekarang `search` = state PERSISTEN, diinisialisasi via `joinLabels(initialValues)` (bukan `""`) SEJAK MOUNT (bukan cuma saat dibuka). Helper baru: `analyzeText(text)` (pecah jadi `completeSegments` [entry yang sudah diakhiri delimiter] + `inProgressSegment` [sisa setelah delimiter terakhir, dipakai sbg query filter dropdown DAN highlight -- BUKAN `search` mentah lagi]), `computeSyncedValues(text, prevValues, {includeInProgress})` (uncheck value yang label-nya gak lagi ada di SEMUA segmen; check segmen complete yang match persis; `includeInProgress` dipakai saat blur/close utk ikut commit entry terakhir). `toggleValue`/`toggleAll` diubah dari functional-updater jadi hitung `next` sinkron lalu panggil `setValues(next)` DAN `setSearch(joinLabels(next))` sekaligus (sinkron dua arah checkbox->teks).
    - **Gotcha desain kritis (ketemu SAAT desain, sebelum nulis kode -- bukan lewat trial-error)**: kalau efek "sync values dari search text" (yang jalan tiap popover DITUTUP) dijalankan APA ADANYA saat MOUNT PERTAMA (React `useEffect` tanpa dependency-skip selalu jalan minimal sekali setelah render awal), dan `search` awal masih string kosong SEBELUM inisialisasi selesai -- itu bakal keliru menganggap "belum ada apa-apa diketik" dan MENGHAPUS SEMUA `value`/`defaultValue` awal yang sengaja diberikan dari parent! Fix: `hasMountedRef` skip eksplisit di render efek pertama, DAN `search` diinisialisasi via `useState(() => joinLabels(initialValues))` (bukan `useState("")`) supaya render pertama sudah benar tanpa perlu nunggu efek jalan sama sekali.
    - 6 test baru `MultiSelect.rtl.test.jsx` (mount tampilkan teks gabungan, buka popover teks tidak dikosongkan, multi-entry berurutan gak direset, klik checkbox regenerasi teks, edit invalidasi -> uncheck live, blur buang sisa tak-match) + 1 test lama diupdate (dulu expect teks jadi kosong stlh commit, sekarang expect tetap `"Alpha,"`). Total `MultiSelect.rtl.test.jsx` 36 test. Regression: `Index.rtl.test.jsx` 16 test + consumer lain 70 test gabungan -- semua PASS. Pint bersih (tidak ada file PHP di batch ini).
    - Diverifikasi visual browser end-to-end: ketik `"Demo Warehouse,Warehouse Utara,"` -> kedua ke-check, teks utuh; select-all+retype `"...Warehouse Uta,"` (simulasi edit) -> "Warehouse Utara" otomatis ke-uncheck live (badge 2->1); klik checkbox "Warehouse Selatan" -> teks jadi persis `"Demo Warehouse, Warehouse Selatan"`; klik luar -> fetch debounce tetap jalan seperti biasa.

17. **Feature request user (3 tambahan lanjutan poin 16, diminta bareng dlm 1 pesan)**: (a) `isDirty` reset ke `false` begitu user ngetik delimiter (bukan cuma saat commit checkbox); (b) tekan `Tab` saat salah satu opsi lagi ke-highlight KEYBOARD (arrow-key, BUKAN mouse hover) -> otomatis commit opsi itu ke input; (c) tooltip di Input saat `isDirty=false` & popover TERTUTUP, nunjukin semua value ter-check tanpa perlu buka popover.
    - **Fix (a)**: `onChange` Input dicek apakah karakter terakhir yang baru diketik adalah salah satu `delimiters` -> `setIsDirty(!endsWithDelimiter)` (sebelumnya `isDirty` cuma di-reset di `toggleValue`/`toggleAll`, gak pernah dari mengetik delimiter langsung).
    - **Fix (b)**: `onKeyDown` baru di `<Command>` -- baca item cmdk yang `data-selected="true"` (`popoverRef.current.querySelector('[cmdk-item=""][data-selected="true"]')`), ambil `data-value`-nya, commit via `toggleValue`/`toggleAll` (cek `ALL_OPTION_VALUE`) saat key `Tab` ATAU `Enter` (Enter jg `preventDefault()`+`stopPropagation()` biar gak submit form pembungkus).
      - **Gotcha test (ditemukan salah asumsi sebelum nulis test, bukan lewat gagal run)**: cmdk BUKAN "kosong sampai `ArrowDown` ditekan" -- dia AUTO-HIGHLIGHT item PERTAMA yang di-render begitu list muncul, TANPA keypress apapun. `ArrowDown` pertama pindah ke item KEDUA, bukan item pertama. 3 test ditulis sesuai perilaku nyata ini (bukan asumsi awal): Tab tanpa navigasi apapun commit item pertama; `ArrowDown`+`Tab` commit item kedua; list kosong (hasil search 0 match) + `Tab` = no-op.
      - **Investigasi tambahan (dikonfirmasi user, TIDAK diubah)**: kombinasi fitur `showAllOption` + Tab-commit bikin baris "Semua Warehouse"/"All" ikut jadi kandidat auto-highlight PERTAMA (krn dia di-render duluan) -- jadi `Tab` TANPA `ArrowDown` dulu = toggle All, bukan opsi pertama yang "nyata". Diverifikasi via DOM langsung (`data-selected` attr) di browser sungguhan: `ArrowDown` 1x dari state awal (All ke-highlight) berhasil skip ke opsi kedua yang benar, `Tab` abis itu commit HANYA opsi itu (bukan All). User dikonfirmasi via `AskUserQuestion` -- **dibiarkan sesuai spec asli** ("Tab commit apapun yang lagi di-highlight", termasuk All row kalau memang itu yang ke-highlight). Bukan bug, bukan perlu fix.
    - **Fix (c) -- 2 percobaan**: percobaan pertama pakai Radix `Tooltip`/`TooltipTrigger asChild` dibungkus di sekitar tree yang sama dgn `PopoverTrigger asChild` existing -- **REGRESI KRITIS ditemukan lewat 36 test gagal** ("Unable to find text X") tepat setelah nesting ini ditambah. Dikonfirmasi via dump DOM penuh: `data-state="closed"` dan SELURUH `CommandList` hilang dari DOM setelah 1x klik checkbox -- bukan artefak test doang, nesting 2 primitif trigger Radix (`TooltipTrigger` + `PopoverTrigger`, sama-sama `asChild`) di tree yang overlap/berdekatan MERUSAK state "popover tetap terbuka lintas klik". **Fix final**: Radix Tooltip DIBATALKAN total (semua import/state/JSX terkait dibuang), diganti atribut HTML native `title={!open && values.length > 0 ? joinLabels(values) : undefined}` di Input -- zero risk, langsung pulihkan 36 (lalu 43-44) test ke hijau, dikonfirmasi lagi visual browser bahwa popover tetap terbuka lintas klik SETELAH revert.
    - **Bug ditemukan & dilaporkan user langsung** (via quote kode `MultiSelect.jsx:L640`): highlight `<mark>` pada label opsi muncul KELIRU di opsi lain setelah klik checkbox, padahal user gak lagi ngetik apa-apa (`isDirty=false`). Root cause: `joinLabels(next)` (dipanggil dari `toggleValue`/`toggleAll`) regenerasi teks TANPA delimiter trailing (mis. `"Alpha, Beta"`, bukan `"Alpha, Beta,"`) -- `analyzeText()` jadinya baca entry TERAKHIR (`"Beta"`) sbg `inProgressSegment`, walau `isDirty` baru aja di-reset `false` oleh klik yang sama. **Fix**: `highlightItem(opt.label, inProgressSegment ?? "")` diubah jadi `highlightItem(opt.label, isDirty ? (inProgressSegment ?? "") : "")` -- highlight cuma jalan pas user BENERAN lagi ngetik.
    - 4 test baru `MultiSelect.rtl.test.jsx`: `isDirty` reset via delimiter (dropdown un-filter lagi), Tab commit item pertama (tanpa navigasi), `ArrowDown`+Tab commit item kedua, Tab no-op saat list kosong, tooltip `title` muncul saat tertutup+ada value / hilang saat kosong / hilang saat terbuka, DAN regression guard klik-checkbox-tidak-bikin-highlight-keliru (assert 0 elemen `<mark>` di DOM setelah klik). Total `MultiSelect.rtl.test.jsx` 44 test.
    - Regression penuh: `MultiSelect` 44 test + `Index.rtl.test.jsx` 16 test + consumer lain (`Form`/`ValueField`/`ItemVariantLinkModel`/`ItemLinkModel`) 70 test gabungan -- semua PASS. `npm run build` sukses (cuma warning pre-existing tak terkait: chunk size, lightningcss `:global`).
    - Diverifikasi visual browser end-to-end (setelah rebuild): klik checkbox tunggal -> 0 `<mark>` di DOM (fix highlight-gate terbukti), fresh-open popover -> `data-selected=true` di baris "Semua Warehouse" (konfirmasi temuan Tab+All di atas), `ArrowDown`+`Tab` -> commit "Demo Warehouse" doang (input jadi persis `"Demo Warehouse"`, bukan All).

18. **Koreksi user atas poin 16 (balik ke desain awal + fitur baru)**: setelah dipakai, user berubah pikiran soal model teks persisten poin 16 -- *"jika terlalu banyak option yang dicheck maka input akan panjang dan akan kesusahan saat user ingin menambah option dengan pencarian"*. Diminta balik ke desain PERTAMA (clear-after-commit, yang sempat DITOLAK di poin 16) DENGAN 2 penyempurnaan: (a) paste teks berisi banyak entry sekaligus tetap didukung walau tanpa delimiter di ujung; (b) Tab (dari poin 17) sekarang kudu KUNCI fokus di input selama `isDirty` (sebelumnya selalu pindah fokus keluar, bahkan pas lagi aktif ngetik/nyari -- itu yg dikeluhkan user).
    - **Revert arsitektur**: `search` BUKAN lagi representasi permanen value (`joinLabels(initialValues)` di mount, sync dua arah, live-uncheck via edit teks) -- kembali jadi buffer TRANSIEN, mulai `""` di mount & TIDAK disentuh oleh sync `value` dari prop. `computeSyncedValues` (yg punya sisi UNCHECK berdasar teks) diganti `commitMatchingSegments` -- fungsi baru yg CUMA nambah check, TIDAK PERNAH uncheck lewat teks (uncheck cuma lewat klik checkbox langsung). `hasMountedRef` guard DIHAPUS -- gak diperlukan lagi krn `commitMatchingSegments` gak py sisi destruktif yg bisa keliru wipe value awal di mount.
    - **Commit-lalu-clear**: ketik delimiter -> `commitMatchingSegments` jalan (match dicek), input SELALU `setSearch("")` abis itu -- baik match MAUPUN TIDAK (delimiter = penanda "selesai entry ini", bukan bersyarat match). Blur/close-popover sama: commit entry in-progress kalau match, lalu SELALU clear (bukan rebuild teks dari `joinLabels` spt poin 16).
    - **`toggleValue`/`toggleAll` dilepas dari `search`**: klik checkbox TIDAK lagi regenerasi teks input (`setSearch(joinLabels(next))` dihapus) -- search dibiarkan apa adanya, user bisa lanjut nyari/filter setelah centang 1 opsi tanpa teks-nya keganti daftar terpilih.
    - **Fitur baru -- paste multi-entry**: `onPaste` baru di Input -- kalau teks yg di-paste MENGANDUNG delimiter (dicek via `delimiterRegex.test(pasted)`), `preventDefault()` lalu commit SEMUA segmen (termasuk yg terakhir, `includeInProgress:true`) walau gak diakhiri delimiter -- beda dari ngetik manual krn paste itu aksi sekali-jadi, bukan "lagi diketik". Paste 1 entry tanpa delimiter dibiarkan lewat jalur `onChange` normal (browser insert teks spt biasa).
    - **Fix Tab focus-lock**: `<Command onKeyDown>` -- `else if (e.key === "Tab") { if (isDirty) e.preventDefault(); }` (sebelumnya SENGAJA gak pernah preventDefault). Sekarang: `isDirty=true` (lagi ngetik/nyari) -> fokus TETAP di input abis commit, siap lanjut ketik entry berikutnya; `isDirty=false` (baru buka popover, belum ngetik) -> fokus pindah keluar spt biasa (behavior lama dipertahankan utk kasus ini).
    - **Bug tersembunyi ketemu SAAT nulis test baru** (bukan lewat laporan user, lewat pengembangan test utk fitur ini sendiri): cmdk auto-highlight-item-pertama TERNYATA cuma jalan SEKALI saat mount/registrasi awal -- begitu list ke-filter turun (via `options` conditional-render kita sendiri, `shouldFilter={false}`) dan item yg SEDANG di-highlight hilang dari DOM, cmdk TIDAK otomatis pindah highlight ke item lain yg masih ada. Dibuktikan: ketik "Bet" (filter ke 1 hasil doang, "Beta") -> `[cmdk-item][data-selected="true"]` TIDAK ADA sama sekali di DOM, Tab jadi no-op total -- Tab-commit-while-filtering (skenario UTAMA yg justru dibutuhkan fitur ini) rusak sejak awal, cuma gak ketauan krn test poin 17 gak pernah nyoba kombinasi "ngetik sampai nge-filter" + Tab bareng. Root cause: Input kita BUKAN `CommandPrimitive.Input` (cmdk's sendiri) -- pakai `<Input>` shadcn biasa DI LUAR wiring cmdk, jadi cmdk's internal `search`/scoring context gak pernah tau kita lagi ngetik apa, cuma tau item mana yg PERTAMA KALI teregister.
      - **Fix**: `Command` cmdk ternyata dukung `value`/`onValueChange` TERKONTROL (dicek langsung dari `.d.ts` typings, bukan asumsi) -- state baru `highlightedValue` (`useState`) + efek yg reset ke `visibleValues[0]` (opsi pertama YANG LAGI TAMPIL, termasuk baris All kalau `showAllRow`) tiap kali `visibleValues` berubah DAN highlight saat ini udah gak valid lagi. `<Command value={highlightedValue} onValueChange={setHighlightedValue}>` gantiin auto-highlight bawaan cmdk sepenuhnya -- deterministic, jalan bener baik di mount MAUPUN tiap kali hasil filter berubah. Tab/Enter handler disederhanakan sekalian: baca `highlightedValue` langsung dari state (bukan `popoverRef.current.querySelector('[data-selected="true"]')` lewat DOM lagi) -- lebih robust, gak gantung ke timing render DOM.
    - Test file `MultiSelect.rtl.test.jsx` dirombak besar: describe "delimiters" ditulis ulang total (assert clear-after-commit, bukan persist), describe "teks input = sync dua arah" (poin 16) DIHAPUS diganti describe baru "mount/reopen -- input bukan representasi value (versi lama, sudah ditolak, jangan regress)" (assert kebalikannya -- input MULAI KOSONG di mount, TETAP kosong saat dibuka), describe baru "paste multi-entry" (2 test), 2 test baru di describe Tab (assert `toHaveFocus()` eksplisit utk kedua kasus dirty/tidak-dirty -- test lama poin 17 CUMA assert `onValueChange`, gak pernah assert fokus, padahal itu persis yg dikeluhkan user). Total `MultiSelect.rtl.test.jsx` 44 test (net sama, banyak diganti bukan cuma ditambah).
    - Regression penuh: `MultiSelect` 44 test + `Index.rtl.test.jsx` 16 test + consumer lain (`Items/Form`, `ValueField`, `ItemLinkModel`, `ItemVariantLinkModel`, `Todos/Form`) 60 test gabungan -- semua PASS (120 total). `npm run build` sukses (warning pre-existing sama spt sebelumnya, tak terkait).
    - Diverifikasi visual browser end-to-end: ketik `"Demo Warehouse,"` -> ke-check, input LANGSUNG kosong lagi (beda dari poin 16 yg teks-nya nempel). Paste (disimulasikan via `ClipboardEvent` krn Browser pane gak punya akses clipboard OS asli) `"Warehouse Selatan, Warehouse Timur"` -> KEDUANYA ke-check sekaligus, input kosong. Ketik `"Utara"` (filter ke 1 hasil) -> `Tab` -> "Warehouse Utara" ke-check, DAN `document.activeElement === input` tetap `true` (fokus TIDAK pindah, dikonfirmasi via `javascript_tool`, bukan cuma tebakan visual) -- popover tetap terbuka siap lanjut. Popover baru dibuka tanpa ngetik apa² -> `Tab` -> `document.activeElement` pindah ke elemen BERIKUTNYA (`BUTTON`), sesuai spec "cuma dikunci saat dirty".

19. **Koreksi user atas poin 18** (*"loh saat onBlur ya input harus ada isinya dong, isinya yaitu join option yang dipilih. jika semua tercheck maka input nilainya all. sama seperti sebelumnya. yang saya minta revert kan saat mode edit"*): poin 18 kelewat agresif -- clear-after-commit yg diminta itu KHUSUS utk selama popover terbuka/"mode edit" (nurut istilah user), BUKAN utk state tertutup/blur. Popover TERTUTUP tetap harus tampil ringkasan value terpilih di teks Input itu sendiri (join label, diciutkan jadi label All kalau semua ke-check & `showAllOption` aktif) -- sama seperti sebelum fitur `delimiters` ada sama sekali.
    - **Fix -- model 2 mode**: Input sekarang py 2 mode berbeda tergantung `open`. **Tertutup**: `search` = `labelOfValues(values)` (fungsi yg SUDAH ada dari awal, dipakai sbg placeholder-fallback -- sekarang jadi ISI Input yg sesungguhnya, bukan cuma fallback). **Terbuka ("mode edit")**: `search` = buffer ketikan transien, SELALU mulai `""` begitu popover dibuka (ringkasan yg lagi tampil TIDAK ikut disuntikkan ke buffer edit -- klik buka = mulai bersih, hindari "edit teks ringkasan panjang" yg jadi akar masalah poin 18 awal).
    - **Perubahan kode**: efek `[open]` branch OPEN nambah `setSearch("")` (dulu gak nyentuh `search` sama sekali); branch CLOSE ganti `setSearch("")` jadi `setSearch(labelOfValues(finalValues))`. `labelOfValues` (butuh `allValues`) dipindah definisinya ke ATAS `useState` `search` biar lazy-initializer `search` bisa langsung pakai (`useState(() => labelOfValues(initialValues))`) -- render pertama langsung benar, gak nunggu efek jalan (hindari flash kosong sekilas).
    - **Konsekuensi ke Tab-commit (poin 17)**: kasus "TIDAK dirty" (popover baru dibuka, Tab commit lalu fokus PINDAH keluar) sekarang otomatis MEMICU blur asli (browser default action Tab) -> popover ketutup -> input balik ke ringkasan yg baru (mis. "Alpha" abis Tab commit opsi pertama). Kasus "dirty" (Tab TERKUNCI di input, poin 18) TIDAK berubah -- popover TETAP terbuka (preventDefault jalan), jadi input tetap `""` (masih mode edit) sampai user beneran keluar/blur.
    - Test file dirombak lagi menyesuaikan: describe "mount/reopen -- input bukan representasi value (versi lama, sudah ditolak, jangan regress)" (poin 18) di-rename jadi "dua mode: tertutup = ringkasan, terbuka = buffer edit kosong" -- 2 assertion DIBALIK (mount tampil ringkasan bukan kosong; buka popover MENGOSONGKAN, bukan "tetap kosong") + 1 test baru (semua ke-check + `showAllOption` -> ringkasan diciutkan "TR:core.form.all"). Test blur-commit di describe "delimiters" diupdate: `expect(input).toHaveValue("Beta")` (ringkasan) gantiin `toHaveValue("")`. Test Tab kasus "tidak dirty" ditambah assertion `toHaveValue("Alpha")` (buktiin blur-otomatis-dari-Tab beneran munculin ringkasan, bukan cuma re-assert fokus doang). Total `MultiSelect.rtl.test.jsx` 45 test.
    - Regression penuh: `MultiSelect` 45 test + `Index.rtl.test.jsx` 16 test + consumer lain (`Items/Form`, `ValueField`, `ItemLinkModel`, `ItemVariantLinkModel`, `Todos/Form`) 60 test gabungan -- semua PASS (121 total). `npm run build` sukses.
    - Diverifikasi visual browser end-to-end: ketik `"Demo Warehouse,"` lalu klik luar -> input balik tampil `"Demo Warehouse"` (ringkasan, BUKAN kosong -- fix poin 19 terbukti). Klik lagi utk buka popover -> input LANGSUNG kosong lagi (badge "1" muncul nunjukin msh ada yg ke-check meski teks kosong) -- mode edit mulai bersih spt didesain.

20. **Feature request user (2 hal, diminta bareng)**: (a) Tab jangan langsung check option yg lagi di-highlight -- tunggu sampai user tekan delimiter atau `onBlur`, sama kayak jalur ngetik manual; (b) badge jumlah terpilih ditampilkan JUGA saat popover TERTUTUP (sebelumnya cuma muncul saat terbuka), KECUALI kalau ringkasan teks-nya udah diciutkan jadi label "All" -- exception ini CUMA berlaku saat tertutup, behavior badge pas mode edit/terbuka gak berubah sama sekali.
    - **Fix (a)**: `onKeyDown` `<Command>` dipecah 2 jalur -- Enter TETAP commit langsung (`toggleValue`/`toggleAll` + clear, gak berubah). Tab SEKARANG cuma nulis LABEL opsi yg lagi di-highlight ke `search` (`setSearch(label); setIsDirty(true)`) -- persis kayak autocomplete, TIDAK memanggil `toggleValue`/`toggleAll` sama sekali. Commit beneran BARU terjadi lewat jalur yg SUDAH ada: delimiter diketik berikutnya (`onChange`), atau blur/close popover (efek `[open]`) -- keduanya manggil `commitMatchingSegments` yg nyocokin teks ke label option. Baris "All" jg didukung sbg teks yg bisa di-Tab-tulis: `commitMatchingSegments` ditambah pengecekan segmen yg PERSIS match `allOptionLabel`/`t("core.form.all")` (case-insensitive) -> select SEMUA option, bukan cuma cari 1 option individual -- tanpa ini, Tab di baris All gak akan pernah ke-commit krn "All" bukan label option asli manapun.
      - Keputusan preventDefault Tab (kunci fokus saat `isDirty`) TIDAK berubah sama sekali -- tetap dibaca dari isDirty SEBELUM Tab ditekan. Konsekuensinya: kalau belum dirty (baru buka popover, belum ngetik/navigasi apa²), Tab nulis teks lalu fokus TETAP pindah keluar spt biasa -- itu memicu blur ASLI yg otomatis commit teks yg baru ditulis (bukan Tab-nya langsung yg commit). Kalau udah dirty, Tab nulis teks + fokus terkunci -- commit nunggu delimiter/blur beneran, sesuai requirement literal user.
      - **Gotcha ketemu re-run test lama**: test "ArrowDown lalu Tab" (poin 17) ternyata SALAH asumsi -- `onInputKeyDown` (handler existing, bukan baru) treat SEMUA tombol selain Tab/Enter/modifier (termasuk ArrowDown!) sbg "mulai ngetik" (`setIsDirty(true)`). Jadi ArrowDown doang (tanpa ngetik apapun) UDAH bikin `isDirty=true`, Tab abis itu KUNCI fokus (gak auto-blur-commit). Test lama numpang lolos krn versi lama Tab COMMIT LANGSUNG regardless isDirty; sekarang harus eksplisit ketik delimiter dulu br assert commit. Bukan bug baru -- perilaku `onInputKeyDown` ini udah ada dari awal fitur delimiter, cuma baru KETAUAN kepengaruh di sini setelah Tab jadi deferred.
    - **Fix (b)**: kondisi render badge diubah dari `open && values.length > 0` jadi `values.length > 0 && (open || !(showAllOption && isAllSelected))` -- behavior `open` PERSIS sama kayak sebelumnya (gak disentuh), tambahan cuma nge-cover state tertutup dgn 1 pengecualian.
    - 8 test baru/diubah `MultiSelect.rtl.test.jsx`: describe badge dirombak (badge tampil saat closed, disembunyikan saat closed+All, tetap tampil saat closed+semua-kecheck-tapi-showAllOption-off, gak tampil sama sekali kalau 0 terpilih baik closed/open) + describe Tab dirombak total (Tab-saat-dirty cuma nulis+TIDAK commit sampai delimiter, Tab-saat-tidak-dirty nulis+auto-commit-via-blur, Tab-di-baris-All, ArrowDown+Tab diupdate sesuai gotcha `onInputKeyDown` di atas). Total `MultiSelect.rtl.test.jsx` 49 test.
    - Regression penuh: `MultiSelect` 49 test + `Index.rtl.test.jsx` 16 test + consumer lain (`Items/Form`, `ValueField`, `ItemLinkModel`, `ItemVariantLinkModel`, `Todos/Form`) 60 test gabungan -- semua PASS (125 total). ESLint bersih (1 warning prettier ke-auto-fix). `npm run build` sukses.
    - Diverifikasi visual browser end-to-end: popover baru dibuka (baris "Semua Warehouse" default ke-highlight) -> `Tab` langsung -> fokus pindah keluar (blur asli) -> SEMUA warehouse ke-check (buktiin ekstensi All-label matching di `commitMatchingSegments` jalan), badge disembunyikan krn teks jadi "Semua Warehouse". Reset, ketik `"Sela"` -> `Tab` -> input jadi `"Warehouse Selatan"` (autocomplete lengkap) TAPI checkbox-nya masih `data-state="unchecked"` (dicek langsung via `javascript_tool`, bukan asumsi visual) -- ketik `,` abis itu -> BARU ke-check (badge "1" muncul, input clear).

**Temuan lingkungan lain (di luar scope, dicatat saja):**
- `echo.js` selalu instantiate Pusher tanpa guard untuk key kosong — bikin seluruh app React crash (blank/black screen) kalau `VITE_PUSHER_APP_KEY` kosong. Diworkaround dengan isi dummy key di `.env` sebelum build (bukan ubah `echo.js`, itu infra existing di luar spec ini).
- `php artisan db:seed` OOM 128MB di beberapa titik (sama seperti OOM saat test) — diatasi dengan `-d memory_limit=2048M` (berhasil untuk `db:seed` karena proses langsung, beda dari `php artisan test` yang fork proses terpisah sehingga `-d` tidak ke-apply).
