# Implementation Plan: asset-service-billing

## Overview

Bagian A memperluas `AssetMovement`/`AssetMovementItem` (Spec 4) untuk mencakup rental/sale (menutup gap Spec 6) — dibuat otomatis bypass-approval di listener Spec 6 yang sudah ada, tanpa mengubah logic `rental_quantity`/`sold_quantity` existing. Bagian B menghubungkan `AssetService` ke billing customer lewat `SalesOrderItem.referenceable` generik baru, menagih jasa+part lewat SalesOrder→DeliveryNote→SalesInvoice. `SalesOrder`/`SalesOrderItem` untuk kasus ItemVariant biasa (referenceable=null) TIDAK berubah perilakunya sama sekali.

## Tasks

- [x] 1. Bagian A — Migration & Enum
  - [x] 1.1 Migration `add_customer_columns_to_asset_movement_items_table`
    - Kolom: `quantity` (decimal 15,4, default 1), `customer_id` (FK nullable → customers), `customer_branch_id` (FK nullable → branches)
    - _Requirements: 1.2, 1.3_

  - [x] 1.2 Tambah case `RENT_OUT`, `RETURN_FROM_RENT`, `SELL` ke `app/Enums/AssetMovementPurpose.php`
    - _Requirements: 1.1_

  - [x] 1.3 Checkpoint - Ensure migration jalan clean di test environment (SQLite)

- [x] 2. Bagian A — Model & Service
  - [x] 2.1 `app/Models/Asset/AssetMovementItem.php` — tambah cast `quantity`, relasi `customer()`, `customerBranch()`
    - _Requirements: 1.2_

  - [x] 2.2 `app/Models/Asset/Asset.php` — tambah relasi `assetMovementItems(): HasMany`, method `activeRenter(): ?AssetMovementItem`
    - Cari `AssetMovementItem` purpose RENT_OUT terbaru TANPA pasangan RETURN_FROM_RENT sesudahnya — urutan pakai `id` (ULID sortable), BUKAN `created_at` (presisi detik, bisa tie)
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 2.3 `app/Services/Asset/AssetMovementService.php` — tambah method `createFromRentalSale(DeliveryNoteItemAsset $line, AssetMovementPurpose $purpose): AssetMovement`
    - Status langsung `[FormStatus::APPROVED]`, `reference_type=DeliveryNote::class`, `reference_id` dari `$line->deliveryNoteItem->delivery_note_id`
    - `customer_id`/`customer_branch_id` diambil LANGSUNG dari `DeliveryNote.customer_id`/`customer_branch_id` (bukan reverse via referenceable SalesOrder — DeliveryNote sudah punya kolom sendiri)
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 2.4 Write unit tests for Asset::activeRenter() (Correctness Property 1, 2, 3)
    - **Property test: Asset tanpa AssetMovementItem RENT_OUT apapun → null**
    - **Property test: urutan [RENT_OUT, RETURN_FROM_RENT] → null**
    - **Property test: urutan [RENT_OUT, RETURN_FROM_RENT, RENT_OUT] → return yang kedua (terbaru)**
    - **Validates: Requirements 3.1, 3.2, 3.3**

  - [x] 2.5 Write unit tests for AssetMovementService::createFromRentalSale() (Correctness Property 4)
    - **Property test: AssetMovement dibuat dengan status [APPROVED] langsung, tidak pernah DRAFT**
    - **Test: reference_type/reference_id terisi benar ke DeliveryNote asal**
    - **Test: customer_id/customer_branch_id terisi dari DeliveryNote terkait**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4**

- [x] 3. Checkpoint - Ensure Task 1-2 tests pass — 7/7 passed

- [x] 4. Bagian A — Integrasi listener Spec 6
  - [x] 4.1 `app/Listeners/Asset/Rental/SetAssetInRent.php` — inject `AssetMovementService`, tambah 1 baris panggil `createFromRentalSale($line, AssetMovementPurpose::RENT_OUT)` SETELAH `addRentedQuantity()`, SEBELUM update `processed_at`
    - JANGAN ubah logic `addRentedQuantity()`/guard `processed_at` existing
    - _Requirements: 2.5, 2.6_

  - [x] 4.2 `app/Listeners/Asset/Rental/ReturnAssetFromRent.php` — pola sama, purpose `RETURN_FROM_RENT`
    - _Requirements: 2.5, 2.6_

  - [x] 4.3 `app/Listeners/Asset/Rental/MarkAssetSoldFromDelivery.php` — pola sama, purpose `SELL`
    - _Requirements: 2.5, 2.6_

  - [x] 4.4 Write feature tests for listener + AssetMovement integration
    - **Test: DN rental approve → AssetMovement purpose RENT_OUT tercipta, quantity match, customer match SO**
    - **Test: DN retur approve → AssetMovement purpose RETURN_FROM_RENT tercipta**
    - **Test: DN sell approve → AssetMovement purpose SELL tercipta**
    - **Test: idempotent — line sudah processed_at, tidak dobel AssetMovement kalau listener dipanggil 2x**
    - **Regression: assertion existing test Spec 6 (rental_quantity/sold_quantity/status Asset) TIDAK berubah**
    - **Validates: Requirements 2.5, 2.6**

- [x] 5. Checkpoint - Ensure Task 4 tests pass, regresi Spec 6 tetap hijau — 14/14 passed

- [ ] 6. Bagian B — Migration
  - [x] 6.1 ~~Migration `add_referenceable_to_sales_order_items_table`~~ — TIDAK PERLU: tabel `sales_order_items` SUDAH punya `referenceable_type`/`referenceable_id` (`nullableUlidMorphs('referenceable')`, migration `2025_08_09_095403`) sejak awal, cuma model `SalesOrderItem` belum punya relasi `referenceable()`. Migration baru dihapus, cukup tambah relasi di Task 7.1.
    - _Requirements: 4.1_

  - [x] 6.2 Migration `add_ownership_customer_branch_id_to_assets_table`
    - Kolom: `ownership_customer_branch_id` (FK nullable → branches)
    - _Requirements: 7.3_

  - [x] 6.3 Migration `add_bill_to_renter_columns_to_asset_services_table`
    - Kolom: `bill_to_renter` (boolean default false), `customer_id` (FK nullable → customers), `customer_branch_id` (FK nullable → branches)
    - _Requirements: 6.1, 6.3_

  - [x] 6.4 Checkpoint - Ensure migration jalan clean — verified

- [x] 7. Bagian B — Model
  - [x] 7.1 `app/Models/Sales/SalesOrderItem.php` — tambah relasi `referenceable(): MorphTo`
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 7.2 `app/Models/Asset/Asset.php` — tambah relasi `ownershipCustomerBranch(): BelongsTo`
    - _Requirements: 7.3_

  - [x] 7.3 `app/Models/Asset/AssetService.php` — tambah cast `bill_to_renter` boolean, relasi `customer()`, `customerBranch()`, method `billToRenter(): void`
    - `billToRenter()` throw `LogicException` (`asset/service.not_currently_rented`) kalau `resolvedAsset()->activeRenter()` null
    - JANGAN tambah relasi apapun ke SalesOrder/SalesOrderItem/SalesInvoice/DeliveryNote (Requirement 10.1)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 10.1, 10.2_

  - [x] 7.4 Write unit tests for AssetService::billToRenter() (Correctness Property 7)
    - **Test: throw LogicException kalau Asset tidak sedang disewa**
    - **Test: sukses set bill_to_renter=true + snapshot customer_id/customer_branch_id dari activeRenter()**
    - **Property test: setelah di-set, customer_id/customer_branch_id TIDAK berubah lagi walau activeRenter() Asset berubah kemudian (mis. diretur, disewa lain)**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4**

- [x] 8. Checkpoint - Ensure Task 7 tests pass — 3/3 passed

- [x] 9. Bagian B — Validasi SalesOrderItem referenceable
  - [x] 9.1 `app/Http/Requests/Sales/SalesOrderRequest.php` — tambah rule `items.*.referenceable.type`/`items.*.referenceable.id`, `withValidator()` custom: cek status AssetService/AssetServiceConsumedItem terkait mengandung APPROVED, cek AssetServiceConsumedItem belum dipakai SalesOrderItem lain (non-soft-deleted)
    - Lang key ternyata `sales/salesOrder.php` (bukan `sales/order.php` seperti draft awal design.md)
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 9.2 `app/Services/Sales/SalesOrderService.php` — di `fillItemRelations()`, tambah pengisian `referenceable_type`/`referenceable_id` dari payload FE JIKA ada (cabang baru, TIDAK ubah logic ItemVariant existing)
    - _Requirements: 4.1, 4.4_

  - [x] 9.3 Write feature tests for SalesOrderRequest validasi (Correctness Property 5, 6, 8)
    - **Property test: SalesOrderItem referenceable ke AssetService DRAFT → ValidationException**
    - **Property test: SalesOrderItem referenceable ke AssetServiceConsumedItem yang sudah dipakai baris lain → ValidationException**
    - **Property test: SalesOrderItem referenceable=null → perilaku identik SalesOrderItem sebelum spec ini (regresi nol)**
    - **Validates: Requirements 5.1, 5.2, 5.3, 4.4**

- [x] 10. Checkpoint - Ensure Task 9 tests pass — 5/5 passed

- [x] 11. Bagian B — DeliveryNote & SalesInvoice untuk baris part/jasa
  - [x] 11.1 `app/Http/Requests/Inventory/DeliveryNoteRequest.php` — tambah `withValidator()`: validasi `DeliveryNoteItem.quantity` tidak melebihi `AssetServiceConsumedItem.quantity` (via chain `referenceable` SalesOrderItem → `referenceable` AssetServiceConsumedItem)
    - _Requirements: 8.1_

  - [x] 11.2 Baris part AssetService melewati jalur stock STANDARD `DeliveryNoteService::onApproved()` (BUKAN cabang `is_fixed_asset` Spec 6) — dikonfirmasi via test, TIDAK perlu kode baru untuk kasus ini
    - _Requirements: 8.2, 8.3_

  - [x] 11.3 **GAP DITEMUKAN & DIPERBAIKI**: Requirement 8.4 (baris jasa TIDAK PERNAH sentuh stok) ternyata BUTUH kode baru — tanpa itu baris jasa (ItemVariant biasa) akan lewat jalur stock standard seperti barang normal. Tambah branch baru di `DeliveryNoteService::onApproved()` (setelah cabang `is_fixed_asset`): skip stok total kalau `$item->referenceable->referenceable_type === AssetService::class`, hanya increment `delivered_quantity`
    - _Requirements: 8.4_

  - [x] 11.3b **BUG PRE-EXISTING DITEMUKAN & DIPERBAIKI (di luar scope tapi blocking)**: ke-3 `StockLedgerEntry::create()` di `DeliveryNoteService::onApproved()` (jalur standard) tidak pernah mengisi `transaction_date` (kolom NOT NULL) — baru terekspos karena baris ini sebelumnya tidak pernah ditest end-to-end. Ditambahkan `'transaction_date' => $deliveryNote->delivery_date` ke ke-3 call.
    - _Requirements: di luar spec ini, fix blocking_

  - [x] 11.4 Write feature tests for DeliveryNote & SalesInvoice baris AssetService
    - **Feature test: DN approve baris part AssetService → stok berkurang via StockLedgerEntry standar**
    - **Feature test: DN approve baris part quantity melebihi AssetServiceConsumedItem.quantity → ditolak**
    - **Feature test: baris jasa (referenceable=AssetService) di DN TIDAK memicu StockLedgerEntry apapun**
    - **Test: SalesOrderItem referenceable (jasa/part) tidak mengubah field billing existing (price/quantity/referenceable resolve benar)**
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 9.1, 9.2, 9.3**

- [x] 12. Checkpoint - Ensure Task 11 tests pass — 7/7 passed (2+2+3 across 3 file)

- [x] 13. Bagian B — Resolusi customer SalesOrder
  - [x] 13.1 Resolusi customer adalah PREFILL FE (bukan validasi backend wajib — dikonfirmasi Requirement 7.4 "tetap mengizinkan SO dibuat manual"), prioritas: `bill_to_renter` → `AssetService.customer_id`/`customer_branch_id`, else `ownership_type=customer` → `Asset.ownershipCustomer`/`ownershipCustomerBranch`, else user pilih manual. Backend TIDAK perlu kode baru — semua data sumber (Task 7, 2) sudah tersedia utk dibaca FE (Task 15).
    - _Requirements: 7.1, 7.2, 7.4_

  - [x] 13.2 Write unit tests for resolusi customer (memverifikasi DATA sumber tersedia benar, bukan logic FE)
    - **Test: bill_to_renter=true → AssetService.customer_id/customer_branch_id terisi benar (sudah dicover Task 7.4)**
    - **Test: Asset ownership_type=customer → Asset.ownershipCustomer/ownershipCustomerBranch resolve benar**
    - **Test: keduanya kosong → tidak ada exception, data null (SO manual tetap jalan)**
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4**

- [x] 14. Checkpoint - Ensure Task 13 tests pass

- [x] 15. FE — LinkModel & Form
  - [x] 15.1 `resources/js/Pages/Asset/Services/AssetServiceLinkModel.jsx` (baru) dan `AssetServiceConsumedItemLinkModel.jsx` (baru) — filter status APPROVED
    - _Requirements: 5.1, 5.2_

  - [x] 15.2 `resources/js/Pages/Asset/Services/Form.jsx` — tambah checkbox `bill_to_renter` (muncul HANYA jika `has_active_renter` true — dihitung sekali di `AssetServiceController::show()`, BUKAN `Asset::$appends` generik supaya tidak membebani listing Asset lain), field readonly `customer`/`customerBranch` snapshot. Tambah `AssetServiceController::billToRenter()` + route + `enforcePermission` entry, `loadRelationsOnShow()` tambah `customer`/`customerBranch`.
    - _Requirements: 6.2, 6.5_

  - [x] 15.3 `resources/js/Pages/Sales/SalesOrders/Form.jsx` — tambah kolom baru `referenceable` (opsional, hidden by default) pakai LinkModel 15.1 — **GAP DITEMUKAN & DIVERIFIKASI AMAN**: kolom `referenceable_type`/`referenceable_id` di `sales_order_items` TERNYATA sudah dipakai fitur existing (`mergeItems()`, copy-item-dari-InternalOrder/Quotation) — field path FE beda (`referenceable_type` flat vs `referenceable.type` nested) secara natural memisahkan 2 alur ini, tidak collision nyata karena tidak pernah aktif bersamaan di 1 baris
    - Verifikasi `git diff --stat` kolom `item` existing: 39 insertions, 0 deletions — pure addition, TIDAK ada baris diubah (Correctness Property 8)
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 15.4 Lang: `lang/en/asset/service.php`, `lang/id/asset/service.php` — `not_currently_rented`, `consumed_item_quantity_exceeded`, `bill_to_renter`, `customer`, `customer_branch`; `lang/en/sales/salesOrder.php`, `lang/id/sales/salesOrder.php` — `referenceable_not_approved`, `referenceable_already_used`, `referenceable_asset_service`
    - _Requirements: semua_

- [x] 16. Checkpoint - Ensure Task 15 tests pass, verifikasi npm build sukses

- [x] 17. Final checkpoint - Ensure all tests pass, no regression
  - **Regresi lengkap TERVERIFIKASI GENUINE** (revisi setelah feedback Stop hook — batch besar sebelumnya timeout, dipecah jadi slice per-direktori lebih kecil, semua selesai dalam waktu wajar):
    - `tests/Unit/Sales`: 27 passed
    - `tests/Feature/Sales`: 12 passed
    - `tests/Unit/Asset`: 136 passed
    - `tests/Feature/Asset`: 93 passed, 2 failed — **PRE-EXISTING, dikonfirmasi via git blame TIDAK PERNAH disentuh commit manapun di spec ini** (`PurchaseReceiptServiceFixedAssetDispatchTest`, root cause `null conversion_factor` di `PurchaseReceiptService.php:157`, tercatat di memory `project_pretest_bugs_dev_rahmad_5`, direproduksi identik dalam isolasi penuh tanpa test lain)
    - `tests/Unit/Listeners/Asset`: 24 passed
    - `tests/Feature/Inventory`: 24 passed
    - `tests/Unit/Finances`: 5 passed
    - **Total: 321 test, 319 passed, 2 pre-existing failure tidak terkait spec ini**
  - **1 regresi genuine ditemukan & diperbaiki** selama verifikasi ini: `AssetCompleteDataControllerTest::test_completes_data_in_split_mode_creates_multiple_assets_with_distinct_category_location` — gap sama seperti `AssetServiceSplitTest` (Spec 6): kategori non-bulk + quantity>1 kena validasi `allow_bulk_quantity` baru. File ini tidak pernah disentuh Spec 6/7a manapun (pre-existing dari Spec 2), diperbaiki dengan `AssetCategory::factory()->bulkQuantity()`.
  - Suite scoped spec ini sendiri (Bagian A + B, 15 file test): **38 passed (72 assertions)**
  - `git status` diverifikasi: file berubah semua dalam scope spec ini — tidak ada file di luar dugaan.
  - Ensure all tests pass, ask the user if questions arise.

- [x] 18. Pint & ESLint
  - `vendor/bin/pint --dirty` — pass, tidak ada perbaikan tersisa
  - `npx eslint` pada semua file JSX baru/berubah — 0 error (1 warning unused-var auto-fixed)
  - `npm run build` — sukses tanpa error kompilasi

## Notes

- Tidak ada task optional (`[ ]*`) — seluruh scope requirements.md bersifat wajib.
- Bagian A WAJIB selesai (Task 1-5) sebelum Bagian B dimulai — `Asset::activeRenter()` adalah dependency langsung Requirement 6/7.
- Listener Spec 6 (`SetAssetInRent`, `ReturnAssetFromRent`, `MarkAssetSoldFromDelivery`) HANYA boleh ditambah 1 baris kode baru — JANGAN ubah urutan/logic existing (`addRentedQuantity()`, guard `processed_at`, dst). Kalau task manapun terasa butuh mengubah logic lama listener ini, STOP dan re-evaluasi.
- `DeliveryNoteService::onApproved()` cabang `is_fixed_asset` (Spec 6) TIDAK disentuh — baris part AssetService memakai `ItemVariant` biasa (non-fixed-asset), otomatis lewat jalur stock standard tanpa kode baru.
- `AssetService`/`AssetServiceConsumedItem` TIDAK PERNAH mendapat relasi ke SalesOrder/SalesOrderItem/SalesInvoice/DeliveryNote — pengecualian HANYA `customer_id`/`customer_branch_id` (master data, Requirement 10.2). Kalau task manapun terasa butuh field/relasi Asset→dokumen-transaksi-Sales, STOP dan re-evaluasi.
- Idempotency guard SELALU per baris `DeliveryNoteItemAsset` (`processed_at`), pola sama Spec 6 — jangan reinvent.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3"] },
    { "id": 2, "tasks": ["2.1", "2.2", "2.3"] },
    { "id": 3, "tasks": ["2.4", "2.5"] },
    { "id": 4, "tasks": ["3"] },
    { "id": 5, "tasks": ["4.1", "4.2", "4.3"] },
    { "id": 6, "tasks": ["4.4"] },
    { "id": 7, "tasks": ["5"] },
    { "id": 8, "tasks": ["6.1", "6.2", "6.3"] },
    { "id": 9, "tasks": ["6.4"] },
    { "id": 10, "tasks": ["7.1", "7.2", "7.3"] },
    { "id": 11, "tasks": ["7.4"] },
    { "id": 12, "tasks": ["8"] },
    { "id": 13, "tasks": ["9.1", "9.2"] },
    { "id": 14, "tasks": ["9.3"] },
    { "id": 15, "tasks": ["10"] },
    { "id": 16, "tasks": ["11.1", "11.2", "11.3"] },
    { "id": 17, "tasks": ["11.4"] },
    { "id": 18, "tasks": ["12"] },
    { "id": 19, "tasks": ["13.1"] },
    { "id": 20, "tasks": ["13.2"] },
    { "id": 21, "tasks": ["14"] },
    { "id": 22, "tasks": ["15.1", "15.2", "15.3", "15.4"] },
    { "id": 23, "tasks": ["16"] },
    { "id": 24, "tasks": ["17"] }
  ]
}
```
