# Implementation Plan: LinkModel Grouping & Search Bar

## Overview

Mesin grup `DataTable2` (BE `Services/Core/DataTable/Group/`, FE `Components/Table/Group/`) dipakai ulang; yang dibangun adalah adapter per host. Urutan: (1) BE gerbang keamanan + `selectData` + `model` (paginasi flat dan grup), (2) FE seam reuse (`useGroupNode` menerima fetcher, sumber in-memory, util auto-expand), (3) `LinkModel` dropdown (prop `group`, tree lazy, infinite scroll, tanpa `limit`/"more", cache mode client), (4) Advance Search Dialog (SearchBar, GroupTree, grup awal dari prop), (5) i18n + verifikasi.

**Tidak berubah:** macro `dataTable()` dan aturan "XHR tanpa `groupPath` mengabaikan `group`", `DataTable2`, `SelectModel`, `ChartLinkModel`, `ModelController::columns`, kontrak `SearchBar`, `useLinkModelOptions` untuk konsumen `limit` (SearchBar).

## Tasks

- [x] 1. Gerbang keamanan kolom untuk jalur grup (BE)
  - [x] 1.1 Helper gerbang level grup ∩ kolom aman
    - Di `ModelController` (atau kelas kecil di `app/Services/Core/DataTable/Group/`): `sanitizeLinkModelGroups(array $levels, $target, $safe, $columns)` = `GroupColumnGate::sanitizeColumns` lalu buang level yang tidak ada di `safeLookupColumns` (kolom `linkable`/sumber `templateLink`)
    - Helper `filterGroupResult(array $result, ...)`: terapkan `filterRowColumns` ke tiap baris `type:"rows"` dan ke objek `label` relasi pada deskriptor `groups`
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 1.2 Write feature tests untuk gerbang keamanan
    - **Test: kolom non-linkable tidak bisa jadi level grup dan tidak muncul di JSON expand (`rows` maupun `label`)**
    - **Validates: Requirements 3.1–3.5**

- [x] 2. `selectData` mendukung grup (BE)
  - [x] 2.1 Cabang grup di `ModelController::selectData`
    - Baca `group`, `groupGranularity`, `groupRange`, `groupPath`, `groupPage`; normalkan `GroupLevels::normalize`; resolve lewat `GroupLevelResolver` atas `$query` yang SUDAH berisi `baseFilters`, `filters`, `search`, addSelect kolom aman
    - `GroupNodeQuery::groups()`/`rows()` dengan `show` = PAGE_SIZE; `groupPath` lewat `GroupPath::parse` (422 bila invalid)
    - Tanpa `groupPath`: respons level-0 + `columns`, `templateLinkColumns`, `groupMeta`, `defaultGroups`; dengan `groupPath`: `{type,data,current_page,last_page,total,per_page}` lewat helper 1.1
    - Tanpa `group`/`groupPath`: jalur flat tidak disentuh (byte-identik)
    - `defaultGroups` efektif dibagikan pada respons awal
    - _Requirements: 1.5, 3.2, 3.3, 4.1–4.6_

  - [x] 2.2 Write feature tests `selectData` grup
    - **Test: paritas constraint (`baseFilters`+`filters`+`search`), level-0 + expand nested, `groupPath` invalid 422, `groupPage` invalid = 1, zero-overhead tanpa `group`, macro tetap mengabaikan `group` untuk XHR konsumen lain**
    - **Validates: Requirements 4.1–4.7, 9.1, 11.1**

- [x] 3. Route `model` (`__invoke`): paginasi flat + grup (BE)
  - [x] 3.1 Paginasi flat
    - Param `page`/`show` (tanpa `group`): paginasi + `current_page`, `last_page`, `per_page`, `total`; tanpa `page` perilaku `limit` lama persis sama
    - _Requirements: 5.4, 8b.4_

  - [x] 3.2 Cabang grup
    - `group`/`groupPath`/`groupPage` memakai helper 1.1; hormati `filters`, `search`, `keywords`; `joins` + `group` = grup diabaikan; `cacheMode` tidak memakai jalur grup
    - _Requirements: 5.1–5.5_

  - [x] 3.3 Write feature tests route `model`
    - **Test: paginasi flat (batas halaman, tanpa `page` = `limit` lama), grup paritas `filters`/`search`/`keywords`, `joins`+`group`, `cacheMode`+`group` tetap flat, safe-column pada `rows`/`label`**
    - **Validates: Requirements 5.1–5.5, 8b.4, 11.1, 11.1a**

- [x] 4. Checkpoint - Ensure backend tests pass
  - Jalankan test BE terkait paralel per-batch (`php artisan test --compact --filter=...`), termasuk regresi `DataTableScopeGroupingTest` dan test `ModelController` existing.
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Seam reuse frontend
  - [x] 5.1 `useGroupNode` menerima fetcher
    - Ekstrak transport (saat ini GET index) menjadi opsi `fetcher({params})`; default = perilaku lama (DataTable2 tak berubah); kunci cache tambah namespace host
    - Test lama `useGroupNode.test.js` dan `GroupTree.rtl.test.jsx` tetap hijau tanpa perubahan asersi
    - _Requirements: 8.3, 9.3_

  - [x] 5.2 Sumber in-memory untuk `GroupTree` (cache mode)
    - Adapter yang mengelompokkan array di client (`groupLevels.js`: kolom string, relasi, boolean), `count`, filter `search`; mengembalikan bentuk respons node yang sama
    - Level bucket (date/number) dibuang dari grup efektif cache mode
    - _Requirements: 8.8, 8.9_

  - [x] 5.3 Util auto-expand
    - Fungsi murni `computeAutoExpand(items, {budget, maxGroups})` → daftar kunci-path yang dibuka (kumulatif `count` ≤ anggaran, maks 3 grup level-0, grup pertama selalu dibuka, rekursif per sub-grup)
    - `GroupTree` menerima prop `autoExpand` (dijalankan saat `search`/data level-0 berubah; toggle manual dipertahankan)
    - _Requirements: 8.10–8.13_

  - [x] 5.4 Write unit/RTL tests
    - **Test: `computeAutoExpand` (anggaran, batas 3, grup pertama selalu, rekursif), adapter in-memory (count, search), `GroupTree` autoExpand tidak melawan toggle manual**
    - **Validates: Requirements 8.8–8.13**

- [x] 6. `useLinkModelOptions` infinite (mode search)
  - [x] 6.1 Mode infinite
    - Opsi `infinite` (`useInfiniteQuery`, `page`/`show`=25, reset ke halaman 1 saat `search`/`filters` berubah); tanpa opsi ini perilaku `limit` lama tetap (SearchBar)
    - Kembalikan `fetchNextPage`, `hasNextPage`, `isFetchingNextPage`
    - _Requirements: 8b.2, 8b.4, 8b.8_

  - [x] 6.2 Write tests hook
    - **Test: halaman ditambahkan, reset saat search berubah, mode non-infinite tak berubah**
    - **Validates: Requirements 8b.2, 8b.4, 8b.8**

- [x] 7. `LinkModel` dropdown
  - [x] 7.1 Prop `group` + resolusi grup efektif
    - Hapus prop `limit`; tambah `group`; grup efektif = `props.group` (termasuk `[]`) → `defaultGroups` dari respons awal → `[]`
    - _Requirements: 1.1–1.6, 8b.1_

  - [x] 7.2 Flat infinite scroll, hapus baris "more"
    - `InfiniteScrollSentinel` di dasar `CommandList`; hapus `showMore`/`MORE_VALUE`; Advance Search tetap sticky; sorotan keyboard dipertahankan saat halaman ditambah; cache mode render bertahap (jendela 25)
    - _Requirements: 8b.2, 8b.3, 8b.6, 8b.7_

  - [x] 7.3 Dropdown tree (mode search) dan client-tree (cache mode)
    - `GroupTree` dalam `Command`: header = baris non-seleksi toggle (↑/↓/Enter), `rows` = `CommandItem` opsi (`convertTemplateLink`), mode infinite; fetcher POST `route("model")`; search terisi → auto-expand; search kosong → tertutup; cache mode → sumber in-memory
    - Prototipe keyboard cmdk lebih dulu; bila tidak layak, berhenti dan minta persetujuan user (A7)
    - _Requirements: 8.1–8.15, 8b.5_

  - [x] 7.4 Write RTL tests `LinkModel`
    - **Test: prop `group` vs default vs `[]`, buka grup + pilih opsi, reset + auto-expand saat search, infinite (flat & dalam tree), baris "more" hilang, cache mode client-tree, zero-overhead tanpa grup**
    - **Validates: Requirements 1.1–1.4, 8.1–8.15, 8b.1–8b.8, 9.1**

- [x] 8. Checkpoint - Ensure dropdown tests pass
  - Jalankan `LinkModel.rtl.test.jsx`, `useLinkModelOptions*`, `GroupTree*`, `useGroupNode*`; tanpa `vi.useFakeTimers`.
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Advance Search Dialog
  - [x] 9.1 Ganti kotak cari dengan `SearchBar`
    - Hapus `InputGroup`/state `search`; `SearchBar` (`columns`=`filterColumnMap`, `tree`=`additiveFilters`, `getSearchColumns`=kolom sumber `templateLink`, `model`, `groupOptions`, `group`/`onGroupChange`, `onOpenBuilder` ke `FilterTable2` controlled dengan `lockedFilters`)
    - `initialSearch` → chip "Cari" awal saat dialog dibuka
    - _Requirements: 2.1–2.7_

  - [x] 9.2 `useAdvanceSearchModel` cabang grup + `GroupTree`
    - Grup aktif → `useInfiniteQuery` flat `enabled:false`; level-0 via `selectData` + `group` (pager); `GroupTree` desktop (`renderRow` = `TableRow`, klik = pilih) dan mobile (tombol `templateLink`); reset state terbuka saat search/tree/grup berubah
    - _Requirements: 6.1–6.7_

  - [x] 9.3 Grup awal dari prop `LinkModel`
    - `LinkModel` meneruskan grup efektif ke Dialog; inisialisasi tiap dialog dibuka; perubahan di panel lokal saja; `[]` → tanpa grup
    - _Requirements: 7.1–7.5_

  - [x] 9.4 Write RTL tests Dialog
    - **Test: SearchBar → tree → payload `selectData`, carry-over `initialSearch`, mode grup + pilih baris, grup prop → chip awal + reset saat dibuka ulang, perubahan panel tak memengaruhi dropdown, `[]` eksplisit**
    - **Validates: Requirements 2.1–2.7, 6.1–6.7, 7.1–7.5**

- [x] 10. i18n
  - [x] 10.1 Key baru id + en
    - Hanya yang benar-benar baru (mis. "dimuat / total" bila belum ada); hapus key `core.form.linkmodel.more` bila tak terpakai lagi; `LocaleKeysTest` lulus
    - _Requirements: 10.1, 10.2_

- [x] 11. Final checkpoint - Verifikasi menyeluruh
  - Full suite BE dan FE paralel per-batch; Pint + ESLint sekali di akhir
  - Verifikasi manual: `npm run build` (bukan dev server), MySQL `only_full_group_by` pada `selectData`/`model`, keyboard dropdown (↑/↓/Enter/Tab setelah halaman ditambah), dialog mobile
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Setiap task mereferensi requirement untuk traceability; checkpoint 4, 8, 11 memastikan validasi inkremental.
- Gerbang keamanan (task 1) adalah prasyarat task 2 dan 3; jangan membuka endpoint grup sebelum 1.2 hijau.
- Asumsi A1–A7 di requirements.md masih berlaku kecuali yang sudah diganti keputusan user (A5: cache mode client; tanpa `limit`).
- Task 7.3 berisiko tinggi (cmdk + tree dinamis + infinite); prototipe dulu, jangan lanjut ke tree penuh sebelum keyboard terbukti.
- TODO terbuka: dukungan bucket date/number di cache mode client (saat ini dibuang dari grup efektif).
- Pint/ESLint hanya di akhir (task 11), bukan per task.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "5.1", "5.3"] },
    { "id": 1, "tasks": ["1.2", "2.1", "3.1", "5.2", "5.4", "6.1"] },
    { "id": 2, "tasks": ["2.2", "3.2", "6.2"] },
    { "id": 3, "tasks": ["3.3", "7.1"] },
    { "id": 4, "tasks": ["7.2"] },
    { "id": 5, "tasks": ["7.3"] },
    { "id": 6, "tasks": ["7.4", "9.1"] },
    { "id": 7, "tasks": ["9.2"] },
    { "id": 8, "tasks": ["9.3", "10.1"] },
    { "id": 9, "tasks": ["9.4"] }
  ]
}
```
