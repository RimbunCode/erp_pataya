# Implementation Plan: Purchase Receipt — Item di Luar PO

## Overview

Urutan: (1) data + model, (2) validasi, (3) service create/update + approve + retur, (4) hand-off Purchase Invoice + aset, (5) form, (6) i18n + verifikasi. Test ditulis bersama tiap bagian (PHPUnit; php lewat PowerShell).

## Tasks

- [x] 1. Data dan model
  - [x] 1.1 Migrasi `replaces_purchase_order_item_id` + `replaced_quantity` pada `purchase_receipt_items`
    - _Requirements: 1.2, 1.3_
  - [x] 1.2 `PurchaseReceiptItem`: relasi `replacesPurchaseOrderItem()`, cast `replaced_quantity`, `configColumns` ignore FK baru
    - _Requirements: 1_
  - [x] 1.3 Test model/relasi
    - _Requirements: 1_

- [x] 2. Validasi
  - [x] 2.1 `PurchaseReceiptRequest`: salah-satu `purchase_order_item_id`/`item.id`, aturan `replaces...`, gudang wajib, Y bukan item PO
    - _Requirements: 2.1-2.4_
  - [x] 2.2 Validasi lintas-baris `replaced_quantity` <= sisa X (jumlah per X)
    - _Requirements: 2.5_
  - [x] 2.3 Test request (positif/negatif, bypass, melebihi sisa)
    - _Requirements: 2_

- [x] 3. Service
  - [x] 3.1 `fillItemRelations`/`batchLoad` mendukung `item.id` + simpan kolom baru (create & update)
    - _Requirements: 1, 2_
  - [x] 3.2 `onApproved` baris substitusi: ALUR-2/ALUR-1 berbasis X, `received_quantity` X (lock + guard), `incomings` X
    - _Requirements: 3_
  - [x] 3.3 `onApproved` baris berdiri sendiri (ALUR-1, tanpa efek ke PO Item/`incomings`)
    - _Requirements: 4, 5_
  - [x] 3.4 Retur: tarif dari queue `receipt_item_id`, total GL di dalam loop, balik `X.received_quantity` proporsional, null-safe `$poItem`
    - _Requirements: 6_
  - [x] 3.5 Test service: tiga jenis baris, ALUR-1 & ALUR-2, status PO, GL, retur
    - _Requirements: 3, 4, 5, 6, 10_

- [x] 4. Hand-off dan aset
  - [x] 4.1 `PurchaseInvoiceService::updatePendingSLEs` mencocokkan `replaces_purchase_order_item_id`
    - _Requirements: 7_
  - [x] 4.2 `FixedAssetItemApproved`/`CreateAssetFromPurchase` null-safe
    - _Requirements: 8_
  - [x] 4.3 Test hand-off (substitusi ALUR-1 dinilai saat invoice X approve) + aset tak crash
    - _Requirements: 7, 8_

- [x] 5. Form
  - [x] 5.1 Controller edit/show memuat relasi baru (`item`, `replacesPurchaseOrderItem`)
    - _Requirements: 9.5_
  - [x] 5.2 `Form.jsx`: LinkModel multi-model (`mainLabel`, sub ItemVariant + `notIn`), pemetaan pilih varian, kolom Menggantikan + `replaced_quantity`, sel aktif/nonaktif, filter satuan, payload
    - _Requirements: 9.1-9.5_
  - [x] 5.3 Test RTL Form
    - _Requirements: 9_

- [x] 6. i18n dan verifikasi
  - [x] 6.1 Kunci i18n id/en (kolom, placeholder, pesan); jalankan `LocaleKeysTest`
  - [x] 6.2 Checkpoint: PHPUnit (PurchaseReceipt, PurchaseInvoice, Asset terkait) + Vitest (Form, LinkModel) hijau; Pint; lint
    - _Requirements: 10_
  - [x] 6.3 Verifikasi browser (build produksi, `php artisan migrate` DB lokal dulu): kasus penuh (PO -> Invoice approve -> Receipt pengganti -> approve; cek nilai stok & status PO) + varian ALUR-1
    - _Requirements: 3, 4, 9_
