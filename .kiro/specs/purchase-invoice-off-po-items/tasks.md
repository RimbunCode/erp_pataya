# Implementation Plan: Purchase Invoice — Item di Luar PO

## Overview

Urutan: (1) data + model, (2) validasi, (3) service invoice (create/update + approve + retur), (4) sisi receipt (ALUR-2 baris berdiri sendiri), (5) form, (6) i18n + verifikasi. Test ditulis bersama tiap bagian (PHPUnit lewat `php -d memory_limit=2G vendor/bin/phpunit`; edit file spec lewat Python/Edit, bukan PowerShell).

## Tasks

- [x] 1. Data dan model
  - [x] 1.1 Migrasi `purchase_invoice_items.purchase_receipt_item_id` + `purchase_receipt_items.billed_quantity`
    - _Requirements: 1.2, 1.3_
  - [x] 1.2 `PurchaseInvoiceItem::purchaseReceiptItem()`, `configColumns` ignore FK baru; cast `billed_quantity` di `PurchaseReceiptItem`
    - _Requirements: 1_
  - [x] 1.3 Test model/relasi
    - _Requirements: 1_

- [x] 2. Validasi
  - [x] 2.1 `PurchaseInvoiceRequest`: salah-satu tiga sumber, aturan baris receipt (PO sama, berdiri sendiri, approved), item bebas anti-bypass, wajib PO
    - _Requirements: 2_
  - [x] 2.2 Test request (positif/negatif, anti-bypass, receipt PO lain, over-bill diizinkan)
    - _Requirements: 2_

- [x] 3. Service invoice
  - [x] 3.1 `fillItemRelations`/`batchLoad` mendukung `purchase_receipt_item.id` dan `item.id` (create & update)
    - _Requirements: 1, 2_
  - [x] 3.2 `onApproved` baris receipt: lewati event PO Item, `billed_quantity` (lock), SLE FIFO berbasis receipt + item, over-bill pending, `totalStockGL`
    - _Requirements: 3_
  - [x] 3.3 `onApproved` item bebas: cocokkan baris receipt berdiri sendiri FIFO (qty − billed_quantity), menunggu bila belum ada
    - _Requirements: 4_
  - [x] 3.4 Retur: balik `billed_quantity` baris receipt; item bebas hanya GL
    - _Requirements: 7_
  - [x] 3.5 Test service: baris receipt (ALUR-1, over-bill), item bebas (match/menunggu), retur, status PO tak berubah
    - _Requirements: 3, 4, 6, 7, 9_

- [x] 4. Sisi receipt
  - [x] 4.1 `PurchaseReceiptService::onApproved` baris berdiri sendiri: ALUR-2 dari invoice item bebas (`allocated_qty`, `billed_quantity`), sisa tetap belum bernilai
    - _Requirements: 5_
  - [x] 4.2 Test sisi receipt (alokasi FIFO, sisa pending) + regresi test Purchase Receipt yang ada
    - _Requirements: 5, 9_

- [x] 5. Form
  - [x] 5.1 Controller edit/show memuat relasi baru (`item`, `purchaseReceiptItem`)
    - _Requirements: 8.4_
  - [x] 5.2 `Form.jsx`: LinkModel multi-model tiga sumber, pemetaan pilih opsi, `hasSource(row)` untuk `rawLines`/`disabled`/filter satuan, payload
    - _Requirements: 8.1-8.4_
  - [x] 5.3 Test RTL Form (dropdown, efek pilih, total menghitung baris baru, payload)
    - _Requirements: 8_

- [ ] 6. i18n dan verifikasi
  - [x] 6.1 Kunci i18n id/en (sumber, kolom, pesan validasi); jalankan `LocaleKeysTest`
  - [x] 6.2 Checkpoint: PHPUnit (Purchase, Finances, Asset, Unit terkait) + Vitest (Purchase, Finances, LinkModel) hijau; Pint; lint
    - _Requirements: 9_
  - [x] 6.3 Verifikasi browser (build produksi; migrasikan hanya file migrasi spec ini; fixture bertanda `ZZ-OFFPO` lalu dibersihkan): (a) receipt berdiri sendiri -> invoice menagih; (b) invoice item bebas -> receipt datang
    - _Requirements: 3, 4, 5, 8_
