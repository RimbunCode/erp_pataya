# Implementation Plan: asset-service-internal-order

## Overview

Mirror arsitektur `asset-service-billing` (Spec 7a) ke `InternalOrder`, minus billing. `InternalOrderItem.referenceable` (kolom sudah ada, tidak perlu migration) menghubungkan baris InternalOrder ke `AssetService`/`AssetServiceConsumedItem`. Reuse penuh LinkModel Spec 7a. Termasuk 2 perbaikan kecil wajib di file Spec 7a (`DeliveryNoteService.php`, `SalesOrderRequest.php`) supaya validasi 1:1 dan skip-stok baris jasa benar-benar lintas SalesOrder+InternalOrder.

## Tasks

- [x] 1. Model & DeliveryNoteService
  - [x] 1.1 `app/Models/Sales/InternalOrderItem.php` — tambah relasi `referenceable(): MorphTo`
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 1.2 `app/Services/Inventory/DeliveryNoteService.php` — perluas kondisi skip-stok baris jasa (Spec 7a) jadi `($item->referenceable instanceof SalesOrderItem || $item->referenceable instanceof InternalOrderItem) && ...`
    - Import `InternalOrderItem` kalau belum ada di scope kondisi (sudah diimport di file untuk keperluan lain)
    - _Requirements: 3.1, 3.2_

  - [x] 1.3 Write unit tests for InternalOrderItem::referenceable()
    - **Test: relasi mengembalikan AssetService/AssetServiceConsumedItem sesuai referenceable_type**
    - **Test: referenceable null → behave seperti row biasa**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4**

- [x] 2. Checkpoint - Ensure Task 1 tests pass, regresi Spec 7a tetap hijau — 29/29 passed

- [x] 3. Validasi InternalOrderRequest & SalesOrderRequest simetris
  - [x] 3.1 `app/Http/Requests/Sales/InternalOrderRequest.php` — tambah rule `items.*.referenceable.type`/`items.*.referenceable.id`, ganti rule `distinct` string polos di `items.*.item.id` dengan closure custom (per-baris, skip kalau `referenceable` terisi — `Rule::when` tidak cocok karena butuh evaluasi per-baris bukan sekali di awal)
    - `withValidator()` cek status AssetService/AssetServiceConsumedItem APPROVED, cek 1:1 AssetServiceConsumedItem LINTAS SalesOrderItem+InternalOrderItem
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.2 `app/Http/Requests/Sales/SalesOrderRequest.php` (file Spec 7a) — perbaiki `validateAssetServiceReferenceables()` supaya cek 1:1 AssetServiceConsumedItem JUGA terhadap `InternalOrderItem` (sebelumnya cuma cek sesama SalesOrderItem)
    - _Requirements: 2.3 (simetri lintas Spec 7a)_

  - [x] 3.3 Write feature tests for validasi 1:1 lintas tabel (Correctness Property 2, 4)
    - **Property test: AssetServiceConsumedItem dipakai SalesOrderItem dulu → coba pakai InternalOrderItem → ditolak**
    - **Property test: AssetServiceConsumedItem dipakai InternalOrderItem dulu → coba pakai SalesOrderItem → ditolak**
    - **Property test: 2 InternalOrderItem referenceable ke AssetServiceConsumedItem BEDA tapi item_id SAMA → TIDAK ditolak rule distinct**
    - **Test: InternalOrderItem referenceable ke AssetService DRAFT → ValidationException**
    - **Bug ditemukan & diperbaiki saat menulis test**: helper test awal panggil `(new InternalOrderRequest)->rules()` pada instance KOSONG (bukan `$request` yang sudah terisi data) — closure custom rule capture `$this` yang salah (tanpa data), membuat validasi distinct-exception silently tidak pernah jalan. Fix: panggil `$request->rules()` pada instance yang SUDAH di-`create()` dengan data, baru bikin Validator dari situ.
    - **Validates: Requirements 2.1, 2.2, 2.3**

- [x] 4. Checkpoint - Ensure Task 3 tests pass — 5/5 passed

- [x] 5. Service layer & DeliveryNote part-line
  - [x] 5.1 `app/Services/Sales/InternalOrderService.php` — di `fillItemRelations()`, tambah cabang pengisian `referenceable_type`/`referenceable_id` dari payload FE JIKA ada (pola sama `SalesOrderService`)
    - _Requirements: 1.1, 1.5_

  - [x] 5.2 Verifikasi baris part InternalOrder (referenceable=AssetServiceConsumedItem) melewati jalur stock STANDARD `DeliveryNoteService::onApproved()` tanpa kode baru — dikonfirmasi via test
    - **BUG PRE-EXISTING DITEMUKAN & DIPERBAIKI (blocking, di luar scope tapi wajib)**: `InternalOrderService::updateInternalOrderStatus()` join `item_variants.id = items.item_variant_id` — kolom `item_variant_id` TIDAK PERNAH ADA di `internal_order_items` (FK sebenarnya `item_id`). Baru terekspos karena jalur `DeliveryNoteService::onApproved()` → event `DocumentDeliveryStatusRecalculationRequested` → method ini tidak pernah dites end-to-end sebelumnya. Fix: ganti `items.item_variant_id` → `internal_order_items.item_id`.
    - _Requirements: 3.3, 3.4_

  - [x] 5.3 Write feature tests for InternalOrder + DeliveryNote end-to-end
    - **Feature test: DN (referenceable_type=InternalOrder) approve baris part → stok berkurang via StockLedgerEntry standar**
    - **Feature test: DN approve baris jasa (referenceable=AssetService dari InternalOrderItem) → TIDAK ada StockLedgerEntry**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3**

- [x] 6. Checkpoint - Ensure Task 5 tests pass — 2/2 passed

- [x] 7. FE
  - [x] 7.1 `resources/js/Pages/Sales/InternalOrders/Form.jsx` — tambah kolom `referenceable` (reuse `AssetServiceLinkModel`/`AssetServiceConsumedItemLinkModel` dari Spec 7a, TIDAK bikin komponen baru)
    - Verifikasi kolom `item` existing TIDAK berubah untuk baris non-referenceable — `git diff --stat`: 45 insertions, 0 deletions
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 7.2 Lang: reuse key existing Spec 7a (`asset/service.php`, `sales/salesOrder.php`), tambah key baru `sales.internalOrder.columns.referenceable_asset_service` (en+id)
    - _Requirements: semua_

- [x] 8. Checkpoint - Ensure Task 7 tests pass, verifikasi npm build sukses — build sukses, ESLint clean (1 warning auto-fixed)

- [x] 9. Final checkpoint - Ensure all tests pass, no regression
  - **SEMUA TEST HIJAU, ZERO FAILURE** (dijalankan per slice kecil, hindari OOM batch besar — pelajaran dari sesi Spec 7a):
    - `tests/Unit/Sales` + `tests/Feature/Sales`: **47 passed**
    - `tests/Unit/Asset`: **136 passed**
    - `tests/Feature/Asset`: **95 passed** (termasuk regresi fix `PurchaseReceiptServiceFixedAssetDispatchTest` dari Spec 7a — masih hijau)
    - `tests/Unit/Listeners/Asset` + `tests/Unit/Finances`: **29 passed**
    - `tests/Feature/Inventory`: **26 passed** (termasuk 2 test baru `DeliveryNoteServiceInternalOrderAssetServiceTest`)
    - **Total: 333 test, 333 passed, 0 failed**
  - **1 regresi genuine ditemukan & DIPERBAIKI** saat menulis test end-to-end (Task 5.2): `InternalOrderService::updateInternalOrderStatus()` join ke kolom `items.item_variant_id` yang TIDAK PERNAH ADA (FK sebenarnya `item_id`) — bug pre-existing, di luar commit spec manapun, baru terekspos karena jalur `DocumentDeliveryStatusRecalculationRequested` tidak pernah dites end-to-end sebelumnya. Diperbaiki, bukan didiamkan.
  - Pint clean (`{"result":"pass"}`), ESLint clean (1 warning auto-fixed di FE), `npm run build` sukses
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tidak ada task optional (`[ ]*`) — seluruh scope requirements.md bersifat wajib.
- Reuse maksimal dari Spec 7a: LinkModel, lang key, pola validasi, pola service layer — JANGAN bikin ulang komponen yang sudah ada.
- Task 3.2 menyentuh file Spec 7a (`SalesOrderRequest.php`) — TERBATAS pada 1 kondisi tambahan di helper "already used", JANGAN ubah logic lain di file itu.
- "Tidak ada regresi" berarti BENAR-BENAR nol failure di seluruh scope yang dijalankan — kalau ditemukan failure pre-existing tidak terkait, tetap WAJIB diperbaiki (bukan didokumentasikan lalu dibiarkan), sesuai feedback Stop hook di sesi Spec 7a.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3"] },
    { "id": 2, "tasks": ["2"] },
    { "id": 3, "tasks": ["3.1", "3.2"] },
    { "id": 4, "tasks": ["3.3"] },
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
