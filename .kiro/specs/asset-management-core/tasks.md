# Implementation Plan: Asset Management Core (Fase 1)

## Overview

Membangun domain `Asset` baru: model `AssetCategory` (flat), `AssetLocation` (tree via `TreeView`), dan `Asset` (via `Submitable` + `AssetService implements SubmitableService`). Urutan implementasi: enum baru → migration → model → service → controller/routing → dokumentasi. Tidak ada perubahan pada domain existing (Item, SalesOrder, Inventory) — semua field integrasi fase depan (`item_id`, kolom depresiasi) disiapkan skema-nya tapi tanpa logic aktif.

## Tasks

- [x] 1. Enum baru dan perluasan FormStatus
  - [x] 1.1 Buat `App\Enums\AssetType` (EXISTING_ASSET, COMPOSITE_ASSET, COMPOSITE_COMPONENT)
    - String-backed enum, pola sama seperti `FormStatus`
    - _Requirements: 3.2_

  - [x] 1.2 Buat `App\Enums\AssetOwnershipType` (COMPANY, SUPPLIER, CUSTOMER)
    - String-backed enum
    - _Requirements: 4.1_

  - [x] 1.3 Tambah case baru ke `App\Enums\FormStatus`
    - Tambah: SCRAPPED, SOLD, OUT_OF_ORDER, IN_MAINTENANCE, ISSUED, PARTIALLY_DEPRECIATED, FULLY_DEPRECIATED, CAPITALIZED, WORK_IN_PROGRESS
    - Cek `label()` method existing tetap kompatibel (butuh entri translation baru di file lang, lihat task 6)
    - _Requirements: 8.2_

  - [x] 1.4 Write unit tests for enum baru (Enum Completeness)
    - **Enum Completeness: setiap case punya value string valid dan `label()` tidak error**
    - Test `AssetType::cases()`, `AssetOwnershipType::cases()`, dan 9 case `FormStatus` baru — assert value dan `label()` tidak throw
    - **Validates: Requirements 3.2, 4.1, 8.2**

- [x] 2. Checkpoint - Ensure enum tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Migration
  - [x] 3.1 Migration `create_asset_categories_table`
    - Kolom sesuai Data Models design.md: category_name (unique), non_depreciable_category, enable_cwip_accounting, is_rentable, default_depreciation_method, default_frequency_of_depreciation, default_total_number_of_depreciations, timestamps, soft delete
    - _Requirements: 1.1, 1.3, 1.4, 1.5, 1.6_

  - [x] 3.2 Migration `create_asset_category_accounts_table`
    - FK asset_category_id (cascade), branch_id, 4 kolom account_id (nullable, FK ke accounts)
    - _Requirements: 1.2_

  - [x] 3.3 Migration `create_asset_locations_table`
    - Kolom: location_name (unique), parent_id (FK self), is_group, branch_id, lft/rgt/depth (utk TreeView), timestamps, soft delete
    - _Requirements: 2.1, 2.3, 2.4_

  - [x] 3.4 Migration `create_assets_table`
    - Seluruh kolom sesuai tabel Data Models design.md (identitas, ownership, lokasi/PIC, pembelian, depresiasi flat, asuransi, status Submitable)
    - FK asset_category_id dan asset_location_id: `restrictOnDelete()` (Requirement 1.7, 2.5)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 5.1, 5.2, 5.3, 6.1, 6.2, 6.3, 6.4, 7.1, 8.1, 9.3, 9.4_

  - [x] 3.5 Jalankan migration di environment test, verifikasi tidak ada error skema
    - `php artisan migrate --env=testing` atau setara test runner project
    - _Requirements: (verifikasi struktural, tidak spesifik ke satu requirement)_

- [x] 4. Checkpoint - Ensure migration berhasil tanpa error
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Model AssetCategory dan AssetCategoryAccount
  - [x] 5.1 Buat `App\Models\Asset\AssetCategory`
    - Trait `DataTable, HasUlids, SoftDeletes`; `$guarded`, `$casts` (boolean fields)
    - `formComponent`, `translateKey`, `configColumns` (pola sama `Category`)
    - Relasi `accounts(): HasMany`
    - _Requirements: 1.1, 1.3, 1.4, 1.5, 1.6, 10.3_

  - [x] 5.2 Buat `App\Models\Asset\AssetCategoryAccount`
    - `belongsTo` ke AssetCategory, Branch, dan 4 relasi `belongsTo(Account::class)`
    - _Requirements: 1.2_

  - [x] 5.3 Factory `AssetCategoryFactory` dan `AssetCategoryAccountFactory`
    - _Requirements: (mendukung testing task 5.4, 5.5)_

  - [x] 5.4 Write unit tests for AssetCategory (Model Attributes & Relations)
    - **Model Attributes: default value non_depreciable_category/enable_cwip_accounting/is_rentable adalah false**
    - Test relasi `accounts()` mengembalikan HasMany yang benar
    - **Validates: Requirements 1.3, 1.4, 1.5**

  - [x] 5.5 Write integration test for AssetCategory deletion guard (Category Deletion Guard)
    - **Category Deletion Guard: AssetCategory yang masih direferensikan Asset tidak bisa dihapus**
    - Buat Asset dgn kategori X, coba hapus kategori X, assert exception/penolakan
    - **Validates: Requirement 1.7**

- [x] 6. Model AssetLocation
  - [x] 6.1 Buat `App\Models\Asset\AssetLocation`
    - Trait `DataTable, HasUlids, SoftDeletes, TreeView, HasBranch`
    - `templateLink()`, `parent(): BelongsTo`, `$casts` (is_group boolean)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 10.3_

  - [x] 6.2 Implementasi guard hapus AssetLocation (subtree masih direferensikan Asset)
    - Override event `deleting` di model ATAU guard di Controller (task 9) — cek `Asset::whereIn('asset_location_id', $descendantIds)->exists()` sebelum delegasi ke TreeView
    - _Requirements: 2.5_

  - [x] 6.3 Factory `AssetLocationFactory`

  - [x] 6.4 Write integration test for AssetLocation tree behavior (Tree Structure Integrity)
    - **Tree Structure Integrity: lft/rgt/depth konsisten setelah create, move, dan delete nested location**
    - Reuse pola assertion dari test TreeView/Account existing
    - **Validates: Requirement 2.2**

  - [x] 6.5 Write integration test for AssetLocation deletion guard (Property 5: Tree deletion guard)
    - **Property 5: penghapusan AssetLocation HANYA berhasil jika tidak ada Asset yang mereferensikan lokasi tsb atau subtree-nya**
    - Test kasus: Asset langsung di lokasi, Asset di child lokasi (subtree) — keduanya harus block delete
    - **Validates: Requirement 2.5**

- [x] 7. Checkpoint - Ensure AssetCategory dan AssetLocation tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Model Asset (inti)
  - [x] 8.1 Buat `App\Models\Asset\Asset` — identitas dan relasi dasar
    - Trait `DataTable, HasUlids, SoftDeletes, Submitable`; `protected static $service = AssetService::class`
    - Relasi `assetCategory()`, `assetLocation()`, `item()` (nullable)
    - `$casts` untuk `asset_type` (AssetType enum), tanggal, decimal
    - _Requirements: 3.1, 3.2, 3.3, 10.3_

  - [x] 8.2 Implementasi field dan validasi ownership pada model
    - `$casts` untuk `ownership_type` (AssetOwnershipType enum)
    - Relasi `ownershipSupplier()`, `ownershipCustomer()`, method `ownershipEntity()` (match berdasar ownership_type)
    - _Requirements: 4.1, 4.2, 4.6_

  - [x] 8.3 Implementasi hook `saving()` untuk auto is_depreciable dan asset_quantity
    - Auto-false `is_depreciable` jika `ownership_type !== company` (kecuali override eksplisit dari data)
    - Auto-set default `is_depreciable` dari `assetCategory.non_depreciable_category` saat create
    - _Requirements: 4.7, 6.2_

  - [x] 8.4 Implementasi accessor `total_asset_cost`
    - `Attribute::get()` = gross_purchase_amount + additional_asset_cost, BUKAN kolom fisik
    - _Requirements: 5.3_

  - [x] 8.5 Implementasi method status transisi operasional
    - `scrap()`, `sell()` (placeholder LogicException), `setInMaintenance()`, `setOutOfOrder()`, `reactivate()`
    - Helper `assertStatusTransition(array $allowedFrom, FormStatus $to)` — lempar LogicException jika status asal tidak valid
    - `scrap()` mengisi `disposal_date`
    - _Requirements: 9.1, 9.2, 9.5_

  - [x] 8.6 Factory `AssetFactory`
    - State variants: existing asset, company-owned (default), supplier-owned, customer-owned

  - [x] 8.7 Write unit tests for Asset ownership (Property 1: Ownership exclusivity)
    - **Property 1: tepat satu dari ownership_company_id/ownership_supplier_id/ownership_customer_id non-null sesuai ownership_type, dua lainnya selalu null**
    - Test 3 kasus valid (company/supplier/customer) + kombinasi invalid (mis. ownership_type=supplier tapi ownership_supplier_id null)
    - **Validates: Requirements 4.3, 4.4, 4.5**

  - [x] 8.8 Write unit tests for is_depreciable default (Property 3: Depreciability monotonic default)
    - **Property 3: Asset dengan ownership_type != company selalu is_depreciable=false kecuali override eksplisit**
    - Test create dgn ownership supplier/customer tanpa override → false; dengan override eksplisit → sesuai override
    - **Validates: Requirement 4.7**

  - [x] 8.9 Write unit tests for asset_quantity rentable constraint (Property 2: Rentable quantity invariant)
    - **Property 2: Asset dgn assetCategory.is_rentable=true selalu asset_quantity=1 setelah disimpan**
    - Test create dgn kategori rentable + quantity>1 → ditolak; quantity=1 → berhasil
    - **Validates: Requirement 3.5**

  - [x] 8.10 Write unit tests for status transitions (Property 4: Status transition legality)
    - **Property 4: transisi status HANYA berhasil dari status asal yang valid, selalu melempar exception dan tidak mengubah state jika tidak valid**
    - Test matrix: [status asal, method, expected hasil] untuk scrap/setInMaintenance/setOutOfOrder/reactivate
    - **Validates: Requirement 9.2**

  - [x] 8.11 Write unit tests for total_asset_cost accessor
    - Test computed value konsisten dgn gross_purchase_amount + additional_asset_cost, termasuk setelah update salah satu kolom
    - **Validates: Requirement 5.3**

- [x] 9. Checkpoint - Ensure model Asset tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. AssetService (SubmitableService)
  - [x] 10.1 Buat `App\Services\Asset\AssetService implements SubmitableService`
    - Implementasi `create()`, `update()`, `delete()` dari CrudService
    - `create()` menetapkan default `is_depreciable` dari AssetCategory jika tidak di-override
    - `update()` guard field read-only pasca-submit (identitas inti tidak bisa diubah setelah Active)
    - _Requirements: 1.6, 6.2, 8.3_

  - [x] 10.2 Implementasi `submit()`, `cancel()`, `amend()`
    - `submit()` delegasi ke `$model->checkApproval()`
    - **[REVISI] `cancel()` MELEMPAR LogicException — Asset TIDAK mendukung cancel (dikonfirmasi user, bukan delegasi ke Submitable seperti draft awal task ini).** `Asset::canCancel()`/`canDelete()` juga override `false` sebagai guard tambahan di level Controller generik.
    - `amend()` delegasi ke `$model->amend()`
    - _Requirements: 8.4, 8.6_ (8.5 dihapus dari cakupan task ini — lihat requirements.md, kriteria cancel diganti total)

  - [x] 10.3 Implementasi `onApproved()` dan `onRejected()`
    - `onApproved()`: set status Active jika `available_for_use_date <= now()`, else tetap Submitted
    - `onRejected()`: kembalikan status ke Draft
    - _Requirements: 8.4_

  - [x] 10.4 Write integration test for approval flow (Submit-Approval Cycle)
    - **Submit-Approval Cycle: onApproved()/onRejected() mengubah status Asset dengan benar**
    - Implemented: `AssetApprovalFlowTest.php` — test `onApproved()` set Active jika `available_for_use_date` sudah lewat, tetap Submitted jika belum, `onRejected()` kembali ke Draft.
    - **GAP DIKETAHUI**: test ini panggil `onApproved()`/`onRejected()` langsung (unit-level), BELUM menguji full siklus `submit() → checkApproval() → ApprovalInstance dibuat → approve via ApprovalService → onApproved() terpanggil otomatis` (integration-level). Deskripsi task asli minta yang kedua — dicentang selesai untuk cakupan yang ADA, gap integration penuh dicatat sebagai technical debt, bukan diabaikan.
    - **Validates: Requirements 8.3, 8.4 (parsial — lihat gap di atas)**

  - [x] 10.5 Write integration test for cancel behavior
    - **[REVISI] Sesuai perubahan 10.2**: cancel TIDAK didukung, jadi test-nya adalah `AssetCancelTest.php` — assert `AssetService::cancel()` selalu melempar `LogicException`, `Asset::canCancel()` dan `canDelete()` selalu `false`.
    - **Validates: Requirement 8.5 (direvisi — lihat requirements.md)**

- [x] 11. Checkpoint - Ensure AssetService tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Controller dan Routing
  - [x] 12.1 Buat `App\Http\Requests\Asset\AssetCategoryRequest` dan `AssetLocationRequest`
    - Validasi field wajib/unique sesuai Requirement 1 dan 2
    - _Requirements: 1.1, 2.1_

  - [x] 12.2 Buat `App\Http\Requests\Asset\AssetRequest`
    - Validasi ownership exclusivity (Requirement 4.3-4.5), validasi asset_quantity=1 jika kategori rentable (Requirement 3.5)
    - _Requirements: 3.5, 4.3, 4.4, 4.5_

  - [x] 12.3 Buat `App\Http\Controllers\Asset\AssetCategoryController` dan `AssetLocationController`
    - Pola sama `CategoryController`: constructor, index/create/store/show/update
    - _Requirements: 10.1, 10.2_

  - [x] 12.4 Buat `App\Http\Controllers\Asset\AssetController`
    - CRUD dasar delegasi ke AssetService
    - Route action `submit`, dan `{action}` generik dispatch ke scrap/setInMaintenance/setOutOfOrder/reactivate; `sell` mengembalikan response 501
    - _Requirements: 9.1, 9.5, 10.1, 10.2_

  - [x] 12.5 Daftarkan routes di `routes/web.php`
    - Pola sama Inventory: `use App\Http\Controllers\Asset\...Controller;` + resource routes + action routes tambahan
    - _Requirements: 10.2_

  - [x] 12.6 Write integration tests for Controllers (CRUD dan Validation)
    - **[RESOLVED]** Klaim awal "di-skip krn Vite manifest" TIDAK AKURAT — masalah sebenarnya cuma `HandleInertiaRequests` middleware butuh Vite manifest untuk method yang me-render Inertia (`index`/`create`/`show`), sedangkan `store`/`update`/`submit`/`action` (redirect-only) tidak kena. Solusi: `$this->withoutMiddleware([HandleInertiaRequests::class, ...])`, pola yang sudah ada di `BranchControllerTest`/`WarehouseBranchScopeTest` existing.
    - `AssetCategoryControllerTest`, `AssetLocationControllerTest`, `AssetControllerTest` ditulis — CRUD (store/update) + validasi field wajib via HTTP asli (`postJson`/`putJson` + `actingAs` + `withSession(['permissions'=>...])`).
    - **5 BUG DITEMUKAN dan SEMUA SUDAH DIPERBAIKI** (bukan sekadar dicatat — kode produksi diubah, test diverifikasi ulang):
      1. **[FIXED]** `assets.code` NOT NULL tanpa default, `AssetService::create()` tidak pernah mengisinya. Fix: `create()` sekarang memanggil `FormatingSeries::generate(Asset::class, $data, true)` untuk kode DRAFT (isDraft=true) — sesuai keputusan desain user: kode draft di create(), kode final di-generate ulang saat submit().
      2. **[FIXED]** `AssetLocationRequest::rules()` tidak punya rule untuk `branch_id` (NOT NULL). Fix: tambah `'branch_id' => ['required', 'string', 'exists:branches,id']`.
      3. **[FIXED]** `AssetService::create()`/`update()`/`submit()` pakai `DB::beginTransaction()`/`DB::commit()` manual tanpa try/catch+rollback. Fix: dibungkus try/catch dengan `DB::rollBack()` + rethrow di ketiga method.
      4. **[FIXED]** Ownership exclusivity (Req 4.3-4.5) dan asset_quantity rentable (Req 3.5) tidak divalidasi di `AssetRequest`. Fix: tambah `withValidator()` dengan `validateOwnershipExclusivity()` (cuma jalan kalau `ownership_type` ada di request — partial update tidak dipaksa isi ulang ownership) dan `validateRentableQuantity()`.
      5. **[FIXED, bug generik ditemukan tak sengaja]** `FormatingSeries::generate()` (app/Models/Core/FormatingSeries.php baris ~174) melempar "Undefined array key updated_at" ketika `$selectTime` falsy (format code tanpa token tahun/bulan, mis. default Asset `'@[iiii]'`) — kondisi `$selectTime ? $refKey[$selectKey] : $refKey` salah, seharusnya selalu `$refKey[$selectKey]` (konsisten dengan baris tulis-baliknya). Fix 1 baris, diverifikasi TIDAK regresi terhadap `SalesOrder`/`StockEntry` (model lain pemakai `FormatingSeries`) via test terpisah.
    - Total 8 test baru (3 AssetCategory, 3 AssetLocation, 5 Asset — 3 di antaranya sempat jadi bug-marker, sekarang diganti assertion sukses setelah fix), semua PASS bersama seluruh 55 test Asset domain (26 Feature + 29 Unit) DAN test SalesOrder/StockEntry (regresi FormatingSeries).
    - **Validates: Requirements 1.1, 2.1, 3.5, 4.3, 4.4, 4.5 — SEMUA TERPENUHI setelah fix**, terbukti via test HTTP asli yang assert HTTP 422 rapi + `assertJsonValidationErrors()` untuk kasus invalid.

- [x] 13. Checkpoint - Controller tests lengkap, 5 bug ditemukan DAN diperbaiki
  - Seluruh 55 test Asset domain (Feature + Unit) PASS, 0 failure. Test SalesOrder/StockEntry (dampak fix FormatingSeries generik) PASS, 0 failure.
  - File yang diubah: `app/Services/Asset/AssetService.php` (code draft + transaksi aman), `app/Http/Requests/Asset/AssetLocationRequest.php` (branch_id required), `app/Http/Requests/Asset/AssetRequest.php` (validasi ownership+rentable), `app/Models/Core/FormatingSeries.php` (fix generik 1 baris).
  - **Todo minor tersisa** (di luar scope Fase 1, tidak blocking): string translasi `asset.ownership_field_must_be_empty` dan `asset.rentable_must_be_single_unit` dipakai di kode tapi belum terdaftar di file lang manapun — `__()` akan return key mentah, bukan pesan human-readable. Perlu ditambahkan saat fase i18n modul Asset.

- [x] 14. Dokumentasi
  - [x] 14.1 Buat `docs/modules/asset.md`
    - Ikuti struktur dokumentasi modul lain (Gambaran Modul, Korelasi Antar-Feature, detail tiap model, business flow)
    - Sertakan catatan eksplisit bahwa ini Fase 1 dari 5 fase, dengan daftar fase lanjutan
    - _Requirements: 10.5_

- [x] 16. File terjemahan (lang)
  - [x] 16.1 Buat `lang/id/asset/category.php` dan `lang/en/asset/category.php`
    - Struktur sama `lang/id/inventory/category.php`: title, add, new, delete, delete.description, delete.confirm, cancel, columns.{category_name, is_rentable, non_depreciable_category, enable_cwip_accounting}
    - _Requirements: 11.1, 11.2, 11.4_

  - [x] 16.2 Buat `lang/id/asset/location.php` dan `lang/en/asset/location.php`
    - Struktur sama `lang/id/inventory/warehouse.php`: title, add, new, delete, delete.description, delete.confirm, cancel, columns.{location_name, parent_id, is_group, branch}
    - _Requirements: 11.1, 11.2_

  - [x] 16.3 Buat `lang/id/asset/asset.php` dan `lang/en/asset/asset.php`
    - Struktur sama, columns mencakup SEMUA field Requirement 3-9, plus key `actions.*` (label tombol) dan `sections.*` (label tab form)
    - Key top-level `ownership_field_must_be_empty`, `rentable_must_be_single_unit`, `cannot_cancel`, `cannot_transition_status`, `sell_not_implemented`, `location.cannot_delete_has_assets` — diakses backend via `__('asset/asset.xxx')`
    - _Requirements: 11.1, 11.2, 11.3, 11.5_

  - [x] 16.4 Tambah 9 case FormStatus baru ke `lang/id/status.php` dan `lang/en/status.php`
    - Key: scrapped, sold, out_of_order, in_maintenance, issued, partially_depreciated, fully_depreciated, capitalized, work_in_progress
    - _Requirements: 11.6_

  - [x] 16.5 Write test untuk memastikan seluruh key lang dipakai kode benar-benar terdaftar
    - **[BUG DITEMUKAN+DIPERBAIKI]** Format key `__()` Laravel untuk file dalam subfolder lang adalah `{folder}/{file}.{key}` (garis miring), BUKAN `{folder}.{file}.{key}` (titik) — beda dari format `t()` frontend (laravel-react-i18n) yang pakai titik untuk semua level. Dikonfirmasi via tinker: `__('inventory.category.columns.name')` TIDAK resolve (return key mentah), `__('inventory/category.columns.name')` resolve dengan benar. Kode produksi (`Asset.php`, `AssetService.php`, `AssetRequest.php`, `AssetLocation.php`) SEMPAT salah pakai format titik (`__('asset.xxx')`) — DIPERBAIKI jadi `__('asset/asset.xxx')` di keenam pemanggilan.
    - `tests/Unit/Asset/AssetTranslationParityTest.php` — parity key antar locale untuk category.php, location.php, asset.php, dan 9 case status baru
    - `tests/Feature/Asset/AssetTranslationResolutionTest.php` — assert `__('asset/asset.xxx')` dst TIDAK mengembalikan key mentah, locale id dan en
    - **Validates: Requirement 11**

- [x] 17. Checkpoint - Ensure lang tests pass
  - `AssetTranslationParityTest` + `AssetTranslationResolutionTest`: 26 test PASS, 0 failure (66 assertions).

- [x] 18. Halaman Inertia — AssetCategory dan AssetLocation
  - [x] 18.1 Buat `resources/js/Pages/Asset/Categories/{Index,Form}.jsx`
    - Pola sama `resources/js/Pages/Inventory/Categories/{Index,Form}.jsx` — DataTable2, FormPageContent, useFormPage, FormInput
    - Form: input category_name, is_rentable (FormCheckbox), non_depreciable_category (FormCheckbox). `enable_cwip_accounting` SENGAJA TIDAK ditampilkan (Requirement 12.2 — ditunda Fase 3, backend juga belum proses field ini)
    - TIDAK ada input untuk `accounts` (child table) atau default depresiasi — ditunda Fase 3
    - _Requirements: 12.1, 12.2_

  - [x] 18.2 Buat `resources/js/Pages/Asset/Categories/AssetCategoryLinkModel.jsx`
    - Pola sama `resources/js/Pages/Inventory/Warehouses/WarehouseLinkModel.jsx` — LinkModel wrapper, model="App\Models\Asset\AssetCategory"
    - _Requirements: 12.4_

  - [x] 18.3 Buat `resources/js/Pages/Asset/Locations/{Index,Form}.jsx`
    - Pola sama, Form: input location_name, parent (AssetLocationLinkModel — self-reference, filter exclude diri sendiri), is_group (FormCheckbox), branch (BranchLinkModel — pola sama `Warehouse` Form.jsx)
    - _Requirements: 12.1, 12.3_

  - [x] 18.4 Buat `resources/js/Pages/Asset/Locations/AssetLocationLinkModel.jsx`
    - Pola sama, model="App\Models\Asset\AssetLocation"
    - _Requirements: 12.4_

  - [x] 18.5 **[RESOLVED, tidak diperlukan]** `resources/js/app.jsx` pakai `resolvePageComponent` + `import.meta.glob("./Pages/**/*.jsx")` — Inertia auto-resolve komponen by path, TIDAK ada mekanisme registrasi manual terpisah. Menempatkan file di path yang benar (18.1-18.4) sudah cukup.
    - _Requirements: 12.1_

- [ ] 19. Checkpoint - Ensure AssetCategory/AssetLocation pages render tanpa error
  - Verifikasi manual atau test browser: buka /assetCategories dan /assetLocations, pastikan tidak ada "Page not found" Inertia
  - **Catatan**: string terjemahan frontend (`t()`) dibaca dari `/lang/php_{locale}.json` (di-generate, `.gitignore`), BUKAN langsung dari `lang/*/asset/*.php`. Mekanisme generate JSON ini infrastruktur pre-existing project (bukan bagian scope Fase 1 Asset) — kalau string Asset tidak muncul di UI meski file PHP sudah benar (sudah diverifikasi test parity+resolution di Group 16), kemungkinan cache JSON perlu di-refresh, BUKAN bug di file lang Asset.
  - Ensure all tests pass, ask the user if questions arise.

- [x] 20. Halaman Inertia — Asset
  - [x] 20.1 Buat `resources/js/Pages/Asset/Assets/Form.jsx` — bagian Identitas & Lokasi
    - AssetCategoryLinkModel, AssetLocationLinkModel, asset_name, asset_type (Select, disabled — value composite baru berfungsi Fase 5), asset_quantity (NumberInput), item (ItemLinkModel, disabled — diisi otomatis Fase 2), custodian (UserLinkModel)
    - _Requirements: 13.1, 13.2, 13.3_

  - [x] 20.2 Buat bagian Ownership pada `Asset/Assets/Form.jsx`
    - ownership_type (Select), field kondisional (SupplierLinkModel/CustomerLinkModel) — HANYA satu tampil sesuai ownership_type dipilih via conditional render `{data?.ownership_type === "supplier" && (...)}`. ownership_company_id TIDAK ditampilkan sebagai field terpisah (default company, tidak perlu picker eksplisit pada fase ini)
    - _Requirements: 13.4_

  - [x] 20.3 Buat bagian Pembelian & Depresiasi pada `Asset/Assets/Form.jsx`
    - purchase_date, available_for_use_date, gross_purchase_amount, additional_asset_cost (NumberInput), total_asset_cost (read-only, computed client-side = gross+additional, cermin accessor backend), calculate_depreciation (FormCheckbox) + field terkait tampil kondisional saat checkbox aktif
    - _Requirements: 13.2_

  - [x] 20.4 Buat bagian Asuransi pada `Asset/Assets/Form.jsx`
    - Section terpisah (FormPageContent value="insurance") — semua field nullable, tidak ada validasi wajib
    - _Requirements: 13.2_

  - [x] 20.5 Buat `resources/js/Pages/Asset/Assets/Index.jsx`
    - Tampilkan status via `t(\`status.${status}\`)` per item array (status Submitable = array), bukan value mentah
    - _Requirements: 13.5_

  - [x] 20.6 Buat `resources/js/Pages/Asset/Assets/Show.jsx` + tombol aksi status
    - **[RESOLVED, konvensi ditemukan]** Model submitable di codebase ini punya `Show.jsx` TERPISAH dari `Form.jsx` (bukan digabung) — `Form.jsx` dipakai dialog create cepat (`Index.jsx` `form={<Form/>}`) DAN di-embed dalam `Show.jsx` untuk halaman detail penuh dengan tombol aksi. Pola diambil dari `Purchase/PurchaseOrders/Show.jsx` (`FormPage` + prop `submitable` + `controls` render-prop untuk tombol tambahan, tombol Submit/Cancel bawaan otomatis dari `FormPage`).
    - `AssetController::create()`/`show()` DIUBAH dari `renderShow()` generik (cocok utk model non-submitable) menjadi `Inertia::render('Asset/Assets/Show', ...)` — konsisten pola `PurchaseOrderController`.
    - Tombol aksi (scrap/setInMaintenance/setOutOfOrder/reactivate) ditentukan dinamis dari `asset.status` via lookup table `STATUS_ACTIONS`, TIDAK ada tombol sell() (Requirement 9.5, placeholder backend)
    - _Requirements: 13.6_

- [x] 21. Checkpoint - Ensure Asset page renders dan aksi status berfungsi
  - `AssetControllerTest` (5 test store/update/validation) tetap PASS setelah refactor Controller `create()`/`show()` — diverifikasi ulang, 0 regresi
  - Verifikasi visual browser BELUM dilakukan pada sesi ini (perlu `npm run dev`/`build` — di luar lingkup edit kode backend/test) — lihat catatan Group 22
  - Ensure all tests pass, ask the user if questions arise.

- [x] 21.1 Audit properti standar model — DITEMUKAN 6 GAP, SEMUA DIPERBAIKI
  - User meminta audit ulang: `Asset` model tidak punya `formComponent`/`translateKey`/`templateLink()`/`configColumns` sama sekali, padahal `AssetCategory`/`AssetLocation` sudah punya (tidak konsisten dalam domain yang sama).
  - **Gap 1 [FIXED]**: `Asset` tidak punya `formComponent`, `translateKey`, `templateLink()`, `configColumns` — DAMPAK NYATA: `ModelController::templateLinkColumns()` (dipakai backend `LinkModel` search endpoint) guard `method_exists()` jadi silent-return `[]` tanpa `templateLink()` — kalau `Asset` dipakai sebagai LinkModel dari modul lain (fase depan), hasil pencarian akan kosong tanpa error. Ditambahkan mengikuti pola `Item`/`Warehouse` (`templateLink()` HTML dengan `<title>`/`<b>`, `configColumns` utk code/asset_name/relasi/status/nilai).
  - **Gap 2 [FIXED]**: `custodian()` relasi BELUM ADA di `Asset` model — padahal kolom `custodian_id` ada di migration dan field `custodian` dipakai `Asset/Assets/Form.jsx` (UserLinkModel). Ditambah `belongsTo(User::class, 'custodian_id')`.
  - **Gap 3 [FIXED, PALING SERIUS]**: `AssetLocation` pakai trait `HasBranch` tapi TIDAK punya relasi `branch()` sendiri — `HasBranch` cuma sediakan query scope (`bootHasBranch`), BUKAN relasi Eloquent (dikonfirmasi baca ulang `app/Traits/HasBranch.php`). Akibatnya `Asset::branch()` accessor (delegasi ke `$this->assetLocation?->branch`) SELALU gagal — kalau `assetLocation` ada, akses `->branch` akan error "Call to undefined relationship" (Eloquent lempar exception saat magic `__get` gagal resolve relasi tak terdefinisi). Ditambah `branch(): BelongsTo` di `AssetLocation`, konsisten pola `Warehouse::branch()`.
  - **Gap 4 [FIXED]**: `loadRelationsOnShow()` tidak didefinisikan di ketiga model — ditambahkan (`Asset`: assetCategory/assetLocation/custodian/ownershipSupplier/ownershipCustomer; `AssetCategory`: accounts; `AssetLocation`: parent/branch). Tanpa ini, halaman Show berpotensi N+1 query saat render relasi.
  - **Gap 5 [Ditemukan, TIDAK bug]**: sempat dikira `translateKey='asset.category'` (titik) salah format (ikut kekhawatiran soal `__()` backend butuh garis miring) — TERNYATA `translateKey` dan pemanggilan `t()` manual di JSX itu KONVENSI TERPISAH dari `__()` PHP backend: frontend `laravel-react-i18n` `t()` SELALU pakai TITIK di semua level (`inventory.category.columns.name` bekerja untuk file `lang/xx/inventory/category.php`), sedangkan backend `__()` PHP butuh GARIS MIRING (`inventory/category.columns.name`). Dua sistem resolusi berbeda untuk file lang yang sama.
  - **Gap 6 [FIXED, akibat Gap 5]**: SEMUA panggilan `t("asset/...")` di 7 file `.jsx` yang ditulis (46 kemunculan total) SALAH FORMAT (ikut aturan backend, bukan frontend) — diperbaiki jadi `t("asset...")` (titik) di seluruh `Categories/{Form,Index,AssetCategoryLinkModel}.jsx`, `Locations/{Form,AssetLocationLinkModel}.jsx`, `Assets/{Form,Show}.jsx`.
  - 12 test baru ditambahkan (4 di `AssetTest`, 3 di `AssetCategoryTest`, 5 di `AssetLocationTreeTest`) membuktikan tiap properti/relasi yang ditambah. **Total 87 test PHP (Feature+Unit Asset domain), 0 failure** setelah seluruh perbaikan.
  - **Gap 7 [FIXED]**: `configColumns` key relasi HARUS EXACT MATCH nama function (dikonfirmasi user + terverifikasi `DataTableConfigValidator::checkRelationValid()` — `$fn = $col['nameOfFunction']`, `method_exists($instance, $fn)`). Key `asset_category`/`asset_location` (snake_case) di `Asset.php` SALAH — diperbaiki jadi `assetCategory`/`assetLocation` (camelCase, persis nama function), konsisten pola `Account::configColumns['parentAccount']` yang match `parentAccount()`.
  - **Verifikasi via `php artisan model:cache --strict`** (command custom project, baca skema DB nyata via `Schema::getColumnListing()` + validasi `templateLink()`/`configColumns` terhadap kolom/relasi/accessor yang benar-benar ada): worktree ini semula TIDAK PUNYA file `.env` (cuma `.env.example`), sehingga koneksi DB gagal/kosong dan 14 model PRE-EXISTING (SalesOrder, PurchaseOrder, dst — bukan buatan sesi ini) tampak "melanggar" Rule 2/4 (`code` dianggap bukan kolom DB — padahal `code` memang kolom RUNTIME yang diinjeksi `initPermissions()`/`PermissionSeeder`, bukan migration statis). Dikonfirmasi user: `.env` di-copy dari project root (bukan re-seed DB worktree) — setelah itu `model:cache --strict` **exit code 0, 0 violation** untuk SEMUA model termasuk 4 model Asset. 14 model itu TERBUKTI bukan bug, murni env worktree kosong.
  - Test suite dijalankan ulang dengan `.env` root (koneksi MySQL, bukan SQLite `:memory:` default) — **86 test, 0 failure**, tanpa warning (berbeda dari run sebelumnya yang pakai SQLite test default dan menampilkan warning `file_get_contents`).
  - **Gap 8 [FIXED, BUG FUNDAMENTAL VALIDATOR — dampak lintas codebase, bukan spesifik Asset]**: User test manual — hapus `'type' => 'relation'` dari `Asset::$configColumns` dan revert key ke snake_case (`asset_category`/`asset_location`) — `model:cache --strict` TETAP tidak mendeteksi error. Investigasi lanjutan menemukan 2 bug lagi di `DataTableConfigValidator`:
    - **Bug A**: `validate()` mengakses `$instance->configColumns`/`$defaultConfigColumns` (properti `protected`) langsung dari class terpisah via operator `??` — akses visibility gagal DIAM-DIAM di PHP (fallback ke `[]`, tanpa exception). Validator **TIDAK PERNAH** benar-benar membaca `configColumns` model manapun sejak file ini dibuat — "0 violation" di seluruh model selalu palsu-positif. Fix: baca properti via `ReflectionProperty::setAccessible(true)`.
    - **Bug B (turunan A)**: setelah Bug A diperbaiki, method `protected` milik trait `LinkModel` sendiri (mis. `appendStatus()`) muncul sebagai false-positive "undefined method" — Eloquent magic `__call()` SELALU melempar `BadMethodCallException` generik saat method non-public dipanggil dari luar class, walau method itu valid dan bukan relasi. Fix: skip validasi Rule 3 untuk method non-public.
    - **Bug C (root cause laporan user)**: Rule 3 sebelumnya HANYA menandai error kalau config eksplisit berisi `'type' => 'relation'` — kalau developer lupa/menghapus signal itu, validator kembali buta terhadap typo apapun (persis skenario test manual user). **Fix final (instruksi eksplisit user)**: validasi tiap key `configColumns` MILIK MODEL SENDIRI (bukan hasil merge `defaultConfigColumns` generik `LinkModel` — superset lintas-model yang banyak entrinya opsional/tidak relevan per model, mis. `have_transactions`/`lft`/`rgt`/`depth`) dengan urutan tetap, TANPA bergantung sinyal `type`: (1) kolom DB fisik ada (`Schema::getColumnListing()`)? → (2) attribute/accessor ada (`hasAttributeMutator()`/`hasAttributeGetMutator()`/`hasGetMutator()`, API resmi Eloquent)? → (3) method relasi publik ada (`method_exists()` + visibility public + return `instanceof Relation`)? → kalau ketiganya gagal, **error**.
    - Diverifikasi: Asset versi test user (snake_case, tanpa `type`) → `asset_category`/`asset_location` terdeteksi error, TANPA false-positive dari `defaultConfigColumns` generik. Asset dikembalikan ke versi produksi benar (`assetCategory`/`assetLocation` camelCase + `type=>relation`) → lulus bersih.
    - **Dampak lintas codebase**: full `model:cache --strict` (semua model) setelah fix menemukan **14 violation GENUINE baru** (bukan false-positive, bukan spesifik Asset) di 10 model lain: `Log`, `Widget`, `PaymentSchedule`, `PurchaseInvoice`, `PurchaseInvoiceItem`, `SalesInvoice`, `SalesInvoiceItem`, `Ticket`, `ItemUnit`, `PurchaseReceipt` — semua di luar scope spec ini, **TIDAK diperbaiki di sini**. Task terpisah sudah di-spawn (`task_64b72e66`) untuk sesi lain menindaklanjuti.
    - Test regression `tests/Unit/Core/DataTableConfigValidatorTest.php` ditambah `RefreshDatabase` trait (validator butuh tabel fisik via `Schema::getColumnListing()`, PHPUnit default pakai SQLite `:memory:` per `phpunit.xml` — migration wajib jalan dulu). 5/5 test lulus.
    - Full test suite Asset domain final: **91 test PASS, 0 failure** (setelah Pint format).

- [x] 15. Final checkpoint - Ensure all tests pass (backend, Fase 1 sebelum FE+lang ditambahkan)
  - 44 tests, 106 assertions, 0 failures ✅
  - `canCancel()` + `canDelete()` = false (ERPNext parity)
  - Systemic `is_example` gap fixed via `HasExampleData` guard
  - Ensure all tests pass, ask the user if questions arise.

- [x] 21.2 Daftarkan menu Asset ke sidebar
  - `AppSidebar.jsx` belum punya entry Asset sama sekali (gap ditemukan user) — 3 halaman (`Assets`/`AssetCategories`/`AssetLocations`) hanya bisa diakses via URL langsung.
  - Ditambah grup "Assets" (icon `Boxes`, lucide-react) setelah "Inventories", berisi 3 item: Assets (`/assets`), Asset Categories (`/assetCategories`), Asset Locations (`/assetLocations`) — field `model` FQCN diisi utk permission-gate otomatis via `NavMain.jsx` (`checkPermission`), konsisten pola grup Inventories/Purchases.
  - Diverifikasi `php artisan route:list --path=asset` — URL sidebar match persis nama route (`assets.index`/`assetCategories.index`/`assetLocations.index`).

- [~] 22. Final checkpoint (FE + lang) — backend+lang teruji penuh, FE belum di-build/verifikasi visual
  - Backend (group 1-15), Lang (16-17), FE kode (18-20) semua selesai ditulis. **75 test PHP (Feature+Unit Asset domain) PASS, 0 failure** — verifikasi terakhir dijalankan setelah seluruh perubahan Controller (Show.jsx refactor) dan lang key format fix.
  - **BELUM DILAKUKAN** (di luar tool yang tersedia pada sesi pengerjaan ini — tidak ada akses jalankan `npm run build`/browser): kompilasi Vite, verifikasi visual browser bahwa AssetCategory/AssetLocation/Asset pages benar-benar render tanpa error React/Inertia runtime. Kode React ditulis mengikuti pola existing yang terbukti bekerja (Category, Warehouse, Account, PurchaseOrder) sepresisi mungkin, tapi TIDAK ADA jaminan zero-typo/zero-runtime-error tanpa build+browser check.
  - **Todo sebelum benar-benar dianggap selesai**: jalankan `npm run build` (atau `npm run dev` + buka browser), buka `/assetCategories`, `/assetLocations`, `/assets`, `/assets/create`, verifikasi tidak ada console error dan seluruh field ter-render.
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Setiap task mereferensikan requirement spesifik untuk traceability ke `requirements.md`.
- Checkpoint memastikan validasi inkremental — jangan lanjut ke group berikutnya jika checkpoint gagal.
- Field integrasi fase depan (`item_id`, `purchase_receipt_id`, `purchase_invoice_id`, `journal_entry_for_scrap_id`, kolom depresiasi, `enable_cwip_accounting`, `asset_type` value composite) disiapkan skema-nya di task 3 dan 8, TANPA logic aktif — jangan menambah business logic di luar scope Fase 1 meski field-nya sudah ada.
- `sell()` sengaja diimplementasikan sebagai placeholder (LogicException) pada Fase 1 — logic penuh (auto Sales Invoice, gain/loss on disposal) baru masuk Fase 4.
- Task 5.3, 6.3, 8.6 (factory) tidak py acceptance criteria spesifik karena bersifat pendukung testing, bukan requirement fungsional langsung.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["1.4"] },
    { "id": 2, "tasks": ["3.1", "3.2", "3.3"] },
    { "id": 3, "tasks": ["3.4"] },
    { "id": 4, "tasks": ["3.5"] },
    { "id": 5, "tasks": ["5.1", "5.2", "6.1"] },
    { "id": 6, "tasks": ["5.3", "6.2", "6.3"] },
    { "id": 7, "tasks": ["5.4", "5.5", "6.4", "6.5"] },
    { "id": 8, "tasks": ["8.1"] },
    { "id": 9, "tasks": ["8.2", "8.3", "8.4", "8.5"] },
    { "id": 10, "tasks": ["8.6"] },
    { "id": 11, "tasks": ["8.7", "8.8", "8.9", "8.10", "8.11"] },
    { "id": 12, "tasks": ["10.1"] },
    { "id": 13, "tasks": ["10.2", "10.3"] },
    { "id": 14, "tasks": ["10.4", "10.5"] },
    { "id": 15, "tasks": ["12.1", "12.2"] },
    { "id": 16, "tasks": ["12.3", "12.4"] },
    { "id": 17, "tasks": ["12.5"] },
    { "id": 18, "tasks": ["12.6"] },
    { "id": 19, "tasks": ["14.1"] },
    { "id": 20, "tasks": ["16.1", "16.2", "16.3", "16.4"] },
    { "id": 21, "tasks": ["16.5"] },
    { "id": 22, "tasks": ["18.1", "18.3"] },
    { "id": 23, "tasks": ["18.2", "18.4"] },
    { "id": 24, "tasks": ["18.5"] },
    { "id": 25, "tasks": ["20.1"] },
    { "id": 26, "tasks": ["20.2", "20.3", "20.4"] },
    { "id": 27, "tasks": ["20.5", "20.6"] },
    { "id": 28, "tasks": ["22"] }
  ]
}
```
