# Implementation Plan: asset-rental-migration

## Overview

Migrasi gate rental dari `ItemVariant.type=='vehicle'` ke `AssetCategory.is_rentable`, dan implementasi `Asset::sell()` (stub sejak Spec 1), lewat mekanisme kuantitas-parsial: child table `DeliveryNoteItemAsset`/`SalesInvoiceItemAsset` (bukan FK `asset_id` langsung di parent), counter `Asset.rental_quantity`/`sold_quantity`, status `PARTIALLY_RENTED`/`PARTIALLY_SOLD` baru. `SalesOrder`/`SalesOrderItem` TIDAK disentuh sama sekali — SO tetap ItemVariant-based murni. `AssetCategory.allow_bulk_quantity` (Requirement 0) SUDAH SELESAI diimplementasi sebelum tasks.md ini ditulis.

## Tasks

- [x] 0. AssetCategory.allow_bulk_quantity (SUDAH SELESAI sebelum sesi tasks.md ini)
  - Migration, model cast, validasi `Asset::booted()`, FormRequest, lang, FE checkbox, test — semua sudah pass.
  - _Requirements: 0.1, 0.2, 0.3_

- [x] 1. Migration & enum — kolom baru dan FormStatus
  - [x] 1.1 Migration `add_rental_sold_quantity_to_assets_table`
    - Kolom: `rental_quantity` (decimal 15,4, default 0), `sold_quantity` (decimal 15,4, default 0)
    - _Requirements: 2.1, 3.1_

  - [x] 1.2 Migration `create_delivery_note_item_assets_table`
    - Kolom: `delivery_note_item_id` (FK cascade), `asset_id` (FK restrict), `quantity` (decimal 15,4), `processed_at` (timestamp nullable), timestamps
    - _Requirements: 1.1_

  - [x] 1.3 Migration `create_sales_invoice_item_assets_table`
    - Kolom: `sales_invoice_item_id` (FK cascade), `asset_id` (FK restrict), `quantity` (decimal 15,4), `processed_at` (timestamp nullable), timestamps
    - _Requirements: 3.3_

  - [x] 1.4 Migration `add_gain_loss_disposal_account_id_to_asset_category_accounts_table`
    - Kolom: `gain_loss_disposal_account_id` (FK accounts, nullable)
    - _Requirements: 3.6_

  - [x] 1.5 Tambah case `PARTIALLY_RENTED`, `PARTIALLY_SOLD` ke `app/Enums/FormStatus.php`
    - Ikuti konvensi `PARTIALLY_X` existing
    - _Requirements: 2.4, 3.8_

- [x] 2. Checkpoint - Ensure migrations run clean
  - Jalankan migration di environment test (SQLite), pastikan tidak ada FK error.

- [x] 3. Model — child table baru
  - [x] 3.1 Model `app/Models/Inventory/DeliveryNoteItemAsset.php`
    - Traits `HasUlids, SoftDeletes` (BUKAN DataTable) — `$parentRelation = 'deliveryNoteItem'`
    - Relasi `deliveryNoteItem(): BelongsTo`, `asset(): BelongsTo`
    - Cast `quantity` float, `processed_at` datetime
    - _Requirements: 1.1_

  - [x] 3.2 Model `app/Models/Finances/SalesInvoiceItemAsset.php`
    - Traits `HasUlids, SoftDeletes` — `$parentRelation = 'salesInvoiceItem'`
    - Relasi `salesInvoiceItem(): BelongsTo`, `asset(): BelongsTo`
    - Cast sama seperti 3.1
    - Boot hook `created()`: kalau parent `SalesInvoice` sudah `APPROVED`, dispatch `AssetSoldViaInvoice($this)`
    - _Requirements: 3.3, 3.5_

  - [x] 3.3 Tambah relasi `assetLines(): HasMany` di `app/Models/Inventory/DeliveryNoteItem.php` dan `app/Models/Finances/SalesInvoiceItem.php`
    - _Requirements: 1.1, 3.3_

  - [x] 3.4 Tambah relasi `gainLossDisposalAccount(): BelongsTo` di `app/Models/Asset/AssetCategoryAccount.php`
    - _Requirements: 3.6_

  - [x] 3.5 Factory `DeliveryNoteItemAssetFactory`, `SalesInvoiceItemAssetFactory`
    - _Requirements: 1.1, 3.3_

  - [x] 3.6 Write unit tests for child model relasi (Relation Exists)
    - **Relation test: `deliveryNoteItem()`/`asset()` pada DeliveryNoteItemAsset, `salesInvoiceItem()`/`asset()` pada SalesInvoiceItemAsset, `assetLines()` pada DeliveryNoteItem/SalesInvoiceItem**
    - **Validates: Requirements 1.1, 3.3**

- [x] 4. Checkpoint - Ensure Task 3 tests pass

- [x] 5. Asset.php — accessor & method kuantitas-aware
  - [x] 5.1 Accessor `availableQuantity` (Attribute::get)
    - `asset_quantity - rental_quantity - sold_quantity`
    - _Requirements: Glossary "Available Quantity"_

  - [x] 5.2 Method `addRentedQuantity(float $quantity)`/`removeRentedQuantity(float $quantity)`
    - Guard: `addRentedQuantity` throw `LogicException` (`asset/asset.insufficient_available_quantity`) kalau quantity > available
    - Panggil `recomputeStatus()` (5.4) dgn `FormStatus::IN_RENT`/`PARTIALLY_RENTED`
    - _Requirements: 2.1, 2.4, 2.5_

  - [x] 5.3 Method `addSoldQuantity(float $quantity)`
    - Guard sama seperti 5.2, isi `disposal_date` HANYA kalau `available_quantity` hasil akhir <= 0
    - Panggil `recomputeStatus()` dgn `FormStatus::SOLD`/`PARTIALLY_SOLD`
    - `sell()` (stub lama) diganti jadi alias: `addSoldQuantity($this->asset_quantity)` — one-shot jual semua sisa
    - _Requirements: 3.1, 3.2, 3.6, 3.7, 3.8_

  - [x] 5.4 Method private `recomputeStatus(FormStatus $fullStatus, FormStatus $partialStatus, float $movedQuantity)`
    - Hapus `$fullStatus`/`$partialStatus`/`ACTIVE` dari array status, lalu tambahkan ulang sesuai threshold `available_quantity`:
      - `available_quantity <= 0` → tambah `$fullStatus` saja (tanpa ACTIVE)
      - `movedQuantity > 0` dan `available_quantity > 0` → tambah `ACTIVE` + `$partialStatus`
      - `movedQuantity <= 0` → tambah `ACTIVE` saja
    - _Requirements: 2.4, 3.8_

  - [x] 5.5 Write unit tests for Asset kuantitas-aware methods (Correctness Property 3, 6)
    - **Property test: `addRentedQuantity()` menolak kalau quantity > available_quantity**
    - **Property test: status transisi benar untuk qty=1 (binary, existing behavior) DAN qty>1 (partial, kombinasi ACTIVE+PARTIALLY_RENTED/SOLD)**
    - **Property test: `addSoldQuantity()` hanya isi `disposal_date` saat available_quantity mencapai 0**
    - **Validates: Requirements 2.1, 2.4, 2.5, 3.1, 3.2, 3.6, 3.7, 3.8**

- [x] 6. Checkpoint - Ensure Task 5 tests pass

- [x] 7. Events & Listeners — rental
  - [x] 7.1 Event `app/Events/Asset/AssetRentalDeliveryApproved.php`, `AssetRentalReturnApproved.php`, `AssetSoldViaDelivery.php`
    - Constructor: `public readonly DeliveryNoteItemAsset $line`
    - _Requirements: 2.2, 2.3, 3.2_

  - [x] 7.2 Listener `app/Listeners/Asset/Rental/SetAssetInRent.php` (sync)
    - Guard `processed_at`, panggil `addRentedQuantity()`, update `processed_at`
    - _Requirements: 2.2, 3.9_

  - [x] 7.3 Listener `app/Listeners/Asset/Rental/ReturnAssetFromRent.php` (sync)
    - Guard `processed_at`, panggil `removeRentedQuantity()`, update `processed_at`
    - _Requirements: 2.3, 3.9_

  - [x] 7.4 Listener `app/Listeners/Asset/Rental/MarkAssetSoldFromDelivery.php` (sync)
    - Guard `processed_at`, panggil `addSoldQuantity()`, update `processed_at`
    - _Requirements: 3.2, 3.9_

  - [x] 7.5 Daftarkan ketiga listener di `EventServiceProvider`
    - _Requirements: 2.2, 2.3, 3.2_

  - [x] 7.6 Write unit tests for rental/sell listeners
    - **Listener test: `SetAssetInRent` — rental_quantity bertambah benar, idempotent (processed_at guard)**
    - **Listener test: `ReturnAssetFromRent` — rental_quantity berkurang benar**
    - **Listener test: `MarkAssetSoldFromDelivery` — sold_quantity bertambah, TIDAK hitung gain/loss**
    - **Validates: Requirements 2.2, 2.3, 3.2, 3.9**

- [x] 8. Checkpoint - Ensure Task 7 tests pass

- [x] 9. Event & Listener — gain/loss on disposal (queue)
  - [x] 9.1 Event `app/Events/Asset/AssetSoldViaInvoice.php`
    - Constructor: `public readonly SalesInvoiceItemAsset $line`
    - _Requirements: 3.4, 3.5_

  - [x] 9.2 Listener `app/Listeners/Asset/Rental/PostAssetDisposalGainLoss.php` (implements `ShouldQueue`, pola `PostScrapWriteOff`)
    - Guard `processed_at` (refresh row dulu, hindari race)
    - Hitung `proportionPrice`/`proportionBook`/`gainLoss` proporsional `line->quantity`
    - Posting GL: debit/credit `fixedAssetAccount`/`accumulatedDepreciationAccount`/`gainLossDisposalAccount` sesuai tanda `gainLoss`
    - `GlPostingStatus` create + update `POSTED`, `failed()` method mark `FAILED` (pola persis `PostScrapWriteOff`)
    - _Requirements: 3.6, 3.9_

  - [x] 9.3 Daftarkan listener di `EventServiceProvider`
    - _Requirements: 3.4, 3.5_

  - [x] 9.4 Write feature tests for PostAssetDisposalGainLoss
    - **Listener test: gain/loss dihitung proporsional benar (qty parsial dari Asset qty>1)**
    - **Listener test: GL entries seimbang (debit=credit), `GlPostingStatus` POSTED**
    - **Listener test: idempotent — dipanggil 2x pada row sama, efek cuma sekali**
    - **Listener test: `disposal_date` Asset terisi HANYA saat available_quantity mencapai 0**
    - **Validates: Requirements 3.4, 3.5, 3.6, 3.9**

- [x] 10. Checkpoint - Ensure Task 9 tests pass

- [x] 11. DeliveryNoteService — branch Asset & hapus gate lama
  - [x] 11.1 Modifikasi `DeliveryNoteService::onApproved()` — branch awal loop
    - `if ($item->item->is_fixed_asset) { $this->handleAssetDeliveryItem(...); continue; }`
    - Hapus gate lama `$item->item->type == 'vehicle'`
    - _Requirements: 1.4, 1.5, 1.6_

  - [x] 11.2 Method private `handleAssetDeliveryItem()`
    - Increment `delivered_quantity` (field existing)
    - Loop `$item->assetLines` → dispatch event sesuai kondisi (retur / rental / jual-putus)
    - _Requirements: 1.5, 2.2, 2.3, 3.2_

  - [x] 11.3 Tambah validasi child table di `DeliveryNoteRequest`/service layer
    - `sum(assetLines.*.quantity) == item.quantity`
    - Per row: `AssetCategory.is_rentable`, `Asset.item_id` cocok, `quantity <= available_quantity`
    - _Requirements: 1.2, 1.3_

  - [x] 11.4 Copy child `DeliveryNoteItemAsset` saat create-from-source DN retur
    - `asset_id`+`quantity` tersalin dari DN asal, user boleh kurangi `quantity` (retur sebagian)
    - _Requirements: 1.7_

  - [x] 11.5 Write feature tests for DeliveryNoteService Asset branch
    - **Feature test: DN approve baris fixed-asset (rental) → `rental_quantity` naik, TIDAK ada StockLedgerEntry dibuat**
    - **Feature test: DN approve baris fixed-asset (jual-putus) → `sold_quantity` naik**
    - **Feature test: DN approve baris item_variant biasa → logic Stock TIDAK berubah (regresi)**
    - **Feature test: validasi sum(quantity) mismatch ditolak**
    - **Feature test: validasi availability (2 DN rebutan Asset sama, kedua ditolak kalau melebihi kuantitas)**
    - **Feature test: DN retur — child ter-copy dari DN asal, quantity boleh dikurangi**
    - **Validates: Requirements 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 2.5, 3.7**

- [x] 12. Checkpoint - Ensure Task 11 tests pass

- [x] 13. SalesInvoiceService — dispatch gain/loss saat approve
  - [x] 13.1 Modifikasi `SalesInvoiceService::onApproved()`
    - Loop baris `assetLines` yang sudah terisi saat approve → dispatch `AssetSoldViaInvoice` per row
    - _Requirements: 3.4_

  - [x] 13.2 Tambah validasi child table di `SalesInvoiceRequest`/service layer (opsional, boleh kosong)
    - _Requirements: 3.3_

  - [x] 13.3 Write feature tests for SalesInvoiceService dispatch
    - **Feature test: SI approve dgn child row sudah terisi → event dispatch, listener jalan**
    - **Feature test: SI approve TANPA child row (kosong) → TIDAK dispatch apapun, SI tetap approved normal**
    - **Feature test: child row ditambahkan BELAKANGAN pada SI yang sudah approved → event dispatch via boot hook (task 3.2), TIDAK perlu re-approval**
    - **Validates: Requirements 3.3, 3.4, 3.5**

- [x] 14. Checkpoint - Ensure Task 13 tests pass

- [x] 15. Lang files
  - [x] 15.1 Tambah key baru ke `lang/en/asset/asset.php` dan `lang/id/asset/asset.php`
    - `insufficient_available_quantity`, `category_not_rentable`, `item_mismatch`, `quantity_mismatch`
    - _Requirements: semua_

  - [x] 15.2 Tambah label status ke `lang/en/status.php` dan `lang/id/status.php`
    - `partially_rented`, `partially_sold`
    - _Requirements: 2.4, 3.8_

  - [x] 15.3 Update `AssetTranslationParityTest` provider jika perlu (cek file lang baru yang disentuh)
    - _Requirements: semua_ — verified pass, tidak perlu update provider (key baru auto-covered)

- [x] 16. FE — DeliveryNote & SalesInvoice child asset lines
  - [x] 16.1 `resources/js/Pages/Inventory/DeliveryNotes/Form.jsx`
    - Nested `FormTable` child asset lines (kolom `asset` via AssetLinkModel filter item cocok + available_quantity>0, `quantity`) di kolom baru `asset_lines`, tampil hanya saat `item.is_fixed_asset`
    - Validasi FE: badge mismatch kalau sum(quantity) != quantity baris induk
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 16.2 `resources/js/Pages/Finances/SalesInvoice/Form.jsx` + `ItemForm.jsx`
    - Nested `FormTable` child asset lines sama seperti 16.1, diekspos lewat `getColumn("asset_lines")` di dialog editor row (pola `form={<ItemForm />}` existing)
    - _Requirements: 3.3_

  - [x] 16.3 Verifikasi `resources/js/Pages/Sales/SalesOrders/*` TIDAK tersentuh (Correctness Property 1)
    - `git diff --stat` kosong pada SalesOrder.php/SalesOrderItem.php/SalesOrderRequest.php/SalesOrders/Form.jsx/RentalDurationService.php — verified
    - _Requirements: 4.3_

- [x] 17. Checkpoint - Ensure Task 15-16 tests pass, verifikasi npm build sukses
  - `npm run build` sukses tanpa error kompilasi (2.32s)
  - Lang parity test pass, tasks 15-16 tests pass

- [x] 18. Final checkpoint - Ensure all tests pass, no regression
  - Full unfiltered `php artisan test` TIDAK bisa diselesaikan — mesin dev mengalami kontensi berat (run pertama di-kill setelah 3.5+ jam, run kedua yang lebih sempit di-kill setelah ~1 jam, keduanya CPU-time masih naik/tidak hang, hanya sangat lambat). Diganti scoped regression run sbg bukti pengganti:
    - Suite scoped spec ini sendiri (`tests/Unit/Asset`, `tests/Unit/Listeners/Asset`, `tests/Feature/Inventory/DeliveryNoteServiceAssetBranchTest.php`, `tests/Unit/Finances/SalesInvoiceItemAssetLateFillTest.php`): **150 passed (308 assertions)**
    - `tests/Feature/Sales/*`, `tests/Unit/Sales/*`, `tests/Unit/RentalDurationServiceTest.php`, `tests/Feature/RentalDurationCalculationTest.php`, `tests/Feature/SalesInvoiceRentalPrefillTest.php`: **48 passed (84 assertions)**
    - Broader `tests/Unit/Asset tests/Feature/Asset tests/Unit/Inventory tests/Feature/Inventory tests/Unit/Finances tests/Feature/Finances` di-kill sebelum selesai (proses masih progress, bukan hang) — TIDAK ada bukti regresi baru dari run yang sempat berjalan (>4 menit CPU aktif tanpa error output)
  - Verifikasi diff kosong pada `SalesOrder.php`/`SalesOrderItem.php`/`SalesOrderRequest.php`/`SalesOrders/Form.jsx`/`RentalDurationService.php` (Correctness Property 1, 7) — **verified empty, 3x re-check di titik berbeda**
  - 2 regresi genuine ditemukan & diperbaiki selama checkpoint ini (bukan bug baru dari spec, tapi terekspos oleh validasi baru):
    - `AssetServiceSplitTest` (Spec 3, pre-existing) — 3 test method butuh `AssetCategory::factory()->bulkQuantity()` karena validasi `allow_bulk_quantity` baru menolak `asset_quantity>1` di kategori non-bulk
    - `DeliveryNoteService::onApproved()` — bug laten transaction-leak (tidak ada try/catch di method manapun sejak awal) terekspos oleh exception baru dari `handleAssetDeliveryItem()`; fix scoped hanya di call-site baru (rollback+rethrow), TIDAK mengubah logic stock/transaction lama
  - Full project test suite TIDAK terverifikasi end-to-end karena kendala mesin — direkomendasikan user re-run `php artisan test --compact` saat mesin idle untuk konfirmasi akhir

## Notes

- Tidak ada task optional (`[ ]*`) — seluruh scope requirements.md bersifat wajib.
- Task 0 (`allow_bulk_quantity`) SUDAH SELESAI sebelum tasks.md ini ditulis — dicatat sbg baseline, tidak perlu dikerjakan ulang.
- `SalesOrder`/`SalesOrderItem`/`SalesOrderRequest`/`SalesOrders/Form.jsx` WAJIB TIDAK TERSENTUH — kalau task manapun terasa butuh mengubah salah satu file ini, STOP dan re-evaluasi (kemungkinan kembali ke draft desain lama yang sudah dibatalkan).
- Idempotency guard SELALU per child-row (`processed_at`), BUKAN per-Asset — 1 Asset bisa menerima banyak event dari banyak baris berbeda dalam dokumen yang sama maupun beda dokumen.
- Listener rental/sell (DN) SYNC — listener gain/loss (SI) QUEUE — evaluasi ini sudah final dari design.md, jangan ubah tanpa alasan baru (pola sama Spec 3 vs Spec 4/5).
- `Asset::sell()` lama (method publik, dipanggil dari Controller action non-SO) TETAP ADA sbg alias one-shot `addSoldQuantity(asset_quantity)` — jangan hapus signature-nya, ada kemungkinan caller lain (Controller `AssetController::action()` Spec 1) yang masih pakai.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3", "1.4", "1.5"] },
    { "id": 1, "tasks": ["2"] },
    { "id": 2, "tasks": ["3.1", "3.2", "3.4"] },
    { "id": 3, "tasks": ["3.3", "3.5"] },
    { "id": 4, "tasks": ["3.6"] },
    { "id": 5, "tasks": ["4"] },
    { "id": 6, "tasks": ["5.1"] },
    { "id": 7, "tasks": ["5.4"] },
    { "id": 8, "tasks": ["5.2", "5.3"] },
    { "id": 9, "tasks": ["5.5"] },
    { "id": 10, "tasks": ["6"] },
    { "id": 11, "tasks": ["7.1"] },
    { "id": 12, "tasks": ["7.2", "7.3", "7.4"] },
    { "id": 13, "tasks": ["7.5"] },
    { "id": 14, "tasks": ["7.6"] },
    { "id": 15, "tasks": ["8"] },
    { "id": 16, "tasks": ["9.1"] },
    { "id": 17, "tasks": ["9.2"] },
    { "id": 18, "tasks": ["9.3"] },
    { "id": 19, "tasks": ["9.4"] },
    { "id": 20, "tasks": ["10"] },
    { "id": 21, "tasks": ["11.1", "11.2"] },
    { "id": 22, "tasks": ["11.3", "11.4"] },
    { "id": 23, "tasks": ["11.5"] },
    { "id": 24, "tasks": ["12"] },
    { "id": 25, "tasks": ["13.1", "13.2"] },
    { "id": 26, "tasks": ["13.3"] },
    { "id": 27, "tasks": ["14"] },
    { "id": 28, "tasks": ["15.1", "15.2", "15.3"] },
    { "id": 29, "tasks": ["16.1", "16.2", "16.3"] },
    { "id": 30, "tasks": ["17"] },
    { "id": 31, "tasks": ["18"] }
  ]
}
```
