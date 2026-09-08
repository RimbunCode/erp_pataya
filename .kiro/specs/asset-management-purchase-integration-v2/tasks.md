# Implementation Plan: Asset Management Purchase Integration v2

## Overview

Implementasi menambah jalur manual link Asset↔Purchase lewat 3 lapis: (1) model backend — relasi `asset()` balik + `scopeLinkModel()` untuk filter fixed-asset & belum-dikonversi, (2) validasi `AssetRequest` — consistency check Item↔baris↔field derived, plus guard universal di `AssetService::submit()`, (3) frontend — 2 LinkModel React baru + integrasi ke `Form.jsx` Assets dengan derive-on-select. Tidak ada migration baru (semua kolom sudah ada sejak Fase 1/2); tidak menyentuh `CreateAssetFromPurchase` listener maupun `CompleteAssetDataRequest`.

## Tasks

- [x] 1. Backend: Model & Scope Purchase
  - [x] 1.1 Tambah relasi `asset(): HasOne` dan `scopeLinkModel()` di `app/Models/Purchase/PurchaseReceiptItem.php`
    - `asset()`: `hasOne(Asset::class, 'purchase_receipt_item_id')`
    - `scopeLinkModel($query, $search)`: filter `whereHas('item.item', fn => where('is_fixed_asset', true))`, `whereDoesntHave('asset')`, search opsional by nama Item
    - Ditambah `templateLink()` (belum ada sebelumnya — wajib untuk endpoint LinkModel generic, gap yang tidak eksplisit di design.md)
    - _Requirements: 1.2, 2.2, 2.3, 2.4_
  - [x] 1.2 Tambah relasi `asset(): HasOne` dan `scopeLinkModel()` setara di `app/Models/Finances/PurchaseInvoiceItem.php`
    - `asset()`: `hasOne(Asset::class, 'purchase_invoice_item_id')`
    - `scopeLinkModel()` + `templateLink()` sama pola dengan 1.1
    - _Requirements: 1.2, 2.2, 2.3, 2.4_
  - [x] 1.3 Write unit tests untuk `scopeLinkModel()` kedua model (Property 1 & 2)
    - `tests/Unit/Purchase/PurchaseReceiptItemScopeTest.php`, `tests/Unit/Finances/PurchaseInvoiceItemScopeTest.php` — 3 test/file, 6 total, semua pass
    - **Validates: Requirements 1.2, 2.2, 2.3, 2.4**

- [x] 2. Checkpoint - Ensure model & scope tests pass
  - 6/6 passed.

- [x] 3. Backend: Validasi `AssetRequest`
  - [x] 3.1 Tambah rules untuk `item_id`, `purchase_receipt_id`, `purchase_invoice_id`, `purchase_receipt_item_id`, `purchase_invoice_item_id` di `app/Http/Requests/Asset/AssetRequest.php::rules()`
    - _Requirements: 4.1_
  - [x] 3.2 Tambah `validateItemIsFixedAsset()` di `AssetRequest`, panggil dari `withValidator()`
    - _Requirements: 4.2_
  - [x] 3.3 Tambah `validatePurchaseLinkConsistency()` di `AssetRequest`, panggil dari `withValidator()`
    - **Revisi dari desain awal**: validasi "asset_quantity/net_purchase_amount/gross_purchase_amount harus sama dengan yang dikirim FE" DIHAPUS — field `rate`/`amount` PurchaseInvoiceItem ter-gate `visibleFor` permission Write/Create Purchase, sehingga user tanpa akses Purchase (target utama fitur ini) tidak bisa menghitung nilai akurat sendiri di FE. Diganti: backend (`AssetService::applyPurchaseLinkOverrides()`, task baru di luar rencana awal) OVERRIDE langsung nilai itu dari baris pembelian, apapun yang dikirim FE. Guard idempoten, kecocokan Item, dan kecocokan PurchaseOrderItem (Receipt↔Invoice) tetap sesuai rencana.
    - _Requirements: 2.6, 2.7, 4.1, 4.2, 4.3_ (4.4 request-value-match direvisi jadi backend-override, lihat design.md)
  - [x] 3.4 Tambah error message keys baru di `lang/id/asset/asset.php` dan `lang/en/asset/asset.php`
    - _Requirements: 4.2, 4.3, 4.5_
  - [x] 3.5 Write feature tests di `tests/Feature/Asset/AssetControllerTest.php`
    - 9 test baru, semua pass: item non-fixed-asset ditolak, baris sudah dipakai ditolak, item mismatch ditolak, quantity/amount di-OVERRIDE (bukan ditolak, sesuai revisi 3.3), PO berbeda ditolak, PO sama diterima
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.5**

- [x] 4. Checkpoint - Ensure AssetRequest validation tests pass
  - Pass (setelah beberapa iterasi fix — lihat laporan bug akhir untuk detail: `PurchaseOrderFactory` eager-execute Supplier, `initPermissions()` runtime schema-patch, `allow_bulk_quantity` vs `is_rentable` field mismatch).

- [x] 5. Backend: Guard kelengkapan pembelian di `AssetService::submit()`
  - [x] 5.1 Tambah pengecekan di `AssetService.php::submit()`
    - _Requirements: 7.1, 7.2, 7.3_
  - [x] 5.2 Write unit tests di `tests/Unit/Asset/AssetServiceSubmitGuardTest.php` (BUKAN feature test HTTP — lihat catatan)
    - **Revisi dari desain awal**: `LogicException` dari `submit()` di-render HTTP 500 (bukan 422 — tidak ada exception mapping ke ValidationException). Pola resmi yang sudah ada di file ini (`submit_rejects_when_category_is_null` dkk) adalah unit test langsung ke `AssetService::submit()` + `expectException()`, BUKAN via `putJson()`. 4 test baru ditambahkan mengikuti pola yang sama, termasuk regresi universal (Asset ala jalur otomatis dengan riwayat pembelian parsial).
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4**

- [x] 6. Checkpoint - Ensure submit guard tests pass
  - Pass.

- [x] 7. Frontend: LinkModel components baru
  - [x] 7.1 Buat `resources/js/Pages/Purchase/PurchaseReceipts/PurchaseReceiptItemLinkModel.jsx`
    - _Requirements: 2.1_
  - [x] 7.2 Buat `resources/js/Pages/Finances/PurchaseInvoice/PurchaseInvoiceItemLinkModel.jsx`
    - _Requirements: 2.1_
  - [x] 7.3 Write component tests `.rtl.test.jsx` untuk kedua LinkModel baru — 7 test, semua pass
    - **Validates: Requirements 2.1**

- [x] 8. Checkpoint - Ensure new LinkModel component tests pass
  - 7/7 passed.

- [x] 9. Frontend: Integrasi `Form.jsx` Assets
  - [x] 9.1 Update field `item_id` — hapus `disabled`, tambah `filters={{ is_fixed_asset: true }}` dan `with={["variants"]}`
    - _Requirements: 1.1, 1.2, 1.3_
  - [x] 9.2 Tambah `FormInput` link Purchase Receipt Item + handler derive
    - _Requirements: 2.1, 2.2, 2.3, 2.5, 3.1_
  - [x] 9.3 Tambah `FormInput` link Purchase Invoice Item + handler derive
    - _Requirements: 2.1, 2.2, 2.3, 2.5, 3.2, 3.5_
  - [x] 9.4 `NumberInput` `asset_quantity` disabled kondisional
    - _Requirements: 3.3_
  - [x] 9.5 `NumberInput` `gross_purchase_amount` disabled kondisional (`net_purchase_amount` tidak punya UI di form ini sejak awal — tidak berubah, backend tetap override-nya via `applyPurchaseLinkOverrides()`)
    - _Requirements: 3.4_
  - [x] 9.6 `useEffect` reset link saat `item_id` berubah tidak match
    - _Requirements: 2.6, 2.8, 3.6, 3.7_
  - [x] 9.7 Update comment & assertion di `Form.rtl.test.jsx`
    - _Requirements: 1.1_
  - [x] 9.8 Test skenario baru di `Form.rtl.test.jsx` — 7 test baru ditambahkan, total file 37/37 pass
    - **Validates: Requirements 1.1, 1.2, 2.5, 2.6, 2.8, 3.1, 3.2, 3.3, 3.4, 3.6, 3.7**

- [x] 10. Final checkpoint - Ensure all tests pass
  - Test spec-specific: 27/27 PHP (AssetControllerTest 20, AssetServiceSubmitGuardTest 7, PurchaseReceiptItemScopeTest 3, PurchaseInvoiceItemScopeTest 3) + 44/44 FE (Form.rtl.test.jsx 37, PurchaseReceiptItemLinkModel.rtl.test.jsx 4, PurchaseInvoiceItemLinkModel.rtl.test.jsx 3) — semua PASS.
  - Full suite BE (tests/Feature + tests/Unit) dan FE (vitest run) dijalankan terpisah sesuai permintaan user — lihat laporan bug akhir untuk hasil & temuan.
  - Lint/Pint belum dijalankan — jalankan setelah full suite selesai dikonfirmasi.

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
