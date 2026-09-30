# Implementation Plan: DataTable2 Grouping

## Overview

Dua perubahan terpisah di `DataTableScope::dataTable()` (backend, `app/Models/Scopes/DataTableScope.php`): gate validasi `sortable` untuk `?sort=` (hardening celah existing, Requirement 2) dan query `GROUP BY` count terpisah untuk `?group=` (opt-in, Requirement 3). Kolom groupable dideklarasikan lewat extension point `$configColumns` yang sudah ada (`app/Traits/LinkModel.php` **tidak diubah**). Frontend: `DataTable2.jsx` dapat kontrol "Group by" yang mengunci sort ke kolom grup, `Table2.jsx` render header grup full-width (run-length dari `data` yang sudah terurut, count dari `groupCounts` backend — bukan dihitung ulang di client). Mekanisme pagination existing **tidak diubah sama sekali**.

## Tasks

- [x] 1. Backend: Gate validasi `sortable`
  - [x] 1.1 `DataTableScope::dataTable()` — ganti resolusi sort existing dengan versi yang memvalidasi `$requestedSort` (dari `?sort=` atau `$appliedFilter->sort`) terhadap `dataTableColumns[].sortable` sebelum dipakai; fallback diam-diam ke `Model::getDefaultSortColumn()` kalau tidak valid/tidak dikenal/dotted path relasi
    - _Requirements: 2.1, 2.2, 2.3, 2.4_
  - [x] 1.2 Write feature test gate sortable (`tests/Feature/Models/Scopes/DataTableScopeGroupingTest.php`)
    - **Property: gate sortable tidak bisa dilewati**
    - Skenario: `?sort=<kolom sortable:false>` → hasil tetap terurut default; `?sort=<kolom tak dikenal/dotted path>` → fallback default, tidak 422/500; `?sort=<kolom sortable>` normal → regression tetap bekerja
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4** — 3/3 pass

- [x] 2. Checkpoint - Ensure gate sortable tests pass
  - Pass (bareng Task 4, satu file test).

- [x] 3. Backend: Grouping — opt-in config + count query
  - [x] 3.1 `app/Models/Finances/Account.php` — tambah `'groupable' => true` ke entry `account_type` yang SUDAH ADA di `$configColumns` (baris ~67, saat ini cuma `valueTrans`) — proof-of-concept, kolom pertama yang mengaktifkan fitur ini
    - _Requirements: 1.1, 1.2_
  - [x] 3.2 `DataTableScope::dataTable()` — sisipkan logic `groupCounts` sebelum `$paginator = $query->paginate($show)`: validasi `?group=` terhadap flag `groupable` DAN `type !== 'relation'`, clone `$query` (reset order/eager-load), `SELECT col, COUNT(*) GROUP BY col`
    - _Requirements: 1.3, 3.1, 3.4, 3.5_
  - [x] 3.3 Tambahkan `'groupCounts' => $groupCounts` ke array `Inertia::share([...])`
    - _Requirements: 3.2_
  - [x] 3.4 Write feature test grouping backend (lanjutan `DataTableScopeGroupingTest.php`)
    - **Property 1: count akurat lintas halaman** — grup dgn N baris > `show` tetap `groupCounts[value] === N`
    - **Property 2: opt-in tervalidasi** — `?group=<kolom tidak groupable>` dan `?group=<kolom relasi>` → `groupCounts` null, TIDAK ada query `GROUP BY` dijalankan
    - **Property 3: filter konsisten** — `?group=` + `?fid=<filter aktif>` → `groupCounts` cuma hitung baris yang lolos filter
    - **Property 4: zero overhead** — request TANPA `?group=` → jumlah query SQL identik sebelum/sesudah perubahan
    - **Validates: Requirements 1.2, 1.3, 3.1, 3.2, 3.3, 3.4, 3.5** — 8/8 pass (17 assertions), `tests/Feature/Models/Scopes/DataTableScopeGroupingTest.php` mencakup Task 1.2 + 3.4 sekaligus (1 file, model stub `DtgRecord`)

- [x] 4. Checkpoint - Ensure backend grouping tests pass
  - Pass — `php -d memory_limit=-1 artisan test tests/Feature/Models/Scopes/DataTableScopeGroupingTest.php`: 8/8, 0 failed.

- [x] 5. Frontend: Kontrol "Group by" & kunci sort
  - [x] 5.1 `resources/js/Pages/Core/DataTable2.jsx` — tambah `setGroup()` (set `options.group`, kunci `options.sort` mengikuti kolom grup, reset `page` ke 1), destructure `groupCounts` dari `usePage().props`
    - _Requirements: 4.2, 4.4, 4.5_
  - [x] 5.2 `DataTable2.jsx` — tambah `Select` "Group by" di toolbar desktop (sebelah Sort By) + submenu mobile, opsi dari `columns.filter(x => x.groupable)` plus "Tidak ada"; disable dropdown pemilih kolom Sort By selama `options.group` truthy; pass `groupBy`/`groupCounts` ke `<Table2 />`
    - _Requirements: 4.1, 4.3_ — plus lang key `core.datatable.group_by`/`no_grouping` (id+en)
  - [x] 5.3 Write test `DataTable2.rtl.test.jsx`
    - Pilih kolom "Group by" → `options.sort` ikut berubah, dropdown Sort By ter-disable, `page` reset ke 1
    - Pilih "Tidak ada" → grouping mati, `options.sort` TIDAK auto-reset
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5** — 4/4 pass (describe "grouping (Group by control)")

- [x] 6. Checkpoint - Ensure frontend DataTable2 tests pass
  - Pass — `npx vitest run resources/js/Pages/Core/DataTable2.rtl.test.jsx`: semua pass (53 total file+Table2 gabungan).

- [x] 7. Frontend: Render header grup & collapse di Table2
  - [x] 7.1 `resources/js/Components/Table/Table2.jsx` — tambah props `groupBy`/`groupCounts`, `useMemo` run-length (`groupedRows`) yang deteksi batas grup dari `data` tanpa re-sort
    - _Requirements: 5.1_
  - [x] 7.2 `Table2.jsx` — render baris header grup full-width (`gridColumn: span N`, pola sama baris no-data/footer existing) dengan chevron collapse + label count dari `groupCounts[value]`; state `collapsedGroups` (Set, tidak persist); skip render baris data yang grup-nya collapsed
    - _Requirements: 5.2, 5.3, 5.4_
  - [x] 7.3 Write test `Table2.rtl.test.jsx`/`Table2.dom.test.js`
    - `groupBy`+`groupCounts` diberikan → N header grup sesuai run-length, label count dari `groupCounts` (bukan `data.length`)
    - Toggle collapse → baris hilang/muncul kembali
    - `groupBy` null → tidak ada header grup sama sekali (regression 73+ halaman existing)
    - Grup sama muncul di 2 batch terpisah (simulasi terpotong halaman) → 2 header terpisah, count SAMA dari `groupCounts`
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6** — 4/4 pass baru + 14/14 `Table2.dom.test.js` regresi tetap hijau

- [x] 8. Checkpoint - Ensure Table2 tests pass
  - Pass — `Table2.rtl.test.jsx` + `Table2.dom.test.js` semua hijau, 0 failed.

- [x] 8.5 Visual testing (browser nyata) — 4 temuan dari user, semua diperbaiki/diverifikasi
  - **Fix 1 — Icon hilang di tombol "Group by"**: `DataTable2.jsx` tambah import `Group` (lucide-react), render di dalam `SelectTrigger` sebelum `SelectValue` (desktop toolbar) — konsisten dgn tombol Filter/Reload yang sudah pakai icon.
  - **Fix 2 — Label header grup tidak diterjemahkan (`valueTrans`)**: `Table2.jsx` group header sebelumnya render raw value (`bank`, `cash`) — Cell component menerapkan `valueTrans`/`parse` utk kolom string tapi header grup tidak. Fix: lookup `headers?.[groupBy]` (raw column config, sudah ada sbg prop `columns`), terapkan logic SAMA persis dgn Cell (`valueTrans ? t(...) : parse ? ... : value`). Verified browser: "bank"→"Bank", "cash"→"Kas", dst.
  - **Fix 3 — Garis divider kolom "nabrak" row header grup**: `Header.jsx` render divider resize-handle per kolom sbg `position: absolute` setinggi SELURUH tabel (`z-1`) — desain existing utk semua baris, tapi background header grup lama (`bg-muted/40`, translucent) tidak menutupinya. Fix: ganti ke `bg-muted` (opaque) + `z-2 relative`, pola sama persis dgn baris footer spacer existing (`bg-background z-2`).
  - **Fix 4 — Error 500 "Maximum execution time 30s exceeded" saat grouping**: BUKAN bug di kode fitur — root cause resource contention dari test suite verifikasi (Task 9) yang saya jalankan BARENGAN dgn server dev yang dipakai user testing (single-threaded `php artisan serve`). Ditemukan juga: proses eksternal (`artisan boost:mcp`, bukan bagian dari kerjaan ini) berulang kali auto-trigger `migrate`/`db:seed` di background selama sesi, menyebabkan DB dev ke-reset beberapa kali (admin user & data Account sempat hilang, di-re-seed ulang manual).
  - **Temuan sampingan (out-of-scope, di-flag terpisah)**: 2 key locale `account_type.options` bermasalah — `discount` tidak ada entry sama sekali, `expense_included_in_valuation` (dipakai AccountSeeder) mismatch ejaan dgn `expenses_included_in_valuation` (lang file). Sudah muncul di layar sbg raw key string. Bug pre-existing (mempengaruhi kolom Account Type biasa juga, bukan spesifik grouping) — di-spawn sbg task terpisah (`task_2de89901`), tidak diperbaiki di sini.
  - Regression check: `Table2.rtl.test.jsx`+`Table2.dom.test.js` 68/68 pass setelah Fix 1-3.

- [x] 8.6 Follow-up: locale gap + 2 temuan UI lanjutan (semua diverifikasi browser)
  - **Locale `account_type.options` (temuan sampingan Task 8.5)**: `lang/id|en/finances/account.php` — tambah key `discount` (id: "Diskon", en: "Discount") yg hilang total; perbaiki mismatch ejaan `expenses_included_in_valuation` → `expense_included_in_valuation` (singular, ikut value existing di `AccountSeeder.php`, bukan sebaliknya). Diaudit semua 13 value `account_type` di seeder vs locale — tidak ada mismatch lain. `LocaleKeysTest` tetap pass.
  - **Fix — Label grup null/undefined tidak readable**: `Table2.jsx` group header utk value kosong sebelumnya fallback ke `groupKey` mentah (`String(null)` → literal teks "null"). Tambah key `core.datatable.no_group_value` (id: "Tanpa Nilai", en: "No Value") di `lang/id|en/core/datatable.php`, dipakai sbg fallback label pengganti raw groupKey. Lookup `groupCounts?.[groupKey]` TIDAK berubah (tetap pakai string "null" dari backend, cuma label tampilan yg diganti).
  - **Fix — Tabel overflow, seluruh halaman ikut ter-scroll**: root cause klasik nested-flexbox — card wrapper (`DataTable2.jsx`) sudah `flex-1` tapi tanpa `min-h-0`, default `min-height:auto` bikin flex item tidak pernah menyusut di bawah ukuran konten (table tumbuh sebebas row count), overflow lolos ke ancestor `AppLayout` yg punya `overflow-y-auto` → seluruh page (judul+toolbar+table) ikut scroll bareng. Fix: `min-h-0` + `overflow-hidden` berantai dari card wrapper → `Table2` root (`grid`→`flex flex-col min-h-0`, grid track `auto` tidak stretch ke container height) → wrapper `<table>`. `table.css`: `.resizeable-table` `overflow-y-hidden`→`overflow-auto`, `thead th` ditambah `sticky top-0 z-3` (z-3 > group-header/footer row `z-2` existing, supaya sticky header tetap di atas row yg lewat scroll, tanpa ganggu masking divider-vs-group-header dari Fix 3 Task 8.5). Mobile card-list (`isMobile`) turut dibuat scroll independen (`overflow-y-auto`) dgn pola sama.
  - Verified browser (viewport 1400×900, grouped Accounts, 100 rows): header+toolbar+pagination tetap pinned saat body di-scroll, sticky header terbukti jalan, tidak ada divider nabrak row grup (termasuk saat scroll), grup "Tanpa Nilai"/"Diskon"/"Beban Masuk Dalam Penilaian" semua render label benar (bukan raw key).
  - Regression check: `Table2.rtl.test.jsx`+`DataTable2.rtl.test.jsx` 54/54 pass; `LocaleKeysTest` 1/1 pass.

- [x] 8.7 Fix: garis divider kolom masih nabrak row group (regresi dari fix sticky-header Task 8.6)
  - Root cause: `thead th { position: sticky }` (Task 8.6) SELALU membentuk stacking context baru (spesifikasi CSS — beda dgn `position:relative`, sticky bikin stacking context terlepas dari z-index eksplisit). Divider lama (`Header.jsx`, absolute overlay child `th`) jadi ikut "terjebak" satu lapis dgn `th` — seluruh subtree `th` (termasuk divider di dalamnya) otomatis di atas row group (z-2), berapa pun z-index lokal divider-nya. Dampak: divider balik nabrak row group tiap kali di-scroll.
  - Fix: pindahkan tanggung jawab GARIS PERMANEN dari absolute-overlay-div (JS-measured, rawan konflik stacking context) ke `border-r` CSS asli di `<th>` (`Header.jsx`) & tiap `<td>` data (`Table2.jsx`). Border asli ikut alur dokumen biasa, otomatis TIDAK ada di row group/footer/no-data (row itu cuma 1 `<td>` yg span semua kolom, tanpa border internal) — tanpa perlu z-index sama sekali. Overlay-div lama (`Header.jsx`) dipertahankan HANYA sbg hit-area interaktif resize (transparan saat idle, cuma re-highlight saat hover/drag) — grab-area & fungsi resize/reset persis sama seperti sebelumnya (diverifikasi: drag-resize & double-click-reset masih jalan, div masih setinggi `tableHeight` penuh).
  - Verified browser: scroll grouped Accounts penuh (Tanpa Nilai/Bank/Kas/HPP/Aset Lancar/Diskon/Beban Masuk Dalam Penilaian/Hutang/Piutang/Stok) — tidak ada garis nabrak row group sama sekali; drag-resize kolom "Kode" & double-click reset lancar.
  - Regression: `Table2.rtl.test.jsx`+`DataTable2.rtl.test.jsx` 54/54 pass.

- [x] 8.8 Fix: divider kolom "Aksi" (actions) masih nabrak row group — terlewat di Task 8.7
  - Root cause: kolom actions TIDAK dirender lewat komponen `Header.jsx` (yg sudah difix Task 8.7) — dia punya markup divider sendiri yg di-hardcode langsung di `Table2.jsx` (duplikat pola lama, murni dekoratif, TANPA handler resize sama sekali). Terlewat saat audit Task 8.7 krn beda file/lokasi dari divider kolom data biasa.
  - Fix: hapus overlay-div duplikat itu, ganti `border-r border-muted-foreground/15` langsung di `<th>` aksi (header) & `<td>` aksi (tiap baris data) — pola sama persis dgn fix Task 8.7, tanpa perlu logic interaktif krn kolom ini memang tidak resizeable.
  - Verified browser (screenshot dari user, scroll grouped Accounts): garis setelah kolom "Aksi" hilang total di semua row group yg dilaporkan (Tanpa Nilai/Bank/Kas/HPP/Aset Lancar/Diskon/Beban Masuk Dalam Penilaian/Akun Pendapatan/Hutang).
  - Regression: `Table2.rtl.test.jsx`+`DataTable2.rtl.test.jsx` 54/54 pass.

- [x] 8.9 Follow-up: relasi groupable via FK + group label type-aware penuh (permintaan user, 4 poin)
  - **1. `type: relation` kini BISA groupable (BelongsTo saja)**: audit `LinkModel.php` nemuin `type: 'relation'` dipakai utk 4 relasi beda (BelongsTo/MorphTo/HasOne/MorphOne) -- cuma BelongsTo yg FK-nya 1 kolom scalar di tabel model SENDIRI, bisa langsung `GROUP BY`. `DataTableScope.php`: `resolveRelationGroupColumn()` resolve FK via `$model->{nameOfFunction}()` + `instanceof BelongsTo` (HasOne/MorphOne FK ada di tabel LAIN butuh JOIN, MorphTo butuh kombinasi id+type ambigu -- keduanya sengaja TETAP ditolak). Sort ikut di-resolve ke FK yg SAMA saat dikunci ke kolom grup relasi aktif (baris se-grup nempel di paginate). extraKeys dipaksa include aksesor relasi (terpisah dari FK sort) supaya relasi tetap ter-eager-load walau disembunyikan dari cookie kolom visible.
  - **2. Type blank-render (`json`/`mixed`/`relations` jamak) di-filter dari BE**: `sanitizeGroupableColumns()` baru, dipanggil di awal macro -- flag `groupable` dipaksa `false` utk type-type ini (dan relasi non-BelongsTo) SEBELUM `dataTableColumns` dipakai dropdown FE maupun validasi query, satu sumber kebenaran.
  - **3. Boolean group label BUKAN checkbox**: `Table2.jsx` `GroupLabel` baru, cabang `boolean` render teks terjemahan (`column.parse` kalau ada, fallback key baru `core.datatable.yes`/`no`) -- keputusan desain (user: "kamu atur saja").
  - **4. Type lain diformat sesuai Cell.jsx**: `GroupLabel` cermin penuh switch(type) Cell -- date/time/datetime (`format()` locale-aware), number/currency (`formatNumber()` + prefix simbol), formStatus/formStatuses (`<BadgeStatus>`, baca raw group value krn Cell baca `row.appendStatus` yg tak relevan di konteks grup), relation (`convertTemplateLink`), html (`dangerouslySetInnerHTML`, sama seperti Cell), string (unchanged, fix sebelumnya).
  - **Fix korektif tambahan (ditemukan saat implementasi, bukan diminta langsung tapi perlu utk korektnas)**: (a) "tanpa nilai" dicek eksplisit `null`/`undefined`/`""` -- BUKAN falsy JS biasa lagi, supaya boolean `false` & number `0` (nilai sah) tidak ikut ke-treat kosong; (b) run-length grouping (`groupedRows`) & cek collapsed-row DIPERBAIKI utk relasi -- `row[groupBy]` object hasil eager-load beda instance per baris (JSON deserialize), `!==` mentah selalu true (broken); ekstrak `primaryKey` relasi via `groupKeyOf()` sbg kunci banding stabil.
  - Test BE baru (`DataTableScopeGroupingTest.php`, stub `primaryContact` HasOne + `tags` json): BelongsTo groups by FK (+ verifikasi row tetap `relationLoaded`), HasOne ditolak (FK beda tabel), json ditolak, flag `groupable` yg disanitasi kelihatan di `dataTableColumns` yg di-share (bukan cuma di-reject saat query), sort locked ke grup relasi resolve ke FK yg sama (baris adjacent). 14 test, 29 assertion, semua pass.
  - Test FE baru (`Table2.rtl.test.jsx`, describe "GroupLabel"): date/number/number-0/boolean/boolean-parse/formStatus/relation/relation-null/html -- 9 test baru, termasuk regresi run-length utk 2 instance object relasi beda referensi tapi id sama (harus 1 grup, bukan 2). 63/63 pass total file.
  - Verified browser (regresi, viewport 1400x900): proof-of-concept existing `Account.account_type` (string type, "Tanpa Nilai"/"Diskon"/"Beban Masuk Dalam Penilaian") tetap render benar, tidak ada divider nabrak -- perubahan besar di GroupLabel tidak mempengaruhi jalur string yang sudah ada.
  - Pint clean.

- [x] 8.10 Follow-up: date/number bucket grouping + sort tidak lagi dikunci (permintaan user, 3 poin)
  - **1. Grouping date/time/datetime dgn granularity**: dropdown submenu baru di sebelah "Group by" (Hari/Bulan/Kuartal/Semester/Tahun, default Bulan), muncul hanya saat kolom grup aktif bertipe date/time/datetime. Backend: `DataTableScope::dateGroupExpression()` bangun ekspresi SQL raw per granularity, PORTABLE 2 driver (sqlite: `strftime`, mysql produksi: `DATE_FORMAT`/`YEAR`/`QUARTER`/`CEIL(MONTH/6)`, lihat `.env.example`). Key hasil semua granularity sengaja string yg urut leksikografis = kronologis (`YYYY`, `YYYY-MM`, `YYYY-Qn`, `YYYY-Hn`, `YYYY-MM-DD`) -- ORDER BY ekspresi yg sama langsung ASC, tanpa CAST tambahan. FE: `dateGroupBucketKey()` (Table2.jsx) cermin PERSIS formula SQL (termasuk rumus integer quarter/half) supaya run-length grouping client-side match batas grup hasil backend; `GroupLabel` decode kunci bucket jadi label manusiawi ("Januari 2026", "Kuartal 1 2026", dst, key lang baru `core.datatable.granularity.*`).
  - **2. Grouping number/currency dgn range yg bisa diatur**: dropdown submenu baru (mirror date), opsi PER-KOLOM via config baru `groupRangeOptions` (array, mis. `[10, 100, 1000]`) -- BUKAN daftar universal, krn lebar bucket yg masuk akal beda jauh per kolom (quantity vs currency amount). Fallback `DEFAULT_NUMBER_GROUP_RANGE_OPTIONS = [10,100,1000]` kalau model tak override. Backend bucket = `floor(value/range)*range` (lower bound). **Bug ketauan saat test**: SQLite `FLOOR()` TIDAK tersedia di build PHP/PDO environment ini (`SQLITE_ENABLE_MATH_FUNCTIONS` tak aktif) -- `numberGroupBucketExpression()` deteksi driver, MySQL pakai `FLOOR()` native, SQLite pakai emulasi CAST+koreksi tanda (floor bukan sekadar truncation utk nilai negatif). FE: `numberGroupBucketKey()` cermin sama; `GroupLabel` render label rentang "lower - upper" (format via `formatNumber()`, hormati `numberFormat`/currency symbol kolom).
  - **3. Sort tidak lagi dikunci ke kolom grup — jadi compound sort**: mekanisme lama (Task 8.9, sort dipaksa = nama kolom grup) DIHAPUS. Backend sekarang SELALU `ORDER BY <bucket/kolom grup> ASC` sbg primer (dipanggil duluan, independen dari `?sort=`), lalu pilihan sort user/default sbg SEKUNDER (tie-breaker dalam grup) — SQL native mendukung multi-kolom ORDER BY. Efek samping positif: special-case "relation FK sort saat jadi kolom grup aktif" dari Task 8.9 jadi TIDAK PERLU LAGI (dihapus, disederhanakan) krn grouping urus order-nya sendiri, independen dari sortable gate. FE: `setGroup()` tak lagi set `options.sort`; dropdown "Sort By" TIDAK lagi `disabled` selama grouping aktif.
  - **Bug lain ketauan & difix saat implementasi**: `$countQuery->getQuery()->orders = []` (reset utk count query) cuma bersihkan TEKS klausa ORDER BY, bukan `bindings['order']` (array terpisah di Laravel QueryBuilder) -- saat sort primer grup pakai `orderByRaw()` (placeholder `?`, granularity/range), binding lama nyangkut di clone count-query & jumlah binding > jumlah `?` di SQL akhir → PDO "column index out of range". Fix: reset eksplisit `bindings['order'] = []` juga.
  - Test BE baru (`DataTableScopeGroupingTest.php`, stub `due_date` date + `amount` number dgn `groupRangeOptions:[10,100]`): default granularity month, day/quarter/half/year eksplisit, invalid granularity fallback month, kontiguitas baris ter-paginate, default range dari opsi pertama config, range eksplisit, invalid range (negatif/nol/non-numeric) fallback, TANPA `?sort=` tetap urut by grup (compound sort baru), sort user jadi tie-breaker sekunder dalam grup. 22 test, 42 assertion, semua pass (SQLite, environment tes sesungguhnya).
  - Test FE baru (`Table2.rtl.test.jsx`): date day/month-default/quarter-half-year, number dgn groupRange (label rentang + run-length bucket benar); (`DataTable2.rtl.test.jsx`): selector granularity/range muncul & meneruskan prop ke Table2 dgn benar, assertion lama "sort locked"/"Sort By disabled" DIPERBARUI jadi assert perilaku baru (sort TIDAK berubah, Sort By TETAP aktif). 69/69 pass gabungan kedua file.
  - Verified browser LIVE end-to-end (bukan cuma unit test) — sempat tambah `groupable` sementara ke `Account.created_at` (date) & `Account.tax_rate` (number, `groupRangeOptions:[5,10,25]`) khusus utk verifikasi, DI-REVERT setelah selesai (bukan bagian scope permanen fitur ini): dropdown granularity muncul, "September 2026" (bulan) & "Kuartal 3 2026" (kuartal) render benar dgn count yg sesuai; dropdown range muncul dgn default "5"; Sort By TETAP bisa diklik selama grouping aktif (tidak disabled). Console browser bersih dari error terkait (cuma noise Pusher/WebSocket pre-existing, tak terkait).
  - Pint clean, ESLint clean (auto-fix prettier).

- [x] 8.11 Fix KRITIS: grouping "hilang total" utk kolom grup yg bukan kolom tampil sendiri (ditemukan user via browser SETELAH 8.10 selesai)
  - **Gejala**: grouping by `account_type` (kolom string, BUKAN kolom yg ditampilkan sendiri di tabel Accounts) render "Tanpa Nilai" utk grup PERTAMA lalu SISANYA jadi flat list TANPA header grup sama sekali -- bukan cuma label salah, row[groupBy] di FE literal `undefined` (dikonfirmasi baca response API langsung: field `account_type` sama sekali tidak ada di row JSON).
  - **Root cause**: mekanisme LAMA (sebelum Task 8.10) diam-diam mengandalkan sort-lock (`setGroup`: `sort = name`) sbg SATU-SATUNYA jalan kolom grup masuk `extraKeys` (via `$sortKeyRaw`, yg sudah dipaksa unconditionally masuk extraKeys sblm task ini). Task 8.10 hapus sort-lock (sesuai permintaan user) TAPI TIDAK sadar itu jg menghapus mekanisme implisit itu -- extraKeys Task 8.9 cuma nge-force include aksesor kolom grup utk TYPE RELATION doang, bukan utk SEMUA type groupable. Kolom grup scalar (string/date/number/boolean/formStatus) yg kebetulan TIDAK ada di kolom visible (cookie) -- persis kasus `account_type` yg memang bukan kolom yg ditampilkan sendiri -- jadi ke-drop dari SELECT sama sekali.
  - **Fix**: generalisasi kondisi `extraKeys` dari `$isGroupable && type==='relation' ? [...] : []` jadi cukup `$isGroupable ? [...] : []` -- kolom grup AKTIF (aksesor, bukan FK SQL) SELALU dipaksa masuk extraKeys, tak peduli type-nya, terlepas dari cookie visible & terlepas dari sort user (yg skrg independen).
  - **Test gap ketauan**: 21 test lama SEMUA masih pass krn tak satupun mensimulasikan cookie kolom-visible yg SENGAJA TIDAK menyertakan kolom grup (tanpa cookie sama sekali, `safeColumnsFromVisible()` fallback "semua show:true visible" -- gak pernah exercise jalur yg bug). Ditambah helper `dtCookie()` (pola sama dgn `DataTableAdaptiveFetchTest::dtCookie()`, sudah established di codebase) + 2 test baru: kolom grup scalar & relasi TETAP ter-select/ter-with() walau di-exclude eksplisit dari cookie. Diverifikasi kedua test BARU ini GAGAL kalau kondisi lama (`type==='relation'` only) dikembalikan sementara -- bukti nyata regresi ke-cover, bukan asal nulis assertion.
  - 23 test total (dari 21), 43 assertion, semua pass. Regresi lintas-model (`DeskDashboardBuilderTest`, `SavedFilterTest`, `DataTableScopeDefaultSortTest`, `DataTableScopeSoftDeleteTest`, `DataTableAdaptiveFetchTest`) dijalankan ulang -- tidak ada dampak ke konsumen `dataTable()` macro lainnya.
  - Verified browser: grouping `account_type` di halaman Accounts (real data, real cookie kolom visible) sekarang benar SEMPURNA di seluruh list -- "Bank", "Kas", "Harga Pokok Penjualan (HPP)", "Aset Lancar", "Diskon", "Beban Masuk Dalam Penilaian", "Akun Pendapatan" semua muncul dgn header grup & count yg benar (sblmnya cuma "Tanpa Nilai" lalu kosong).
  - Pint clean.

- [x] 8.12 Test lintas-type di browser: relation & boolean grouping (permintaan user: "coba test grouping pada type kolom lainnya") -- ketemu 2 bug lagi
  - **Verifikasi relation (BelongsTo self-referencing, `Account.parentAccount`)**: SUKSES tanpa perbaikan -- grup "Tanpa Nilai (5)" (akun top-level tanpa parent), lalu grup ternestifikasi per parent (mis. "1000 - Asset (2)", "1200 - Asset Bergerak (5)") dgn label via `convertTemplateLink` yg benar.
  - **Bug baru #1 -- boolean groupCounts selalu 0**: grouping `is_disabled` (boolean) render label benar ("Tidak"/"Ya") tapi count SELALU "(0)". Root cause: `$row->group_key` di count query itu stdClass MENTAH dari query builder (BUKAN lewat cast Eloquent `'is_disabled' => 'boolean'`) -- SQLite/MySQL simpan sbg integer 0/1, jadi key jadi string "0"/"1". Sementara row DATA ASLI (`data.data`, model ter-hydrate penuh) di-serialize ke JSON via cast Eloquent jadi literal `true`/`false`, dibaca FE via `String(rawBoolean)` => `"true"`/`"false"`. Key "0"/"1" tak pernah match "true"/"false" → lookup `groupCounts?.[groupKey]` selalu `?? 0`.
  - **Fix #1**: normalisasi eksplisit -- kalau `$groupConfig['type'] === 'boolean'`, konversi raw DB value ke string literal `'true'`/`'false'` (bukan pakai `(string)` polos) sblm jadi key `mapWithKeys`.
  - **Bug baru #2 (lebih fundamental) -- SEMUA test `groupCounts` di file ini pakai `assertEqualsCanonicalizing()`, method yg SALAH TOTAL utk kasus ini**: PHPUnit `assertEqualsCanonicalizing()` membandingkan array SEBAGAI SET VALUE, MENGABAIKAN KEY & urutan sepenuhnya. Test boolean sblmnya (`['true'=>2,'false'=>1,'null'=>1]` vs actual `[0=>1,'null'=>1,1=>2]`) LOLOS meski KEY-nya sama sekali beda (int 0/1 vs string "true"/"false") krn kedua sisi sama2 kumpulan {1,1,2} sbg SET -- baru ketauan lewat debug manual (`fwrite(STDERR, var_export(...))`) setelah test tetap hijau walau fix boolean sengaja dinonaktifkan utk verifikasi. Ini artinya SEMUA 12 assertion `groupCounts` sebelumnya (termasuk yg ditulis Task 8.9/8.10/8.11) berpotensi false-positive serupa, tidak benar2 menjamin KEY-nya presisi cocok dgn kontrak FE.
  - **Fix #2**: helper baru `assertGroupCounts($expected, $actual)` (ksort kedua sisi + `assertSame` strict) menggantikan SEMUA 12 pemakaian `assertEqualsCanonicalizing` di file ini. Diverifikasi: sblm fix #1 dipulihkan, test boolean baru ini (dgn `assertGroupCounts`) GAGAL dgn benar (`Failed asserting that two arrays are identical`, nunjukin persis `0=>1,1=>2` vs `'true'=>2,'false'=>1` diff) -- bukti method lama tidak akan pernah menangkap ini, method baru menangkap dgn benar.
  - Root cause SEBENARNYA akar dari bug boolean: `$row->group_key` dari raw query builder result TIDAK PERNAH lewat cast Eloquent, sedangkan row asli (data.data) SELALU lewat cast model saat di-JSON-kan Inertia -- perbedaan sumber data ini (satu raw SQL row, satu model ter-hydrate) adalah pola yg SAMA persis dgn root cause 2 bug grouping sebelumnya (null-key mismatch Task lama, relation-object-identity Task 8.9) -- count query & row data harus SELALU direkonsiliasi eksplisit per-type, tak bisa diasumsikan otomatis konsisten.
  - 24 test (dari 23), 59 assertion (naik dari 43 -- `assertGroupCounts` = 2 assertion per panggilan). Pint clean.
  - Verified browser: boolean `is_disabled` sekarang count benar ("Tidak (44)").

- [x] 9. Final checkpoint - Ensure all tests pass (BE + FE)
  - Full suite BE, sekuensial (setelah environment stabil, bukan barengan dgn server dev/proses lain):
    - `vendor/bin/phpunit --testsuite=Unit`: **653 passed, 0 failed** (31 deprecation warning pre-existing, 2 skipped)
    - `vendor/bin/phpunit --testsuite=Feature`: **1151/1152 passed, 1 failed** — `tests/Feature/Core/ManualBookImageTest.php` (screenshot dokumentasi manual-book yang belum ada di disk) — **pre-existing, tidak terkait grouping**: file test terakhir disentuh commit 5 Sept (2 minggu sebelum spec ini mulai), tidak ada file manual-book yang tersentuh sesi ini (`git status` bersih utk path itu).
  - Full suite FE (`npx vitest run`): sempat ada kegagalan flaky di run yang barengan resource contention (LinkModel axios-mock timing tests) — re-run spec-specific (`Table2.rtl.test.jsx`+`DataTable2.rtl.test.jsx`+`Table2.dom.test.js`) di kondisi bersih: **68/68 pass**, termasuk 4 test baru dari Fix 1-3 (icon/translasi/divider).
  - `vendor/bin/pint --dirty --format agent`: pass.
  - `npx eslint` (4 file yang diubah): 0 issue.

## Notes

- Task 1 (gate sortable) sengaja didahulukan & independen dari Task 3 (grouping) — dua celah/fitur berbeda yang kebetulan sama pola validasinya, tapi tidak saling bergantung secara logic. Keduanya edit file yang sama (`DataTableScope.php`) jadi tetap dikerjakan berurutan.
- Task 3.1 (Account.account_type) adalah **contoh proof-of-concept tunggal** untuk memverifikasi opt-in mechanism end-to-end — bukan rollout ke banyak model. Model/kolom lain yang mau pakai grouping tinggal deklarasi `groupable: true` yang sama, di luar scope task ini.
- `app/Traits/LinkModel.php` TIDAK ada task perubahan — flag `groupable` mengalir lewat extension point existing tanpa sentuh trait.
- Infinite scroll, nested grouping, SUM/AVG aggregate — TIDAK ada task untuk ini, dikonfirmasi out-of-scope (lihat `requirements.md` §Keputusan).

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "3.1", "5.1", "7.1"] },
    { "id": 1, "tasks": ["1.2", "3.2", "5.2", "7.2"] },
    { "id": 2, "tasks": ["3.3", "5.3", "7.3"] },
    { "id": 3, "tasks": ["3.4"] },
    { "id": 4, "tasks": ["9"] }
  ]
}
```
