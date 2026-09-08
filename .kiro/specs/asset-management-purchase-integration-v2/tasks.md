# Implementation Plan: Asset Management Purchase Integration v2

## Overview

Implementasi menambah jalur manual link Asset↔Purchase lewat 3 lapis: (1) model backend — relasi `asset()` balik + `scopeLinkModel()` untuk filter fixed-asset & belum-dikonversi, (2) validasi `AssetRequest` — consistency check Item↔baris↔field derived, plus guard universal di `AssetService::submit()`, (3) frontend — 2 LinkModel React baru + integrasi ke `Form.jsx` Assets dengan derive-on-select. Tidak ada migration baru (semua kolom sudah ada sejak Fase 1/2); tidak menyentuh `CreateAssetFromPurchase` listener maupun `CompleteAssetDataRequest`.

## Tasks

- [ ] 1. Backend: Model & Scope Purchase
  - [ ] 1.1 Tambah relasi `asset(): HasOne` dan `scopeLinkModel()` di `app/Models/Purchase/PurchaseReceiptItem.php`
    - `asset()`: `hasOne(Asset::class, 'purchase_receipt_item_id')`
    - `scopeLinkModel($query, $search)`: filter `whereHas('item.item', fn => where('is_fixed_asset', true))`, `whereDoesntHave('asset')`, search opsional by nama Item
    - _Requirements: 1.2, 2.2, 2.3, 2.4_
  - [ ] 1.2 Tambah relasi `asset(): HasOne` dan `scopeLinkModel()` setara di `app/Models/Finances/PurchaseInvoiceItem.php`
    - `asset()`: `hasOne(Asset::class, 'purchase_invoice_item_id')`
    - `scopeLinkModel()` sama pola dengan 1.1
    - _Requirements: 1.2, 2.2, 2.3, 2.4_
  - [ ] 1.3 Write unit tests untuk `scopeLinkModel()` kedua model (Property 1 & 2)
    - **Property 1: Filter fixed-asset konsisten** — baris pembelian untuk Item non-fixed-asset TIDAK muncul di hasil `scopeLinkModel()`
    - **Property 2: Baris sudah dikonversi tidak muncul lagi** — baris yang sudah punya `Asset` terkait (`purchase_receipt_item_id`/`purchase_invoice_item_id` terisi) TIDAK muncul di hasil, baris yang Asset-nya sudah soft-deleted TETAP muncul
    - Test factory: buat `PurchaseReceiptItem`/`PurchaseInvoiceItem` untuk Item fixed-asset & non-fixed-asset, dengan & tanpa `Asset` terkait
    - **Validates: Requirements 1.2, 2.2, 2.3, 2.4**

- [ ] 2. Checkpoint - Ensure model & scope tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 3. Backend: Validasi `AssetRequest`
  - [ ] 3.1 Tambah rules untuk `item_id`, `purchase_receipt_id`, `purchase_invoice_id`, `purchase_receipt_item_id`, `purchase_invoice_item_id` di `app/Http/Requests/Asset/AssetRequest.php::rules()`
    - Semua `nullable` + `exists` ke tabel masing-masing (`item_id` sudah ada rule-nya, field lain baru)
    - _Requirements: 4.1_
  - [ ] 3.2 Tambah `validateItemIsFixedAsset()` di `AssetRequest`, panggil dari `withValidator()`
    - Tolak kalau `item_id` diisi tapi `Item::is_fixed_asset` bukan `true`
    - _Requirements: 4.2_
  - [ ] 3.3 Tambah `validatePurchaseLinkConsistency()` di `AssetRequest`, panggil dari `withValidator()`
    - Guard idempoten: baris pembelian belum dipakai `Asset` lain (exclude Asset yang sedang di-update)
    - Item pada baris harus sama dengan `item_id` yang dikirim (resolve lewat `item.item.id`)
    - `asset_quantity` harus sama dengan `quantity` baris Receipt; `net_purchase_amount`/`gross_purchase_amount` harus sama dengan hasil hitung baris Invoice
    - Kalau Receipt DAN Invoice sama-sama terisi: `purchase_order_item_id` keduanya harus sama dan tidak null
    - _Requirements: 2.6, 2.7, 4.3, 4.4, 4.5, 4.6_
  - [ ] 3.4 Tambah error message keys baru di `lang/id/asset/asset.php` dan `lang/en/asset/asset.php`: `item_must_be_fixed_asset`, `purchase_item_already_converted`, `purchase_item_mismatch`, `derived_field_mismatch`, `purchase_receipt_invoice_mismatch`
    - Ikuti format existing (lihat `ownership_field_must_be_empty`, `rentable_must_be_single_unit`)
    - _Requirements: 4.2, 4.3, 4.4, 4.5_
  - [ ] 3.5 Write feature tests untuk validasi di `tests/Feature/Asset/AssetControllerTest.php` (Property 1, 2, 3, 4)
    - `item_id` non-fixed-asset ditolak 422
    - Baris pembelian yang sudah dipakai Asset lain ditolak 422
    - `item_id` beda dari Item pada baris yang dipilih ditolak 422
    - `asset_quantity`/nilai perolehan yang dikirim tidak sama dengan hasil derive ditolak 422
    - Receipt + Invoice dari PO berbeda ditolak 422; dari PO sama diterima
    - **Validates: Requirements 4.2, 4.3, 4.4, 4.5**

- [ ] 4. Checkpoint - Ensure AssetRequest validation tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Backend: Guard kelengkapan pembelian di `AssetService::submit()`
  - [ ] 5.1 Tambah pengecekan di `app/Services/Asset/AssetService.php::submit()`, gabung ke array `$missingFields` yang sudah ada
    - `$hasPurchaseHistory = $model->purchase_receipt_id || $model->purchase_invoice_id`
    - Kalau `$hasPurchaseHistory` tapi salah satu dari `purchase_receipt_id`/`purchase_invoice_id` kosong → tambah ke `$missingFields`, reuse pesan `cannot_submit_incomplete`
    - _Requirements: 7.1, 7.2, 7.3_
  - [ ] 5.2 Write feature tests untuk guard submit (Property 5)
    - **Property 5: Guard Active universal** — Asset dengan riwayat pembelian tidak bisa submit kalau salah satu link kosong; Asset tanpa riwayat pembelian sama sekali tetap bisa submit seperti biasa
    - Regresi: simulasikan Asset ala jalur otomatis (factory dengan `purchase_invoice_id` terisi, `purchase_receipt_id` null, `asset_category_id`/`asset_location_id` terisi) — pastikan submit DITOLAK oleh guard baru, mengonfirmasi guard berlaku universal (bukan cuma untuk Asset baru dari jalur manual)
    - Test lengkapi link yang kurang lewat `AssetService::update()` lalu submit lagi → sukses
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4**

- [ ] 6. Checkpoint - Ensure submit guard tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Frontend: LinkModel components baru
  - [ ] 7.1 Buat `resources/js/Pages/Purchase/PurchaseReceipts/PurchaseReceiptItemLinkModel.jsx`
    - Wrapper tipis mengikuti pola `AssetLinkModel.jsx` (lihat `resources/js/Pages/Asset/Assets/AssetLinkModel.jsx`), `model="App\Models\Purchase\PurchaseReceiptItem"`
    - _Requirements: 2.1_
  - [ ] 7.2 Buat `resources/js/Pages/Finances/PurchaseInvoice/PurchaseInvoiceItemLinkModel.jsx`
    - Sama pola dengan 7.1, `model="App\Models\Finances\PurchaseInvoiceItem"`
    - _Requirements: 2.1_
  - [ ] 7.3 Write component tests `.rtl.test.jsx` untuk kedua LinkModel baru (ikuti pola `AssetLinkModel.rtl.test.jsx`)
    - Verifikasi prop `model` diteruskan benar ke `LinkModel` generic, `value`/`onValueChange` diteruskan
    - **Validates: Requirements 2.1**

- [ ] 8. Checkpoint - Ensure new LinkModel component tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Frontend: Integrasi `Form.jsx` Assets
  - [ ] 9.1 Update field `item_id` di `resources/js/Pages/Asset/Assets/Form.jsx` (baris ~75-81)
    - Hapus `disabled`
    - Tambah `filters={{ is_fixed_asset: true }}` dan `with={["variants"]}`
    - _Requirements: 1.1, 1.2, 1.3_
  - [ ] 9.2 Tambah `FormInput` baru untuk link Purchase Receipt Item, memakai `PurchaseReceiptItemLinkModel` (task 7.1)
    - `filters` dinamis: `{ item_id: { in: itemVariantIds } }` ketika `data.item.variants` tersedia, kosong kalau `item_id` belum dipilih (Requirement 2.2/2.3)
    - `with={["item.item", "purchaseReceipt"]}` untuk data yang dibutuhkan derive
    - Handler `onValueChange`: derive & lock `asset_quantity`, `purchase_date`; derive & lock `item_id` HANYA jika sebelumnya kosong (Requirement 2.5, 3.1)
    - _Requirements: 2.1, 2.2, 2.3, 2.5, 3.1_
  - [ ] 9.3 Tambah `FormInput` baru untuk link Purchase Invoice Item, memakai `PurchaseInvoiceItemLinkModel` (task 7.2)
    - Filter setara task 9.2
    - Handler `onValueChange`: derive & lock `net_purchase_amount`/`gross_purchase_amount`; derive & lock `item_id` HANYA jika sebelumnya kosong; utamakan `purchase_date` dari Receipt kalau keduanya ada (Requirement 3.2, 3.5)
    - _Requirements: 2.1, 2.2, 2.3, 2.5, 3.2, 3.5_
  - [ ] 9.4 Update `NumberInput` `asset_quantity` (baris ~86-91): `disabled` kondisional saat `data.purchase_receipt_item` terisi
    - _Requirements: 3.3_
  - [ ] 9.5 Update `NumberInput` `gross_purchase_amount`/`net_purchase_amount` (baris ~179-195): `disabled` kondisional saat `data.purchase_invoice_item` terisi
    - _Requirements: 3.4_
  - [ ] 9.6 Tambah `useEffect`/handler reset: WHEN `item_id` berubah dan baris pembelian yang ter-link sudah tidak match Item baru → kosongkan link + field derived-nya; WHEN link Receipt/Invoice dihapus → kosongkan field derived-nya saja (`item_id` TETAP kalau link lain yang tersisa masih match)
    - _Requirements: 2.6, 2.8, 3.6, 3.7_
  - [ ] 9.7 Update comment & assertion di `resources/js/Pages/Asset/Assets/Form.rtl.test.jsx` yang menyatakan "asset_type & item selalu disabled" (baris ~19-22) — `item_id` sekarang tidak disabled lagi (`asset_type` tetap disabled, tidak berubah)
    - _Requirements: 1.1_
  - [ ] 9.8 Write/update `.rtl.test.jsx` untuk skenario baru di Form.jsx Assets
    - `item_id` tidak disabled, `filters={{is_fixed_asset:true}}` terkirim ke LinkModel
    - Pilih baris Receipt → `asset_quantity`/`purchase_date` ter-derive dan readonly; Item ikut terisi kalau sebelumnya kosong
    - Pilih baris Invoice → nilai perolehan ter-derive dan readonly
    - Hapus link → field terkait kembali editable dan dikosongkan
    - Ubah `item_id` setelah ada link yang tidak match → link & field derived-nya ter-reset
    - **Validates: Requirements 1.1, 1.2, 2.5, 2.6, 2.8, 3.1, 3.2, 3.3, 3.4, 3.6, 3.7**

- [ ] 10. Final checkpoint - Ensure all tests pass
  - Jalankan test PHPUnit terkait (`tests/Feature/Asset/`, `tests/Unit/Asset/`) dan Vitest terkait (`resources/js/Pages/Asset/Assets/`, `resources/js/Pages/Purchase/PurchaseReceipts/`, `resources/js/Pages/Finances/PurchaseInvoice/`)
  - Ensure all tests pass, ask the user if questions arise.
  - Lint/Pint dijalankan setelah ini, di luar scope task individual (sesuai aturan project)

## Notes

- Setiap task mereferensi requirement spesifik (lihat `requirements.md`) untuk traceability.
- Checkpoint memastikan validasi inkremental — backend (model→request→submit guard) divalidasi penuh sebelum frontend mulai, supaya frontend terintegrasi ke backend yang sudah teruji.
- Task 5.2 (regresi guard universal) penting divalidasi hati-hati — ini SATU-SATUNYA titik yang mengubah perilaku jalur otomatis existing (Fase 2, sudah live). Kalau ada test existing di `tests/Feature/Asset/` atau seed/factory yang mengandalkan Asset dengan riwayat pembelian parsial bisa langsung Active, task ini akan mematahkannya — itu perilaku yang DIINGINKAN (menutup gap), tapi perlu dicek satu per satu, bukan diabaikan.
- Tidak ada migration baru — seluruh field sudah ada di skema `assets` sejak Fase 1/2.
- `CreateAssetFromPurchase` listener dan `CompleteAssetDataRequest` TIDAK disentuh di task manapun.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "3.1", "3.4", "5.1", "7.1", "7.2"] },
    { "id": 1, "tasks": ["1.3", "3.2", "3.3", "5.2", "7.3"] },
    { "id": 2, "tasks": ["3.5"] },
    { "id": 3, "tasks": ["9.1", "9.2", "9.3", "9.4", "9.5", "9.6", "9.7"] },
    { "id": 4, "tasks": ["9.8"] }
  ]
}
```
