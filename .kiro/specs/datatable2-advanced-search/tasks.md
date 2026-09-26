# Implementation Plan: DataTable2 Advanced Search

## Overview

Bangun dari bawah ke atas: (A) backend dulu — `searchScope`, kolom `saved_filters.group` + validasi, dan resolusi group dari filter aktif di `DataTableScope`; (B) modul fungsi murni FE (`searchChips`, `searchSuggestions`, `resolveSearchColumns`, `filterTreeCompare`) yang diuji unit test tanpa render; (C) komponen host-agnostic di `resources/js/Components/Table/Search/` + penyesuaian kecil `FilterTable2`; (D) integrasi ke `DataTable2` dan form Filter Templates, lalu verifikasi visual.

Yang **tidak** berubah: jalur persist `persistFilterTree` / `SavedFilterController::store()` (ephemeral), `FilterEvaluator`, `FilterTreeCleaner`, `ValueField`, `Table2`, dan pemakaian `FilterTable2` oleh `AdvanceSearchDialog` LinkModel (prop baru semuanya opsional). Adopsi Search Bar di LinkModel = spec terpisah.

## Tasks

- [x] 1. Backend — `searchScope`
  - [x] 1.1 Tambah `getSearchScope()` di `app/Traits/DataTable.php`
    - `public static function getSearchScope(): array` → `\property_exists(static::class, 'searchScope') ? static::$searchScope : []`
    - JANGAN deklarasi `$searchScope` di trait (PHP fatal saat model mendeklarasi ulang) — ikuti pola & PHPDoc `getDefaultGroupColumn()` (`DataTable.php:48-62`), sertakan contoh `protected static array $searchScope = ['code', 'customer.name'];`
    - _Requirements: 5.1_

  - [x] 1.2 Share prop `searchScope` tersanitasi di `DataTableScope::addDataTable()`
    - Sanitasi tiap entri via `(new FilterColumnResolver($dataTableColumns))->resolve($name)`: buang bila `null`, `searchable === false`, atau `type !== 'string'` — diam-diam, tanpa exception
    - Tambah key `'searchScope'` ke `Inertia::share([...])` (`DataTableScope.php:583`)
    - _Requirements: 5.2, 5.3_

  - [x] 1.3 Write feature tests `tests/Feature/Models/Scopes/DataTableScopeSearchScopeTest.php`
    - **Sanitasi searchScope: hanya kolom string searchable yang ter-resolve yang di-share**
    - Model tanpa `$searchScope` → prop `[]`; kolom valid tetap; kolom tak dikenal, `searchable:false`, non-string dibuang; path relasi bertitik valid (`rel.name`) tetap
    - Pakai model test/anonymous subclass atau model existing + `Inertia` assert (lihat pola `DataTableScopeGroupingTest`)
    - **Validates: Requirements 5.1, 5.2, 5.3, 16.4**

- [x] 2. Backend — `saved_filters.group` + validasi
  - [x] 2.1 Migration + model
    - `php artisan make:migration add_group_to_saved_filters_table --no-interaction` → `$table->json('group')->nullable()->after('sort');` (+ `down()` drop)
    - `app/Models/Core/SavedFilter.php`: cast `'group' => 'array'`; configColumns `'group' => ['show' => false]` (pola `sort`)
    - _Requirements: 11.1_

  - [x] 2.2 Konstanta granularity + aturan validasi bersama
    - `DataTableScope`: `public const GROUP_GRANULARITIES = ['day', 'month', 'quarter', 'half', 'year'];` (padanan FE `DATE_GROUP_GRANULARITIES`, `Table2.jsx:62`); `match` di `dateGroupExpression()` TIDAK diubah
    - `SavedFilter::groupValidationRules(): array` → `group` nullable array; `group.column` `required_with:group` string; `group.granularity` nullable `Rule::in(DataTableScope::GROUP_GRANULARITIES)`; `group.range` nullable numeric `gt:0` (validasi bentuk saja)
    - _Requirements: 11.2_

  - [x] 2.3 `UpdateSavedFilterRequest` + `SavedFilterController`
    - Request: tambah `sort` nullable string + `...SavedFilter::groupValidationRules()`
    - `update()`: simpan `sort`/`group` bila `$request->has()` (pola `filter`), tetap `abort_if` owner-only; response tambah `sort` & `group`
    - `index()`: tambah `'group'` ke `get([...])`; `store()` & `StoreSavedFilterRequest` TIDAK diubah
    - _Requirements: 11.2, 11.3, 11.4, 11.5_

  - [x] 2.4 Filter Templates backend
    - `StoreFilterTemplateRequest` & `UpdateFilterTemplateRequest`: `...SavedFilter::groupValidationRules()`
    - `FilterTemplateController::store()`/`update()`: simpan `group` (pola `sort`, `:55` & `:84-86`)
    - _Requirements: 13.2_

  - [x] 2.5 Write feature tests (perluas `tests/Feature/Core/SavedFilterTest.php` & `FilterTemplateControllerTest.php`)
    - **Persistensi group & sort pada saved filter dan template**
    - `update()` dgn `sort` + `group` valid → tersimpan & ada di response; `group` invalid (granularity asing, range ≤ 0, tanpa `column`) → 422; non-owner → 403; `index()` memuat `group`; `store()` mengabaikan perubahan (regresi); template store/update `group` valid & invalid
    - **Validates: Requirements 11.1–11.5, 13.2, 16.4**

- [x] 3. Backend — `DataTableScope` menerapkan group dari filter aktif
  - [x] 3.1 Refactor urutan resolusi group
    - Pindahkan blok resolusi `$appliedFilter` (`DataTableScope.php:347-356`) ke sebelum validasi group (`:295`)
    - Kolom grup: `$request->has('group') ? $request->input('group') : ($appliedFilter?->group['column'] ?? $defaultGroup)` — tetap lewat gate `groupable` + `resolveRelationGroupColumn` existing
    - Granularity/range: param request > `$appliedFilter->group` > default — sesuaikan `resolveGroupBucketExpression()` agar menerima fallback (mis. parameter tambahan), bukan hanya membaca `$request`
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

  - [x] 3.2 Share group efektif
    - `defaultGroup` = group efektif tanpa param (filter aktif ?? model, sudah lolos gate); tambah `defaultGroupGranularity` & `defaultGroupRange`
    - _Requirements: 12.6_

  - [x] 3.3 Write feature tests (perluas `tests/Feature/Models/Scopes/DataTableScopeGroupingTest.php`)
    - **Prioritas group: param > filter aktif > default model**
    - Group dari `?fid=` saved filter; dari default shared filter tanpa `fid`; `?group=` kosong menang atas group filter; group filter tak groupable diabaikan; granularity/range fallback dari filter; `groupCounts` konsisten dengan group efektif; prop `defaultGroup*` benar
    - **Validates: Requirements 12.1–12.6, 16.4**

- [x] 4. Checkpoint - Ensure backend tests pass
  - `php artisan test --compact` untuk file test di 1.3, 2.5, 3.3 + `DataTableScopeDefaultSortTest`, `DataTableScopeSoftDeleteTest`, `AllModelsGroupableConfigTest` (regresi)
  - `php artisan migrate` di DB lokal (dibutuhkan verifikasi visual nanti)
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Frontend — modul fungsi murni
  - [x] 5.1 Ekstrak `isFilterTreeDirty` ke `resources/js/Components/Table/Filter/filterTreeCompare.js`
    - Pindahkan `collectItems` + `norm` dari `FilterTable2.jsx:217-240` apa adanya; `FilterTable2` memakai fungsi ini (perilaku tidak berubah)
    - _Requirements: 10.5_

  - [x] 5.2 Write unit tests `filterTreeCompare.test.js`
    - **isFilterTreeDirty urutan-independen**
    - Urutan anak berbeda → tidak dirty; ganti operator / nilai / tambah item kosong → dirty; bentuk `c` dan `children` sama-sama didukung; `FilterTable2.rtl.test.jsx` existing tetap hijau
    - **Validates: Requirements 10.5, 16.1**

  - [x] 5.3 `resources/js/Components/Table/Search/resolveSearchColumns.js` + `resolveSearchColumns.test.js`
    - `resolveSearchColumns({ searchScope, columns, visibleNames })`: scope tidak kosong → apa adanya; kosong → `visibleNames` ∩ `searchable !== false` ∩ `type === "string"` ∩ level-atas (tanpa `parentCol`)
    - Test: scope menang; fallback menyaring non-string / searchable false / tidak tampil / kolom anak relasi; semua kosong → `[]`
    - _Requirements: 5.4, 5.5, 16.1_

  - [x] 5.4 `resources/js/Components/Table/Search/searchChips.js`
    - `isSearchGroup(node)`: grup `or`, ≥2 anak, semua leaf `o === "matches"`, `v` identik
    - `treeToChips(tree, columns, t)` → chip `leaf`/`search`/`advanced` sesuai design §5.1 (root `or` >1 anak → satu `advanced`); label nilai: opsi/`parseTrans`, boolean, relasi `convertTemplateLink(record, "")` fallback `name ?? code ?? id`, array join, key mentah bila kolom tak ter-resolve (pakai `resolveColumn` dari `filterValidation.js`)
    - `addLeafChip(tree, { k, o, v })` dgn merge `=`/`in` → satu `in` (dedup; relasi by `.id`); `addSearchChip(tree, text, columns)`; `updateChip(tree, id, patch)`; `removeChip(tree, id)` — semuanya immutable, id node baru pola `createFilterItem`/`createFilterGroup` (`@/Hooks/useNestedFilters`)
    - _Requirements: 2.4, 2.5, 2.6, 2.7, 2.8, 4.1, 4.2, 4.3, 4.5, 4.6, 6.6_

  - [x] 5.5 Write unit tests `searchChips.test.js`
    - **Pemetaan tree → chip dan operasi chip**
    - Semua baris tabel design §5.1; `isSearchGroup` false untuk anak <2 / operator beda / `v` beda; collapse 1 kolom → chip `leaf` "mengandung"; merge `=`+`=` → `in`, `in`+`=` → `in`, dedup relasi by id; Chip Cari kedua = grup terpisah; frasa multi-kata tidak dipecah; update/remove tidak memutasi input
    - **Validates: Requirements 2.4–2.8, 4.1–4.6, 6.6, 16.1**

  - [x]\* 5.6 Write property test `searchChips.property.test.js` (fast-check)
    - **Round-trip add/remove leaf**: untuk leaf pada kolom yang belum ada di tree, `removeChip(addLeafChip(tree, x), idBaru)` ekuivalen (`isFilterTreeDirty` false) dengan `tree`
    - Precondition generator selaras persis dengan validasi source (aturan CLAUDE.md)
    - **Validates: Requirements 2.2, 6.6**

  - [x] 5.7 `resources/js/Components/Table/Search/searchSuggestions.js`
    - `buildSuggestions(text, { columns, searchColumns, savedFilters, groupOptions, t })` → seksi `text`(1) / `saved`(3) / `column`(5) / `value`(5) / `group`(3) berurutan
    - Pencocokan case-insensitive per kata; seksi kolom menyaring `searchable === false`/`hidden`/`ignore`/`isMetaAppendColumn`; seksi nilai dari kolom ber-opsi (`columnHasOptions`) → label `Kolom: Label`; seksi kosong/tanpa sumber tidak dikembalikan; tiap item membawa `match` utk `highlightMatch`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [x] 5.8 Write unit tests `searchSuggestions.test.js`
    - **Urutan, batas, dan penyaringan 5 seksi saran**
    - Urutan seksi; batas per seksi; cocok per kata & case-insensitive; seksi hilang tanpa `savedFilters`/`groupOptions`/`searchColumns`; kolom hidden/ignore/meta/searchable false tidak muncul; nilai terjemahan ("Selesai") menghasilkan `Status: Selesai`
    - **Validates: Requirements 3.1–3.6, 16.1**

- [x] 6. Checkpoint - Ensure pure-module unit tests pass
  - `npm run test -- resources/js/Components/Table/Search resources/js/Components/Table/Filter`
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Frontend — penyesuaian `FilterTable2`
  - [x] 7.1 Prop controlled `open`/`onOpenChange`
    - Bila `open` diberikan → pakai sebagai state AlertDialog; bila controlled tanpa `trigger` → trigger bawaan tidak dirender; tanpa prop → identik dengan sekarang
    - _Requirements: 14.3_

  - [x] 7.2 Ekspor `SaveFilterControl` + prop `getViewSnapshot`
    - `export function SaveFilterControl`; bila `getViewSnapshot` ada → PATCH "Simpan sebagai baru" (bersama `name`) dan "Timpa" (bersama `filter`) menyertakan `sort` & `group`; tanpa prop → payload sama seperti sekarang
    - _Requirements: 14.4, 11.6_

  - [x] 7.3 Update `FilterTable2.rtl.test.jsx`
    - **Controlled open & snapshot sort/group**
    - Kasus controlled buka/tutup tanpa trigger; `SaveFilterControl` dgn `getViewSnapshot` mengirim `sort`/`group`; semua kasus lama tetap hijau
    - **Validates: Requirements 14.3, 14.4, 11.6, 16.2**

- [x] 8. Frontend — komponen Search Bar (`resources/js/Components/Table/Search/`)
  - [x] 8.1 `ChipEditor.jsx`
    - Popover: leaf → label kolom + `Select` operator (`getOperators`) + `ValueField` + Terapkan/Enter; search → input teks + "Mencari di: …"; group → `SearchableOptionList` + granularity/range
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 8.2 `SearchPanel.jsx`
    - Kolom Filter Tersimpan (badge Shared, penanda sumber, hapus hanya non-shared, `SaveFilterControl` "Simpan sebagai baru"/"Timpa" (sumber dirty & bukan shared), Builder lanjutan, Hapus semua filter) + kolom Group by (`SearchableOptionList` "Tidak ada" teratas + granularity/range); desktop `Popover`, mobile `Dialog` bertumpuk
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

  - [x] 8.3 `SearchBar.jsx` — chip, input, dropdown saran
    - Render chip dari `treeToChips` (+ chip `group`); dropdown cmdk dikontrol `value`/`onValueChange` (item pertama selalu di-highlight, pola `Select.jsx:139-154`); label via `highlightMatch`; fetch `saved-filters.index` lazy saat fokus pertama / saat mount bila `activeFid`; pilih saran → `addSearchChip`/`onPickSaved`/`onGroupChange`/mode value; tanpa import `router`/`usePage`
    - _Requirements: 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 3.7, 3.8, 3.9, 3.10, 3.11, 4.4, 14.1, 14.2, 14.6_

  - [x] 8.4 `SearchBar.jsx` — mode value, edit chip, keyboard
    - Prefix pill `[Kolom:]`; perilaku per tipe (opsi/boolean inline, string → `matches`, number → `=` + validasi inline, lainnya → `ChipEditor`); klik chip → `ChipEditor`/`onOpenBuilder`/panel; `×` → `removeChip`/`onGroupChange({column:null})`; `Esc`/Backspace kembali ke mode key; Backspace dua tahap hapus chip terakhir
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.7, 7.4, 7.5, 8.1, 8.2_

  - [x] 8.5 `SearchBar.jsx` — badge sumber, busy state, error
    - `sourceSaved` + dirty (tree via `isFilterTreeDirty`, sort/group via `getViewSnapshot`, `null` di sumber tidak pernah dirty); nama dari daftar `index`; `×` badge → `onTreeChange(null)`; spinner + tolak commit saat Promise `onTreeChange` pending; gagal → input tidak dikosongkan; seksi teks bebas hilang bila kolom pencarian kosong
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 15.1, 15.2, 15.3, 15.4_

  - [x] 8.6 i18n
    - `lang/id/core/datatable.php` & `lang/en/core/datatable.php`: `core.datatable.search.*` (design §7); `lang/*/core/filterTemplate.php`: `form.group.*`; pakai ulang istilah existing, tanpa "Favorit"
    - _Requirements: 9.6_

  - [x] 8.7 Write RTL tests `SearchBar.rtl.test.jsx`, `SearchPanel.rtl.test.jsx`, `ChipEditor.rtl.test.jsx`
    - **Interaksi Search Bar end-to-end di level komponen**
    - Ketik + Enter → `onTreeChange` grup OR; pilih kolom → mode value → Enter; saran nilai → merge `in`; Backspace ×2 hapus chip; klik chip → editor → Terapkan; pilih saved → `onPickSaved`; badge sumber + titik dirty; Promise pending → spinner & commit ditolak; reject → input tetap; ketik `/` tidak di-`preventDefault`; `<mark>` pada label; panel: hapus hanya non-shared, Builder lanjutan, Hapus semua, Group + granularity; editor: ganti operator → `ValueField` menyesuaikan
    - Tanpa `vi.useFakeTimers()` (macet dgn Radix/cmdk); `waitFor` dari `@testing-library/react`
    - **Validates: Requirements 1.4, 1.5, 2–4, 6–10, 15, 16.2, 16.3**

- [x] 9. Checkpoint - Ensure component tests pass
  - `npm run test -- resources/js/Components/Table`
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Frontend — integrasi `DataTable2`
  - [x] 10.1 Tata letak toolbar
    - Hapus dari toolbar desktop: `FilterTable2` + tombol `X`, Popover Group by, Select granularity/range; baris judul = judul + Reload + Tambah
    - Baris baru `[SearchBar ▾] [Sort]` di antara header & kartu tabel (Sort = tombol arah + Popover kolom existing, dipindah); mobile: baris full-width, Sort ikon, menu ⋯ tinggal Reload + Tampilkan per halaman
    - `FilterTable2` dirender tanpa trigger, dikontrol state `builderOpen`
    - _Requirements: 1.1, 1.2, 1.6_

  - [x] 10.2 Handler & state host
    - `onTreeChange` → `persistFilterTree`; `onPickSaved` → tree + fid + sort + group sekaligus tanpa POST (`null` = jangan override); `onGroupChange` membungkus `setGroup`/`setGroupGranularity`/`setGroupRange`; `getViewSnapshot`; `getSearchColumns` → `resolveSearchColumns({ searchScope, columns: mapColumns, visibleNames: createHeaders({ ...mapColumns }).filter(h => h.show).map(h => h.name) })`
    - State awal `options.group/groupGranularity/groupRange` dari `defaultGroup`/`defaultGroupGranularity`/`defaultGroupRange`
    - _Requirements: 5.6, 11.7, 12.6, 2.2_

  - [x] 10.3 Update `resources/js/Pages/Core/DataTable2.rtl.test.jsx`
    - **Toolbar baru & integrasi host**
    - Sesuaikan test toolbar lama (Filter/Group pindah ke panel); tombol Filter/Group tidak lagi di toolbar; Search Bar & Sort satu baris; `onPickSaved` menerapkan sort + group; `getSearchColumns` fallback memakai kolom tampil tanpa memutasi `mapColumns`; klik sel `addFilter` muncul sebagai chip
    - **Validates: Requirements 1.1, 1.2, 1.6, 5.6, 11.7, 12.6, 16.2**

- [x] 11. Frontend — form Filter Templates
  - [x] 11.1 Field Group by di `resources/js/Pages/Core/FilterTemplate/Form.jsx`
    - Select kolom groupable (+ "Tidak ada") di sebelah Sort; granularity (date/time/datetime) / range (number/currency) kondisional; kirim sebagai `group` `{column, granularity, range}` atau `null`
    - _Requirements: 13.1_

  - [x] 11.2 Write RTL test `resources/js/Pages/Core/FilterTemplate/Form.rtl.test.jsx`
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

- [x]\* 15. Deklarasikan `$searchScope` di model utama
  - Tambah `protected static array $searchScope` pada model list yang paling sering dicari (mis. SalesOrder, PurchaseOrder, PurchaseRequest, Item, Customer, Supplier, DeliveryNote, SalesInvoice, PurchaseInvoice) — kolom kode/nama + nama relasi utama
  - Bukan bagian requirement (fallback kolom tampil sudah memenuhi Requirement 5.5). Dikerjakan atas perintah `/goal` (semua task) — 11 model: SalesOrder, PurchaseOrder, PurchaseRequest, Item, Customer, Supplier, DeliveryNote, SalesInvoice, PurchaseInvoice, PurchaseReceipt, InternalOrder; semua path relasi diverifikasi resolver + test sapu `tests/Unit/Core/AllModelsSearchScopeConfigTest.php`
  - _Requirements: 5.1_

- [x] 16. Revisi 3 — Frontend — Model staged-apply (`SearchBar.jsx`)
  - [x] 16.1 State `draftTree`/`draftGroup`/`pendingSaved` + resync
    - `const [draftTree, setDraftTree] = useState(tree)`, `[draftGroup, setDraftGroup] = useState(group)`, `[pendingSaved, setPendingSaved] = useState(null)`
    - `useEffect` resync `draftTree`/`draftGroup` tiap prop `tree`/`group` berubah (design §11.1)
    - Chip (`treeToChips`, `groupChip`) dibaca dari `draftTree`/`draftGroup`, BUKAN prop `tree`/`group` lagi
    - _Requirements: 17.1, 17.2_

  - [x] 16.2 `applyDraft()` + 3 jalur trigger
    - Implementasi persis pseudocode design §11.2 (pendingSaved dulu → else bandingkan `isFilterTreeDirty(tree, draftTree)` & `!sameGroup(group, draftGroup)`, no-op bila tak ada beda)
    - Jalur 1: cabang PALING AWAL di `handleInputKeyDown` — `if (e.key === "Enter" && !open) { applyDraft(); return; }`
    - Jalur 2: tombol Search baru (lihat task 17.1) `onClick={applyDraft}`
    - Jalur 3: `ClickAwayListener onClickAway={() => { closeDropdown(); applyDraft(); }}` (perluas callback yang SUDAH ADA, bukan listener baru)
    - Busy state: pola sama §8 existing (disable submit selagi Promise pending) — TAPI saat reject, `draftTree` TIDAK di-reset (beda dari perilaku chip-dari-prop lama)
    - _Requirements: 17.5, 17.6, 17.7, 17.8, 17.9_

  - [x] 16.3 Reroute semua jalur pick ke draft (kecuali chip Cari)
    - `pickColumn`/`commitValueModeFreeText`/`pickValueOption`/`openEditorForChip`/`applyEditingChip`/`removeChipByKind`/`onGroupChange` internal: ganti pemanggilan `commitTree(...)`/`onTreeChange` langsung → `setDraftTree(...)`
    - Pilih Filter Tersimpan (saran/Panel): `setPendingSaved(saved)` (bukan langsung `onPickSaved`) + `setDraftTree(saved.filter)` + `setDraftGroup(saved.group ?? draftGroup)` agar chip preview langsung berubah sebelum apply
    - Chip Cari (`addSearchChip`/teks bebas, Requirement 4) TETAP memanggil jalur commit LAMA (instant, tidak melalui draft) — SATU-SATUNYA pengecualian
    - _Requirements: 17.3, 17.4_

  - [x] 16.4 Write unit + RTL tests staged-apply
    - **Draft tidak apply sampai trigger eksplisit; 3 jalur trigger benar; klik internal tidak salah-trigger; reject tidak revert**
    - Kasus persis daftar design §11.7 / Requirement 21.6 (Enter-panel-tertutup, tombol Search, klik-luar sungguhan vs klik chevron/Builder lanjutan/item Panel, reject tidak revert, chip Cari tetap instant)
    - **Validates: Requirements 17.1–17.9, 21.6**

- [x] 17. Revisi 3 — Frontend — Tombol Search + animasi chevron
  - [x] 17.1 Tombol Search + indikator dirty
    - Ikon `Search` (lucide) di sebelah tombol chevron existing; `isDraftDirty = Boolean(pendingSaved) || isFilterTreeDirty(tree, draftTree) || !sameGroup(group, draftGroup)`
    - Titik aksen (pola sama titik dirty saved-filter §5.5, `bg-amber-500`) saat `isDraftDirty`; disabled + `LoadingIcon` selagi `applyDraft` pending
    - _Requirements: 18.1, 18.2, 18.3_

  - [x] 17.2 Animasi rotasi chevron
    - `className="transition-transform data-[state=open]:rotate-180"` pada ikon `ChevronDown`, `data-state` mengikuti `dropdownVisible`/`open` (pola Radix data-attribute yang sudah dipakai komponen lain)
    - _Requirements: 18.4_

  - [x] 17.3 Write RTL test tombol Search + chevron
    - **Indikator dirty muncul/hilang sesuai draft; klik tombol Search memicu applyDraft; chevron dapat class rotate saat panel terbuka**
    - **Validates: Requirements 18.1–18.4**

- [x] 18. Revisi 3 — Frontend — Sintaks ketik `kolom:operator?value`
  - [x] 18.1 `:` mengonfirmasi kolom ter-highlight
    - Di `handleInputChange` atau `onKeyDown` (sebelum karakter masuk): deteksi `:` diketik selagi mode key & `highlightedKey` menunjuk item seksi "column" → `e.preventDefault()`, panggil `pickColumn(highlighted.payload.column)` (fungsi YANG SUDAH ADA)
    - `:` selagi highlight BUKAN kolom (atau tak ada highlight) → tidak ada aksi khusus, karakter masuk normal
    - _Requirements: 19.1, 19.2_

  - [x] 18.2 Parsing simbol operator di `buildLeafFromText` (`columnSearch.js`)
    - Cabang baru SEBELUM cabang mode existing, HANYA utk mode `text`/`number`/`relation`: awalan `!` → negasi (`!matches`/`!=`); awalan `>`/`>=`/`<`/`<=` → HANYA berlaku mode `number`, operator sesuai simbol; koma tanpa awalan lain → `in` dengan array split-trim
    - Kombinasi tak valid utk tipe aktif (mis. `>` pada text) → fallback: seluruh teks (termasuk simbol) jadi value literal dgn operator default — TIDAK error/blocking
    - Kolom list/boolean/date TIDAK tersentuh (tetap klik-saja, tidak lewat `buildLeafFromText` sama sekali sesuai kode existing)
    - _Requirements: 19.3, 19.4, 19.5, 19.6, 19.7_

  - [x] 18.3 Write unit + RTL tests sintaks ketik
    - **`buildLeafFromText` cabang simbol lengkap + fallback; `:` di SearchBar mengonfirmasi highlight kolom / tidak**
    - `columnSearch.test.js`: tiap simbol × tiap mode (termasuk kombinasi tak valid → literal)
    - `SearchBar.rtl.test.jsx`: ketik nama kolom exact lalu `:` → mode value tanpa `:` masuk `inputValue`; `:` saat highlight lain → `:` masuk apa adanya
    - **Validates: Requirements 19.1–19.7**

- [x] 19. Revisi 3 — Frontend — Bobot relevansi saran (`searchSuggestions.js`)
  - [x] 19.1 `scoreItem` + reorder item & seksi
    - Fungsi murni baru: prefix (awal label ATAU awal kata dalam label) > substring biasa; seksi Kolom dapat boost tambahan bila `columnName` ada di `lastUsedColumns`
    - Urutkan item dalam tiap seksi skor menurun; urutkan SEKSI berdasar skor item tertinggi di dalamnya (ganti urutan tetap 1-5 lama)
    - _Requirements: 20.1, 20.2, 20.3_

  - [x] 19.2 `lastUsedColumns` (localStorage per model)
    - Baca/tulis `localStorage` key `` `searchbar.recent.${model}` `` — array nama kolom, unshift+dedup+cap 8
    - Tulis SETIAP kali kolom dipilih (klik ATAU sintaks `:` task 18.1); tanpa `model` → selalu `[]`, TIDAK error (bungkus akses localStorage try/catch, pola sama komponen lain di codebase)
    - _Requirements: 20.4, 20.5_

  - [x] 19.3 Write unit tests bobot saran
    - **Prefix > substring; boost lastUsedColumns; seksi reorder ikut skor tertinggi; model kosong → boost nonaktif**
    - `searchSuggestions.test.js`
    - **Validates: Requirements 20.1–20.5, 21.7**

- [x] 20. Checkpoint - Ensure revisi 3 frontend suite pass
  - `npx vitest run resources/js/Components/Table/Search resources/js/Components/Table/Filter resources/js/Pages/Core/DataTable2.rtl.test.jsx resources/js/Pages/Core/FilterTemplate`
  - Ensure all tests pass, ask the user if questions arise.

- [x] 21. Verifikasi visual revisi 3 di browser
  - [x] 21.1 `npm run build` (bukan dev server) → buka halaman Index ber-grouping (mis. Item) di browser pane
    - Cek: chevron rotasi, tombol Search + titik dirty, pick kolom+isi value+Enter TIDAK langsung refetch tabel (chip tampil, tabel belum berubah) sampai Enter-panel-tertutup/tombol-Search/klik-luar; klik chevron/Builder lanjutan/item Panel TIDAK salah-trigger apply; sintaks `kategori:elektronik` & `total:>500000` & `status:!draft`; chip Cari tetap instant
    - _Requirements: 21.5_
    - **Hasil**: semua terverifikasi visual di browser pane (halaman Items). Bug klik-away/portal false-apply (react-click-away-listener gagal deteksi klik dalam Radix AlertDialog karena `role="dialog"`/`"alertdialog"` tak punya marker `data-radix-popper-content-wrapper`) — fix final: listener custom capture-phase `mousedown` di `document` dgn selector `[data-radix-popper-content-wrapper], [role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]`. Dikonfirmasi via instrumentasi `XMLHttpRequest.prototype.open` trace: 0 POST `/saved-filters` tak terduga saat klik "Builder lanjutan", "Batal", dan "Terapkan Filter" (termasuk skenario validasi gagal) di dalam AlertDialog saat ada draft belum diterapkan. Sintaks operator `kolom:>5` → "Lebih Besar Dari 5" dan `kolom:!5` → "Tidak Sama Dengan 5" dikonfirmasi ter-apply end-to-end (tabel terfilter sesuai).

- [x] 22. Final checkpoint revisi 3 - Ensure all tests pass
  - Lint/format FE sesuai konvensi project (hanya di tahap ini)
  - Full suite FE (dan BE bila ada file PHP tersentuh — revisi 3 murni FE per design §11, jadi cukup re-run suite BE existing sbg regresi, bukan ekspektasi test baru)
  - Ensure all tests pass, ask the user if questions arise.
  - **Hasil**: `npm run lint:fix` — 0 error baru (2 error pre-existing di `Comments.rtl.test.jsx`/`Print.rtl.test.jsx`, tak tersentuh sesi ini). Full FE suite (`vitest run`): **5443 passed, 1 failed** (`ItemRequests Index` debounce test — flaky timing, pass 16/16 saat diisolasi, tak tersentuh sesi ini). Full BE suite (`php artisan test`, dijalankan per-batch krn `memory_limit=128M` OOM kalau satu proses — lihat catatan baru di bawah): **~1400 test, tanpa regresi**. Semua failure BE terverifikasi PRE-EXISTING (bukan revisi 3, bukan file yg disentuh sesi ini):
    - `FileViewFinder::__construct(): Argument #2 must be array, null given` (`ControllerPrintPreferencesDocInfoTest` 2 case, + tempat lain) — Inertia SSR view-finder env issue.
    - `AssetServiceStoreConsumedItemPayloadTest`, `UserShowSelfTest`, `TodoVisibilityScopeTest` (3 case) — SEMUA pakai teknik `preg_match('#<script[^>]*type="application/json">(.*?)</script>#s', ...)` utk ekstrak props Inertia dari HTML mentah; SSR script-tag tsb tidak konsisten hadir di environment test CLI ini → `json_decode(null, true)` diam2 fallback array kosong → assertion gagal TANPA exception. Root cause SAMA di semua file ini (env SSR, bukan logic).
    - `ManualBookImageTest` — 70 referensi gambar dokumentasi hilang dari disk (aset, bukan kode).
    - `WarehouseBranchScopeTest` — "cannot start a transaction within a transaction", HANYA muncul saat digabung batch besar bareng file lain (7/7 pass saat diisolasi) — state-leak antar file test, bukan bug test itu sendiri.
    - `SalesOrderEmailPreviewTest` — awalnya tampak OOM, ternyata PASS 1/1 begitu dijalankan `php -d memory_limit=512M vendor/bin/phpunit <file>` langsung (bukan lewat `php artisan test` wrapper, yang re-exec subprocess TANPA mewarisi `-d` override manapun).

- [x] 23. Fokus & placeholder mode value (semua kolom) — Requirement 23
  - [x] 23.1 `useEffect` fokus otomatis ke `<input>` begitu mode value siap (`SearchBar.jsx`)
    - Watch `[mode, valueColumn, loadingRelation]`; skip selagi `loadingRelation === valueColumn?.name` (input masih disabled)
    - _Requirements: 23.1_
  - [x] 23.2 Placeholder dinamis mengikuti kolom aktif + key i18n baru
    - `core.datatable.search.value_placeholder` ("Masukkan nilai untuk :name…" / "Enter value for :name…") di `lang/id` & `lang/en`
    - Prioritas: loading-relation placeholder (sudah ada) > value_placeholder (baru) > placeholder prop asli
    - _Requirements: 23.2_
  - [x] 23.3 Verifikasi visual browser
    - Jalur suggestion (ketik → klik CommandItem) DAN jalur Panel `ColumnList` — keduanya sempat rentan (CommandItem terlindungi `onMouseDown preventDefault` bawaan, ColumnList tidak) sebelum fix di 23.1 jadi satu titik generik
    - _Requirements: 23.1, 23.2_
  - **Catatan**: dikerjakan sebagai bounded bug-fix (1 file JS + 2 file lang) sebelum proses brainstorming Revisi 4 (task 24-27) dimulai — didokumentasikan di sini retroaktif, bukan menyusul.

- [x] 24. Live-suggestion record kolom relation — Requirement 22
  - [x] 24.1 Hapus dead code hydrate-kolom-anak (`SearchBar.jsx`)
    - Hapus `ensureRelationHydrated`, state `relationChildren`/`relationFetchCacheRef`/`loadingRelation`, merge `effectiveColumns`+`relationChildren`
    - Sederhanakan `pickColumn`: kolom relation JADI `enterValueMode(col)` polos (sama seperti kolom lain, tanpa cabang khusus)
    - _Requirements: 22.1_

  - [x] 24.2 Render live-suggestion via `useLinkModelOptions`
    - Var `showRelationResults = mode === "value" && vmode === "relation"`; `dropdownVisible` menyertakan var ini
    - `useLinkModelOptions({ model: valueColumn?.related, search: inputValue, open: showRelationResults, limit: 8 })` — fetch opsi awal begitu kolom dipilih (search kosong), debounce 500ms bawaan hook
    - `CommandItem` per record, label `convertTemplateLink(record, "")` (fallback `record.name ?? record.code ?? record.id`), `onSelect` → `pickValueOption({o:"=", v:record})` (fungsi existing)
    - Loading: `LoadingIcon` di dalam `CommandList` (bukan disable+placeholder input); Empty: reuse `CommandEmpty`
    - _Requirements: 22.1, 22.2, 22.3, 22.4, 22.5, 22.6, 22.7_

  - [x] 24.3 `openEditorForChip` cabang relation baru
    - Cabang PALING AWAL: `column?.type === "relation"` → `enterValueMode(column, {editId: chip.id})` (search kosong, tanpa prefill teks) — SEBELUM cek `resolveValueMode`/dotted-child fallback yang sudah ada
    - Leaf `matches` lama pada kolom anak (dotted, belum ter-hydrate) TETAP lewat jalur fallback existing — TIDAK disentuh
    - _Requirements: 22.8, 22.9_

- [x] 25. Checkpoint - Ensure revisi 4 frontend suite pass
  - `npx vitest run resources/js/Components/Table/Search resources/js/Components/Table/Filter resources/js/Pages/Core/DataTable2.rtl.test.jsx resources/js/Pages/Core/FilterTemplate`
  - Ensure all tests pass, ask the user if questions arise.
  - **Hasil**: 529/529 pass.

- [x] 26. Write RTL tests revisi 4 — Requirement 24
  - [x] 26.1 Setup `QueryClientProvider` di `renderBar()` (`SearchBar.rtl.test.jsx`)
    - `QueryClient` baru per pemanggilan `render()` (bukan module-level), `retry: false, gcTime: Infinity` — pola sama `LinkModel.rtl.test.jsx`
    - _Requirements: 24.4_
  - [x] 26.2 Ganti total test lama "memilih kolom relasi belum ter-hydrate…"
    - Mock `axios.post` untuk `route("model")`; assert dropdown record muncul begitu kolom dipilih (fetch opsi awal TANPA ketik), pilih satu → leaf `{k, o:"=", v:record}`
    - _Requirements: 22.1, 22.3, 24.1_
  - [x] 26.3 Test loading/empty state, merge ke `in`, re-edit chip relation
    - **Loading/empty/merge/re-edit relation**: fetch pending → `LoadingIcon`; hasil kosong → `CommandEmpty`; pilih record kedua kolom sama → leaf `in` dedup `.id`; klik chip relation existing → mode value kosong (bukan Builder)
    - **Validates: Requirements 22.5, 22.6, 22.7, 22.8**
  - [x] 26.4 Test fokus otomatis & placeholder dinamis (retroaktif untuk 23.1/23.2)
    - **Fokus & placeholder**: pilih kolom string dari saran ATAU dari Panel `ColumnList` → `document.activeElement` adalah `<input>`; `placeholder` mengandung judul kolom
    - **Validates: Requirements 23.1, 23.2**
  - **Catatan implementasi**: 2 bug ditemukan & difix selama menulis test — (a) `axiosPost` mock belum di-reset di `beforeEach` global (nyebabkan bocor call count antar test); (b) test merge harus pakai `rerenderWith` (komponen sama), bukan `renderBar()` instance baru (dua instance ter-mount bareng bikin `getByPlaceholderText` ambigu). `SearchBar.rtl.test.jsx`: 67/67 pass.

- [x] 27. Final checkpoint revisi 4 - Ensure all tests pass
  - Lint/format FE (satu kali, di sini)
  - Full suite FE + re-run BE existing sbg regresi (revisi 4 murni FE, tak ada file backend baru)
  - Ensure all tests pass, ask the user if questions arise.
  - **Hasil**: `npm run lint:fix` — 0 error baru (2 error pre-existing tetap di `Comments.rtl.test.jsx`/`Print.rtl.test.jsx`, dikonfirmasi ulang tak tersentuh). Full FE suite: **5446/5446 pass** (test debounce `ItemRequests` yg sebelumnya flaky di checkpoint 22 kali ini pass juga). BE regresi: **tidak di-re-run penuh** — `git status --porcelain -- app/ database/ routes/ config/ tests/` kosong (nol file backend/test PHP berubah sejak checkpoint BE lengkap di task 22), revisi 4 100% frontend-only sehingga hasil BE dijamin identik; re-run ulang (~2 jam clock time berbasis pengalaman task 22) tidak memberi informasi baru.
  - **Bug ditemukan & difix SAAT verifikasi visual browser (sesudah checkpoint FE/BE di atas, sebelum dianggap benar-benar selesai)**: Enter selagi dropdown live-suggestion relation terbuka TIDAK BEKERJA sama sekali (dropdown tetap terbuka, tak ada chip terbentuk) — root cause: baris lama `handleInputKeyDown` (`mode==="value" && (vmode==="text"||"number"||"relation") && e.key==="Enter"`) masih menyertakan `"relation"`, memanggil `e.preventDefault()` + `commitValueModeFreeText()` (yang silent-return karena `inputValue` kosong) SEBELUM event itu sempat sampai ke cmdk's native Enter-pilih-item-highlighted. Fix: hapus `"relation"` dari kondisi itu (baris ~858-865) — Enter sekarang benar mengikuti perilaku cmdk bawaan. Test lama "kolom relasi -> diketik seperti teks, commit matches pada kolom anak" (baris ~586, menguji perilaku LAMA yang sudah sengaja dihapus) diganti jadi test regresi utk bug INI ("Enter memilih item ter-highlight, BUKAN membangun leaf dari teks"). Dikonfirmasi ulang end-to-end di browser: pilih kolom relation → live-suggestion muncul → Enter pilih item pertama → chip terbentuk → apply → tabel benar-benar terfilter di backend.

- [x] 28. Revisi 5 — 5 bug-fix bounded dari feedback verifikasi visual (Requirement 25)
  - [x] 28.1 Loading + "tidak ditemukan" tampil bareng di dropdown relation
    - `CommandEmpty` cmdk otomatis muncul kalau 0 `CommandItem` terdaftar — selama `relationSearch.loading`, `options` masih `[]`, jadi "tidak ditemukan" nongol BARENGAN `LoadingIcon`. Fix: `{!(showRelationResults && relationSearch.loading) && <CommandEmpty>...}`
    - _Requirements: 25.1_
  - [x] 28.2 Chip diedit ulang kehilangan operator simbol
    - `openEditorForChip` cuma prefill `v` (value), bukan `o` (operator) — leaf `{o:"!=", v:500}` prefill jadi "500", commit ulang tanpa retype "!" diam-diam balik jadi `=`. Fix: `leafToText(leaf)` baru (`columnSearch.js`, kebalikan `buildLeafFromText`) — rekonstruksi teks LENGKAP dgn simbol (`!`/`>`/`>=`/`<`/`<=`/koma-in), dipakai di kedua titik `enterValueMode` (valueMode text/number, DAN fallback dotted-child)
    - _Requirements: 25.2_
  - [x] 28.3 Builder lanjutan tidak menampilkan draft belum di-apply
    - `onOpenBuilder` (3 titik panggil) sekarang kirim `draftTree`; `DataTable2.jsx` simpan sbg `builderDraftFilter` (sentinel `undefined` = belum pernah dibuka dari Search Bar, BUKAN `null` — draft kosong sah beda dari "belum diisi"), `FilterTable2`'s `initialFilters` pakai itu kalau ada
    - _Requirements: 25.3_
  - [x] 28.4 Lebar minimum input saat chip numpuk banyak baris
    - `min-w-24` (96px) → `min-w-40` (160px) pada div pembungkus prefix+input
    - _Requirements: 25.4_
  - [x] 28.5 Value chip string dibungkus kutip (`"..."`)
    - `formatSingleValue` (`searchChips.js`): kolom `type==="string"` (bukan boolean/ber-opsi/relasi, yg sudah py representasi sendiri) dibungkus kutip — user tau ini teks yg DIKETIK apa adanya, bukan label/preset tetap. Number/currency TIDAK ikut.
    - _Requirements: 25.5_
  - **Hasil**: 255/255 pass scoped Search, 529/529 checkpoint lebih luas (Search+Filter+DataTable2+FilterTemplate, krn `DataTable2.jsx` ikut tersentuh). Terverifikasi visual browser: chip "Nama Tidak Cocok Dengan "test"" (28.2+28.5 sekaligus) tetap staged & Builder lanjutan MENAMPILKAN draft itu dgn toggle negasi aktif (28.3) — sebelumnya TIDAK PERNAH tampil.

- [x] 29. Extract parser tanggal jadi modul murni (`periodParsing.js`) — Requirement 30.4
  - Dipindahkan ke `resources/js/Components/Table/Filter/periodParsing.js` (lokasi netral bersebelahan dgn `DateSelector.jsx`, bukan `Search/` — `parseSummary` sendiri TETAP tinggal di `DateSelector.jsx`, hanya `OPERATOR_SYMBOLS`/`buildPeriodI18nLabels`/`parsePeriodToken`/`relevantYears` yg diekstrak, sesuai catatan "atau lokasi netral lain kalau lebih cocok")
  - `parsePeriodToken` modul baru: signature `(raw, {isDatetime, dateLocale, i18nLabels})` (murni, no closure) — `DateSelector.jsx` bungkus jadi `parseToken` via `useCallback` supaya referensi stabil utk dependency array existing
  - Token BARU ditambahkan: tahun 2-digit (SELALU +2000, regex `^(\d{2}|\d{4})$`), bulan-tahun angka `MM/yyyy` (slash) & `yyyy-MM` (dash) — dicek SEBELUM regex bulan-nama generik
  - Separator range internal `DateSelector.jsx` (`" - "`, dipakai `parseSummary`) TIDAK diubah — tetap terpisah dari sintaks `..` SearchBar (task 34)
  - **Hasil**: `DateSelector.rtl.test.jsx` 12/12 pass (regression guard extract, behavior-preserving)
  - _Requirements: 30.3, 30.4_

- [x] 30. Grammar sintaks ketik terpadu — Requirement 26
  - [x] 30.1 Separator `in` ganti koma → pipe (`buildLeafFromText`, `columnSearch.js`) — koma dihapus TOTAL sbg separator (bukan ditambah), `leafToText` ikut diupdate gabung pakai ` | `
  - [x] 30.2 Sintaks `between` (`a..b`) utk number — leaf `{k, o:"between", v:[a,b]}` (format SAMA dgn Builder lanjutan/`FilterEvaluator::applyBetween`, terverifikasi lewat `filterValidation.test.js` existing); `-` sengaja TIDAK diberi arti khusus (Requirement 26.3); chip label reuse jalur generik existing (`core.datatable.filter.operator.between` sudah ada di lang), tak perlu perubahan `searchChips.js`
  - **Hasil**: `columnSearch.test.js` 69/69 pass (termasuk 8 test baru: pipe list, koma-tidak-lagi-in, between, leafToText)
  - _Requirements: 26.1, 26.2, 26.3_

- [x] 31. Checkbox-multi list & boolean — Requirement 27
  - State `checkedValues` (array, urutan-centang dipertahankan); render `CommandItem asChild` + `Checkbox` (pola `MultiSelect.jsx`, HINDARI `<label htmlFor>`); reorder checked-di-atas (`listCheckedOptions`/`listUncheckedOptions`, murni `.filter()`) + `CommandSeparator`; commit SEMUA tercentang jadi satu leaf `=`/`in` (`computeCheckedLeafPatch`) saat keluar mode value
  - **KOREKSI dari draft task**: Enter TIDAK dijadikan trigger exit terpisah — dibiarkan lewat ke perilaku native cmdk (toggle item ter-highlight, SAMA seperti klik mouse), mirror persis `MultiSelect.jsx` (sesuai permintaan eksplisit user "mirip seperti MultiSelect"). 3 trigger exit riil: klik-luar, Escape, pilih kolom lain — Enter tetap "centang", bukan "keluar"
  - Prefill saat edit chip existing (`leafCheckedList` di `openEditorForChip`) — buka chip multi-value TIDAK mulai dari kosong
  - _Requirements: 27.1, 27.2, 27.3, 27.4, 27.5_

- [x] 32. Checkbox-multi relation + persist saat search berubah — Requirement 27, 28
  - State `selectedRecords` (Map by `.id`) terpisah dari `relationSearch.options`; render gabung selected (SELALU tampil, prioritas atas) → `CommandSeparator` → sisa options (filter yang sudah di `selectedRecords`); commit jadi leaf `=`/`in` dari isi akhir `selectedRecords`; `visibleKeys` (highlight cmdk) ikut disatukan checked+unchecked
  - Prefill saat edit chip relasi existing (sama pola task 31, `leafCheckedList`)
  - _Requirements: 27.1, 27.2, 27.3, 27.4, 28.1, 28.2, 28.3_

- [x] 33. Operator `!` universal — Requirement 29
  - `excludeMode`/`searchText` (SearchBar.jsx): `!` di awal `inputValue` saat mode value (semua tipe) → badge "Kecualikan" (key lang baru `core.datatable.search.exclude_badge`, id+en) di header dropdown; sisa teks (`searchText`, `!` dibuang) tetap jadi filter pencarian (relation: param `search` ke `useLinkModelOptions`; list/boolean: filter lokal `inlineValueOptions`); commit → `computeCheckedLeafPatch` pakai operator negasi (`!=`/`!in`)
  - _Requirements: 29.1, 29.2, 29.3_
  - **Bug ditemukan & diperbaiki di tengah jalan (bukan bagian task, insiden implementasi)**: `applyDraft` ditambah param opsional `treeOverride` (Requirement 27.3 jalur klik-luar butuh nilai tree sinkron, `setDraftTree` async) — tapi `<Button onClick={applyDraft}>` meneruskan SyntheticEvent klik LANGSUNG sbg `treeOverride` (truthy, bukan `undefined`), meng-nonfungsikan tombol Search utk SEMUA vmode (19 test regresi ketauan seketika). Fix: `onClick={() => applyDraft(commitCheckedSelectionSync())}` (wrapper eksplisit + commit checkbox pending sebelum apply)
  - **Hasil**: `SearchBar.rtl.test.jsx` 74/74 pass (14 test baru: 3 list, 1 relation-persist, 2 exclude-badge, 2 prefill-edit-chip, sisanya penyesuaian test lama krn semantik klik list/relation berubah dari "commit langsung" jadi "toggle"); scoped Search+Filter+DataTable2+FilterTemplate 546/546 pass

- [x] 34. Date/datetime — embed `DateSelector` + partial-suggestion — Requirement 30
  - [x] 34.1 Embed `<ReuiDateSelector>` (`ui/date-selector.jsx`) di LUAR `<CommandList>` (bukan cmdk item -- kalender punya navigasi keyboard sendiri), di bawah preset+suggestion; controlled via `datePickerValue` state BARU (ISO string, dikonversi ke/dari `Date` cuma saat dioper ke widget) -- TIDAK commit langsung per `onChange` (interaksi range >1 klik), commit lewat Enter (bareng typed-text) ATAU jalur exit checkbox-multi (`computeCheckedLeafPatch` ditambah cabang date). Prefill saat edit chip existing (`leafDateValue`)
  - [x] 34.2 `suggestPartialPeriodTokens` (columnSearch.js): Q#/H#/nama bulan/angka bare 1-2 digit TANPA tahun → 3 kandidat (`relevantYears`); tahun eksplisit → regex TIDAK cocok (bukan partial), tak expand
  - [x] 34.3 `buildDateLeafFromText` (columnSearch.js): grammar SAMA §15.1/26 (`!`, `>`/`>=`/`<`/`<=`, `a..b`) tapi leaf date SELALU `in_period`/`!in_period` (BUKAN operator top-level spt number) -- perbandingan encoded di `v.operator` (selaras `FilterEvaluator::applyPeriod`); reuse `parsePeriodToken`/`buildBetweenPeriodValue` (periodParsing.js, task 29) per token, BUKAN grammar `parseSummary` milik widget `Filter/DateSelector.jsx` sendiri
  - **Refactor pendukung (tanpa ubah behavior, verified test)**: `buildBetweenPeriodValue`+`buildReuiDateI18n` diekstrak ke `periodParsing.js`, dipakai bersama `Filter/DateSelector.jsx` (reuse, bukan duplikasi 2x) -- `DateSelector.rtl.test.jsx` 12/12 tetap pass
  - **Enter utk date DIINTERSEP KONDISIONAL** (beda dari list/relation yg tak pernah diintersep): `computeDateLeafPatch` dicek DULU -- ada hasil (teks terparse ATAU `datePickerValue` ada) baru `preventDefault`, kalau TIDAK Enter dibiarkan lewat ke cmdk native (pilih preset/suggestion ter-highlight, mis. user cuma navigasi panah tanpa mengetik apa pun tetap bisa Enter)
  - Kontrak host-agnostic (Requirement 14.1, "TIDAK boleh usePage"): locale via `currentLocale()` (`useLaravelReactI18n`), BUKAN `usePage().props.lang` spt `Filter/DateSelector.jsx`
  - **Hasil**: `columnSearch.test.js` 86/86 (17 test baru: 9 `buildDateLeafFromText`, 8 `suggestPartialPeriodTokens`); `SearchBar.rtl.test.jsx` 82/82 (11 test baru: token polos/negasi/perbandingan/between via Enter, Enter-tidak-intersep-saat-tak-ada-hasil, partial-suggestion klik, kalender ter-render `role="grid"`, klik kalender jadi pending lalu commit via Escape+Search); scoped Search+Filter+DataTable2+FilterTemplate 571/571
  - _Requirements: 30.1, 30.2, 30.5, 30.6, 30.7_

- [x] 35. Hint discoverability — Requirement 31
  - Footer kecil (`t("core.datatable.search.hint.${vmode}")`, key baru id+en) di bawah `CommandList`/widget date, tampil selama mode value text/number/date/relation (BUKAN list/boolean, `HINT_VMODES` set)
  - **Gap ditemukan & diperbaiki**: text/number SEBELUMNYA tak pernah membuka dropdown sama sekali (`dropdownVisible` gak punya kondisi utknya, langsung ketik tanpa listing) -- footer hint jadi tak punya tempat tampil. Fix: `showHint` (mode==="value" && text/number) ditambah ke `dropdownVisible`, DIBARENGI suppress `<CommandEmpty>` khusus kondisi ini (dropdown terbuka HANYA utk footer, bukan listing, "tidak ditemukan" jadi tak relevan)
  - **Hasil**: `SearchBar.rtl.test.jsx` 85/85 (3 test baru: hint muncul text, hint TIDAK muncul list/boolean, hint TIDAK muncul mode key); scoped Search+Filter+DataTable2+FilterTemplate 574/574
  - _Requirements: 31.1, 31.2_

- [x] 36. Fix posisi Panel (anchor stabil) — Requirement 32
  - **PERCOBAAN 1 (GAGAL, ketauan dari verifikasi visual browser sungguhan)**: `<PopoverAnchor virtualRef={wrapperRef}>` (primitif Radix Popper dgn anchor virtual, tanpa elemen DOM nyata) -- SECARA TEORI valid (dibaca dari source `@radix-ui/react-popper`), tapi EMPIRIS gagal total: `--radix-popper-anchor-width`/`height` SELALU 0, popover collapse ke pojok kiri-atas viewport (BUKAN overflow spt bug asli, malah lebih parah -- posisi sama sekali lepas dari search bar). Root cause pasti belum ketemu (kemungkinan ketidaksesuaian versi API), TAPI diputuskan tak dikejar lebih jauh krn ada alternatif standar yg terbukti.
  - **PERCOBAAN 2 (BERHASIL, dipakai)**: pola `<PopoverAnchor asChild>` standar -- `<Popover>` (Root) DIPINDAH jadi pembungkus TERLUAR seluruh komponen (sebelumnya nested 3 level di dalam `<Command>`), `<PopoverAnchor asChild>` melingkupi `wrapperRef` (div terluar, posisi stabil), `PopoverTrigger`/`PopoverContent` TETAP di lokasi asal (interaksi fokus/klik & isi dropdown tak berubah). `PopoverAnchor` ditambah ke ekspor `ui/popover.jsx` (belum ada sebelumnya).
  - **Verifikasi VISUAL BROWSER SUNGGUHAN** (bukan cuma jsdom, sesuai instruksi eksplisit `/goal`): dibuktikan via `getBoundingClientRect()`/`--radix-popper-anchor-width` NYATA di halaman `/items` (build produksi, `serve-visual`) dgn skenario PERSIS bug asli -- 3 chip di-wrap 2 baris (viewport 700px), anchor width TERUKUR 596px (match wrapperRef SEBENARNYA), popover translate(32px,186px) SEJAJAR PERSIS kiri wrapper, TIDAK overflow (right 662 < 700 viewport). Sebelum fix: anchor width 0, translate(0,4) -- lepas total dari search bar.
  - **Hasil**: `SearchBar.rtl.test.jsx` 87/87 tetap pass (restrukturisasi JSX tak mengubah behavior teramati test); visual browser CONFIRMED via DOM measurement + screenshot (Panel, value-list Kategori, date-embed dropdown SEMUA anchor benar di posisi wrapper stabil)
  - _Requirements: 32.1, 32.2_

- [x] 37. Navigasi keyboard Panel — Requirement 33
  - Roving via FOKUS DOM NATIF (bukan state "highlighted key" virtual pola cmdk) -- `SearchPanel.jsx`: Up/Down pindah item dalam `<section>` aktif (clamp, tak wrap); Left/Right pindah antar section (wrap-around, coba pertahankan index sama, clamp kalau tujuan lebih pendek); Enter aktivasi tombol via perilaku native browser (gratis, tak perlu kode); Escape panggil `onClose` prop baru (diwire ke `closeDropdown` SearchBar)
  - Panah dari SEARCH INPUT (fokus belum pindah ke Panel) via `handleInputKeyDown` SearchBar: fokuskan item PERTAMA Panel (`panelContainerRef`, div baru pembungkus `<SearchPanel>`)
  - **Koreksi asumsi di tengah jalan**: draft komentar awal klaim "GroupPicker = SATU kontrol komposit" -- SALAH, GroupPicker punya beberapa sub-kontrol; ketauan dari test clamp yg gagal, diperbaiki test+komentar tanpa ganti logic (logic clamp sudah generik, tak butuh asumsi jumlah item)
  - **Hasil**: `SearchPanel.rtl.test.jsx` 29/29 (12 test baru: Down/Up dalam kolom, clamp di ujung, Right/Left antar kolom+wrap, clamp lintas kolom beda panjang, Escape, Enter aktivasi native); scoped Search+Filter+DataTable2+FilterTemplate 581/581
  - _Requirements: 33.1, 33.2, 33.3_

- [x] 38. Tooltip chip — Requirement 34
  - Badan chip (bukan `chip.kind === "search"`, itu SUDAH py native `title` sendiri berisi daftar kolom -- info beda, tak diganti) dibungkus `Tooltip` (pola Radix sama yg dipakai dirty-dot chip sumber), isi = `chip.label` (SAMA persis teks chip yg mungkin ke-truncate `max-w-48`)
  - **Hasil**: `SearchBar.rtl.test.jsx` 87/87 (2 test baru: hover chip leaf -> tooltip muncul isi identik dgn label chip via `user.hover`+`waitFor` timers REAL bukan fake, sesuai `reference_fake_timers_radix_cmdk_hang`; chip search tetap native title tak dobel tooltip)
  - _Requirements: 34.1_

- [x] 39. Checkpoint - Ensure revisi 6 frontend suite pass
  - `npx vitest run resources/js/Components/Table/Search resources/js/Components/Table/Filter resources/js/Pages/Core/DataTable2.rtl.test.jsx resources/js/Pages/Core/FilterTemplate`
  - **Hasil**: 583/583 pass (sebelum task 40 nambah `periodParsing.test.js`)

- [x] 40. Write tests revisi 6 — Requirement 35
  - [x] 40.1 `columnSearch.test.js`: separator `in` baru (`|`), `between` (`a..b`) number -- ditulis inline saat task 30 (8 test)
  - [x] 40.2 `periodParsing.test.js` (BARU, file baru dibuat): semua token existing (regression guard extract, 11 test: tahun 2/4-digit, Q#, H#, bulan nama, tanggal harian 4 format, isDatetime+jam) + token baru (`MM/yyyy`, `yyyy-MM`) + `relevantYears`/`buildBetweenPeriodValue`/`OPERATOR_SYMBOLS`/`buildPeriodI18nLabels`/`buildReuiDateI18n` (9 test lain) -- 20 test total
  - [x] 40.3 `SearchBar.rtl.test.jsx`: checkbox-multi list/boolean (task 31), relation checked-persist (task 32), operator `!` universal (task 33), embed `DateSelector` widget (task 34), keyboard nav Panel (`SearchPanel.rtl.test.jsx`, task 37), tooltip chip (task 38) -- semua ditulis inline per task, BUKAN ditunda ke sini. **Posisi Panel tidak overflow TIDAK bisa diuji via jsdom** (`getBoundingClientRect()` selalu nol tanpa layout engine sungguhan) -- dicatat sbg gap, nunggu verifikasi visual browser (task 41/checkpoint akhir)
  - **Hasil**: scoped Search+Filter+DataTable2+FilterTemplate 603/603 (naik dari 583 stlh `periodParsing.test.js` ditambah)
  - _Requirements: 35.1, 35.2, 35.3_

- [x] 41. Final checkpoint revisi 6 - Ensure all tests pass
  - Lint/format FE (`npm run lint:fix`): 0 error di file yg disentuh sesi ini (verified scoped-eslint terpisah); reformat prettier otomatis pada file yg lint:fix sentuh
  - `git status` file backend (`app/`, `database/`, `routes/`, `config/`, `tests/`): NIHIL — revisi 6 100% FE, sesuai prediksi awal; skip re-run BE penuh (sama pola checkpoint 27)
  - **Hasil**: full suite FE (`npx vitest run`, SELURUH repo bukan cuma scoped) **5520/5520 pass, 0 fail** — konfirmasi tanpa regresi di MANA PUN, bukan cuma area yg disentuh
  - _Requirements: semua Requirement 26-35 (Revisi 6) — implementasi + test FE selesai. Verifikasi VISUAL (browser sungguhan) belum dilakukan sesi ini -- lihat catatan di bawah._

- [x] 42. Feedback #1 — Enter pada item Panel tidak bekerja — Requirement 33.3
  - Akar: root cmdk `preventDefault()` Enter, keydown dari portal Panel tetap bubble (descendant pohon React) → klik native tombol Panel batal. Fix: `e.stopPropagation()` untuk Enter di `SearchPanel.handlePanelKeyDown`
  - Test: `SearchBar.rtl.test.jsx` 2 test (ArrowDown→item pertama Panel→Enter→`onOpenBuilder`; Enter pada tombol kolom→mode value) — sebelumnya merah, hijau setelah fix
  - Verifikasi browser sungguhan (`/items`, build produksi): ArrowDown → ArrowRight ×2 → Enter pada tombol kolom Panel masuk mode value kolom itu
  - _Requirements: 33.3_

- [x] 43. Feedback #2 — Search box ↔ checkbox dua arah + separator `|` — Requirement 27.6-27.9, 31.2
  - [x] 43.1 `columnSearch.js`: `parseMultiValueText`/`formatMultiValueText` (pure) + unit test
  - [x] 43.2 `SearchBar.jsx`: `searchText` = segmen pending utk list/boolean/relation; `toggleCheckedValue`/`toggleSelectedRecord` menulis ulang teks; `syncMultiFromText` (ketik → centang, normalisasi hanya saat menyisipkan, pesan `option_not_found`); `computeCheckedLeafPatch` ikut komit segmen pending yg cocok persis; prefill teks saat edit chip (`!` bila negasi); opsi list tercentang selalu tampil; hint list; helper `listOptionsFor`/`recordLabel`/`sameLabel`
  - [x] 43.3 Relation: label diketik lebih cepat dari debounce fetch → resolve langsung lewat `axios.post(route("model"), buildOptionsPayload(...))`, sinkron ulang via `latestRef` (dibatalkan bila teks sudah berubah)
  - [x] 43.4 Lang id+en: `search.option_not_found`, `search.hint.list`, `search.hint.relation` diperbarui
  - [x] 43.5 Test RTL (`SearchBar.rtl.test.jsx`, 14 test baru: tulis-ulang teks, ketik→centang, filter segmen, segmen tak cocok, Backspace tak tertahan, komit segmen pending, Enter cmdk, negasi `!`, prefill edit chip (multi & `!=`), boolean, relation ×3); test hint list lama (menyatakan list TIDAK punya hint) diperbarui
  - [x] 43.6 **Boolean maksimal satu pilihan** — ditemukan di verifikasi browser sungguhan (bukan jsdom): centang "Ya"+"Tidak" jadi leaf `in [false,true]`, ditolak `FilterTreeCleaner` (boolean hanya `=`/`!=`) → `POST /saved-filters` 422 `empty_tree`, filter tak ter-apply. Fix FE: pilihan boolean saling menggantikan (toggle, ketik, komit segmen pending); +1 test RTL
  - _Requirements: 27.6, 27.7, 27.8, 27.9, 31.2_

- [x] 44. Feedback #3 — Beberapa format tanggal tidak bekerja — Requirement 30.3, 30.8, 30.9, 30.10
  - [x] 44.1 `periodParsing.js` ditulis ulang tanpa `date-fns parse` (regex + `matchMonthName` + `toLocalDayString`); varian: tahun 2-digit hari (`15/09/26`), separator `. - /` & spasi, tahun-dulu, kuartal/half tahun-dulu, nama bulan singkat/awalan/Inggris, bulan-tahun angka, jam utk semua format hari di datetime; ditemukan lewat probe matrix ~55 input × id/en × date/datetime
  - [x] 44.2 Serialisasi leaf tanggal ke string lokal (`buildDateLeafFromText`, `handleDatePickerChange`, `toDateObj` parse lokal); `formatPeriodValue` tampilkan jam bila ≠ 00:00; `suggestPartialPeriodTokens` pakai `matchMonthName`
  - [x] 44.3 Test: `periodParsing.test.js` (+ ~55 kasus), `columnSearch.test.js`, `SearchBar.rtl.test.jsx` (7 test: format ketik, between hari, kalender ter-embed)
  - [x] 44.4 **Label chip** — ditemukan di verifikasi browser: `!in_period` tampil "Not In Period [object Object]" (`searchChips.leafToChip` hanya cek `in_period`); perbandingan (`>2026`) tak menampilkan simbol. Fix `leafToChip` + `formatPeriodValue` (simbol `>`/`>=`/`<`/`<=`); test lama yg mengunci label tanpa simbol diperbarui, +test `!in_period`
  - **Hasil akhir feedback round (task 42-44)**: scoped Search+Filter+DataTable2+FilterTemplate 692/692; `SearchBar.rtl.test.jsx` 111/111; full suite FE (`npx vitest run`) **429 file / 5609 test pass, 0 fail**; ESLint 0 error di file yang disentuh (2 error lint:fix ada di file lain, pre-existing); `npm run build` sukses; verifikasi visual browser sungguhan (list/boolean/relation `|`, Backspace, error opsi, prefill edit chip, format tanggal, chip `!in_period`/`>=`, Apply → 200 + `fid`)
  - _Requirements: 30.3, 30.8, 30.9, 30.10_

## Revisi 7 — Chip nilai (`in`), Enter = selesai, Tab completion (Requirement 36-39, design §16)

- [x] 45. Chip nilai `in` (list/boolean, relation, text, number) — Requirement 36
  - [x] 45.1 State `textChips`; `valueChips`/`removeValueChip`; input hanya ketikan sementara (`toggleCheckedValue`/`toggleSelectedRecord` tak menulis teks lagi; `!` dipertahankan)
  - [x] 45.2 `handleInputChange`: pecah `|` → resolusi atomik → chip (list/relation/number/text), paste, boolean 1 chip, relation label sama pilih yg belum terpilih + fetch async; pesan bila tak cocok
  - [x] 45.3 Komit leaf dari chip (`computeCheckedLeafPatch` + text/number; `!in` langsung); prefill chip saat edit chip existing (`openEditorForChip`, `enterValueMode`)
  - [x] 45.4 Render chip di dalam kotak (setelah `[Kolom:]`), tombol ×, wrap
  - [x] 45.5 Pemisah `;` (semua tipe `in`) & `,` (non-number) — `separatorsFor`, perlindungan label yg memuat pemisah (`isLabel`), paste
  - _Requirements: 36.1-36.9_

- [x] 46. Enter = selesai + navigasi/hapus chip — Requirement 37
  - [x] 46.1 `finishValueMode` (Enter semua vmode chip; cegah cmdk toggle; tutup dropdown; date ikut tutup)
  - [x] 46.2 `highlightedValueChipKey`: ArrowLeft/Right, Backspace/Delete 2 langkah, lepas sorotan saat mengetik
  - _Requirements: 37.1-37.7_

- [x] 47. Tab completion — Requirement 38
  - [x] 47.1 Tab mode key (pilih kolom ter-highlight), mode value list/relation (tulis label), date (tulis label saran); highlight default melompati opsi terpilih
  - _Requirements: 38.1-38.5_

- [x] 48. Lang (hint + pesan), revisi test lama (14 test teks-mirror → chip), test baru — Requirement 39
  - _Requirements: 39.1, 39.2_

- [x] 49. Checkpoint revisi 7 — scoped suite, `lint:fix` sekali, `npm run build`, verifikasi browser sungguhan, full suite FE
  - Scoped Search+Filter+DataTable2+FilterTemplate hijau; `SearchBar.rtl.test.jsx` 133+ test (chip list/boolean/relation/text/number, Enter=selesai + Enter kedua meng-apply, navigasi/hapus chip 2 langkah, Tab kolom/opsi/relation/date, pemisah `;` `,`, perlindungan label ber-koma, paste)
  - Verifikasi browser sungguhan (`/items`, build produksi): Tab pilih kolom & lengkapi label; `;`/`,` jadi chip; ArrowLeft menyorot chip, Backspace menghapus yg tersorot (bukan cuma terakhir); Enter menutup dropdown + keluar mode value, Enter kedua meng-apply (`fid` + filter benar); edit chip menampilkan chip; text `Laptop Air 13;Kursi Ergonomis,` jadi chip & leaf `in`
  - **Bug ditemukan di verifikasi browser (tak terlihat di jsdom)**: fetch relation ber-key baru (debounce) mengosongkan `options` sementara → label yg baru dilengkapi Tab tak dikenali saat `|` diketik cepat. Fix: `knownRecordsRef` mengakumulasi semua opsi yg pernah tampil + hasil resolve async selalu disimpan; test regresi (gagal tanpa fix, terverifikasi)
  - Catatan: koma tak lagi bisa jadi bagian nilai text biasa (keputusan user: `,` pemisah utk non-number); label opsi/record yg memuat pemisah dilindungi (utuh = satu label)

- [x] 50. Susulan — daftar opsi tanpa checkbox, Enter berbasis niat — Requirement 36.10, 37.1, 38.5
  - [x] 50.1 Hapus checkbox & kelompok tercentang/separator (list/boolean/relation); `pickListValue`/`pickRecord` hanya menambah; opsi terpilih tak tampil di daftar
  - [x] 50.2 Enter: pilih opsi ter-highlight bila ada niat (`hasOptionIntent`: ketikan / panah), selain itu selesai; panah pertama hanya memunculkan sorotan; sorotan otomatis disembunyikan tanpa niat; hint lang list/relation
  - [x] 50.3 Revisi test (~12 test berbasis checkbox/`data-state` → chip/`optionRow`) + test baru (Enter memilih ketikan parsial, ArrowDown+Enter, Enter tanpa niat menyelesaikan)
  - [x] 50.4 Enter pertama = selesai + apply utk kolom tanpa operator `in` (boolean, date/datetime) — `commitLeafAndApply`; hint `boolean`/`date`; test (boolean ketik+Enter, boolean klik+Enter, tanpa nilai tak apply, date preset+Enter; test date lama tak lagi memanggil `clickApply` setelah Enter) — Requirement 37.8
  - [x] 50.5 Checkpoint — scoped Search+Filter+DataTable2+FilterTemplate 730/730; ESLint 0 error di file yang disentuh; `npm run build` ok; verifikasi browser sungguhan (daftar tanpa checkbox, sorotan tersembunyi lalu muncul saat mengetik/panah, Enter memilih/selesai/apply, boolean & date Enter tunggal meng-apply -> fid baru + leaf benar); full suite FE 429 file, 5647 test pass (427 file/5616 test dalam satu run + 2 file yang gagal start worker karena timeout infrastruktur -- `useDynamicRefs.test.js`, `CustomMode.sidebar.drop.unit.test.js` -- dijalankan ulang terpisah: 31/31 pass)
  - _Requirements: 36.10, 37.1, 38.5_

## Revisi 8 — Set/Not set, edit chip nilai, petunjuk, navigasi chip utama, audit date/datetime (Requirement 40-46)

- [x] 51. Tata letak area nilai (baris baru) + penanda chip yang diedit — Requirement 43
- [x] 52. Navigasi panah chip utama (Filter/Group) — Requirement 44
- [x] 53. Edit chip nilai text (klik / Enter pada chip tersorot) — Requirement 41
- [x] 54. Opsi Diisi / Tidak diisi (`set`/`!set`) semua tipe kolom — Requirement 40
- [x] 55. Petunjuk (legend `<kbd>`) yang jelas — Requirement 42
- [x] 56. Audit date/datetime (widget, wrapper Builder, Search Bar) — Requirement 45
  - [x] 56.1 Helper bersama di `periodParsing.js`: `parseLocalDate`, `toLocalDateValue` (kolom date buang jam), `hasPeriodSelection`, `completeRange` (dipindah dari wrapper), `defaultYearBounds`
  - [x] 56.2 Search Bar: `handleDatePickerChange` menolak nilai tanpa pilihan (emisi-mount widget) -> perbaiki BUG Enter-preset mengomit leaf kosong; komit range separuh dilengkapi; embed dapat `minYear/maxYear`
  - [~] 56.3 (DIBATALKAN revisi 9 — wrapper dikembalikan) Wrapper Builder `Filter/DateSelector.jsx`: serialisasi lokal (bukan `toISOString` UTC), emisi kosong = null, `clearValue` (klik X pertama tak lagi no-op) + remount panel, rentang tahun default lebar
  - [~] 56.4 (DIBATALKAN revisi 9 — widget dikembalikan) Widget `ui/date-selector.jsx`: pintasan "hari ini" = awal hari, ganti hari mempertahankan jam (datetime), prop `showToday` (tombol Today/Now ganda disembunyikan di `DateSelector`, tetap ada di `DatetimePicker`)
  - [x] 56.5 Parser ketik: kata kuartal/semester & nama-bulan-dulu (`Sep 15 2026`)
  - [x] 56.6 Test: `periodParsing.test.js`, `Filter/DateSelector.rtl.test.jsx` (test `[BUG]` klik-X-pertama diubah ke perilaku benar), `ui/date-selector.rtl.test.jsx` (baru), `SearchBar.rtl.test.jsx` (Enter-preset berisi nilai, Escape tanpa pilihan, pintasan tanpa jam, kolom datetime berjam, format baru)
- [-] 57. Test revisi 8, lint, build, verifikasi browser, full suite — Requirement 46
  - [x] 57.1 `npm run lint:fix` sekali (0 error di file yang disentuh; 2 error lama di `Comments.rtl.test.jsx` & `Print.rtl.test.jsx`, bukan bagian revisi ini); `npm run build` ok; `LocaleKeysTest` lolos
  - [x] 57.2 Full suite FE: 5735 test, 0 gagal
  - [ ] 57.3 Verifikasi browser sungguhan (Enter-preset date, klik X wrapper Builder, pintasan "hari ini", set/!set, chip text edit, legend, panah chip) — menunggu login manual user di pane Browser (`serve-visual` :8012)

## Revisi 9 — Feedback pemakaian (Requirement 47-54)

- [x] 58. Kembalikan widget `ui/date-selector.jsx` + wrapper `Filter/DateSelector.jsx` ke kondisi semula (instruksi user); hapus `ui/date-selector.rtl.test.jsx`
- [x] 59. Tata letak: area nilai `flex-1 basis-96` (baris baru hanya bila ruang kurang) — Requirement 47
- [x] 60. Penanda `[Kolom:]` badge kontras tinggi — Requirement 48
- [x] 61. Warna & ikon chip per peran (emas+bintang / biru / hijau+Layers / secondary) — Requirement 49
- [x] 62. Tips Panel + kontras legend (`SearchLegend context="panel"`, `panelLegendIds`) — Requirement 50
- [x] 63. Enter/Space pada chip tersorot = edit (semua tipe chip) — Requirement 51
- [x] 64. Klik opsi menutup dropdown (boolean, preset/saran date, Diisi/Tidak diisi) + Enter text/number = chip dulu — Requirement 52
- [x] 65. Pilihan tanggal di widget mengisi nilai Search Bar (semula komit + tutup; DIGANTIKAN task 69: sinkron ke teks tanpa komit; abaikan emisi prefill & kembalikan fokus tetap) — Requirement 53
- [x] 66. Saran nilai tanggal meniru format ketikan (`suggestPeriodTokens`, `suggestionYears`, `monthsStartingWith`, `Quartal`, Enter memprioritaskan saran ter-highlight) — Requirement 54
- [x] 66a. Format chip tanggal `dd MMM yyyy HH:mm` berlokal (`formatPeriodValue(value, monthsShort)`, `treeToChips(..., {monthsShort})`) — Requirement 55
- [x] 68. Dropdown date 2 kolom (saran kiri, widget kanan, tips bawah) — Requirement 56.1
- [x] 69. Sinkron dua arah search box <-> widget (`parseDateText`, `periodValueToText`, `syncWidgetFromText`, `handleDatePickerChange` tanpa auto-komit; prefill teks saat edit chip; `!in_period` dianggap negasi saat edit) — Requirement 56.2–56.5, 56.7
- [x] 70. Saran bersimbol (`suggestPeriodTokens` + `suggestBody`), Tab menyinkronkan widget, Diisi tak terpilih diam-diam — Requirement 56.5–56.6
- [x] 71. Saran/leaf rentang: ujung akhir dilengkapi tahun ujung awal, granularitas campuran (`buildFlexibleBetween`), saran rentang `a..b`; Diisi/Tidak diisi selalu tampil; Enter tanpa niat = selesai; sorotan kembali ke item pertama — Requirement 54.9–54.10
- [ ] 67. Checkpoint revisi 9–10: lint, build, verifikasi browser, full suite

## Revisi 11 — Banyak nilai (`in`) untuk date/datetime (Requirement 57-62)

- [x] 72. Fase 1 — Backend `in`/`!in` date/datetime — Requirement 57, 58
  - [x] 72.1 `FilterTreeCleaner`: whitelist `in`/`!in` utk date/datetime, `isPeriodListValid` (list 1-20 via `MAX_PERIOD_VALUES`, tiap elemen `isPeriodValid` & `operator=is`), cabang sebelum `in` skalar
  - [x] 72.2 `FilterEvaluator`: whitelist, `applyPeriodIn` (OR periode; `!in` = NOT), cabang di `applyItem` + kolom relasi nested; mode kolom tak berubah
  - [x] 72.3 PHPUnit: Cleaner 21 test (+5 baru) & Evaluator 33 test (+11 baru); regresi SavedFilter 45, FilterTemplateController 17, ModelControllerFilter 2, LinkModelFilterConverter 8, FilterColumnResolver 8 — semua lolos
  - [x] 72.4 Verifikasi nyata: skrip read-only ke MySQL dev (model Item, 12 baris Sep 2026): `in [11 Sep, 21 Sep]`=12, `in [11 Sep]`=2, `!in [11 Sep]`=10, `!in [Sep 2026]`=0, daftar kosong/skalar/elemen `after` di-DROP Cleaner; SQL `between ? and ?` terparameterisasi
- [x] 73. Fase 2 — Widget `allowMultiple` — Requirement 59
  - [x] 73.1 State `selections` + toggle (`toggleSelection`: hari/bulan/kuartal/semester/tahun; pintasan additive), hidrasi `value.selections`, emisi `selections` (hanya bila `allowMultiple`)
  - [x] 73.2 DayPicker `mode="multiple"` (+ `emitTriggerDate` agar `DatetimePicker` tetap menerima array); `DateSelectorPeriodGrid`/`DateSelectorYearList` penanda daftar; Periode tak membersihkan; Kondisi guard (`disabledOptions` saat >=2); `maxSelections` + `onSelectionLimit`; datetime seluruh hari (pemilih jam disembunyikan)
  - [x] 73.3 `ui/date-selector.rtl.test.jsx` 14 test (default-off identik lama, toggle, campuran granularitas, hidrasi, guard Kondisi, batas, datetime)
- [x] 74. Fase 3 — Search Bar chip nilai date — Requirement 60
  - [x] 74.1 Model chip = `selections` (`isChipMode` + date), separator `|`/`;`, parse per segmen, pesan (`date_invalid`, multi hanya Pada, batas 20)
  - [x] 74.2 Sinkron widget (union chip + pending), toggle/hapus dua arah, klik sel terpilih
  - [x] 74.3 Alur Enter/klik/preset baru (menggantikan aturan khusus date), `finishValueMode`/`computeCheckedLeafPatch` date dari chip, `buildDateChipsLeaf` (1 -> `in_period`, >=2 -> `in`)
  - [x] 74.4 Label chip utama `in`, edit chip utama (`initialTextChips`), legend date
  - [x] 74.5 Tes RTL (24 baru + 37 diperbarui) + unit; verifikasi browser sungguhan: ketik chip -> apply -> `in` di `saved_filters` (Sep+Nov 2026, 12 baris = SQL), `!in` (3 nilai, 0 baris = SQL), edit chip utama, Kondisi lain nonaktif, pesan simbol. Klik sel widget diverifikasi RTL saja (user menguji manual)
- [x] 75. Fase 4 — Builder — Requirement 61
  - [x] 75.1 `DateMultiSelector.jsx` (komponen terpisah) + `operators.js` (`in`/`!in` -> `dateselectorMulti`) + `ValueField` + `filterValidation` (`validatePeriodValue` diekstrak, `dateselectorMulti` 1..20) + lang `dateselector.clear`
  - [x] 75.2 Tes: operators, filterValidation, ValueField routing, `DateMultiSelector.rtl.test.jsx` (7 test)
- [ ] 76. Checkpoint revisi 11: lint, build, browser, full suite (BE + FE)
- [x] 77. Revisi 12 — aturan daftar chip number/date (Requirement 63): `hasValueSymbol`/`chipEntryViolation` + tolak ketikan di `handleInputChange`, hapus `dateNotice`, pesan `chip_symbol_with_chips`/`chip_single_only`
- [x] 78. Sembunyikan chip yg diedit (Requirement 64): `displayChips`, `visibleValueChips`, hapus penanda cincin leaf
- [x] 79. Tanda visual negasi (Requirement 65): penanda kolom + `data-excluded` (chip nilai TIDAK merah sejak task 85)
- [x] 80. Panah atas di opsi pertama / item pertama Panel kembali ke kotak (Requirement 66): `optionDismissed`, `optionClass` utk date, `SearchPanel.onFocusInput`
- [x] 81. Tips kontekstual (Requirement 67): `legendTipsFor(ctx)`, `legendCtx`, pelacakan fokus Panel/widget, kunci lang id/en baru, legend juga utk saran ketikan
- [x] 82. Opsi formStatus/formStatuses (Requirement 68): `LinkModel::withStatusOptions`, `Ticket` options, `buildListLeaf`, saran `in`, prefill `has`/`!has`; `StatusColumnOptionsTest` (5)
- [x] 83. Tes (Requirement 69): unit columnSearch/searchSuggestions/SearchLegend, RTL SearchBar (20 baru + penyesuaian), PHPUnit; folder Table 988 lulus; 79 PHPUnit kolom/trait lulus
- [x] 83b. Revisi 12b: nilai bersimbol pertama langsung selesai (`finishWithPatch`), edit chip filter satu nilai -> teks (`dateAsText`), tips `enter_symbol_finish`, tes disesuaikan
- [x] 85. Revisi 13 UI (Requirement 70-73): chip negasi tak merah, `BadgeStatus label` + `isStatusColumn`, opsi urut abjad (`buildOptionList`), tombol `bg-muted`
- [x] 86. Revisi 13 saran nilai per kolom (Requirement 74): `splitScope`, `findRelationScope`, `buildSuggestions` (`dateContext`/`relationRecords`), `useLinkModelOptions.settled`, wiring SearchBar
- [x] 87. Revisi 13 tes (Requirement 75): unit searchChips/searchSuggestions, RTL SearchBar (9 baru, `revisi 13`)
- [x] 88. Revisi 14 (Requirement 76-79): `SaveFilterControl` tanpa dropdown (isian inline, timpa berbasis nama, progres "Menyimpan..."), `SearchPanel` (`defaultName`/`disabled`/`className`, kandidat timpa non-shared), hapus kunci `saved.save_new`, tes RTL FilterTable2 (SaveFilterControl 10 + dialog) & SearchPanel, verifikasi browser Items
- [x] 89. Revisi 15 (Requirement 80): hapus pesan "tidak ada hasil" yg kontradiktif dgn opsi Diisi/Tidak diisi (`SearchBar.jsx`), 4 tes RTL (3 gagal tanpa perbaikan), verifikasi browser Items (boolean "diisi"/"zzz")
- [x] 90. Revisi 16 fase 1 -- Backend `in_period` multi-nilai (Requirement 81-82, design §25.1)
  - [x] 90.1 `FilterTreeCleaner`: whitelist date/datetime = `in_period`/`!in_period`; cabang `in_period` menerima objek ATAU daftar (`isPeriodListValid`); hapus cabang `in` date
  - [x] 90.2 `FilterEvaluator`: whitelist; cabang `in_period` daftar -> `applyPeriodIn` (utama + closure nested relasi); hapus cabang `in` date; leaf lama `in` date dilewati
  - [x] 90.3 PHPUnit: pindahkan tes date-`in` (Cleaner 5 + Evaluator 11 dari task 72.3) ke `in_period` daftar; tambah: `in` date non-kolom di-drop/dilewati, `in` mode kolom tetap lolos; regresi SavedFilter/FilterTemplate/ModelControllerFilter
- [x] 91. Revisi 16 fase 2 -- Builder (Requirement 83, design §25.2)
  - [x] 91.1 `operators.js` (date/datetime 2 operator + set), `ValueField.jsx`, `filterValidation.js` (`dateselector` objek|daftar); hapus `DateMultiSelector.jsx` + `dateselectorMulti`
  - [x] 91.2 `Filter/DateSelector.jsx`: widget `allowMultiple`, emisi objek|daftar, hidrasi daftar, ringkasan daftar
  - [x] 91.3 `Filter/DateSelector.jsx`: ketikan `|`/`;` -> banyak periode (`parseMultiValueText`/`parseDatePeriod`/`mergeDatePeriods`); jalur lama utuh
  - [x] 91.4 Tes: `operators`, `filterValidation`, `ValueField`, RTL `DateSelector` Builder (hapus `DateMultiSelector.rtl.test.jsx`)
- [x] 92. Revisi 16 fase 3 -- Search Bar (Requirement 84, design §25.3)
  - [x] 92.1 `columnSearch.js` (`buildDateChipsLeaf`, `leafDatePeriods`), `searchChips.js` (`leafToChip`, `addLeafChip`); komentar `SearchBar.jsx`
  - [x] 92.2 Tes: `columnSearch`, `searchChips`, `SearchBar.rtl` (leaf `in` -> `in_period` daftar); perilaku UI tak berubah
- [-] 93. Checkpoint revisi 16 (Requirement 85-86): lint, LocaleKeysTest, build, verifikasi browser (Builder + Search Bar, fid + SQL), full suite BE + FE; cek DB dev utk leaf `in` date lama
- [ ] 84. Checkpoint revisi 12–16 (+ 76): lint, LocaleKeysTest, build ulang, verifikasi browser (user menguji manual), full suite FE
  - Hasil 2026-09-26: eslint 0 error, LocaleKeysTest lulus, build OK, FE 5949 lulus / 1 gagal (flaky `dipratinjau di widget`, lulus bila dijalankan sendiri), browser: Status (badge + abjad + "status diterima"), relation "kategori fur" -> apply, periode "dibuat pada sep 2026", tombol `bg-muted`, chip negasi abu-abu. Menunggu konfirmasi user.

## Notes

- Setiap task mereferensi requirement spesifik untuk traceability; checkpoint (4, 6, 9, 12, 14, 20, 22, 25, 27, 39, 41) = stop & konfirmasi ke user.
- Pint/lint HANYA di task 14, 22, 27, & 41 (satu kali per gelombang kerja, aturan CLAUDE.md), bukan per task. Commit per task boleh; `git push` menunggu instruksi eksplisit user.
- **Revisi 6** (task 29-41): murni frontend (kecuali task 29 yang JUGA menyentuh `Filter/DateSelector.jsx` existing — refactor extract, BUKAN backend). Task 29 (extract parser tanggal) WAJIB selesai sebelum 34 (embed date picker + partial-suggestion bergantung modul hasil extract itu). Task 30/31/32/33/35/36/37/38 independen satu sama lain — bisa dikerjakan paralel. Task 32 (relation checkbox-multi) SEBAIKNYA sesudah 31 (list/boolean checkbox-multi) selesai dulu — pola render/state-nya mirip, kerjakan yang sederhana dulu supaya pola sudah teruji sebelum dipakai di kasus yang lebih rumit (fetch async + persist).
- **Revisi 3** (task 16-22): murni frontend, TIDAK ada file backend baru — tak perlu migration/PHPUnit baru, tapi tetap re-run suite BE existing di checkpoint 22 sbg regresi (draft-apply mengubah kapan `onTreeChange` dipanggil, bisa pengaruhi test yg asumsikan instant-apply di halaman lain).
- Task 16 (staged-apply) WAJIB selesai & lulus sebelum 17/18/19 dikerjakan (17-19 semua bergantung `draftTree`/`applyDraft` ada) — beda dari task 1-15 yang gelombangnya lebih paralel.
- **Revisi 4** (task 23-27): juga murni frontend. Task 23 SUDAH selesai (dikerjakan lebih dulu sbg bounded fix). Task 24.1 WAJIB selesai sebelum 24.2/24.3 (keduanya bergantung `pickColumn` yg sudah disederhanakan) — 24.2 dan 24.3 sendiri independen satu sama lain (bisa paralel).
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
    { "id": 17, "tasks": ["14", "15"] },
    { "id": 18, "tasks": ["16.1"] },
    { "id": 19, "tasks": ["16.2"] },
    { "id": 20, "tasks": ["16.3"] },
    { "id": 21, "tasks": ["16.4", "17.1", "17.2", "18.1", "18.2", "19.1", "19.2"] },
    { "id": 22, "tasks": ["17.3", "18.3", "19.3"] },
    { "id": 23, "tasks": ["20"] },
    { "id": 24, "tasks": ["21.1"] },
    { "id": 25, "tasks": ["22"] },
    { "id": 26, "tasks": ["23.1", "23.2"] },
    { "id": 27, "tasks": ["23.3"] },
    { "id": 28, "tasks": ["24.1"] },
    { "id": 29, "tasks": ["24.2", "24.3"] },
    { "id": 30, "tasks": ["25"] },
    { "id": 31, "tasks": ["26.1"] },
    { "id": 32, "tasks": ["26.2", "26.3", "26.4"] },
    { "id": 33, "tasks": ["27"] },
    { "id": 34, "tasks": ["28.1", "28.2", "28.3", "28.4", "28.5"] },
    { "id": 35, "tasks": ["29", "30.1", "30.2", "33", "35", "36", "37", "38"] },
    { "id": 36, "tasks": ["31"] },
    { "id": 37, "tasks": ["32", "34.1"] },
    { "id": 38, "tasks": ["34.2", "34.3"] },
    { "id": 39, "tasks": ["39"] },
    { "id": 40, "tasks": ["40.1", "40.2", "40.3"] },
    { "id": 41, "tasks": ["41"] }
  ]
}
```
