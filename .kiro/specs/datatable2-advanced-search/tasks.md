# Implementation Plan: DataTable2 Advanced Search

## Overview

Bangun dari bawah ke atas: (A) backend dulu — `searchScope`, kolom `saved_filters.group` + validasi, dan resolusi group dari filter aktif di `DataTableScope`; (B) modul fungsi murni FE (`searchChips`, `searchSuggestions`, `resolveSearchColumns`, `filterTreeCompare`) yang diuji unit test tanpa render; (C) komponen host-agnostic di `resources/js/Components/Table/Search/` + penyesuaian kecil `FilterTable2`; (D) integrasi ke `DataTable2` dan form Filter Templates, lalu verifikasi visual.

Yang **tidak** berubah: jalur persist `persistFilterTree` / `SavedFilterController::store()` (ephemeral), `FilterEvaluator`, `FilterTreeCleaner`, `ValueField`, `Table2`, dan pemakaian `FilterTable2` oleh `AdvanceSearchDialog` LinkModel (prop baru semuanya opsional). Adopsi Search Bar di LinkModel = spec terpisah.

## Tasks

- [ ] 1. Backend — `searchScope`
  - [ ] 1.1 Tambah `getSearchScope()` di `app/Traits/DataTable.php`
    - `public static function getSearchScope(): array` → `\property_exists(static::class, 'searchScope') ? static::$searchScope : []`
    - JANGAN deklarasi `$searchScope` di trait (PHP fatal saat model mendeklarasi ulang) — ikuti pola & PHPDoc `getDefaultGroupColumn()` (`DataTable.php:48-62`), sertakan contoh `protected static array $searchScope = ['code', 'customer.name'];`
    - _Requirements: 5.1_

  - [ ] 1.2 Share prop `searchScope` tersanitasi di `DataTableScope::addDataTable()`
    - Sanitasi tiap entri via `(new FilterColumnResolver($dataTableColumns))->resolve($name)`: buang bila `null`, `searchable === false`, atau `type !== 'string'` — diam-diam, tanpa exception
    - Tambah key `'searchScope'` ke `Inertia::share([...])` (`DataTableScope.php:583`)
    - _Requirements: 5.2, 5.3_

  - [ ] 1.3 Write feature tests `tests/Feature/Models/Scopes/DataTableScopeSearchScopeTest.php`
    - **Sanitasi searchScope: hanya kolom string searchable yang ter-resolve yang di-share**
    - Model tanpa `$searchScope` → prop `[]`; kolom valid tetap; kolom tak dikenal, `searchable:false`, non-string dibuang; path relasi bertitik valid (`rel.name`) tetap
    - Pakai model test/anonymous subclass atau model existing + `Inertia` assert (lihat pola `DataTableScopeGroupingTest`)
    - **Validates: Requirements 5.1, 5.2, 5.3, 16.4**

- [ ] 2. Backend — `saved_filters.group` + validasi
  - [ ] 2.1 Migration + model
    - `php artisan make:migration add_group_to_saved_filters_table --no-interaction` → `$table->json('group')->nullable()->after('sort');` (+ `down()` drop)
    - `app/Models/Core/SavedFilter.php`: cast `'group' => 'array'`; configColumns `'group' => ['show' => false]` (pola `sort`)
    - _Requirements: 11.1_

  - [ ] 2.2 Konstanta granularity + aturan validasi bersama
    - `DataTableScope`: `public const GROUP_GRANULARITIES = ['day', 'month', 'quarter', 'half', 'year'];` (padanan FE `DATE_GROUP_GRANULARITIES`, `Table2.jsx:62`); `match` di `dateGroupExpression()` TIDAK diubah
    - `SavedFilter::groupValidationRules(): array` → `group` nullable array; `group.column` `required_with:group` string; `group.granularity` nullable `Rule::in(DataTableScope::GROUP_GRANULARITIES)`; `group.range` nullable numeric `gt:0` (validasi bentuk saja)
    - _Requirements: 11.2_

  - [ ] 2.3 `UpdateSavedFilterRequest` + `SavedFilterController`
    - Request: tambah `sort` nullable string + `...SavedFilter::groupValidationRules()`
    - `update()`: simpan `sort`/`group` bila `$request->has()` (pola `filter`), tetap `abort_if` owner-only; response tambah `sort` & `group`
    - `index()`: tambah `'group'` ke `get([...])`; `store()` & `StoreSavedFilterRequest` TIDAK diubah
    - _Requirements: 11.2, 11.3, 11.4, 11.5_

  - [ ] 2.4 Filter Templates backend
    - `StoreFilterTemplateRequest` & `UpdateFilterTemplateRequest`: `...SavedFilter::groupValidationRules()`
    - `FilterTemplateController::store()`/`update()`: simpan `group` (pola `sort`, `:55` & `:84-86`)
    - _Requirements: 13.2_

  - [ ] 2.5 Write feature tests (perluas `tests/Feature/Core/SavedFilterTest.php` & `FilterTemplateControllerTest.php`)
    - **Persistensi group & sort pada saved filter dan template**
    - `update()` dgn `sort` + `group` valid → tersimpan & ada di response; `group` invalid (granularity asing, range ≤ 0, tanpa `column`) → 422; non-owner → 403; `index()` memuat `group`; `store()` mengabaikan perubahan (regresi); template store/update `group` valid & invalid
    - **Validates: Requirements 11.1–11.5, 13.2, 16.4**

- [ ] 3. Backend — `DataTableScope` menerapkan group dari filter aktif
  - [ ] 3.1 Refactor urutan resolusi group
    - Pindahkan blok resolusi `$appliedFilter` (`DataTableScope.php:347-356`) ke sebelum validasi group (`:295`)
    - Kolom grup: `$request->has('group') ? $request->input('group') : ($appliedFilter?->group['column'] ?? $defaultGroup)` — tetap lewat gate `groupable` + `resolveRelationGroupColumn` existing
    - Granularity/range: param request > `$appliedFilter->group` > default — sesuaikan `resolveGroupBucketExpression()` agar menerima fallback (mis. parameter tambahan), bukan hanya membaca `$request`
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

  - [ ] 3.2 Share group efektif
    - `defaultGroup` = group efektif tanpa param (filter aktif ?? model, sudah lolos gate); tambah `defaultGroupGranularity` & `defaultGroupRange`
    - _Requirements: 12.6_

  - [ ] 3.3 Write feature tests (perluas `tests/Feature/Models/Scopes/DataTableScopeGroupingTest.php`)
    - **Prioritas group: param > filter aktif > default model**
    - Group dari `?fid=` saved filter; dari default shared filter tanpa `fid`; `?group=` kosong menang atas group filter; group filter tak groupable diabaikan; granularity/range fallback dari filter; `groupCounts` konsisten dengan group efektif; prop `defaultGroup*` benar
    - **Validates: Requirements 12.1–12.6, 16.4**

- [ ] 4. Checkpoint - Ensure backend tests pass
  - `php artisan test --compact` untuk file test di 1.3, 2.5, 3.3 + `DataTableScopeDefaultSortTest`, `DataTableScopeSoftDeleteTest`, `AllModelsGroupableConfigTest` (regresi)
  - `php artisan migrate` di DB lokal (dibutuhkan verifikasi visual nanti)
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Frontend — modul fungsi murni
  - [ ] 5.1 Ekstrak `isFilterTreeDirty` ke `resources/js/Components/Table/Filter/filterTreeCompare.js`
    - Pindahkan `collectItems` + `norm` dari `FilterTable2.jsx:217-240` apa adanya; `FilterTable2` memakai fungsi ini (perilaku tidak berubah)
    - _Requirements: 10.5_

  - [ ] 5.2 Write unit tests `filterTreeCompare.test.js`
    - **isFilterTreeDirty urutan-independen**
    - Urutan anak berbeda → tidak dirty; ganti operator / nilai / tambah item kosong → dirty; bentuk `c` dan `children` sama-sama didukung; `FilterTable2.rtl.test.jsx` existing tetap hijau
    - **Validates: Requirements 10.5, 16.1**

  - [ ] 5.3 `resources/js/Components/Table/Search/resolveSearchColumns.js` + `resolveSearchColumns.test.js`
    - `resolveSearchColumns({ searchScope, columns, visibleNames })`: scope tidak kosong → apa adanya; kosong → `visibleNames` ∩ `searchable !== false` ∩ `type === "string"` ∩ level-atas (tanpa `parentCol`)
    - Test: scope menang; fallback menyaring non-string / searchable false / tidak tampil / kolom anak relasi; semua kosong → `[]`
    - _Requirements: 5.4, 5.5, 16.1_

  - [ ] 5.4 `resources/js/Components/Table/Search/searchChips.js`
    - `isSearchGroup(node)`: grup `or`, ≥2 anak, semua leaf `o === "matches"`, `v` identik
    - `treeToChips(tree, columns, t)` → chip `leaf`/`search`/`advanced` sesuai design §5.1 (root `or` >1 anak → satu `advanced`); label nilai: opsi/`parseTrans`, boolean, relasi `convertTemplateLink(record, "")` fallback `name ?? code ?? id`, array join, key mentah bila kolom tak ter-resolve (pakai `resolveColumn` dari `filterValidation.js`)
    - `addLeafChip(tree, { k, o, v })` dgn merge `=`/`in` → satu `in` (dedup; relasi by `.id`); `addSearchChip(tree, text, columns)`; `updateChip(tree, id, patch)`; `removeChip(tree, id)` — semuanya immutable, id node baru pola `createFilterItem`/`createFilterGroup` (`@/Hooks/useNestedFilters`)
    - _Requirements: 2.4, 2.5, 2.6, 2.7, 2.8, 4.1, 4.2, 4.3, 4.5, 4.6, 6.6_

  - [ ] 5.5 Write unit tests `searchChips.test.js`
    - **Pemetaan tree → chip dan operasi chip**
    - Semua baris tabel design §5.1; `isSearchGroup` false untuk anak <2 / operator beda / `v` beda; collapse 1 kolom → chip `leaf` "mengandung"; merge `=`+`=` → `in`, `in`+`=` → `in`, dedup relasi by id; Chip Cari kedua = grup terpisah; frasa multi-kata tidak dipecah; update/remove tidak memutasi input
    - **Validates: Requirements 2.4–2.8, 4.1–4.6, 6.6, 16.1**

  - [ ]\* 5.6 Write property test `searchChips.property.test.js` (fast-check)
    - **Round-trip add/remove leaf**: untuk leaf pada kolom yang belum ada di tree, `removeChip(addLeafChip(tree, x), idBaru)` ekuivalen (`isFilterTreeDirty` false) dengan `tree`
    - Precondition generator selaras persis dengan validasi source (aturan CLAUDE.md)
    - **Validates: Requirements 2.2, 6.6**

  - [ ] 5.7 `resources/js/Components/Table/Search/searchSuggestions.js`
    - `buildSuggestions(text, { columns, searchColumns, savedFilters, groupOptions, t })` → seksi `text`(1) / `saved`(3) / `column`(5) / `value`(5) / `group`(3) berurutan
    - Pencocokan case-insensitive per kata; seksi kolom menyaring `searchable === false`/`hidden`/`ignore`/`isMetaAppendColumn`; seksi nilai dari kolom ber-opsi (`columnHasOptions`) → label `Kolom: Label`; seksi kosong/tanpa sumber tidak dikembalikan; tiap item membawa `match` utk `highlightMatch`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [ ] 5.8 Write unit tests `searchSuggestions.test.js`
    - **Urutan, batas, dan penyaringan 5 seksi saran**
    - Urutan seksi; batas per seksi; cocok per kata & case-insensitive; seksi hilang tanpa `savedFilters`/`groupOptions`/`searchColumns`; kolom hidden/ignore/meta/searchable false tidak muncul; nilai terjemahan ("Selesai") menghasilkan `Status: Selesai`
    - **Validates: Requirements 3.1–3.6, 16.1**

- [ ] 6. Checkpoint - Ensure pure-module unit tests pass
  - `npm run test -- resources/js/Components/Table/Search resources/js/Components/Table/Filter`
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Frontend — penyesuaian `FilterTable2`
  - [ ] 7.1 Prop controlled `open`/`onOpenChange`
    - Bila `open` diberikan → pakai sebagai state AlertDialog; bila controlled tanpa `trigger` → trigger bawaan tidak dirender; tanpa prop → identik dengan sekarang
    - _Requirements: 14.3_

  - [ ] 7.2 Ekspor `SaveFilterControl` + prop `getViewSnapshot`
    - `export function SaveFilterControl`; bila `getViewSnapshot` ada → PATCH "Simpan sebagai baru" (bersama `name`) dan "Timpa" (bersama `filter`) menyertakan `sort` & `group`; tanpa prop → payload sama seperti sekarang
    - _Requirements: 14.4, 11.6_

  - [ ] 7.3 Update `FilterTable2.rtl.test.jsx`
    - **Controlled open & snapshot sort/group**
    - Kasus controlled buka/tutup tanpa trigger; `SaveFilterControl` dgn `getViewSnapshot` mengirim `sort`/`group`; semua kasus lama tetap hijau
    - **Validates: Requirements 14.3, 14.4, 11.6, 16.2**

- [ ] 8. Frontend — komponen Search Bar (`resources/js/Components/Table/Search/`)
  - [ ] 8.1 `ChipEditor.jsx`
    - Popover: leaf → label kolom + `Select` operator (`getOperators`) + `ValueField` + Terapkan/Enter; search → input teks + "Mencari di: …"; group → `SearchableOptionList` + granularity/range
    - _Requirements: 7.1, 7.2, 7.3_

  - [ ] 8.2 `SearchPanel.jsx`
    - Kolom Filter Tersimpan (badge Shared, penanda sumber, hapus hanya non-shared, `SaveFilterControl` "Simpan sebagai baru"/"Timpa" (sumber dirty & bukan shared), Builder lanjutan, Hapus semua filter) + kolom Group by (`SearchableOptionList` "Tidak ada" teratas + granularity/range); desktop `Popover`, mobile `Dialog` bertumpuk
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

  - [ ] 8.3 `SearchBar.jsx` — chip, input, dropdown saran
    - Render chip dari `treeToChips` (+ chip `group`); dropdown cmdk dikontrol `value`/`onValueChange` (item pertama selalu di-highlight, pola `Select.jsx:139-154`); label via `highlightMatch`; fetch `saved-filters.index` lazy saat fokus pertama / saat mount bila `activeFid`; pilih saran → `addSearchChip`/`onPickSaved`/`onGroupChange`/mode value; tanpa import `router`/`usePage`
    - _Requirements: 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 3.7, 3.8, 3.9, 3.10, 3.11, 4.4, 14.1, 14.2, 14.6_

  - [ ] 8.4 `SearchBar.jsx` — mode value, edit chip, keyboard
    - Prefix pill `[Kolom:]`; perilaku per tipe (opsi/boolean inline, string → `matches`, number → `=` + validasi inline, lainnya → `ChipEditor`); klik chip → `ChipEditor`/`onOpenBuilder`/panel; `×` → `removeChip`/`onGroupChange({column:null})`; `Esc`/Backspace kembali ke mode key; Backspace dua tahap hapus chip terakhir
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.7, 7.4, 7.5, 8.1, 8.2_

  - [ ] 8.5 `SearchBar.jsx` — badge sumber, busy state, error
    - `sourceSaved` + dirty (tree via `isFilterTreeDirty`, sort/group via `getViewSnapshot`, `null` di sumber tidak pernah dirty); nama dari daftar `index`; `×` badge → `onTreeChange(null)`; spinner + tolak commit saat Promise `onTreeChange` pending; gagal → input tidak dikosongkan; seksi teks bebas hilang bila kolom pencarian kosong
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 15.1, 15.2, 15.3, 15.4_

  - [ ] 8.6 i18n
    - `lang/id/core/datatable.php` & `lang/en/core/datatable.php`: `core.datatable.search.*` (design §7); `lang/*/core/filterTemplate.php`: `form.group.*`; pakai ulang istilah existing, tanpa "Favorit"
    - _Requirements: 9.6_

  - [ ] 8.7 Write RTL tests `SearchBar.rtl.test.jsx`, `SearchPanel.rtl.test.jsx`, `ChipEditor.rtl.test.jsx`
    - **Interaksi Search Bar end-to-end di level komponen**
    - Ketik + Enter → `onTreeChange` grup OR; pilih kolom → mode value → Enter; saran nilai → merge `in`; Backspace ×2 hapus chip; klik chip → editor → Terapkan; pilih saved → `onPickSaved`; badge sumber + titik dirty; Promise pending → spinner & commit ditolak; reject → input tetap; ketik `/` tidak di-`preventDefault`; `<mark>` pada label; panel: hapus hanya non-shared, Builder lanjutan, Hapus semua, Group + granularity; editor: ganti operator → `ValueField` menyesuaikan
    - Tanpa `vi.useFakeTimers()` (macet dgn Radix/cmdk); `waitFor` dari `@testing-library/react`
    - **Validates: Requirements 1.4, 1.5, 2–4, 6–10, 15, 16.2, 16.3**

- [ ] 9. Checkpoint - Ensure component tests pass
  - `npm run test -- resources/js/Components/Table`
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Frontend — integrasi `DataTable2`
  - [ ] 10.1 Tata letak toolbar
    - Hapus dari toolbar desktop: `FilterTable2` + tombol `X`, Popover Group by, Select granularity/range; baris judul = judul + Reload + Tambah
    - Baris baru `[SearchBar ▾] [Sort]` di antara header & kartu tabel (Sort = tombol arah + Popover kolom existing, dipindah); mobile: baris full-width, Sort ikon, menu ⋯ tinggal Reload + Tampilkan per halaman
    - `FilterTable2` dirender tanpa trigger, dikontrol state `builderOpen`
    - _Requirements: 1.1, 1.2, 1.6_

  - [ ] 10.2 Handler & state host
    - `onTreeChange` → `persistFilterTree`; `onPickSaved` → tree + fid + sort + group sekaligus tanpa POST (`null` = jangan override); `onGroupChange` membungkus `setGroup`/`setGroupGranularity`/`setGroupRange`; `getViewSnapshot`; `getSearchColumns` → `resolveSearchColumns({ searchScope, columns: mapColumns, visibleNames: createHeaders({ ...mapColumns }).filter(h => h.show).map(h => h.name) })`
    - State awal `options.group/groupGranularity/groupRange` dari `defaultGroup`/`defaultGroupGranularity`/`defaultGroupRange`
    - _Requirements: 5.6, 11.7, 12.6, 2.2_

  - [ ] 10.3 Update `resources/js/Pages/Core/DataTable2.rtl.test.jsx`
    - **Toolbar baru & integrasi host**
    - Sesuaikan test toolbar lama (Filter/Group pindah ke panel); tombol Filter/Group tidak lagi di toolbar; Search Bar & Sort satu baris; `onPickSaved` menerapkan sort + group; `getSearchColumns` fallback memakai kolom tampil tanpa memutasi `mapColumns`; klik sel `addFilter` muncul sebagai chip
    - **Validates: Requirements 1.1, 1.2, 1.6, 5.6, 11.7, 12.6, 16.2**

- [ ] 11. Frontend — form Filter Templates
  - [ ] 11.1 Field Group by di `resources/js/Pages/Core/FilterTemplate/Form.jsx`
    - Select kolom groupable (+ "Tidak ada") di sebelah Sort; granularity (date/time/datetime) / range (number/currency) kondisional; kirim sebagai `group` `{column, granularity, range}` atau `null`
    - _Requirements: 13.1_

  - [ ] 11.2 Write RTL test `resources/js/Pages/Core/FilterTemplate/Form.rtl.test.jsx`
    - **Field group template**
    - Pilih kolom date → granularity muncul; number → range muncul; "Tidak ada" → payload `group: null`; payload submit berisi `group`
    - **Validates: Requirements 13.1, 16.2**

- [ ] 12. Checkpoint - Ensure full frontend suite pass
  - `npm run test` (semua, termasuk 60+ `Pages/**/Index.rtl.test.jsx` yang me-render DataTable2) — jalankan paralel per batch bila perlu
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 13. Verifikasi visual di browser
  - [ ] 13.1 `php artisan migrate` (bila belum) → `npm run build` (bukan dev server) → buka halaman Index ber-grouping (mis. Sales Order) di browser pane
    - Cek desktop & mobile: layout B, saran 5 seksi + `<mark>`, Chip Cari, mode value per tipe, merge `in`, edit chip, panel, badge sumber + dirty, simpan/timpa dgn sort+group, reload `?fid=` mengembalikan group, Ctrl+K / `/` di luar input tetap membuka palette global
    - _Requirements: 16.5_

- [ ] 14. Final checkpoint - Ensure all tests pass
  - `vendor/bin/pint --dirty --format agent`; lint/format FE sesuai konvensi project (hanya di tahap ini, bukan per task)
  - Full suite BE + FE (paralel per batch); `graphify update .`
  - Ensure all tests pass, ask the user if questions arise.

- [ ]\* 15. Deklarasikan `$searchScope` di model utama
  - Tambah `protected static array $searchScope` pada model list yang paling sering dicari (mis. SalesOrder, PurchaseOrder, PurchaseRequest, Item, Customer, Supplier, DeliveryNote, SalesInvoice, PurchaseInvoice) — kolom kode/nama + nama relasi utama
  - Bukan bagian requirement (fallback kolom tampil sudah memenuhi Requirement 5.5); daftar model & kolom dikonfirmasi user sebelum dikerjakan
  - _Requirements: 5.1_

## Notes

- Setiap task mereferensi requirement spesifik untuk traceability; checkpoint (4, 6, 9, 12, 14) = stop & konfirmasi ke user.
- Pint/lint HANYA di task 14 (aturan CLAUDE.md), bukan per task. Commit per task boleh; `git push` menunggu instruksi eksplisit user.
- Task 3.1 menyentuh jalur panas `DataTableScope` yang dipakai semua halaman list — jalankan juga test regresi sort/soft-delete/adaptive-fetch di checkpoint 4.
- Test FE mengikuti prioritas `docs/frontend.md#testing`: unit fungsi murni (5.x) → RTL (7.3, 8.7, 10.3, 11.2); hindari source-assertion. Suffix `.rtl.test.jsx` wajib untuk test yang me-render.
- Optional: 5.6 (property test) dan 15 (`$searchScope` di model utama) — tanyakan ke user saat mulai implementasi: jalankan required saja atau termasuk optional.
- Delegasi: sesuai CLAUDE.md global, pengerjaan task diserahkan ke subagent Sonnet dengan prompt self-contained (file path + section design + requirement); Opus me-review diff & hasil test sebelum menandai `[x]`.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1", "5.1", "5.3"] },
    { "id": 1, "tasks": ["1.2", "2.2", "5.2", "5.4", "5.7"] },
    { "id": 2, "tasks": ["1.3", "2.3", "2.4", "3.1", "5.5", "5.6", "5.8"] },
    { "id": 3, "tasks": ["2.5", "3.2"] },
    { "id": 4, "tasks": ["3.3"] },
    { "id": 5, "tasks": ["4", "6"] },
    { "id": 6, "tasks": ["7.1", "7.2", "8.1", "8.6"] },
    { "id": 7, "tasks": ["7.3", "8.2", "8.3"] },
    { "id": 8, "tasks": ["8.4"] },
    { "id": 9, "tasks": ["8.5"] },
    { "id": 10, "tasks": ["8.7"] },
    { "id": 11, "tasks": ["9"] },
    { "id": 12, "tasks": ["10.1", "11.1"] },
    { "id": 13, "tasks": ["10.2", "11.2"] },
    { "id": 14, "tasks": ["10.3"] },
    { "id": 15, "tasks": ["12"] },
    { "id": 16, "tasks": ["13.1"] },
    { "id": 17, "tasks": ["14", "15"] }
  ]
}
```
