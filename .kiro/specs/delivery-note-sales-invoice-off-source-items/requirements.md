# Requirements Document

## Introduction

Diturunkan dari [design.md](design.md) (`design-first`). Menyatukan section Asset Items ke tabel Items pada Delivery Note dan Sales Invoice, dan membuat kedua dokumen dapat menyimpan baris di luar Sales Order.

## Glossary

- **Baris SO**: baris dengan sumber SalesOrderItem/InternalOrderItem (`referenceable` di DN, `sales_order_item` di SI).
- **Baris bebas**: baris tanpa baris SO, dengan `item.id` (ItemVariant) atau `asset.id` (Asset).

## Requirements

### Requirement 1: Satu tabel Items (DN dan SI)

1. THE form DN dan form SI SHALL memiliki satu tabel Items; section dan tabel Asset Items SHALL dihapus.
2. THE kolom item SHALL memakai LinkModel multi-model: model utama baris SO, sub model ItemVariant (`item.is_fixed_asset=false`) dan sub model Asset (aktif).
3. WHEN pengguna memilih opsi baris SO, THE baris SHALL berperilaku seperti sekarang; WHEN memilih opsi ItemVariant atau Asset, THE sumber SO SHALL dikosongkan, baris Asset SHALL tanpa unit dan gudang dengan quantity 1.
4. THE sel baris SHALL aktif bila baris punya salah satu dari tiga sumber.
5. Prefill create-from-SO dan retur SHALL tidak lagi dipisah ke dua tabel.

### Requirement 2: Payload dan validasi

1. THE payload DN dan SI SHALL memakai satu `items[]`; key `asset_items` SHALL tidak dipakai.
2. Setiap baris SHALL memiliki setidaknya satu dari baris SO, `item.id`, atau `asset.id`; bila lebih dari satu, prioritas SHALL baris SO > item > asset.
3. Baris `item.id` SHALL memiliki `unit`, `quantity` min 1, dan (di DN) `source_warehouse`; baris `asset.id` SHALL memiliki `quantity` min 1, tanpa unit dan gudang, dan tidak wajib rentable.
4. Baris bebas SI SHALL memiliki `price` dan `tax`.
5. Header DN SHALL tetap wajib menunjuk SO atau Internal Order.
6. Retur baris `asset.id` bebas SHALL ditolak.

### Requirement 3: Delivery Note — approve

1. Baris `item.id` bebas SHALL memotong stok, mencatat SLE, dan menghitung valuasi seperti baris biasa.
2. Baris bebas SHALL tidak menaikkan `delivered_quantity` SO/IO dan tidak mengubah status pengiriman SO/IO.
3. Baris `asset.id` bebas SHALL memicu `AssetSoldViaDelivery`.
4. THE approve SHALL tidak lagi melempar error untuk baris tanpa `referenceable`.
5. Retur baris `item.id` bebas SHALL membalik stok memakai valuasi baris asal.

### Requirement 4: Sales Invoice — approve

1. SI SHALL tidak menyentuh stok untuk baris apa pun.
2. Baris bebas SHALL tidak memicu `SalesOrderItemBillingChanged` dan tidak mengubah `billed_quantity` SO.
3. GL SI SHALL mencakup baris bebas.
4. Baris `asset.id` bebas SHALL memicu `AssetSoldViaInvoice`.

### Requirement 5: Data

1. THE `delivery_note_items.referenceable_type/id` SHALL nullable; `item_id` DN dan SI SHALL nullable (baris asset).
2. Kolom dan perilaku lama SHALL tidak berubah.

### Requirement 6: Kompatibilitas

1. Baris SO (create-from-SO, retur, event rental/jual dari SO, status SO) SHALL berperilaku identik.
2. Test DN, SI, dan Asset yang ada SHALL tetap lulus setelah disesuaikan ke bentuk payload baru.

### Requirement 7: Pengamanan baris di luar dokumen sumber

1. WHEN payload memuat baris bebas, THE request SHALL menolaknya kecuali user memiliki izin `manage_off_source_items` pada model dokumen (DN atau SI); form SHALL tidak menawarkan sub model ItemVariant/Asset tanpa izin itu.
2. Asset bebas SHALL berstatus `active` dan SHALL belum ada di dokumen submitted sejenis lain (bukan retur, belum dibatalkan).
3. Setiap baris sumber SHALL milik dokumen header (SO/IO pada DN, SO pada SI).
