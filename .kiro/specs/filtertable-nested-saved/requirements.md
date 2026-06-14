# Requirements Document

## Introduction

`FilterTable2` (di dalam `DataTable2`) adalah UI filter nested ala Odoo: tiap baris `FilterItem` berisi (kolom · operator · value), bisa dibungkus group dengan operator **AND/OR**, dan group bisa bersarang. State frontend sudah ada (`useNestedFilters`), tetapi fitur belum berfungsi end-to-end.

Masalah saat ini:

- **Frontend** — `flattenFilters` membuang struktur nested + AND/OR (backend hanya menerima array datar `[col,op,val][]`); field value selalu `<Input>` teks polos (tidak menyesuaikan type/operator); operator per-type belum lengkap (mis. `time`) dan belum ada UI khusus `between` (2 input), `in/!in` (multi-value auto-grow), `set/!set` (tanpa value); belum reusable untuk `SelectModel`.
- **Backend** — `DataTableScope` hardcode "filter pertama AND, sisanya OR" (tak ada konsep grouping); bug flag negasi `whereIn`/`whereBetween` (`$operator == '!like'`); tak ada penanganan relasi; transport via URL GET kena batas panjang URL untuk filter nested yang panjang.

Tujuan: membuat filter nested (AND/OR, grouping, rekursif) berfungsi end-to-end, dengan value-input context-aware, transport via **saved filter** (URL `?fid=`), dan evaluator query backend yang aman, testable, serta reusable.

## Glossary

- **Filter tree** — struktur `{ k: "and"|"or", c: { <id>: node } }`; `node` bisa berupa group atau item.
- **Filter item** — leaf `{ k: <column>, o: <operator>, v: <value> }`.
- **Saved filter** — row DB yang menyimpan filter tree; berstatus *ephemeral* (ad-hoc) atau *named* (disimpan user).
- **Ephemeral filter** — saved filter `is_saved=false` hasil aksi apply ad-hoc; dibersihkan setelah TTL.
- **Named filter** — saved filter `is_saved=true` + `name`, permanen, di-own user pembuat.
- **Operator set** — daftar operator valid untuk sebuah column type.
- **Value field** — komponen input untuk `v`, dipilih berdasarkan pasangan (type, operator).
- **FilterBuilder** — komponen presentational (tanpa Dialog / saved-filter) yang merender filter tree; reusable.
- **FilterEvaluator** — class backend yang menerjemahkan filter tree menjadi Eloquent query secara rekursif.
- **column type** — nilai `type` dari `LinkModel::getColumns()`: string, number, currency, boolean, date, datetime, time, relation, relations, formStatus, formStatuses, enum, json, binary, mixed, attribute.

## Requirements

### Requirement 1: Nested filter dikirim utuh ke backend

**User Story:** Sebagai user, saya ingin filter bersarang dengan AND/OR dieksekusi persis seperti yang saya susun, agar hasil tabel akurat.

#### Acceptance Criteria

1. THE frontend SHALL mengirim filter tree utuh (bukan array datar) ke backend.
2. THE backend SHALL mengevaluasi tree secara rekursif: group `and` → `$query->where(fn)`, group `or` → `$query->orWhere(fn)`, mempertahankan kedalaman nesting.
3. WHEN tree kosong atau tidak valid, THE backend SHALL mengembalikan query tanpa filter tanpa menimbulkan error.

### Requirement 2: Transport via saved filter (hybrid)

**User Story:** Sebagai user, saya ingin filter kompleks tetap bisa di-share lewat URL dan disimpan untuk dipakai ulang, tanpa terkena batas panjang URL.

#### Acceptance Criteria

1. WHEN user menerapkan filter, THE system SHALL menyimpan tree sebagai row `saved_filter` ephemeral (`is_saved=false`) dan menavigasi ke `?fid=<id>`.
2. WHEN request berisi `fid`, THE `DataTableScope` SHALL memuat tree dari `saved_filter` ber-id tersebut dan menerapkannya tanpa cek owner (siapa pun pemegang link boleh apply).
3. WHEN user menekan "Simpan filter" dan memberi nama, THE system SHALL men-set `is_saved=true` dan `name`, menjadikannya permanen dan ter-own user pembuat.
4. THE daftar saved filter (listing) SHALL hanya menampilkan filter `is_saved=true` milik user yang sedang login (`user_id`), ter-scope ke `model`.
5. WHEN `saved_filter.model` tidak sama dengan model halaman yang dibuka, THE backend SHALL mengabaikan `fid` tersebut (integritas, bukan ownership).
6. THE system SHALL menyediakan cleanup row ephemeral yang lebih tua dari TTL (mis. 7 hari) melalui scheduled command.
7. WHEN `fid` tidak ada atau tidak valid, THE backend SHALL mengabaikannya (tabel tampil tanpa filter) tanpa error.

### Requirement 3: Operator menyesuaikan type kolom

**User Story:** Sebagai user, saya ingin pilihan operator hanya yang relevan dengan type kolom yang dipilih.

#### Acceptance Criteria

1. THE operator dropdown SHALL menampilkan hanya operator yang valid untuk `column.type`.
2. THE operator set SHALL mencakup semua type: string, number, currency, boolean, date, datetime, time, relation, relations, formStatus, formStatuses, enum.
3. THE operator `=`/`!=` SHALL tersedia di semua type kecuali type plural (`relations`, `formStatuses`) — type plural memakai `has`/`!has` sebagai gantinya.
4. THE operator komparatif `>`/`>=`/`<`/`<=` dan `between`/`!between` SHALL tersedia (di operator dropdown FilterItem) untuk type terurut numerik & waktu: `number`, `currency`, `time` — TIDAK untuk `date`/`datetime`.
5. THE type `time` SHALL memiliki operator set setara type terurut lainnya (`=`, `!=`, `>`, `>=`, `<`, `<=`, `in`, `!in`, `between`, `!between`, `set`, `!set`) — saat ini `time` belum ada di `operators.js` dan harus ditambahkan.
6. THE type `string` SHALL memiliki operator tambahan `starts_with` (`LIKE 'v%'`) dan `ends_with` (`LIKE '%v'`) selain `matches`/`!matches`.
7. THE type `date`/`datetime` SHALL memiliki operator dropdown FilterItem **hanya** `in_period`, `!in_period`, `set`, `!set`. Semua komparasi (`=`, `!=`, `>`, `>=`, `<`, `<=`, `between`, `!between`) dan granularitas periode (`day`, `month`, `quarter`, `half-year`, `year`) DIPINDAHKAN ke dalam komponen DateSelector sebagai sub-operator internal value field — bukan di operator dropdown FilterItem.
8. THE operator `set`/`!set` SHALL tersedia di semua type. Untuk type `string`, `set`/`!set` SHALL mendeteksi NULL **dan** string kosong (`set` = tidak NULL DAN bukan `''`; `!set` = NULL ATAU `''`) — sekaligus mewakili "is empty / is not empty", tanpa operator empty-string terpisah. Untuk type non-string, `set`/`!set` cukup mengecek NULL (`whereNotNull`/`whereNull`).
9. THE operator `in`/`!in` SHALL tersedia di semua type kecuali boolean dan kecuali `date`/`datetime` (date/datetime memakai `in_period`).
10. WHEN sebuah item mengirim operator yang tidak valid untuk type kolomnya, THE backend SHALL menolak/melewati item tersebut (whitelist).

### Requirement 4: Value field menyesuaikan type + operator

**User Story:** Sebagai user, saya ingin input value sesuai jenis data agar pengisian benar dan cepat.

#### Acceptance Criteria

1. WHEN operator `set`/`!set` (semua type), THE value field SHALL tidak menampilkan input value.
2. WHEN type `boolean`, THE value field SHALL berupa Checkbox.
3. WHEN type `string` TANPA `column.options`, THE value field SHALL berupa text Input untuk operator `=`/`!=`/`matches`/`!matches`/`starts_with`/`ends_with`, dan multi-grow text untuk `in`/`!in`.
3a. WHEN type `string` DENGAN `column.options` (berisi minimal satu nilai), THE value field SHALL berupa **Select** untuk operator `=`/`!=` dan **MultiSelect** untuk operator `in`/`!in`, dengan options dari `column.options`. Operator `matches`/`!matches`/`starts_with`/`ends_with` SHALL tetap memakai text Input (pencarian bebas, bukan pilihan terbatas).
4. WHEN type `number`/`currency`, THE value field SHALL berupa CurrencyInput; jika operator `between`/`!between` → dua CurrencyInput.
5. WHEN type `date`/`datetime` dan operator `in_period`/`!in_period`, THE value field SHALL berupa **DateSelector** (basis komponen date-selector reui.io, ditampilkan selaras dengan DatetimePicker) yang memegang sub-operator internal (`=`, `!=`, `>`, `>=`, `<`, `<=`, `between`, `!between`) dan granularitas (`day`, `month`, `quarter`, `half-year`, `year`), single maupun range. Value SHALL self-describing: `{ op: <sub-operator>, unit: <granularity>, from: <periode>, to?: <periode> }` (`to` ada untuk `between`/`!between`). Komponen memetakan shape internalnya ke shape value ini via adapter.
6. WHEN type `datetime` dan sub-operator DateSelector adalah komparasi exact (`=`, `!=`, `>`, `>=`, `<`, `<=`) pada granularitas `day`, THE DateSelector SHALL memunculkan field input time (memakai potongan DatetimePicker), dan value SHALL menyertakan komponen waktu (mis. `from`/`to` bertype datetime atau properti `time` terpisah). Untuk type `date` (tanpa waktu) dan untuk granularitas non-`day`, field time TIDAK dimunculkan.
7. WHEN type `time`, THE value field SHALL berupa input time (memakai potongan DatetimePicker); jika operator `between`/`!between` → dua input time.
8. WHEN type `relation`/`relations` non-morph (`typeRelation = "basic"`), THE value field SHALL berupa LinkModel dengan model dari `column.related`; single untuk `=`, multi untuk `in`.
9. WHEN type `relation`/`relations` morph (`typeRelation = "morph"`), THE value field SHALL terdiri dari dua langkah: (a) **PermissionLinkModel** untuk memilih morph type (model target), lalu (b) **LinkModel** dengan prop `model` diambil dari pilihan langkah (a) untuk memilih record. Value item morph SHALL berbentuk pasangan `{ type: <model>, id: <pk> }` (atau array pasangan untuk operator multi).
10. WHEN type `formStatus`/`formStatuses`/`enum` (atau `string` dengan `options`), THE value field SHALL berupa Select (operator single) atau MultiSelect (operator `in`/`!in`), dengan options dari `column.options`.
10a. THE label tiap option pada Select/MultiSelect SHALL memakai `column.valueTrans` sebagai prefix lang key — yaitu `t(valueTrans + "." + value)` — bila `valueTrans` tersedia; bila tidak, label SHALL memakai nilai mentah. Mekanisme ini konsisten dengan rendering sel tabel (`Table2`) yang juga memakai `valueTrans`.
11. WHEN operator `in`/`!in` (type non-boolean), THE value field SHALL mendukung multi-value: otomatis menambah field baru saat field terakhir diisi, dengan tombol delete per field.
12. WHEN type `binary`/`json`/`mixed`/`attribute`, THE column SHALL tidak dapat difilter (disembunyikan dari column picker) tanpa menyebabkan error.

### Requirement 5: Reusable FilterBuilder

**User Story:** Sebagai developer, saya ingin builder filter dapat dipakai ulang (mis. di SelectModel) tanpa Dialog maupun logic saved-filter.

#### Acceptance Criteria

1. THE `<FilterBuilder columns value onChange/>` SHALL berupa komponen presentational tanpa Dialog dan tanpa logic saved-filter.
2. THE `useNestedFilters` SHALL tetap headless (hanya state dan aksi).
3. THE `FilterTable2` SHALL tersusun dari `FilterBuilder` + Dialog + wiring saved-filter, tanpa menduplikasi logic builder.
4. THE kontrak `<FilterBuilder>` SHALL cukup agar `SelectModel` dapat memakainya nanti (implementasi SelectModel di luar scope).

### Requirement 6: Keamanan dan relasi backend

**User Story:** Sebagai pemilik sistem, saya ingin filter dieksekusi dengan aman dan kolom relasi difilter dengan benar.

#### Acceptance Criteria

1. THE `FilterEvaluator` SHALL memvalidasi tiap item: kolom ada di `getColumns()` dan `searchable`, serta operator cocok dengan type kolom; item invalid SHALL dilewati/ditolak.
2. THE value SHALL selalu di-bind (parameterized) dan tidak pernah diinterpolasi langsung ke SQL.
3. WHEN kolom bertype `relation` (BelongsTo/HasOne/MorphTo) non-morph, THE evaluator SHALL memfilter via relasi (join atau `whereHas` pada model `related`).
4. WHEN kolom bertype `relations` (HasMany/MorphMany) non-morph, THE evaluator SHALL memakai `whereHas`/`whereDoesntHave` untuk operator `has`/`!has`.
5. WHEN kolom morph (`typeRelation = "morph"`) dengan value `{ type, id }`, THE evaluator SHALL mencocokkan pasangan kolom `*_type` dan `*_id` (mis. via `whereHasMorph` atau where eksplisit pada kolom morph `_type` + `_id`), tidak memfilter `_id` saja.
6. WHEN operator `in_period`/`!in_period` dengan value `{ op, unit, from, to?, time? }`, THE evaluator SHALL membaca **sub-operator `op` dari value** (bukan dari operator item) dan menerjemahkan ke kondisi tanggal:
   - granularity `month`/`quarter`/`half-year`/`year` di-resolve ke rentang (`month`→awal-akhir bulan, `quarter`→3 bulan, `half-year`→6 bulan (H1 Jan–Jun, H2 Jul–Des), `year`→awal-akhir tahun), lalu sub-op diterapkan pada batas rentang (`=`/`between`→dalam rentang, `>`→setelah akhir rentang, `<`→sebelum awal rentang, dst).
   - granularity `day` untuk type `datetime` menyertakan komponen waktu bila `time` ada.
   - `!in_period` SHALL menegasi seluruh kondisi (`whereNot(fn)`).
7. THE bug negasi `whereIn`/`whereBetween` (`== '!like'`) SHALL diperbaiki ke pengecekan operator yang benar.

### Requirement 7: FilterEvaluator reusable (mirror backend dari FilterBuilder)

**User Story:** Sebagai developer, saya ingin memakai `FilterEvaluator` sebagai SQL builder di fitur lain yang juga memakai `FilterBuilder`, cukup dengan memberi metadata kolom dan filter tree — tanpa terikat ke DataTableScope.

#### Acceptance Criteria

1. THE `FilterEvaluator` SHALL berupa class mandiri dengan kontrak `new FilterEvaluator(array $columns)` dan `apply(\Illuminate\Database\Eloquent\Builder $query, array $tree): \Illuminate\Database\Eloquent\Builder`.
2. THE `FilterEvaluator` SHALL TIDAK bergantung pada `Request`, cookie, session, atau Inertia — semua input diberikan via konstruktor dan argumen `apply` (dependency injection murni).
3. THE `$columns` SHALL diberikan oleh pemanggil (mis. dari `Model::getColumns()`) sehingga evaluator bekerja untuk model apa pun.
4. THE `DataTableScope`, saved-filter loading, dan fitur lain (mis. SelectModel di masa depan) SHALL memakai `FilterEvaluator` yang sama tanpa menduplikasi logika query.
5. THE grammar tree dan value shape yang dikonsumsi `FilterEvaluator` SHALL identik dengan yang dihasilkan `FilterBuilder` (operator + bentuk value), sehingga keduanya menjadi pasangan produce/consume yang kompatibel.
6. THE `apply` SHALL mengembalikan Builder yang sama (chainable) tanpa mengeksekusi query, agar pemanggil bebas menambah scope/pagination setelahnya.

### Requirement 8: Konsistensi operator frontend ↔ backend

**User Story:** Sebagai developer, saya ingin daftar operator dan pemetaan ke SQL konsisten antara frontend dan backend agar tidak ada operator yang dikirim tapi tak tertangani.

#### Acceptance Criteria

1. THE operator yang dikirim frontend (`operators.js`) SHALL memiliki padanan penanganan di `FilterEvaluator`.
2. THE penamaan operator negasi SHALL konsisten memakai prefix `!` pada operator positifnya: `!=`, `!matches`, `!in`, `!between`, `!in_period`, `!has`, `!set` (bukan `not_*`). `starts_with`/`ends_with` bukan negasi sehingga tetap.
3. THE pemetaan operator → SQL SHALL mencakup minimal: `=`, `!=`, `>`, `<`, `>=`, `<=`, `matches`, `!matches`, `starts_with`, `ends_with`, `in`, `!in`, `between`, `!between`, `in_period`, `!in_period`, `has`, `!has`, `set`, `!set`. (Untuk `in_period`/`!in_period`, sub-operator komparasi dibawa di dalam value, bukan sebagai operator item.)
4. THE backend SHALL mendeteksi negasi via prefix `!` (strip `!` → handler positif, bungkus negasi) sehingga satu code path menangani positif & negatif.
5. WHEN operator dikirim tanpa padanan di backend, THE evaluator SHALL melewati item tersebut tanpa error.

### Requirement 9: Internasionalisasi (i18n)

**User Story:** Sebagai user berbahasa Indonesia/Inggris, saya ingin seluruh teks pada fitur filter tampil sesuai bahasa aktif, tanpa label hardcode.

#### Acceptance Criteria

1. THE seluruh teks UI yang baru/berubah (label operator, label periode/granularity, sub-operator DateSelector, placeholder, tombol Simpan/daftar saved filter, pesan validasi) SHALL memakai i18n via `useLaravelReactI18n` (`t(...)`) — TIDAK ada string hardcode di komponen.
2. THE key i18n SHALL ditambahkan/diperbarui di **kedua** locale (`lang/en/core/datatable.php` dan `lang/id/core/datatable.php`); tidak boleh ada key yang hanya ada di satu locale.
3. THE key operator existing yang di-rename ke prefix `!` (`not_set`→`!set`, `not_matches`→`!matches`, `not_in`→`!in`, `not_between`→`!between`, `not_has`→`!has`) SHALL diperbarui di kedua locale agar selaras dengan value operator.
4. THE key i18n baru SHALL mencakup minimal: operator `starts_with`, `ends_with`, `in_period`, `!in_period`; granularity `day`/`month`/`quarter`/`half-year`/`year`; sub-operator DateSelector; label "Simpan filter", "Daftar filter tersimpan", dan deskripsi terkait.
5. THE label kolom dan formStatus/enum options SHALL tetap memakai mekanisme i18n existing (`titleTrans`, `column.options`/`parse`) tanpa hardcode.
