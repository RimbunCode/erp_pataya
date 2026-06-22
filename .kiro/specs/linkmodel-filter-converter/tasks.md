# Implementation Plan: LinkModel Filter Converter

## Overview

Buat helper `LinkModelFilterConverter` (PHP) yang mengonversi tree LinkModel → `{root:{k,o,v,c}}`, lalu arahkan
jalur filter `Builder` di `ModelController` ke `FilterEvaluator` via converter (jalur `JoinClause` tetap pakai
engine lama). Tambah mirror JS dua arah `linkModelToFilterTree`/`filterTreeToLinkModel` yang renderable di
`FilterBuilder`. TIDAK mengubah `FilterEvaluator`, `FilterColumnResolver`, `operators.js`, `useNestedFilters`.

## Tasks

- [x] 1. PHP — `LinkModelFilterConverter`
  - [x] 1.1 Buat class & konversi inti
    - Buat `app/Services/Core/LinkModelFilterConverter.php` (DI murni, terima `$columns` dari `getColumns()`)
    - `toTree(array $linkFilters, string $boolean='and'): array` → `{ root: { k, c } }`
    - Map per-level AND; scalar → item `{k,o:'=',v}`; objek operator (>1 op) → nested group; key `and`/`or` → nested group rekursif
    - Id child auto-generate (mis. counter/random)
    - PHPDoc/`@phpstan-type` grammar tree LinkModel & output `{root:{k,o,v,c}}` + daftar operator + contoh
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 7.1_

  - [x] 1.2 Pemetaan operator + relasi
    - Map operator: `not`/`notEqual`→`!=`, `notIn`→`!in`, `notBetween`→`!between`, `like`→`matches`, `notLike`→`!matches`, sisanya identitas
    - Relasi: dot-notation diteruskan apa adanya; nested-object relasi → flatten ke `"<relasi>.<col>"`
    - Deteksi relasi via `new FilterColumnResolver($columns)` (`type ∈ {relation, relations}`)
    - Relasi by-id (`=`/`in`) → value diteruskan apa adanya
    - _Requirements: 1.6, 1.7, 2.1, 2.2, 2.3, 2.4_

  - [x] 1.3 Date → in_period + operator khusus + skip aman
    - Kolom `date`/`datetime` + komparasi → item `in_period`/`!in_period` value period DateSelector (`{period:"day",operator,startDate,endDate?}`)
    - Map: `>`→after, `>=`→on-or-after, `<`→before, `<=`→on-or-before, `=`/scalar→is, `not`→`!in_period`/is, `between`→between, `notBetween`→`!in_period`/between; `in`/`notIn` date → skip+dev-note
    - `jsonContains`/`jsonDoesntContains` pada `formStatuses` → `has`/`!has`; selain itu skip+dev-note
    - `column` → column-mode `{kind:'column',ref}`; key `raw(...)` → skip+dev-note
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 1.4 Write feature tests `LinkModelFilterConverterTest` (end-to-end konversi→apply→assert DB)
    - **Operator mapping: tiap operator LinkModel → query benar.** Pola `FilterEvaluatorTest.php` (model stub + RefreshDatabase + metadata inline)
    - Kasus: scalar/`not`/`notIn`/`notLike`/`notBetween`/`like`/komparasi/`between`/`in`; grup `or`/`and` bersarang; relasi dot/nested-object/by-id; formStatuses; column-mode
    - **Date: `{">":X}`→in_period/after, `{between}`→in_period/between, `{not}`→`!in_period`; assert row terfilter + bentuk value period (`period:"day"`,`operator`,`startDate`)**
    - **Skip aman: operator/kolom tak valid → tidak error**
    - **Validates: Requirements 1.x, 2.x, 3.x, 4.x, 8.1, 8.2, 8.3**

- [x] 2. Checkpoint — `LinkModelFilterConverterTest` pass + `FilterEvaluatorTest` tetap pass
  - `php artisan test --compact --filter=LinkModelFilterConverter`
  - `php artisan test --compact --filter=FilterEvaluator` (regresi)
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Wire `ModelController` → FilterEvaluator
  - [x] 3.1 `applyLinkModelFilters` + arahkan jalur Builder
    - Tambah `private function applyLinkModelFilters(Builder $query, array $filters): void`: `getColumns(1)` → converter → `FilterEvaluator::apply`
    - Ubah filter utama (`ModelController.php:266-270`) → panggil `applyLinkModelFilters` (tanpa `&$with`)
    - Pertahankan `filterToQuery`/`filterOperator` lama utk jalur `JoinClause` (`:259`)
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x] 3.2 Write feature test endpoint `model` (no-regresi + operator baru)
    - **No-regresi: filter lama (`=`,`>`,`in`,`like`,grup `or`,relasi) hasil setara perilaku lama**
    - **Operator baru: `between`, date period, relasi nested kini bekerja**
    - Pakai endpoint `route('model')` / `__invoke` dgn model nyata punya `getColumns`
    - Assert `total` dan `data.id` yang match
    - _Requirements: 8.4_

- [x] 4. Checkpoint — Integrasi Controller Aman
  - `php artisan test --compact tests/Feature/Http/Controllers/ModelControllerFilterTest.php` (lulus)
  - `php artisan test --compact tests/Feature/` (opsional: pastikan endpoint lain tidak pecah, atau jalankan test spesifik misal `FilterEvaluatorTest` sekali lagi, lalu minta instruksi user jika ada masalah, atau teruskan ke 5).

- [x] 5. Frontend — `linkModelToFilterTree.js`
  - [x] 5.1 `linkModelToFilterTree` + invarian renderability
    - Buat `resources/js/lib/linkModelToFilterTree.js`
    - `linkModelToFilterTree(linkFilters, columns)` → `{root:{k,c:{<id>:{k,o,v}}}}`; id child `generateRandom(8)` (`@/lib/utils`)
    - Pemetaan operator/relasi/date IDENTIK helper PHP (termasuk date→in_period DateSelector)
    - Cek operator hasil ∈ `getOperators(column.type,{typeRelation,hasOptions,mode})` (`operators.js`); else petakan/skip — tak pernah operator liar
    - Value relation/morph/multiselect diteruskan apa adanya
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x] 5.2 Arah balik `filterTreeToLinkModel`
    - Walk `{root:{k,c}}` rekursif → tree LinkModel; group→`and`/`or`; item→`{[k]:{[opLink]:v}}` (shorthand `=`→scalar)
    - Pemetaan dibalik (mis. `in_period`/day/after→`{">":startDate}`); non-day → pertahankan `{in_period:v}` (lihat design Open Questions)
    - _Requirements: 6.5_

  - [x] 5.3 JSDoc grammar + typedef
    - typedef `LinkModelFilterTree` & `FilterBuilderTree`; JSDoc fungsi `@param`/`@returns`/`@example`; `@see` operators.js/FilterEvaluator.php/useNestedFilters.jsx
    - Catat invarian renderability di JSDoc; selaras `select-model-rewrite` §3.3
    - _Requirements: 7.2, 7.3, 7.4_

  - [x]* 5.4 Verifikasi renderability di FilterBuilder (manual/unit bila ada runner JS)
    - Render hasil konversi ke `<FilterBuilder columns value={tree}>` beragam type (string/number/date/datetime/relation/morph/formStatuses); semua item tampil benar
    - Round-trip `link→tree→link` setara
    - **Validates: Requirements 6.6, 8.5**

- [x] 6. Final checkpoint — semua test pass + lint
  - PHP: LinkModelFilterConverter 6✓ · ModelControllerFilter 2✓ · FilterEvaluator (regresi) 23✓
  - JS: vitest linkModelToFilterTree 10✓ · eslint 0 error/0 warn · pint clean
  - _Requirements: 8.4, 8.6_

## Notes

- Converter delegasi ke `FilterEvaluator` → test paling bernilai = end-to-end (assert row DB), bukan assert struktur tree saja.
- Jalur `JoinClause` (`:259`) WAJIB tetap pakai engine lama — FilterEvaluator hanya terima `Builder`.
- Drop `&$with` auto-collect: relasi display dari `request->with` eksplisit (terverifikasi `LinkModel.jsx:420-438`).
- Invarian renderability = aturan keras: helper PHP & JS tak boleh menghasilkan operator di luar `getOperators(type)`.
- Task 5.4 optional (verifikasi manual FE; bukan blocker bila tak ada runner JS).
- Lint/Pint hanya di final checkpoint (task 6), bukan per task.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3"] },
    { "id": 2, "tasks": ["1.4"] },
    { "id": 3, "tasks": ["2"] },
    { "id": 4, "tasks": ["3.1"] },
    { "id": 5, "tasks": ["3.2"] },
    { "id": 6, "tasks": ["4"] },
    { "id": 7, "tasks": ["5.1"] },
    { "id": 8, "tasks": ["5.2", "5.3"] },
    { "id": 9, "tasks": ["5.4"] },
    { "id": 10, "tasks": ["6"] }
  ]
}
```
