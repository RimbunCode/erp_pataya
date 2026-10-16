# Implementation Plan: Delivery Note dan Sales Invoice — Item di Luar Sales Order

## Overview

Urutan: (1) data, (2) Delivery Note backend, (3) Delivery Note form, (4) Sales Invoice backend, (5) Sales Invoice form, (6) pembersihan + i18n + verifikasi. Test bersama tiap bagian (`composer test` memakai `XDEBUG_MODE=off`; subset: `XDEBUG_MODE=off php -d memory_limit=2G vendor/bin/phpunit <path>`; Vitest). Edit file lewat Edit/Write, bukan heredoc.

## Tasks

- [x] 1. Data
  - [x] 1.1 Migrasi: `delivery_note_items.referenceable_type/id` nullable; `item_id` DN dan SI nullable (periksa kondisi sekarang); `down()` kompatibel SQLite
    - _Requirements: 5_
  - [x] 1.2 Model `DeliveryNoteItem`/`SalesInvoiceItem`: relasi dan `configColumns` menyesuaikan; test model
    - _Requirements: 5_

- [x] 2. Delivery Note — backend
  - [x] 2.1 `DeliveryNoteRequest`: satu `items[]`, tiga sumber dan prioritas, aturan baris bebas, rentable hanya untuk asset dari SO, retur asset bebas ditolak; hapus `asset_items`
    - _Requirements: 2_
  - [x] 2.2 Test request (positif/negatif, prioritas, header wajib SO/IO, retur asset bebas ditolak)
    - _Requirements: 2_
  - [x] 2.3 `DeliveryNoteService`: `fillItemRelations` baris bebas; `onApproved` (lewati `delivered_quantity`, stok ItemVariant bebas, `AssetSoldViaDelivery`, tanpa `RuntimeException`); retur ItemVariant bebas
    - _Requirements: 3_
  - [x] 2.4 Test service (stok turun, `delivered_quantity` SO tetap, event jual aset, retur, regresi baris SO)
    - _Requirements: 3, 6_

- [x] 3. Delivery Note — form
  - [x] 3.1 `DeliveryNotes/Form.jsx`: hapus section/tabel Asset Items; `itemColumns` tunggal; kolom item multi-model (utama baris SO, sub ItemVariant dan Asset); patch pilih opsi; sel nonaktif; prefill tanpa partisi
    - _Requirements: 1_
  - [x] 3.2 Sesuaikan `DeliveryNotes/Form.rtl.test.jsx` dan `Show` (satu tabel); i18n id/en
    - _Requirements: 1_

- [x] 4. Sales Invoice — backend
  - [x] 4.1 `SalesInvoiceRequest`: satu `items[]`, tiga sumber dan prioritas, `price`/`tax` baris bebas, retur asset bebas ditolak; hapus `asset_items`
    - _Requirements: 2_
  - [x] 4.2 `SalesInvoiceService`: `fillItemRelations` baris bebas; `onApproved` (tanpa `SalesOrderItemBillingChanged` untuk baris bebas, GL, `AssetSoldViaInvoice`)
    - _Requirements: 4_
  - [x] 4.3 Test request dan service (positif/negatif, GL, event, regresi baris SO, retur)
    - _Requirements: 2, 4, 6_

- [x] 5. Sales Invoice — form
  - [x] 5.1 `Finances/SalesInvoice/Form.jsx`: hapus section/tabel Asset Items; `itemColumns` tunggal; kolom item multi-model; patch pilih opsi; total dan rental rows dari satu `items`
    - _Requirements: 1_
  - [x] 5.2 Sesuaikan `SalesInvoice/Form.rtl.test.jsx` dan `Show`; i18n id/en
    - _Requirements: 1_

- [x] 6. Pembersihan dan verifikasi
  - [x] 6.1 Hapus `AssetItemsSection`, `getAllItems`/`allocationContext`/`partitionRowsByAssetId`, `AssetItemPartitioner`, `AssetItemsRules` bila tak ada pemakai lagi (periksa tiap referensi); sesuaikan test terkait
    - _Requirements: 6_
  - [x] 6.2 Checkpoint: `composer test` penuh + `vitest run` penuh hijau; Pint; lint
    - _Requirements: 6_
  - [x] 6.3 Verifikasi browser (build produksi; fixture bertanda `ZZ-DNSI` lalu dibersihkan): DN baris SO + ItemVariant bebas + Asset bebas (stok, status asset); SI baris bebas; create-from-SO dan retur
    - _Requirements: 1, 3, 4_
