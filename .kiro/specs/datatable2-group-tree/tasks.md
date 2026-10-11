# Implementation Plan: DataTable2 Group Tree

## Overview

Urutan kerja (detail di [design.md](design.md), traceability ke [requirements.md](requirements.md)):

1. **Backend — kontrak & data** (task 1–2): normalizer `GroupLevels`, `getDefaultGroups()`, `saved_filters.group` jadi list (accessor + migration data + validasi + normalisasi request).
2. **Backend — engine** (task 3–4): ekstrak logika grup dari `DataTableScope` (refactor murni, test lama jadi jaring), resolver multi-level, node grup (key/count/sample/agregat/total), node daun, envelope level-0 + `groupMeta`, request expand JSON, agregat `groupAggregate`.
3. **Frontend — komponen murni** (task 5–6): `groupLevels.js`, `GroupLevelsEditor`, lang.
4. **Frontend — render tree** (task 7–8): ekstrak `TableRow` (refactor), `useGroupNode`, `GroupPager`, `GroupTree`, header desktop (agregat) + kartu mobile, `Table2` prop `group`.
5. **Frontend — integrasi** (task 9–10): `DataTable2`, Search Bar/Panel/ChipEditor/suggestions, `FilterTable2`, `FilterTemplate/Form`.
6. **Verifikasi & penutup** (task 11): browser, checklist MySQL, full suite, lint sekali.

Dua langkah **ekstrak** (3.1 dan 7.1) sengaja *sebelum* perubahan perilaku: test lama (`DataTableScopeGroupingTest`, `AllModelsGroupableConfigTest`, `Table2.rtl.test.jsx`) menjadi jaring karakterisasi — bila tetap hijau setelah pemindahan kode, refactor tidak mengubah perilaku.

Yang **tidak** berubah: 62 controller index (`Model::dataTable($request)`), `FilterEvaluator`/`FilterTreeCleaner`, `persistFilterTree`, opt-in `groupable` per kolom, konsumen `Table2` non-grup (`QuickListBlock`, `AdvanceSearchDialog`, `SelectModel`), konsumen XHR macro.

## Tasks

- [ ] 1. Backend — kontrak `Groups` & data
  - [x] 1.1 `GroupLevels` normalizer
    - `app/Services/Core/DataTable/Group/GroupLevels.php`: `normalize(mixed): array` (struktural — TIDAK mengoreksi nilai `granularity`/`range`, TIDAK memotong ke 4), konstanta `MAX_LEVELS = 4` dan `GRANULARITIES = ['day','month','quarter','half','year']`, `toWire(array)`/`fromWire(Request)` (`group=a,b`, `groupGranularity[a]`, `groupRange[a]`, skalar lama → level pertama)
    - Masukan diterima: `null`/`''`/`[]`, string, CSV, objek lama, list string, list objek, campuran; dedupe kolom (pertama menang)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 18.2_

  - [x] 1.2 Write unit test `tests/Unit/Core/DataTable/Group/GroupLevelsTest.php`
    - **Normalizer idempoten, struktural, dan kompatibel bentuk lama**
    - Tabel masukan → `Groups`; idempoten; dedupe; objek lama → 1 level; CSV; nilai granularity salah TIDAK dikoreksi; >4 TIDAK dipotong; `toWire`/`fromWire` round-trip; skalar lama
    - **Validates: Requirements 1.1–1.5, 18.2 (Property 6, 9)**

  - [x] 1.3 Trait `getDefaultGroups()` & migrasi fixture test
    - `app/Traits/DataTable.php`: tambah `getDefaultGroups(): array` (`\property_exists(static::class, 'defaultGroups') ? GroupLevels::normalize(static::$defaultGroups) : []`); JANGAN deklarasi `$defaultGroups` di trait; hapus `getDefaultGroupColumn()`; PHPDoc dengan 3 bentuk deklarasi (`'kolom'`, `['a','b']`, `[['column'=>…,'granularity'=>…],'b']`)
    - **Shim sementara** di `DataTableScope::addDataTable()`: ganti pemanggilan `getDefaultGroupColumn()` dengan `$model::getDefaultGroups()[0]['column'] ?? null` (satu level) agar suite BE tetap hijau — dihapus di 3.2
    - Ubah fixture test yang mendeklarasi `$defaultGroupColumn` → `$defaultGroups` (`DataTableScopeGroupingTest`, `DataTableScopeSearchScopeTest`)
    - _Requirements: 2.1, 2.2, 2.3, 18.4_

  - [x] 1.4 `SavedFilter` accessor, aturan validasi, migration data
    - `app/Models/Core/SavedFilter.php`: ganti cast `'group' => 'array'` dengan accessor `Attribute` (get: normalisasi → list, kosong → `null`; set: simpan list, kosong → `null`); `groupValidationRules()` → `group` nullable array `max:4`, `group.*.column` required string, `group.*.granularity` nullable `Rule::in(GroupLevels::GRANULARITIES)`, `group.*.range` nullable numeric `gt:0`; ganti pemakaian `DataTableScope::GROUP_GRANULARITIES` → `GroupLevels::GRANULARITIES` (di `SavedFilter` **dan** `tests/Feature/Core/SavedFilterTest.php`, yang juga mereferensikannya)
    - **Shim kedua (sama seperti 1.3, dibuang di 3.2):** `DataTableScope` membaca `$appliedFilter->group['column']` (objek); karena accessor kini mengembalikan list, macro sementara memakai `$appliedFilter?->group[0]` (level pertama)
    - Migration `php artisan make:migration convert_saved_filters_group_to_list --no-interaction`: `chunkById` baris `group` non-null; objek `{column,…}` → `[objek]`; `down()` ambil level pertama (lossy >1 level — dokumentasikan di komentar)
    - _Requirements: 3.1, 3.2, 3.3, 3.6, 18.1_

  - [x] 1.5 `FormRequest` & controller
    - `prepareForValidation()` di `UpdateSavedFilterRequest`, `StoreFilterTemplateRequest`, `UpdateFilterTemplateRequest` (trait bersama `NormalizesGroupInput`): **hanya membungkus** objek lama `{column,…}` jadi list 1 level — TIDAK membuang elemen tak valid, agar aturan `group.*.column required` tetap memicu 422 (`group.0.column`)
    - `SavedFilterController::index()/update()` dan `FilterTemplateController::store()/update()` membaca/menulis/mengembalikan list — **tanpa perubahan kode controller**: accessor `SavedFilter::group` yang menormalkan baca & tulis (diverifikasi test 1.6)
    - _Requirements: 3.4, 3.5, 18.3_

  - [x] 1.6 Write feature tests (perluas `tests/Feature/Core/SavedFilterTest.php`, `FilterTemplateControllerTest.php`)
    - **Saved filter & template menyimpan `Groups` list; bentuk lama tetap diterima**
    - List valid tersimpan & terbaca; objek lama (klien basi) dinormalkan, bukan 422; >4 level → 422; kolom duplikat dedupe; granularity/range invalid → 422; `index()` mengembalikan list; `null`/`[]` → `null`; migration data mengonversi objek → list
    - **Validates: Requirements 3.1–3.6, 18.1, 18.3**

- [x] 2. Checkpoint - Ensure backend kontrak tests pass
  - `php artisan test --compact` untuk `GroupLevelsTest`, `SavedFilterTest`, `FilterTemplateControllerTest`, `DataTableScopeGroupingTest`, `DataTableScopeSearchScopeTest`, `AllModelsGroupableConfigTest`
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 3. Backend — engine query
  - [x] 3.1 Ekstrak logika grup dari `DataTableScope` (**refactor murni, tanpa perubahan perilaku**)
    - Pindahkan ke `app/Services/Core/DataTable/Group/`: `GroupColumnGate` (`sanitizeGroupableColumns`, `resolveRelationGroupColumn`, `gateGroupColumn`), `GroupBucket` (`dateGroupExpression`, `numberGroupBucketExpression`, `resolveGroupBucketExpression`), `GroupKeyNormalizer` (blok normalisasi key boolean/formStatuses/`'null'`)
    - `DataTableScope` memanggil kelas-kelas itu; hapus `DataTableScope::GROUP_GRANULARITIES` (3 referensi internal) — pemakai eksternal (`SavedFilter`, `SavedFilterTest`) sudah dialihkan ke `GroupLevels::GRANULARITIES` di 1.4
    - **`DataTableScopeGroupingTest` & `AllModelsGroupableConfigTest` HARUS hijau tanpa mengubah satu pun asersi** (jaring karakterisasi)
    - _Requirements: 17.1, 17.3_

  - [x] 3.2 `GroupLevelResolver` multi-level + share `defaultGroups`
    - `GroupLevelResolver::resolve(request, appliedGroups, modelDefaults, columns, model): list<ResolvedLevel>` — prioritas `?group` (kosong = "Tidak ada") > `group` filter aktif > `getDefaultGroups()`; filter & default hanya untuk request Inertia; gate per level, buang level tak valid, potong 4; granularity/range: param URL > level filter/default > default kolom (skalar lama → level pertama)
    - Hapus shim 1.3; share `defaultGroups` (grup efektif tanpa param, lolos gate) menggantikan `defaultGroup`/`defaultGroupGranularity`/`defaultGroupRange`
    - Nama aksesor relasi semua level dipaksa masuk `extraKeys`
    - _Requirements: 2.4, 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 3.3 Write feature tests resolver (perluas `DataTableScopeGroupingTest.php`)
    - **Prioritas & gate group multi-level**
    - `?group=a,b` > `?group=` kosong (menimpa filter/default) > `group` filter aktif > default model; default hanya Inertia, XHR hanya `?group`; level tak groupable dibuang, sisanya berurutan; >4 dipotong; duplikat dedupe; granularity/range per kolom + skalar lama; `defaultGroups` benar
    - **Validates: Requirements 4.1–4.5, 20.1 (Property 5)**

  - [x] 3.4 `GroupNodeQuery::groups()` — node daftar grup
    - `SELECT {expr} AS group_key, COUNT(*) AS aggregate_count, MIN(pk) AS sample_id (relation) … GROUP BY group_key ORDER BY group_key ASC LIMIT show OFFSET …` di titik yang sama dgn `clone $query` lama (reset `orders`, `columns`, `bindings['order']`, `eagerLoads`)
    - Predikat `groupPath` per tipe (design §1.4): `= ?`/`IS NULL`, boolean `(int)`, date bucket `expr = ?`, number bucket `col >= lower AND col < lower+range`, formStatuses `CAST(col AS CHAR) IN (varian…)`; semua nilai di-bind
    - Total grup: skip bila `page==1 && count(hasil) < show`, selain itu `COUNT(*)` subquery; label relasi via `sample_id` → `whereIn(pk)` lewat `$query` ber-`with()`; key dinormalkan (`GroupKeyNormalizer`), varian formStatuses dijumlahkan (`raw` = list varian)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8_

  - [x] 3.5 Write feature tests node grup (perluas `DataTableScopeGroupingTest.php`)
    - **Node grup benar per tipe kolom & level; count menjumlah**
    - Per tipe: string, relasi (label dari sample, soft-delete), boolean, formStatus/formStatuses (+ varian teks), date × 5 granularity, number/currency × range (pecahan, negatif), grup NULL; nested 2–4 level (predikat path); total skip/hitung; urutan `key ASC` NULL dulu; Σ count anak = count induk
    - Catatan environment: user test `branches()->attach()` ke branch utama; FK SQLite menolak ULID acak; `QueryDetectorMiddleware` false-positive → assertion jumlah query eksplisit
    - **Validates: Requirements 5.1–5.8, 20.1 (Property 1, 2, 7)**

  - [x] 3.6 `GroupNodeQuery::rows()` + envelope level-0 + `groupMeta`
    - `rows()`: predikat path lengkap + sort user sebagai satu-satunya `ORDER BY` → `paginate($show, page: $groupPage)` + `applyAppends`
    - Level-0 (Inertia): hasil `groups()` dibungkus `LengthAwarePaginator` → share `data` (bentuk sama: `current_page/last_page/total`) + `groupMeta` `{levels[{column,granularity,range,type}], aggregates}` (nilai efektif) atau `null`; **hapus** share `groupCounts`; jalur flat tak berubah
    - _Requirements: 4.5, 6.1, 6.2, 6.3, 8.1, 8.2_

  - [x] 3.7 Request expand — short-circuit JSON
    - `GroupPath::parse($raw, $levels)` (JSON array skalar/`null`, level formStatuses list string; panjang ≤ jumlah level; number bucket wajib numerik) → **422** `{message}` bila invalid; `groupPage` invalid → 1
    - Macro: `has('groupPath')` → selesaikan node → `throw new HttpResponseException(response()->json({type, data, current_page, last_page, total, per_page}))`; deteksi berdasarkan `groupPath`, BUKAN `ajax()`; XHR tanpa `groupPath` → abaikan `group`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 8.3, 8.4_

  - [x] 3.8 Write feature tests protokol expand, paritas, zero-overhead
    - **Expand aman, paritas constraint, tanpa overhead**
    - `groupPath` invalid (bukan array, elemen non-skalar, terlalu panjang, number non-numerik) → 422 bukan 500; `groupPage` di luar rentang → `data: []` total benar; pagination independen antar node; paritas himpunan baris vs jalur flat (filter, `?fid=`, default shared filter, `searchScope`, branch scope, submitable, scope kustom controller); XHR tanpa `groupPath` mengabaikan `group`; zero-overhead (`DB::listen` jumlah query tanpa grup identik); `raw` di-bind (nilai berisi kutip/`;` tidak merusak SQL)
    - **Validates: Requirements 7.1–7.6, 8.1–8.4, 10.1, 10.3, 20.1 (Property 3, 4, 5, 7)**

  - [x] 3.9 Agregat `groupAggregate`
    - `GroupColumnGate`: validasi `groupAggregate` ∈ `sum|avg|min|max`, kolom `number|currency` & kolom SQL riil (bukan `dependsOn`/append, bukan relasi) — kriteria sama gate `groupable`; selain itu diabaikan diam-diam
    - `groups()`: `SUM/AVG/MIN/MAX(t.col) AS agg_{i}` di setiap level; `avg` → float; semua-NULL → `null`; deskriptor `aggregates: {kolom: nilai}`; `groupMeta.aggregates` `[{column, fn}]` valid
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [x] 3.10 Write feature tests agregat
    - **Agregat benar di setiap level dan aman terhadap config keliru**
    - Nilai = SUM/AVG/MIN/MAX manual atas baris node, di level 0/1/2; semua-NULL → `null`; avg float; fungsi di luar whitelist / kolom string / accessor / relasi diabaikan; `groupMeta.aggregates` hanya yang valid
    - **Validates: Requirements 9.1–9.4 (Property 8)**

  - [x] 3.11 Rombak `AllModelsGroupableConfigTest`
    - `every_groupable_column_executes_its_group_query` saat ini mengasersi `Inertia::getShared('groupCounts')` array → ubah ke kontrak baru (request level-0 tiap kolom groupable menghasilkan envelope deskriptor + `groupMeta` non-null); tambah guard: setiap `groupAggregate` yang dideklarasikan lolos sanitasi
    - _Requirements: 20.3_

- [x] 4. Checkpoint - Ensure backend tests pass
  - `php artisan test --compact` semua file test di 1.2, 1.6, 3.3, 3.5, 3.8, 3.10, 3.11 + regresi jalur panas `DataTableScopeDefaultSortTest`, `DataTableScopeSoftDeleteTest`, `DataTableScopeSearchScopeTest`, `AllModelsGroupableConfigTest`
  - `php artisan migrate` di DB lokal (dibutuhkan verifikasi browser)
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Frontend — komponen murni
  - [x] 5.1 Modul kontrak `resources/js/Components/Table/Group/groupLevels.js`
    - Fungsi murni: `normalizeGroupLevels`, `toggleGroupLevel` (tambah di akhir / hapus, maks `MAX_GROUP_LEVELS = 4`), `moveGroupLevel`, `setLevelOption`, `sameGroups` (**urutan bermakna**), `groupsToQuery(groups, defaultGroups)` / `groupsFromQuery(query)` (skalar lama → level pertama; `group=` kosong hanya bila `defaultGroups` tidak kosong), `computeGroupDefaults(column)`
    - _Requirements: 1.1–1.5, 12.4, 13.1, 13.2, 13.3_

  - [x] 5.2 Write unit test `groupLevels.test.js`
    - **Kontrak FE murni: normalize, toggle, move, urutan, URL round-trip**
    - Semua bentuk masukan; idempoten; toggle tambah/hapus/batas 4; move; `sameGroups` sensitif urutan/granularity/range; round-trip `groupsToQuery`↔`groupsFromQuery`; skalar lama; `group=` kosong vs hilang
    - **Validates: Requirements 1.1–1.5, 13.2, 13.3 (Property 6)**

  - [x]* 5.3 Write property test `fast-check` untuk `groupLevels`
    - Idempoten & round-trip; `fc.pre(...)`/`.filter()` HARUS selaras persis dengan validasi sumber (bukan sekadar mirip)
    - **Validates: Requirements 1.4, 13.2**

  - [x]* 5.4 Fixture bersama BE↔FE `tests/fixtures/group-levels-cases.json`
    - Dibaca PHPUnit (`GroupLevelsTest`) **dan** Vitest (`groupLevels.test.js`) untuk menjamin Property 6 antar bahasa (belum ada preseden fixture lintas-bahasa yang diverifikasi di repo — cek dulu saat mulai)
    - **Validates: Requirements 1.4**

  - [x] 5.5 `GroupLevelsEditor.jsx`
    - Controlled & presentasional `{columns, options, value, onChange, max}`; aktif di atas (urutan = nesting) + divider (hanya bila ada aktif DAN non-aktif) + non-aktif di bawah; klik baris = toggle; `disabled` di batas; reorder `@dnd-kit/sortable` (Pointer + Keyboard sensor); `Select` granularity (date) / range (number, `column.groupRangeOptions ?? DEFAULT_NUMBER_GROUP_RANGE_OPTIONS`) inline per level; tanpa kotak cari
    - Jebakan: JANGAN `<label htmlFor>` + kontrol native (klik ganda); baris = satu target klik, `ui/checkbox` presentasional (`tabIndex={-1}`, `pointer-events-none`)
    - _Requirements: 11.1–11.8_

  - [x] 5.6 Write RTL test `GroupLevelsEditor.rtl.test.jsx`
    - **Editor: toggle, urutan, batas, opsi per level**
    - Toggle tambah/hapus; divider muncul/hilang; reorder via keyboard; baris non-aktif `disabled` di 4 level; select granularity/range per level; `onChange` menerima `Groups` benar. Query checkbox: `getAllByRole("forminput")`/`getByLabelText` (`ui/checkbox` ber-`role="forminput"`)
    - **Validates: Requirements 11.1–11.8**

  - [x] 5.7 Lang id/en
    - Key baru di `lang/{id,en}/core/datatable.php` & `core/filterTemplate.php`: batas level, handle urut, pager, memuat/error/coba lagi, `aggregate.{sum,avg,min,max}`; daftar final dapat bertambah saat task 5–9 (id/en parity wajib); hapus key yang tak terpakai
    - _Requirements: 19.1, 19.2_

- [x] 6. Checkpoint - Ensure pure-module & editor tests pass
  - `npx vitest run` untuk `groupLevels.test.js` (+ 5.3/5.4 bila dikerjakan), `GroupLevelsEditor.rtl.test.jsx`; `php artisan test --compact --filter=LocaleKeysTest`
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Frontend — render tree
  - [x] 7.1 Ekstrak `TableRow` dari `Table2.jsx` (**refactor murni**)
    - `<tr>` baris data (selectable, actions, sel kolom via `Cell`) → komponen `memo` `TableRow`; jalur flat memakainya
    - **`Table2.rtl.test.jsx`, `Table2.dom.test.js`, `Table2.resize.rtl.test.jsx` HARUS hijau tanpa mengubah asersi**
    - _Requirements: 17.2, 17.3_

  - [x] 7.2 `useGroupNode.js` + `GroupPager.jsx`
    - `useQuery({ queryKey: ["datatable-group-node", pathname, hashParams, rawPath, page, version], queryFn: axios.get(pathname, {params}), staleTime: 0, gcTime: 30_000, placeholderData: keepPreviousData, enabled: isOpen })`; `staleTime: 0` WAJIB (default QueryClient app 120 000 ms)
    - `GroupPager`: `1–100 / 189 ‹ ›`, tampil hanya bila `total > per_page`, klik `stopPropagation`
    - _Requirements: 14.2, 14.4, 14.7_

  - [x] 7.3 `GroupTree.jsx`
    - Rekursif `GroupNode` (header + anak: `type:"groups"` → `GroupNode` depth+1, `type:"rows"` → `renderRow`); render-prop `renderGroupHeader({item, depth, level, isOpen, onToggle, pager})`, `renderRow(row, {depth})`
    - State terbuka (Set kunci-path) + Map page per node dipegang `GroupTree`; default tertutup; reset saat `ziggy.query` berubah (BUKAN `options` pending); `version` naik saat identitas `data` level-0 berganti / Reload (`invalidateQueries`)
    - Parameter expand = `ziggy.query` − `page` + `group`/`groupGranularity`/`groupRange` eksplisit dari `groupMeta.levels` + `groupPath` (JSON) + `groupPage`
    - Skeleton berdenyut saat loading; baris error + "Coba lagi" per node
    - _Requirements: 14.1, 14.2, 14.3, 14.5, 14.6, 14.8_

  - [x] 7.4 `GroupHeaderRow.jsx` — header desktop (agregat) & kartu mobile
    - Desktop: `td` label `gridColumn: span (selectable?1:0)+(actions?1:0)+idx kolom agregat tampil pertama`, indent `depth × 16px`, chevron, `GroupLabel`, `(count)`, pager; lalu satu `td` per kolom tersisa berisi agregat terformat (`formatNumber` + opsi kolom) atau kosong; tanpa kolom agregat tampil → satu `td` span penuh; kolom agregat tersembunyi tak dirender; tooltip fungsi
    - Mobile: kartu ringkas (chevron, label, count, agregat teks kecil `Nama: nilai`, pager), indent per depth
    - `GroupLabel` mendekode dari `descriptor.raw`/`label`/`key` + `groupMeta.levels[depth]`
    - _Requirements: 15.1–15.5, 16.2_

  - [x] 7.5 `Table2.jsx` — prop `group`
    - Satu prop `group` menggantikan `groupBy/groupCounts/groupGranularity/groupRange`; bila ada, `<tbody>` merender `GroupTree` (`renderRow` = `TableRow`, `renderGroupHeader` = header desktop); selain itu jalur flat identik
    - Hapus: `groupedRows`, `groupKeyOf`, `dateGroupBucketKey`, `numberGroupBucketKey`, `collapsedGroups`/`toggleGroup`; `gridTemplateRows` saat grouped tidak bergantung `data.length`
    - _Requirements: 10.2, 14.9, 15.6_

  - [x] 7.6 Write RTL tests `GroupTree`/`Table2`
    - **Pohon lazy: default tertutup, expand fetch, pager node, agregat sejajar**
    - Default tertutup; expand → request `groupPath` benar (mock `axios`); nested 2 level; pager node (halaman 2, `stopPropagation`); error + retry; reset saat `ziggy.query` berubah; refetch saat `version` naik; sel agregat sejajar kolom (termasuk kolom disembunyikan & tanpa agregat); jalur flat `Table2` tak berubah (regresi); tanpa `vi.useFakeTimers` (macet dgn Radix/cmdk) → real timers + `waitFor` RTL
    - **Validates: Requirements 10.2, 14.1–14.9, 15.1–15.6 (Property 7)**

- [x] 8. Checkpoint - Ensure tree tests pass
  - `npx vitest run resources/js/Components/Table` (kecuali Search/Filter yang belum dikerjakan); pakai `rtk proxy` untuk deteksi warning `act()` akurat
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Frontend — integrasi
  - [x] 9.1 `DataTable2.jsx`
    - `options.group: Groups` (hapus `groupGranularity`/`groupRange`); state awal `groupsFromQuery(query) ?? defaultGroups`; serialisasi hanya di `loadData()` (`groupsToQuery` + `qs` `skipNulls`); ganti level → `page: 1`; `onPickSaved` menimpa `options.group` bila `saved.group` non-null; `getViewSnapshot()` = `{sort, group: options.group.length ? options.group : null}`; prop `group` ke `Table2` (dari `groupMeta`); Reload → `invalidateQueries(["datatable-group-node"])`
    - Cabang mobile: `GroupTree` (kartu, `renderRow` = `templateItem({dataRow, deleteItem})`) bila `groupMeta` ada, selain itu kartu flat
    - _Requirements: 13.1–13.5, 14.6, 16.1, 16.3_
    - **Deviasi (dicatat saat implementasi):** Reload TIDAK memanggil `invalidateQueries(["datatable-group-node"])`. Tombol Reload/hapus baris memicu `router.get` -> identitas `data` level-0 berganti -> `version` naik -> `useGroupNode` (queryKey memuat `version`, `staleTime: 0`) refetch node terbuka tanpa mereset state buka/tutup (`resetKey` = `ziggy.query` tak berubah). Hasil perilaku sama dgn yang dispec, tanpa QueryClient handle di `DataTable2`. `reset: ["data","ziggy","groupMeta"]` -- `groupMeta` wajib ikut agar partial reload membawa level/agregat baru.

  - [x] 9.2 `SearchPanel.jsx` & `ChipEditor.jsx` memakai `GroupLevelsEditor`
    - Ganti `GroupPicker`; hapus `NO_GROUP_VALUE` & `computeGroupDefaults` lama; popover chip `group` memakai editor yang sama; mobile `Dialog` memakai editor yang sama
    - _Requirements: 11.6, 11.8, 16.4_
    - Temuan saat tes: `FOCUSABLE_SELECTOR` SearchPanel (navigasi panah roving-tabindex) ikut menangkap `<button tabindex="-1">` -- Checkbox visual aria-hidden di baris `GroupLevelsEditor`. Selector kini mengecualikan `tabindex="-1"` juga utk `button`/`input`.

  - [x] 9.3 `SearchBar.jsx` & `searchSuggestions.js`
    - `draftGroup: Groups`; `sameGroups`; chip tunggal `__group` label di-join `" > "` (date `Kolom: Granularity`, number `Kolom: range`), truncate + `title`; `×` → `onGroupChange([])`; dirty-check `sourceSaved.group != null && !sameGroups(…)`; saran seksi group = toggle
    - _Requirements: 12.1–12.5_

  - [x] 9.4 `FilterTable2.jsx` & `FilterTemplate/Form.jsx`
    - `SaveFilterControl`: payload `group` = list atau `null`; `FilterTemplate/Form.jsx`: field Group by memakai `GroupLevelsEditor` (`col.groupable && !col.parentCol`)
    - _Requirements: 3.7, 12.6_

  - [x] 9.5 Write/ubah test terdampak + integrasi
    - **Integrasi grouping bertingkat end-to-end di FE**
    - Ubah: `ChipEditor.rtl`, `Table2.rtl` (bila belum), `DataTable2.rtl`, `FilterTemplate/Form.rtl`, `searchSuggestions.test`, `SearchBar`/`SearchPanel` rtl; tambah: chip `A > B`, dirty saat urutan berubah, saran toggle, `×` hapus semua, `FilterTable2` snapshot, `DataTable2` desktop & mobile (group dari default/URL/saved filter, "Tidak ada" mengirim `group=` kosong hanya bila ada `defaultGroups`)
    - **Validates: Requirements 12.1–12.6, 13.1–13.5, 16.1–16.4, 20.2**

- [x] 10. Checkpoint - Ensure full frontend suite pass
  - `npx vitest run` (full FE), paralel per-batch bila perlu
  - Ensure all tests pass, ask the user if questions arise.
  - **Hasil:** full FE 437 file / 6121 test -> 6120 lulus; 1 gagal = `SearchBar.rtl` blok "revisi 11" (kalender tanggal, tes berbasis `new Date()` + klik sel, kena timeout ~10 dtk saat mesin sibuk); dijalankan ulang terisolasi -> lulus (25/25). Bukan dari perubahan ini.

- [ ] 11. Verifikasi & penutup
  - [x] 11.1 Verifikasi browser
    - `php artisan migrate` (bila belum) → `npm run build` (BUKAN dev server) → `php artisan serve --no-reload` (set `APP_URL` bila ganti port)
    - Checklist: nested 3 level; expand + pager per node + reset saat filter/sort/level berubah; agregat sejajar kolom (kolom digeser/di-resize/disembunyikan); mobile (kartu header, indent); saved filter lama berbentuk objek; reorder keyboard & drag; **klik ganda checkbox**; filler `1fr` di dasar tabel; hapus baris → node terbuka ter-refetch
    - _Requirements: 20.4_
    - **Hasil (Opportunity, 113 baris uji ber-tag ZZV yang sudah dihapus lagi; `npm run build` + `php artisan serve --no-reload`, login lokal dgn kredensial seed):** nested 3 level (`customer > stage > assigned_to`) OK; level-0 dipaginasi luar (`show=3`); isi grup lazy per node; pager per node independen (Administrator 10–12/30 sambil "Tanpa Nilai" 4–6/10); agregat sum/avg sejajar kolom; reset semua node saat sort/level berubah; urutan nesting bisa diubah lewat pointer-drag DAN keyboard; klik satu checkbox = satu toggle (tidak double-fire); saved filter berformat objek lama terbaca (chip `Tahap` + grup by stage); field Group by Filter Template OK; mobile (kartu bertingkat berindentasi, tanpa scroll horizontal, tes dgn `/items` yang punya `templateItem`); Reload me-refetch node terbuka (count grup naik setelah baris ditambah lewat DB).
    - **Bug yang HANYA ketahuan di browser (sudah diperbaiki + tes/guard):** (1) label pager `1–3 / 3tal` -- placeholder `:to` menimpa awal `:total` (laravel-react-i18n mengganti berurutan) -> di-rename `:start`/`:end`, guard `tests/Unit/Core/DataTable/LangPlaceholderPrefixTest.php`; (2) pager desktop bertumpuk vertikal -- `table.css` memaksa `td span { display: block }` -> `inline-flex!`; (3) reorder level via keyboard rusak di panel -- handler panah `SearchPanel` mencuri panah/Spasi dari sensor keyboard dnd-kit (toggle baris lain) -> abaikan saat handle `aria-pressed="true"`; (4) panah bawah di panel bisa mendarat di `<button tabindex="-1">` Checkbox visual (selector fokus).
    - **Putaran ke-2 khusus alur lewat Search Bar (klik/ketik/keyboard asli, halaman polos `?show=3`):** ketik "Tahap" -> saran "Kelompokkan: Tahap" (panah+Enter) -> chip `Tahap`; ketik "Customer" -> saran kedua -> chip `Tahap > Customer` (nesting); klik chip -> editor level terbuka, centang "Ditugaskan Kepada" -> chip `Tahap > Customer > Ditugaskan Kepada` tanpa menutup popover; Esc lalu klik ikon Terapkan -> URL `group=stage,customer,assigned_to`; chip pencarian + group digabung; "Simpan Filter" dari panel -> DB `saved_filters.group` = list 3 level + `sort`; halaman polos -> panel -> pilih filter tersimpan -> chip filter + chip group pulih -> Terapkan -> tree; klik x chip group -> Terapkan.
    - **Bug ke-5 (hanya ketahuan di alur ini, sudah diperbaiki):** setelah memilih filter tersimpan yang ber-group lalu menghapus chip group, URL TIDAK membawa `group=` -> backend memakai lagi group milik filter -> tree tetap muncul. Sebab: `defaultGroups` dimuat saat halaman polos (tanpa `fid`) dan tak disegarkan oleh partial reload. Perbaikan: `loadData()` mengirim `group=` KOSONG bila `defaultGroups` non-kosong ATAU `fid != null` (`groupsToQuery(groups, fallback)` menerima daftar atau boolean); tes unit + RTL DataTable2 ditambah; diverifikasi ulang di browser (`?fid=…&group=&…` -> tabel datar).
    - **Perilaku yang perlu diketahui:** Reload PERTAMA dari URL polos (tanpa `page`/`sort`/`show`) menutup semua node karena `loadData()` menambah param default ke URL sehingga `ziggy.query` berubah (sesuai Req 14.5 secara harfiah); Reload berikutnya (URL sama) mempertahankan node terbuka. Bisa dikanonikalkan di `resetKey` bila dianggap mengganggu.
    - **Temuan di luar scope (di-spawn sbg task terpisah):** `FilterTemplateController::preview()` 500 utk model dgn kolom relasi `show=true` (mis. Opportunity) -- pre-existing.
    - Catatan lingkungan: `php artisan serve` (1 thread, `max_execution_time` 30 dtk) + mode debug -> halaman index penuh ±15–18 dtk (ANGKA SAMA utk halaman tanpa group, mis. `/items`), request expand ±2 dtk; bukan regresi. Screenshot pane kadang timeout -> verifikasi memakai DOM/JS.

  - [x] 11.2 Checklist MySQL manual (produksi ≠ SQLite CI)
    - `only_full_group_by` pada semua bentuk node; `CAST(col AS CHAR) IN (…)` formStatuses (MySQL native JSON vs MariaDB teks — bila gagal, fallback per driver di `GroupBucket`); urutan NULL; `MIN(pk)` pada ULID; total grup via subquery; predikat number bucket
    - _Requirements: 20.4_
    - **Hasil (MySQL 8.0.29, `sql_mode` = `ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,...`, DB lokal `erp`; MariaDB TIDAK diuji):** 340 request (level-0 + expand daun + expand sub-grup untuk SEMUA kolom groupable semua model) -> 0 kegagalan. Data nyata: `formStatuses` tersimpan JSON native -> `key` = `["received","to_bill"]`, `raw` = varian `["received", "to_bill"]` (spasi kanonik MySQL) dan expand `CAST(col AS CHAR) IN (varian)` cocok (total=1) pada Asset/AssetService/PurchaseOrder/PurchaseReceipt/PurchaseRequest; NULL selalu urutan pertama di level-0 & sub-grup; `MIN(pk)` ULID utk label relasi OK; total grup via subquery OK; daun halaman 2 (30 baris, show 25) = 5 item. Skrip verifikasi ada di scratchpad sesi (tidak masuk repo).

  - [x] 11.3 Full suite BE + FE
    - Jalankan **paralel per-batch** (serial memicu OOM 128 MB; `phpunit.xml` SQLite `:memory:` aman paralel). Bandingkan dengan baseline noise pre-existing (`FileViewFinder TypeError`, `UserShow "Undefined array key 1"`) — bukan regresi
    - _Requirements: 20.5_
    - **Hasil:** BE paratest 6 proses (`-d memory_limit=1G`) 2029 test / 5568 assertion -> 1 gagal = `ManualBookImageTest` (gambar `public/manual-book-images` ada di `.gitignore`, tidak ada di worktree; lingkungan, bukan regresi). Noise baseline (`FileViewFinder`, `UserShow`) tidak muncul. FE: lihat task 10. Setelah perbaikan bug browser + lint: regresi terkait (Vitest 353 test, PHPUnit 250 test + LocaleKeys) hijau.

  - [x] 11.4 Lint & penutup
    - `vendor/bin/pint --dirty --format agent` dan `npm run lint:fix` **sekali** di sini (bukan per task); `LocaleKeysTest`; `graphify update .`
    - _Requirements: 19.1, 20.5_
    - **Hasil:** Pint `pass` (memperbaiki `line_ending`/spasi pada 2 file tes PHP + 2 file lang). ESLint `--fix` hanya pada file JS yang disentuh (BUKAN seluruh `resources/js`, agar diff tak melebar): 0 error, sisa warning `jsdoc/*` (`require-param-type`, `reject-any-type`, `require-returns`) pada file baru `Group/*` dan file lama seperti `searchChips.js`/`columnSearch.js` -- konvensi JSDoc repo belum seragam; tidak diberesi di sini. `LocaleKeysTest` lulus; key lang tak terpakai dihapus (`datatable.no_grouping`, `datatable.group_toggle`, `filterTemplate.form.group.none`). `graphify update .` selesai.

  - [x] 11.5 Laporan ke user
    - Ringkas file berubah per fase, hasil test, hasil verifikasi browser/MySQL, dan temuan/deviasi dari spec. **Jangan commit/push** sebelum diinstruksikan eksplisit

- [x]* 12. Tandai `groupAggregate` di model utama (opsional)
  - Mekanisme agregat masuk scope wajib (3.9); **pengisian** ke model utama (mis. `grand_total` SalesOrder/PurchaseOrder/Invoice, `qty` StockLedgerEntry) opsional — tanpa ini fitur agregat belum tampak di halaman mana pun. Pola seperti commit "tandai kolom groupable di model utama" + guard `AllModelsGroupableConfigTest` (3.11)
  - _Requirements: 9.1, 9.2_
  - **Hasil (dikerjakan atas perintah "kerjakan semua tasks"):** `groupAggregate` dipasang HANYA pada kolom number/currency yang fisik, tampil (`show`), dan aditif: `GeneralLedger.debit`/`credit` (sum), `Opportunity.expected_value` (sum) & `probability` (avg), `Quotation.amount` (sum). Guard `every_declared_group_aggregate_is_valid_and_physical` hijau.
  - **Dilewati sengaja (temuan):** (a) kolom `*_base_currency` SalesOrder/PurchaseOrder/SalesInvoice/PurchaseInvoice ber-`'hidden' => true` (tak masuk `mapColumns`, jadi agregatnya tak bisa tampil); (b) `StockLedgerEntry.quantity_change` dst. memakai `'type' => 'numeric'` (BUKAN `number`/`currency`) sehingga ditolak gate; (c) `Asset.gross_purchase_amount`: tipe dideteksi dari skema DB -- kolom `decimal` tanpa cast jadi `number` di MySQL tetapi `mixed` di SQLite test, guard merah di CI; butuh `'type' => 'number'` eksplisit/cast `decimal` bila mau ditandai.

- [x] 13. Revisi pasca-verifikasi (Requirement 21) -- 2026-09-27
  - [x] 13.1 BE urutan grup: `GroupNodeQuery` (`sortAggregate`, `sortDirection`, `keyDirection`; `applyGroupOrder()`), macro `DataTableScope` membaca `groupSort` & mengikat sort tabel ke agregat; tes: `test_group_rows_*`, `test_group_sort_*`, `test_sub_group_lists_*` di `DataTableScopeGroupingTest` (AVG non-bulat, seri, NULL, halaman berurutan, leaf tak tersentuh)
  - [x] 13.2 FE `groupSort`: state `options.groupSort` + URL, `onGroupSortChange`, ikon chip group jadi tombol (`SearchBar.jsx`), i18n `group_sort_asc/desc`; tes DataTable2 & SearchBar
  - [x] 13.3 Info jumlah data `start–end / total` di footer `DataTable2` (`core.datatable.page_range`)
  - [x] 13.4 Pager grup kontras (primer + border + `rounded-md`); loading = `Loader2` + teks (`group_loading`), tanpa skeleton
  - [x] 13.5 Mobile infinite scroll: `useGroupNodeInfinite` (`useInfiniteQuery`), `GroupTree` prop `infinite` (`LoadMoreSentinel` + `IntersectionObserver`, info "dimuat / total"), `DataTable2` mobile memakainya; 6 tes RTL baru
  - **Diverifikasi di browser (Opportunity, 1.163 baris uji ZZV, sudah dihapus):** klik ikon chip group membalik `groupSort` (label & panah berganti, URL `groupSort=desc`), grup level-0 terurut Z->A tanpa mengubah `sort=-created_at`; `?sort=expected_value` (kolom `groupAggregate`) mengurutkan grup level-0 menaik menurut SUM; pager node leaf (210 baris) tampil PUTIH SOLID kontras & membulat; info jumlah data `1-25 / 46` tampil di footer desktop di sebelah kontrol halaman; mobile+grouping: buka leaf 250 baris -> "25 / 250" tanpa tombol pager, scroll ke sentinel -> "50 / 250" (infinite scroll nyata, bukan hanya tes jsdom).
  - **Catatan verifikasi:** klik toggle grup 2x berturut (double-click tak sengaja) membuka lalu MENUTUP lagi node yang sama -- perilaku disengaja (toggle), bukan bug.

- [x] 14. Revisi pasca-verifikasi #2: cache TanStack, prefetch, sticky (Requirement 22) -- 2026-09-27
  - [x] 14.1 `useGroupNode.js`: ekstrak `groupNodeQueryKey`/`fetchGroupNode`/`prefetchGroupNode` (dipakai bersama oleh hook & prefetch, kunci cache dijamin identik); `gcTime` 30dtk -> 5 menit (`useGroupNode` & `useGroupNodeInfinite`); unit test baru `useGroupNode.test.js` (key stabil/order-independent, fetcher, prefetch shape)
  - [x] 14.2 `GroupTree.jsx`: `onPrefetch` di args `renderGroupHeader` (hover node tertutup, mode paged saja); efek next-page-prefetch dgn guard `isPlaceholderData` (bug ditemukan+diperbaiki lewat tes, lihat Requirement 22.3); `queryClient` via `useQueryClient()` masuk `ctx`
  - [x] 14.3 `GroupHeaderRow.jsx`/`GroupHeaderCard`: wiring `onMouseEnter`/`onFocus` -> `onPrefetch`; sticky desktop SATU LEVEL (top/z-index sama semua depth) setelah percobaan breadcrumb-bertumpuk GAGAL diverifikasi browser (lihat Requirement 22.4) -- 3 tes lama `GroupTree.rtl.test.jsx` (asumsi jumlah panggilan axios TANPA prefetch) diperbaiki jadi asersi `.some()`/param spesifik, bukan `.at(-1)`/hitungan kaku; tes baru: hover-prefetch, next-page-prefetch, batas halaman terakhir, sticky (GroupHeaderRow.rtl.test.jsx)
  - [x] 14.4 Verifikasi browser (Opportunity, 1.163 baris ZZV, sudah dihapus): hover node tertutup memicu request SEBELUM klik & klik berikutnya instan (150ms, tanpa "Memuat"); buka 3 level (Customer>Tahap>Ditugaskan, leaf 210 baris) + scroll -> header "ZZV User 1 (210)" tetap menempel tepat di bawah header kolom, TIDAK ada header level lain yg salah posisi (percobaan pertama breadcrumb-bertumpuk memang rusak persis begini, screenshot jadi bukti utk keputusan pindah ke single-level)
  - [x] 14.5 Full regresi FE 2159 test (105 file, area Table+Pages) + 168 test suite Group -- semua lulus; ESLint 0 error; Pint pass
  - **Scope yg SENGAJA tidak dikerjakan (dikonfirmasi user via AskUserQuestion):** migrasi fetch ROW datar (TANPA grouping) dari Inertia `router.get` ke TanStack Query -- perubahan arsitektur besar (100+ halaman Index), di luar scope revisi ini.

- [x] 15. Revisi pasca-verifikasi #3: wrap sel header/body + fix sticky-top dinamis (Requirement 23) -- 2026-09-27
  - [x] 15.1 `table.css`: default `th span, td span` jadi wrap (`whitespace-normal break-words`, bukan `whitespace-nowrap overflow-hidden`); `Header.jsx` buang `RunningText`/`RunningTextContent` (marquee), ganti `<span>` polos yg wrap alami
  - [x] 15.2 `Table2.jsx`: `NOWRAP_CELL_TYPES`/`cellWrapClassName()` -- number/currency/date/time/datetime TETAP nowrap+ellipsis (`!important`), tipe lain (string/relation/html/dst) ikut default wrap; diterapkan ke span fallback, Link-wrapped cell, `html`-type span, & hasil custom `cell()` render-prop. `GroupHeaderRow.jsx` sel agregat trailing ikut nowrap eksplisit
  - [x] 15.3 BUG ditemukan user via screenshot browser SETELAH 15.1-15.2 di-deploy: header wrap ke 2-3 baris bikin `top` hardcode 25px (Requirement 21.9/22.4) SALAH, label baris terakhir header ketutup row grup sticky. Fix: `ResizeObserver` di `Table2.jsx` ukur tinggi TERBESAR semua `th` header, expose CSS var `--group-sticky-top` di `<table>`; `GroupHeaderRow.jsx` sticky `top` pakai `var(--group-sticky-top, 25px)` (bukan angka tetap). Percobaan pertama (observe cuma `th` PERTAMA, effect no-deps re-observe tiap render) TERBUKTI cacat lewat verifikasi browser (var macet di nilai basi 48px walau tinggi asli 65px) -- diperbaiki: observe SEMUA `th` + ambil max, effect deps `[selectable, actions, showedColumns]`
  - [x] 15.4 Verifikasi browser berulang (Opportunity, data ZZW sementara, dihapus stlh selesai): Items (Inventory) tanpa grouping -- header 1-4 baris wrap benar, body: date/number nowrap+ellipsis, relation/string/kategori wrap; Opportunity dgn grouping aktif, viewport 976px & 700px -- `--group-sticky-top` match persis tinggi `th` nyata (65px), row grup sticky nempel tepat di bawah header kolom tanpa nutupi/tertutup
  - [x] 15.5 Full regresi FE (area Table + Pages/Core, 2x run) exit 0; ESLint 0 error; Prettier pass

- [x] 16. Revisi pasca-verifikasi #4: skip reload Inertia utk sub-level/sort non-grup (Requirement 24) -- 2026-09-27/28
  - [x] 16.1 `groupLevels.js`: `sameRootLevel(a,b)` -- level 0 dua `Groups` sama persis?
  - [x] 16.2 `DataTable2.jsx`: `classifyOptionsChange(prev,next,{groupAggregateColumns,hasGroupTree})` (fungsi murni, di-export+unit-test `DataTable2.test.js`, 15 kasus) -> `"full"|"group-sublevel"|"sort-leaf-only"`; `loadData()` di-refactor pisah `buildOptionsUrl()` (dipakai ULANG jalur lokal, replaceState); state `localOverride`(`{group?,sort?}`)/`subLevelVersion` baru, dibersihkan otomatis begitu `groupMeta` server berganti (reload sungguhan terjadi); `groupTreeProps` pakai `effectiveLevels`/`effectiveQuery` (override lokal menang selama aktif)
  - [x] 16.3 `GroupTree.jsx`: prop `subLevelVersion` -- naik -> `openKeys` node kedalaman >=1 dipangkas tertutup (depth 0 aman) + SEMUA `pages` direset (pagination anak tiap node berubah). Diwire ke 3 titik render (Table2.jsx desktop, DataTable2.jsx mobile infinite, keduanya dari `groupTreeProps.subLevelVersion`)
  - [x] 16.4 BUG ditemukan lewat regresi tes SENDIRI (bukan browser) saat implementasi: test lama "Sort TETAP aktif selama grouping" gagal krn `groupMeta` tak di-mock di fixture-nya -> `classifyOptionsChange` awalnya TAK menjaga kasus tsb (grup aktif di URL tapi `groupMeta` server null/tak ada tree sungguhan) -- ditambah guard `hasGroupTree` eksplisit, `false` -> selalu `"full"` apapun rule lain
  - [x] 16.5 Test baru: `DataTable2.rtl.test.jsx` (skip-fetch group-sublevel/level-0-berubah/hapus-grup/tanpa-groupMeta, sort-leaf-only/sort-groupAggregate, semua via `waitFor` bukan `flushReload()` mentah -- state hasil setState di callback debounce butuh act-aware polling, bukan cuma maju timer), `GroupTree.rtl.test.jsx` (subLevelVersion menutup depth>=1 & mempertahankan depth 0, versi sama = tak berubah)
  - [x] 16.6 Verifikasi browser (Opportunity, data ZZW sementara, dihapus stlh selesai): ganti sub-level Customer->Assigned To sambil grup "identified" terbuka -- network TANPA request Inertia penuh, HANYA XHR TanStack node (`groupPath`), isi grup ikut berganti sementara grup tetap terbuka; sort ke kolom non-grup/non-aggregate ("Notes") -- TANPA request baru sama sekali kecuali refetch node (`groupPath` sama, `sort` baru), grup TETAP terbuka; sort ke kolom groupAggregate ("Probability") -- BENAR reload penuh (confirmed request tanpa `groupPath`), grup ikut tertutup (perilaku reload lama, bukan regresi)
  - [x] 16.7 Full regresi FE (area Table + Pages/Core) 2181/2182 (1 flaky pre-existing SearchBar/DateSelector, tak terkait); ESLint 0 error; Prettier pass

## Notes

- Setiap task mereferensi requirement spesifik untuk traceability; checkpoint (2, 4, 6, 8, 10) = **stop & konfirmasi ke user**.
- Pint/lint HANYA di task 11.4 (satu kali, aturan CLAUDE.md), bukan per task.
- **Commit hanya saat user menginstruksikan eksplisit (per-momen); `git push` menunggu instruksi eksplisit.** Berbeda dari spec lama yang mengizinkan commit per task — aturan user lebih ketat sekarang.
- **Konsistensi antar-fase:** di antara task 1–3 (BE) dan task 9 (integrasi FE), aplikasi utuh belum konsisten end-to-end (mis. saved filter mengembalikan list sementara FE lama masih membaca objek; `groupCounts` dihapus di 3.6 sementara `Table2` lama masih membacanya). Tidak ada yang di-deploy di tengah — **jangan uji manual di browser sebelum task 9 selesai**; test per-fase memakai mock/unit.
- Task 1.3, 3.1, 3.2, 3.6, 3.7 menyentuh `DataTableScope` — jalur panas 100+ halaman list. Jalankan regresi sort/soft-delete/adaptive-fetch/searchScope di checkpoint 4. Task 3.1 dan 7.1 adalah **refactor murni**: test lama tidak boleh diubah asersinya; bila gagal, itu bug pemindahan, bukan perubahan spec.
- Urutan kerja: 1.1 sebelum semua task BE lain; 3.1 sebelum 3.2; 3.6 sebelum 3.7/3.9; 7.1 sebelum 7.5; 5.1 sebelum 7.2/9.x; 5.5 sebelum 9.2/9.4; 9.2 sebelum 9.3. Task 5–7 (FE) independen dari task 1–3 (BE) sampai task 9 — bisa paralel.
- Test FE mengikuti prioritas `docs/frontend.md#testing`: unit fungsi murni (5.2) → RTL (5.6, 7.6, 9.5); hindari source-assertion. Suffix `.rtl.test.jsx` wajib untuk test yang me-render komponen. Tanpa `vi.useFakeTimers` (macet dengan Radix/cmdk).
- Test BE: jebakan yang pernah kena — `HasBranch` (user test perlu `branches()->attach()` ke branch `is_main_branch`), FK SQLite menolak ULID acak, `QueryDetectorMiddleware` false-positive, model ber-Submitable butuh `initPermissions()` sebelum `create()`.
- CI/CD: PR yang di-merge ke `dev-1` auto-deploy ke staging. Migration data (1.4) berjalan saat deploy — bila ingin ditunda/digabung dengan PR lain, pasang label `skip-deploy` pada PR.
- Worktree: spec ini ditulis di worktree yang sudah di-fast-forward ke `origin/dev-1` (`f86ec52`). Bila worktree baru dibuat untuk implementasi, `git fetch origin && git pull origin <branch>` dulu (aturan CLAUDE.md) agar tidak berbasis commit lama.
- Optional: 5.3*, 5.4*, 12* — tanyakan ke user saat mulai implementasi: jalankan required saja atau termasuk optional.
- Delegasi: sesuai CLAUDE.md global, bila sesi berjalan di model di atas Sonnet, pengerjaan task diserahkan ke subagent Sonnet dengan prompt self-contained (file path + section design + requirement); reviewer meninjau diff & hasil test sebelum menandai `[x]`.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "5.1", "5.7", "7.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.4", "5.2", "5.3", "5.4", "5.5", "7.2"] },
    { "id": 2, "tasks": ["1.5", "3.1", "5.6", "7.3", "7.4"] },
    { "id": 3, "tasks": ["1.6", "3.2", "7.5"] },
    { "id": 4, "tasks": ["2", "3.3", "3.4", "6", "7.6"] },
    { "id": 5, "tasks": ["3.5", "3.6", "8"] },
    { "id": 6, "tasks": ["3.7", "3.9"] },
    { "id": 7, "tasks": ["3.8", "3.10", "3.11"] },
    { "id": 8, "tasks": ["4"] },
    { "id": 9, "tasks": ["9.1", "9.2", "9.4", "11.2", "12"] },
    { "id": 10, "tasks": ["9.3"] },
    { "id": 11, "tasks": ["9.5"] },
    { "id": 12, "tasks": ["10"] },
    { "id": 13, "tasks": ["11.1"] },
    { "id": 14, "tasks": ["11.3"] },
    { "id": 15, "tasks": ["11.4"] },
    { "id": 16, "tasks": ["11.5"] }
  ]
}
```
