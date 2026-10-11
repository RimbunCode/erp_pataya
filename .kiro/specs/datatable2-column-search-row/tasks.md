# Implementation Plan: datatable2-column-search-row

## Overview

Menambah Baris Filter Kolom di `Table2` (opt-in lewat prop `columnFilter`, hanya diisi `DataTable2`) dengan Sel Filter per kolom yang berbagi logika input nilai dengan Search Bar atas. Pendekatan: **ekstrak dulu, bangun kemudian** — logika nilai dan draft dikeluarkan dari `SearchBar.jsx` (fungsi murni → `useSearchDraft` → `useColumnValueInput` → komponen dropdown/chip) dengan seluruh tes `SearchBar` hijau tanpa ubah assertion di tiap tahap; baru setelah itu Sel Filter, Baris Filter, integrasi `Table2`/CSS/`DataTable2`, i18n, dan verifikasi browser.

Yang TIDAK berubah: semantik staged-apply Search Bar atas, backend, tampilan mobile (kartu), `AdvanceSearchDialog`/`SelectModel` (memakai `Table2`/`SearchBar` tanpa prop baru).

## Tasks

- [x] 1. Baseline jaring pengaman
  - [x] 1.1 Jalankan baseline tes frontend yang akan dilindungi
    - Jalankan `npx vitest run` untuk: `Components/Table/Search/`, `Components/Table/Table2*.test.jsx`, `Components/Table/Header.rtl.test.jsx`, `Pages/Core/DataTable2.rtl.test.jsx`, `Components/LinkModel/AdvanceSearchDialog*.test.jsx`
    - Catat jumlah file/tes lulus sebagai angka patokan di bagian Notes (dipakai membandingkan setelah tiap ekstraksi)
    - Gunakan `rtk proxy` bila perlu mendeteksi warning `act()` yang disembunyikan reporter compact
    - _Requirements: 10.3, 9.5_

- [x] 2. Ekstraksi fungsi murni ke `valueInputUtils.js`
  - [x] 2.1 Pindahkan helper murni dari kepala `SearchBar.jsx`
    - Buat `resources/js/Components/Table/Search/valueInputUtils.js`; pindahkan apa adanya: `CHIP_CLASS`/`chipClass`, `SET_OPTIONS`, `leafCheckedList`, `leafExcluded`, `listOptionsFor`, `recordLabel`, `sameLabel`, `normalizeDatePayload`, `dateNoticeText` (SearchBar.jsx ±118-264)
    - `groupChipLabel` dan helper `recentColumns` TETAP di `SearchBar.jsx` (khusus Search Bar atas)
    - `SearchBar.jsx` meng-import dari modul baru; tanpa perubahan perilaku
    - _Requirements: 10.1_

  - [x] 2.2 Tambah `canEditLeafInCell` dan `buildEditorPrefill`
    - `canEditLeafInCell(column, leaf)` → `"edit" | "dotted" | "builder"`: `"builder"` bila `leaf.v?.mode === "column"`, atau kolom string bebas (tanpa opsi) dengan `o ∈ {=, !=, starts_with, ends_with}`, atau number/currency dengan `o === "!between"`; `"dotted"` untuk leaf bertitik tanpa kolom ter-resolve; selain itu `"edit"` bila `resolveValueMode(column)` ada
    - `buildEditorPrefill(column, chip, ctx)` memindahkan logika prefill dari `openEditorForChip` (SearchBar.jsx:2159-2263: `initialText`/`initialChecked`/`initialRecords`/`initialTextChips`/`initialDateChips`/`editId`)
    - `openEditorForChip` memakai kedua fungsi itu; fallback akhir tetap `onOpenBuilder(draftTree)`
    - _Requirements: 8.5, 8.6, 10.1_

  - [x] 2.3 Write unit tests for valueInputUtils (`valueInputUtils.test.js`)
    - **Test: `canEditLeafInCell` untuk matriks tipe kolom × operator**
    - Cakup: leaf mode kolom → builder; string `=`/`!=`/`starts_with`/`ends_with` → builder; string ber-opsi `=` → edit; number `!between` → builder; number `between`/`>=` → edit; date `in_period` → edit; `set`/`!set` → edit; leaf bertitik tanpa kolom → dotted
    - Cakup `buildEditorPrefill` ekuivalen dengan prefill lama untuk tiap mode (text/number/list/relation/date, leaf negasi)
    - **Validates: Requirements 8.5, 8.6**

  - [x]* 2.4 Write property test for edit identity (`valueInputUtils.property.test.js`)
    - **Property 5: Konsistensi keputusan edit** — jika `canEditLeafInCell` = `"edit"`, prefill lalu `computeCheckedLeafPatch` tanpa perubahan input menghasilkan leaf ekuivalen leaf asal
    - `fc.pre()` disamakan dengan validasi `isColumnSearchable`/`buildLeafFromText`
    - **Validates: Requirements 8.6**

- [x] 3. Checkpoint - Ensure task 2 tests pass
  - Jalankan seluruh tes pada 1.1; jumlah dan assertion tidak boleh berubah. Ensure all tests pass, ask the user if questions arise.

- [x] 4. Ekstraksi draft ke `useSearchDraft`
  - [x] 4.1 Buat hook `useSearchDraft`
    - File `resources/js/Components/Table/Search/useSearchDraft.js`; pindahkan dari `SearchBar.jsx`: `draftTree`, `draftGroup`, `pendingSaved`, `busyRef`/`busy`, `commitTree`, `applyDraft(treeOverride?)`, effect reset dari `tree`/`group`, `isDraftDirty`
    - Semantik `applyDraft` TIDAK berubah (menolak saat busy; `onPickSaved(pendingSaved)`; `isFilterTreeDirty`/`sameGroups`)
    - _Requirements: 7.3, 7.5, 6.7_

  - [x] 4.2 Tambah `commitTreeChange(updater)` dan `draftRef`
    - `draftRef.current` disalin sinkron di wrapper `setDraftTree`; `commitTreeChange` menghitung `next = updater(draftRef.current)`, `setDraftTree(next)`, lalu `applyDraft(next)`
    - Menolak (`Promise.reject(new Error("busy"))`) saat host sibuk
    - _Requirements: 7.4, 6.6, 6.7_

  - [x] 4.3 `SearchBar` memakai `useSearchDraft` (mode tak terkontrol dulu)
    - Ganti state draft internal dengan `const ownDraft = useSearchDraft(...)`; belum ada prop `draft`
    - Semua referensi `draftTree`/`setDraftTree`/`applyDraft`/`commitTree`/`busy` mengarah ke objek hook
    - _Requirements: 7.6, 9.5_

  - [x] 4.4 Write RTL tests for useSearchDraft (`useSearchDraft.rtl.test.jsx`)
    - **Test: apply menolak saat busy; reset dari `tree` luar; `commitTreeChange` beruntun tidak kehilangan perubahan**
    - Render hook via komponen uji; `onTreeChange` mengembalikan Promise tertunda; dua `commitTreeChange` berurutan sebelum render ulang → kedua leaf ada di tree yang di-apply terakhir
    - Gunakan `waitFor` dari `@testing-library/react` (bukan `vi.waitFor`/fake timers)
    - **Validates: Requirements 7.4, 7.5, 6.7**

- [x] 5. Checkpoint - Ensure task 4 tests pass
  - Jalankan seluruh tes 1.1 (SearchBar mode tak terkontrol harus identik). Ensure all tests pass, ask the user if questions arise.

- [x] 6. Ekstraksi logika nilai ke `useColumnValueInput`
  - [x] 6.1 Pindahkan state dan turunan
    - File `.../Search/useColumnValueInput.js`; pindahkan state: `valueColumn`, `inputValue`, `valueError`, `editingLeafId`, `checkedValues`, `selectedRecords`, `textChips`, `dateChips`, `datePickerValue`, `editingValueChipKey`, `highlightedValueChipKey`, `optionNavigated`, `optionDismissed`, `highlightedKey` + ref `knownRecordsRef`/`latestRef`/`datePickerRef`/`widgetPointerRef`
    - Pindahkan turunan: `vmode`, `excludeMode`, `isChipMode`, `isBooleanColumn`, `chipSeparators`, `multiParts`, `searchText`, `allListOptions`, `listUncheckedOptions`, `datePresets`, `dateSuggestions`, `dateParseCtx`, `reuiDateValue`, `relationSearch` (`useLinkModelOptions`), `relationUncheckedOptions`, `valueChips`, `visibleValueChips`, `setOptions`, `visibleKeys`, `hasOptionIntent`, `optionClass`, bagian value dari `legendCtx`
    - Turunan berat hanya aktif saat `valueColumn` ada (idle murah; `useLinkModelOptions` `open` dikontrol)
    - _Requirements: 10.2_

  - [x] 6.2 Pindahkan aksi dan ganti dependensi host dengan callback
    - Pindahkan: `enterValueMode`, `exitValueMode`, `pickListValue`, `pickBooleanValue`, `pickRecord`, `addDateValues`, `handleDatePickerChange`, `removeValueChip`, `startEditValueChip`, `absorbTypedText`, `absorbPendingText`, `computeCheckedLeafPatch`, `finishValueMode`, `pickSetOperator`, `commitCheckedSelectionSync`, `resolveRelationLabels`, `resolveSegments`
    - API hook: `{onCommit(patch, {editId, apply}), onRequestOpen, onRequestClose, busy, inputRef}`; `commitLeafAndApply`/`updateDraftLeaf`/`closeDropdown`/`applyDraft` yang dulu dipanggil langsung diganti callback itu
    - _Requirements: 10.2, 6.1, 6.2, 6.3_

  - [x] 6.3 Pindahkan `handleChange` dan `handleKeyDown` (value-mode)
    - `handleChange(e)` = cabang `isChipMode` dari `handleInputChange` (paste `|`, `chipEntryViolation`, `absorbTypedText`)
    - `handleKeyDown(e)` = cabang value-mode dari `handleInputKeyDown` (navigasi opsi, navigasi/hapus chip nilai 2 langkah, Backspace-kosong keluar, Escape commit+keluar, Tab-autocomplete label, Enter chip/selesai/tanggal); mengembalikan `true` bila event ditangani
    - _Requirements: 4.1-4.4, 5.5, 6.1, 6.2, 11.2_

  - [x] 6.4 `SearchBar` mengonsumsi `useColumnValueInput`
    - `onCommit`: `apply=false` → `updateDraftLeaf(patch, editId)`; `apply=true` → `commitLeafAndApply(patch)` (fungsi lama tetap di SearchBar)
    - `handleInputKeyDown` mempertahankan urutan: (1) chip utama mode key → (2) `Enter && !open` → `applyDraft` → (3) panah Panel → `setHighlightedChipId(null)` lalu (4) delegasi `value.handleKeyDown(e)` bila `mode === "value"` → (5) cabang key-mode tersisa (`Backspace` chip utama, `Escape` tutup dropdown, `Tab`/`:` lengkapi kolom)
    - `handleInputChange` delegasi ke `value.handleChange` bila `isChipMode`
    - _Requirements: 10.2, 10.3, 9.5_

  - [x] 6.5 Write tests for the hook contract (`useColumnValueInput.rtl.test.jsx`)
    - **Test: kontrak `onCommit`** — text `>=5`+Enter+Enter → `onCommit({k,o:">=",v:5},{editId:null,apply:false})`; boolean pilih → `apply:true`; edit leaf → `editId` terisi; `Diisi` → `{o:"set"}`
    - Test: `handleKeyDown` mengembalikan `true`/`false` sesuai cabang; ketikan tak valid → `valueError`, tak commit
    - **Validates: Requirements 6.1, 6.2, 6.3, 4.3, 4.4, 10.2**

- [x] 7. Checkpoint - Ensure task 6 tests pass
  - Jalankan seluruh tes 1.1; `SearchBar.rtl.test.jsx` (5.805 baris) harus lulus tanpa ubah assertion. Verifikasi di browser (production build) satu alur tiap tipe (text, number, list, relation, date) pada Search Bar atas karena jsdom tidak menangkap bug klik label ganda/fokus Radix. Ensure all tests pass, ask the user if questions arise.

- [x] 8. Ekstraksi komponen dropdown dan chip nilai
  - [x] 8.1 Buat `ValueChipList`
    - File `.../Search/ValueChipList.jsx`: chip nilai `bg-secondary`, klik untuk edit (text/number/date), `×` dengan `onMouseDown preventDefault`, ring `destructive` saat tersorot; pindahkan dari SearchBar.jsx ±3141-3184
    - _Requirements: 5.3, 5.4, 5.5, 10.2_

  - [x] 8.2 Buat `ColumnValueDropdown`
    - File `.../Search/ColumnValueDropdown.jsx`: isi `CommandList` mode value (opsi list/boolean + `BadgeStatus`, preset+saran tanggal, record relasi + `LoadingIcon`, `Diisi`/`Tidak diisi`, indikator "Kecualikan", widget `ReuiDateSelector` dua kolom, footer `SearchLegend`); pindahkan dari SearchBar.jsx ±3295-3590
    - Props `{value: controller, column, t}`; pembungkus `<Command shouldFilter={false} ...>` dan `<PopoverContent>` tetap di pemanggil (cmdk butuh input sebagai keturunan DOM `Command` yang sama)
    - _Requirements: 3.3-3.6, 3.7, 4.5, 10.2_

  - [x] 8.3 `SearchBar` memakai kedua komponen
    - Ganti JSX inline dengan `<ValueChipList/>` dan `<ColumnValueDropdown/>`; cabang `showPanel`/saran tetap di SearchBar
    - _Requirements: 10.2, 9.5_

- [x] 9. Checkpoint - Ensure task 8 tests pass
  - Jalankan seluruh tes 1.1 dan cek visual Search Bar atas di browser. Ensure all tests pass, ask the user if questions arise.

- [x] 10. Draft terkontrol: `SearchBar` + `DataTable2`
  - [x] 10.1 Prop `draft` pada `SearchBar`
    - `const draft = draftProp ?? ownDraft;` (hook `useSearchDraft` tetap selalu dipanggil); `AdvanceSearchDialog` tetap tanpa prop → perilaku lama
    - _Requirements: 7.3, 7.6_

  - [x] 10.2 `DataTable2` memanggil `useSearchDraft`
    - `const draft = useSearchDraft({tree: filterTree, group: options.group, onTreeChange, onGroupChange, onPickSaved})` dan oper `draft={draft}` ke `<SearchBar>`
    - _Requirements: 7.3, 7.4, 7.5_

  - [x] 10.3 Write RTL tests for controlled draft (`SearchBar.draft.rtl.test.jsx`, tambah di `DataTable2.rtl.test.jsx`)
    - **Test: SearchBar mode terkontrol membaca/menulis draft dari prop; tanpa prop berperilaku lama**
    - **Test: commit lewat `draft.commitTreeChange` dari luar memunculkan chip di Search Bar; draft atas yang belum di-apply ikut ter-apply**
    - **Validates: Requirements 7.2, 7.3, 7.4, 7.6**

- [x] 11. Fungsi murni badge dan operasi tree baru
  - [x] 11.1 `leafValueBadges` dan `removeLeafValue` di `searchChips.js`
    - `leafValueBadges(node, column, t, opts)`: label nilai-saja (`=`/`in`/`matches` → nilai; `!=`/`!in`/`!matches`/`!in_period` → `≠ nilai`; `>`/`>=`/`<`/`<=` → `> 100`; `between` → `a..b`; `set`/`!set` → `Diisi`/`Tidak diisi`); leaf `in` multi → satu badge per nilai (`valueKey`)
    - `removeLeafValue(tree, leafId, valueKey)`: sisa 1 nilai → turun ke `=`/`!=`; sisa 0 → leaf dihapus; id tak ada → tree apa adanya
    - Ekspor lewat blok `export {…}` yang ada; `leafToChip` tidak berubah
    - _Requirements: 5.1, 5.2, 5.4, 5.6_

  - [x] 11.2 Buat `columnBadges.js`
    - `leafBelongsToColumn(k, column)` (`k === name` atau relasi `k` berawalan `${name}.`), `badgesForColumn(chips, column, ctx)` → `Badge[]` (`key`, `leafId`, `valueKey`, `label`, `tooltip`, `negated`, `op`, `editable`), `columnsUsedInAdvanced(chips)` → `Set<string>`
    - `editable` dari `canEditLeafInCell` (task 2.2); chip bukan-leaf tidak menghasilkan badge
    - _Requirements: 5.1, 3.5, 8.1, 8.2, 8.5, 8.7_

  - [x] 11.3 Write unit tests for badges (`columnBadges.test.js`, tambah di `searchChips.test.js`)
    - **Test: `leafBelongsToColumn` (relasi bertitik), label badge (`≥ 100`, `≠ Draft`, `a..b`, `Diisi`), `in` multi → banyak badge, `columnsUsedInAdvanced`, `removeLeafValue` (n≥2, n=2→`=`, n=1, id tak ada)**
    - **Validates: Requirements 5.1, 5.2, 5.4, 8.1, 8.2**

  - [x]* 11.4 Write property tests (`columnBadges.property.test.js`)
    - **Property 1: Partisi badge** — tiap leaf anak-root masuk ≤ 1 kolom; chip search/advanced tak menghasilkan badge
    - **Property 2: Commit menjaga node lain** — `addLeafChip`/`updateChip`/`removeLeafValue` tak mengubah node anak-root lain selain target (kecuali merge `=`/`in`)
    - **Property 3: Round-trip teks ↔ leaf** — `buildLeafFromText(c, leafToText(buildLeafFromText(c, s)))` ekuivalen
    - **Property 4: Hapus nilai** — n≥2 → n−1 nilai berurutan; n=1 → leaf hilang
    - **Property 6: Derivasi murni** — badge hanya fungsi dari tree/kolom/locale
    - **Property 7: Idempotensi merge** — commit nilai sama dua kali tak menambah nilai
    - **Validates: Requirements 5.1, 5.4, 6.6, 7.4, 8.1, 8.4**

- [x] 12. Checkpoint - Ensure task 10-11 tests pass
  - Jalankan seluruh tes 1.1 + tes baru. Ensure all tests pass, ask the user if questions arise.

- [x] 13. Sel Filter dan Baris Filter
  - [x] 13.1 Buat `ColumnFilterCell`
    - File `.../Search/ColumnFilterCell.jsx`, props `{column, draft, chips, advancedUsed, onOpenBuilder}`; satu `useColumnValueInput` per sel; `onCommit` → `draft.commitTreeChange(t => editId ? updateChip(t, editId, patch) : addLeafChip(t, patch))`
    - Kolom non-`isColumnSearchable` → sel kosong tanpa input; badge idle dari `badgesForColumn`; fokus input kosong → sesi baru, klik badge → sesi edit (badge itu disembunyikan selama sesi); `×` badge → `commitTreeChange(t => removeLeafValue(...))`; badge `editable:"builder"` → `onOpenBuilder(draft.draftTree)`
    - Blur TIDAK commit (ketikan dipertahankan); Escape = `exitValueMode()` tanpa commit; `busy` → `readOnly` + `LoadingIcon`; indikator + tooltip bila kolom ada di `advancedUsed`
    - Popover (`Command` + `PopoverContent`) memakai `ColumnValueDropdown`; `useLinkModelOptions` aktif hanya saat sesi relasi aktif dan popover terbuka; badge wrap `flex-wrap gap-1 max-h-[5.25rem] overflow-y-auto`; `aria-label` judul kolom; input mentah `border-0! shadow-none! focus:ring-0! focus-visible:ring-0!`; `span` di sel pakai `inline-flex!`/`flex-row!` bila perlu display selain block
    - _Requirements: 3.1-3.9, 4.1-4.5, 5.1-5.7, 6.1-6.8, 7.2, 8.2, 8.4, 8.5, 8.7, 10.4, 11.1-11.5_

  - [x] 13.2 Buat `ColumnFilterRow`
    - File `.../Search/ColumnFilterRow.jsx`: `<tr>` berisi `<th aria-hidden>` kosong untuk `selectable`/`actions`, lalu `ColumnFilterCell` per `showedColumns` (urutan sama dengan header); hitung `treeToChips(draft.draftTree, columns, t, opts)` dan `columnsUsedInAdvanced` SEKALI (`useMemo`) lalu oper ke sel
    - _Requirements: 1.1, 1.3, 1.4, 1.5_

  - [x] 13.3 Write RTL tests for ColumnFilterCell (`ColumnFilterCell.rtl.test.jsx`)
    - **Test: text dengan `!x`, `>=5`, `a|b`; list picker; badge edit (klik) dan hapus (×); Backspace dua langkah; Enter ke-1 jadi chip, Enter ke-2 commit; blur tidak commit; Escape membuang; badge read-only → `onOpenBuilder`; indikator advanced; sel kosong untuk kolom non-searchable; `readOnly` saat busy**
    - Render komponen sungguhan, query berbasis role/label (`ui/checkbox` memakai `role="forminput"`); pakai real timers + `waitFor` (bukan fake timers dengan Radix/cmdk)
    - **Validates: Requirements 3.1-3.9, 4.1-4.4, 5.3-5.5, 6.1-6.5, 6.7, 8.2, 8.5**

  - [x] 13.4 Write RTL tests for ColumnFilterRow (`ColumnFilterRow.rtl.test.jsx`)
    - **Test: satu sel per kolom tampil dalam urutan `showedColumns`; sel pengisi untuk `selectable`/`actions`; badge turunan `draft.draftTree`; commit sel ↔ chip tree sinkron**
    - **Validates: Requirements 1.1, 1.3, 1.4, 7.1, 7.2**

- [x] 14. Integrasi `Table2`, CSS, dan `DataTable2`
  - [x] 14.1 Prop `columnFilter` dan baris di `<thead>` (`Table2.jsx`)
    - Prop opsional `columnFilter`; setelah `<tr>` judul render `{columnFilter && <ColumnFilterRow ... />}`; tanpa prop → output identik dengan sebelumnya
    - _Requirements: 1.1, 1.2, 1.7, 9.4_

  - [x] 14.2 Sticky dua baris dan pengukuran tinggi
    - `table.css`: tambah `thead tr:nth-child(2) th { sticky z-3 bg-muted border-b …; top: var(--column-header-height, 0px) }`
    - Efek `--group-sticky-top` (Table2.jsx ±599-619): observe SEMUA `th` kedua baris, set `--column-header-height` = tinggi terbesar baris 1 dan `--group-sticky-top` = baris1 + baris2; deps eksplisit `[selectable, actions, showedColumns, Boolean(columnFilter)]`; guard `typeof ResizeObserver === "undefined"` dipertahankan
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 9.1_

  - [x] 14.3 `DataTable2` memberi `columnFilter` ke `Table2`
    - `columnFilter={{columns: mapColumns, draft, onOpenBuilder: (d) => {setBuilderDraftFilter(d ?? null); setBuilderOpen(true);}}}`
    - Tampilan mobile (kartu) tidak berubah karena `Table2` tidak dirender di sana
    - _Requirements: 1.7, 9.3, 9.4_

  - [x] 14.4 Write RTL tests for integration (`Table2.columnFilter.rtl.test.jsx`, tambah di `DataTable2.rtl.test.jsx`)
    - **Test: baris filter tampil hanya dengan `columnFilter`; tanpa prop DOM `<thead>` identik dengan sebelumnya; kolom di-hide/reorder → sel mengikuti; commit sel memanggil `onTreeChange` dengan tree benar; baris tetap tampil saat `isLoading`/data kosong**
    - **Validates: Requirements 1.1, 1.2, 1.4, 1.7, 9.2, 9.4**

- [x] 15. i18n
  - [x] 15.1 Tambah kunci di `lang/en/core/datatable.php` dan `lang/id/core/datatable.php`
    - `core.datatable.column_search.placeholder.{text,number,list,date,relation}`, `.advanced_used`, `.readonly_builder`, `.clear` (tanpa placeholder yang saling berawalan)
    - _Requirements: 12.1, 12.2, 3.9_

  - [x] 15.2 Jalankan tes i18n
    - `php artisan test --compact --filter=LangPlaceholderPrefixTest` dan `--filter=LocaleKeysTest`
    - _Requirements: 12.2_

- [x] 16. Checkpoint - Ensure all frontend tests pass
  - Jalankan seluruh tes frontend terkait (bukan seluruh suite serial): per batch paralel (Search/, Table/, Pages/Core/DataTable2, LinkModel). Ensure all tests pass, ask the user if questions arise.

- [x] 17. Verifikasi browser (production build)
  - [x] 17.1 Build dan siapkan data
    - `npm run build` (bukan Vite dev); server `php artisan serve --no-reload`; login `admin`/`admin` (jangan ubah password); tanpa migrasi (tidak ada perubahan backend)
    - _Requirements: 13.4_

  - [x] 17.2 Skenario per tipe kolom
    - Text (`!x`, `a|b`), number (`>=5`, `1..9`, `!5`), list/status (pilih + kecualikan), boolean, relation (cari + pilih record, leaf lama bertitik), date (preset + ketik periode + widget), `Diisi`/`Tidak diisi`; badge edit/hapus/Backspace dua langkah; `POST /saved-filters` tidak 422 untuk leaf baru tiap tipe
    - _Requirements: 3.1-3.6, 4.1-4.4, 5.3-5.5, 13.4, 13.5_

  - [x] 17.3 Skenario layout dan sinkron
    - Sticky dua baris + `--group-sticky-top` gabungan saat grouping aktif; handle resize tidak menutupi tepi kanan sel filter; resize/reorder/hide kolom saat sel punya ketikan; badge wrap dan scroll internal 3 baris; draft atas yang belum di-apply ikut ter-apply saat Enter di sel; root OR multi-kondisi tetap bisa ditambah dari sel; badge builder (leaf mode kolom, `starts_with`, `!between`) → buka Builder; kolom non-searchable kosong
    - _Requirements: 2.1-2.4, 7.1-7.4, 8.2-8.5, 9.1, 13.4_

- [x] 18. Final checkpoint - Ensure all tests pass
  - Jalankan seluruh tes frontend (per batch paralel) dan tes PHP i18n; jalankan `npm run lint` (ESLint) dan formatter HANYA setelah semua task selesai; `graphify update .` bila tool tersedia. Ensure all tests pass, ask the user if questions arise.

- [x] 19. Draft langsung (sinkron saat mengetik; permintaan lanjutan user)
  - [x] 19.1 `addLeafChip` opsi `{merge:false}` dan hook `useLiveDraft.js`
    - `useLiveDraftState` (`baseFor`, `markCommitted`, `liveLeafId`) dan `useLiveDraftSync` (debounce 150 ms, leaf dilacak lewat id, pulihkan saat sesi berakhir tanpa commit)
    - _Requirements: 14.1-14.6_

  - [x] 19.2 Integrasi `ColumnFilterCell` dan `SearchBar`
    - Sel: `onCommit` memakai `baseFor`/`markCommitted`; badge sesi aktif disembunyikan. Search Bar: aktif hanya bila `draft` terkontrol; chip live disembunyikan; klik di `[data-column-filter-row]` bukan klik-luar
    - _Requirements: 14.7-14.10_

  - [x] 19.3 Write tests for live draft
    - **Tes: ketikan valid masuk draft tanpa apply; diperbarui di tempat; tak valid menghapus; Escape memulihkan; Enter tanpa duplikat; edit badge + Escape; dua sel bergantian; badge sesi disembunyikan; Search Bar atas → badge sel**
    - **Validates: Requirements 14.1-14.10**

## Notes

- Setiap task mereferensi requirement spesifik untuk traceability.
- Urutan "ekstrak dulu, bangun kemudian": task 2-9 tidak menambah perilaku baru; hasilnya harus identik dengan sebelumnya (tes `SearchBar` lama tanpa ubah assertion adalah bukti).
- Task optional (`- [x]*`): 2.4 dan 11.4 (property-based test `fast-check`) DIKERJAKAN atas permintaan user ("kerjakan semua tasks").
- Angka patokan baseline (task 1.1) dicatat di sini saat dikerjakan: 51 file, 1433 tes lulus (vitest: Components/Table, Pages/Core/DataTable2.rtl.test.jsx, Components/LinkModel; durasi ±12 menit — jalankan per-folder saat iterasi, suite penuh hanya di checkpoint).
- Jalankan PHP lewat PowerShell/PATH sesuai konfigurasi lingkungan; frontend lewat `npx vitest run`. Hindari `vi.useFakeTimers()` pada tes yang melibatkan Radix Popover/cmdk (macet); pakai real timers + `waitFor`.
- jsdom tidak menangkap: klik label ganda (`<label htmlFor>`), `hasPointerCapture` Radix (polyfill sudah ada di `test-setup.js`), sticky/`ResizeObserver` nyata; semuanya diverifikasi di task 17.
- Commit hanya saat diminta eksplisit; jangan push tanpa perintah.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2", "4.1"] },
    { "id": 3, "tasks": ["2.3", "2.4", "4.2"] },
    { "id": 4, "tasks": ["4.3"] },
    { "id": 5, "tasks": ["4.4"] },
    { "id": 6, "tasks": ["6.1"] },
    { "id": 7, "tasks": ["6.2"] },
    { "id": 8, "tasks": ["6.3"] },
    { "id": 9, "tasks": ["6.4"] },
    { "id": 10, "tasks": ["6.5", "8.1", "8.2"] },
    { "id": 11, "tasks": ["8.3"] },
    { "id": 12, "tasks": ["10.1", "11.1"] },
    { "id": 13, "tasks": ["10.2", "11.2"] },
    { "id": 14, "tasks": ["10.3", "11.3", "11.4"] },
    { "id": 15, "tasks": ["13.1"] },
    { "id": 16, "tasks": ["13.2", "15.1"] },
    { "id": 17, "tasks": ["13.3", "13.4", "14.1", "15.2"] },
    { "id": 18, "tasks": ["14.2", "14.3"] },
    { "id": 19, "tasks": ["14.4"] },
    { "id": 20, "tasks": ["17.1"] },
    { "id": 21, "tasks": ["17.2", "17.3"] }
  ]
}
```

## Catatan Implementasi

- Ekstraksi dilakukan mekanis (skrip memotong rentang baris `SearchBar.jsx` ke modul baru) lalu diverifikasi: seluruh tes folder `Search/` + `AdvanceSearchDialog` (709 tes) lulus TANPA ubah assertion setelah tiap tahap (2, 4, 6, 8). `SearchBar.jsx` turun dari 3.662 ke ±1.500 baris.
- Deviasi dari design dicatat di bagian "Catatan Implementasi" `design.md`.
- Verifikasi browser (production build, `php artisan serve --no-reload` di port 8012, DB dev MySQL lokal, tanpa migrasi): halaman Items (text, relasi), Purchase Orders (tanggal, status, relasi), grouping aktif (`--group-sticky-top` = baris judul + baris filter), mobile (tanpa baris filter), regresi Search Bar atas (saran kolom/nilai).
