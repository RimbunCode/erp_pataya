# Implementation Plan: DataTable Adaptive Column & Relation Fetching

## Overview

Inti perubahan: service baru `DataTableColumnSelector` yang memetakan kolom visible (dari cookie)
→ `{select, with, fallbackAll}`, lalu diintegrasikan ke `DataTableScope::dataTable()` menggantikan
`SELECT *` + eager-load semua relasi. Reuse `FilterColumnResolver` (commit `7ff3a1e`) untuk resolusi
`dependsOn` ber-dot. Frontend `Table2`/`Table` diselaraskan (cookie key polos + prop `persistColumns`).
Sort/saved-filter/pagination/submitable **tidak** diubah perilakunya — hanya dipastikan tetap jalan.

## Tasks

- [x] 1. Service `DataTableColumnSelector` (inti resolusi)
  - [x] 1.1 Buat skeleton service + kontrak
    - Buat `app/Services/Core/DataTableColumnSelector.php`
    - Konstruktor `__construct(private FilterColumnResolver $resolver)`
    - Method `resolve(array $dataTableColumns, Model $model, ?array $visibleKeys, array $extraKeys = []): array`
      mengembalikan `['select' => [...], 'with' => [...], 'fallbackAll' => bool]`
    - _Requirements: 1.6, 2.1_

  - [x] 1.2 Resolusi visibleKeys + SELECT kolom skalar + PK
    - visibleKeys null/[] → kolom `($col['show'] ?? true) !== false` dari `dataTableColumns`
    - Normalisasi key ber-dot → segmen pertama; buang key tak dikenal `dataTableColumns`
    - Push PK (`$model->getKeyName()`); push kolom skalar visible (`string|number|integer|float|date|datetime|boolean|json`)
    - Gabungkan `extraKeys` (kolom sort lokal) ke SELECT, tanpa menambah `with`
    - _Requirements: 1.1, 1.2, 1.3, 1.6, 5.1_

  - [x] 1.3 Resolusi relasi visible + FK
    - Relasi visible (`type` relation/relations) → push `nameOfFunction` ke `with`
    - BelongsTo (`typeRelation basic`) → resolve FK live `$model->{fn}()->getForeignKeyName()` ke `select`
    - Morph-to → push `getForeignKeyName()` + `getMorphType()` ke `select`
    - HasOne/HasMany/Morph*Many → tak ada FK tambahan
    - Pastikan relasi yang hanya dipakai filter/sort TIDAK masuk `with`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.6_

  - [x] 1.4 Append `dependsOn` (select presisi) + guard
    - Append visible + `dependsOn`: entri non-dot → SELECT kolom lokal; entri ber-dot → resolusi via
      `FilterColumnResolver::resolvePath` (relasi ke `with` + FK ke `select`)
    - Append visible tanpa `dependsOn`: `! app()->isProduction()` → throw `RuntimeException`;
      produksi → `Log::warning` + `fallbackAll = true`
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 1.5 Fallback aman
    - `fallbackAll = true` bila: append tanpa `dependsOn` di produksi; SELECT efektif hanya PK padahal
      ada kolom non-relasi yang seharusnya tampil; decode anomali
    - `with` tetap di-prune walau `fallbackAll = true`
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 1.6 Write unit tests `DataTableColumnSelectorTest`
    - **Cookie kosong → SELECT kolom show:true, fallbackAll=false**
    - **Subset skalar → SELECT subset + PK; with kosong**
    - **BelongsTo visible → FK di select, nameOfFunction di with**
    - **Morph visible → `*_type` + `*_id` di select**
    - **HasMany visible → with berisi relasi, tanpa FK tambahan**
    - **dependsOn lokal → kolom sumber di select; dependsOn relasi → with + FK**
    - **Append tanpa dependsOn → throw (non-prod) / fallbackAll+log (prod-fake)**
    - **extraKeys sort lokal → di select, tak menambah with**
    - File: `tests/Unit/Services/Core/DataTableColumnSelectorTest.php`
    - **Validates: Requirements 1.1–1.3, 1.6, 2.1–2.4, 2.6, 3.1–3.4, 4.1–4.3, 5.1**

- [x] 2. Checkpoint - Ensure `DataTableColumnSelector` unit tests pass
  - 11 passed (28 assertions).

- [x] 3. Integrasi `DataTableScope`
  - [x] 3.1 Baca cookie standar Laravel + susun visibleKeys & extraKeys
    - Ganti `array_column(json_decode($_COOKIE['datatable_columns'] ...))` →
      `$request->cookie('datatable_columns')`, decode, `array_keys`
    - extraKeys = kolom sort lokal non-visible (sortKeyRaw tanpa prefix tabel)
    - _Requirements: 1.4, 1.5, 5.1_

  - [x] 3.2 Terapkan select + with dari selector
    - Ganti `$query->addSelect("$nameOfTable.*")` → kualifikasi hasil `resolve()['select']`,
      atau `$nameOfTable.*` bila `fallbackAll`
    - Ganti pembangunan `$relations` → `with` dari selector; merge `?with`; dedup
    - **Koreksi**: `with` default hanya relasi **singular** (`type=='relation'`), meniru perilaku lama;
      plural (`relations`) tidak auto-with (cegah regresi eager-load morphMany `files`)
    - _Requirements: 1.1, 2.1, 2.5, 4.1, 4.2_

  - [x] 3.3 Jaga kompatibilitas alur eksisting
    - Urutan: selektor sebelum blok `fid`; `expandColumnsForTree` tetap menimpa `$dataTableColumns`
      (transport) setelah query, tanpa pengaruh select/with — utuh
    - pagination, `?id`, `FilterEvaluator` (whereHas), submitable, `Inertia::share` utuh
    - _Requirements: 5.2, 5.3, 5.4_

- [x] 4. Checkpoint - Ensure backend integration intact
  - SavedFilterTest + FilterEvaluatorTest + selektor unit: 59 passed (145 assertions).

- [x] 5. Frontend carrier cookie + reusability
  - [x] 5.1 Cookie key polos + path "/" (Table2)
    - `createHeaders` baca `getCookieByName(DATATABLE_COLUMNS_KEY)` (hapus `_${pathname}`) + hardening `|| "null"`
    - effect tulis `setCookie(DATATABLE_COLUMNS_KEY, ..., { path: "/" })`
    - `onReset` `removeCookie(DATATABLE_COLUMNS_KEY, "/")` (hanya bila tak skip)
    - File: `resources/js/Components/Table/Table2.jsx`
    - **Catatan**: `Table.jsx` (V1) pakai localStorage key polos — tak ke backend, tak diubah
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 5.2 Prop `persistColumns` + kondisi skip cookie
    - Tambah prop `persistColumns = true`
    - `const skipCookie = isDynamicData || !persistColumns;` dipakai di createHeaders (read),
      effect (write), onReset
    - Empty-state & sumber data tetap dikendalikan `isDynamicData` saja
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [x]* 5.3 Verifikasi `reload(val)` dipanggil dgn kolom terbaru saat apply
    - `ColumnsFilter.onApply` → `setColumns(val)` → `reload?.(val)` tetap utuh (`:689-693`)
    - _Requirements: 7.5_

  - [x] 5.4 Verifikasi `bootstrap/app.php` exclude encrypt `datatable_columns`
    - `:38` `encryptCookies(except: ['theme','datatable_show','datatable_columns'])` — terverifikasi
    - _Requirements: 6.4_

- [x] 6. Migrasi append `dependsOn` pada model
  - [x] 6.1 Inventaris append visible per model
    - ~18 model punya `$appends`. Yang jelas visible (`show:true`/isLink) + accessor baca kolom DB:
      SalesOrder.rent_date, Customer.address, Supplier.address, Warehouse.title, Account.code.
    - Sisa append banyak tak visible / baca relasi-morph (Log.code, PrintTemplate.title, Permission.translateKey,
      Attribute.options, File.fullname, Branch.title/addresses, WorkOrder.for_internal, SalesInvoice.is_return,
      dll) — **follow-up**: ditangani reaktif lewat safety-net throw (non-prod) saat index model dibuka.
    - _Requirements: 3.1_

  - [x] 6.2 Tambah `dependsOn` ke config append visible yang teridentifikasi
    - SalesOrder.rent_date → `['start_date','end_date']`
    - Customer.address & Supplier.address → `['street','city','province','zip_code','country.name']`
    - Warehouse.title → `['code','branch.code']`
    - Account.code → `['account_number','account_name']`
    - _Requirements: 3.1, 3.2_

- [x] 7. Feature test end-to-end
  - [x] 7.1 Feature test prune select + with
    - `DataTableAdaptiveFetchTest`: cookie name-only → `SELECT id,name`, customer tak ter-load;
      cookie+customer → FK ikut + relasi loaded; no-cookie → fallback show:true
    - File: `tests/Feature/Services/Core/DataTableAdaptiveFetchTest.php`
    - **Validates: Requirements 1.1, 2.1, 4.4**

  - [x] 7.2 Feature test interaksi sort & filter
    - Sort kolom lokal non-visible (`-description`) → orderBy valid (test di file sama)
    - Interaksi filter `fid` + with: dicakup `SavedFilterTest` (relasi filter tetap whereHas; lihat checkpoint 4)
    - **Validates: Requirements 2.6, 5.1, 5.2, 5.3**

- [x] 8. Final checkpoint - Ensure all tests pass + Pint
  - Full suite terkait: 71 passed (167 assertions).
  - `vendor/bin/pint --dirty --format agent`: fixed (formatting) DataTableColumnSelector + DataTableAdaptiveFetchTest.

## Notes

- Setiap task mereferensi requirement untuk traceability.
- **`with` hanya untuk kolom relasi VISIBLE** — relasi yang hanya difilter (`whereHas`) atau disort
  tidak ditambahkan ke `with`. Ini keputusan kunci (R2.6, R5.3).
- **Lint/Pint hanya di task 8** (akhir), bukan per task — sesuai aturan proyek.
- Task `6` (migrasi append) bisa membesar tergantung jumlah append visible; 6.1 menentukan cakupan.
- `5.3` optional (verifikasi perilaku eksisting, bukan perubahan).
- Tabel anak relasi tetap `SELECT *` (Non-Goal); nested relation tak di-prune.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.4", "1.5"] },
    { "id": 2, "tasks": ["1.6"] },
    { "id": 3, "tasks": ["2"] },
    { "id": 4, "tasks": ["3.1", "3.2", "3.3"] },
    { "id": 5, "tasks": ["4"] },
    { "id": 6, "tasks": ["5.1", "5.2", "5.3", "5.4", "6.1"] },
    { "id": 7, "tasks": ["6.2"] },
    { "id": 8, "tasks": ["7.1", "7.2"] },
    { "id": 9, "tasks": ["8"] }
  ]
}
```
