# Implementation Plan: fix-general-ledger-stock-ledger-show

## Overview

Dua bug dengan root cause identik (route `show` terdaftar tapi controller tidak implement method-nya) diperbaiki dengan pola yang sama persis: tambah `show()` di controller (copy pola `AccountController`/`StockEntryController`), tambah 2 file frontend baru (`Show.jsx` + `Form.jsx`) yang reuse komponen `FormPage` existing dikonfigurasi minimal (read-only, tanpa sidebar/bottombar/tombol mutasi). Backend General Ledger dan Stock Ledger dikerjakan sebagai dua task group paralel (tidak saling bergantung), diikuti frontend masing-masing, lalu lang file. Yang **tidak** berubah: route, `$configColumns`/relasi model, index page kedua modul, komponen generik `FormPage`/`FormInput`/`LinkModel`.

## Tasks

- [x] 1. Backend: `GeneralLedgerController::show()`
  - [x] 1.1 Tambah method `show(GeneralLedger $generalLedger)` di `app/Http/Controllers/Finances/GeneralLedgerController.php`
    - `$this->setBreadcrumbs($generalLedger); $generalLedger->showDetail();`
    - `return Inertia::render('Finances/GeneralLedgers/Show', ['generalLedger' => fn () => tap($generalLedger)->loadRelations()]);` — ikuti pola persis `AccountController::show()` (closure lazy-load)
    - Import `App\Models\Finances\GeneralLedger` (kemungkinan sudah ada dari constructor)
    - _Requirements: 1.1, 1.2, 1.3, 1.5_
  - [x] 1.2 Write feature test for GeneralLedgerController::show() (Permission Enforcement + Relasi Lengkap)
    - **Permission Enforcement: GET /generalLedgers/{id} mengembalikan 403 tanpa permission read pada GeneralLedger, 200 dengan permission read**
    - **Relasi Lengkap: response prop `generalLedger` memuat `account`, `against_account`, `branch` ter-load (bukan lazy/null karena belum di-load)**
    - Test tambahan: pastikan `GeneralLedgerController::index()` tetap 200 (no regression)
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5**
    - File: `tests/Feature/Finances/GeneralLedgerControllerTest.php` (3 test)

- [x] 2. Backend: `StockLedgerController::show()`
  - [x] 2.1 Tambah method `show(StockLedgerEntry $stockLedger)` di `app/Http/Controllers/Inventory/StockLedgerController.php`
    - `$this->setBreadcrumbs($stockLedger); $stockLedger->showDetail();`
    - `return Inertia::render('Inventory/StockLedgers/Show', ['stockLedger' => fn () => tap($stockLedger)->loadRelations()]);`
    - Import `App\Models\Inventory\StockLedgerEntry` (kemungkinan sudah ada dari constructor)
    - _Requirements: 3.1, 3.2, 3.3, 3.5_
  - [x] 2.1b **(tidak direncanakan di design, ditemukan saat 2.2)** Override `getRouteAttribute()` di `app/Models/Inventory/StockLedgerEntry.php` agar mengembalikan `'stockLedgers'`
    - Root cause: nama kelas `StockLedgerEntry` tidak sama dengan nama route resource `stockLedger` (`Route::resourceDetail('stockLedger', ...)`). Attribute `route` bawaan trait `LinkModel::getRouteAttribute()` men-derive dari `Str::plural(camelCase(nama kelas))` = `stockLedgerEntries`, yang tidak match nama route asli — `setBreadcrumbs($stockLedger)` di task 2.1 melempar `RouteNotFoundException: Route [stockLedgerEntries.index] not defined` karena ini bug pre-existing yang baru pernah ter-trigger sekarang (sebelumnya `show()` tidak ada sehingga `setBreadcrumbs()` dengan model instance tidak pernah dipanggil untuk model ini). `GeneralLedger` tidak kena karena nama kelasnya kebetulan sama dengan nama route.
    - Dikonfirmasi ke user sebelum fix (lihat percakapan) — scope kecil (1 model, 1 method override), memperbaiki akar masalah alih-alih workaround.
  - [x] 2.2 Write feature test for StockLedgerController::show() (Permission Enforcement + Relasi Lengkap + Referenceable Null-Safe)
    - **Permission Enforcement: GET /stockLedgers/{id} mengembalikan 403 tanpa permission read pada StockLedgerEntry, 200 dengan permission read**
    - **Relasi Lengkap: response prop `stockLedger` memuat `item`, `unit`, `warehouse`, `referenceable` ter-load**
    - **Referenceable Null-Safe: buat StockLedgerEntry dengan `referenceable_id` mengarah ke row yang sudah dihapus permanen (bukan soft-delete), assert GET /stockLedgers/{id} tetap 200 dan `referenceable` bernilai null di response, bukan 500**
    - Test tambahan: pastikan `StockLedgerController::index()` tetap 200 (no regression)
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**
    - File: `tests/Feature/Inventory/StockLedgerControllerTest.php` (4 test)

- [x] 3. Checkpoint - Ensure backend tests pass
  - Jalankan `php artisan test --compact tests/Feature/Finances/GeneralLedgerControllerTest.php tests/Feature/Inventory/StockLedgerControllerTest.php` — **7 passed (48 assertions)**
  - Catatan lingkungan: package dev `beyondcode/laravel-query-detector` aktif lokal (`APP_DEBUG=true`) dan menginjeksi alert JS palsu-positif saat model dengan 2 relasi ke tabel sama (`account`+`against_account`) di-load, membuat `assertInertia` gagal parse. Tidak berhubungan dengan kode spec ini — dikonfirmasi ke user, dibiarkan (test dijalankan lokal dengan `QUERY_DETECTOR_ENABLED=false`; di CI dengan `APP_DEBUG=false` seharusnya tidak muncul).
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Frontend: halaman detail General Ledger
  - [x] 4.1 Buat `resources/js/Pages/Finances/GeneralLedgers/Show.jsx`
    - `<FormPage isCreate={false} name="generalLedger" disabled deleteable={false} sidebarContent={false} bottombarContent={false}><Form /></FormPage>`
    - Pola import: `FormPage` dari `@/Pages/Core/FormPage`
    - _Requirements: 2.1, 2.3_
  - [x] 4.2 Buat `resources/js/Pages/Finances/GeneralLedgers/Form.jsx`
    - `FormPageContent` dari `@/Pages/Core/FormPage`, `useFormPage()` untuk baca `data`
    - Field: `code` (Input readOnly), `account` (AccountLinkModel dari `../Accounts/AccountLinkModel`, readOnly, disabledAddButton), `against_account` (AccountLinkModel, readOnly, disabledAddButton), `branch` (BranchLinkModel dari `@/Pages/Settings/Branches/BranchLinkModel`, readOnly, disabledAddButton), `debit` & `credit` (NumberInput readOnly decimalScale=2), `created_at` (Input readOnly)
    - Grid layout `grid gap-x-4 gap-y-4 md:grid-cols-2` mengikuti pola `Accounts/Form.jsx`
    - _Requirements: 2.2_
  - [ ] 4.3 Verifikasi manual: klik baris General Ledger dari index (`GeneralLedger.jsx`) mengarah ke halaman detail tanpa error, tidak ada tombol save/delete/submit/print/email tampil
    - _Requirements: 2.4, Correctness Property 1_
    - **Belum diverifikasi** — tidak ada tool browser automation di environment ini (sama seperti presedan `global-log-viewer`). Divalidasi tidak langsung lewat feature test (`test_show_returns_200_with_read_permission_and_loads_relations` membuktikan response Inertia benar dan component name tepat) + tinjauan kode (`disabled`, `deleteable={false}`, `sidebarContent={false}`, `bottombarContent={false}` menghilangkan semua tombol mutasi sesuai `FormPage.jsx`). User disarankan spot-check visual sekali.

- [x] 5. Frontend: halaman detail Stock Ledger
  - [x] 5.1 Buat `resources/js/Pages/Inventory/StockLedgers/Show.jsx`
    - `<FormPage isCreate={false} name="stockLedger" disabled deleteable={false} sidebarContent={false} bottombarContent={false}><Form /></FormPage>`
    - _Requirements: 4.1, 4.3_
  - [x] 5.2 Buat `resources/js/Pages/Inventory/StockLedgers/Form.jsx`
    - Field: `code` (Input readOnly), `item` (ItemVariantLinkModel dari `@/Pages/Inventory/Items/ItemVariantLinkModel`, readOnly, disabledAddButton), `unit` (ItemUnitLinkModel dari `@/Pages/Inventory/Items/ItemUnitLinkModel`, readOnly, disabledAddButton), `warehouse` (WarehouseLinkModel dari `@/Pages/Inventory/Warehouses/WarehouseLinkModel`, readOnly, disabledAddButton), `quantity_change`/`quantity_after_transaction`/`valuation_rate`/`balance_stock_value`/`change_in_stock_value` (NumberInput readOnly decimalScale=2), `referenceable` (LinkModel generik dari `@/Components/LinkModel`, readOnly, disabledAddButton, `customNavigation` seperti pola `amended_from` di `FormPage.jsx:1594-1607` — hanya set jika `data?.referenceable` truthy)
    - Grid layout sama seperti task 4.2
    - _Requirements: 4.2_
  - [ ] 5.3 Verifikasi manual: buka `/stockLedgers/{id}` langsung via URL (belum ada link dari index karena kolom bukan `isLink`) menampilkan detail tanpa error
    - _Requirements: 4.4, Correctness Property 1_
    - **Belum diverifikasi** — sama seperti 4.3, tidak ada tool browser automation. Divalidasi lewat feature test (termasuk skenario `referenceable` null saat dokumen sumber terhapus permanen). User disarankan spot-check visual sekali.

- [x] 6. Lang entries
  - [x] 6.1 Tambah key `code`, `created_at`, `detail` ke `lang/id/finances/generalLedger.php` dan `lang/en/finances/generalLedger.php`
    - `code` → 'Kode' / 'Code', `created_at` → 'Dibuat Pada' / 'Created At', `detail` (top-level, bukan di dalam `columns`) → 'Detail' / 'Detail'
    - _Requirements: 2.2_
  - [x] 6.2 Tambah key `code`, `detail` ke `lang/id/inventory/stockLedger.php` dan `lang/en/inventory/stockLedger.php`
    - `code` (di dalam `columns`) sudah ada sebelumnya, hanya `detail` (top-level) yang ditambahkan → 'Detail' / 'Detail'
    - Catatan: `created_at` tidak ada di `$configColumns` StockLedgerEntry sehingga tidak perlu ditambahkan
    - _Requirements: 4.2_

- [x] 7. Final checkpoint - Ensure all tests pass dan verifikasi browser
  - [x] Jalankan seluruh test suite yang relevan: `php artisan test --compact tests/Feature/Finances/GeneralLedgerControllerTest.php tests/Feature/Inventory/StockLedgerControllerTest.php` — **7 passed (48 assertions)**
  - [x] Jalankan `npm run build` — sukses
  - [ ] Verifikasi manual di browser (klik row GL, buka SL via URL, cek tanpa tombol mutasi) — **belum dilakukan**, tidak ada tool browser automation tersedia di sesi ini. Ditutupi oleh feature test HTTP-layer + tinjauan kode. User disarankan cek sekali secara manual.
  - [x] Verifikasi permission 403 — tercakup di `test_show_returns_403_without_read_permission` (kedua file test)
  - [x] Jalankan `vendor/bin/pint --dirty --format agent` — fix format di 2 file test, re-run test setelahnya tetap 7 passed
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Setiap task mereferensi requirement spesifik untuk traceability ke `requirements.md`.
- Checkpoint (task 3, 7) memastikan validasi inkremental — backend divalidasi penuh sebelum menyentuh frontend.
- Task 1 dan 2 independen satu sama lain (bisa dikerjakan dalam urutan apa pun atau paralel) karena menyentuh controller dan model yang sama sekali berbeda.
- Task 4 dan 5 juga independen satu sama lain, sama-sama bergantung pada checkpoint task 3 (backend harus solid dulu).
- Tidak ada task migrasi database — spec ini tidak mengubah schema.
- Tidak ada task perubahan `routes/web.php` — route `show` sudah terdaftar via `resourceDetail` macro sebelum spec ini dibuat.
- Verifikasi manual browser (task 4.3, 5.3, 7) mengikuti presedan spec `global-log-viewer`: jika tidak ada tool browser automation tersedia saat implementasi, catat eksplisit di task sebagai belum diverifikasi + alasan, jangan tandai `[x]` untuk sub-item itu.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1"] },
    { "id": 1, "tasks": ["1.2", "2.2"] },
    { "id": 2, "tasks": ["3"] },
    { "id": 3, "tasks": ["4.1", "5.1"] },
    { "id": 4, "tasks": ["4.2", "5.2"] },
    { "id": 5, "tasks": ["4.3", "5.3", "6.1", "6.2"] },
    { "id": 6, "tasks": ["7"] }
  ]
}
```
