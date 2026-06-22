# Requirements: SelectModel Rewrite

## Introduction

Komponen `SelectModel` (`resources/js/Components/SelectModel.jsx`, 608 baris) adalah dialog yang memungkinkan user mengimpor record/item dari model Eloquent lain ke dalam form aktif (mis. impor item WorkOrder ke PurchaseOrder). Dipakai di tiga halaman Form (PurchaseOrders, PurchaseRequests, SalesOrders) dan saat ini bergantung pada **dua endpoint terpisah** (`GET /model/{model}` untuk kolom + `POST /model/datatable` untuk data), helper `loadFromModel`, serta `PermissionLinkModel` untuk memilih model sumber.

Rewrite ini menyatukan dua endpoint menjadi satu, menstandarkan prop `from`, menyelaraskan filter dengan sistem **filter-tree + SavedFilter** milik `DataTable2` (sehingga tidak ada filter ephemeral yang lewat begitu saja di request — semua filter di-persist minimal sebagai SavedFilter dan dirujuk via `fid`), menambahkan UI pagination/show/filter eksplisit di dialog, mendukung dua mode seleksi, merapikan `onSelected`, dan menghapus dead code. Komponen lama diganti **di tempat** (bukan paralel) karena hanya tiga konsumen.

## Keputusan Desain (Dikunci — sumber: diskusi user)

| Dimensi | Keputusan |
|---------|-----------|
| Lokasi config | Tetap di **frontend** (prop `from`), seperti `revamp`. Struktur boleh disederhanakan **tanpa menghilangkan fungsi** properti apa pun |
| Endpoint | `model.selectData` (`POST /model/select-data`) — combined columns+data |
| Format filter | Dua kanal native (NOL konversi FE): `baseFilters` = **tree LinkModel** (`{ col: val \| {op:val}, "and"\|"or": {...} }`, dari `from`, NON-EDITABLE) + `filters` = **`{root:{k,o,v,c}}` builder native**. JsDoc wajib (R8.8) |
| Filter tiga jalur | `baseFilters` (NON-EDITABLE, via converter→FilterEvaluator) + `filters` (FilterBuilder native, FilterEvaluator langsung) + **`fid`** (HANYA saved filter). Semua AND di backend |
| Makna "per-item" | Spec `rewrite`: flatten items **lintas parent**, tiap row bawa kolom parent |
| Model selector UI | Sederhanakan pakai `@/Components/Select.jsx` (bukan `PermissionLinkModel`) |
| `onSelected` | **Breaking diizinkan** — utamakan rapi, mudah dipakai, mudah dimengerti |
| `loadFromModel` | Helper ambil data langsung tanpa dialog — **selaraskan payload return** dengan `onSelected` |
| Pagination/Show/Filter | UI **eksplisit** di dialog |
| `SELF_OPTION` | **Dipertahankan** (`"__self__"`) |
| Relasi balik parent | Spec `rewrite`: pakai `public static $parentRelation`, un-ignore kolom parent kondisional |
| Backend query | Pakai macro `dataTable` untuk sort/paginate/submitable. Filter: `baseFilters` via `LinkModelFilterConverter`→`FilterEvaluator` + `filters` via `FilterEvaluator` langsung + `fid` via `FilterEvaluator` (saved filter saja). Semua AND |

## Glossary

- **SelectModel**: dialog memilih record dari model Eloquent lain lalu mengimpor ke form saat ini.
- **from prop**: konfigurasi (string | object) yang mendeklarasikan model mana boleh dipilih beserta filter default, kolom default, relasi yang bisa diekstrak, dan alias kolom.
- **Direct selection mode**: user memilih row langsung dari model target (tanpa parent). Aktif saat model aktif tidak punya `selects`.
- **Parent extraction mode (SELF)**: user memilih row model induk (mis. WorkOrder), sistem mengekstrak child items dari relasi `selects` (mis. `items`). Output: flatten semua items dari row terpilih.
- **Per-item mode**: user memilih relasi (mis. `items`) lalu mencentang **item spesifik lintas parent** (item A di WO1 + item B di WO2). Tiap item bawa kolom parent. Output: persis item terpilih.
- **selects**: objek config di `from` yang mendefinisikan relasi yang bisa diekstrak beserta filter & kolomnya. Nama standar (plural). Singular `select` TIDAK didukung.
- **SELF_OPTION**: konstanta internal `"__self__"` menandakan user melihat model induk (bukan relasi spesifik).
- **Combined endpoint**: `model.selectData` — satu POST mengembalikan metadata kolom + data terpaginasi.
- **baseFilters (tree LinkModel, NON-EDITABLE)**: filter dari `from.filters`/`selects[].filters` — struktur rekursif `{ "column": value | { operator: value }, "and"|"or": {...}, "relation.col": {...} }` (sama yang dikonsumsi LinkModel `validate`/`validateWithOperators`). Dikirim sbg param `baseFilters` apa adanya. Backend memprosesnya via `LinkModelFilterConverter` → `FilterEvaluator` (operator penuh: komparasi date→in_period, morph, column-mode, formStatuses, between, !in, has/set; commit `b56801c`). **NON-EDITABLE**: tidak ditampilkan/di-load ke FilterBuilder.
- **filters (builder native)**: filter editable user dari `FilterBuilder` — format `{root:{k,o,v,c}}` (DataTable2). Dikirim sbg param `filters` apa adanya; backend memproses via `FilterEvaluator::apply` langsung (tanpa konversi).
- **FilterBuilder**: komponen reusable (`Filter/FilterBuilder.jsx`) untuk membangun filter ad-hoc di dialog; `value` = filter user-only (`{root:{k,o,v,c}}`). Output dikirim apa adanya sbg `filters` — TIDAK digabung dgn `from.filters` di FE (backend yang meng-AND).
- **SavedFilter (opsional)**: row DB (`saved_filters`) `{ model, filter, is_saved }`, dirujuk `fid`. Dipakai HANYA bila user memilih saved filter — bukan jalur default.
- **fid**: ID SavedFilter; dikirim HANYA saat user pakai saved filter. Macro `dataTable` me-resolve via `FilterEvaluator`.
- **columnAlias**: mapping nama kolom hasil (mis. `{ quantity: "remaining_quantity" }`) — dipetakan ke record sebelum dikirim ke `onSelected`.
- **loadFromModel**: helper async memuat data dari model by-ID (deep-link `loadFrom`), tanpa dialog. Return diselaraskan dengan `onSelected`.

## Requirements

### Requirement 1: Combined Backend Endpoint `model.selectData`

**User Story:** Sebagai developer, saya ingin satu POST endpoint yang mengembalikan metadata kolom dan data terpaginasi sekaligus, agar dialog memuat dengan satu round-trip.

#### Acceptance Criteria

1. THE endpoint SHALL tersedia sebagai `POST /model/select-data` dengan name route `model.selectData`, middleware `auth`.
2. THE endpoint SHALL menerima body: `model` (string class Eloquent, wajib), `select` (string|null nama relasi), `columns` (array|null nama kolom), `baseFilters` (object|null **tree LinkModel** dari `from`, NON-EDITABLE — R8), `filters` (object|null **`{root:{k,o,v,c}}` builder native** — R8), `fid` (string|null id SavedFilter, HANYA saat saved filter — R8), `sort` (string|null, default `"-created_at"`), `page` (int|null, default 1), `show` (int|null, default preference `num_per_page`), `with` (array|null relasi eager-load).
3. WHEN `select` null/absen, THE endpoint SHALL mengembalikan kolom & data dari model induk (`model`), meng-eager-load relasi yang diminta via `with`.
4. WHEN `select` adalah nama relasi valid, THE endpoint SHALL me-resolve model terkait (`get_class($relation->getRelated())`) dan mengembalikan kolom & data terpaginasi dari model terkait, dengan relasi balik parent ter-load (Requirement 9).
5. THE response SHALL `{ model, route, translateKey, columns, parentColumn, data }` di mana `data` = hasil `paginate(show)` (`{ data, current_page, last_page, per_page, total }`).
6. THE `translateKey` SHALL dari `$translateKey` model efektif (model relasi jika `select` di-set), fallback `null`.
7. THE endpoint SHALL menerapkan filter via tiga jalur (Requirement 8/11), semua di-AND: `baseFilters` (tree LinkModel) via `LinkModelFilterConverter`→`FilterEvaluator`; `filters` (`{root:{k,o,v,c}}` native) via `FilterEvaluator` langsung; `fid` (saved filter) via `FilterEvaluator`. THE endpoint SHALL TIDAK menerima format `[col,op,val]`.
8. THE endpoint SHALL menerapkan submitable scope: jika model `isSubmitable()`, hanya record `submitted_at` not null ATAU `created_by_id == user.id`.
9. THE endpoint SHALL memanfaatkan macro `Model::dataTable()` untuk sort/paginate/submitable/adaptive-select, bukan menulis query manual (Requirement 11).
10. WHEN model class invalid, THE endpoint SHALL HTTP 422. WHEN `select` merujuk relasi yang tidak ada, THE endpoint SHALL HTTP 422.

### Requirement 2: Standardized & Simplified `from` Prop

**User Story:** Sebagai developer pemakai SelectModel, saya ingin antarmuka prop konsisten lintas halaman, tanpa bug senyap dari penamaan `select` vs `selects`.

#### Acceptance Criteria

1. THE `from` prop SHALL menerima string (single model class) ATAU objek (multi-model config).
2. WHEN `from` objek, tiap key SHALL model class string dan tiap value SHALL objek shape:
   ```
   {
     columns?: string[],            // kolom default visible model induk
     filters?: FilterTree,          // filter default model induk (format filter-tree, lihat R8)
     selects?: {                    // konfigurasi ekstraksi relasi
       [relationName]: {
         filters?: FilterTree,      // filter default relasi
         columns?: string[],        // kolom default relasi
       }
     },
     columnAlias?: { [target]: string },  // alias kolom hasil sebelum onSelected
   }
   ```
3. THE component SHALL HANYA mengenali `selects` (plural). `select` (singular) TIDAK didukung; pemakaiannya SHALL memunculkan warning di console (dev mode).
4. THE component SHALL menormalkan `from` string → `{ [modelClass]: {} }`.
5. THE struktur `from` BOLEH disederhanakan (mis. flatten key yang redundant) ASALKAN setiap fungsi properti (`columns`, `filters`, `selects`, `columnAlias`) tetap tersedia.
6. ALL tiga konsumen (PurchaseOrders/Form, PurchaseRequests/Form, SalesOrders/Form) SHALL di-migrasi ke kontrak `from` final.

> **Catatan format `filters`:** nilai `filters`/`selects[].filters` di `from` SHALL berupa **tree LinkModel** (`{ status: "submitted" }`, `{ required_quantity: { ">": 0 } }`, `{ submitted_at: { not: null } }`, `{ or: {...} }`) — sama dengan format filter yang dipakai LinkModel. Format ini **NON-EDITABLE** & TIDAK perlu dikonversi; dikirim apa adanya via param `baseFilters` ke `model.selectData`. JsDoc grammar lengkap di design §3.3 (R8.8).

### Requirement 3: Dual Selection Modes (SELF Extraction + Per-Item)

**User Story:** Sebagai user yang mengimpor item, saya ingin bisa memilih record induk lalu mengekstrak semua child item-nya, ATAU mencentang item spesifik lintas induk.

#### Acceptance Criteria

1. WHEN `selects` tidak ada/kosong pada model aktif, THE component SHALL menampilkan data model induk; mode = **direct selection** (output = row induk terpilih).
2. WHEN `selects` punya ≥1 entri, THE component SHALL menampilkan dropdown "View": opsi SELF (`SELF_OPTION`) + tiap nama relasi di `selects`.
3. WHEN user memilih SELF, THE component SHALL menampilkan data model induk (eager-load relasi `selects`); saat konfirmasi SHALL mengekstrak child items relasi pertama via `selectedRows.flatMap(row => row[relationName] ?? [])` (BUKAN `reduce`).
4. WHEN user memilih relasi (per-item mode), THE component SHALL menampilkan data terpaginasi dari **model relasi** (di-flatten lintas parent), tiap row membawa kolom parent (Requirement 9); saat konfirmasi SHALL mengirim **row relasi yang dicentang apa adanya** (item spesifik lintas parent).
5. THE per-item mode SHALL mendukung seleksi lintas-halaman/lintas-parent (item A di WO1 + item B di WO2 dalam satu konfirmasi).

### Requirement 4: Pagination, Show, Filter UI Eksplisit di Dialog

**User Story:** Sebagai user memilih dari dataset besar, saya ingin kontrol pagination, per-page, dan filter terlihat jelas di dialog.

#### Acceptance Criteria

1. THE dialog SHALL menampilkan kontrol di bawah tabel: per-page selector (opsi mengikuti `DataTable2`), navigasi halaman (komponen `Pagination`), dan total record.
2. THE per-page selector SHALL default ke preference `num_per_page` (atau 25).
3. WHEN user mengubah per-page, THE component SHALL reset ke page 1 lalu reload.
4. WHEN user pindah halaman, THE component SHALL reload dengan `page` baru.
5. THE dialog SHALL menampilkan UI filter memakai komponen reusable `FilterBuilder` (`@/Components/Table/Filter/FilterBuilder`) — bukan `FilterItem` lama.
6. THE `Table2` di dalam dialog SHALL menerima `persistColumns={false}` + `isDynamicData={true}` agar perubahan kolom dialog tidak menyentuh cookie halaman utama.

### Requirement 5: Structured `onSelected` Callback (Breaking)

**User Story:** Sebagai developer, saya ingin callback menerima data terstruktur yang rapi & mudah dimengerti, tanpa menebak model atau sumbernya.

#### Acceptance Criteria

1. THE `onSelected` callback SHALL dipanggil dengan satu argumen objek tunggal yang rapi:
   ```
   onSelected({
     items,        // array record hasil (sudah ter-alias)
     model,        // class model record di `items`
     mode,         // "direct" | "self-extraction" | "per-item"
     sourceModel,  // class model induk (null di direct mode)
     sourceIds,    // array ID row induk terpilih (null di direct/per-item)
   })
   ```
2. `items` SHALL berisi record final setelah `columnAlias` diterapkan.
3. `model` SHALL class model dari record di `items` (model relasi pada self-extraction/per-item; model induk pada direct).
4. `sourceModel` & `sourceIds` SHALL terisi HANYA pada self-extraction mode; `null` selainnya.
5. WHEN `columnAlias` di-set, THE alias SHALL diterapkan ke tiap record sebelum callback.
6. WHEN tidak ada row dipilih, THE component SHALL TIDAK memanggil `onSelected`.
7. THE footer button SHALL menampilkan jumlah row terpilih (mis. "Select (3)").

> **Migrasi konsumen:** ketiga `mergeItems` SHALL diubah menerima objek tunggal `({ items, model, ... })`. Argumen kedua lama (`model` posisional) dihapus.

### Requirement 6: `loadFromModel` Helper Diselaraskan

**User Story:** Sebagai developer yang memakai `loadFromModel` untuk deep-link import (tanpa dialog), saya ingin payload return-nya selaras dengan `onSelected` agar bisa diteruskan ke `mergeItems` yang sama.

#### Acceptance Criteria

1. THE `loadFromModel` SHALL memuat data by-ID dari model (opsional relasi `select`), tanpa membuka dialog.
2. THE `loadFromModel` SHALL mengembalikan objek selaras `onSelected`:
   ```
   { items, model, mode, sourceModel, sourceIds }
   ```
   sehingga konsumen dapat memanggil `mergeItems(result)` langsung.
3. THE `loadFromModel` SHALL memakai i18n untuk error: `gooeyToast.error(t("core.errors.fetch_failed"))`.
4. THE `loadFromModel` SHALL menerima `t` (fungsi translate) sebagai parameter (required).
5. WHEN gagal, THE `loadFromModel` SHALL return `null` (konsumen guard sebelum `mergeItems`).
6. THE endpoint yang dipakai `loadFromModel` SHALL ditentukan di design (boleh `model.selectData` atau tetap `model.datatable`), ASAL kontrak return §6.2 terpenuhi.

### Requirement 7: Model Source Selection UX (via `Select.jsx`)

**User Story:** Sebagai user, saya ingin memilih model sumber lewat selektor sederhana.

#### Acceptance Criteria

1. WHEN `from` berisi >1 model, THE dialog SHALL menampilkan dropdown sumber memakai `@/Components/Select.jsx`, label dari `translateKey` model (fallback nama class sederhana).
2. WHEN `from` berisi 1 model, THE dropdown sumber SHALL disembunyikan (model otomatis terpilih).
3. THE dropdown model SHALL TIDAK memakai `PermissionLinkModel`.
4. WHEN user ganti model sumber, THE component SHALL reset view ke SELF, mengosongkan filter user, reset page 1, lalu reload.
5. THE component SHALL memuat data otomatis saat dialog dibuka (model pertama di `from` otomatis terpilih).

### Requirement 8: Filter — Tiga Jalur (baseFilters NON-EDITABLE + FilterBuilder native + SavedFilter via `fid`)

**User Story:** Sebagai user, saya ingin memfilter record di dialog memakai filter builder yang sama dengan tabel utama; filter default `from` selalu berlaku (non-editable), filter ad-hoc saya berlaku di atasnya, dan saya boleh memakai saved filter bila ada.

> **Keputusan user:** filter di dialog memakai **tiga jalur** (semua di-AND di backend), tiap kanal pakai format nativnya (NOL konversi FE):
> - **`baseFilters` (NON-EDITABLE):** filter dari `from.filters`/`selects[].filters` (tree LinkModel) dikirim apa adanya sbg param `baseFilters`. **TIDAK ditampilkan/di-load ke FilterBuilder.** Backend proses via `LinkModelFilterConverter`→`FilterEvaluator`.
> - **`filters` (FilterBuilder, editable):** output `FilterBuilder` (`{root:{k,o,v,c}}` native) dikirim apa adanya sbg param `filters`. Backend proses via `FilterEvaluator::apply` langsung. TIDAK di-persist sebagai SavedFilter.
> - **`fid` (SavedFilter):** HANYA bila user memilih saved filter — di-resolve macro `dataTable` via `FilterEvaluator`.

#### Acceptance Criteria

1. THE filter default dari `from` (`filters` untuk SELF, `selects[rel].filters` untuk relasi) SHALL berupa **tree LinkModel** (`{ column: value | { operator: value }, "and"|"or": {...} }` — design §3) dan dikirim apa adanya via param `baseFilters` ke `model.selectData`.
2. THE `from.filters`/`baseFilters` SHALL **NON-EDITABLE**: TIDAK ditampilkan & TIDAK di-load ke `FilterBuilder` `value`.
3. THE dialog SHALL membangun filter ad-hoc user memakai `FilterBuilder` (`@/Components/Table/Filter/FilterBuilder`); output `{root:{k,o,v,c}}` native dikirim **apa adanya** via param `filters` (tanpa konversi, tanpa digabung `from.filters` di FE).
4. WHEN user memilih **saved filter**, THE component SHALL mengirim `fid` ke `model.selectData`. `fid` dipakai HANYA pada kasus ini.
5. THE backend SHALL menerapkan, semua di-AND: `baseFilters` via `LinkModelFilterConverter`→`FilterEvaluator`; `filters` via `FilterEvaluator::apply` langsung; `fid` via macro `dataTable` → `FilterEvaluator`.
6. THE operator `baseFilters` SHALL didukung penuh oleh converter→`FilterEvaluator`: `=`/`!=`/komparasi, `in`/`notIn`, `between`/`notBetween`, `like`/`notLike`, `jsonContains` (formStatuses), `column`, grup `and`/`or`, relasi dot/nested, serta komparasi date/datetime (otomatis jadi `in_period`), morph, column-mode.
7. THE dialog SHALL menyediakan tombol "Clear Filters" dan "Apply Filters".
8. THE prop `from.filters` SHALL didokumentasikan dengan JsDoc lengkap (grammar tree, operator, contoh, catatan NON-EDITABLE) — design §3.3.

### Requirement 9: Relasi Balik Parent (Per-Item Mode)

**User Story:** Sebagai user di per-item mode, saya ingin tiap item menampilkan dari dokumen induk mana asalnya.

#### Acceptance Criteria

1. WHEN `select` di-set, THE endpoint SHALL membaca `<relatedModel>::$parentRelation` (mis. `workOrder`) untuk mengetahui relasi balik ke induk.
2. THE endpoint SHALL meng-eager-load relasi parent di data items (`with: [$parentRelation]`).
3. THE endpoint SHALL "un-ignore" kolom parent secara kondisional di `columns` (set `show=true`) walau di `configColumns` item model relasi parent ber-`ignore: true`, dan mengembalikan nama kolomnya di `parentColumn`.
4. WHEN model relasi tidak punya `$parentRelation`, THE per-item mode SHALL tetap berjalan tanpa kolom parent (degradasi anggun); `parentColumn` = `null`.
5. THE component SHALL menampilkan kolom `parentColumn` di tabel saat per-item mode.

### Requirement 10: Error Handling & Edge Cases

#### Acceptance Criteria

1. WHEN endpoint error, THE component SHALL toast `gooeyToast.error(t("core.errors.fetch_failed"))`.
2. WHEN data kosong (`total = 0`), THE Table2 SHALL menampilkan "no data" standar.
3. WHEN dialog ditutup / model / view berubah sebelum data selesai, THE component SHALL membatalkan request berjalan (AbortController).
4. WHEN model class invalid, THE endpoint SHALL HTTP 422.
5. WHEN `select` merujuk relasi tidak ada, THE endpoint SHALL HTTP 422.
6. WHEN endpoint mengembalikan 422 (filter tree invalid), THE component SHALL toast error dan TIDAK meng-update data.

### Requirement 11: Backend Query — Macro `dataTable` + Filter Tiga Jalur

**User Story:** Sebagai maintainer, saya ingin endpoint memakai mesin query yang sudah ada, dan filter mengikuti tiga jalur (`baseFilters` + `filters` + `fid`), semua di-AND, lewat `FilterEvaluator`.

#### Acceptance Criteria

1. THE `model.selectData` SHALL memanggil macro `Model::dataTable($request, $showedColumns)` untuk sort/paginate/adaptive-select/submitable.
2. WHEN `baseFilters` (tree LinkModel) dikirim, THE endpoint SHALL menerapkannya via `LinkModelFilterConverter::toTree` → `FilterEvaluator::apply` (reuse mekanisme `ModelController::applyLinkModelFilters`, commit `b56801c`). `filterToQuery` lama TIDAK dipakai.
3. WHEN `filters` (`{root:{k,o,v,c}}` builder native) dikirim, THE endpoint SHALL menerapkannya via `FilterEvaluator::apply` LANGSUNG (tanpa konversi).
4. WHEN `fid` dikirim, THE filter SHALL di-resolve macro `dataTable` (`SavedFilter::find` → `FilterEvaluator`). `fid` HANYA dipakai bila user memilih saved filter.
5. WHEN dua/lebih jalur (`baseFilters`, `filters`, `fid`) ada, THE endpoint SHALL menggabungkan semuanya dengan AND.
6. WHEN macro `dataTable` membaca cookie kolom per-path, THE endpoint SHALL meneruskan `showedColumns` di body sebagai sumber visibilitas (jangan bergantung cookie halaman induk).

> **Catatan integrasi:** `selectData` membangun query `$target` (atau `$parent`), menerapkan `baseFilters` (converter→FilterEvaluator) + `filters` (FilterEvaluator langsung) — keduanya `where(closure)` sehingga AND otomatis — lalu mendelegasikan `fid`/sort/paginate/submitable ke macro `dataTable`. Detail di design §4.2.

### Requirement 12: Dead Code Removal & Cleanup

#### Acceptance Criteria

1. THE parameter `configModel` SHALL TIDAK lagi dikirim ke backend.
2. THE import `PermissionLinkModel` SHALL dihapus dari SelectModel.
3. THE import `QueryString` (`qs`) SHALL dihapus dari SelectModel (kecuali masih diperlukan untuk serialisasi — putuskan di design).
4. THE route `model.columns` SHALL tetap ada (dipakai di tempat lain) TAPI SelectModel TIDAK lagi memanggilnya.
5. THE seluruh `console.log` (`SelectModel.jsx:198,600`, dan di `loadFromModel`) SHALL dihapus.
6. THE blok komentar mati (`useDidMountEffect` `:241-243`) & state sort verbose SHALL dirapikan.
7. THE komponen SHALL turun ke target ~250 baris (dari 608).

## Non-Functional Requirements

- **No regresi:** ketiga konsumen impor item end-to-end tetap berfungsi setelah migrasi.
- **Reuse maksimal:** `FilterBuilder`/`useNestedFilters`, `Pagination`, `Select`, `Table2`, macro `dataTable`, `FilterEvaluator`, `SavedFilter`, `getColumns`, `DataTableColumnSelector` — tidak ditulis ulang.
- **Fetch deterministik:** AbortController membatalkan respons basi; tidak ada `setTimeout` sebagai penambal race.

## Out of Scope

- Mengubah engine `Table2`, `FilterEvaluator`, atau skema `saved_filters`.
- Menyimpan filter sebagai named filter dengan UI khusus (opsional; minimal cukup ephemeral).
- Menambah model sumber baru di luar yang sudah dipakai.
- Mengubah skema DB (kecuali bila terbukti relasi balik item-ke-parent belum ada — sudah diverifikasi ADA via `$parentRelation`).

## Asumsi Terverifikasi (anti-halusinasi)

- **TV1:** `FilterBuilder` (`Filter/FilterBuilder.jsx`) sudah reusable untuk SelectModel (docstring eksplisit: "dapat dipakai ulang (mis. SelectModel) hanya dengan controlled props"). Kontrak: `columns`, `value` (tree), `onChange`.
- **TV2:** Ada DUA format filter tree di codebase, keduanya bermuara ke `FilterEvaluator` (commit `b56801c`): (a) **tree LinkModel** (`{ col: val | {op:val}, or:{...} }`) dikonsumsi `validate`/`validateWithOperators` (`resources/js/lib/linkModelUtils.js:3,183`) di FE; di BE dikonversi `LinkModelFilterConverter`→`FilterEvaluator` (`app/Services/Core/LinkModelFilterConverter.php`) — INI yang dipakai `from.filters` (param `baseFilters`, NON-EDITABLE); (b) filter-tree DataTable2 (`{root:{k,o,v,c}}`) → `FilterEvaluator` langsung — dipakai output `FilterBuilder` (param `filters`) DAN saved filter (`fid`). `filterToQuery`/`filterOperator` lama hanya tersisa utk jalur `JoinClause`. Helper FE `linkModelToFilterTree.js` mirror konversi. Keputusan user: tiga jalur (baseFilters + filters + fid), semua AND.
- **TV3:** `WorkOrderItem::$parentRelation = 'workOrder'`, `PurchaseRequestItem::$parentRelation = 'purchaseRequest'` — relasi balik ADA, tapi di `configColumns` ber-`ignore: true`.
- **TV4:** Field quantity berbeda antar konsumen — SO `mergeItems` baca `item.remaining_quantity`, PO baca `item.unordered_quantity`. Inilah alasan `columnAlias` per-pemakaian; tetap di `from`.
- **TV5:** `Select.jsx` kontrak: `value`, `onValueChange`, `options` (array string|number|`{value,label,titleTrans}`), `placeholder`, `optionTrans`, `required`, `disabled`.
- **TV6:** `Pagination.jsx` kontrak: `currentPage` (1-indexed), `totalPages`, `onPageChanged(page)`.
