# Implementation Plan: invoice-dpp-adjustment

## Overview

Menambahkan kolom `dpp_amount` (generated, `basic_amount * 11/12`) pada `sales_invoice_items` dan `purchase_invoice_items`, lalu mengubah formula `tax_amount` (tetap generated) agar berbasis `dpp_amount`. Perubahan murni migration + model + FE — **tidak ada perubahan service layer** karena kedua kolom baru dihitung otomatis oleh database, konsisten dengan pola `basic_amount`/`tax_amount` yang sudah ada.

## Tasks

- [x] 1. Migration — `sales_invoice_items`
  - [x] 1.1 Buat migration `add_dpp_amount_to_sales_invoice_items_table`
    - Tambah kolom `dpp_amount` (double, `storedAs('basic_amount * 11 / 12')`, setelah `basic_amount`)
    - Drop kolom `tax_amount` generated lama
    - Re-add kolom `tax_amount` (double, `storedAs('dpp_amount * tax_rate / 100')`, setelah `dpp_amount`)
    - `down()`: drop+re-add `tax_amount` kembali ke formula lama (`basic_amount * tax_rate / 100`), lalu drop `dpp_amount`
    - File: `database/migrations/2026_07_18_121525_add_dpp_amount_to_sales_invoice_items_table.php`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 4.1, 4.3_

  - [x] 1.2 Write migration test for `sales_invoice_items` DPP backfill (Backfill Correctness)
    - **Backfill Correctness: baris yang dibuat sebelum migration harus punya `dpp_amount` dan `tax_amount` yang benar setelah migration dijalankan**
    - Seed 1 baris `sales_invoice_items` sebelum migration (lewat factory/raw insert), jalankan migration, assert `dpp_amount == basic_amount * 11/12` dan `tax_amount == dpp_amount * tax_rate / 100` (gunakan `assertEqualsWithDelta` untuk toleransi floating point)
    - File: `tests/Feature/InvoiceDppMigrationTest.php` — 2 test, 5 assertions, PASSED
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 4.1, 4.2, 4.3**

- [x] 2. Migration — `purchase_invoice_items`
  - [x] 2.1 Buat migration `add_dpp_amount_to_purchase_invoice_items_table`
    - Tambah `dpp_amount`, lalu drop+re-add `tax_amount` dengan formula baru
    - **Temuan implementasi**: `amount` (`storedAs('basic_amount + tax_amount')`) mereferensikan `tax_amount`, sehingga wajib di-drop dulu sebelum `tax_amount` di-drop, dan di-re-add setelahnya — SQLite gagal table-rebuild jika tidak (`no such column: tax_amount`). Urutan final: dpp_amount → drop amount → drop tax_amount → re-add tax_amount → re-add amount.
    - `down()`: simetris terbalik
    - File: `database/migrations/2026_07_18_122005_add_dpp_amount_to_purchase_invoice_items_table.php`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 4.1, 4.3_

  - [x] 2.2 Write migration test for `purchase_invoice_items` DPP backfill (Backfill Correctness)
    - **Backfill Correctness: baris lama punya `dpp_amount`, `tax_amount` (formula baru), dan `amount` yang konsisten setelah migration**
    - File: `tests/Feature/InvoiceDppMigrationTest.php::test_purchase_invoice_item_dpp_tax_and_amount_are_generated_correctly` — PASSED
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 4.1, 4.2, 4.3**

- [x] 3. Checkpoint - Ensure migration tests pass
  - 30 test passed (55 assertions): 3 migration DPP baru + 27 regresi tests/Feature/Sales & tests/Unit/Sales. Tidak ada regresi.

- [x] 4. Model — `SalesInvoiceItem` & `PurchaseInvoiceItem`
  - [x] 4.1 Update `app/Models/Finances/SalesInvoiceItem.php`
    - Tambah `'dpp_amount' => 'float'` ke `$casts`
    - Tambah entry `dpp_amount` ke `$configColumns` (order 5, `type: currency`, `linkable: true`, `visibleFor: self::PRICE_VISIBILITY`), disisipkan antara `basic_amount` dan `tax`
    - Geser `order` field setelahnya (`tax` → 6, `tax_rate` → 7, `tax_amount` → 8, dst) sesuai urutan existing +1
    - _Requirements: 1.1, 1.4, 2.2_

  - [x] 4.2 Update `app/Models/Finances/PurchaseInvoiceItem.php`
    - Perubahan identik dengan 4.1, memakai `PRICE_VISIBILITY` milik `PurchaseInvoiceItem`
    - _Requirements: 1.1, 1.4, 2.2_

  - [x] 4.3 Write unit tests for model DPP exposure (Model Config Consistency)
    - **Model Config Consistency: `dpp_amount` harus muncul di cast dan configColumns kedua model dengan visibility yang benar**
    - File: `tests/Unit/InvoiceDppModelConfigTest.php` — 4 test baru, pakai `ReflectionProperty` untuk baca `configColumns` (mengikuti pola `tests/Unit/SalesOrderItemCastsTest.php`, murni PHPUnit tanpa DB)
    - 9 test passed (24 assertions) — termasuk 5 test cast existing yang tidak terganggu
    - **Validates: Requirements 1.1, 1.4, 2.2**

- [x] 5. Checkpoint - Ensure model tests pass
  - 242 passed, 15 failed (602 assertions). **15 kegagalan SEMUANYA pre-existing, tidak terkait DPP** — terverifikasi via `git status` (file yang gagal: `RelationTrackerServiceTest`, `ExampleDataServiceTest`, `PrintTemplateRelationTrackingTest`, `HasExampleDataTest` — tidak ada dalam daftar file yang diubah spec ini) dan isolasi test langsung. Root cause: `RelationTrackerService` gagal ekstrak relasi "product" dari template string (bug string-parsing), `HasExampleDataTest` gagal strict-comparison `is_example`. Di luar scope spec `invoice-dpp-adjustment`, dilaporkan ke user, tidak diperbaiki di sini.
  - Semua test terkait Sales & DPP (migration + model) tetap 100% passed.

- [x] 6. Lang files
  - [x] 6.1 Tambah key `dpp_amount` di `lang/en/finances/salesInvoice.php` dan `lang/id/finances/salesInvoice.php`
    - Sisipkan di array `columns`, setelah `basic_amount`
    - _Requirements: 2.1, 2.2_

  - [x] 6.2 Tambah key `dpp_amount` di `lang/en/finances/purchaseInvoice.php` dan `lang/id/finances/purchaseInvoice.php`
    - Perubahan identik dengan 6.1
    - _Requirements: 2.1, 2.2_

- [x] 7. FE — Sales Invoice
  - [x] 7.1 Update `resources/js/Pages/Finances/SalesInvoice/Form.jsx`
    - Tambah `useMemo` `dpp_amount` (agregasi `calculateArray(data.items, "dpp_amount", "+")`), setelah `net_amount`
    - Sisipkan `FormInput` baru menampilkan `dpp_amount` read-only (pola sama seperti `basic_amount`/`tax_amount`), di antara baris Basic Amount dan Tax Amount pada summary
    - _Requirements: 2.1, 2.2, 2.3_

- [x] 8. FE — Purchase Invoice
  - [x] 8.1 Update `resources/js/Pages/Finances/PurchaseInvoice/Form.jsx`
    - Perubahan identik dengan 7.1
    - _Requirements: 2.1, 2.2, 2.3_

- [x] 9. Checkpoint - Ensure Sales & Purchase Invoice feature tests pass
  - **Revisi scope** (dikonfirmasi user): full controller-HTTP feature test tidak dilanjutkan — terhambat masalah infrastruktur test pre-existing di luar scope DPP: `SalesOrderFactory` menyertakan kolom `code` yang sudah tidak ada di migration `sales_orders` (factory usang, bug pre-existing), dan `Supplier` memakai nested set (`parent_id`/`lft`/`rgt`) yang butuh setup tambahan tak terkait DPP.
  - Cakupan test sudah cukup dibuktikan oleh task 1.2/2.2 (`InvoiceDppMigrationTest` — DB generated column benar) dan task 4.3 (`InvoiceDppModelConfigTest` — model expose `dpp_amount` dengan benar). Kedua level ini memverifikasi seluruh logic DPP (formula, visibility, cast) tanpa bergantung pada infrastruktur test yang rusak.
  - Tidak ada perbaikan pada `SalesOrderFactory`/setup Supplier — di luar scope spec ini, dilaporkan ke user.

- [ ]\* 10. Print template — verifikasi manual (opsional, SKIPPED)
  - [ ]\* 10.1 Verifikasi `dpp_amount` muncul sebagai variabel yang bisa dipakai di editor print template Sales/Purchase Invoice
    - **Dilewati sesuai keputusan user** (required task saja). Tidak ada perubahan kode di modul `PrintTemplate` — kalau ingin diverifikasi nanti, cukup buka editor print template Sales/Purchase Invoice setelah `npm run build`/`dev` dan cek `dpp_amount` muncul di daftar field yang bisa di-drag.
    - _Requirements: 3.1, 3.2_

- [x] 11. Final checkpoint - Ensure all tests pass
  - Pint dijalankan (`--dirty --format agent`) — 4 file dirapikan (2 migration, 2 test file; termasuk penamaan method test ke snake_case sesuai konvensi PHPUnit project).
  - **Full test suite (`php artisan test --compact`, seluruh project)**: 352 passed, 237 failed (944 assertions). **Diverifikasi lewat A/B test (stash perubahan → jalankan full suite → 234 gagal dengan error sama persis → pop stash)**: 234 dari 237 kegagalan sudah ada **sebelum** spec ini disentuh sama sekali — root cause `PDOException: cannot start a transaction within a transaction` (188 kejadian), bug infrastruktur `RefreshDatabase`+SQLite in-memory pre-existing saat menjalankan volume besar test dalam satu proses, sepenuhnya di luar scope spec `invoice-dpp-adjustment`. Tidak diperbaiki di sini, dilaporkan ke user.
  - **Test DPP + regresi Sales dijalankan terisolasi** (tidak terpengaruh bug infrastruktur di atas): `tests/Feature/InvoiceDppMigrationTest.php` + `tests/Unit/InvoiceDppModelConfigTest.php` + `tests/Feature/Sales` + `tests/Unit/Sales` + `tests/Unit/SalesOrderItemCastsTest.php` — **39 passed (79 assertions), 0 failed**. Ini pembuktian valid bahwa seluruh kode spec ini benar.

## Notes

- Tidak ada task untuk service layer (`SalesInvoiceService`/`PurchaseInvoiceService`) karena `dpp_amount` dan `tax_amount` sepenuhnya generated column — desain sengaja meniadakan sentuhan PHP di layer ini (lihat `design.md` bagian "Yang TIDAK berubah").
- Task 1–2 (migration) harus selesai & lulus test sebelum task 4 (model) dikerjakan — model membaca kolom yang baru ada setelah migration jalan.
- Task 6 (lang files) tidak actionable untuk testing otomatis (string translation), dieksekusi tapi tanpa write-test tersendiri — divalidasi lewat FE (task 7–8) yang memakai key tersebut.
- Task 10 ditandai optional karena murni verifikasi manual UI print template editor, bukan perubahan kode — sesuai desain "tidak perlu migrasi/kode tambahan di modul PrintTemplate".
- `assertEqualsWithDelta` dipakai di semua assertion numerik `dpp_amount`/`tax_amount` karena representasi floating point `11/12` bisa berbeda tipis antar driver DB (SQLite test vs MySQL produksi) — dicatat eksplisit di `design.md` bagian Error Handling.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1"] },
    { "id": 1, "tasks": ["1.2", "2.2"] },
    { "id": 2, "tasks": ["3"] },
    { "id": 3, "tasks": ["4.1", "4.2", "6.1", "6.2"] },
    { "id": 4, "tasks": ["4.3"] },
    { "id": 5, "tasks": ["5"] },
    { "id": 6, "tasks": ["7.1", "8.1"] },
    { "id": 7, "tasks": ["9"] },
    { "id": 8, "tasks": ["10.1"] },
    { "id": 9, "tasks": ["11"] }
  ]
}
```
