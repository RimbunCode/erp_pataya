# Requirements Document

## Introduction

Endpoint lookup (`POST /model` `__invoke`, `POST /model/select-data` `selectData`) saat ini menjalankan
`SELECT *` lalu menyaring kolom di PHP (`ModelController::filterRowColumns`). Response aman, tetapi **database
tetap membaca kolom sensitif** (mis. `price`, `rate`, `valuation_rate`) ke memori sebelum dibuang —
over-fetch yang tak perlu dan rawan jika lapis filter PHP gagal.

Spec ini memperketat lookup ke **SELECT level** (DB hanya membaca kolom yang diizinkan), dengan memakai-ulang
mesin select-resolver DataTable2. Karena lookup dan index (DataTable2) butuh logika select-presisi yang sama,
keduanya **dikonvergensikan** ke satu method baru `DataTableColumnSelector::resolveForSafe` yang menerima
**himpunan kolom aman** (bukan `visibleKeys` cookie). Bersamaan, DataTable2 diperketat (**strict**): cabang
`fallbackAll` (`SELECT *`) dihapus, dan append/accessor tanpa `dependsOn` dipaksa throw agar SELECT selalu
presisi.

Diskusi desain mengungkap tiga area tambahan yang masuk scope: (a) templateLink yang merujuk relasi bertingkat
(mis. `:approvalInstance.document`) harus di-resolve rekursif; (b) relasi `morphTo` tak dapat di-prune di SELECT
(tabel berbeda per-baris) sehingga child-nya `SELECT *`; (c) kolom relasi morph **belum disaring** di
`filterRowColumns` saat ini (celah kebocoran) dan harus diperbaiki dengan prinsip fail-closed.

Sistem yang terlibat: `DataTableColumnSelector`, `DataTableScope`, `ModelController`, `LinkModel` (trait),
`FilterColumnResolver`, dan model-model (`app/Models/**`) yang perlu audit `dependsOn`.

## Glossary

- **Lookup endpoint**: `ModelController::__invoke` (`POST /model`) & `selectData` (`POST /model/select-data`) —
  penyedia data dropdown/select di form.
- **SELECT-level pruning**: membatasi kolom yang dibaca DB lewat `$query->select(...)`, bukan menyaring setelah
  baca (`SELECT *` → filter PHP).
- **Kolom aman (`safeColumns`)**: himpunan nama kolom yang boleh dibaca/dikembalikan untuk model = templateLink
  + id/PK + (requested ∩ linkable) − (visibleFor gagal) + meta appends. Hasil `safeLookupColumns`.
- **`resolveForSafe`**: method baru `DataTableColumnSelector` yang menerima `safeColumns` (+ kolom aman relasi)
  dan mengembalikan `{select, with}` presisi tanpa `fallbackAll`.
- **`fallbackAll`**: cabang lama yang jatuh ke `SELECT *` saat select presisi gagal disusun. Dihapus (strict).
- **`dependsOn`**: deklarasi di `configColumns` yang menyebut kolom sumber sebuah accessor/append agar dapat
  di-SELECT presisi.
- **Strict**: mode di mana append/accessor tanpa `dependsOn` menyebabkan throw `RuntimeException` (bukan
  fallback diam-diam).
- **Meta global**: atribut yang ditambahkan `LinkModel::getArrayableAppends` ke SEMUA model: `route`,
  `canDelete`, `keyModel`, `appendStatus`, `thisModel`, `templateLink`, `disabledOn`.
- **templateLink nested (Arah A)**: penelusuran rekursif placeholder templateLink yang merujuk relasi
  bertingkat (mis. `:approvalInstance.document`).
- **morphTo / morph child**: relasi polimorfik yang model targetnya berbeda per-baris (ditentukan kolom
  `<relasi>_type`). "Morph child" = data relasi morph yang ter-load.
- **Fail-closed**: default tolak — bila keamanan tak dapat dipastikan, buang data daripada membocorkannya.
- **Defense-in-depth**: dua lapis pertahanan — SELECT-level (DB) + `filterRowColumns` (response PHP).

## Requirements

### Requirement 1: Lookup membaca hanya kolom aman (SELECT-level)

**User Story:** As a backend operator, I want lookup endpoint hanya membaca kolom aman dari database,
so that kolom sensitif tidak pernah dibaca DB walau nanti tetap disaring di PHP.

#### Acceptance Criteria

1. THE lookup endpoint (`__invoke`, `selectData`) SHALL membangun `$query->select(...)` dari himpunan kolom
   aman (`safeLookupColumns`) memakai `resolveForSafe`, BUKAN `SELECT *`.
2. THE `select` SHALL selalu memuat primary key model utama.
3. THE `select` untuk relasi non-morph SHALL hanya memuat kolom aman relasi tersebut (hasil
   `safeLookupColumns(childClass, relationFields)`) ditambah foreign key/morph type yang wajib.
4. WHEN sebuah relasi BelongsTo atau morph dimuat (`with`), THE `select` SHALL menyertakan foreign key (dan
   morph type) relasi tersebut SEHINGGA relasi tidak null.
5. THE `filterRowColumns` (lapis PHP) SHALL tetap dijalankan setelah query sebagai lapis kedua
   (defense-in-depth) pada semua jalur lookup.
6. IF request memuat `joins` atau `addSelect` manual (jalur `scopeLinkModel`), THEN THE lookup SHALL mendeteksi
   konflik SELECT-level DAN fallback ke filter-PHP-only untuk jalur tersebut.
7. WHEN mode cache (`cacheMode`) aktif, THE lookup SHALL tetap memakai `getRelationKeys` untuk relasi seperti
   perilaku sebelumnya.

### Requirement 2: Mesin `resolveForSafe` (konvergensi lookup + index)

**User Story:** As a developer, I want satu method `resolveForSafe` yang dipakai lookup dan index,
so that logika select-presisi tidak terduplikasi dan keduanya konsisten.

#### Acceptance Criteria

1. THE `DataTableColumnSelector` SHALL menyediakan method `resolveForSafe($dataTableColumns, $model,
   $safeColumns, $safeRelationColumns, $templateLink)` yang mengembalikan `{select, with}`.
2. THE return `resolveForSafe` SHALL TIDAK memuat key `fallbackAll`.
3. THE `with` SHALL memetakan tiap relasi non-morph ke closure child-select (`fn ($q) => $q->select([kolom
   aman child + FK])`).
4. WHEN sebuah head adalah kolom virtual `forceAppend` (global scope join), THE `resolveForSafe` SHALL melewati
   kolom itu (tidak di-select, tidak throw).
5. THE `select` dan `with` yang dikembalikan SHALL unik (tanpa duplikat).
6. THE method lama `resolve` (yang mengembalikan `fallbackAll`) SHALL dihapus DAN seluruh pemanggilnya
   diarahkan ke `resolveForSafe`.

### Requirement 3: DataTable2 strict — hapus `fallbackAll`, paksa `dependsOn`

**User Story:** As a developer, I want SELECT selalu presisi tanpa fallback `SELECT *`,
so that tidak ada over-fetch tersembunyi dan setiap accessor dideklarasikan dengan benar.

#### Acceptance Criteria

1. THE `DataTableColumnSelector` SHALL menghapus seluruh cabang `fallbackAll` (`SELECT *`).
2. IF sebuah append/accessor non-DB tidak memiliki `dependsOn`, THEN THE `collectAppend` SHALL throw
   `RuntimeException` (selalu, termasuk produksi).
3. THE cabang produksi lama (`Log::warning` + `return false`) SHALL dihapus.
4. THE `DataTableScope` macro `dataTable` SHALL memakai `resolveForSafe` DAN membuang cabang
   `if ($resolved['fallbackAll']) addSelect("*")`.
5. WHEN index memuat relasi (`with`), THE child-select SHALL dibatasi ke kolom yang dirujuk
   `childClass::templateLink()` (label display).
6. IF relasi child tidak memiliki `templateLink`, THEN THE child-select SHALL minimal (PK + FK) DAN render
   relasi tetap berperilaku sama seperti sebelumnya (label kosong).

### Requirement 4: templateLink nested rekursif (Arah A)

**User Story:** As a developer, I want templateLink yang merujuk relasi bertingkat di-resolve otomatis,
so that label tetap tampil tanpa harus mendeklarasikan relasi nested secara manual.

#### Acceptance Criteria

1. WHEN templateLink memuat placeholder dot-notation (mis. `:approvalInstance.document`), THE `resolveForSafe`
   SHALL me-resolve rantai relasi penuh via `FilterColumnResolver::resolvePath` (with rantai + FK tiap segmen +
   kolom akhir di model terdalam).
2. WHEN ujung placeholder adalah relasi non-morph, THE resolver SHALL rekursi ke `childClass::templateLink()`.
3. THE resolusi templateLink SHALL berhenti bila sebuah model sudah dikunjungi (cycle guard).
4. THE resolusi templateLink SHALL berhenti pada kedalaman 4 (depth cap); relasi lebih dalam tidak di-`with`.
5. WHEN sebuah segmen rantai adalah `morphTo`, THE resolusi SHALL berhenti di segmen itu (class child tak pasti
   build-time) DAN relasi morph tetap di-`with`.

### Requirement 5: Audit `dependsOn` dan aturan meta global

**User Story:** As a developer, I want semua accessor punya `dependsOn` yang benar sebelum strict diaktifkan,
so that halaman index tidak throw massal saat `fallbackAll` dihapus.

#### Acceptance Criteria

1. THE audit `dependsOn` (~11 model + override) SHALL tuntas SEBELUM cabang `fallbackAll` dihapus.
2. THE meta global `route`, `keyModel`, `thisModel` SHALL exempt dari strict (tidak memerlukan `dependsOn`,
   karena tidak membaca kolom DB).
3. THE `appendStatus` SHALL memiliki baseline `dependsOn:['status']` di trait `LinkModel`, diterapkan **hanya
   jika** `Schema::hasColumn(table, 'status')` bernilai true.
4. IF model tidak memiliki kolom `status`, THEN `status` SHALL TIDAK di-select DAN accessor `appendStatus`
   tetap dijalankan serta tetap tampil di response.
5. IF override `canDelete()`, `disabledOn()`, `appendStatus()`, atau `replaceStatus()` membaca kolom tertentu,
   THEN model tersebut SHALL mendeklarasikan `dependsOn` kolom itu (jika tidak → throw saat strict).
6. WHEN sebuah accessor membutuhkan kolom sensitif (mis. `appendStatus`→`status`), THE kolom itu SHALL ikut
   di-select (meta wajib) TAPI TIDAK dikembalikan ke response (disaring `filterRowColumns`).

### Requirement 6: Penyaringan relasi morph (fail-closed)

**User Story:** As a backend operator, I want kolom relasi morph yang ditampilkan tetap disaring,
so that walau morph child tidak dapat di-prune di SELECT, kolom sensitifnya tidak bocor ke response.

#### Acceptance Criteria

1. THE relasi `morphTo` SHALL TIDAK di-prune pada SELECT-level (child `SELECT *`), karena tabel target berbeda
   per-baris.
2. WHEN `filterRowColumns` memproses sebuah relasi morph, THE method SHALL menentukan FQCN class child dari
   kolom `<relasi>_type` baris tersebut.
3. WHEN FQCN morph child diketahui dan class memiliki `getColumns`, THE `filterRowColumns` SHALL menyaring child
   secara rekursif memakai `safeLookupColumns(class, relationFields, perm)`.
4. IF class morph child tidak memiliki `getColumns` (bukan model standar), THEN THE `filterRowColumns` SHALL
   membuang seluruh relasi morph dari response (fail-closed).
5. THE perbaikan ini SHALL menutup perilaku saat ini di mana relasi morph diteruskan apa adanya tanpa
   penyaringan.

### Requirement 7: Tidak ada regresi index & lookup

**User Story:** As a QA, I want halaman index dan lookup tetap berfungsi setelah perubahan,
so that perketatan keamanan tidak merusak fungsionalitas yang ada.

#### Acceptance Criteria

1. THE semua halaman index (DataTable2) SHALL tetap render setelah `fallbackAll` dihapus (tanpa throw).
2. THE feature test `LinkModelColumnSecurity`, `ModelSelectData`, `ModelControllerFilter` SHALL tetap pass.
3. THE unit test `DataTableColumnSelectorTest` SHALL diperluas mencakup `resolveForSafe`, strict-throw,
   templateLink nested (cycle/depth), dan morph (tanpa prune).
4. THE feature lookup SHALL membuktikan (via query log atau pemeriksaan data) bahwa kolom non-aman relasi
   non-morph tidak di-query, kolom morph sensitif tidak ada di response, dan morph class asing hilang dari
   response.
5. THE rollout SHALL berurutan: (1) bangun `resolveForSafe` + test, (2) audit `dependsOn` lengkap, (3) swap
   scope ke `resolveForSafe` + hapus `fallbackAll`.
