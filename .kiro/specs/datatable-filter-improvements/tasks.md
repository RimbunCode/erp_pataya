# Implementation Plan: DataTable2 Filter Improvements

## Overview

Dua perubahan terpadu pada pipeline filter DataTable2:

1. **Fix `formStatuses`** — kolom JSON array difilter via `whereJsonContains` (bukan `whereIn`).
2. **Bandingkan antar-kolom** — mode column (`v = { kind: "column", ref }`), same-table & cross-table relasi, semua operator per-type kecuali `in_period`; date/datetime dapat set operator penuh hanya di mode column.

Invariant: aturan operator/value/type di-mirror di `FilterEvaluator` (query), `FilterTreeCleaner` (save), dan frontend (`operators.js` + `filterValidation.js`). Reuse `FilterColumnResolver` untuk resolusi kolom & dot-notation relasi. Lint/Pint + eslint dijalankan **hanya setelah semua task selesai**.

## Tasks

- [x] 1. Fix `formStatuses` (JSON array) — backend
  - [x] 1.1 Handler `applyJsonArray` di `FilterEvaluator`
    - Tambah method `applyJsonArray($query, $col, $base, $negate, $value, $boolean)` di `app/Services/Core/FilterEvaluator.php`
    - `in`/`has` → OR-chain `whereJsonContains` terbungkus group
    - `!in`/`!has` → `(col IS NULL) OR (AND-chain whereJsonDoesntContain)` — bukan `whereNot`: di MySQL `json_contains(NULL,..)=NULL` → baris NULL tereksklusi, jadi cabang `IS NULL` eksplisit wajib agar NULL ikut "tidak memuat"
    - Reuse `toList()` (saring null/empty) & `method()` (varian `or`)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.6, 1.8_
  - [x] 1.2 Dispatch `formStatuses` di `applyItem` (dan leaf `applyNestedRelationColumn`)
    - Saat `type === 'formStatuses'`, normalisasi `has`→`in` / `!has`→`!in`, panggil `applyJsonArray` sebelum jalur scalar generik
    - Pastikan `formStatus` tunggal TIDAK terpengaruh (tetap `whereIn`)
    - _Requirements: 1.1, 1.3, 1.5_
  - [x] 1.3 Validasi save-time `formStatuses has/!has` di `FilterTreeCleaner`
    - `isValueShapeValid()`: tangani `has`/`!has` pada `formStatuses` sebagai list ≥1 (mirip `relations`) agar tidak jatuh ke default
    - _Requirements: 1.7_
  - [x] 1.4 Test `formStatuses` (checkpoint) — **19 passed, 0 fail (MySQL)**
    - `FilterEvaluatorTest.php`: kolom `tags` (`$t->json('tags')`); seed `['draft']`, `['draft','approved']`, `['closed']`, `null`
    - Assert `in`/`!in`/`has`/`!has` + multi-value + NULL ikut `!in`/`!has`
    - Verifikasi: `test_form_statuses_json_array_membership` hijau; full suite tanpa regresi
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.6_

- [x] 2. Mode column — backend evaluator
  - [x] 2.1 Deteksi & dispatch column-ref di `applyItem` / `applyNestedRelationColumn`
    - Jika `is_array($value) && ($value['kind'] ?? null) === 'column'` → `applyColumnComparison(...)`
    - _Requirements: 2.1, 2.2_
  - [x] 2.2 Resolusi `ref` + validasi type-compat
    - Normalisasi `ref`→array; resolve tiap ref via `FilterColumnResolver::resolvePath()`; null/!searchable → drop
    - Helper `isTypeCompatible($leftType, $rightType)` (numeric/string/date/time/boolean); tidak cocok → drop
    - _Requirements: 2.8, 3.3, 3.4_
  - [x] 2.3 Same-table comparison (`applySameTable`)
    - komparasi → `whereColumn`; `in`/`!in` → OR-chain `whereColumn(=)` terbungkus group (+`whereNot`); `between`/`!between` → `>=`AND`<=` group (+`whereNot`)
    - _Requirements: 2.3, 2.4, 2.5, 2.6_
  - [x] 2.4 Cross-table comparison (`applyCrossTable`)
    - Nested `whereHas`; leaf `whereColumn` dengan kolom luar terkualifikasi tabel — **teruji MySQL** (`qty > category.threshold`)
    - _Requirements: 2.7_

- [x] 3. Mode column — validasi save-time
  - [x] 3.1 Cabang column-ref di `FilterTreeCleaner::isValueShapeValid`
    - Cabang paling awal: resolve tiap `ref` (ada+searchable+type-compat); jumlah ref sesuai operator (1 / ≥1 / tepat 2)
    - `in_period`/`set`/`!set` + mode column → invalid
    - _Requirements: 2.9, 3.3_

- [x] 4. Operator date/datetime per mode — backend
  - [x] 4.1 Terima base operator non-period saat left date/datetime + mode column
    - `applyColumnComparison` menerima `= != > >= < <= in !in between` untuk date/datetime di mode column — **teruji** (`born_on < deadline_on`)
    - _Requirements: 3.1, 3.2, 3.3, 3.5_
  - [x] 4.2 Test column comparison (checkpoint)
    - `FilterEvaluatorTest.php`: same-table, date mode column, cross-table, type-incompat → **4 passed (MySQL)** ✓
    - `FilterTreeCleanerTest.php`: column-ref valid/invalid + formStatuses → **16 passed** ✓
    - _Requirements: 2.x, 3.x_

- [x] 5. Frontend — mode column UI
  - [x] 5.1 Column-tree dibagi via prop (bukan hook)
    - Keputusan user: teruskan `columnOptions` + `fetchRelationColumns` dari `FilterItem2.jsx` sebagai prop ke `ValueField.jsx` — minim kode, tak sentuh `useNestedFilters`. Util baru `columnRef.js` (kategori type, isColumnRef, makeColumnRef)
    - _Requirements: 4.1_
  - [x] 5.2 `operators.js` — param `mode`
    - `getOperators(type, { mode })`: mode column → date/datetime set penuh tanpa `in_period`; type lain override valueInput ke `columnref`/`columnrefMulti`/`columnref2`; exclude `set`/`!set` & `in_period`
    - _Requirements: 3.1, 3.2, 4.2_
  - [x] 5.3 `ValueField.jsx` — case `columnref` / `columnrefMulti` / `columnref2`
    - `ColumnRefPicker` (NestedSelect) single; `MultiGrow`+picker (multi); `RangePair`+2 picker (between); difilter type-compatible (`refColumnOptions`); simpan `{ kind:'column', ref }`
    - _Requirements: 4.1, 4.4, 4.6_
  - [x] 5.4 `FilterItem2.jsx` — toggle value↔column
    - **Switch** (komponen baru `Components/ui/switch.jsx`) sejajar kiri operator, tooltip-only (tanpa label). Dibungkus `<span>` (TooltipTrigger asChild langsung ke radix Switch bikin render rusak — lihat memory)
    - Infer mode dari `v.kind`; `onModeChanged` pertahankan operator bila masih didukung di mode tujuan, reset bila tidak; `emptyValue()` mode-aware agar mode tak hilang saat ganti operator
    - Switch pakai warna konkret (token tema bg-input/bg-primary rusak/non-HSL); dimensi standar (arbitrary `[...]` tak ter-generate di setup Tailwind ini)
    - _Requirements: 4.2, 4.3_
  - [x] 5.5 `filterValidation.js` — validasi `columnref*`
    - ref terisi & jumlah sesuai operator (`columnref`→1, `columnrefMulti`→≥1, `columnref2`→2); mode di-infer via `isColumnRef`
    - _Requirements: 4.5_

- [x] 6. Verifikasi akhir (checkpoint)
  - [x] 6.1 Full filter test suite
    - `php artisan test --compact --filter=FilterEvaluatorTest` & `--filter=FilterTreeCleanerTest` → hijau
  - [x] 6.2 Manual UI
    - `formStatuses in [...]` benar; toggle mode column → filter jalan; save → reload `?fid=` → re-apply
  - [x] 6.3 Lint/Pint + eslint
    - `vendor/bin/pint --dirty --format agent`; eslint file JS yang berubah
    - _Catatan: hanya setelah semua task di atas selesai_
