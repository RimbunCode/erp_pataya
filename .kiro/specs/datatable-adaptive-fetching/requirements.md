# Requirements Document

## Introduction

`DataTableScope::dataTable()` saat ini selalu menjalankan `SELECT <table>.*` dan selalu
eager-load **semua** relasi ber-`type == 'relation'` dari konfigurasi kolom, terlepas dari kolom
mana yang benar-benar ditampilkan user. Akibatnya: payload baris membengkak dan ada query relasi
yang sia-sia, terutama pada model dengan banyak kolom/relasi.

User sudah menyimpan preferensi kolom visible di cookie `datatable_columns`, namun cookie itu
**belum dipakai** untuk membentuk query (bahkan dibaca dengan key yang salah). Fitur ini membuat
fetching **adaptif**: hanya `SELECT` kolom yang visible (+ PK + FK relasi visible) dan hanya
`with()` relasi yang kolomnya ditampilkan. Sumber kebenaran tetap `configColumns`/`dataTableColumns`;
cookie hanya menandai kolom mana yang tampil.

Fitur juga mempersiapkan `Table2` agar reusable (mis. dibungkus `Dialog`) tanpa preferensi kolomnya
saling menimpa, dan memperkenalkan deklarasi `dependsOn` agar kolom append (`attribute`) dapat
di-SELECT secara presisi.

Sistem yang terlibat: `DataTableScope` (backend query macro), service baru
`DataTableColumnSelector`, service eksisting `FilterColumnResolver` (commit `7ff3a1e`), komponen
React `Table2.jsx`/`Table.jsx`, dan konfigurasi `configColumns` pada model.

## Glossary

- **dataTableColumns**: metadata kolom hasil `Model::getColumns(1)` — sumber kebenaran tipe kolom,
  relasi, FK, append. Tidak dipengaruhi cookie.
- **configColumns**: properti `$configColumns` pada model + default — basis pembentukan
  `dataTableColumns`, termasuk flag `show` dan `ignore`.
- **visibleKeys**: himpunan nama kolom yang sedang ditampilkan, diambil dari `array_keys` cookie
  `datatable_columns`; bila kosong/invalid → kolom dengan `show !== false`.
- **Kolom skalar**: kolom DB bertipe `string|number|integer|float|date|datetime|boolean|json`.
- **Append (`attribute`)**: kolom turunan dari accessor model (`$appends`), bukan kolom DB.
- **dependsOn**: deklarasi pada config append berisi kolom DB / path relasi yang dibaca accessor.
- **FK relasi visible**: foreign key yang perlu di-SELECT agar relasi BelongsTo/morph yang visible
  bisa di-eager-load (FK di-unset oleh `getColumns`).
- **fallbackAll**: sinyal bahwa scope harus `SELECT <table>.*` (perilaku lama) karena anomali atau
  append tanpa `dependsOn` di produksi; `with` tetap di-prune.
- **persistColumns**: prop `Table2` (default `true`) yang mengizinkan skip baca/tulis cookie.

## Requirements

### Requirement 1: Prune kolom SELECT berdasarkan kolom visible

**User Story:** As an end-user membuka halaman DataTable, I want hanya kolom yang saya tampilkan
yang diambil dari database, so that halaman lebih cepat dimuat dan payload lebih ringan.

#### Acceptance Criteria

1. WHEN cookie `datatable_columns` berisi himpunan kolom visible, THE `DataTableScope` SHALL
   meng-`SELECT` hanya kolom DB yang visible ditambah primary key model.
   THE penentuan "kolom DB" SHALL memakai `Schema::getColumnListing` (sumber kebenaran), bukan
   whitelist tipe — kolom DB ber-`type` render custom (mis. `currency`, `formStatus`, `numeric`)
   tetap diperlakukan sebagai kolom DB.
   THE kolom ber-`forceAppend` (virtual dari global scope join) SHALL di-skip dari SELECT (disediakan
   oleh scope) dan tidak memicu kewajiban `dependsOn`.
2. THE `DataTableScope` SHALL selalu menyertakan primary key model pada `SELECT` walau tidak visible.
3. IF cookie `datatable_columns` kosong, absen, atau JSON-nya invalid, THEN THE `DataTableScope`
   SHALL memakai kolom dengan `show !== false` dari `configColumns` sebagai visibleKeys.
4. THE `DataTableScope` SHALL mengabaikan atribut `size` dan `order` pada cookie (hanya memakai
   himpunan nama kolom).
5. THE `DataTableScope` SHALL membaca cookie melalui `$request->cookie('datatable_columns')`
   (mekanisme standar Laravel), BUKAN superglobal `$_COOKIE`.
6. WHEN sebuah key pada cookie tidak dikenal oleh `dataTableColumns` model halaman ini, THE
   `DataTableColumnSelector` SHALL mengabaikan key tersebut.

### Requirement 2: Prune eager-load relasi berdasarkan kolom relasi visible

**User Story:** As an end-user, I want relasi yang tidak saya tampilkan tidak ikut di-query, so that
tidak ada query eager-load yang sia-sia.

#### Acceptance Criteria

1. THE `DataTableColumnSelector` SHALL menambahkan ke `with` hanya relasi **singular**
   (`type == 'relation'`) yang kolomnya visible (berdasarkan `nameOfFunction`).
2. THE `DataTableColumnSelector` SHALL TIDAK meng-auto-`with` relasi **plural** (`type == 'relations'`,
   mis. HasMany/MorphMany), meniru perilaku lama (cegah regresi eager-load); relasi plural tetap dapat
   dimuat via parameter `?with`.
3. WHEN sebuah relasi visible bertipe BelongsTo atau morph-to, THE `DataTableColumnSelector` SHALL
   menyertakan foreign key relasi tersebut pada `SELECT` (di-resolve runtime dari instance relasi).
4. WHEN relasi visible bertipe morph-to, THE `DataTableColumnSelector` SHALL menyertakan kolom tipe
   morph (`*_type`) selain foreign key (`*_id`) pada `SELECT`.
5. WHEN relasi visible bertipe HasOne/MorphOne, THE `DataTableColumnSelector` SHALL tidak menambah
   foreign key apa pun pada `SELECT` (cukup primary key induk).
6. THE `DataTableScope` SHALL tetap menggabungkan relasi dari parameter request `?with` dengan hasil
   prune, lalu men-deduplikasi.
7. THE `DataTableColumnSelector` SHALL tidak menambahkan relasi ke `with` hanya karena relasi itu
   dipakai pada filter (`?fid`) atau sort; relasi tersebut tetap di luar `with` bila kolomnya tidak visible.

### Requirement 3: Deklarasi `dependsOn` untuk kolom append

**User Story:** As a developer yang menambah kolom append ke DataTable, I want mendeklarasikan kolom
sumber yang dibaca accessor, so that backend bisa men-SELECT kolom presisi tanpa `SELECT *`.

#### Acceptance Criteria

1. WHEN sebuah append (`type == 'attribute'`) visible dan memiliki `dependsOn`, THE
   `DataTableColumnSelector` SHALL menyertakan setiap entri `dependsOn` non-dot sebagai kolom lokal
   pada `SELECT`.
2. WHEN entri `dependsOn` berbentuk dot-notation (`relasi.kolom`), THE `DataTableColumnSelector`
   SHALL menambahkan relasi (segmen pertama) ke `with` dan menyertakan foreign key-nya pada `SELECT`,
   melalui resolusi `FilterColumnResolver::resolvePath`.
3. IF sebuah append visible TIDAK memiliki `dependsOn` AND aplikasi tidak berjalan di produksi,
   THEN THE `DataTableColumnSelector` SHALL melempar `RuntimeException`.
4. IF sebuah append visible TIDAK memiliki `dependsOn` AND aplikasi berjalan di produksi, THEN THE
   `DataTableColumnSelector` SHALL mencatat `Log::warning` dan menyetel `fallbackAll = true`.

### Requirement 4: Kolom `templateLink` (mobile view) selalu ikut query

**User Story:** As an end-user pada perangkat mobile, I want baris tabel tetap menampilkan teks
ringkasan (templateLink), so that data terbaca walau kolom sumbernya sedang disembunyikan.

#### Acceptance Criteria

1. THE `DataTableColumnSelector` SHALL memperlakukan setiap placeholder pada string `templateLink`
   model sebagai key visible (forced) — selalu ikut `SELECT`/`with` walau tak ada di cookie.
2. WHEN placeholder berbentuk dot-notation (`relasi.kolom`), THE `DataTableColumnSelector` SHALL
   menambahkan relasi (segmen pertama) ke `with` dan foreign key-nya ke `SELECT`.
3. WHEN placeholder memakai sintaks alias `:name{:title}`, THE `DataTableColumnSelector` SHALL
   memakai placeholder di dalam kurung (`title`) sebagai key.
4. IF sebuah placeholder merujuk kolom DB nyata yang tidak ada di `dataTableColumns` (mis. kolom
   ber-`ignore`), THEN THE `DataTableColumnSelector` SHALL tetap menyertakan kolom itu pada `SELECT`.
5. THE `DataTableScope` SHALL meneruskan `Model::templateLink()` (bila ada) ke selektor.

### Requirement 5: Fallback aman tanpa regresi

**User Story:** As an operator aplikasi, I want optimasi ini tidak pernah merusak data yang tampil,
so that halaman tetap berfungsi walau ada konfigurasi yang belum lengkap.

#### Acceptance Criteria

1. WHEN `fallbackAll` bernilai true, THE `DataTableScope` SHALL meng-`SELECT <table>.*` (perilaku lama).
2. THE `DataTableScope` SHALL tetap mem-prune `with` walaupun `fallbackAll` bernilai true.
3. IF `SELECT` efektif hanya berisi primary key padahal ada kolom non-relasi yang seharusnya tampil,
   THEN THE `DataTableColumnSelector` SHALL menyetel `fallbackAll = true`.
4. WHEN tidak ada cookie sama sekali, THE data dan relasi yang dihasilkan SHALL setara dengan
   menampilkan kolom `show !== false` (tanpa regresi fungsional).

### Requirement 6: Kompatibilitas dengan sort dan saved filter

**User Story:** As an end-user, I want menyortir atau memfilter berdasarkan kolom yang sedang saya
sembunyikan tetap bekerja, so that fitur sort/filter tidak rusak oleh optimasi.

#### Acceptance Criteria

1. WHEN sort memakai kolom lokal yang tidak visible, THE `DataTableScope` SHALL menyertakan kolom
   tersebut pada `SELECT` (via `extraKeys`) agar `orderBy` tetap valid.
2. THE `DataTableScope` SHALL tetap menerapkan saved filter (`?fid`) melalui `FilterEvaluator`
   (`whereHas`) tanpa perubahan perilaku.
3. THE `DataTableScope` SHALL tetap menjalankan `FilterColumnResolver::expandColumnsForTree` untuk
   memperkaya metadata `dataTableColumns` yang dibagikan ke frontend, setelah query terbentuk dan
   tanpa memengaruhi `SELECT`/`with`.
4. THE `DataTableScope` SHALL mempertahankan perilaku pagination, akses by-`?id`, dan submitable.

### Requirement 7: Carrier cookie konsisten frontend–backend

**User Story:** As a developer, I want cookie kolom dibaca-tulis dengan key yang sama di frontend dan
backend, so that preferensi kolom benar-benar memengaruhi query.

#### Acceptance Criteria

1. THE `Table2.jsx` SHALL menulis cookie dengan key `datatable_columns` (tanpa suffix pathname)
   dan `path` = path halaman saat ini (`window.location.pathname`), sehingga preferensi kolom
   ter-isolasi per-halaman lewat path cookie.
2. THE `Table2.jsx` SHALL membaca cookie dengan key `datatable_columns` (by-name).
3. WHEN user mereset kolom, THE `Table2.jsx` SHALL menghapus cookie `datatable_columns` dengan
   `path` yang sama dengan saat menulis (`window.location.pathname`).
4. THE konfigurasi `bootstrap/app.php` SHALL mengecualikan `datatable_columns` dari enkripsi cookie
   (verifikasi; sudah ada).

### Requirement 8: Table2 reusable dengan opsi skip-persist

**User Story:** As a developer yang membungkus `Table2` di dalam `Dialog`, I want perubahan kolom di
tabel dialog tidak menimpa preferensi kolom tabel halaman utama, so that kedua tabel independen.

#### Acceptance Criteria

1. THE `Table2` SHALL menyediakan prop `persistColumns` dengan default `true`.
2. WHEN `persistColumns` bernilai false, THE `Table2` SHALL tidak membaca maupun menulis cookie
   `datatable_columns`.
3. THE `Table2` SHALL menentukan kondisi skip cookie sebagai `isDynamicData || !persistColumns` dan
   menerapkannya secara konsisten pada pembacaan (`createHeaders`), penulisan (effect), dan reset.
4. WHEN `persistColumns` bernilai false, THE perubahan empty-state dan sumber data `Table2` SHALL
   tidak berubah (perilaku `isDynamicData` tidak ikut aktif).
5. WHEN user menerapkan perubahan kolom, THE `Table2` SHALL memanggil `reload(val)` dengan daftar
   kolom terbaru agar pemanggil dapat memuat ulang data sesuai kolom visible.

### Requirement 9: Verifikasi terprogram

**User Story:** As a maintainer, I want perubahan ini tercakup unit dan feature test, so that
optimasi terbukti benar dan tidak regresi.

#### Acceptance Criteria

1. THE suite SHALL memuat unit test `DataTableColumnSelector` untuk: cookie kosong (kolom show:true),
   subset skalar, FK BelongsTo, morph (`*_type`+`*_id`), HasMany (tanpa FK), `dependsOn` lokal,
   `dependsOn` relasi, append tanpa `dependsOn` (throw di non-produksi; fallback+log di produksi),
   serta `extraKeys` sort lokal.
2. THE suite SHALL memuat feature test yang menyetel cookie via `withCookie` dan memverifikasi relasi
   tak-visible tidak ter-load (`relationLoaded === false`) serta kolom tersembunyi tidak ada pada row.
3. THE feature test SHALL memverifikasi interaksi sort kolom lokal non-visible dan saved filter
   (`?fid`) tetap berfungsi tanpa menambahkan relasi filter ke `with`.
