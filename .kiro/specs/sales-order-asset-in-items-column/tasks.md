# Implementation Plan: Sales Order — Asset di Kolom Item

## Overview

Urutan: (1) backend (request, service, controller/model), (2) form, (3) show, (4) verifikasi. Test bersama tiap bagian (PHPUnit lewat `php -d memory_limit=2G vendor/bin/phpunit`; Vitest). Edit file spec lewat Edit/Write, bukan heredoc/PowerShell.

## Tasks

- [x] 1. Backend
  - [x] 1.1 `SalesOrderRequest`: satu `items.*` dengan `item.id` XOR `asset.id`; hapus rule `asset_items.*`, `itemBuckets()`, dan pemanggilan `AssetItemsRules`
    - _Requirements: 2_
  - [x] 1.2 Test request: sesuaikan `SalesOrderRequestAssetItemsTest`; tambah kasus keduanya/tanpa keduanya, rule baris asset
    - _Requirements: 2_
  - [x] 1.3 `SalesOrderService`: hapus `mergePayload`; `SalesOrderController`: hapus `partitionDefaultItems` dan `apply`; `SalesOrder::rentalDurations` dari `items`
    - _Requirements: 3.1, 3.2_
  - [x] 1.4 Test service: sesuaikan `SalesOrderServiceAssetItemsTest`; SO rental dengan asset non-rentable ditolak
    - _Requirements: 3, 4_

- [x] 2. Form
  - [x] 2.1 `Form.jsx`: hapus section/tabel Asset Items; `itemColumns` tunggal; kolom item multi-model (utama ItemVariant, sub Asset); patch pilih opsi; sel nonaktif baris asset
    - _Requirements: 1_
  - [x] 2.2 Total dan alokasi diskon dari `data.items`; payload `items[]`
    - _Requirements: 1.5, 2.1_
  - [x] 2.3 i18n id/en (label grup Asset) dan sesuaikan `Form.rtl.test.jsx`
    - _Requirements: 1_

- [x] 3. Show
  - [x] 3.1 `Show.jsx`: satu tabel dari `salesOrder.items`; Sync Items dan durasi rental; sesuaikan `Show.rtl.test.jsx`
    - _Requirements: 3.3_

- [x] 4. Verifikasi
  - [x] 4.1 Checkpoint: PHPUnit (Sales, Asset, Finances, Inventory terkait) + Vitest (Sales, LinkModel) hijau; Pint; lint
    - _Requirements: 4_
  - [x] 4.2 Verifikasi browser (build produksi; fixture bertanda `ZZ-SOASSET` lalu dibersihkan): SO ItemVariant + Asset; SO rental dengan Asset; create-from-SO ke DN dan SI; Show
    - _Requirements: 1, 3, 4_
