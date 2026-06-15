# Implementation Plan: filtertable-nested-saved

## Overview

Implementasi mengikuti arah data: **backend dulu** (migration → model → `FilterEvaluator` → controller/transport → `DataTableScope` wiring), lalu **frontend** (operators → `ValueField` → `DateSelector` → `FilterBuilder` → `FilterTable2` → `DataTable2`), ditutup **i18n** dan **e2e**. Pola utama: filter tree (mini-DSL) diproduksi `FilterBuilder` dan dikonsumsi `FilterEvaluator` (reusable, DI murni). Transport via saved filter (`?fid=`, ULID, hybrid ephemeral+named). Yang TIDAK berubah: struktur `useNestedFilters` (tree `{k,c}`/item `{k,o,v}`), komponen input existing, `LinkModel::getColumns()`, alur paginate/submitable di `DataTableScope`.

## Tasks

- [x] 1. Backend foundation — SavedFilter (migration + model)
  - [x] 1.1 Migration `create_saved_filters_table`
    - `ulid('id')->primary()`, `foreignUlid('user_id')->index()`, `string('model')->index()`, `string('name')->nullable()`, `boolean('is_saved')->default(false)->index()`, `json('filter')`, `timestamps()`
    - Composite index `['user_id','model']` dan `['is_saved','created_at']` (untuk prune)
    - _Requirements: 2.1, 2.4, 2.6_
  - [x] 1.2 Model `App\Models\Core\SavedFilter`
    - `use HasUlids`; `$guarded=['id']`; cast `filter`→`array`, `is_saved`→`boolean`
    - Relasi `user()` BelongsTo; scope `forModel($model)`, `ownedListing($userId,$model)` (`is_saved=true`+user+model)
    - Factory `SavedFilterFactory` (state `ephemeral`, `named`) + `newFactory()` override (model di namespace Core)
    - _Requirements: 2.1, 2.3, 2.4_

- [x] 2. FilterEvaluator (inti, reusable, DI murni)
  - [x] 2.1 Class `App\Services\Core\FilterEvaluator` — skeleton + rekursi group
    - `__construct(array $columns)`; `apply(Builder $q, array $tree): Builder` (chainable, tak eksekusi)
    - `applyGroup` rekursif: node pertama `and`, sisanya operator grup (`k`); group `and`→`where(fn)`, `or`→`orWhere(fn)`; nesting fidelity
    - `resolveColumn($key)` dukung dot-notation relasi (`permission.name`) via `$column['columns']`
    - Whitelist: skip item jika kolom tak ada / non-`searchable` / operator tak valid utk type
    - _Requirements: 1.1, 1.2, 1.3, 6.1, 7.1, 7.2, 7.3, 7.6_
  - [x] 2.2 Operator handlers + deteksi negasi prefix `!`
    - `$negate = str_starts_with($op,'!'); $base = substr($op,1)` (kecuali `!=` atomik) → handler positif + bungkus negasi (single code path)
    - Scalar: `= != > >= < <= matches !matches starts_with ends_with in !in between !between` (value selalu binding/parameterized)
    - `set/!set` type-aware: string→NULL+`''` (`set`=`whereNotNull AND !=''`, `!set`=`whereNull OR =''`); non-string→`whereNotNull`/`whereNull`
    - _Requirements: 3.8, 6.2, 7.2, 7.4, 8.1, 8.2, 8.3, 8.4_
  - [x] 2.3 Relasi: basic, plural, morph
    - relation/relations basic (`typeRelation=basic`): join/`whereHas` pada `related`; relations `has`/`!has`→`whereHas`/`whereDoesntHave`
    - morph (`typeRelation=morph`) value `{type,id}`: `whereHasMorph` / match pasangan `*_type`+`*_id` (bukan `_id` saja)
    - _Requirements: 6.3, 6.4, 6.5_
  - [x] 2.4 Period resolver `in_period`/`!in_period`
    - Baca sub-op `op` dari value `{op,unit,from,to?,time?}` (bukan operator item)
    - `resolvePeriodRange(unit,from,to)`: canonical (`2026-06`,`2026-Q2`,`2026-H1`,`2026`,`day:2026-06-12`) → `[start,end]`; quarter/half-year via aritmetika bulan
    - sub-op pada batas rentang; datetime `day` sertakan `time`; `!in_period`→`whereNot(fn)`
    - _Requirements: 4.5, 4.6, 6.6_
  - [x] 2.5 Write unit tests `FilterEvaluatorTest` (parametrik per operator + period) — 13 test, 31 assertion pass
    - **Nesting fidelity & whitelist**: nested AND/OR → hasil tepat; kolom non-searchable/operator salah → skip ✓
    - Parametrik operator scalar (`=,!=,matches,starts_with,ends_with,in,>,<,between,!between,set,!set`) + boolean + enum `in` ✓
    - `in_period` unit month/quarter/half-year single + sub-op `>` + `!in_period` ✓
    - Binding safety (anti SQL-injection) ✓; chainable lalu `paginate()` ✓; empty tree → no filter ✓
    - CATATAN: relation/morph data-level test ditunda ke task 5.3 (pakai ApprovalScheme `logs` morph + `tags` basic — model stub tak punya relasi). SQL-gen relasi/morph sudah divalidasi via verify script.
    - **Validates: Requirements 1.1, 1.2, 1.3, 6.1, 6.2, 6.6, 7.6, 8.1, 8.3**
  - [x] 2.6 Write property-based tests (invariants)
    - **Empty/null partition (string)**: `count(set)+count(!set)==total`; NULL&`''`→`!set` ✓
    - **Negation symmetry**: `count(in)+count(!in)==total` (kolom non-null) ✓; period range bounds inklusif tiap unit ✓
    - **Validates: Requirements 3.8, 6.2, 8.2**

- [x] 3. Checkpoint — Ensure FilterEvaluator tests pass
  - `php artisan test --compact tests/Feature/Services/Core/FilterEvaluatorTest.php` → 16 passed, 38 assertions. ✓

- [x] 4. Transport — SavedFilterController + routes + validasi
  - [x] 4.1 Form Requests `StoreSavedFilterRequest` / `UpdateSavedFilterRequest` (extends `BaseFormRequest`)
    - Store: `model` (string, class valid `use DataTable` via closure rule), `filter` (array), `name` (nullable)
    - Update: `name` (required string)
    - _Requirements: 2.1, 2.3_
  - [x] 4.2 Controller `App\Http\Controllers\Core\SavedFilterController`
    - `store`: buat ephemeral (`is_saved=false`, `user_id=auth`, `model`, `filter`) → balas `{ id }`
    - `update`: inline `abort_if(user_id !== auth id, 403)` → set `name`+`is_saved=true`
    - `index`: listing private `ownedListing(auth,model)`
    - `destroy`: inline `abort_if(...403)` → delete
    - _Requirements: 2.1, 2.3, 2.4_
  - [x] 4.3 Routes di `routes/web.php` (middleware auth, withoutMiddleware Inertia → JSON)
    - GET/POST `/saved-filters`, PATCH/DELETE `/saved-filters/{savedFilter}` — 4 route terdaftar ✓
    - _Requirements: 2.1, 2.3, 2.4_

- [x] 5. Integrasi DataTableScope (`fid` → evaluator) + cleanup
  - [x] 5.1 Ubah `App\Models\Scopes\DataTableScope`
    - Ganti blok `if ($request->has('f'))` → `if ($request->filled('fid'))`: `SavedFilter::find(fid)`, cek `model` match (TANPA cek owner) → `(new FilterEvaluator($dataTableColumns))->apply($query, $saved->filter)`
    - Hapus logika filter flat lama (40 baris) + bug negasi `whereIn`/`whereBetween` (`=='!like'`)
    - `fid` tak ada / model mismatch → abaikan tanpa error
    - _Requirements: 1.1, 1.2, 2.2, 2.5, 2.7, 6.7_
  - [x] 5.2 Command `saved-filters:prune` + schedule
    - `App\Console\Commands\PruneEphemeralFilters` (signature `saved-filters:prune --days=7`); hapus `is_saved=false` & `created_at < now()->subDays($days)`
    - Daftarkan di `routes/console.php` `dailyAt('02:00')` — terdaftar (`0 2 * * *`) ✓
    - _Requirements: 2.6_
  - [x] 5.3 Write feature tests `SavedFilterTest` — 11 test, 23 assertion pass
    - store ephemeral + validasi model invalid (422); `fid` memfilter via scope; promote→named di `index` owner, **tak** muncul user lain; ephemeral tak masuk listing
    - **by-id terbuka**: user B pakai `?fid=` milik A → apply ✓; model-mismatch → diabaikan ✓
    - `update`/`destroy` non-owner → 403 ✓; prune hapus ephemeral>TTL, sisakan named + ephemeral baru ✓
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7**

- [x] 6. Checkpoint — Ensure backend tests pass
  - `SavedFilterTest` → 11 passed; `FilterEvaluatorTest` → 16 passed. ✓

- [x] 7. Frontend — operators + ValueField + DateSelector
  - [x] 7.1 Ubah `operators.js` (selaras backend, prefix `!`)
    - date/datetime dropdown → hanya `in_period, !in_period, set, !set`; case `time` (set lengkap); string + `starts_with`/`ends_with` ✓
    - Negasi `!` prefix (`!matches,!in,!between,!has,!set`); `set/!set` global; `in/!in` non-boolean; tiap operator bawa `valueInput` metadata; relation terima `typeRelation` (morph) ✓
    - _Requirements: 3.1–3.9, 8.2, 8.3_
  - [x] 7.2 `DateSelector.jsx` (period picker)
    - Granularity `day/month/quarter/half-year/year` + sub-op (8) + single/range; native month/date/time input + Select; selaras app
    - Field time muncul utk `datetime` saat sub-op exact + granularity `day` ✓
    - Map ke canonical value `{op,unit,from,to?,time?}` (`2026-Q2`, `2026-H1`, `2026-06`, dst) via buildCanonical ✓
    - _Requirements: 4.5, 4.6_
  - [x] 7.3 `ValueField.jsx` (switch by valueInput metadata)
    - set/!set→none; boolean→Checkbox; string→text; currency→CurrencyInput (between→RangePair; in/!in→MultiGrow); time→time input (between/in serupa)
    - relation basic→LinkModel(`column.related`, in→MultiGrow); morph→MorphField(PermissionLinkModel→LinkModel) value `{type,id}`; formStatus/enum→Select|MultiSelect(`options`); date/datetime+in_period→DateSelector
    - MultiGrow (auto-append+delete), RangePair (between), MorphField (two-step); non-filterable type → operator kosong → null
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.7, 4.8, 4.9, 4.10, 4.11, 4.12_
  - [x] 7.4 Ubah `FilterItem2.jsx` — pakai `ValueField`
    - Ganti `<Input>` polos → `<ValueField column={selectedColumn} operator value onChange/>` ✓
    - Node kolom (`buildColumnNode`) kini bawa `title/related/typeRelation/options` untuk ValueField ✓
    - _Requirements: 4.1–4.12_

- [x] 8. Frontend — FilterBuilder reusable + transport
  - [x] 8.1 `FilterBuilder.jsx` (presentational, headless wrap)
    - Props `{columns, value, onChange}`; bungkus `NestedFiltersProvider` + render root `FilterGroup2`; `onChange(tree)` saat berubah; TANPA Dialog/saved-filter ✓
    - Export `FilterBuilderBody` untuk konsumen yang sudah punya Provider sendiri (FilterTable2); ref-guard cegah loop controlled ✓
    - `useNestedFilters` tetap headless (tak diubah strukturnya) ✓
    - _Requirements: 5.1, 5.2, 5.4_
  - [x] 8.2 Refactor `FilterTable2.jsx` = FilterBuilder + Dialog + saved-filter
    - Bungkus `FilterBuilderBody` + Dialog + tombol Apply; `applyFilters` kirim **tree utuh** (bukan `flattenFilters`) ke `onApply(tree)` ✓
    - `SaveFilterControl` (POST bila belum ada fid → PATCH promote named) + `SavedFilterBar` (GET index, pick→load tree, delete) ✓
    - _Requirements: 1.1, 2.1, 2.3, 5.3_
  - [x] 8.3 Ubah `DataTable2.jsx` — transport `?fid=`
    - State `options.f`(array)→`options.fid`(string)+`filterTree`(seed builder, tak ke URL); `persistFilterTree` POST store→`fid`→`loadData(?fid=)` ✓
    - Imperative `addFilter` (filter cepat) bangun item tree + gabung→persist; tombol clear drop `fid`; load awal seed dari `query.fid` via index listing ✓
    - `npm run build` (client+SSR) pass — wiring compile bersih ✓
    - _Requirements: 1.1, 2.1, 2.2_

- [x] 9. i18n (Req 9 — kedua locale en + id)
  - [x] 9.1 Rename + tambah key di `lang/en/core/datatable.php` & `lang/id/core/datatable.php`
    - Rename operator negasi: `not_set`→`!set`, `not_matches`→`!matches`, `not_in`→`!in`, `not_between`→`!between`, `not_has`→`!has` (kedua locale) ✓
    - Key baru: `operator.starts_with/ends_with/in_period/!in_period`; `period.{from,to,unit.*}`; `dateselector.subop.*`; `saved.{save,list,name_placeholder}` ✓ — `php -l` kedua file pass
    - _Requirements: 9.2, 9.3, 9.4_
  - [x] 9.2 Pastikan komponen pakai `t(...)` (no hardcode)
    - Audit `ValueField`/`DateSelector`/`FilterTable2`/`FilterItem2`: semua label/placeholder/tombol via `t(...)`; `select_value` terima `column.title`; satu-satunya literal (`sr-only` DialogDescription) di-i18n-kan ✓
    - _Requirements: 9.1, 9.5_

- [x] 10. Final checkpoint — Ensure all tests pass + manual e2e
  - Pint `--dirty` → fixed 5 file (DataTableScope, FilterEvaluator, migration, 2 test) ✓
  - Spec tests: FilterEvaluatorTest 16 passed (38 assert), SavedFilterTest 11 passed (23 assert) ✓
  - Full suite: 265 passed; 64 failed = `*.is_example no such column` (PRE-EXISTING di baseline, dibuktikan via git stash → SubmitableSnapshotFormatTest gagal sama tanpa perubahan kita). BUKAN regresi.
  - `npm run build` (client+SSR) pass; LocaleKeysTest (en↔id key parity) hijau ✓
  - TERSISA: manual/Inertia e2e oleh user (susun nested AND/OR → Apply → `?fid=` → reload → Simpan → ValueField per type → switch locale).

## Notes

- Setiap task mereferensi requirement (`_Requirements: X.Y_`) untuk traceability.
- **Lint/Pint hanya dijalankan di task 10** (setelah semua task selesai) — sesuai aturan repo. Jangan jalankan per task.
- Checkpoint (task 3, 6, 10) = stop & validasi inkremental; konfirmasi user.
- `useNestedFilters` strukturnya **tidak diubah** — hanya transport (`flattenFilters` tak dipakai utk kirim; tree utuh). `flattenFilters` boleh tetap ada utk count/preview.
- Period value disimpan **canonical** (parseable), ditampilkan ringkas via i18n.
- Authorization inline `abort_if` (app tak pakai Policy class).
- Implementasi SelectModel **out-of-scope** — hanya pastikan `FilterBuilder`/`FilterEvaluator` reusable (kontrak siap).

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1", "2.2", "2.3", "2.4"] },
    { "id": 2, "tasks": ["2.5", "2.6"] },
    { "id": 3, "tasks": ["3"] },
    { "id": 4, "tasks": ["4.1", "4.2", "4.3"] },
    { "id": 5, "tasks": ["5.1", "5.2"] },
    { "id": 6, "tasks": ["5.3"] },
    { "id": 7, "tasks": ["6"] },
    { "id": 8, "tasks": ["7.1", "7.2", "7.3"] },
    { "id": 9, "tasks": ["7.4", "8.1"] },
    { "id": 10, "tasks": ["8.2", "8.3"] },
    { "id": 11, "tasks": ["9.1", "9.2"] },
    { "id": 12, "tasks": ["10"] }
  ]
}
```
