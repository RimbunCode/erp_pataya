# Requirements Document

## Introduction

`ModelController::filterToQuery`/`filterOperator` adalah engine filter "tree LinkModel" yang dipakai endpoint
`model` (`__invoke`) oleh komponen LinkModel (dan rencananya SelectModel). Engine ini terbatas: hanya tahu
nama kolom dari `Schema::getColumnListing()`, tanpa metadata type/relasi, sehingga tidak punya kapabilitas
kaya milik `App\Services\Core\FilterEvaluator` — yang sudah matang & teruji dan dipakai DataTable2 untuk
period date/datetime, morph, column-comparison, formStatuses JSON-array, whitelist operator per-type, serta
nested whereHas multi-level.

Spec ini meng-upgrade jalur filter utama (pada Eloquent `Builder`) dengan **mengonversi** tree LinkModel ke
format FilterEvaluator `{root:{k,o,v,c}}` lalu **mendelegasikan** ke `FilterEvaluator::apply()` — satu sumber
kebenaran, seluruh kapabilitas FilterEvaluator didapat tanpa duplikasi logika. Disertai helper konversi
terpisah (PHP + JS, dua arah) yang reusable untuk SelectModel, dengan jaminan hasil konversi selalu renderable
di `FilterBuilder.jsx`, dan grammar terdokumentasi via PHPDoc/JSDoc.

## Glossary

- **Tree LinkModel**: format filter `{ key: value }` (gabung AND per-level), value scalar (= operator `=`),
  objek `{ <operator>: <value> }`, atau key boolean `and`/`or`/relasi. Dikonsumsi `filterToQuery` lama &
  `linkModelUtils.validate` (FE).
- **Tree FilterEvaluator / FilterBuilder**: format `{root:{k,o,v,c}}` — group `{k,c}` dan item `{k,o,v}`.
  Dikonsumsi `FilterEvaluator` (BE) & `useNestedFilters`/`FilterBuilder` (FE).
- **Converter**: helper yang mengubah tree LinkModel → tree FilterEvaluator (`LinkModelFilterConverter` PHP,
  `linkModelToFilterTree` JS).
- **Invarian renderability**: hasil konversi wajib hanya memakai operator yang ada di `getOperators(type)`
  (`operators.js`) untuk type kolomnya, sehingga selalu tampil benar di FilterBuilder.
- **Period (in_period)**: representasi filter date/datetime FilterEvaluator berbentuk DateSelector
  (`{period, operator, startDate?, endDate?, ...}`).
- **Metadata kolom**: hasil `Model::getColumns()` (type, `nameOfFunction`, `related`, `typeRelation`, `primaryKey`).

## Requirements

### Requirement 1: Konversi tree LinkModel → tree FilterEvaluator (PHP)

**User Story:** As a backend developer, I want a converter that transforms a LinkModel filter tree into the
FilterEvaluator `{root:{k,o,v,c}}` format, so that the existing, tested FilterEvaluator engine can be reused
without duplicating filter logic.

#### Acceptance Criteria

1. THE `LinkModelFilterConverter` SHALL menerima metadata kolom (`Model::getColumns()`) pada konstruktor.
2. THE `LinkModelFilterConverter::toTree` SHALL mengembalikan struktur `{ root: { k, c } }` valid bagi `FilterEvaluator::apply`.
3. WHEN value sebuah key berupa scalar, THE converter SHALL menghasilkan item `{ k:key, o:'=', v:value }`.
4. WHEN value berupa objek operator dengan lebih dari satu operator, THE converter SHALL membungkusnya dalam nested group `{ k:'and', c }` berisi satu item per operator.
5. WHEN key adalah `and` atau `or`, THE converter SHALL menghasilkan nested group dengan boolean tersebut secara rekursif.
6. THE converter SHALL memetakan operator LinkModel ke FilterEvaluator: `not`/`notEqual`→`!=`, `notIn`→`!in`, `notBetween`→`!between`, `like`→`matches`, `notLike`→`!matches`, `>`/`>=`/`<`/`<=`/`in`/`between`/`=` tetap.
7. WHERE deteksi relasi dibutuhkan, THE converter SHALL memakai `FilterColumnResolver` agar konsisten dengan FilterEvaluator.

### Requirement 2: Relasi (dot-notation & nested-object)

**User Story:** As a backend developer, I want relation filters expressed either as dot-notation or nested
objects to convert correctly, so that LinkModel's two relation syntaxes both produce valid whereHas queries.

#### Acceptance Criteria

1. WHEN key berupa dot-notation relasi (mis. `category.type`), THE converter SHALL meneruskannya sebagai `k` apa adanya agar FilterEvaluator membangun nested whereHas.
2. WHEN key adalah nama relasi dan value-nya sub-tree (mis. `customer: { type: {...} }`), THE converter SHALL mem-flatten ke dot-notation dengan prefiks `"<relasi>."` pada tiap key anak.
3. THE converter SHALL mendeteksi relasi via metadata kolom (`type ∈ {relation, relations}`).
4. WHEN key bertipe `relation`/`relations` dengan operator `=`/`in`, THE converter SHALL meneruskan value relasi by-id (`{id,...}`/list) apa adanya.

### Requirement 3: Kolom date/datetime dibungkus menjadi in_period

**User Story:** As a user filtering date columns, I want comparison operators on date/datetime to keep working,
so that date filters are neither silently dropped by the FilterEvaluator whitelist nor unrenderable in the UI.

#### Acceptance Criteria

1. WHEN kolom bertipe `date`/`datetime` dengan operator komparasi, THE converter SHALL menghasilkan item `in_period`/`!in_period` dengan value period berbentuk DateSelector (`{period:"day", operator, startDate, endDate?}`), BUKAN operator komparasi mentah.
2. THE converter SHALL memetakan: `>`→`after`, `>=`→`on-or-after`, `<`→`before`, `<=`→`on-or-before`, `=`/scalar→`is`, `not`→`!in_period`/`is`, `between`→`between`, `notBetween`→`!in_period`/`between`.
3. THE value period yang dihasilkan SHALL identik bentuknya dengan output `DateSelector.emit()` dan diterima `FilterEvaluator::applyPeriod`.
4. IF kolom date memakai operator tanpa padanan period bersih (mis. `in`/`notIn`), THEN THE converter SHALL men-skip item tersebut dan mencatat dev-note (tidak error).

### Requirement 4: Operator khusus & tak-dikenal

**User Story:** As a backend developer, I want special LinkModel operators handled or safely ignored, so that
no invalid operator ever reaches the query or the UI.

#### Acceptance Criteria

1. WHEN operator `jsonContains`/`jsonDoesntContains` dipakai pada kolom `formStatuses`, THE converter SHALL memetakannya ke `has`/`!has`.
2. IF `jsonContains`/`jsonDoesntContains` dipakai pada kolom non-`formStatuses`, THEN THE converter SHALL men-skip + dev-note.
3. WHEN operator `column` dipakai, THE converter SHALL menghasilkan column-mode `{ kind:'column', ref:<kolom> }` dengan operator yang sesuai.
4. WHEN key berupa `raw(...)`, THE converter SHALL men-skip (di luar grammar FilterEvaluator) + dev-note.
5. WHEN operator atau kolom tidak valid menurut whitelist FilterEvaluator, THE sistem SHALL men-skip item diam-diam tanpa melempar error.

### Requirement 5: Delegasi di ModelController dengan kompatibilitas mundur

**User Story:** As a maintainer, I want the main Builder filter path delegated to FilterEvaluator while the
JoinClause path keeps the old engine, so that the upgrade adds capability without breaking joins.

#### Acceptance Criteria

1. THE `ModelController` SHALL menyediakan `applyLinkModelFilters(Builder $query, array $filters)` yang mengambil `getColumns(1)`, mengonversi via `LinkModelFilterConverter`, lalu memanggil `FilterEvaluator::apply`.
2. WHEN filter utama diterapkan pada Eloquent `Builder` (`__invoke`), THE `ModelController` SHALL memakai `applyLinkModelFilters`.
3. THE `ModelController` SHALL mempertahankan `filterToQuery`/`filterOperator` lama untuk jalur `JoinClause` (ON-condition `join`).
4. THE jalur baru SHALL TIDAK meng-auto-collect relasi terfilter ke `$with`; eager-load relasi tetap dari `request->with` eksplisit.
5. WHEN tipe operator yang dahulu didukung dipakai (mis. `=`, `>`, `in`, `like`, grup `or`, relasi), THE hasil query SHALL setara dengan perilaku lama (tanpa regresi terlihat).

### Requirement 6: Helper konversi frontend (dua arah) & renderability

**User Story:** As a frontend developer, I want a JS converter mirroring the PHP one in both directions, so that
SelectModel can convert LinkModel filters to a FilterBuilder tree and back, always renderable.

#### Acceptance Criteria

1. THE `linkModelToFilterTree(linkFilters, columns)` SHALL mengembalikan tree `{root:{k,c:{<id>:{k,o,v}}}}` dengan id child auto-generate (`generateRandom`).
2. THE pemetaan operator/relasi/date di JS SHALL identik dengan helper PHP.
3. THE setiap item hasil konversi SHALL memakai operator yang ada di `getOperators(column.type, ...)`; IF tidak ada padanan, THEN item dipetakan ulang atau di-skip — TIDAK pernah menghasilkan operator di luar `getOperators`.
4. THE value relation/morph/multiselect SHALL diteruskan apa adanya (`{id,...}`/`{type,id}`/array) agar dipahami `ValueField`.
5. THE `filterTreeToLinkModel(tree, columns)` SHALL membalik konversi; round-trip `link → tree → link` SHALL setara untuk operator yang punya padanan dua arah.
6. WHEN hasil konversi dimuat ke `<FilterBuilder value={tree}>`, THE setiap item SHALL tampil benar (operator terpilih di dropdown, value field sesuai type).

### Requirement 7: Dokumentasi grammar (PHPDoc & JSDoc)

**User Story:** As a developer consuming the filter tree, I want the grammar documented inline, so that I can
author LinkModel filters correctly without reading the implementation.

#### Acceptance Criteria

1. THE `LinkModelFilterConverter` SHALL menyertakan PHPDoc/`@phpstan-type` yang mendeskripsikan grammar tree LinkModel dan output `{root:{k,o,v,c}}`, beserta daftar operator dan contoh.
2. THE `linkModelToFilterTree.js` SHALL menyertakan typedef `LinkModelFilterTree` dan `FilterBuilderTree`, JSDoc fungsi dengan `@param`/`@returns`/`@example`, dan `@see` ke `operators.js`, `FilterEvaluator.php`, `useNestedFilters.jsx`.
3. THE JSDoc SHALL mencatat invarian renderability (operator hasil selalu ∈ `getOperators(type)`).
4. THE dokumentasi grammar JSDoc SHALL selaras dengan `.kiro/specs/select-model-rewrite/design.md` §3.3.

### Requirement 8: Pengujian

**User Story:** As a maintainer, I want programmatic tests covering conversion behavior, so that operator
mappings and edge cases are proven and protected against regression.

#### Acceptance Criteria

1. THE test suite SHALL mencakup `tests/Feature/Services/Core/LinkModelFilterConverterTest.php` (pola `FilterEvaluatorTest.php`) yang menguji end-to-end (konversi → apply → assert row DB).
2. THE test SHALL mencakup tiap pemetaan operator (scalar, `not`, `notIn`, `notLike`, `notBetween`, `like`, komparasi, `between`, `in`), grup `or`/`and` bersarang, relasi dot & nested-object & by-id, formStatuses, column-mode, dan date→in_period (termasuk assert bentuk value period).
3. THE test SHALL membuktikan operator/kolom tak valid di-skip diam-diam (tidak error).
4. THE `FilterEvaluatorTest` yang ada SHALL tetap lulus (tidak tersentuh).
5. THE helper JS SHALL diverifikasi renderable di FilterBuilder untuk beragam type, dan round-trip arah-balik setara.
6. WHEN semua test hijau, THE perubahan SHALL lolos `vendor/bin/pint --dirty --format agent` dan eslint pada file JS baru.
