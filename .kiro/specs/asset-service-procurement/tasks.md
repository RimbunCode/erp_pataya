# Implementation Plan: asset-service-procurement

## Overview

Replikasi mekanisme `$ref`-based switch existing (WorkOrder → PR/PO) ke AssetService, tambah 2 case baru di `PurchaseRequestController`/`PurchaseOrderController`, 2 tombol gated permission di Show AssetService. Prasyarat: `AssetServiceConsumedItem` dapat kolom `item_unit_id` (migration + model + service + FE). Case PO `assetService` SENGAJA filter `is_stock_item` (beda dari `case 'workOrder':` existing di controller yang sama, yang tidak filter) — bukan bug, keputusan eksplisit di design.

## Tasks

- [x] 1. Migration & Model — `item_unit_id`
  - [x] 1.1 `database/migrations/2026_08_17_114446_add_item_unit_id_to_asset_service_consumed_items_table.php` — tambah kolom nullable, backfill dari `Item::defaultUom()` logic (`item_units.unit_id = items.default_unit_id`), lalu ubah jadi NOT NULL
    - _Requirements: 1.1, 1.2_

  - [x] 1.2 `app/Models/Asset/AssetServiceConsumedItem.php` — tambah relasi `itemUnit(): BelongsTo` ke `ItemUnit`
    - _Requirements: 1.3_

  - [x] 1.3 Write unit tests for migration backfill logic & `itemUnit()` relation
    - **Test: query backfill (item_units.unit_id = items.default_unit_id) resolve ke ItemUnit yang benar**
    - **Test: query backfill resolve null kalau item tidak punya default_unit_id**
    - **Test: `itemUnit()` relation mengembalikan ItemUnit sesuai item_unit_id**
    - **Test: factory `AssetServiceConsumedItem` otomatis isi item_unit_id valid**
    - Catatan: test "migration fail-fast kalau NOT NULL dilanggar" di-skip — itu constraint level DB (SQLite/MySQL), bukan logic aplikasi yang perlu diverifikasi manual
    - **Validates: Requirements 1.1, 1.2, 1.3**

- [x] 2. Checkpoint - Ensure Task 1 tests pass — 7/7 passed (`tests/Unit/AssetServiceConsumedItemUnitTest.php` + existing `AssetServiceConsumedItemTest.php`), regresi `tests/Unit/Asset` 136/136 passed

- [x] 3. Service layer & FE — kolom unit di form AssetService
  - [x] 3.1 `app/Services/Asset/AssetServiceService.php::syncConsumedItems()` — isi `item_unit_id` dari payload FE (`item.unit.id`). Bonus fix: `item_id` juga sebelumnya salah baca dari `item_id` flat (FE kirim nested `item.id`) — diperbaiki sekalian, pola sama `QuotationService.php` existing
    - `app/Http/Requests/Asset/AssetServiceRequest.php` — rule diperbaiki dari `consumedItems.*.item_id` (salah, FE tidak pernah kirim ini) ke `consumedItems.*.item.id` + `consumedItems.*.unit.id`
    - _Requirements: 1.5_

  - [x] 3.2 `resources/js/Pages/Asset/Services/Form.jsx` — tambah kolom `unit` di `consumedItemColumns` (pola `ItemUnitLinkModel` sama `InternalOrders/Form.jsx`), auto-isi default UOM saat item dipilih
    - _Requirements: 1.4_

  - [x] 3.3 Lang: `lang/id/asset/service.php` + `lang/en/asset/service.php` — tambah key `columns.unit`
    - _Requirements: 1.4_

  - [x] 3.4 Write feature tests for AssetServiceConsumedItem create/update dengan item_unit_id
    - **Test: create AssetService dengan consumedItem + unit → item_unit_id tersimpan benar** (unit + feature test)
    - **Test: update consumedItem existing → item_unit_id ikut terupdate**
    - **Test: store() via controller menolak payload consumedItem tanpa unit** (validasi request)
    - **Validates: Requirements 1.4, 1.5**

- [x] 4. Checkpoint - Ensure Task 3 tests pass, regresi Spec 5/7a/7b tetap hijau — `tests/Unit/AssetServiceServiceConsumedItemUnitTest.php` + `tests/Feature/AssetServiceStoreConsumedItemPayloadTest.php` 4/4 passed; `tests/Unit/Asset` 136/136 tetap hijau

- [x] 5. Backend — case `assetService` di PurchaseRequestController & PurchaseOrderController
  - [x] 5.1 `app/Http/Controllers/Purchase/PurchaseRequestController.php` — tambah `case 'assetService':` di `create()`, import `AssetService`/`AssetServiceConsumedItem`, filter `is_stock_item`, map ke shape item PR (quantity, unit, referenceable)
    - Bonus: `app/Models/Asset/AssetService.php::loadRelationsOnShow()` tambah eager-load `consumedItems.itemUnit` (cegah N+1 saat mapping)
    - _Requirements: 2.3, 2.4, 2.5_

  - [x] 5.2 `app/Http/Controllers/Purchase/PurchaseOrderController.php` — tambah `case 'assetService':` di `create()`, import sama, filter `is_stock_item` (SENGAJA beda dari case workOrder existing di file ini), map ke shape item PO
    - Bug ditemukan & diperbaiki saat menulis test: `...$item` (spread Eloquent model) invalid PHP — harus `...$item->toArray()`; sama seperti case `workOrder` existing di file ini (TIDAK diperbaiki, di luar scope/legacy WorkOrder akan dihapus)
    - _Requirements: 3.3_

  - [x] 5.3 Write feature tests for kedua case baru
    - **Test: PurchaseRequestController::create ref=assetService/{id} → defaultData.items sesuai consumedItems, non-stock item terfilter**
    - **Test: PurchaseOrderController::create ref=assetService/{id} → defaultData.items sesuai consumedItems, non-stock item terfilter (assert BEDA dari case workOrder yang tidak filter)**
    - **Test: ref=assetService/{invalid-id} → defaultData null, tidak error, di kedua controller**
    - **Test: referenceable_type/referenceable_id baris hasil = AssetServiceConsumedItem::class + id baris consumed item (bukan id AssetService)**
    - **Validates: Requirements 2.3, 2.4, 2.5, 3.3, 4.2**

- [x] 6. Checkpoint - Ensure Task 5 tests pass — 6/6 passed; `tests/Feature/Purchase` + `tests/Unit/Purchase` 28/28 tetap hijau

- [x] 7. FE — tombol di Show AssetService
  - [x] 7.1 `resources/js/Pages/Asset/Services/Show.jsx` — tambah `controls` prop dengan 2 tombol (PR, PO), gated `canGlobal("App\\Models\\Purchase\\PurchaseRequest", "create")` / `canGlobal("App\\Models\\Purchase\\PurchaseOrder", "create")`, tampil hanya jika `assetService?.submitted_at`, TIDAK ada guard "sudah pernah dibuat" (boleh berkali-kali)
    - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.4, 4.1_

  - [x] 7.2 Lang: `lang/id/asset/service.php` + `lang/en/asset/service.php` — tambah key `actions.create_pr`, `actions.create_po`
    - _Requirements: 2.1, 3.1_

- [x] 8. Checkpoint - Ensure Task 7 tests pass (jika ada FE test), verifikasi npm build sukses, ESLint clean — `npm run build` sukses, ESLint clean (0 issues) untuk seluruh `resources/js/Pages/Asset/Services`

- [x] 9. Final checkpoint - Ensure all tests pass, no regression
  - Dijalankan per slice kecil (hindari OOM batch besar — pelajaran dari sesi sebelumnya):
    - `tests/Feature/Purchase` + `tests/Unit/Purchase` + 2 test baru: **34 passed**
    - `tests/Feature/Asset`: **95 passed**
    - `tests/Unit/Sales` + `tests/Feature/Sales` (regresi 7a/7b): **47 passed**
    - `tests/Feature/Inventory`: **26 passed**
    - `tests/Unit/Asset`: **136 passed** (dijalankan 2x di checkpoint berbeda, konsisten)
    - **Total: 338 test, 338 passed, 0 failed** (di luar slice yang sudah dijalankan sebelumnya di checkpoint 2/4/6)
  - Pint (`--dirty --format agent`) clean — semua file yang diubah sudah diformat
  - ESLint clean, `npm run build` sukses
  - Tidak ada regresi ditemukan yang perlu diperbaiki di luar scope spec ini

## Notes

- Tidak ada task optional (`[ ]*`) — seluruh scope requirements.md bersifat wajib, semua selesai.
- Task 5.2 (PO case filter `is_stock_item`) SENGAJA beda dari pola `case 'workOrder':` existing di `PurchaseOrderController.php` — sesuai keputusan eksplisit user di sesi brainstorming.
- Task 1.1 migration backfill pakai raw query builder (bukan Eloquent `Item::defaultUom()`) karena migration tidak boleh bergantung pada model app yang bisa berubah — logic-nya direplikasi manual, sudah diverifikasi terhadap `app/Models/Inventory/Item.php:90`.
- 2 gap pre-existing ditemukan & diperbaiki (dalam scope kerja langsung, bukan audit terpisah): (1) `AssetServiceRequest` validasi `item_id` flat yang tidak pernah cocok dengan payload FE nested `item.id` — genuine bug, form AssetService dengan consumedItems kemungkinan selalu gagal validasi sebelum fix ini; (2) `PurchaseOrderController` case `assetService` (kode baru) awalnya salah pakai `...$item` (spread Eloquent model, bukan array) — diperbaiki jadi `...$item->toArray()`. Bug serupa di case `workOrder` existing TIDAK disentuh (di luar scope, WorkOrder akan dihapus).
- Setelah spec ini selesai: AssetService mencapai parity penuh dengan WorkOrder (billing + InternalOrder + Procurement). Penghapusan WorkOrder BUKAN task di spec ini — perlu spec/task terpisah.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3"] },
    { "id": 2, "tasks": ["2"] },
    { "id": 3, "tasks": ["3.1", "3.2", "3.3"] },
    { "id": 4, "tasks": ["3.4"] },
    { "id": 5, "tasks": ["4"] },
    { "id": 6, "tasks": ["5.1", "5.2"] },
    { "id": 7, "tasks": ["5.3"] },
    { "id": 8, "tasks": ["6"] },
    { "id": 9, "tasks": ["7.1", "7.2"] },
    { "id": 10, "tasks": ["8"] },
    { "id": 11, "tasks": ["9"] }
  ]
}
```
