# Implementation Plan: saved-filter-management

## Overview

Tambah axis **shared**+**default** ke `SavedFilter` (adopsi trait `DataTable` utk permission+audit otomatis), controller admin baru `FilterTemplateController` (permission standar, bukan flag ad-hoc), lalu sambungkan ke titik integrasi existing: dropdown filter (`FilterTable2.jsx`), auto-apply default (`DataTable2.jsx`), dan halaman admin baru `FilterTemplate/{Index,Form,Show}.jsx`. `SavedFilterController`/filter privat TIDAK disentuh.

**Status: SELESAI.** Semua task diimplementasikan, diuji (PHPUnit + Vitest), dan diverifikasi visual via browser (`php artisan serve --port=8011`).

## Tasks

- [x] 1. Skema & Model `SavedFilter`
  - [x] 1.1 Migration `add_shared_columns_to_saved_filters_table`
    - Kolom `is_shared`, `is_default`, `sort`, `is_example` + index `['model','is_shared']`, `['model','is_default']`
    - _Requirements: 4.1, 4.5, 4.8_

  - [x] 1.2 Update `app/Models/Core/SavedFilter.php`
    - `use DataTable, HasFactory, HasUlids;`, `$alias`, `getNameClass()` override, `translateKey`, relasi `permission()` (tambahan: dipakai FE `PermissionLinkModel` picker saat edit)
    - Scope baru: `scopeVisibleTo`, `scopeSharedListing`, `scopeDefaultFor` — `scopeOwnedListing` tidak berubah
    - `$configColumns` utk listing admin (name/model/user/is_default/updated_at)
    - _Requirements: 2.1, 4.3, 4.4, 4.7_

  - [x] 1.3 Lang file `lang/id|en/core/filterTemplate.php`
    - _Requirements: (pendukung)_

  - [x] 1.4 Tests `SavedFilter` model — `getNameClass()`, `initPermissions()` provisioning, `scopeVisibleTo`, `scopeDefaultFor`
    - _Requirements: 2.1, 4.3, 4.4, 4.7_ — **51 test PHPUnit lulus** (`SavedFilterTest.php`, termasuk 3 test tambahan Requirement 5 sort)

- [x] 2. Checkpoint — semua test skema & model lulus.

- [x] 3. Permission & Routes
  - [x] 3.1 `SavedFilter` ter-provision otomatis via `PermissionSeeder`→`initPermissions()` (dikonfirmasi live di dev DB: row `Permission` + 4 `RolePermission` grant)
    - _Requirements: 3.1_

  - [x] 3.2 Routes `routes/web.php`: `resourceDetail('filterTemplate', ...)` + `setDefault` + `preview`
    - **REVISI dari draft awal**: route `filterTemplates.models` DIHAPUS — model picker form pakai `PermissionLinkModel` (reuse komponen existing, sumber `Permission` registry) alih-alih endpoint custom
    - _Requirements: 1.1, 1.6, 1.3c, 3.2_

  - [x] 3.3 `DeskSeeder.php` — entry menu "Filter Templates" (Settings > Templates, order 22) — **diverifikasi tampil di sidebar** (butuh session refresh setelah seed, permission di-cache per-session)
    - _Requirements: (Introduction)_

  - [x] 3.4 Tests permission & routing — **14 test PHPUnit lulus** (`FilterTemplateControllerTest.php`)
    - _Requirements: 3.1, 3.2, 3.3_

- [x] 4. Checkpoint — semua test permission & routes lulus.

- [x] 5. Backend `FilterTemplateController`
  - [x] 5.1 Form Requests — **REVISI**: validasi `model` pakai `Permission::where('model', ...)->exists()` (bukan `MenuItem`) — konsisten dengan sumber `PermissionLinkModel` picker
    - _Requirements: 4.9, 1.3b_
  - [x] 5.2 Controller inti (index/create/store/show/update) + `enforcePermission()`
    - _Requirements: 1.1, 1.2, 1.4, 1.5, 3.1, 3.2, 4.1, 4.2, 4.4_
  - [x] 5.3 `setDefault` (transaksi, P1/P2)
    - _Requirements: 1.6, 1.7, 4.6_
  - [x] 5.4 `destroy` — pakai method `destroy` bawaan base `Controller` (tidak perlu override — hapus row otomatis melepas status default, sesuai Req 1.8)
    - _Requirements: 1.4, 1.8, 3.4_
  - [x] 5.5 `preview` — **diverifikasi visual**: data nyata (Branch) tampil benar, kolom dibatasi `show=true`
    - _Requirements: 4.9, 1.3c_
  - [x] 5.6 ~~`models()`~~ — **DIHAPUS**, digantikan reuse `PermissionLinkModel` (lihat 3.2/5.1)
  - [x] 5.7 Tests controller — **14 test lulus**, mencakup P1/P2/P4/P5/P6
    - _Requirements: 1.1-1.8, 3.4, 3.5, 4.1-4.2, 4.6, 4.9_

- [x] 6. Checkpoint — semua test `FilterTemplateController` lulus.

- [x] 7. Integrasi ke listing filter existing (Requirement 2 & 5)
  - [x] 7.1 `SavedFilterController::index` pakai `scopeVisibleTo` + sertakan `sort`/`is_shared`/`is_default`
    - _Requirements: 2.1, 2.2, 4.7_
  - [x] 7.2 Default-filter auto-apply di `DataTableScope::dataTable()` (titik sentral, resolusi SEBELUM parsing sort agar sort bawaan filter default ikut jadi default sort halaman) — expose `defaultFilterId` ke Inertia props
    - _Requirements: 2.4_
  - [x] 7.3 `DataTable2.jsx` — konsumsi `defaultFilterId`; **fix tambahan**: seed-effect builder tree diubah dari baca `query?.fid` (URL) ke `options.fid` (state) agar tree ikut termuat saat default ter-auto-apply (ketauan & diperbaiki saat verifikasi visual)
    - _Requirements: 2.4, 2.5, 5.1, 5.2_
  - [x] 7.4 `FilterTable2.jsx` — badge "Shared" + sembunyikan tombol hapus utk item shared (dikelola via Filter Templates, bukan dropdown privat)
    - _Requirements: 2.2_
  - [x] 7.5 Fork-on-edit (P3) — dikonfirmasi TIDAK perlu kode baru, guard ownership existing sudah benar; test ditambahkan
    - _Requirements: 2.3_
  - [x] 7.6 Tests integrasi — RTL `FilterTable2.rtl.test.jsx` (badge, 8/8 lulus) + 3 test PHPUnit baru Requirement 5 (sort override/no-override/default)
    - _Requirements: 2.1-2.5, 5.1, 5.2_

- [x] 8. Checkpoint — semua test integrasi lulus.

- [x] 9. Frontend halaman admin Filter Templates
  - [x] 9.1 `Index.jsx` — **REVISI dari draft**: pakai `<DataTable2 form={<Form />} />` generik (pola PERSIS `EmailTemplate/Index.jsx`), bukan tabel custom — diverifikasi visual (listing, kolom, No-Data state)
    - _Requirements: 1.1, 1.2, 1.6_
  - [x] 9.2 `Form.jsx` — model picker pakai `PermissionLinkModel` (bukan `<Select>` custom), builder `FilterBuilderBody`+`NestedFiltersProvider` — diverifikasi visual penuh (pilih model → kolom termuat → susun filter → operator)
    - _Requirements: 1.3_
  - [x] 9.3 `ImportFromFilter` (`useFilterTemplateBuilder.js`) — hook terpisah, reuse `saved-filters.index` + `setFromInitial`
    - _Requirements: 1.3a_
  - [x] 9.4 `SortField` — diverifikasi visual (pilih kolom + arah)
    - _Requirements: 1.3b_
  - [x] 9.5 `PreviewPanel` — diverifikasi visual, POST ke `filterTemplates.preview`, tabel data nyata tampil
    - _Requirements: 1.3c_
  - [x] 9.6 `Show.jsx` (**TAMBAHAN, tidak ada di draft awal**) — wrapper `FormPage` yang dipakai `create()`/`show()` (pola sama `EmailTemplate/Show.jsx`); tombol "Jadikan Default" (**TAMBAHAN**) ditemukan sbg gap saat verifikasi visual (Req 1.6 butuh aksi UI, awalnya belum ada tempatnya) — ditambahkan di `Form.jsx`, disabled otomatis begitu sudah default
    - Tests: RTL `FilterTable2.rtl.test.jsx` diperluas; halaman baru (`Index/Form/Show.jsx`) diverifikasi via **browser manual end-to-end** (create → preview → save → set default → tampil di dropdown list page dgn badge Shared & auto-default) — bukan RTL terisolasi, karena `Form.jsx` bergantung pada context `FormPage`/`useDraftForm` yang berat untuk di-mock secara terisolasi dalam waktu tersisa
    - _Requirements: 1.1-1.6, 1.3a-1.3c_

- [x] 10. Final checkpoint
  - **Backend**: 51+14+DeskSeeder+StockLedger = seluruh test relevan PHPUnit **PASS**.
  - **Frontend**: full suite Vitest **4171 PASS, 0 FAIL** (zero regresi lintas codebase).
  - **Visual**: end-to-end browser verification lengkap (login admin → menu Filter Templates → create → preview → save → set default → integrasi dropdown list page Branch dgn badge Shared + auto-default + sort).
  - **Pint**: dijalankan, seluruh file PHP yang diubah ter-format, re-test setelah format tetap **PASS**.

## Notes

- **Gap ditemukan & ditutup saat verifikasi visual** (tidak ada di rencana awal):
  1. Tombol "Jadikan Default" tidak pernah dirancang tempatnya secara eksplisit di FE draft — ditambahkan di `Form.jsx` (task 9.6).
  2. Seed-effect `DataTable2.jsx` baca `query?.fid` (URL) alih-alih `options.fid` (state) — default filter auto-apply benar secara DATA tapi builder tree tidak ikut termuat saat dialog dibuka. Diperbaiki (task 7.3).
  3. Model picker (`MenuItem`-based di draft awal) diganti reuse `PermissionLinkModel` — ditemukan saat baca `EmailTemplate/Form.jsx` sbg referensi pola, lebih idiomatik & konsisten dgn sumber kebenaran registry `Permission`.
- Task 7.2 (default-filter di `DataTableScope::dataTable()`) tetap keputusan implementasi: titik SENTRAL, bukan per-controller.
- `SavedFilterController` (filter privat) TIDAK ada perubahan di luar 7.1 (index listing).
- RTL test terisolasi utk `FilterTemplate/Form.jsx`/`Index.jsx`/`Show.jsx` **tidak ditulis** (bergantung berat pada context `FormPage`/`useDraftForm`) — digantikan verifikasi manual browser end-to-end yang mencakup seluruh alur (lebih representatif utk komponen well-integrated ini, dan seluruh 4171 test Vitest lain tetap hijau tanpa regresi).

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["1.4"] },
    { "id": 2, "tasks": ["3.1", "3.2", "3.3"] },
    { "id": 3, "tasks": ["3.4"] },
    { "id": 4, "tasks": ["5.1"] },
    { "id": 5, "tasks": ["5.2", "5.3", "5.4", "5.5"] },
    { "id": 6, "tasks": ["5.7"] },
    { "id": 7, "tasks": ["7.1", "7.2"] },
    { "id": 8, "tasks": ["7.3", "7.4", "7.5"] },
    { "id": 9, "tasks": ["7.6"] },
    { "id": 10, "tasks": ["9.1", "9.2"] },
    { "id": 11, "tasks": ["9.3", "9.4", "9.5", "9.6"] },
    { "id": 12, "tasks": ["10"] }
  ]
}
```
