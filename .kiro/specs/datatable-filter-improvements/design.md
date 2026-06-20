# Design — DataTable2 Filter Improvements

## Ringkasan

Dua perubahan pada pipeline filter DataTable2: (1) memperbaiki evaluasi kolom `formStatuses` (JSON array) agar memakai JSON-contains, dan (2) menambah "mode column" sehingga sebuah item filter bisa membandingkan kolom kiri dengan kolom lain. Desain menjaga invariant arsitektur: aturan operator/value/type di-mirror di tiga lapisan.

## Arsitektur & lapisan yang disentuh

```
Frontend (FilterBuilder)                 Backend (saat apply ?fid= / save)
─────────────────────────                ─────────────────────────────────
FilterItem2.jsx  ── toggle mode ──┐      DataTableScope ──┐
operators.js     (operator+input)  │                      ├─ FilterEvaluator   (query)   ← sumber kebenaran
ValueField.jsx   (render value)    │      SavedFilter ─────┴─ FilterTreeCleaner (save-time validasi)
filterValidation.js (validasi)     │                          FilterColumnResolver (resolve, dipakai bersama)
```

Invariant: setiap perubahan operator/type/value-shape WAJIB sinkron di `FilterEvaluator`, `FilterTreeCleaner`, dan layer frontend (`operators.js` + `filterValidation.js`) — selisih menyebabkan item di-drop diam-diam.

Komponen yang **direuse** (tanpa menulis ulang):
- `FilterColumnResolver::resolve()` / `resolvePath()` — resolusi kolom + dot-notation relasi + lazy-load kolom anak (cache per-FQCN). Dipakai untuk me-resolve `ref` kolom kanan.
- `FilterEvaluator` helpers: `toList()`, `method()` (boolean→`orWhere*`), parsing `negate`/`base`, pola nested `whereHas` di `applyNestedRelationColumn()`.
- Frontend: `NestedSelect` (picker kolom), `MultiGrow` & `RangePair` (di `ValueField`).

---

## Bagian 1 — Fix `formStatuses` (JSON array)

### Penyebab

`FilterEvaluator::applyScalar()` `case 'in'` (baris 205-209) menjalankan `whereIn($col, $values)`. Untuk kolom JSON array (`'["draft","approved"]'`), SQL membandingkan blob string penuh dengan tiap skalar → tak pernah match.

### Solusi

Tambah handler `applyJsonArray()` dan dispatch dari `applyItem()` (dan leaf `applyNestedRelationColumn()`) saat `type === 'formStatuses'`, sebelum jalur scalar generik.

```
applyJsonArray($query, $col, $base, $negate, $value, $boolean):
  $values = toList($value)                  // saring null/empty
  if empty($values): return
  // 'in' dan 'has' → "memuat salah satu"; negate → kebalikan
  $query->where(function ($q) use (...) {
      foreach ($values as $i => $v) {
          $q->whereJsonContains($col, $v, boolean: $i === 0 ? 'and' : 'or');
      }
  }, boolean: $boolean) bila !$negate
  // !in / !has → "tidak memuat satupun" = whereNot atas OR-chain di atas
  else: $query->whereNot(<OR-chain>, boolean: $boolean)
```

Normalisasi operator: `has`→`in`, `!has`→`!in` (keduanya identik untuk `formStatuses`). `base`/`negate` sudah dipecah di `applyItem` (baris 132-133); untuk `has`/`!has` map ke perilaku `in`/`!in` sebelum memanggil handler.

`whereJsonContains($col, 'draft')` menghasilkan `JSON_CONTAINS(col, '"draft"')` (MySQL/MariaDB). Value harus string enum mentah — `toList()` sudah menyaring null/empty.

### `FilterTreeCleaner`

`isValueShapeValid()`: cabang `base === 'in'` (baris 215) sudah memvalidasi list ≥1 → `in`/`!in` formStatuses lolos. Tambah penanganan `has`/`!has` untuk `formStatuses` agar tidak jatuh ke `default` (validasi sebagai list ≥1, mirip `relations`).

### Frontend

`operators.js` case `formStatuses` (multiselect) & `filterValidation.js` `multiselect` sudah benar — tanpa perubahan.

---

## Bagian 2 — Bandingkan antar-kolom (mode column)

### Perubahan DSL (value shape)

```jsonc
// mode value (default, tetap):
{ k: "qty",    o: ">",       v: 10 }
// mode column:
{ k: "qty",    o: ">",       v: { kind: "column", ref: "min_qty" } }          // single ref
{ k: "status", o: "in",      v: { kind: "column", ref: ["col_a", "col_b"] } } // list ref
{ k: "price",  o: "between", v: { kind: "column", ref: ["cost", "max"] } }    // 2 ref
{ k: "qty",    o: ">",       v: { kind: "column", ref: "category.threshold" } } // cross-table
```

Deteksi mode = `is_array($v) && ($v['kind'] ?? null) === 'column'`. Backward-compatible.

### Backend: `FilterEvaluator::applyColumnComparison()`

Dispatch di `applyItem()` (sebelum jalur scalar/period/relation) dan di `applyNestedRelationColumn()` saat value adalah column-ref.

```
applyColumnComparison($query, $leftPath, $base, $negate, $value, $boolean):
  $refs = normalisasi $value['ref'] → array
  resolve tiap ref via FilterColumnResolver::resolvePath()
    → { relations, columnName, column(node) }; null / !searchable → return (drop)
  validasi type-compat(left, right) per ref → tidak cocok → return (drop)

  $leftCross  = !empty($leftPath['relations'])
  $rightCross = ada ref dengan relations non-kosong
  if (!$leftCross && !$rightCross):  applySameTable(...)
  else:                              applyCrossTable(...)
```

#### Same-table (`applySameTable`)
- komparasi (`= != > >= < <=`): `whereColumn($leftCol, $op, $refCol, $boolean)`.
- `in` / `!in`: bungkus group, OR-chain `whereColumn($left, '=', $ref_i)`; `!in` = `whereNot` atas group.
- `between` / `!between`: bungkus group `whereColumn($left,'>=',$lo)->whereColumn($left,'<=',$hi)`; `!between` = `whereNot`.
- `negate` untuk `!=` lewat operator; untuk `!in`/`!between` lewat `whereNot`.

#### Cross-table (`applyCrossTable`)
`whereColumn` di dalam closure `whereHas` tidak melihat tabel luar. Solusi: correlated subquery dengan kolom luar **terkualifikasi tabel**.
- Bangun nested `whereHas` (pola `applyNestedRelationColumn`) ke arah sisi yang berelasi.
- Kondisi leaf memakai `whereColumn(<related_table>.<col>, $op, <base_table>.<col>)`. Nama tabel base diambil dari `$query->getModel()->getTable()`; nama tabel relasi dari model relasi.
- `qualifiedColumn()` (saat ini identity, baris 497) diperluas untuk memprefix nama tabel saat dibutuhkan di subquery.
- in/between cross-table → OR/AND-chain `whereColumn` terkualifikasi di dalam leaf.

`★ Catatan dialek ─` MySQL/MariaDB mengizinkan referensi tabel luar dalam subquery correlated yang dihasilkan `whereHas`. Validasi awal di SQLite (test) lalu konfirmasi di MySQL/MariaDB (DB produksi). `─`

### Type-compat

Kategori (left ↔ right yang diperbolehkan):
- `number` / `currency` ↔ `number` / `currency`
- `string` ↔ `string`
- `date` / `datetime` ↔ `date` / `datetime`
- `time` ↔ `time`
- `boolean` ↔ `boolean`
- (relation/enum/formStatus dibandingkan ke type sejenis bila relevan; default: drop bila beda kategori)

### `FilterTreeCleaner`

`isValueShapeValid()`: tambah cabang **paling awal** — jika `v` berbentuk column-ref:
- resolve tiap `ref` via resolver; harus ada & searchable & type-compat.
- jumlah ref: komparasi→1, `in`/`!in`→≥1, `between`/`!between`→tepat 2.
- `in_period`/`set`/`!set` + mode column → invalid.

---

## Bagian 3 — Operator date/datetime per mode

- Mode value: `date`/`datetime` tetap `in_period`/`!in_period` (tak berubah).
- Mode column: `date`/`datetime` → `= != > >= < <= in !in between !between` (tanpa `in_period`), diproses lewat `applyColumnComparison` (reuse `whereColumn`/subquery). Tidak ada input tanggal literal baru.
- `in_period`/`!in_period` di mode column (semua type) → invalid (drop).

Implementasi operator-set ini ada di `operators.js` `getOperators(type, { mode })` dan di-mirror oleh validasi (`FilterTreeCleaner` menerima base non-period saat left date + mode column).

---

## Bagian 4 — Frontend

### `operators.js`
`getOperators(type, opts)` + opsi `mode: 'value' | 'column'`. Saat `mode === 'column'`:
- `date`/`datetime` → set penuh `= != > >= < <= in !in between !between`; valueInput: komparasi→`columnref`, in→`columnrefMulti`, between→`columnref2`.
- type lain → operator = mode value-nya, valueInput di-override ke `columnref` / `columnrefMulti` / `columnref2`.
- exclude `set`/`!set` dan `in_period`/`!in_period`.

### `FilterItem2.jsx`
- Tambah toggle value↔column per item (mis. ikon di samping operator). Mode disimpan di item atau di-infer dari bentuk `v` (`v?.kind === 'column'`).
- Saat toggle / ganti jenis input → reset `v` (analog baris 150-156).
- Teruskan `mode` ke `getOperators` & `ValueField`.
- **Refactor:** angkat logika `columnOptions` + `buildColumnNode` + `fetchRelationColumns` ke hook/util bersama (mis. perluas `useNestedFilters` atau util baru) agar `ValueField` memakai column-tree yang sama untuk picker kanan.

### `ValueField.jsx`
- Case baru `columnref` (satu `NestedSelect`), `columnrefMulti` (`MultiGrow` berisi `NestedSelect`), `columnref2` (`RangePair` berisi dua `NestedSelect`).
- Picker hanya menampilkan kolom **type-compatible** dengan kolom kiri.
- Value tersimpan = `{ kind: 'column', ref }` (string / array sesuai operator).

### `filterValidation.js`
- Validasi `columnref*`: ref terisi & jumlah sesuai operator; idealnya type-compat (reuse `resolveColumn`).

---

## Pengujian

### `FilterEvaluatorTest.php`
- **formStatuses**: kolom `tags` (`$t->json('tags')`, cast `FormStatusesCast`); seed `['draft']`, `['draft','approved']`, `['closed']`, `null`; assert `in`/`!in`/`has`/`!has` + multi-value.
- **column same-table**: `qty > min_qty`, `price between [cost, max]`, `name = alias`, `status in [colA, colB]`.
- **date mode column**: `born_on < started_at`, `born_on between [start_col, end_col]`; verifikasi mode value date tetap period-only (komparasi literal date di mode value → drop).
- **cross-table**: `qty > category.threshold` (tambah `threshold` ke `FilterTestCategory`); assert correlated subquery.
- **type-incompat**: `name > qty` → di-drop (hasil tak berubah).

### `FilterTreeCleanerTest.php`
- column-ref valid lolos; invalid (ref tak ada / type-incompat / `in_period`+column / jumlah ref salah) → di-drop.

### Manual UI
- `formStatuses in [...]` → hasil benar (sebelumnya kosong).
- Toggle mode column → pilih operator & kolom kanan → tabel terfilter.
- Save filter → reload `?fid=` → column-ref ter-resolve & re-apply.

---

## Risiko & catatan

- **Cross-table** adalah bagian terkompleks (correlated subquery + kualifikasi nama tabel + nuansa dialek). Diuji SQLite lalu dikonfirmasi MySQL/MariaDB.
- Mirror 3-lapis: pastikan operator-set mode column identik di backend & frontend agar tak ada drop senyap.
- Refactor column-tree frontend (angkat ke shared) adalah perubahan struktural terbesar di sisi JS — jaga agar picker kolom kiri tetap berperilaku sama.
