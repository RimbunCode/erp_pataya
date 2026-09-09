# Implementation Plan: Asset Category Simplification

## Overview

Pindahkan `is_rentable`/`allow_bulk_quantity` dari `AssetCategory` ke `Asset` lewat 2 migration berurut (tambah kolom+copy data, baru drop kolom lama), lalu update semua read-path (`Asset::booted()`, `AssetRequest`, `DeliveryNoteRequest`/`Service`) yang selama ini baca dari `AssetCategory` — sekaligus memperbaiki field yang salah dibaca di `AssetRequest::validateRentableQuantity()` (baca `is_rentable`, seharusnya `allow_bulk_quantity`). Frontend: 2 checkbox pindah dari Form Kategori ke Form Asset. TIDAK ada perubahan pada `non_depreciable_category`/`enable_cwip_accounting` maupun mekanisme `LogicException→500` (dikonfirmasi user, di luar scope — lihat catatan di `design.md`).

## Tasks

- [x] 1. Backend: Migration skema
  - [x] 1.1 Buat migration tambah `is_rentable`/`allow_bulk_quantity` ke `assets` + copy data dari `AssetCategory` induk (inline di `up()`, per-kategori via `DB::table()->each()` — portable MySQL/SQLite)
    - _Requirements: 1.1, 1.2_
  - [x] 1.2 Buat migration drop `is_rentable`/`allow_bulk_quantity` dari `asset_categories` (timestamp SETELAH migration 1.1)
    - _Requirements: 1.3_
  - [x] 1.3 Write feature test verifikasi skema: kolom baru ADA di `assets`, TIDAK ADA di `asset_categories` (`Schema::hasColumn()`), default `false` untuk Asset baru
    - **Validates: Requirements 1.1, 1.3** — 3/3 pass (`tests/Feature/Asset/AssetCategorySimplificationMigrationTest.php`)

- [x] 2. Checkpoint - Ensure migration tests pass
  - Pass.

- [x] 3. Backend: Factory
  - [x] 3.1 `AssetCategoryFactory` — hapus `is_rentable` dari `definition()`, hapus method `rentable()` dan `bulkQuantity()`
    - _Requirements: 6.1_
  - [x] 3.2 `AssetFactory` — tambah `is_rentable`/`allow_bulk_quantity` (default `false`) ke `definition()`, tambah state `rentable()` dan `bulkQuantity()`
    - _Requirements: 6.2_

- [x] 4. Backend: Model & Request — pindah sumber validasi
  - [x] 4.1 `AssetCategory.php` — hapus `is_rentable`/`allow_bulk_quantity` dari `$casts` dan entry `is_rentable` dari `$configColumns`
    - _Requirements: 3.2_
  - [x] 4.2 `Asset.php` — tambah `is_rentable`/`allow_bulk_quantity` ke `$casts`; `booted()` saving hook baca `$asset->allow_bulk_quantity` langsung (bukan query `AssetCategory`)
    - _Requirements: 2.1_
  - [x] 4.3 `AssetCategoryRequest.php` — hapus rules `is_rentable`, `allow_bulk_quantity`
    - _Requirements: 3.2_
  - [x] 4.4 `AssetRequest.php` — tambah rules `is_rentable`, `allow_bulk_quantity`; `validateRentableQuantity()` baca `allow_bulk_quantity` dari input/route Asset (bukan `is_rentable` dari `AssetCategory` — perbaikan field yang salah sekaligus sumbernya)
    - _Requirements: 2.2, 4.2, 4.3_
    - **Deviasi dari design.md (gap ditemukan saat implementasi)**: `AssetService::createInTransaction()`/`update()` pakai whitelist `Arr::only()` yang belum memasukkan `is_rentable`/`allow_bulk_quantity` — field lolos validasi tapi TIDAK PERNAH tersimpan ke Asset (checkbox Form.jsx jadi tidak berefek). Ditambahkan ke kedua whitelist di `AssetService.php` sebagai bagian task ini.
  - [x] 4.5 Write unit test `Asset::booted()` guard baru (pakai `Asset::factory()->allow_bulk_quantity`, bukan `AssetCategory::factory()`)
    - **Validates: Requirements 2.1** — 23/23 pass (`tests/Unit/Asset/AssetTest.php`, "Property 2" ditulis ulang: 4 test lama jadi 3, redundan setelah 2 field digabung jadi 1)
  - [x] 4.6 Write feature test `AssetRequest::validateRentableQuantity()` — reject saat `allow_bulk_quantity=false` & `asset_quantity>1`, terima saat `true`, independen dari kategori
    - **Validates: Requirements 2.2, 4.2, 4.3** — 14/14 pass (`tests/Feature/Asset/AssetControllerTest.php`, sekaligus audit Task 10.2 untuk file ini: 3 pemakaian `AssetCategory::factory()->create(['allow_bulk_quantity'=>...])` lama diperbaiki jadi payload request)

- [x] 5. Checkpoint - Ensure model & request tests pass
  - Pass — `AssetTest.php` 23/23, `AssetControllerTest.php` 14/14.

- [x] 6. Backend: Gatekeeper rental `DeliveryNote` + lang
  - [x] 6.1 `DeliveryNoteRequest.php` (baris ~103) — ganti `$asset->assetCategory?->is_rentable` jadi `$asset->is_rentable`
    - _Requirements: 5.1_
  - [x] 6.2 `DeliveryNoteService.php` (baris ~431) — ganti `$asset->assetCategory?->is_rentable` jadi `$asset->is_rentable`
    - _Requirements: 5.2_
  - [x] 6.3 Rename lang key `category_not_rentable`→`asset_not_rentable` (id+en asset.php), sesuaikan teks; sesuaikan teks `rentable_must_be_single_unit` (hilangkan kata "kategori", key TIDAK berubah)
    - _Requirements: 5.3_
  - [x] 6.4 Update `tests/Feature/Inventory/DeliveryNoteRequestAssetLinesTest.php` dan `DeliveryNoteServiceAssetBranchTest.php` — ganti `AssetCategory::factory()->create(['is_rentable' => ...])` jadi `Asset::factory()->create(['is_rentable' => ...])`; update assertion key lang ke `asset_not_rentable`
    - **Validates: Requirements 5.1, 5.2, 5.3** — 5/5 + 3/3 pass. Method test yang bicara soal "category" di-rename jadi soal Asset langsung (`rejects_asset_that_is_not_rentable`, `dn_approve_rejects_asset_that_is_not_rentable`)

- [x] 7. Checkpoint - Ensure DeliveryNote gatekeeper tests pass
  - Pass.

- [x] 8. Frontend: Form Kategori & Form Asset
  - [x] 8.1 `resources/js/Pages/Asset/Categories/Form.jsx` — hapus 2 `FormCheckbox` (`is_rentable`, `allow_bulk_quantity`)
    - _Requirements: 3.1_
  - [x] 8.2 `resources/js/Pages/Asset/Categories/Index.jsx` — hapus blok kondisional badge `is_rentable`
    - _Requirements: 3.1_
  - [x] 8.3 `resources/js/Pages/Asset/Assets/Form.jsx` — tambah 2 `FormCheckbox` baru (section Identity, setelah `custodian`), independen dari `asset_category`
    - _Requirements: 4.1, 4.3_
  - [x] 8.4 Lang columns — pindah `is_rentable`/`allow_bulk_quantity` dari `lang/*/asset/category.php` ke `lang/*/asset/asset.php`
    - _Requirements: 3.1, 4.1_
  - [x] 8.5 Update `Categories/Form.rtl.test.jsx` (hapus test 2 checkbox) dan `Categories/Index.rtl.test.jsx` (hapus assertion badge)
    - **Validates: Requirements 3.1** — 5/5 pass
  - [x] 8.6 Tambah test baru di `Assets/Form.rtl.test.jsx` — 2 checkbox baru render & togglable tanpa `asset_category` dipilih
    - **Validates: Requirements 4.1, 4.3** — 39/39 pass (37 lama + 2 baru; 2 test lama `calculate_depreciation` diperbaiki index-nya karena checkbox baru geser urutan DOM)

- [x] 9. Checkpoint - Ensure frontend tests pass
  - Pass — Categories Form+Index 5/5, Assets Form 39/39.

- [x] 10. Backend: Audit test existing yang terpengaruh
  - [x] 10.1 `tests/Unit/Asset/AssetTest.php`, `tests/Unit/Asset/AssetCategoryTest.php` — audit & update assertion field yang pindah
    - _Requirements: 6.3_ — `AssetTest.php` sudah diperbaiki di Task 4.5 (23/23 pass); `AssetCategoryTest.php` ada 1 assertion `is_rentable` tersisa (terlewat saat audit awal), diperbaiki sekarang — 6/6 pass
  - [x] 10.2 `tests/Feature/Asset/AssetControllerTest.php` — audit semua `AssetCategory::factory()->create(['is_rentable'=>..., 'allow_bulk_quantity'=>...])`, pindah ke `Asset::factory()`
    - _Requirements: 6.3_ — sudah diperbaiki di Task 4.6 (14/14 pass)
  - [x] 10.3 `tests/Feature/Asset/AssetCategoryControllerTest.php` — hapus/update test yang menguji 2 field ini via `AssetCategoryRequest`
    - _Requirements: 6.3_ — `test_store_creates_asset_category` kirim `is_rentable` di payload & assert di DB, dihapus keduanya. 3/3 pass
  - **Validates: Requirements 6.1, 6.2, 6.3, 6.4**

- [x] 11. Final checkpoint - Ensure all tests pass (BE + FE)
  - Test spec-specific: 57/57 PHP (7 file gabungan) + 44/44 FE — semua pass.
  - Full suite BE per-batch (final, semua hijau): Unit 577+2 skipped, Asset+Purchase+Finances 141, Inventory 40, Sales+CRM 42, Helpdesk+Services 101, Core Approval+Notification 23, Core PrintTemplate 22, Core root (split 2x31 file krn OOM) 242+234=476 (1 fail DashboardWidgetWidthMigrationTest — FIXED, --step basi krn migration baru), domain kecil (Api/Auth/Http/Migration/Models/Rules/Traits/User) 126. **Total BE: 1568 passed + 2 skipped, 0 failed.**
  - **4 bug ditemukan & diperbaiki selama full-suite run** (di luar 17 file task asli, semua terkait pemindahan field):
    1. `AssetServiceSplitTest.php` (6 test) — `AssetCategory::factory()->bulkQuantity()` (method dihapus).
    2. `AssetQuantityTest.php` (4 test) + `AssetCompleteDataControllerTest.php` (2 test) — sama.
    3. `CreateAssetFromPurchaseListenerTest.php` (3 test) + `DeliveryNoteRequestAssetLinesTest.php`/`DeliveryNoteServiceAssetBranchTest.php`/`DeliveryNoteAssetLinesPersistenceTest.php` — pola sama TAPI akar masalah beda: `CreateAssetFromPurchase` listener (jalur otomatis) tidak set `allow_bulk_quantity`, padahal dulu implicit-bypass via kategori null. **Fix production code**: listener set `allow_bulk_quantity: true` (Asset otomatis = batch belum di-split, `AssetService::split()` JUGA lupa copy 2 field baru ke row hasil split — sudah ditambahkan).
    4. `DashboardWidgetWidthMigrationTest.php` — `--step` rollback hardcoded basi karena 2 migration baru spec ini nambah ke hitungan; diupdate 13->15.
  - **Bug ditemukan, TIDAK diperbaiki (di luar scope, sudah dikonfirmasi tidak disebabkan spec ini)**: FE `PurchaseReceiptItemLinkModel.rtl.test.jsx`/`PurchaseInvoiceItemLinkModel.rtl.test.jsx` — 7 sub-test gagal "No QueryClient set", root cause commit `99503b1 feat(linkmodel): migrasi fetch LinkModel ke TanStack Query` (tidak terkait AssetCategory), gagal bahkan terisolasi tanpa spec ini disentuh.
  - FE full (`vitest run`, dijalankan 3x untuk konfirmasi konsisten): 4896/4903 pass — 7 gagal SELALU sama (`PurchaseReceiptItemLinkModel.rtl.test.jsx`/`PurchaseInvoiceItemLinkModel.rtl.test.jsx`, "No QueryClient set"), dikonfirmasi bug pre-existing tidak terkait spec ini (lihat di atas).
  - Re-run final setelah semua fix: `tests/Unit` 577 passed + 2 skipped (turun 1 dari baseline 578, karena 4 test lama dikonsolidasi jadi 3 di `AssetTest.php` — disengaja); `Feature/Asset+Purchase+Finances` 141 passed, 0 failed.
  - Pint (`--dirty`): pass. ESLint (6 file JSX berubah): 0 error, 4 warning jsdoc pre-existing di `Form.rtl.test.jsx` (bukan dari perubahan saya, tidak disentuh).

## Notes

- Task 3 (Factory) sengaja didahulukan sebelum Task 4/6/10 — banyak task test butuh state `Asset::factory()->rentable()`/`bulkQuantity()` yang baru dibuat di sini.
- `non_depreciable_category`, `enable_cwip_accounting`, default setting depresiasi — TIDAK disentuh task manapun.
- Mekanisme `LogicException→HTTP 500` di `Asset::booted()` dan `DeliveryNoteService` — dikonfirmasi user TETAP di luar scope spec ini (lihat `design.md`), TIDAK ada task untuk itu.
- Task 1.1 wajib selesai (migrasi jalan) sebelum Task 3.2 (`AssetFactory` set kolom baru) — kolom harus ada dulu di skema.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3"] },
    { "id": 2, "tasks": ["3.1", "3.2"] },
    { "id": 3, "tasks": ["4.1", "4.2", "4.3", "4.4", "6.1", "6.2", "6.3", "8.1", "8.2", "8.3", "8.4"] },
    { "id": 4, "tasks": ["4.5", "4.6", "6.4", "8.5", "8.6", "10.1", "10.2", "10.3"] },
    { "id": 5, "tasks": ["11"] }
  ]
}
```
