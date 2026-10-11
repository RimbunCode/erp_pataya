# Requirements Document

## Introduction

`DataTable2` (dipakai 100+ halaman Index lewat macro `Model::dataTable()` di [`DataTableScope.php`](../../../app/Models/Scopes/DataTableScope.php)) mendukung group by **satu kolom**: satu query flat berurutan-per-grup, satu query `COUNT … GROUP BY` terpisah, dan pemotongan grup di client (run-length). Grup bisa terpotong lintas halaman, semua grup terbuka sekaligus, dan tidak ada nesting.

Spec ini mengubahnya menjadi **group by bertingkat gaya Odoo**: (1) kontrak group menjadi daftar level berurutan (maks 4) di semua lapisan; (2) data grup di-fetch **lazy per node** — level-0 hanya daftar nilai distinct + count (+ agregat), isi grup di-fetch saat dibuka lewat route index yang sama; (3) pagination independen per grup, `show` berlaku global; (4) agregat `sum/avg/min/max` di baris grup lewat config kode; (5) panel Group by Search Bar menjadi checkbox berurutan dengan chip `A > B`; (6) desktop **dan mobile** berbagi satu `GroupTree`.

Dokumen ini diturunkan dari [`design.md`](design.md) (alur design-first); nomor § merujuk ke bagian di sana. Spec ini **menggantikan** [`datatable2-grouping`](../datatable2-grouping/requirements.md) dan bagian group pada [`datatable2-advanced-search`](../datatable2-advanced-search/requirements.md).

## Glossary

- **Groups**: daftar level group berurutan `[{column, granularity|null, range|null}]`, maks 4, kolom unik; index 0 = level terluar. Satu-satunya bentuk kontrak group di semua lapisan.
- **Level**: satu elemen `Groups`. Level-0 = terluar.
- **Normalizer**: `GroupLevels::normalize()` (BE) / `normalizeGroupLevels()` (FE) — mengubah berbagai bentuk masukan jadi `Groups` secara *struktural* (bukan sanitasi nilai).
- **Node**: satu titik pada pohon grup, diidentifikasi `groupPath`. Node bisa berisi **daftar grup** (`type:"groups"`) atau **baris** (`type:"rows"`, node daun).
- **groupPath**: JSON array nilai `raw` leluhur node dari level-0 ke bawah. Path kosong = level-0.
- **Deskriptor grup**: `{key, raw, count, aggregates, label?}` — satu item daftar grup.
- **raw**: nilai SQL mentah sebuah grup; dikirim balik FE sebagai elemen `groupPath` dan di-*bind* sebagai parameter SQL.
- **key**: string ternormalisasi identitas grup (`'null'`, `'true'/'false'`, JSON ringkas utk formStatuses).
- **groupMeta**: prop Inertia `{levels:[{column,granularity,range,type}], aggregates:[{column,fn}]}`; `null` bila grouping tak aktif. `granularity/range` = nilai efektif yang dipakai SQL.
- **Request expand**: `GET` ke route index yang sama dengan `groupPath` (+ `groupPage`), dijawab JSON oleh macro.
- **Agregat grup**: nilai `sum|avg|min|max` atas kolom `number|currency` per grup, dikonfigurasi lewat `groupAggregate` di `$configColumns` (hanya kode).
- **GroupTree**: komponen FE rekursif yang merender node lewat render-prop (`renderGroupHeader`, `renderRow`) — dipakai desktop & mobile.
- **GroupLevelsEditor**: komponen panel checkbox + urutan level (SearchPanel, chip popover, Filter Template form).
- **Wire form**: representasi URL: `group=a,b`, `groupGranularity[a]=month`, `groupRange[b]=100`.

## Requirements

### Requirement 1: Kontrak `Groups` multi-level dan normalizer

**User Story:** As pengembang, I want satu kontrak group multi-level yang sama di semua lapisan, so that default model, saved filter, Filter Templates, Search Bar, dan URL tidak pernah berbeda bentuk.

#### Acceptance Criteria

1. THE sistem SHALL merepresentasikan group sebagai `Groups` — daftar berurutan `{column, granularity, range}`, maks **4** level, kolom **unik** (kolom pertama menang saat duplikat).
2. THE `GroupLevels::normalize()` (BE) dan `normalizeGroupLevels()` (FE) SHALL menerima: `null`/`''`/`[]` (→ `[]`), string satu kolom, string CSV `a,b` (khusus URL), objek lama `{column, granularity?, range?}` (→ 1 level), list string, list objek, dan campuran list string/objek.
3. THE normalizer SHALL bersifat **struktural**: ia SHALL TIDAK mengoreksi/membuang nilai `granularity`/`range` yang salah dan SHALL TIDAK memotong ke 4 level, agar `FormRequest` tetap dapat menolak nilai salah dengan 422.
4. THE normalizer SHALL idempoten (`normalize(normalize(x)) == normalize(x)`) dan menghasilkan `Groups` yang sama di PHP dan JS untuk masukan yang sama.
5. THE `granularity` SHALL hanya bermakna untuk kolom `date|time|datetime` (`day|month|quarter|half|year`, default `month`) dan `range` hanya untuk `number|currency` (default `groupRangeOptions[0]` kolom, fallback `10`); untuk tipe lain keduanya `null`.

### Requirement 2: Default group per model bertingkat

**User Story:** As pengembang modul, I want mendeklarasikan default group model sebagai satu atau beberapa level, so that halaman list langsung tampil terkelompok bertingkat tanpa aksi user.

#### Acceptance Criteria

1. THE `Traits/DataTable.php` SHALL menyediakan `getDefaultGroups(): array` yang membaca properti statis `$defaultGroups` model lewat pola `\property_exists(static::class, 'defaultGroups')` (properti SHALL TIDAK dideklarasikan di trait), dan mengembalikan hasil `GroupLevels::normalize()`.
2. THE `$defaultGroups` SHALL menerima bentuk: string kolom, list string, atau list objek/campuran (`['column'=>…, 'granularity'=>…, 'range'=>…]`).
3. THE `getDefaultGroupColumn(): ?string` dan properti `$defaultGroupColumn` SHALL dihapus; PHPDoc trait SHALL menjelaskan tiga bentuk deklarasi.
4. THE default model SHALL hanya dipakai untuk request Inertia (non-AJAX / `X-Inertia`), dan setiap level SHALL lolos gate `groupable` — level tak valid dibuang diam-diam (bukan SQL error).

### Requirement 3: Saved Filter dan Filter Templates menyimpan group bertingkat

**User Story:** As user, I want filter tersimpan dan template shared menyimpan urutan group bertingkat, so that saya bisa menerapkan tampilan terkelompok yang sama kapan saja.

#### Acceptance Criteria

1. THE `saved_filters.group` SHALL menyimpan `Groups` (list); accessor `SavedFilter::group` SHALL menormalkan pembacaan (objek lama → list; kosong → `null`) dan penulisan (list; kosong → `null`).
2. THE `null` SHALL berarti "saved filter tidak mengatur group" (menerapkannya SHALL TIDAK menimpa group aktif) — semantik existing dipertahankan.
3. THE `SavedFilter::groupValidationRules()` SHALL memvalidasi bentuk list: `group` nullable array `max:4`; `group.*.column` required string; `group.*.granularity` nullable `in:GroupLevels::GRANULARITIES`; `group.*.range` nullable numeric `gt:0`. Gate `groupable` SHALL tetap runtime (bukan di `FormRequest`).
4. THE `UpdateSavedFilterRequest`, `StoreFilterTemplateRequest`, dan `UpdateFilterTemplateRequest` SHALL menormalkan `group` di `prepareForValidation()` sehingga masukan berbentuk objek lama dari klien basi tetap diterima.
5. THE `SavedFilterController` (`index`, `update`) dan `FilterTemplateController` (`store`, `update`) SHALL membaca/menulis/mengembalikan `group` sebagai list.
6. THE migration data SHALL mengonversi baris `saved_filters.group` berbentuk objek menjadi list satu level; `down()` SHALL mengembalikan level pertama.
7. THE form Filter Templates SHALL menyediakan field Group by multi-level memakai `GroupLevelsEditor` (Requirement 11), menggantikan single-select + granularity/range.

### Requirement 4: Resolusi group efektif dan prop yang dibagikan

**User Story:** As sistem, I want menentukan group efektif dengan prioritas yang jelas dan membagikannya ke FE, so that state awal FE selalu cocok dengan yang dieksekusi backend.

#### Acceptance Criteria

1. THE `GroupLevelResolver` SHALL menentukan `Groups` efektif dengan prioritas: `?group` (ada; **kosong = "Tidak ada"** menimpa yang lain) > `group` milik filter aktif > `getDefaultGroups()` model.
2. THE `group` milik filter aktif dan default model SHALL hanya dipakai untuk request Inertia; request XHR/expand SHALL hanya memakai `?group` eksplisit.
3. THE resolver SHALL menerapkan gate `groupable` per level (`sanitizeGroupableColumns`: tolak tipe tak didukung, kolom turunan/`dependsOn`, `MorphTo`, relasi non-`BelongsTo`), membuang level tak valid diam-diam, mempertahankan urutan sisanya, dan memotong ke 4.
4. THE `granularity`/`range` per level SHALL diambil dari param URL (`groupGranularity[kolom]`, `groupRange[kolom]`) > level pada filter/default > default kolom; skalar lama (`groupGranularity=`/`groupRange=`) SHALL dianggap milik level pertama.
5. THE macro SHALL membagikan `groupMeta` (`{levels, aggregates}` dengan nilai **efektif**, atau `null` bila grouping tak aktif) dan `defaultGroups` (grup efektif tanpa param, lolos gate), serta SHALL menghapus prop `groupCounts`, `defaultGroup`, `defaultGroupGranularity`, `defaultGroupRange`.

### Requirement 5: Query daftar grup per level (node `groups`)

**User Story:** As user, I want melihat daftar nilai grup beserta jumlahnya tanpa memuat semua baris, so that halaman tetap cepat walau data besar.

#### Acceptance Criteria

1. WHEN grouping aktif dan `count(groupPath) < jumlah level`, THE `GroupNodeQuery::groups()` SHALL menjalankan satu query `SELECT {ekspresi level} AS group_key, COUNT(*), … FROM … WHERE {semua constraint macro} AND {predikat groupPath} GROUP BY group_key ORDER BY group_key ASC LIMIT show OFFSET …` — tanpa memuat baris model.
2. THE `GROUP BY` SHALL memakai **alias** `group_key`, bukan mengulang ekspresi (kompatibilitas MySQL `only_full_group_by`).
3. THE query SHALL memakai constraint yang identik dengan jalur flat (branch scope, saved filter, `searchScope`, submitable, scope kustom controller) karena dieksekusi di titik yang sama dengan `clone $query` lama.
4. THE predikat `groupPath` SHALL: kolom biasa/FK → `= ?`/`IS NULL`; boolean → bind `(int)`; date bucket → `{ekspresi} = ?`; **number bucket → `col >= lower AND col < lower+range`**; formStatuses → `CAST(col AS CHAR) IN (varian…)`. Semua nilai SHALL di-bind, kolom SHALL berasal dari config tervalidasi.
5. THE query SHALL mengembalikan `MIN(pk) AS sample_id` untuk level bertipe relation; THE backend SHALL memuat `label` (objek relasi ter-eager-load lewat `with()` existing, `withTrashed` bila relasi soft-delete) untuk tiap grup relasi non-NULL.
6. THE `key` SHALL dinormalkan: NULL → `'null'`; boolean → `'true'/'false'`; formStatuses → JSON ringkas dengan varian teks yang sama key-nya **dijumlahkan** (`raw` = daftar varian).
7. THE total grup SHALL dilewati bila `page == 1` dan jumlah hasil `< show` (total = jumlah hasil); selain itu SHALL dihitung dengan `COUNT(*)` atas subquery yang sama.
8. THE urutan grup SHALL `key ASC`; grup NULL SHALL tampil lebih dulu (konsisten SQLite & MySQL).

### Requirement 6: Baris daun per grup (node `rows`)

**User Story:** As user, I want membuka grup terdalam dan melihat baris-barisnya dengan sort pilihan saya, so that saya bisa menelusuri data grup itu.

#### Acceptance Criteria

1. WHEN `count(groupPath) == jumlah level`, THE `GroupNodeQuery::rows()` SHALL menerapkan seluruh predikat path, sort user sebagai **satu-satunya** `ORDER BY`, lalu `paginate($show)` untuk halaman `groupPage`, dan `DataTableColumnSelector::applyAppends`.
2. THE adaptive select/`with()` (cookie kolom visible, `extraKeys`) SHALL berlaku sama seperti jalur flat.
3. THE respons SHALL `{type:"rows", data, current_page, last_page, total, per_page}` dengan baris model berbentuk sama seperti `data.data` jalur flat.

### Requirement 7: Protokol request expand (JSON lewat route index yang sama)

**User Story:** As sistem, I want mengambil isi grup lewat route index yang sama, so that scope keamanan dan constraint per-controller tetap berlaku tanpa menyentuh 62 controller.

#### Acceptance Criteria

1. WHEN request membawa `groupPath`, THE macro `dataTable()` SHALL menyelesaikan node lalu `throw new HttpResponseException(response()->json(…))`; deteksi SHALL berdasarkan kehadiran `groupPath`, bukan `ajax()`/header Inertia.
2. THE respons `type:"groups"` SHALL `{type, data:[deskriptor…], current_page, last_page, total, per_page}`.
3. THE `groupPath` SHALL berupa JSON array elemen skalar/`null` (level formStatuses: list string) dengan panjang ≤ jumlah level; selain itu THE macro SHALL menjawab **422** `{message}` — bukan 500 dan bukan SQL error. Nilai `raw` non-numerik pada level number bucket SHALL 422.
4. THE `groupPage` invalid (bukan integer / < 1) SHALL dianggap 1.
5. WHEN request XHR TIDAK membawa `groupPath`, THE macro SHALL mengabaikan `group` dan memakai jalur flat (konsumen LinkModel, `ModelController`, dashboard tak terpengaruh).
6. THE controller index (62 call-site `Model::dataTable($request)`) SHALL TIDAK diubah.

### Requirement 8: Pagination independen dan `show` global

**User Story:** As user, I want tiap grup punya pager sendiri dan jumlah tampil global, so that grup besar tidak membanjiri layar dan halaman luar tetap ringkas.

#### Acceptance Criteria

1. THE `show` (query param > cookie `datatable_show` > preference) SHALL membatasi jumlah item **setiap** list: daftar grup level-0, daftar sub-grup, dan daftar baris.
2. THE level-0 SHALL dipaginasi `Pagination` outer existing (param `page`) dengan `data` berbentuk `LengthAwarePaginator` (`current_page/last_page/total`) berisi deskriptor grup.
3. THE tiap node SHALL punya pager independen untuk anak-anaknya (param `groupPage`); halaman satu node SHALL TIDAK mempengaruhi node lain.
4. WHEN `groupPage` di luar rentang, THE respons SHALL `data: []` dengan `total` benar.

### Requirement 9: Agregat baris grup lewat config kode

**User Story:** As pengembang, I want mengatur kolom angka mana yang dijumlah/dirata-rata di baris grup lewat `configColumns`, so that user langsung melihat total per grup tanpa membuka isinya.

#### Acceptance Criteria

1. THE `$configColumns` SHALL menerima `'groupAggregate' => 'sum'|'avg'|'min'|'max'` pada kolom `number`/`currency`; fitur ini SHALL hanya dapat diatur lewat kode (tanpa UI).
2. THE backend SHALL mengabaikan diam-diam: fungsi di luar whitelist, kolom bukan `number|currency`, dan kolom bukan **kolom SQL riil** model (append/`dependsOn`, relasi) — kriteria sama dengan gate `groupable`.
3. THE agregat SHALL dihitung di **setiap level** (grup nested juga) dalam query node yang sama (`SUM(t.col) AS agg_{i}`), dengan alias indeks (bukan nama kolom mentah); `avg` → float; semua-NULL → `null`.
4. THE `groupMeta.aggregates` SHALL memuat `[{column, fn}]` yang valid; deskriptor SHALL memuat `aggregates: {kolom: nilai}`.
5. THE header grup SHALL menampilkan agregat di sel kolom yang bersangkutan (Requirement 15) dan sebagai teks ringkas di kartu mobile (Requirement 16).

### Requirement 10: Zero overhead dan non-regresi

**User Story:** As pemilik 100+ halaman list, I want halaman tanpa grouping berperilaku identik, so that fitur baru tidak mengganggu yang sudah jalan.

#### Acceptance Criteria

1. WHEN tidak ada level grup valid, THE macro SHALL menjalankan jalur flat existing dengan jumlah dan isi query yang identik dengan sebelum spec ini.
2. THE `Table2` tanpa prop `group` SHALL merender identik dengan sebelumnya; `QuickListBlock`, `AdvanceSearchDialog`, `SelectModel` SHALL tidak berubah.
3. THE konsumen XHR macro (`ModelController`, LinkModel, dashboard) SHALL tidak pernah terkena grouping.

### Requirement 11: Panel Group by berupa checkbox berurutan (`GroupLevelsEditor`)

**User Story:** As user, I want memilih beberapa kolom group lewat checkbox dan mengatur urutan nesting-nya, so that saya mengelompokkan data seperti di Odoo.

#### Acceptance Criteria

1. THE `GroupLevelsEditor` SHALL menampilkan kolom `groupable` sebagai checkbox; kolom **aktif** SHALL berada di atas (urutan = urutan nesting), dipisah **divider** dari kolom non-aktif; divider SHALL hanya tampil bila ada aktif **dan** non-aktif.
2. WHEN user mengklik baris, THE editor SHALL menoggle: non-aktif → ditambahkan sebagai level terdalam; aktif → dihapus.
3. WHEN 4 level aktif, THE baris non-aktif SHALL `disabled` dengan keterangan batas maksimum.
4. THE baris aktif SHALL dapat diurut ulang dengan drag handle memakai `@dnd-kit/sortable` dengan Pointer **dan Keyboard** sensor.
5. THE kolom `date|time|datetime` aktif SHALL menampilkan `Select` granularity inline; `number|currency` aktif SHALL menampilkan `Select` range (`column.groupRangeOptions ?? default`) — per level.
6. THE editor SHALL controlled & presentasional (`{columns, options, value, onChange, max}`), tanpa kotak cari sendiri, dan SHALL dipakai di kolom Group by `SearchPanel`, popover chip `group` (`ChipEditor`), dan field Group by `FilterTemplate/Form`.
7. THE baris SHALL berupa satu target klik (tanpa `<label htmlFor>` + kontrol native); `ui/checkbox` di dalamnya presentasional sehingga satu klik = satu toggle.
8. THE sentinel `NO_GROUP_VALUE` SHALL dihapus; "tidak ada" = `Groups` kosong.

### Requirement 12: Chip group bertingkat dan saran di Search Bar

**User Story:** As user, I want melihat group aktif sebagai satu chip `Kategori > Status` yang bisa diedit/dihapus, so that saya tahu nesting yang berlaku dan bisa mengubahnya cepat.

#### Acceptance Criteria

1. THE Search Bar SHALL menampilkan **satu** chip `__group` dengan label level di-join `" > "`; level date `Kolom: Granularity`, level number `Kolom: range`; label panjang SHALL di-truncate dengan `title` penuh.
2. WHEN chip diklik, THE popover `GroupLevelsEditor` SHALL terbuka; WHEN `×` diklik, THE semua level SHALL dihapus (`onGroupChange([])`).
3. THE pola *draft* SHALL dipertahankan: perubahan hanya menyentuh `draftGroup`, dan baru diteruskan ke host lewat `onGroupChange(Groups)` saat apply.
4. THE `sameGroups` SHALL membandingkan urutan, kolom, granularity, dan range; dirty-check saved filter SHALL `sourceSaved.group != null && !sameGroups(sourceSaved.group, draftGroup)`.
5. THE saran seksi "group" SHALL menoggle kolom (tambah sebagai level terakhir / hapus bila sudah aktif), bukan menimpa.
6. THE `SaveFilterControl` (`FilterTable2`) SHALL menyertakan `group` (list atau `null`) pada payload simpan/timpa.

### Requirement 13: State dan URL `DataTable2`

**User Story:** As user, I want group tersinkron ke URL seperti sort/filter, so that tampilan bisa di-bookmark dan dimuat ulang.

#### Acceptance Criteria

1. THE `options.group` SHALL bertipe `Groups` (canonical); `options.groupGranularity`/`options.groupRange` SHALL dihapus (nilai dibawa tiap level).
2. THE serialisasi ke wire form (`group=a,b`, `groupGranularity[a]`, `groupRange[b]`) SHALL hanya terjadi di `loadData()`, melalui `qs` dengan `skipNulls`; `group=` kosong SHALL dikirim hanya bila `defaultGroups` tidak kosong dan user memilih "Tidak ada".
3. THE state awal SHALL `groupsFromQuery(query) ?? defaultGroups`; URL skalar lama SHALL dipetakan ke level pertama.
4. WHEN level berubah, THE `options.page` SHALL direset ke 1.
5. THE `onPickSaved` SHALL menimpa `options.group` dengan `saved.group` bila non-null; `getViewSnapshot()` SHALL `{sort, group: options.group.length ? options.group : null}`.

### Requirement 14: Render pohon lazy (`GroupTree`)

**User Story:** As user, I want grup tertutup secara default dan isi grup baru dimuat saat saya membukanya, so that halaman cepat dan saya hanya memuat yang saya butuhkan.

#### Acceptance Criteria

1. THE `GroupTree` SHALL merender item level-0 dari `data.data` dan SHALL menampilkan semua grup **tertutup** secara default.
2. WHEN header diklik, THE node SHALL terbuka dan `useGroupNode` SHALL memanggil route index dengan `groupPath` (+ `groupPage`); `type:"groups"` → daftar `GroupNode` depth+1; `type:"rows"` → `renderRow`.
3. THE parameter expand SHALL = `ziggy.query` (URL yang dirender server) tanpa `page`, ditambah `group`/`groupGranularity`/`groupRange` **eksplisit** dari `groupMeta.levels`, `groupPath` (JSON), dan `groupPage`.
4. THE query SHALL memakai `staleTime: 0`, `gcTime` pendek, `placeholderData: keepPreviousData`, dan `enabled` hanya saat node terbuka.
5. THE state terbuka SHALL dipegang `GroupTree` (kunci = path) dan **direset** saat `ziggy.query` berubah (bukan saat `options` pending berubah); saat `data` level-0 berganti tanpa perubahan query (mis. setelah hapus) `version` SHALL naik dan node terbuka SHALL di-refetch.
6. THE tombol Reload SHALL meng-invalidate semua query node.
7. THE pager node SHALL tampil di sisi kanan header hanya bila `total > per_page` (`1–100 / 189 ‹ ›`), SHALL mengatur halaman anak node itu, dan klik-nya SHALL TIDAK men-toggle header.
8. THE loading SHALL berupa baris skeleton berdenyut; THE error SHALL berupa baris pesan + "Coba lagi" yang hanya berlaku untuk node itu.
9. THE `Table2` SHALL menerima satu prop `group` menggantikan `groupBy/groupCounts/groupGranularity/groupRange`; run-length, `groupKeyOf`, `dateGroupBucketKey`, `numberGroupBucketKey`, `collapsedGroups` SHALL dihapus.

### Requirement 15: Header grup desktop dengan agregat sejajar kolom

**User Story:** As user desktop, I want header grup menampilkan nilai agregat tepat di bawah kolom yang bersangkutan, so that saya membaca total per grup seperti di Odoo.

#### Acceptance Criteria

1. THE header grup SHALL berupa grid item (`td`): label (indent `depth × 16px`, chevron, `GroupLabel`, `(count)`, pager) dengan `gridColumn: span = (selectable?1:0)+(actions?1:0)+indeks kolom agregat tampil pertama`, diikuti satu `td` per kolom tersisa.
2. THE sel kolom agregat SHALL menampilkan nilai terformat memakai opsi kolom (`numberFormat`, `decimalScale`, `currencyCode`); sel kolom lain SHALL kosong.
3. WHEN tidak ada kolom agregat yang tampil, THE header SHALL berupa satu `td` span penuh.
4. THE kolom agregat yang disembunyikan user SHALL tidak dirender; THE tooltip SHALL menyebut fungsi (`sum/avg/min/max`).
5. THE `GroupLabel` SHALL mendekode label dari `descriptor.raw`/`label`/`key` dengan granularity/range dari `groupMeta.levels[depth]`.
6. THE `gridTemplateRows` saat grouped SHALL tidak bergantung pada `data.length`.

### Requirement 16: Mobile ikut grouping

**User Story:** As user mobile, I want grouping yang sama di layar kecil, so that saya tidak kehilangan fitur di ponsel.

#### Acceptance Criteria

1. THE cabang mobile `DataTable2` SHALL merender `GroupTree` bila `groupMeta` ada, memakai `renderRow` = `templateItem({dataRow, deleteItem})` dan `renderGroupHeader` = kartu ringkas.
2. THE kartu header SHALL menampilkan chevron, label, count, agregat sebagai teks kecil `Nama: nilai`, pager, dan indent per depth.
3. WHEN `groupMeta` `null`, THE mobile SHALL merender daftar kartu flat seperti sebelumnya.
4. THE panel Group by pada mobile (Dialog `SearchPanel`) SHALL memakai `GroupLevelsEditor` yang sama.

### Requirement 17: Refactor karakterisasi sebelum perubahan perilaku

**User Story:** As pengembang, I want kode grup diekstrak dulu tanpa mengubah perilaku, so that kegagalan test setelahnya bisa dilacak ke perubahan perilaku, bukan pemindahan kode.

#### Acceptance Criteria

1. THE logika grup di `DataTableScope` (`sanitizeGroupableColumns`, `resolveRelationGroupColumn`, `gateGroupColumn`, `dateGroupExpression`, `numberGroupBucketExpression`, `resolveGroupBucketExpression`, normalisasi key) SHALL dipindah ke `app/Services/Core/DataTable/Group/` **sebelum** perilaku multi-level ditambahkan; `DataTableScopeGroupingTest` dan `AllModelsGroupableConfigTest` SHALL tetap hijau tanpa perubahan asersi pada langkah pemindahan.
2. THE `<tr>` baris data `Table2` SHALL diekstrak ke komponen `TableRow` **sebelum** `GroupTree` dibuat; `Table2.rtl.test.jsx` SHALL tetap hijau tanpa perubahan asersi pada langkah ekstraksi.
3. THE `DataTableScope` SHALL tinggal orkestrasi; struktur folder SHALL mengikuti aturan `{Domain}/{Feature}` (`Services/Core/DataTable/Group/`, `Components/Table/Group/`).

### Requirement 18: Kompatibilitas dan migrasi data

**User Story:** As operator, I want data dan tautan lama tetap valid setelah deploy, so that tidak ada filter tersimpan atau bookmark yang rusak.

#### Acceptance Criteria

1. THE `saved_filters.group` lama berbentuk objek SHALL dibaca sebagai 1 level (accessor) dan dikonversi permanen oleh migration.
2. THE URL lama `group=<kolom>&groupGranularity=<x>` / `groupRange=<n>` (skalar) SHALL dianggap milik level pertama.
3. THE klien basi yang mengirim `group` berbentuk objek ke endpoint saved filter/template SHALL diterima (dinormalkan), bukan 422.
4. THE tidak ada model produksi yang mengisi `$defaultGroupColumn`; penghapusannya SHALL tidak memerlukan migrasi model.

### Requirement 19: i18n

**User Story:** As user (id/en), I want semua teks baru terlokalisasi, so that antarmuka konsisten.

#### Acceptance Criteria

1. THE key baru (batas level, handle urut, pager, memuat/error/coba lagi, `aggregate.*`, Filter Template group) SHALL ada di `lang/id` **dan** `lang/en`; `LocaleKeysTest` SHALL lulus.
2. THE key existing (`group_by`, `no_group_value`, `granularity.*`, `group_range`) SHALL dipakai ulang; key yang tak terpakai lagi SHALL dihapus dari kedua bahasa.

### Requirement 20: Cakupan pengujian dan verifikasi

**User Story:** As pengembang, I want fitur tercakup test otomatis dan verifikasi manual pada blind spot CI, so that regresi dan kegagalan khas MySQL tertangkap.

#### Acceptance Criteria

1. THE test BE SHALL mencakup Property 1–5, 7–9 (design §Correctness Properties): per tipe kolom (string, relasi, boolean, formStatus/formStatuses, date × 5 granularity, number × range termasuk pecahan/negatif, NULL), nested 2–4 level, total skip/hitung, node daun, paritas constraint (filter, saved filter, default shared filter, branch scope, submitable, scope kustom), `groupPath` invalid, XHR tanpa `groupPath`, zero-overhead, agregat.
2. THE test FE SHALL mencakup Property 6 (`groupLevels.test.js`) dan RTL untuk `GroupLevelsEditor`, `GroupTree`, `Table2` (flat & `group`), Search Bar/Panel/ChipEditor/suggestions, `FilterTemplate/Form`, integrasi `DataTable2` desktop & mobile; tanpa `vi.useFakeTimers`.
3. THE `AllModelsGroupableConfigTest` SHALL dirombak ke kontrak baru dan menambah guard `groupAggregate` valid.
4. THE checklist verifikasi manual MySQL (`only_full_group_by`, `CAST(col AS CHAR)` formStatuses, urutan NULL, `MIN(pk)` ULID, total subquery) dan browser (`npm run build`) SHALL dijalankan sebelum penutupan.
5. THE full suite BE dan FE SHALL dijalankan paralel per-batch; lint/Pint SHALL dijalankan **sekali** di akhir.

### Requirement 21: Revisi pasca-verifikasi (2026-09-27) -- pager, info jumlah, loading, infinite scroll, urutan grup

**User Story:** Sebagai pengguna DataTable2 dengan data besar, saya ingin kontrol halaman grup yang jelas, info jumlah data, indikator memuat yang informatif, infinite scroll di mobile, dan kendali urutan baris grup.

1. THE tombol pager di header grup SHALL kontras (warna primer, ikon terang) dengan `border` dan sudut membulat; keadaan disabled tetap terlihat tetapi redup.
2. THE footer `DataTable2` SHALL menampilkan info jumlah `start–end / total` (i18n `core.datatable.page_range`, dari `from`/`to`/`total` paginator) di sebelah kontrol halaman, bentuk sama dgn pager grup; tak tampil bila paginator kosong / tak memuat field itu. Saat grouping aktif angkanya menghitung grup level-0.
3. THE indikator memuat node grup SHALL berupa ikon berputar + teks "Memuat" (`core.datatable.group_loading`), TANPA skeleton; `role="status"`/`aria-busy` dipertahankan.
4. WHEN mode mobile DAN grouping aktif, THE isi tiap node grup SHALL dimuat lewat INFINITE SCROLL (halaman node ditambahkan di bawah saat sentinel terlihat; `groupPage` 1, 2, ...; header menampilkan "dimuat / total"; kegagalan halaman berikutnya menampilkan "Coba lagi" tanpa membuang baris yang sudah ada). Daftar grup level-0 tetap dipaginasi lewat `Pagination` footer.
5. THE ikon chip group SHALL berupa tombol yang membalik arah urutan baris grup menurut NILAI grup (`groupSort=asc|desc`, default asc, hanya `desc` dikirim ke URL) tanpa mengubah sort tabel/`sort` URL dan tanpa membuka editor level. Param diteruskan ke request expand.
6. WHEN sort tabel (`sort`) menunjuk kolom `groupAggregate`, THE baris grup di SEMUA level SHALL diurutkan menurut agregat itu (sum/min/max; avg = SUM/COUNT) sesuai arah sort; nilai grup (`groupSort`) menjadi pemutus seri sehingga paginasi stabil. Sort ke kolom non-agregat TIDAK memengaruhi urutan grup (tetap nilai grup asc, NULL paling awal).

### Requirement 22: TanStack Query caching, prefetching, sticky row group (2026-09-27)

**User Story:** Sebagai pengguna dgn data besar, saya ingin isi node grup (yg SUDAH pakai TanStack Query) tercache lebih optimal, prefetch otomatis, dan header grup tetap terlihat saat scroll.

1. THE isi node grup (leaf rows/sub-grup) SHALL tetap pakai TanStack Query (SUDAH begitu sejak task 5-8) dgn `gcTime` diperpanjang 30dtk->5 menit; `staleTime:0` dipertahankan (data transaksi, revalidate diam2 di background). Scope TANPA grouping (Inertia `router.get`) sengaja TIDAK dimigrasi -- keputusan eksplisit user (AskUserQuestion), risiko arsitektur 100+ halaman.
2. THE hover/fokus header node TERTUTUP (mode paged, desktop/tablet) SHALL memprefetch halaman 1 node itu (`queryClient.prefetchQuery`, kunci IDENTIK `useGroupNode`) sehingga klik berikutnya instan tanpa loading. Mode infinite (mobile) TIDAK memakai hover-prefetch -- `rootMargin` sentinel yg sudah ada berfungsi sbg prefetch-nya sendiri.
3. THE node terbuka (mode paged) yg PUNYA halaman berikutnya SHALL otomatis meng-prefetch halaman itu begitu halaman aktif settle (BUKAN saat masih `isPlaceholderData`/`keepPreviousData` -- keliru memakai data placeholder utk hitung "ada halaman berikutnya?" memicu prefetch ke halaman yg salah, bug nyata ketahuan lewat tes).
4. THE header grup desktop (`GroupHeaderRow`) SHALL sticky (`position: sticky`) menempel di bawah baris header kolom saat scroll. SEMUA depth memakai `top` yang SAMA (BUKAN breadcrumb bertumpuk per-depth) -- pendekatan bertumpuk DICOBA & GAGAL (dibuktikan verifikasi browser): table.css `display: contents` pada thead/tbody/tr membuat SEMUA `td` grid item FLAT tanpa wadah per-grup, sehingga header level lain (bukan leluhur node yg di-scroll) ikut menempel di posisi yg salah. Header mobile (`GroupHeaderCard`) SENGAJA TIDAK dibuat sticky (tinggi kartu tak seragam -- ada/tiadanya baris agregat & pager -- offset per-depth tak bisa diandalkan tanpa mengukur DOM).

### Requirement 23: Wrap sel header & body, bukan running-text/truncate (2026-09-27)

**User Story:** Sebagai pengguna, saya ingin isi kolom panjang (header maupun body) terbaca penuh via wrap multi-baris, bukan potong sebaris (marquee hover / ellipsis).

1. THE header kolom (`th`) SHALL wrap multi-baris (bukan lagi marquee "running-text" hover) -- `Header.jsx` tak lagi pakai `RunningText`/`RunningTextContent`, label langsung `<span>` polos; `table.css` default `th span, td span` diubah dari `whitespace-nowrap overflow-hidden` jadi `whitespace-normal break-words overflow-hidden`.
2. THE sel body (`td`) SHALL wrap multi-baris SECARA DEFAULT, KECUALI tipe yg janggal kalau wrap: `number`, `currency`, `date`, `time`, `datetime` -- tipe2 ini tetap `whitespace-nowrap!` + `text-ellipsis!` (opt-out per-sel via `NOWRAP_CELL_TYPES`/`cellWrapClassName()` di `Table2.jsx`, `!important` krn selector gabungan table.css (0,1,3) lebih spesifik drpd utility polos (0,1,0)). Aggregat row grup (`GroupHeaderRow.jsx`, selalu angka) ikut nowrap eksplisit.
3. THE tinggi baris header kolom TIDAK LAGI konstan (bisa 1-4 baris tergantung panjang label & lebar kolom) -- header grup sticky (Requirement 21.9/22.4) yg SEBELUMNYA pakai `top` hardcode 25px jadi SALAH begitu header wrap >1 baris (ketahuan user via screenshot: label baris ke-3 header kolom ketutup row grup sticky). Diperbaiki: `Table2.jsx` mengukur tinggi TERBESAR di antara semua `th` via `ResizeObserver` (bukan cuma 1 sel -- grid `align-items:stretch` yg diasumsikan mewakili ternyata tak selalu reliable diobservasi dari 1 elemen), expose sbg CSS var `--group-sticky-top` di elemen `<table>` (mewarisi ke `<td>` header grup manapun kedalamannya). Effect re-attach observer hanya saat SET kolom berubah (`[selectable, actions, showedColumns]`), BUKAN tiap render -- versi awal no-deps (re-observe tiap render) TERBUKTI cacat: observer lama ke-disconnect sebelum sempat deliver notifikasi awal saat render beruntun (var macet di nilai basi).

### Requirement 24: Skip reload Inertia utk perubahan grup/sort tertentu (2026-09-27/28)

**User Story:** Sebagai pengguna, saya ingin ganti sub-level grup atau sort kolom yg tak memengaruhi grup level-0 TANPA nunggu reload halaman penuh -- cukup diperbarui lewat fetch TanStack yg sudah ada.

1. THE ubah SUB-level grup (index 1 ke bawah; level 0/kolom terluar identik -- kolom, granularity, DAN range) SHALL dilewati reload Inertia -- `levels`/`baseParams` diperbarui lokal (`localOverride.group` = `options.group` apa adanya, TANPA perlu resolusi server: granularity/range SUDAH eksplisit dari GroupLevelsEditor saat level ditambah/diedit). Node terbuka di kedalaman >=1 DIPAKSA TERTUTUP (identitasnya tak valid lagi thd kolom sub-level baru -- lihat GroupTree.jsx `subLevelVersion`), node depth 0 TETAP terbuka & anaknya otomatis refetch (kunci cache TanStack berubah krn `baseParams.group` berubah). Ganti LEVEL 0 (kolom terluar berbeda, ATAU grup diaktifkan/dihapus total) TETAP reload penuh.
2. THE ubah `sort` ke kolom yg BUKAN kolom grup manapun & BUKAN kolom `groupAggregate` (dgn grup aktif) SHALL dilewati reload Inertia -- urutan baris GRUP (level manapun) tak terpengaruh (backend `GroupNodeQuery::applyGroupOrder` cuma reaksi ke `group_key`/aggregate, Requirement 16), leaf/sub-grup di node yg SUDAH terbuka otomatis refetch dgn sort baru (kunci cache berubah lewat `baseParams.sort`) TANPA node manapun tertutup. Sort ke kolom grup ATAU groupAggregate, ATAU tanpa grup aktif sama sekali (flat mode), TETAP reload penuh spt sebelumnya.
3. THE kedua rule di atas HANYA berlaku bila pohon grup BENAR2 aktif di server (`groupMeta` ada di props) DAN tepat SATU field `options` berubah per aksi (selain `page`, yg direset ke 1 oleh semua setter tapi diabaikan di sini krn level-0 tak tersentuh). Lebih dari satu field berubah sekaligus (mis. ganti saved filter yg bawa sort+group+fid), ATAU tanpa `groupMeta` (edge-case: URL `group=` aktif tapi server tak mengembalikan tree, sangat jarang) -- TETAP reload penuh, keputusan diambil `classifyOptionsChange()` (fungsi murni, `DataTable2.jsx`, diekspor & di-unit-test terpisah).
4. THE URL bar SHALL tetap sinkron dgn kedua rule di atas lewat `window.history.replaceState` (bukan `router.get`) -- share-link/refresh/tombol back tetap mencerminkan tampilan, walau tanpa round-trip server. Dikonfirmasi eksplisit user (AskUserQuestion) sesi ini.
5. **Dibatalkan eksplisit oleh user** (bukan gap, keputusan sadar): rule "reorder LOKAL murni tanpa fetch APAPUN (bukan cuma skip Inertia)" saat sort target level-0/groupAggregate TAPI seluruh grup level-0 sudah termuat 1 halaman. Sort ke level-0/aggregate SELALU reload penuh, tanpa pengecualian.

## Keputusan (dikonfirmasi user, sesi brainstorming)

1. **Transport** — route index yang sama + `HttpResponseException` JSON di macro. Ditolak: Inertia partial reload; endpoint generik terpisah (kebocoran scope controller).
2. **Semantik "tanpa groupBy"** — tidak memuat baris; SQL `GROUP BY` tetap dipakai untuk key+count+agregat.
3. **Mobile ikut grouping** — `GroupTree` render-prop. Ditolak: mobile tetap flat.
4. **Batas** — maks 4 level, kolom unik per level.
5. **Kontrak lintas lapisan** — semua titik "1 grup" (default model, saved filter, Filter Templates, Search Bar, URL, state FE) diubah ke `Groups`; `$defaultGroupColumn` diganti `$defaultGroups`; `saved_filters.group` menjadi list dengan migration data + accessor + normalisasi request.
6. **Panel** — checkbox; aktif di atas + divider; bisa diurut; chip `A > B`; saran = toggle.
7. **Default tertutup**; pager per node di header node itu; pager level-0 = `Pagination` existing.
8. **Agregat** — hanya lewat `configColumns` (`groupAggregate`), di setiap level; pengisian ke model = opsional.
9. **Urutan grup** `key ASC`; sort grup by agregat dan urut-by-label relasi di luar scope.
