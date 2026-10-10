# Implementation Plan: Asset Items Section (revisi `asset_id`)

## Overview

Ganti mekanisme `asset_lines` (child table) dengan kolom `asset_id` langsung. Urutan: migration dulu (schema fondasi semuanya), lalu model/relasi, lalu domain event/listener (paling berisiko, sentuh logic approve aset), lalu backend validasi/service/partitioner, lalu frontend per dokumen, lalu bersih-bersih test lama, lalu full verifikasi.

## Tasks

- [x] 1. Migration skema
  - [x] 1.1 Migration tambah `asset_id` nullable FK `assets` di `sales_order_items`, `sales_invoice_items`, `delivery_note_items`
    - _Requirements: 1.1_
  - [x] 1.2 Migration ubah `item_id` jadi nullable di ketiga tabel itu (Laravel 12 `change()`; teruji di SQLite)
    - _Requirements: 1.2_
  - [x] 1.3 Migration drop `sales_invoice_item_assets` dan `delivery_note_item_assets`
    - _Requirements: 1.3_
  - [x] 1.4 `php artisan migrate` di DB lokal (bukan cuma test SQLite — memory project: migration baru wajib migrate lokal sebelum visual test)
    - _Requirements: 1.1-1.3_

- [x] 2. Checkpoint — migration jalan bersih di SQLite test + DB lokal, tidak ada FK error

- [x] 3. Model
  - [x] 3.1 Tambah relasi `asset(): BelongsTo` di `SalesOrderItem`, `SalesInvoiceItem`, `DeliveryNoteItem`
    - _Requirements: 1.4_
  - [x] 3.2 Hapus relasi `assetLines()` dari `SalesInvoiceItem`/`DeliveryNoteItem`; hapus model `SalesInvoiceItemAsset`/`DeliveryNoteItemAsset` + factory
    - _Requirements: 1.3_
  - [x] 3.3 `SalesOrderItem::templateLink()` → `:asset_id ? :asset | :item`
    - _Requirements: (lihat design.md §3, sudah diverifikasi zero-PHP-change di parser lain)_

- [x] 4. Event & Listener domain aset (paling berisiko — sentuh logic approve aset yang sudah jalan di production)
  - [x] 4.1 Retype `AssetRentalDeliveryApproved`, `AssetRentalReturnApproved`, `AssetSoldViaDelivery` — `$line: DeliveryNoteItemAsset` → `DeliveryNoteItem`
    - _Requirements: 2.1, 2.2_
  - [x] 4.2 Retype `AssetSoldViaInvoice` — `$line: SalesInvoiceItemAsset` → `SalesInvoiceItem`
    - _Requirements: 2.3_
  - [x] 4.3 Cek & sesuaikan `SetAssetInRent`, `ReturnAssetFromRent`, `MarkAssetSoldFromDelivery`, `PostAssetDisposalGainLoss` — pastikan `$event->line->asset`/`->quantity`/`->id`/`::class` tetap valid utk tipe row baru; `PostAssetDisposalGainLoss` baris ~109 nulis `referenceable_type/id` morph — cek konsumen morph itu tidak hardcode nama class lama
    - _Requirements: 2.4, 2.7_
  - [x] 4.4 Sederhanakan `DeliveryNoteService::handleAssetDeliveryItem()` — hapus cek Σ quantity `asset_lines`, dispatch event langsung dari `$item` (1× per baris ber-`asset_id`)
    - _Requirements: 2.5_
  - [x] 4.5 Ganti `SalesInvoiceService::onApproved()` — dispatch `AssetSoldViaInvoice` per baris ber-`asset_id` (bukan loop `assetLines`)
    - _Requirements: 2.6_
  - [x] 4.6 Hapus `syncAssetLines()` dari `DeliveryNoteService` dan `SalesInvoiceService` + pemanggilnya di `create()`/`update()`
    - _Requirements: 1.3, 2.5, 2.6_
  - [x] 4.7 Update test listener: `SetAssetInRentTest`, `ReturnAssetFromRentTest`, `MarkAssetSoldFromDeliveryTest`, `PostAssetDisposalGainLossTest` — event baru bertipe row, bukan child line
    - _Requirements: 6.2_

- [x] 5. Checkpoint — test listener aset + `php artisan test --filter=Asset` pass, event dispatch count tetap benar (1 per baris beraset, sudah diverifikasi manual dulu approve DN/SI test lokal)

- [x] 6. Backend — partisi & validasi payload
  - [x] 6.1 Sederhanakan `AssetItemPartitioner` — cek `asset.id`/`item.id` di payload row langsung, hapus query lookup `Item.is_fixed_asset` via `ItemVariant`
    - _Requirements: 3.1, 3.2_
  - [x] 6.2 Update `AssetItemsRules`/FormRequest rules literal — `asset_items.*.asset.id` (exists `assets`), hapus rule `asset_lines.*`; literal dipakai agar generator schema dapat membaca rules
    - _Requirements: 4.1_
  - [x] 6.3 Update `SalesOrderRequest`/`SalesInvoiceRequest`/`DeliveryNoteRequest` — validasi `item.id` XOR `asset.id` per baris sesuai tabelnya (Items tolak `asset.id`, Asset Items tolak `item.id`)
    - _Requirements: 4.2_
  - [x] 6.4 Update `SalesOrderService`/`SalesInvoiceService`/`DeliveryNoteService` — `fillItemRelations` isi `asset_id` dari `asset.id` payload (paralel `item_id` dari `item.id`)
    - _Requirements: 1.1_

- [x] 7. Checkpoint — test backend `*RequestAssetItemsTest`, `*ServiceAssetItemsTest` (SO/SI/DN) pass dengan skema baru

- [x] 8. Frontend — SO
  - [x] 8.1 Ganti field "item" section Asset Items → `AssetLinkModel`, label "Asset", isi `asset_id`
    - _Requirements: 5.1_
  - [x] 8.2 Hapus kolom Source Warehouse dari kolom Asset Items SO
    - _Requirements: 5.1_
  - [x] 8.3 Update `Form.rtl.test.jsx`, `Show.jsx`/`Show.rtl.test.jsx` SO — assertion field Asset ganti, hapus assertion source_warehouse Asset Items

- [x] 9. Frontend — DN & SI
  - [x] 9.1 Ganti filter kolom "item" (`buildItemColumns`) — `asset_id` presence, bukan `item.item.is_fixed_asset`; label "Asset" utk kind asset
    - _Requirements: 5.2_
  - [x] 9.2 Hapus kolom `asset_lines` (nested FormTable) total dari DN & SI Form.jsx
    - _Requirements: 5.4_
  - [x] 9.3 Hapus kolom Source Warehouse dari kind `"asset"` DN
    - _Requirements: 5.3_
  - [x] 9.4 DN: section Asset Items hanya tampil bila `reference_to.model === SalesOrder`
    - _Requirements: (di luar scope InternalOrder, design.md §9)_
  - [x] 9.5 Hapus/refactor `resources/js/lib/assetItems.js` (`fetchFixedAssetVariantIds`, `partitionRowsByVariantIds`) — partisi FE cek `row.asset?.id` langsung
    - _Requirements: 3.2_
  - [x] 9.6 Update `Form.rtl.test.jsx`, `Show.rtl.test.jsx` DN & SI — assertion filter/label/hapus asset_lines/source_warehouse
  - [x] 9.7 Hapus Unit dari Asset Items; persist `item_unit_id = null`; pastikan Tax SO/SI wajib dan selalu terlihat, termasuk backfill migrasi
    - _Requirements: 5.5-5.6_
  - [x] 9.8 SO rental mengakui baris Asset rentable sebagai objek rental; tambah tes regresi service
    - _Requirements: 5.7_

- [x] 10. Checkpoint — test FE (Vitest) DN/SI/SO Form & Show pass

- [x] 11. Bersih-bersih test lama (child table)
  - [x] 11.1 Hapus `DeliveryNoteItemAssetTest`, `SalesInvoiceItemAssetTest`, `SalesInvoiceItemAssetLateFillTest`, `DeliveryNoteAssetLinesPersistenceTest`, `DeliveryNoteRequestAssetLinesTest`
    - _Requirements: 6.1_
  - [x] 11.2 Pastikan tidak ada kode production/factory/persistence yang memakai child model atau assetLines; pengecualian hanya migration/backfill test dan test request yang sengaja menolak input legacy asset_lines

- [-] 12. Final checkpoint — full test suite backend + Vitest penuh + `vendor/bin/pint --dirty --format agent` + verifikasi browser (create SO Asset Items, create-from-source SI & DN, approve DN, cek Asset jadi rented/sold)
