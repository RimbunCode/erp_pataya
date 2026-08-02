# Requirements Document

## Introduction

Model dengan DataTable (dipakai `FormPage` via `LinkModel` trait) saat ini
punya dua computed attribute terkait kontrol akses form: `canDelete`
(boolean, whole-record) dan `disabledOn` (saat ini string expression,
whole-form, dievaluasi FE). Belum ada mekanisme **field-level** — model
tidak bisa menyatakan "field A boleh diedit, field B tidak" tanpa
menonaktifkan seluruh form.

Spec ini menambahkan computed attribute baru `canUpdate` yang mengikuti pola
existing (`getAppends()` / `getArrayableAppends()` di `App\Traits\LinkModel`,
`method_exists(static::class, 'canUpdate')` override per model) tapi dengan
bentuk kontrak lebih kaya: `bool` (blanket semua field), `array` map
`{fieldName: bool|array|Closure}` (per-field, termasuk relasi many), atau
`Closure` (evaluasi dinamis per child row saat butuh logic berbasis nilai
row tsb, mis. row yang sudah punya stock movement locked qty-nya).

**Scope PENTING**: `canUpdate` dan `disabledOn` HANYA computed attribute
milik model ROOT (model yang menjadi target halaman `show`/single-record
form) — child model (mis. `PurchaseOrderItem` dalam relasi `items`) TIDAK
punya accessor `canUpdate`/`disabledOn` sendiri. Detail permission per
child row (mis. row yang locked karena `have_stock_movement`) dihasilkan
lewat Closure di dalam `canUpdate()` milik PARENT — closure itu
komputasi milik parent, bukan attribute child. Kedua attribute ini JUGA
TIDAK PERNAH dikirim pada response endpoint index/DataTable
(`ModelController::__invoke`) maupun lookup/dropdown
(`ModelController::selectData`, komponen `LinkModel`) — hanya muncul pada
payload halaman show. Ini mencegah komputasi (evaluasi closure, cek
status) terjadi sia-sia di jalur yang tidak membutuhkannya (list/lookup
bisa berisi ratusan row).

Spec ini SEKALIGUS merombak `disabledOn` dari string expression menjadi
**boolean murni** (breaking change — tidak ada model existing yang
meng-override `disabledOn()` saat ini, jadi migrasi aman), mengikuti pola
persis `getCanDeleteAttribute()`/`getCanCancelAttribute()`: baseline
ditentukan status submitable, model boleh override method `disabledOn()`
untuk menambah kondisi (AND dengan baseline) KECUALI pada status
canceled/rejected yang selalu locked mutlak (override tidak dipanggil).

Kedua attribute tetap coexist dengan tanggung jawab berbeda: `disabledOn`
= kill-switch seluruh form berbasis status dokumen, `canUpdate` = kontrol
granular per-field yang berlaku ketika form itu sendiri tidak di-disable.

## Glossary

- **canUpdate**: computed attribute baru pada model DataTable. Return `bool`
  (true = semua field allowed, false = semua field locked) atau `array` map
  `{fieldName: bool|array}`. Field yang **tidak disebut** dalam map dianggap
  **allowed** (default true) — whitelist-exclude, konsisten dgn semantik
  "absen = tidak dibatasi".
- **disabledOn**: computed attribute existing (`App\Traits\LinkModel`),
  DIROMBAK oleh spec ini dari string expression menjadi **boolean murni**
  (`true` = seluruh form disabled). Baseline:
  - Model TIDAK submitable → default `false`, dapat di-override total via
    method `disabledOn()`.
  - Model submitable, status `draft` → default `false`.
  - Model submitable, status `canceled` ATAU `rejected` → SELALU `true`,
    **tidak dapat di-override** (method `disabledOn()` tidak dipanggil /
    short-circuit).
  - Model submitable, status LAIN (mis. submitted/approved/pending/dst) →
    default `true`, dapat di-override total via method `disabledOn()`.
  Method override (bila ada) mengembalikan `bool` murni, dipanggil kecuali
  pada kondisi locked-mutlak di atas.
- **Relasi many override**: pada `canUpdate` parent, value untuk field
  relasi hasMany boleh berupa `bool` (whole-relation toggle: seluruh child
  row boleh/tidak disentuh), `array` map statis (override field spesifik
  pada semua child row, mis. `items: {item: true, warehouse: false}`), atau
  `Closure` (lihat poin berikut).
- **Konvensi penulisan key relasi**: key pada `canUpdate()` map — TERMASUK
  key relasi many — SELALU ditulis **snake_case**, konsisten dengan
  konvensi field data lain di response JSON (mis. `source_warehouse`,
  BUKAN `sourceWarehouse`). Backend menormalisasi key tsb ke camelCase
  (`Str::camel()`) HANYA secara internal untuk mendeteksi apakah key
  tsb merujuk relasi Eloquent yang ter-load (`relationLoaded()`/
  `getRelation()`, API Eloquent yang butuh nama method PHP asli/
  camelCase) — key pada payload akhir yang dikirim ke FE TETAP snake_case
  persis seperti yang ditulis developer di `canUpdate()`. Field non-relasi
  (`customer`, `qty`, dst.) tidak terpengaruh normalisasi ini sama sekali.
- **Closure value**: value pada `canUpdate` — di level field mana pun,
  termasuk di dalam array nested relasi many — boleh berupa `Closure`
  dengan signature `fn(Model $row): bool|array`. Dipakai ketika hasil
  permission butuh logic dinamis berbasis nilai row tsb (mis. row item yang
  sudah punya stock movement → qty locked). `$row` adalah instance Eloquent
  penuh milik row ybs (utk relasi many: instance child model tsb; utk field
  root: instance model itu sendiri). Closure dievaluasi backend SEBELUM
  serialisasi — payload JSON yang diterima FE selalu berupa hasil resolved
  (`bool`/`array`), tidak pernah closure mentah.

## Requirements

### Requirement 1: Computed attribute `canUpdate` pada model

**User Story:** Sebagai developer, saya ingin model dapat mendeklarasikan
field mana yang boleh diedit lewat method `canUpdate()`, sehingga kontrol
akses form tidak melulu whole-form (`disabledOn`) atau whole-record
(`canDelete`).

#### Acceptance Criteria

1. THE `LinkModel` trait SHALL menyediakan computed attribute
   `getCanUpdateAttribute()` yang di-append otomatis ke model DataTable,
   mengikuti pola `method_exists(static::class, 'canUpdate')` seperti
   `canDelete`/`disabledOn`.
2. WHEN model TIDAK meng-override method `canUpdate()`, THE attribute
   `canUpdate` SHALL bernilai `true` (default: semua field allowed).
3. WHEN model meng-override `canUpdate()` mengembalikan `bool`, THE
   attribute `canUpdate` SHALL bernilai boolean tsb apa adanya (blanket
   semua field).
4. WHEN model meng-override `canUpdate()` mengembalikan `array`, THE
   attribute `canUpdate` SHALL berupa map `{fieldName: bool|array}` sesuai
   return method tsb.
5. WHEN sebuah field TIDAK muncul sbg key dalam map `canUpdate`, THE field
   tsb SHALL dianggap allowed (`true`) oleh konsumen (FE / validasi
   backend).
6. THE attribute `canUpdate` SHALL HANYA tersedia pada model yang memakai
   `LinkModel` trait (model DataTable) — bukan pada model lain.
7. THE attribute `canUpdate` (dan `disabledOn`) SHALL HANYA di-append
   (masuk `getAppends()`, sehingga computed & muncul di payload) KETIKA
   model sedang diserialize sbg ROOT halaman `show` — bukan default
   selalu-append. Model yang sama, ketika diserialize lewat jalur index
   (`ModelController::__invoke`) atau lookup (`ModelController::selectData`,
   `LinkModel` FE component), SHALL TIDAK meng-append kedua attribute ini
   sama sekali — accessor-nya TIDAK dipanggil (bukan sekadar dibuang dari
   response), sehingga tidak ada overhead evaluasi closure/cek status pada
   query yang bisa berisi banyak row.
8. THE mekanisme flag "sedang di show" SHALL diintegrasikan di titik
   generic yang dilalui SEMUA controller `show()` — yaitu
   `DataTable::showDetail()` (`App\Traits\DataTable.php`) — BUKAN dengan
   mengubah tiap controller `show()` satu per satu (46 file).

### Requirement 2: Evaluasi closure untuk logic dinamis per-row

**User Story:** Sebagai developer, saya ingin mendeklarasikan permission
field pada child row (mis. item dalam Purchase Order) yang butuh logic
dinamis berbasis nilai row tsb (mis. locked jika sudah ada stock movement),
langsung sbg closure di dalam `canUpdate()` parent — tanpa perlu
mekanisme model child terpisah atau merge implisit.

#### Acceptance Criteria

1. WHEN value pada map `canUpdate` milik model ROOT (di field mana pun,
   termasuk nested dalam array relasi many) berupa `Closure`, THE backend
   SHALL mengevaluasi closure tsb dengan argumen instance Model row ybs
   SEBELUM attribute di-serialize ke JSON.
2. WHEN closure level-relasi (mis. `items: fn($row) => [...]`) dievaluasi,
   THE closure SHALL dipanggil SEKALI PER CHILD ROW pada relasi tsb, dengan
   `$row` = instance child model row ybs (child row SUDAH ter-eager-load
   lewat `with()`/`loadRelations()` biasa sebelum closure dipanggil).
3. WHEN closure level-field di dalam array nested (mis.
   `items: {qty: fn($row) => bool}`) dievaluasi, THE closure SHALL
   dipanggil per child row dengan `$row` = instance child model row ybs
   (bukan instance parent).
4. THE hasil evaluasi closure (`bool` atau `array`) SHALL menggantikan
   closure tsb di posisi yang sama pada struktur output — struktur
   `canUpdate` akhir yang dikirim ke FE SHALL TIDAK mengandung closure.
5. WHEN field TIDAK diberi closure (value statis `bool`/`array` biasa),
   THE evaluasi SHALL tetap sesuai Requirement 1 (tanpa overhead
   pemanggilan closure).
6. THE child model (mis. `PurchaseOrderItem`) SHALL TIDAK memiliki
   accessor `canUpdate`/`disabledOn` miliknya sendiri — SATU-SATUNYA
   sumber kebenaran adalah `canUpdate()` milik model ROOT yang sedang
   diserialize sbg halaman show. Detail per-child-row (via closure)
   adalah komputasi PARENT yang di-attach ke representasi child row pada
   payload, BUKAN attribute yang child model expose secara independen.
   Spec ini SHALL TIDAK memperkenalkan konsep merge parent-child.
7. WHEN key relasi many pada map `canUpdate()` ditulis snake_case (mis.
   `source_warehouse`, sesuai konvensi Glossary "Konvensi penulisan key
   relasi"), THE backend SHALL tetap mendeteksinya sbg relasi many
   (dengan menormalisasi key ke camelCase HANYA untuk pemanggilan
   `relationLoaded()`/`getRelation()`) — closure/array pada key tsb
   SHALL dievaluasi per child row (Kriteria 2-3), BUKAN diperlakukan sbg
   field biasa. Key pada payload akhir SHALL TETAP snake_case (tidak
   dikonversi balik).

### Requirement 3: `disabledOn` sebagai boolean whole-form dengan baseline status

**User Story:** Sebagai developer, saya ingin `disabledOn` otomatis
mengikuti status submitable dokumen (draft terbuka, canceled/rejected
selalu terkunci) tanpa perlu menulis expression string, dan tetap bisa
override untuk status lain, sehingga whole-form lock konsisten di semua
model submitable tanpa boilerplate.

#### Acceptance Criteria

1. THE `LinkModel`/`Submitable` trait SHALL mengubah
   `getDisabledOnAttribute()` agar mengembalikan `bool` (bukan lagi
   string expression).
2. THE `disabledOn` SHALL tunduk pada scope show-only yang sama dengan
   `canUpdate` (Requirement 1 Kriteria 7-8) — accessor tidak dipanggil di
   luar jalur `show`.
3. WHEN model TIDAK memakai `Submitable` trait (bukan submitable), THE
   baseline `disabledOn` SHALL `false`. WHEN model meng-override method
   `disabledOn()`, THE hasil override SHALL dipakai sbg nilai akhir
   (replace, bukan AND dengan baseline).
4. WHEN model submitable DAN status dokumen (`(array) $this->status`)
   mengandung `FormStatus::DRAFT`, THE baseline `disabledOn` SHALL
   `false`.
5. WHEN model submitable DAN status dokumen mengandung
   `FormStatus::CANCELED` ATAU `FormStatus::REJECTED`, THE `disabledOn`
   SHALL SELALU `true` — method override `disabledOn()` pada model SHALL
   TIDAK dipanggil sama sekali (short-circuit sebelum evaluasi override).
6. WHEN model submitable DAN status dokumen TIDAK termasuk draft, canceled,
   atau rejected (mis. submitted/approved/pending/dst), THE baseline
   `disabledOn` SHALL `true`. WHEN model meng-override method
   `disabledOn()` pada kondisi ini, THE hasil override SHALL dipakai
   sbg nilai akhir (replace murni, TIDAK di-AND dengan baseline) —
   memungkinkan model membuka kembali form pada status non-draft
   tertentu.
7. WHEN model meng-override `disabledOn()` DAN kondisi short-circuit
   Kriteria 5 SEDANG TIDAK aktif, THE method override SHALL dipanggil dan
   hasilnya (`bool`) SHALL dipakai sbg nilai akhir `disabledOn`.
8. THE payload JSON model SHALL mengirim `disabledOn` sbg `bool`, bukan
   string — FE (`FormPage.jsx`, `gjsRelationsTable.js`) SHALL disesuaikan
   untuk memakai nilai tsb langsung (tanpa parsing `evaluate()`/
   `evaluateExpression()` lagi untuk `disabledOn` — mekanisme
   evaluate/expression yang dipakai keperluan lain di luar `disabledOn`
   tidak dalam scope spec ini).
9. WHEN `disabledOn` bernilai `true`, THE seluruh field form SHALL
   dianggap disabled TANPA perlu mengevaluasi `canUpdate` (short-circuit
   di level FE).
10. WHEN `disabledOn` bernilai `false`, THE status disabled per-field
    SHALL ditentukan oleh `canUpdate[field]`.
11. THE dua attribute ini SHALL dikirim terpisah dalam payload model
    (tidak digabung jadi satu key).

### Requirement 4: Metadata kolom untuk exclusion di UI picker

**User Story:** Sebagai developer, saya ingin `canUpdate` terdaftar sbg
metadata kolom non-data (sejajar `canDelete`/`disabledOn`), sehingga tidak
muncul di UI column-picker/filter DataTable maupun ikut lolos whitelist
saat memang dibutuhkan konsumen lain.

#### Acceptance Criteria

1. THE `canUpdate` SHALL ditambahkan ke `ALWAYS_ALLOWED_ATTRIBUTES` di
   `ModelController` (lookup/LinkModel picker) DAN
   `META_APPEND_COLUMN_NAMES` di FE `utils.js`, sejajar `canDelete` dan
   `disabledOn` yang sudah terdaftar di sana.
2. THE `getColumns()` (`LinkModel::computeColumnsFlat()`) SHALL TIDAK
   mendaftarkan `canUpdate`/`disabledOn` sbg kolom metadata sama sekali
   — `computeColumnsFlat()` membangun daftar append dari instance yang
   TIDAK dalam show-context (Requirement 1 Kriteria 7), sehingga kedua
   attribute secara alami tidak pernah masuk metadata skema. Ini
   disengaja: `getColumns()` melayani index/lookup/picker, scope yang
   MEMANG tidak boleh mengenal kedua attribute ini.
3. THE spec ini SHALL TIDAK mengubah `dependsOn` baseline `disabledOn`
   yang sudah ada di `getColumns()` (baris `disabledOn` dalam grup
   `route`/`keyModel`/`thisModel`) — baris itu tidak pernah tereksekusi
   utk `disabledOn` post-spec (konsisten Kriteria 2), sehingga tidak ada
   perilaku baru yang bergantung padanya.

### Requirement 5: Konsumsi FE via hook/context terpusat

**User Story:** Sebagai developer frontend, saya ingin satu hook terpusat
untuk membaca status `canUpdate` suatu field, sehingga komponen `Input`,
`FormTable`, `LinkModel`, dan komponen field lain tidak perlu masing-masing
mengimplementasikan logic precedence/short-circuit dengan `disabledOn`.
Karena closure sudah dievaluasi backend (Requirement 2), payload yang
diterima hook ini SELALU berupa `bool`/`array` biasa (JSON serializable) —
FE tidak pernah menangani closure.

#### Acceptance Criteria

1. THE FE SHALL menyediakan hook (mis. `useCanUpdate(fieldName)`) yang
   di-resolve sekali oleh `FormPage` dari `defaultData.canUpdate` +
   `defaultData.disabledOn`, didistribusikan via React Context ke komponen
   descendant.
2. WHEN dipanggil dengan nama field top-level (mis. `useCanUpdate('customer')`),
   THE hook SHALL mengembalikan boolean final (sudah AND dengan nilai
   `disabledOn`, sesuai Requirement 3 Kriteria 9-10).
3. WHEN dipanggil untuk field pada child row relasi many (mis. dalam
   `FormTable` utk kolom `qty` pada salah satu row `items`), THE hook
   SHALL menerima row data child ybs sbg parameter TAMBAHAN (bukan
   `fieldName` bertingkat), lalu resolve dari `row.canUpdate[fieldName]`
   — nilai ini SUDAH merupakan hasil closure parent yang ter-attach pada
   representasi row tsb (Requirement 2), BUKAN attribute independen milik
   child model.
4. THE komponen `Input`, `FormTable`, `LinkModel` (dan field lain yang
   relevan) SHALL memakai hook ini untuk menentukan prop `disabled`
   masing-masing, bukan membaca `defaultData.canUpdate` secara langsung.
5. IF field tidak dikenal dalam `canUpdate` map (absen), THEN hook SHALL
   mengembalikan `true` (allowed), sesuai Requirement 1.5.

### Requirement 6: Dampak terhadap model existing

**User Story:** Sebagai maintainer, saya ingin memahami dengan jelas bagian
mana yang non-breaking (`canUpdate`, fitur baru) dan bagian mana yang
breaking-tapi-aman (`disabledOn`, perubahan tipe), sehingga rollout spec ini
tidak mengejutkan.

#### Acceptance Criteria

1. WHEN model tidak override `canUpdate()`, THE seluruh field form SHALL
   allowed (`true`) — tidak ada model existing yang perlu perubahan kode
   untuk tetap berfungsi.
2. THE penambahan `canUpdate`/`disabledOn` ke `getAppends()` SHALL tidak
   menambah overhead pada jalur index/lookup (`ModelController`) — kedua
   attribute HANYA ter-append pada jalur `show` (Requirement 1 Kriteria
   7-8).
3. THE perubahan `disabledOn` dari string expression ke `bool` SHALL
   diperlakukan sbg breaking change yang disengaja — DIVERIFIKASI (lih.
   audit codebase saat requirements disusun) bahwa TIDAK ADA model yang
   saat ini meng-override method `disabledOn()` dengan return string,
   sehingga migrasi data/kode model = nihil. Perubahan HANYA berdampak
   pada consumer FE (`FormPage.jsx`, `gjsRelationsTable.js`) yang
   sebelumnya memanggil `evaluate()`/`evaluateExpression()` atas
   `disabledOn` — ini WAJIB disesuaikan sbg bagian implementasi spec ini
   (lih. Requirement 3 Kriteria 8).
