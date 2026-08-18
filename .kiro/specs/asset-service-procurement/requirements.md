# Requirements Document

## Introduction

`AssetService` (repair/maintenance) mencatat part yang dikonsumsi lewat `AssetServiceConsumedItem`. Saat ini tidak ada jalan untuk membuat `PurchaseRequest`/`PurchaseOrder` dari data konsumsi part tersebut — user harus membuat PR/PO manual dari nol dan mengetik ulang item satu per satu.

Codebase sudah punya mekanisme serupa untuk `WorkOrder` (model legacy di domain Service yang akan dihapus setelah AssetService mencapai parity fitur dengannya): tombol di halaman Show WorkOrder yang membuka form PurchaseRequest/PurchaseOrder baru, pre-filled dari item WorkOrder, lewat parameter `ref` (`"workOrder/{id}"`) yang ditangani oleh `switch` statement di `PurchaseRequestController::create()` dan `PurchaseOrderController::create()`.

Spec ini mereplikasi mekanisme yang sama untuk `AssetService`, menambahkan `case 'assetService':` di kedua controller tersebut, dan menambahkan dua tombol (satu untuk PR, satu untuk PO) di halaman Show AssetService — masing-masing tampil hanya jika user memiliki otoritas (permission `create`) untuk model tujuan.

Investigasi menemukan gap prasyarat: `AssetServiceConsumedItem` belum memiliki kolom `item_unit_id` (quantity saat ini tanpa satuan eksplisit) — kolom ini wajib ada agar baris PR/PO hasil generate punya `unit` yang benar. Spec ini juga menutup gap tersebut.

Ini adalah sub-area terakhir dari rencana besar "Spec 7" (AssetService reach parity dengan WorkOrder). Setelah spec ini selesai, WorkOrder dapat dihapus — tapi penghapusan WorkOrder itu sendiri **bukan** scope spec ini.

## Glossary

- **AssetServiceConsumedItem**: baris part yang dikonsumsi dalam satu AssetService (repair/maintenance), berelasi ke `Item` dan (setelah spec ini) `ItemUnit`.
- **`$ref` mechanism**: parameter route/query `ref` berformat `"{modelKey}/{id}"` yang diproses oleh `switch` statement di `create()` controller Purchase untuk mem-pre-fill form dari dokumen sumber.
- **Otoritas/Permission**: hak akses `create` pada model `PurchaseRequest`/`PurchaseOrder`, dicek server-side (`Controller::__construct`, hard gate) dan client-side (`usePermission().canGlobal()`, untuk visibilitas tombol).

## Requirements

### Requirement 1: Kolom `item_unit_id` pada AssetServiceConsumedItem

**User Story:** As a staff service, I want setiap baris part yang dikonsumsi punya satuan (unit) eksplisit, so that quantity yang dicatat tidak ambigu dan bisa dipetakan dengan benar ke baris PR/PO.

#### Acceptance Criteria

1. THE `asset_service_consumed_items` table SHALL memiliki kolom `item_unit_id` (foreign key ke `item_units`, `restrictOnDelete`), NOT NULL.
2. WHEN migration dijalankan pada data existing (baris lama tanpa `item_unit_id`), THE migration SHALL mem-backfill `item_unit_id` dari `Item::defaultUom()` milik `item_id` masing-masing baris SEBELUM kolom diubah menjadi NOT NULL.
3. THE `AssetServiceConsumedItem` model SHALL memiliki relasi `itemUnit(): BelongsTo` ke `ItemUnit`.
4. THE form AssetService (FE) SHALL menampilkan kolom `unit` pada tabel consumed items, default terisi dari default UOM item yang dipilih, dan dapat diubah user.
5. WHEN AssetServiceConsumedItem dibuat/diupdate lewat service layer, THE service SHALL mengisi `item_unit_id` dari payload FE.

### Requirement 2: Tombol "Buat Purchase Request" di halaman Show AssetService

**User Story:** As a staff service, I want tombol untuk membuat PurchaseRequest langsung dari AssetService, so that saya tidak perlu mengetik ulang daftar part yang perlu dibeli.

#### Acceptance Criteria

1. THE halaman Show AssetService SHALL menampilkan tombol "Buat Purchase Request" WHEN `assetService.submitted_at` terisi DAN user memiliki permission `create` pada model `PurchaseRequest`.
2. WHEN tombol diklik, THE sistem SHALL mengarahkan ke route `purchaseRequests.create` dengan parameter `ref` berformat `"assetService/{assetService.id}"`.
3. THE `PurchaseRequestController::create()` SHALL menangani `case 'assetService':` yang mengambil `AssetService` dari id pada `$ref`, DAN membangun `defaultData.items` dari `consumedItems` milik AssetService tersebut, difilter hanya item dengan `is_stock_item = true`.
4. THE setiap baris `defaultData.items` SHALL berisi: `item` (Item), `quantity` (sama persis dengan `AssetServiceConsumedItem.quantity`, tanpa kalkulasi shortfall), `unit` (dari `itemUnit` relation), `referenceable_type` (`AssetServiceConsumedItem::class`), `referenceable_id` (id baris consumed item).
5. IF AssetService pada `$ref` tidak ditemukan, THEN THE controller SHALL membuka form PurchaseRequest kosong (tanpa error), konsisten dengan behavior existing pada `case 'workOrder':`.

### Requirement 3: Tombol "Buat Purchase Order" di halaman Show AssetService

**User Story:** As a staff pembelian, I want tombol untuk membuat PurchaseOrder langsung dari AssetService, so that proses pembelian part bisa langsung dimulai tanpa PR terlebih dahulu.

#### Acceptance Criteria

1. THE halaman Show AssetService SHALL menampilkan tombol "Buat Purchase Order" WHEN `assetService.submitted_at` terisi DAN user memiliki permission `create` pada model `PurchaseOrder`.
2. WHEN tombol diklik, THE sistem SHALL mengarahkan ke route `purchaseOrders.create` dengan parameter `ref` berformat `"assetService/{assetService.id}"`.
3. THE `PurchaseOrderController::create()` SHALL menangani `case 'assetService':` dengan bentuk data setara Requirement 2.3-2.4, disesuaikan dengan pola mapping existing pada `case 'workOrder':` milik controller ini (spread item), DAN difilter hanya item dengan `is_stock_item = true` — sama seperti Requirement 2.3 (beda dari `case 'workOrder':` existing di controller ini yang tidak filter; keputusan disengaja khusus case `assetService`).
4. Tombol PR (Requirement 2) dan tombol PO (Requirement 3) SHALL masing-masing tampil independen sesuai permission masing-masing — TIDAK saling bergantung.

### Requirement 4: Tidak ada guard pembuatan berulang

**User Story:** As a staff service, I want bisa membuat PR/PO lebih dari sekali dari AssetService yang sama, so that saya bisa menambah pembelian susulan tanpa terhalang sistem.

#### Acceptance Criteria

1. THE tombol "Buat Purchase Request" DAN "Buat Purchase Order" SHALL tetap tampil (tidak disembunyikan) meskipun sudah pernah dibuat PR/PO dari AssetService yang sama sebelumnya.
2. THE sistem SHALL TIDAK melakukan kalkulasi shortfall/ketersediaan stok otomatis — seluruh `quantity` dari `AssetServiceConsumedItem` disalin apa adanya ke baris PR/PO baru; penyesuaian (hapus/kurangi baris) dilakukan manual oleh user di form hasil.
