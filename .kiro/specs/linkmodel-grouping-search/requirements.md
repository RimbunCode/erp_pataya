# Requirements Document

## Introduction

Requirements ini diturunkan dari [design.md](design.md) (alur `design-first`). `DataTable2` sudah punya Search Bar (chip, saran, Filter Tersimpan) dan grouping bertingkat lazy (`GroupTree`) — lihat [`datatable2-advanced-search`](../datatable2-advanced-search/requirements.md) dan [`datatable2-group-tree`](../datatable2-group-tree/requirements.md). `LinkModel` belum memilikinya: Advance Search Dialog masih memakai kotak teks + tombol `FilterTable2`, dan opsi dropdown selalu flat.

Spec ini membawa tiga hal ke `LinkModel`: (1) Advance Search Dialog memakai `SearchBar` dan mendukung grouping bertingkat; (2) opsi dropdown dapat dikelompokkan bertingkat dengan tree lazy; (3) prop `group` dengan fallback `$defaultGroups` model, yang juga menjadi grup awal dialog.

Mesin grup (BE `GroupLevels`, `GroupLevelResolver`, `GroupPath`, `GroupNodeQuery`; FE `groupLevels.js`, `GroupTree`, `useGroupNode`, `GroupLevelsEditor`) **dipakai ulang**, bukan diduplikasi. Risiko utama adalah keamanan kolom: expand grup pada macro mengembalikan JSON yang melewati `ModelController::filterRowColumns()`, sehingga jalur grup `selectData` dan `model` harus menerapkan penyaring kolom aman sendiri (lihat [`linkmodel-column-security`](../linkmodel-column-security/requirements.md)).

> **Asumsi (Open Questions design.md yang belum dijawab user, memakai rekomendasi — koreksi bila tidak setuju):** (A1) SearchBar dipakai dengan staged-apply persis DataTable2; (A2) teks yang sudah diketik di input LinkModel dibawa sebagai chip "Cari"; (A3) level grup dibatasi ke kolom `groupable` ∩ kolom aman (`linkable`/sumber `templateLink`); (A4) `joins` + `group` = grup diabaikan; (A5) ~~cache mode lazy ke server~~ **diganti keputusan user:** cache mode mengelompokkan di client; (A6) level-0 dialog dipaginasi dengan pager (bukan infinite); (A7) dropdown tree diprototipe dulu, fallback ke "flat + header" hanya atas persetujuan user.

## Glossary

- **Groups**: daftar level group berurutan `{column, granularity, range}`, maks 4 (kontrak `datatable2-group-tree`).
- **Grup efektif LinkModel**: `Groups` hasil resolusi `props.group` → `Model::getDefaultGroups()` model target → `[]`.
- **Dialog**: `AdvanceSearchDialog`.
- **Dropdown tree**: `GroupTree` yang dirender di dalam `Command`/cmdk dropdown `LinkModel`.
- **Kolom aman**: kolom yang lolos `safeLookupColumns` (`linkable` atau sumber `templateLink`).
- **Jalur grup**: request `selectData`/`model` yang membawa `group` dan/atau `groupPath`.
- **Jalur flat**: perilaku `selectData`/`model` saat ini tanpa grup.

## Requirements

### Requirement 1: Prop `group` dan resolusi grup efektif

**User Story:** As pengembang modul, I want mengatur grup `LinkModel` lewat prop dengan fallback ke default model, so that dropdown dan dialog langsung tampil terkelompok sesuai konteks form.

#### Acceptance Criteria

1. THE `LinkModel` SHALL menerima prop opsional `group` dalam bentuk apa pun yang diterima `normalizeGroupLevels` (string, list string, list objek, campuran).
2. WHEN `props.group` diberikan (termasuk `[]`), THE grup efektif SHALL = `props.group` dan SHALL TIDAK membaca `$defaultGroups` model.
3. WHEN `props.group` tidak diberikan, THE grup efektif SHALL = `Model::getDefaultGroups()` model target.
4. WHEN kedua sumber kosong, THE `LinkModel` SHALL memakai jalur flat dengan jumlah dan isi query identik dengan sebelum spec ini.
5. THE endpoint SHALL membagikan `defaultGroups` (efektif, lolos gate) pada respons awal bersama `columns` agar FE dapat fallback tanpa request tambahan.
6. THE level yang tidak lolos gate (Requirement 3) SHALL dibuang diam-diam; THE FE SHALL menampilkan hanya level yang lolos (dari `groupMeta.levels`).

### Requirement 2: Advance Search Dialog memakai `SearchBar`

**User Story:** As user, I want kotak cari di dialog yang sama dengan DataTable2, so that saya memakai chip, saran, dan filter tersimpan yang sudah saya kenal.

#### Acceptance Criteria

1. THE Dialog SHALL mengganti `InputGroup` (kotak teks + tombol `FilterTable2`) dengan `SearchBar` tanpa perubahan kontrak `SearchBar`.
2. THE `columns` SHALL = `filterColumnMap` (semua kolom schema), `tree`/`onTreeChange` SHALL = `additiveFilters`/`setAdditiveFilters`, dan `getSearchColumns` SHALL = kolom sumber `templateLink`.
3. THE prop `filters` LinkModel (`baseFilters`) SHALL tetap AND dan tampil locked/read-only di Builder lanjutan.
4. THE state `search` string SHALL dihapus; teks bebas SHALL menjadi chip "Cari" pada `tree` (Asumsi A1).
5. WHEN Dialog dibuka dengan `initialSearch` tidak kosong, THE Dialog SHALL menjadikannya chip "Cari" awal (Asumsi A2).
6. THE panel SearchBar SHALL menampilkan Filter Tersimpan untuk `model` dan kolom Group by memakai `GroupLevelsEditor`.
7. THE `AdvanceSearchDialog.filterColumns` dan perilaku pilih-baris (`trimToLinkModelPayload`, `onSelect`) SHALL tidak berubah.

### Requirement 3: Gerbang keamanan kolom pada jalur grup

**User Story:** As pemilik data, I want grouping tidak membuka data yang tidak boleh dilihat user, so that kontrol kolom aman `linkmodel-column-security` tetap utuh.

#### Acceptance Criteria

1. THE level grup SHALL lolos `GroupColumnGate::sanitizeColumns` DAN `safeLookupColumns` (Asumsi A3); level lain SHALL dibuang diam-diam.
2. THE baris `type:"rows"` SHALL disaring `filterRowColumns` sebelum dikirim.
3. THE `label` relasi pada deskriptor grup SHALL disaring dengan aturan kolom aman relasi yang sama dengan jalur flat.
4. IF tidak ada level yang lolos, THEN THE endpoint SHALL memakai jalur flat.
5. THE test SHALL membuktikan kolom non-linkable tidak muncul pada JSON expand (`rows` maupun `label`).

### Requirement 4: Backend `selectData` mendukung grup

**User Story:** As sistem, I want Advance Search meng-expand grup lewat endpoint yang sama, so that constraint pencarian dan filter tetap konsisten.

#### Acceptance Criteria

1. WHEN request `selectData` membawa `group`, THE endpoint SHALL menjalankan `GroupNodeQuery` di atas `$query` yang sudah memuat `baseFilters`, `filters`, dan `search`.
2. WHEN `groupPath` tidak ada, THE endpoint SHALL mengembalikan level-0 (deskriptor grup, `current_page/last_page/total`) beserta `columns`, `templateLinkColumns`, `groupMeta`, dan `defaultGroups`.
3. WHEN `groupPath` ada, THE endpoint SHALL mengembalikan `{type, data, current_page, last_page, total, per_page}` (bentuk `datatable2-group-tree` Req 7.2).
4. THE `groupPath` invalid SHALL 422 `{message}`; `groupPage` invalid SHALL dianggap 1.
5. THE `show` SHALL membatasi tiap list (level-0, sub-grup, baris).
6. WHEN tidak ada `group`/`groupPath`, THE endpoint SHALL berperilaku byte-identik dengan sebelumnya.
7. THE macro `dataTable()` SHALL tidak melonggarkan aturan "XHR tanpa `groupPath` mengabaikan `group`" bagi konsumen lain (`datatable2-group-tree` Req 7.5, 10.3).

### Requirement 5: Backend route `model` (dropdown) mendukung grup

**User Story:** As sistem, I want dropdown LinkModel dapat meng-expand grup lewat route `model`, so that opsi dapat dikelompokkan lazy.

#### Acceptance Criteria

1. WHEN request `model` membawa `group`, THE `__invoke` SHALL menghormati `filters`, `search`, `keywords`, dan scope kolom aman, dan `show` (PAGE_SIZE) SHALL membatasi tiap list per node.
1a. WHEN request `model` membawa `page` tanpa `group`, THE `__invoke` SHALL memaginasi hasil (`page`, `show`) dan mengembalikan `current_page`, `last_page`, `per_page`, `total`; tanpa `page`, perilaku `limit` lama SHALL tidak berubah (konsumen lain, mis. live-suggestion relasi SearchBar).
2. THE protokol `groupPath`/`groupPage` dan bentuk respons SHALL identik dengan Requirement 4.
3. IF request membawa `joins` bersama `group`, THEN THE endpoint SHALL mengabaikan `group` (jalur flat) (Asumsi A4).
4. WHEN tidak ada `group`/`groupPath`, THE `__invoke` SHALL berperilaku byte-identik dengan sebelumnya.
5. THE `cacheMode` SHALL TIDAK memakai jalur grup server: payload cache mode SHALL tidak berubah dan grup dihitung di client (Requirement 8.8–8.9).

### Requirement 6: Advance Search Dialog menampilkan grouping

**User Story:** As user, I want mengelompokkan hasil di dialog bertingkat dan membuka grup sesuai kebutuhan, so that saya cepat menemukan record di data besar.

#### Acceptance Criteria

1. WHEN grup efektif dialog tidak kosong, THE Dialog SHALL merender `GroupTree` (desktop dan mobile) menggantikan `Table2` flat dan `InfiniteScrollSentinel`.
2. THE level-0 SHALL dimuat dengan infinite scroll (halaman level-0 ditambahkan saat sentinel terlihat; keputusan implementasi, menggantikan Asumsi A6 "pager"); THE daftar flat SHALL digantikan `GroupTree` saat grup aktif (satu `useInfiniteQuery` melayani flat maupun level-0).
3. THE `renderRow` desktop SHALL = baris `Table2`/`TableRow` (klik = pilih); mobile SHALL = tombol `templateLink` yang ada.
4. THE semua grup SHALL tertutup secara default dan isinya di-fetch saat dibuka (aturan `datatable2-group-tree` Req 14).
5. WHEN `search`/`tree`/grup berubah, THE state terbuka SHALL direset.
6. WHEN user memilih baris, THE Dialog SHALL memanggil `onSelect` dengan payload yang sama seperti jalur flat.
7. THE `GroupLevelsEditor` di panel SearchBar SHALL hanya menawarkan kolom `groupable` yang aman.

### Requirement 7: Grup prop → grup awal Dialog

**User Story:** As user, I want dialog langsung terkelompok seperti dropdown, so that konteks grup tidak hilang saat saya membuka Advance Search.

#### Acceptance Criteria

1. WHEN Dialog dibuka, THE grup awal dialog SHALL = grup efektif `LinkModel` (Requirement 1), dan chip Group by SHALL langsung terisi.
2. THE inisialisasi SHALL diulang tiap Dialog dibuka (pola `initialSearch`).
3. WHEN user mengubah grup di panel dialog, THE perubahan SHALL hanya memengaruhi state lokal dialog dan SHALL TIDAK mengubah dropdown.
4. WHEN Dialog ditutup lalu dibuka lagi, THE grup SHALL kembali ke grup efektif `LinkModel`.
5. WHEN `props.group = []`, THE Dialog SHALL dibuka tanpa grup, dan user SHALL tetap dapat mengelompokkan sendiri.

### Requirement 8: Dropdown options dengan tree lazy

**User Story:** As user, I want opsi dropdown terkelompok bertingkat yang bisa dibuka per grup, so that daftar panjang mudah dijelajahi.

#### Acceptance Criteria

1. WHEN grup efektif tidak kosong, THE dropdown SHALL merender `GroupTree` di dalam `Command`; header grup SHALL berupa baris non-seleksi (toggle buka/tutup), anak `rows` SHALL berupa `CommandItem` opsi memakai `convertTemplateLink`.
2. THE baris sentinel `more`/`add`/`advance_search` SHALL tetap di dasar dropdown.
3. THE `useGroupNode` SHALL dipakai dengan transport POST `route("model")`; kunci cache SHALL mencakup `model`, `filters`, `search`, `groupPath`, `groupPage`.
4. WHEN `search` berubah, THE pohon SHALL direset (state terbuka dikosongkan) lalu menerapkan aturan auto-expand (kriteria 10–12).
5. THE keyboard ↑/↓/Enter pada header grup SHALL men-toggle; Tab-autocomplete SHALL hanya berlaku pada baris opsi.
6. THE pemilihan opsi, `onValueChange`, dan resolve `defaultValue` SHALL berperilaku sama seperti jalur flat.
7. IF prototipe menunjukkan tree lazy tidak layak dengan keyboard cmdk, THEN THE tim SHALL meminta persetujuan user sebelum turun ke "flat + header" (Asumsi A7).
8. WHEN `cacheMode` aktif DAN grup efektif tidak kosong, THE dropdown SHALL mengelompokkan `filteredOptions` di client (grup, `count`, filter `search`) tanpa request grup ke server.
9. THE pengelompokan client SHALL mendukung kolom string, relasi, dan boolean; kolom bertipe bucket (date/time/datetime/number/currency) pada cache mode SHALL dibuang dari grup efektif (**[TODO konfirmasi]**).
10. WHEN `search` terisi, THE setiap request node SHALL membawa `search`, sehingga level-0 hanya memuat grup yang punya baris cocok dan `count` SHALL = jumlah baris cocok.
11. WHEN `search` terisi, THE dropdown SHALL membuka grup level-0 berurutan selama jumlah kumulatif `count` ≤ `PAGE_SIZE` (maks 3 grup level-0; grup pertama selalu dibuka), dan SHALL menerapkan aturan yang sama rekursif pada sub-grup dengan anggaran tersisa, tanpa request tambahan untuk memutuskan.
12. WHEN `search` kosong, THE semua grup SHALL tertutup tanpa auto-expand.
13. THE auto-expand SHALL hanya berjalan saat `search` atau data level-0 berubah; THE toggle manual user pada data yang sama SHALL dipertahankan.
14. THE highlight teks cocok SHALL hanya pada baris opsi; header grup SHALL TIDAK di-highlight.
15. THE baris Advance Search SHALL tetap sticky di dasar dan SHALL membuka Dialog dengan `search` (chip "Cari") dan grup efektif.

### Requirement 8b: Daftar options tanpa `limit` (infinite scroll)

**User Story:** As user, I want daftar opsi terus dimuat saat saya scroll, so that saya tidak terhenti di sepuluh opsi pertama dan tidak perlu membuka Advance Search hanya untuk melihat sisanya.

#### Acceptance Criteria

1. THE prop `limit` SHALL dihapus dari `LinkModel`; THE daftar opsi SHALL dimuat per halaman `PAGE_SIZE` = 25.
2. WHEN `InfiniteScrollSentinel` di dasar `CommandList` terlihat dan masih ada halaman berikutnya, THE dropdown SHALL memuat dan menambahkan halaman berikutnya di bawah opsi yang ada.
3. THE baris "more" (`core.form.linkmodel.more`) SHALL dihapus; THE baris Advance Search SHALL tetap ada.
4. THE mode search tanpa grup SHALL memakai `useInfiniteQuery` atas route `model` dengan `page`/`show`; THE `useLinkModelOptions` SHALL tetap menerima `limit` bagi konsumen lain dengan perilaku tidak berubah.
5. WHEN grup aktif, THE isi node dan daftar level-0 dropdown SHALL memakai mode infinite `GroupTree` (halaman ditambahkan di bawah, header menampilkan "dimuat / total", gagal halaman berikutnya menampilkan "Coba lagi" tanpa membuang yang sudah ada); THE pager per node SHALL tidak dipakai di dropdown.
6. WHEN `cacheMode` aktif, THE dropdown SHALL merender bertahap (jendela `PAGE_SIZE` bertambah saat sentinel terlihat).
7. THE sorotan keyboard (cmdk) dan posisi scroll SHALL dipertahankan saat halaman baru ditambahkan.
8. WHEN `search`/`filters` berubah, THE daftar SHALL kembali ke halaman 1.

### Requirement 9: Zero overhead dan non-regresi

**User Story:** As pemilik banyak form yang memakai `LinkModel`, I want form tanpa grouping berperilaku identik, so that fitur baru tidak mengganggu yang sudah jalan.

#### Acceptance Criteria

1. WHEN tidak ada grup efektif, THE `LinkModel`, Dialog, `selectData`, dan `model` SHALL berperilaku identik dengan sebelum spec ini (jumlah dan isi query sama).
2. THE `SelectModel`, `ChartLinkModel`, `ModelController::columns`, dan konsumen macro lain SHALL tidak berubah.
3. THE `DataTable2` dan mesin grup SHALL tidak berubah perilakunya.

### Requirement 10: i18n

**User Story:** As user (id/en), I want semua teks baru terlokalisasi, so that antarmuka konsisten.

#### Acceptance Criteria

1. THE key baru SHALL ada di `lang/id` dan `lang/en`; `LocaleKeysTest` SHALL lulus.
2. THE key existing (`group_by`, `granularity.*`, `datatable.search.*`) SHALL dipakai ulang.

### Requirement 11: Cakupan pengujian dan verifikasi

**User Story:** As pengembang, I want fitur tercakup test dan verifikasi manual pada blind spot CI, so that regresi dan kegagalan khas MySQL tertangkap.

#### Acceptance Criteria

1. THE test BE (PHPUnit) SHALL mencakup: paritas constraint (`baseFilters`+`filters`+`search`), safe-column pada `rows` dan `label`, gate `groupable`∩aman, `groupPath` invalid 422, zero-overhead tanpa `group`, `joins`+`group`, `cacheMode`+`group`.
1a. THE test BE SHALL mencakup paginasi flat route `model` (`page`/`show`, batas halaman, tanpa `page` = perilaku `limit` lama).
1b. THE test FE SHALL mencakup infinite scroll dropdown (flat, dalam pohon, cache mode), penghapusan baris "more", dan sorotan keyboard tetap setelah halaman ditambahkan.
2. THE test FE (Vitest) SHALL mencakup: Dialog dengan SearchBar (chip → tree → `selectData`), mode grup (pilih baris), carry-over `initialSearch`, grup prop → grup awal dan reset saat dibuka ulang, `LinkModel` dropdown tree (buka grup, pilih opsi, reset saat search berubah, prop `group` vs default), `useAdvanceSearchModel` cabang grup; tanpa `vi.useFakeTimers`.
3. THE verifikasi manual SHALL mencakup `npm run build` (bukan dev server), MySQL `only_full_group_by` pada `selectData`/`model`, keyboard dropdown, dan dialog mobile.
4. THE full suite BE dan FE SHALL dijalankan paralel per-batch; lint/Pint dijalankan sekali di akhir.

## Keputusan (dikonfirmasi user)

1. **Options dropdown** memakai tree lazy gaya DataTable2 (bukan flat + header run-length).
2. **Prop `group`** fallback ke `$defaultGroups` model; grup efektif menjadi grup awal Dialog.
3. **Alur** `design-first`.
