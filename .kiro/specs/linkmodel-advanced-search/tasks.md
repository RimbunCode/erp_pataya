# Implementation Plan: LinkModel Advanced Search

## Overview

Backend dulu (satu param request baru + satu field response baru di `ModelController::selectData()`), baru FE pure helpers, baru extension kecil ke 3 komponen shared (`Table2`, `ColumnsFilter`, `FilterTable2`) yang backward-compatible, baru orchestrator dialog baru, terakhir wiring ke `LinkModel.jsx`. Urutan ini memastikan tiap layer bisa ditest independen sebelum dipakai layer di atasnya. Tidak ada file existing yang direwrite — semua perubahan additive/opt-in (lihat design.md §5 tabel kompatibilitas mundur).

## Tasks

- [x] 1. Backend — `ModelController::selectData()`
  - [x] 1.1 Thread param `includeAllLinkable` ke `safeLookupColumns()`
    - Baca `$includeAllLinkable = $request->boolean('includeAllLinkable');` sebelum pemanggilan `safeLookupColumns()`
    - Ubah `$safe = $this->safeLookupColumns($target, $requested, $perm);` → `$safe = $this->safeLookupColumns($target, $requested, $perm, [], $includeAllLinkable);`
    - Tidak mengubah method `safeLookupColumns()` itu sendiri (parameter ke-5 sudah ada di signature)
    - **DITEMUKAN SAAT IMPLEMENTASI** (bukan di design.md awal): parameter ini saja TIDAK CUKUP — macro `dataTable()` (`DataTableScope::addDataTable`) punya adaptive-select SENDIRI berbasis cookie/`show`, tidak tahu soal `linkable`. Kolom aman kini dihitung SEBELUM `dataTable()` dipanggil + di-`addSelect()` eksplisit saat `includeAllLinkable` (additive, pola sama addSelect FK parentColumn yang sudah ada) — lihat komentar di kode.
    - _Requirements: 2.3_

  - [x] 1.2 Expose `templateLinkColumns` di response `selectData()`
    - Tambah key `'templateLinkColumns' => $this->templateLinkColumns($target),` ke array `response()->json([...])` di akhir `selectData()`
    - Method `templateLinkColumns()` (private, `ModelController.php:132`) tidak diubah — hanya call-site baru
    - _Requirements: 2.6, 7.2_

  - [x] 1.3 Write PHPUnit tests untuk 1.1 dan 1.2 (`tests/Feature/Http/ModelSelectDataTest.php`)
    - **Property 1 (kolom aman independen dari fields)**: `includeAllLinkable=true` tanpa `columns`/`fields` → kolom `linkable===true` TETAP ikut di row response; `includeAllLinkable` absen/`false` → kolom itu TIDAK ikut (perilaku lama, regresi `SelectModel` tak berubah)
    - Assert response menyertakan key `templateLinkColumns` berisi nama kolom sumber templateLink model yang diuji
    - **Property 4 (AND, bukan replace)**: sudah tercakup test existing `test_base_and_builder_filters_combined_with_and` (tidak diduplikasi)
    - Regresi: test existing di file ini (`test_returns_paginated_shape_without_select`, dll) tetap pass tanpa modifikasi assertion
    - Regresi lebih luas dijalankan: `PermissionLinkModelFieldsTest`, `MorphLookupFilterTest`, `LinkModelColumnSecurityTest`, `ModelControllerFilterTest`, `ModelControllerSoftDeleteTest`, `AssetServiceLinkModelSearchTest`, `PurchaseOrderCanUpdateScopeTest` — semua hijau (1 kegagalan awal murni infra `Vite manifest not found`, bukan regresi kode, selesai setelah `npm run build`)
    - **Validates: Requirements 2.3, 2.6, 5.2, 5.3, 7.2** — 24/24 PASS

- [x] 2. Checkpoint — pastikan semua test backend (1.3) pass sebelum lanjut ke FE
  - `php artisan test --compact tests/Feature/Http/ModelSelectDataTest.php` → 24 passed

- [x] 3. FE — pure helper functions (tanpa render, unit test node env)
  - [x] 3.1 `resources/js/Components/LinkModel/trimToLinkModelPayload.js` (BARU)
    - Implementasi sesuai pseudocode design.md §4: whitelist `id` + `ALWAYS_ALLOWED_ATTRIBUTES` + `templateLinkColumnNames` + `fields`
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 3.2 Write unit test `trimToLinkModelPayload.test.js`
    - **Property 2 (payload seleksi ⊆ payload dropdown biasa)**: `fields` kosong → hanya kolom struktural+templateLink ikut; `fields` sebagian → kolom itu ikut, kolom linkable lain TIDAK; kolom templateLink SELALU ikut walau tidak disebut di `fields`
    - **Validates: Requirements 7.1, 7.2, 7.3** — 6/6 PASS

  - [x] 3.3 `buildAdvanceSearchColumnMap()` di `resources/js/Components/LinkModel/useAdvanceSearchModel.js` (BARU, export terpisah dari hook di file yang sama)
    - Implementasi sesuai pseudocode design.md §3: filter `hidden`/`ignore`/relasi, filter `linkable===true` ATAU ada di `templateLinkColumnNames`, set `locked`+`show` untuk kolom templateLink
    - _Requirements: 2.3, 2.6, 2.7_

  - [x] 3.4 Write unit test `buildAdvanceSearchColumnMap.test.js`
    - **Property 1 (kolom aman independen dari fields)**: kolom non-linkable-non-templateLink terbuang; kolom templateLink dapat `locked:true`; kolom linkable lain dapat `locked:false`
    - **Validates: Requirements 2.3, 2.6, 2.7** — 8/8 PASS

- [x] 4. FE — data fetch hook
  - [x] 4.1 `useAdvanceSearchModel.js` — implementasi hook `useInfiniteQuery` (lengkapi file dari task 3.3)
    - `queryFn` POST `model.selectData` dengan `includeAllLinkable:true`, `baseFilters`, `filters`, `search` (debounced 300ms), `page`, `show:25`
    - `getNextPageParam` dari `current_page`/`last_page`
    - `enabled: open && !!model`
    - Return `columnMap`, `lockedColumnNames` (= `templateLinkColumns` dari response), `rows` (flatten semua pages), `total`, `isLoading`, `isFetchingNextPage`, `hasNextPage`, `fetchNextPage`
    - _Requirements: 2.5, 3.4_

  - [x] 4.2 Write hook test `useAdvanceSearchModel.rtl.test.jsx` (naming dikoreksi dari draft `.dom.test.js` — pola AKTUAL utk hook ber-`useInfiniteQuery`/`QueryClientProvider` adalah `.rtl.test.jsx`, lihat precedent `useLinkModelOptions.rtl.test.jsx`, bukan `useSelectModel.dom.test.js` yang tak pakai TanStack Query)
    - Mock `axios.post` → assert payload request memuat `includeAllLinkable:true`, `baseFilters`, `filters` sekaligus (bukan salah satu)
    - Assert `fetchNextPage()` memanggil `page` berikutnya & `rows` hasil akumulasi (append, bukan replace)
    - Assert `enabled=false` saat `open=false` (tidak fetch saat dialog tertutup)
    - **Validates: Requirements 2.5, 3.2, 3.4, 5.2, 5.3** — 4/4 PASS

- [x] 5. Checkpoint — pastikan semua test FE pure/hook (3.2, 3.4, 4.2) pass sebelum lanjut ke component extension
  - `npx vitest run resources/js/Components/LinkModel` → 4 files, 27 tests, semua PASS

- [x] 6. Extension — `resources/js/Components/Table/Table2.jsx` (`onRowClick`)
  - [x] 6.1 Tambah prop opsional `onRowClick?: (row) => void`
    - `<tr>` dapat `onClick={() => onRowClick?.(row)}` + `className` kondisional `cursor-pointer hover:bg-accent/50` saat `onRowClick` terisi
    - Default `undefined` — tidak ada perubahan visual/perilaku untuk konsumen existing (`SelectModel`, `DataTable2`)
    - _Requirements: 2.9 (desain §6)_

  - [x] 6.2 Write test tambahan di `Table2.rtl.test.jsx` + jalankan regresi
    - Test baru: klik baris dengan `onRowClick` terisi → callback dipanggil dengan row yang benar; TIDAK merender checkbox (mode `selectable` tak dipakai bareng)
    - Jalankan SEMUA test existing di file ini — pastikan hijau tanpa modifikasi assertion (bukti opt-in aman)
    - **Validates: Requirement 2.9 desain, backward-compat Table2** — 11/11 PASS

- [x] 7. Extension — `resources/js/Components/Table/ColumnsFilter.jsx` (`locked`)
  - [x] 7.1 Tambah dukungan field `locked` per-kolom
    - Kolom dengan `locked:true` dirender `FormCheckbox` `checked disabled` (bukan checkbox interaktif), `onCheckedChange` tidak dipanggil
    - Pola sama exclusion `primaryKey` yang sudah ada di baris kondisi yang sama (`if (hidden || ignore || name === primaryKey) return;`)
    - _Requirements: 2.6, 2.7_

  - [x] 7.2 Write test tambahan di `ColumnsFilter.rtl.test.jsx` + jalankan regresi
    - Test baru: kolom `locked:true` → checkbox disabled+checked, `onApply` tetap mengirim `show:true` untuk kolom itu walau disimulasikan klik (guard `disabled` mencegah event)
    - Jalankan SEMUA test existing di file ini — pastikan hijau
    - **Validates: Requirements 2.6, 2.7** — 9/9 PASS

- [x] 8. Extension — `resources/js/Components/Table/Filter/FilterTable2.jsx` (`lockedFilters`)
  - [x] 8.1 Tambah prop opsional `lockedFilters?: LinkModelFilterTree` + komponen privat `LockedFiltersSummary`
    - `FilterTableContent` merender `<LockedFiltersSummary tree={linkModelToFilterTree(lockedFilters, columns)} columns={columns} />` DI ATAS `<FilterBuilderBody />` saat `lockedFilters` terisi
    - **DITEMUKAN SAAT IMPLEMENTASI**: `FilterTable` (komponen default export) TIDAK menerima children/custom trigger sama sekali (hardcode Button/div sendiri) — Requirement 4.2 (tombol filter custom di dalam InputGroup) butuh prop tambahan `trigger?: ReactNode` (opsional, `AlertDialogTrigger asChild` render `{trigger ?? <built-in>}`). Ini yang ditandai "verifikasi lanjutan diperlukan" di draft design.md — sudah dikonfirmasi & diimplementasi.
    - `LockedFiltersSummary`: walk tree hasil `linkModelToFilterTree()` (reuse penuh, tidak reimplementasi konversi). **Disederhanakan dari draft design.md**: bukan `NestedSelect(disabled)+Select(disabled)+ValueField(disabled)` (butuh replikasi `buildColumnNode` kompleks dari `FilterItem2.jsx` + `ValueField` belum py prop `disabled` sama sekali di semua case-nya — perubahan lebih invasif dari yang perlu) — dipakai plain text label kolom+operator + `<LinkModel disabled>` KHUSUS kondisi relasi match-by-id (Requirement 5.8 eksplisit minta ini), nilai lain ditampilkan sbg teks. Fungsional sama, blast radius lebih kecil.
    - Group AND/OR dirender sebagai label statis, tanpa tombol wrap/remove
    - TIDAK menyentuh `useNestedFilters`/`FilterItem2`/`FilterGroup2` (state management additive filter tetap terisolasi)
    - _Requirements: 5.6, 5.7, 5.8_

  - [x] 8.2 Write test tambahan di `FilterTable2.rtl.test.jsx` + jalankan regresi
    - Test baru: `lockedFilters` berisi kondisi → baris locked tampil non-interaktif, terpisah visual dari additive
    - **Property 3 (badge exclude locked)**: badge count HANYA dari `initialFilters` (additive) — mengisi `lockedFilters` TIDAK menaikkan badge
    - Test baru: kondisi relasi match-by-id (`{ customer: { id: 5 } }`) di `lockedFilters` → merender `<LinkModel disabled>` (bukan angka id mentah) — butuh wrapper tambahan `QueryClientProvider`+`TooltipProvider`+mock `usePermission` (LinkModel real component, bukan di-mock)
    - Test baru: prop `trigger` custom → render trigger itu, BUKAN Button bawaan; tanpa `trigger` → Button bawaan tetap jalan (regresi)
    - Jalankan SEMUA test existing di file ini — pastikan hijau
    - **Validates: Requirements 5.6, 5.7, 5.8, 4.4 (Property 3)** — 14/14 PASS

- [x] 9. Checkpoint — pastikan semua test extension (6.2, 7.2, 8.2) + SELURUH regresi Table2/ColumnsFilter/FilterTable2/SelectModel/DataTable2 pass
  - `npx vitest run` gabungan Table2/ColumnsFilter/FilterTable2/SelectModel(+useSelectModel)/DataTable2 → **6 file, 106 test, semua PASS**, nol modifikasi assertion existing

- [x] 10. Komponen baru — `AdvanceSearchDialog`
  - [x] 10.1 `resources/js/Components/LinkModel/InfiniteScrollSentinel.jsx` (BARU, kecil)
    - IntersectionObserver sentinel yang RE-ARM tiap kali `enabled` berubah (beda dari `useInViewport` yang sekali `true` permanen — lihat design.md §2 alasan tidak reuse langsung)
    - Props: `onIntersect`, `enabled`, `loading` (tampilkan `LoadingIcon` saat `loading`)
    - _Requirements: 2.5, 3.4_

  - [x] 10.2 `resources/js/Components/LinkModel/AdvanceSearchDialog.jsx` (BARU) — search bar + filter trigger
    - `Dialog`/`DialogContent` (pola `SelectModel.jsx`), state `search` (init dari `initialSearch`, reset tiap `open` berubah — Requirement 6 AC3), state `additiveFilters`
    - `InputGroup` berisi `InputGroupAddon`(`FilterTable trigger={<InputGroupButton>...}` — bukan `asChild`, lihat catatan task 8.1 di atas) + `InputGroupInput` (search)
    - `<FilterTable>` (`FilterTable2.jsx`) dipanggil dengan `columns={columnMap}`, `initialFilters={additiveFilters}`, `lockedFilters={filters}` (prop `filters` diteruskan dari `LinkModel.jsx`, APA ADANYA), `onApply={setAdditiveFilters}`, `model={model}`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 5.1, 5.2, 5.4, 6.1, 6.2, 6.3_

  - [x] 10.3 `AdvanceSearchDialog.jsx` — tampilan desktop (`Table2` + infinite scroll)
    - `<div className="hidden lg:block">` berisi `<Table2 columns={columnMap} data={rows} isLoading isDynamicData persistColumns={false} onRowClick={handlePick} />` + `<InfiniteScrollSentinel>`
    - `handlePick(row)` = `onSelect(trimToLinkModelPayload(row, { fields, templateLinkColumnNames: lockedColumnNames }))` lalu `onOpenChange(false)` (pemangkasan + penutupan dialog TERJADI DI SINI, bukan di `LinkModel.jsx`)
    - **Security fix ditemukan saat implementasi**: `dangerouslySetInnerHTML={{__html: convertTemplateLink(row)}}` di list mobile (task 10.4) TANPA arg `search` ambil jalur `unescapeHtml` (plain-text, TIDAK aman utk innerHTML) — harus `convertTemplateLink(row, "")` (pola persis dropdown LinkModel existing). Ketauan dari security-guidance hook, diverifikasi baca `linkModelUtils.js`, difix sebelum lanjut.
    - _Requirements: 1.5, 2.1, 2.2, 2.4, 2.8, 2.9, 7.1_

  - [x] 10.4 `AdvanceSearchDialog.jsx` — tampilan mobile (list `templateLink` + infinite scroll)
    - `<div className="lg:hidden">` berisi list item `convertTemplateLink(row, "")` (lihat catatan keamanan 10.3) dengan `onClick={() => handlePick(row)}` + `<InfiniteScrollSentinel>` yang SAMA sumber data (`rows`) dengan desktop — CSS-toggle, bukan JS breakpoint/conditional-unmount
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 10.5 Write `AdvanceSearchDialog.rtl.test.jsx` (BARU)
    - Filter badge hanya dari additive (`filters` locked terisi, tanpa additive → tidak ada badge angka)
    - Klik baris (desktop, `Table2` REAL bukan mock) memanggil `onSelect` dengan payload yang SUDAH terpangkas sesuai `fields` — kolom non-linkable-non-fields (`valuation_rate`) terbukti terbuang, kolom templateLink source (`code`) terbukti selalu ikut
    - Tap item (mobile) memanggil `onSelect` dengan payload sama (perilaku identik desktop, sesuai Requirement 7)
    - `includeAllLinkable:true` + `baseFilters` sama2 terkirim (bukan salah satu)
    - **Validates: Requirements 2.1-2.9, 3.1-3.4, 4.3-4.4, 5.1-5.2, 7.1-7.3** — 4/4 PASS (Requirement 1/6 di-cover lewat `LinkModel.rtl.test.jsx`, task 11.2 — entry point & carry-over cuma bisa diuji realistis dari sisi `LinkModel.jsx` yg motorin state-nya)

- [x] 11. Wiring — `resources/js/Components/LinkModel.jsx`
  - [x] 11.1 Tambah entry point ke `AdvanceSearchDialog`
    - State baru `openAdvanceSearch` + `advanceSearchText` (snapshot terpisah, lihat bug di bawah)
    - `MORE_VALUE` `onSelect` (baris `// setOpenDialog(true);` yang sekarang kosong) → `setOpen(false); setOpenAdvanceSearch(true);`
    - Tombol baru "Advance Search" (`SearchIcon`, `aria-label` — icon-only butuh accessible name eksplisit) — selalu dirender, disembunyikan bareng dropdown saat `disabled`/`readOnly`
    - Render `<AdvanceSearchDialog>` dengan props sesuai design.md §1, `onSelect={(row) => { setOption(row); setOpenAdvanceSearch(false); }}` — TANPA trim di sini (trim sudah di `AdvanceSearchDialog` sendiri, task 10.3)
    - **Bug race condition NYATA ditemukan & difix** (bukan cuma soal test): klik tombol "Advance Search" men-trigger blur `Input` LEBIH DULU (`onBlur={() => setOpen(false)}` existing) → memicu efek exact-match-on-close existing (`!option && search` → `setSearch("")`) → `search` KE-WIPE sebelum `onClick` sempat membacanya utk carry-over (Requirement 6). Fix: (1) snapshot `search` ke state terpisah `advanceSearchText` SEBELUM `setOpen(false)` dipanggil, di KEDUA entry point; (2) `onMouseDown={(e) => e.preventDefault()}` di tombol baru (pola PERSIS `CommandList`'s existing guard utk masalah sama) supaya blur tak sempat terjadi sama sekali. `initialSearch` dioper dari `advanceSearchText` (snapshot), BUKAN `search` (state live yg rawan race).
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 6.1_

  - [x] 11.2 Extend `LinkModel.rtl.test.jsx`
    - Test baru: `showMore=false` (total ≤ limit) → baris "See more" TIDAK tampil, tombol "Advance Search" TETAP tampil
    - Test baru: `showMore=true` → baris "See more" tampil, klik → buka dialog yang sama dengan klik tombol "Advance Search"
    - Test baru: `disabled`/`readOnly` → tombol "Advance Search" tersembunyi
    - Test baru: ketik teks di input LinkModel lalu klik "Advance Search" → dialog menerima `initialSearch` sesuai teks itu (test inilah yang MENANGKAP bug race condition di atas — awalnya gagal, root-cause ditelusuri sampai `onBlur` existing, bukan diasumsikan)
    - Regresi: SEMUA test existing di file ini tetap pass (Tab-autocomplete, exact-match on close, `ADD_VALUE` tidak terpengaruh)
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 6.1** — 14/14 PASS

- [x] 12. Final checkpoint — full suite + verifikasi visual browser
  - `npm run test` penuh (Vitest) — **413 file, 5042 test, SEMUA PASS**, nol regresi lintas seluruh codebase FE.
  - `php artisan test --compact` (file terkait, memory_limit dinaikkan — full suite serial 128MB OOM, keterbatasan pre-existing environment ini, lihat `[[reference_parallel_test_batches]]`) — `ModelSelectDataTest` 28/28 PASS, regresi luas (`PermissionLinkModelFieldsTest`/`MorphLookupFilterTest`/`LinkModelColumnSecurityTest`/`ModelControllerFilterTest`/`ModelControllerSoftDeleteTest`/`AssetServiceLinkModelSearchTest`) 26/26 PASS.
  - **Verifikasi visual browser SUNGGUHAN dijalankan** (bukan diklaim tanpa bukti) — login admin ke DB dev real (MySQL lokal via Herd, `127.0.0.1:3307`, 250 record `Country`), buka `Settings > Company`, field "Negara" (pakai `CountryLinkModel`/LinkModel). Ditemukan & difix 4 bug NYATA yang lolos dari SEMUA test otomatis sebelumnya (stub test tak mereplikasi kondisi persis):
    1. **PK bukan `id` crash 500** — `Country` PK-nya `code`, bukan `id`. `safeLookupColumns()` selalu nambah literal `'id'` ke `$safe` (lama, harmless krn cuma dipakai filter array PHP) — kode `addSelect()` baru (task 1.1) PERTAMA KALI treat itu sbg nama kolom SQL asli → `SQLSTATE[42S22] Unknown column 'countries.id'`. Fix: skip key yang gak ada di metadata skema asli.
    2. **`$columns` list numerik, BUKAN keyed-by-name** — fix bug #1 di atas awalnya salah (`isset($columns[$name])` selalu false utk SEMUA kolom, bukan cuma phantom `id`, diam-diam nge-skip SEMUA `addSelect` — ketauan dari regresi test lama yg tadinya lolos jadi gagal). Fix: `array_column($columns, null, 'name')` bangun map by-name dulu (pola sama `safeLookupColumns()` sendiri).
    3. **`search` tidak pernah dibaca `selectData()` sama sekali** — requirements.md/design.md ASUMSI "mekanisme search yang sudah ada" ternyata SALAH; endpoint ini (dipakai `SelectModel` DAN Advance Search Dialog) tak pernah punya search bebas (beda dari `__invoke()`/"model"). Kotak pencarian dialog tampak jalan (gak error) tapi HASIL TAK PERNAH TERSARING. Fix: tambah blok search (kolom flat sumber templateLink, AND antar-kata) di `selectData()`, self-contained, tak sentuh `__invoke()`.
    4. **Race condition blur-vs-click men-wipe carry-over search** — klik tombol trigger dropdown memicu blur Input DULUAN (`onBlur` existing men-set `open=false`) → efek exact-match-on-close existing (`!option && search` → `setSearch("")`) jalan SEBELUM handler klik sempat baca `search` utk snapshot carry-over. Fix: snapshot `search` ke state terpisah SEBELUM `setOpen(false)`, plus (versi awal, sblm direstruktur jadi CommandItem) `onMouseDown preventDefault`.
  - **Perubahan UI mid-implementasi atas instruksi eksplisit user** (bukan draft desain awal): (a) search bar dialog dibuat **sticky top** (`position:sticky; top:0; z-index:10`, bg solid) — diverifikasi via computed style langsung di browser; (b) tombol "Advance Search" DIPINDAH dari icon button berdiri sendiri (desain awal) MENJADI `CommandItem` di dalam dropdown, dikelompokkan dgn `CommandItem` Add, SELALU sebelum Add, dan (atas klarifikasi lanjutan user) **SELALU dirender termasuk saat `loading`** (dipindah keluar dari ternary loading) — butuh guard tambahan (`hadDataOptionsRef`, deteksi transisi kosong→ada-data) supaya default-highlight keyboard tak "nempel" di sentinel begitu data asli datang (pola sama gotcha existing yg didokumentasikan MultiSelect/Select.jsx); (c) grup CommandItem Advance Search+Add dibuat **sticky bottom** (`position:sticky; bottom:0; z-index:10`, bg-popover) di dalam `CommandList` (scroll container asli: `max-h-[300px] overflow-y-auto`, lihat `ui/command.jsx`) — dibungkus `<div>` polos (BUKAN primitif cmdk), diverifikasi tak merusak keyboard-nav/registrasi item cmdk (14/14 test tetap lolos) + computed style di browser (`position:sticky; bottom:0px`).
  - Lint/Pint — DITUNDA, tunggu instruksi eksplisit user (aturan project: hanya setelah SEMUA task selesai, DAN konfirmasi user dulu sebelum jalan)

- [x] 13. Follow-up — perbaikan i18n (lang key hilang) + 1 bug title dialog ditemukan saat verifikasi ulang
  - Key `core.form.linkmodel.advance_search` (CommandItem "Advance Search") dan `core.datatable.filter.locked.label` (`LockedFiltersSummary`, task 8) belum pernah ditambahkan ke lang file — tampil sbg raw key mentah di browser. Fix: tambah ke `lang/en/core/form.php`, `lang/id/core/form.php`, `lang/en/core/datatable.php`, `lang/id/core/datatable.php`. `LocaleKeysTest` (parity en/id) PASS.
  - **Bug NYATA ke-5** ditemukan pas verifikasi visual ulang (bukan cuma lang): `AdvanceSearchDialog.jsx` `DialogTitle` pakai `{titleDialog ?? t("core.form.linkmodel.advance_search")}` — prop `titleDialog` dioper LinkModel.jsx SAMA PERSIS dgn title dialog "Add" (mis. "Pelanggan Baru"), jadi title dialog Advance Search KETIMPA jadi "Pelanggan Baru" alih-alih "Pencarian Lanjutan" — user bisa salah kira dialog yang kebuka adalah form Add. Fix: hapus prop `titleDialog` dari `AdvanceSearchDialog` seluruhnya (JSDoc, destructure, pemanggilan di LinkModel.jsx), title SELALU `t("core.form.linkmodel.advance_search")`.
  - Bug lain: `AdvanceSearchDialog.jsx` placeholder search input pakai key salah `t("core.form.search")` (gak ada di lang file, tampil raw) — seharusnya `core.form.search.placeholder` (key yang sudah eksis, dipakai komponen lain). Fix key + sinkronkan assertion di `LinkModel.rtl.test.jsx` (`"TR:core.form.search"` → `"TR:core.form.search.placeholder"`).
  - Root cause pola: `laravel-react-i18n` pakai Vite plugin (`laravel-react-i18n/vite`) yg BUNDLE lang PHP jadi JS saat build time (BUKAN baca file PHP live tiap request) — edit `lang/*.php` butuh `npm run build` ulang baru kelihatan efeknya di browser, beda dari asumsi awal (lang server-side "tak perlu build").
  - Verifikasi: `npx vitest run LinkModel.rtl.test.jsx AdvanceSearchDialog.rtl.test.jsx` 18/18 PASS. Visual browser (production build, port 8012, login admin/admin, halaman Sales Order Baru field Pelanggan): dropdown CommandItem tampil "Pencarian Lanjutan" (bukan raw key), dialog title benar "Pencarian Lanjutan", placeholder search "Cari", dialog Filter semua teks translated ("Cocokkan Semua (AND)", "Pilih Kolom", dst, tanpa raw key).

## Notes

- Tiap task mereferensi requirement spesifik untuk traceability (lihat `requirements.md`).
- Checkpoint (2, 5, 9, 12) memastikan validasi inkremental — jangan lanjut ke group berikutnya kalau checkpoint gagal.
- Task 6-8 (extension shared component) WAJIB checkpoint regresi (bukan cuma test baru) — komponen ini dipakai `SelectModel`/`DataTable2` di luar spec ini, blast radius harus dibuktikan nol lewat test existing yang tetap hijau, bukan diasumsikan dari baca kode.
- Task 10.3 & task 11.1 sengaja memisahkan TEMPAT pemangkasan payload (Requirement 7) — ada di `AdvanceSearchDialog`, BUKAN di `LinkModel.jsx` — karena `templateLinkColumnNames` cuma tersedia di state internal hook `AdvanceSearchDialog`. Jangan pindahkan logic ini ke `LinkModel.jsx` saat implementasi tanpa juga memindahkan akses ke `templateLinkColumnNames`.
- Lint/Pint (`vendor/bin/pint --dirty --format agent`, eslint) HANYA dijalankan setelah SEMUA task `[x]` (aturan project, bukan per-task).

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3"] },
    { "id": 2, "tasks": ["3.1", "3.3"] },
    { "id": 3, "tasks": ["3.2", "3.4", "4.1"] },
    { "id": 4, "tasks": ["4.2"] },
    { "id": 5, "tasks": ["6.1", "7.1", "8.1"] },
    { "id": 6, "tasks": ["6.2", "7.2", "8.2"] },
    { "id": 7, "tasks": ["10.1"] },
    { "id": 8, "tasks": ["10.2"] },
    { "id": 9, "tasks": ["10.3", "10.4"] },
    { "id": 10, "tasks": ["10.5"] },
    { "id": 11, "tasks": ["11.1"] },
    { "id": 12, "tasks": ["11.2"] }
  ]
}
```
