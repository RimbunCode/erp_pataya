# Design: SelectModel Rewrite

## 1. Overview

Rewrite `SelectModel` dari 608 baris dengan dua API call jadi arsitektur bersih:

- **Backend:** endpoint `model.selectData` (combined columns + paginated data) di atas macro `dataTable` yang sudah ada.
- **Hook React:** `useSelectModel` — mengelola state dialog (model aktif, view, pagination, filter-tree, data, kolom).
- **Komponen:** `SelectModel` — orkestrasi UI (selector model, view, `FilterBuilder`, `Table2`, `Pagination`).
- **Helper:** `loadFromModel` — async by-ID, payload return diselaraskan dengan `onSelected`.

Prinsip: **orchestrator tipis**. Mesin query (macro `dataTable`, `FilterEvaluator`), filter UI (`FilterBuilder`/`useNestedFilters`), tabel (`Table2`), pagination (`Pagination`), dan selektor (`Select`) **dipakai ulang** — tidak ditulis ulang.

## 2. Status Saat Ini (verified)

| Komponen | Lokasi | Status |
|----------|--------|--------|
| `ModelController::columns()` (GET `model.columns`) | `ModelController.php:292-326` | ⚠️ Dipakai SelectModel; disisakan tapi tak lagi dipanggil dialog |
| `ModelController::datatable()` (POST `model.datatable`) | `ModelController.php:328-333` | ✅ Tetap dipakai halaman lain |
| `Model::getColumns(1)` | `LinkModel.php:480-627` | ✅ Rekursif 1 level; `usort` by name di `:624` (urutan hilang) |
| Macro `Model::dataTable()` | `DataTableScope.php:50-154` | ✅ Filter (`fid`)/sort/paginate/adaptive-select; dukung `?with`, `id`, `fid`, `show` |
| Filter `baseFilters` (tree LinkModel) → `LinkModelFilterConverter` → `FilterEvaluator` | `ModelController.php:93-97`, `app/Services/Core/LinkModelFilterConverter.php` | ✅ Jalur Builder kini konversi+delegasi (commit `b56801c`). `filterToQuery`/`filterOperator` lama hanya utk `JoinClause` |
| Filter `filters` (builder native `{root:{k,o,v,c}}`) → `FilterEvaluator::apply` | `app/Services/Core/FilterEvaluator.php` | ✅ Output `FilterBuilder` dikirim apa adanya (tanpa konversi FE) |
| Filter via `fid` → `FilterEvaluator` | `DataTableScope.php:119-130` | ✅ Jalur OPSIONAL — hanya saat user pilih saved filter |
| Helper FE `linkModelToFilterTree` (dua arah) | `resources/js/lib/linkModelToFilterTree.js` | ✅ forward (tree LinkModel→`{root:{k,o,v,c}}`) tersedia; reverse TAK dipakai jalur ini |
| `validate`/`validateWithOperators` (FE konsumen tree LinkModel) | `lib/linkModelUtils.js:3,183` | ✅ Sumber grammar tree LinkModel di FE |
| `FilterBuilder` (reusable) | `Filter/FilterBuilder.jsx` | ✅ Docstring: "dapat dipakai ulang (mis. SelectModel)". Props `columns`, `value`, `onChange` |
| `useNestedFilters` | `@/Hooks/useNestedFilters` | ✅ State filter-tree headless |
| `Pagination` | `Table/Pagination.jsx:52-94` | ✅ `currentPage`, `totalPages`, `onPageChanged` |
| `Select` | `Components/Select.jsx:22-328` | ✅ `value`, `onValueChange`, `options`, `optionTrans` |
| `WorkOrderItem` / `PurchaseRequestItem` | masing-masing model | ⚠️ `$parentRelation` ADA; relasi parent `ignore:true` di `configColumns` |
| `SelectModel.jsx` (608 baris) | komponen target | ❌ Double-fetch+race, config tersebar, `_onSelected` berbelit, dead code |

## 3. Kontrak Filter (SUMBER KEBENARAN — anti-mismatch)

> Filter dialog = **dua kanal terpisah**, digabung **di backend** dengan AND (+ `fid` opsional):
> - **`baseFilters`** (param `baseFilters`) = **tree LinkModel** (dev-friendly). Berasal dari `from.filters`/
>   `selects[].filters` — filter **NON-EDITABLE**, TIDAK ditampilkan/di-load ke `FilterBuilder`.
> - **`filters`** (param `filters`) = **`{root:{k,o,v,c}}` builder native** — output `FilterBuilder` (filter
>   editable user), dikirim **apa adanya** (tanpa konversi FE).
>
> Backend menerapkan: `baseFilters` → `LinkModelFilterConverter::toTree` → `FilterEvaluator::apply`; `filters`
> → `FilterEvaluator::apply` langsung; keduanya AND. Mekanisme `filterToQuery` lama TIDAK lagi jalur dialog —
> diganti converter (commit `b56801c`, spec `linkmodel-filter-converter`). `fid` (saved filter) = jalur ketiga
> opsional (§3.5).

### 3.1 Grammar Tree LinkModel (untuk `baseFilters`)

Sumber kebenaran grammar: FE `validate`/`validateWithOperators` (`resources/js/lib/linkModelUtils.js:3,183`);
mekanisme query BE `LinkModelFilterConverter` → `FilterEvaluator` (`app/Services/Core/LinkModelFilterConverter.php`,
`FilterEvaluator.php`). Mirror FE `resources/js/lib/linkModelToFilterTree.js`.

> **Operator kini penuh.** Karena `baseFilters` diproses converter→`FilterEvaluator` (bukan `filterOperator`
> lama), operator yang didukung mencakup seluruh kapabilitas FilterEvaluator: komparasi date/datetime
> (otomatis dibungkus `in_period`), morph, column-comparison, formStatuses JSON-array, `between`/`!between`,
> `in`/`!in`, `has`/`!has`, `set`/`!set`, plus nested whereHas multi-level. (Sebelumnya terbatas operator
> `filterOperator`.)

```
filterTree := { <key>: <node>, ... }            // map; tiap entry digabung AND di level itu
<key>      := "<column>"                          // nama kolom (snake_case)
            | "<relation>.<column>"               // dot/`->` untuk relasi nested → has()
            | "and" | "or"                        // grup boolean → nested filterTree
            | "raw(<sql>)"                         // raw column (jarang)
<node>     := <scalar>                             // shorthand "=" : { col: "x" } ≡ col = "x"
            | { <operator>: <value>, ... }         // satu/lebih operator pada kolom (AND antar-op)
            | <filterTree>                          // untuk key "and"/"or" atau relasi
```

**Operator (dari `ModelController::filterOperator`):**

```
=, ==, equal        : sama dengan (default bila node = scalar)
!=, not, notEqual   : tidak sama
>, >=, <, <=        : komparasi
in                  : whereIn (value = array)
notIn               : whereNotIn (value = array)
between             : whereBetween (value = [min,max])
notBetween          : whereNotBetween
like                : LIKE %value% (otomatis wrap %)
notLike             : NOT LIKE %value%
jsonContains        : json_overlaps
jsonDoesntContains  : not json_overlaps
column              : whereColumn (value = nama kolom lain)
and / or            : grup operator pada satu kolom, mis. { qty: { and: { ">": 0, "<": 100 } } }
```

### 3.2 Contoh Tree LinkModel

```js
// equal shorthand
{ status: "submitted" }                 // status = 'submitted'

// operator eksplisit
{ required_quantity: { ">": 0 } }        // required_quantity > 0
{ submitted_at: { not: null } }          // submitted_at != null
{ code: { like: "WO-" } }                // code LIKE '%WO-%'
{ id: { in: ["a","b","c"] } }            // whereIn id

// kombinasi operator pada satu kolom (AND)
{ qty: { ">=": 1, "<=": 100 } }

// grup boolean
{ or: { status: "submitted", code: { like: "WO" } } }   // status=... OR code LIKE...
{ and: { a: 1, or: { b: 2, c: 3 } } }                    // a=1 AND (b=2 OR c=3)

// relasi nested (has())
{ "items.required_quantity": { ">": 0 } }                // whereHas items: required_quantity > 0
{ customer: { type: { not: "vehicle" } } }               // whereHas customer: type != 'vehicle'
```

### 3.3 JsDoc untuk prop `from.filters` (R8.7 — WAJIB di komponen)

JsDoc ini ditulis di atas definisi prop/typedef `SelectModel` (dan dirujuk `selects[].filters`):

```js
/**
 * Filter deklaratif NON-EDITABLE untuk membatasi record sumber, memakai grammar
 * tree LinkModel (sama dengan prop `filters` pada komponen LinkModel). Dikirim ke
 * backend sebagai param `baseFilters` (apa adanya, TANPA konversi FE) dan diterapkan
 * via LinkModelFilterConverter → FilterEvaluator, di-AND dengan filter editable user.
 *
 * NON-EDITABLE: filter ini TIDAK ditampilkan / tidak di-load ke FilterBuilder.
 *
 * Bentuk:
 *   - Map kolom→nilai. Nilai scalar = operator "=" (shorthand).
 *   - Nilai objek = { <operator>: <value> } untuk operator eksplisit (AND antar-operator).
 *   - Key "and"/"or" = grup boolean berisi sub-tree.
 *   - Key "relation.column" atau "relation": { ... } = filter pada relasi (whereHas).
 *
 * Operator (penuh — via FilterEvaluator):
 *   "=" | "==" | "equal" (default) · "!=" | "not" | "notEqual" ·
 *   ">" | ">=" | "<" | "<=" · "in" | "notIn" (array) · "between" | "notBetween" ([min,max]) ·
 *   "like" | "notLike" · "jsonContains" | "jsonDoesntContains" (formStatuses) ·
 *   "column" (value: nama kolom lain) · "and" | "or" (grup pada satu kolom).
 *   Kolom date/datetime: operator komparasi otomatis dibungkus jadi in_period.
 *
 * @typedef {Object<string, *>} LinkModelFilterTree
 *
 * @example <caption>shorthand equal</caption>
 * { status: "submitted" }                         // status = 'submitted'
 *
 * @example <caption>operator eksplisit</caption>
 * { required_quantity: { ">": 0 } }                // required_quantity > 0
 * { submitted_at: { not: null } }                  // submitted_at != null
 *
 * @example <caption>grup boolean</caption>
 * { or: { status: "submitted", code: { like: "WO" } } }
 *
 * @example <caption>filter pada relasi (whereHas)</caption>
 * { "items.required_quantity": { ">": 0 } }
 *
 * @see resources/js/lib/linkModelUtils.js (validate / validateWithOperators)
 * @see resources/js/lib/linkModelToFilterTree.js (helper konversi FE)
 * @see app/Services/Core/LinkModelFilterConverter.php (konverter BE)
 * @see app/Services/Core/FilterEvaluator.php (engine query)
 */
```

> **Anti-mismatch:** `from.filters` (`baseFilters`) = tree LinkModel apa adanya (NON-EDITABLE). Filter editable
> user (`filters`) = `{root:{k,o,v,c}}` builder native apa adanya. Tidak ada konversi di FE — tiap kanal pakai
> format nativnya; backend yang menyatukan (AND) via FilterEvaluator.

### 3.4 Dua Kanal Filter (Default NON-EDITABLE + Ad-hoc FilterBuilder)

Filter dialog = **dua kanal terpisah**, dikirim sebagai **dua field**, digabung **di backend** dengan AND:

```js
// dikirim ke model.selectData — DUA field terpisah, tanpa konversi FE:
{
  baseFilters,   // dari from (`filters` SELF / `selects[rel].filters`) — tree LinkModel apa adanya (NON-EDITABLE)
  filters,       // = FilterBuilder `value` (output native {root:{k,o,v,c}}) — apa adanya (filter editable user)
}
```

- `baseFilters` (NON-EDITABLE): TIDAK pernah di-load ke `FilterBuilder`. Tetap diterapkan backend setiap query.
- `filters`: `FilterBuilder` `value` adalah filter user-only (`{root:{k,o,v,c}}`), dikirim apa adanya.
- **Tidak ada adapter `treeToLinkModel`** dan tidak ada penggabungan `{...base,...user}` di FE — backend yang
  meng-AND keduanya (§4.2). `FilterBuilder` native MEMANG menghasilkan `{root:{k,o,v,c}}` (terverifikasi
  `useNestedFilters.jsx` — node `{k,o,v,c}` ber-id).

### 3.5 Jalur SavedFilter (`fid`) — OPSIONAL, hanya saat saved filter

`fid` dikirim HANYA bila user memilih saved filter yang sudah tersimpan. Tidak ada persist otomatis tiap apply.

```
from.filters             → kirim baseFilters (tree LinkModel) — SELALU (NON-EDITABLE)
user pakai FilterBuilder  → kirim filters ({root:{k,o,v,c}} native)
user pilih saved filter  → kirim fid → macro dataTable: SavedFilter::find → FilterEvaluator::apply
semua jalur              → backend gabung AND (baseFilters + filters + fid)
```

Tiga jalur, semua di-AND di backend via `FilterEvaluator`: `baseFilters` (konversi dulu), `filters` (native),
`fid` (saved filter). Format SavedFilter (`saved_filters.filter`) = `{root:{k,o,v,c}}` — domain `FilterEvaluator`,
sama dengan `filters` builder native. Konversi/penyimpanan saved filter di luar scope minimal.

## 4. Backend

### 4.1 Route

```php
// routes/web.php — setelah model.datatable (~line 119)
Route::post('/model/select-data', [ModelController::class, 'selectData'])
    ->middleware(['auth'])
    ->name('model.selectData');
```

### 4.2 `ModelController::selectData(Request $request)`

```
Input body:
{ model, select?, columns?, baseFilters?, filters?, fid?, sort?, page?, show?, with? }
  // baseFilters = tree LinkModel (dari from, NON-EDITABLE, §3); filters = {root:{k,o,v,c}} builder native;
  // fid = saved filter (opsional). Ketiganya di-AND.

Output:
{ model, route, translateKey, columns, parentColumn, data:{data,current_page,last_page,per_page,total} }
```

**Algoritma:**

1. Validasi `model` class Eloquent valid → 422 bila tidak.
2. Resolusi target:
   ```php
   $parent = $request->model;                 // FQCN (frontend kirim FQCN)
   $target = $parent;
   $parentColumn = null;
   if ($select = $request->select) {
       $rel = (new $parent)->$select();        // 422 bila method/relasi invalid
       if (!$rel instanceof Relation) abort(422);
       $target = get_class($rel->getRelated());
   }
   ```
3. Mode per-item — relasi balik parent (§4.3): bila `$select`, baca `$target::$parentRelation`, set `$parentColumn` (snake-case), tambahkan ke `with`.
4. Bangun `columns` = `$target::getColumns(1)`; tandai `show`/`order` dari `$request->columns` (reuse blok `columns()` `:308-319`); un-ignore kolom parent bila per-item (§4.3).
5. **Data** — terapkan **tiga jalur filter** (semua di-AND) lalu paginate via macro `dataTable`:

   - **`baseFilters`** (tree LinkModel, NON-EDITABLE): konversi+delegasi — `(new LinkModelFilterConverter($columns))->toTree($baseFilters)` → `(new FilterEvaluator($columns))->apply($query, $tree)`. Reuse mekanisme `ModelController::applyLinkModelFilters` (`:93-97`, commit `b56801c`) — **jadikan reusable**: extract jadi helper/trait protected, atau panggil `LinkModelFilterConverter`+`FilterEvaluator` langsung di `selectData`. (`$columns` = `$target::getColumns(1)`.)
   - **`filters`** (`{root:{k,o,v,c}}` builder native): `(new FilterEvaluator($columns))->apply($query, $filters)` LANGSUNG (tanpa konversi).
   - **`fid`** (saved filter, opsional): via macro `dataTable` (`DataTableScope.php:119-130`) → `SavedFilter::find` → `FilterEvaluator::apply`.

   Integrasi macro: terapkan `baseFilters`+`filters` di `selectData` (sebelum/sesudah memanggil macro untuk sort/paginate/submitable/`fid`). Karena keduanya `FilterEvaluator::apply` membungkus `where(closure)`, gabungan otomatis AND. Macro `dataTable` TIDAK perlu tahu `baseFilters`/`filters` — cukup `fid`/sort/page/show/submitable.

   Konfigurasi query per mode:
   - SELF: query `$parent`, `with` = relasi `selects` (via `$request->with`).
   - per-item: query `$target`, `with` = `[$parentRelation]`.
   - `fid`/`sort`/`page`/`show`/submitable → ditangani macro (sudah ada, `DataTableScope.php:119-143`).
6. Susun response `{ model: $target, route, translateKey, columns, parentColumn, data }`.

> **Filter tiga jalur (semua AND):** `baseFilters` (tree LinkModel) via `LinkModelFilterConverter`→`FilterEvaluator`; `filters` (`{root:{k,o,v,c}}` native) via `FilterEvaluator` langsung; `fid` (saved filter, opsional) via `FilterEvaluator` di macro. `filterToQuery` lama TIDAK dipakai di sini.

### 4.3 Relasi Balik Parent (per-item)

`WorkOrderItem`/`PurchaseRequestItem` punya `public static $parentRelation` tapi meng-`ignore` kolom relasi parent di `configColumns`.

Strategi (tanpa ubah `configColumns` item model):

```php
if ($select) {
    $parentRel = $target::$parentRelation ?? null;   // 'workOrder'
    if ($parentRel) {
        // eager-load utk macro
        $request->merge(['with' => array_unique([...($request->with ?? []), $parentRel])]);
        // un-ignore kolom parent di metadata
        $parentColumn = Str::snake($parentRel);       // 'work_order'
        // pastikan $columns[$parentColumn] ada & show=true (re-inject bila ter-ignore)
    }
}
```

Bila `$parentRelation` tak ada → `parentColumn = null`, per-item tetap jalan tanpa kolom parent (degradasi anggun).

### 4.4 Error

- model invalid → 422 `{ message: "Model class not found" }`
- relasi `select` invalid → 422 `{ message: "Relation '<x>' does not exist" }`
- macro/db error → 500 (toast frontend `core.errors.fetch_failed`)

## 5. Frontend

### 5.1 Prop `from` (final, disederhanakan)

String | object:

```jsx
<SelectModel
  from={{
    "App\\Models\\Service\\WorkOrder": {
      columns: ["code", "date"],
      filters: { status: "submitted" },             // tree LinkModel — NON-EDITABLE, kirim sbg baseFilters (§3)
      selects: {
        items: {
          columns: ["work_order", "item", "quantity", "remaining_quantity", "unit"],
          filters: { required_quantity: { ">": 0 } },  // tree LinkModel — NON-EDITABLE
        },
      },
      columnAlias: { quantity: "remaining_quantity" },
    },
  }}
  onSelected={mergeItems}
  label={t("...import_items")} variant="secondary" size="sm" className="w-fit"
/>
```

`filters` & `selects[].filters` = **tree LinkModel** (§3), **NON-EDITABLE** — TIDAK dikonversi & TIDAK
ditampilkan di FilterBuilder; dikirim apa adanya sebagai param **`baseFilters`**. Penyederhanaan struktur
diizinkan (R2.5) selama `columns`/`filters`/`selects`/`columnAlias` tetap berfungsi. Singular `select` →
warning dev. JsDoc grammar `filters` wajib (§3.3, R8.7).

### 5.2 Hook `useSelectModel` (`resources/js/Components/SelectModel/useSelectModel.js`)

```js
/**
 * @param {{ from: string|object, onSelected: (payload) => void }} opts
 * @returns {{
 *   open, setOpen, loading,
 *   activeModel, setActiveModel,
 *   activeView, setActiveView,             // SELF_OPTION | relationName
 *   columns, columnMap, parentColumn,
 *   data, pagination:{currentPage,lastPage,perPage,total},
 *   setPerPage, setPage,
 *   sort, setSort, resetSorting,
 *   userFilters, setUserFilters, applyFilters, clearFilters, isDirty,
 *   savedFilterId, setSavedFilterId,        // fid — diisi HANYA saat user pilih saved filter
 *   modelOptions, viewOptions, selectedCount,
 *   confirmSelection, tableRef,
 * }}
 */
```

**State management:**
- Server-state (columns, data, pagination, parentColumn) dalam satu objek state → hindari intermediate tak konsisten.
- `loadData()`: kirim **dua field terpisah** (tanpa konversi/penggabungan FE) — `baseFilters` (dari `from`, tree LinkModel apa adanya) + `filters` (`userFilters` = `FilterBuilder` `value`, `{root:{k,o,v,c}}` native apa adanya); `POST model.selectData { model, select, columns, baseFilters, filters, fid?, sort, page, show, with }`. `fid` hanya disertakan bila `savedFilterId` ada. AbortController cancel request sebelumnya. Debounce 300ms hanya untuk perubahan filter. `userFilters` adalah filter user-only — `from.filters` TIDAK pernah masuk ke sini.
- **Tidak ada persist `saved-filters.store` pada apply biasa** — filter dikirim inline. Persist hanya bila user eksplisit memilih/menyimpan saved filter (di luar scope minimal).
- Ganti model/view → reset filter user, page 1, abort + reload.
- `select` param = `activeView === SELF_OPTION ? null : activeView`.

### 5.3 `confirmSelection` & `onSelected` (rapi)

```js
const confirmSelection = () => {
  const rows = tableRef.current?.getSelectedItem() ?? [];
  if (rows.length === 0) return;                         // R5.6

  let items, model, mode, sourceModel = null, sourceIds = null;
  const relName = viewIsSelf ? firstSelectKey : activeView;

  if (directMode) {                                      // no selects
    items = rows; model = activeModel; mode = "direct";
  } else if (viewIsSelf) {                               // SELF extraction
    items = rows.flatMap(r => r[relName] ?? []);         // flatMap, bukan reduce
    model = relatedModelOf(relName);
    mode = "self-extraction";
    sourceModel = activeModel;
    sourceIds = rows.map(r => r.id);
  } else {                                               // per-item
    items = rows;                                        // item lintas parent apa adanya
    model = activeModel;                                 // = related model (target)
    mode = "per-item";
  }

  const aliased = applyColumnAlias(items, config.columnAlias);
  onSelected({ items: aliased, model, mode, sourceModel, sourceIds });
  setOpen(false);
};
```

`applyColumnAlias(rows, alias)` — fungsi murni; untuk tiap row, `row[target] = row[alias[target]]`.

### 5.4 Komponen `SelectModel.jsx` (rewrite)

**Props (eksternal):**
```jsx
{ title?, label, variant="secondary", size="sm", className?, from, onSelected }
```

**Layout dialog:**
```
┌──────────────────────────────────────────────┐
│ [Title]                                       │
├──────────────────────────────────────────────┤
│ [Model selector*]   [View selector*]          │   *conditional
├──────────────────────────────────────────────┤
│ FilterBuilder (columns, value=tree, onChange) │
│ [Clear] [Apply]                               │
├──────────────────────────────────────────────┤
│ Table2 (selectable, persistColumns=false,     │
│         isDynamicData=true, parentColumn shown)│
├──────────────────────────────────────────────┤
│ [show▼] [‹ 1/5 ›] Total:123 │ [Cancel][Select(N)]│
└──────────────────────────────────────────────┘
```

**Table2 wiring:**
```jsx
<Table2 ref={tableRef} selectable persistColumns={false} isDynamicData
  columns={columnMap} data={data} isLoading={loading}
  options={{ sort, page }} setSort={setSort}
  resetSorting={resetSorting} onOptionsChanged={handleOptionsChanged} />
```
`persistColumns={false}` + `isDynamicData` → `skipCookie=true` di Table2 (tidak menyentuh cookie halaman induk).

**Model selector** (`Select`, hanya bila >1 model):
```jsx
<Select value={activeModel} onValueChange={setActiveModel} options={modelOptions} />
// modelOptions: [{ value: class, label: t(`${translateKey}.title`) ?? class.split("\\").pop() }]
```
`translateKey` per model di-cache (`useRef` map) dari response `model.selectData`.

**View selector** (`Select`, hanya bila `selects` ada):
```jsx
<Select value={activeView} onValueChange={setActiveView}
  options={[{ value: SELF_OPTION, label: t(`${tk}.title`) },
            ...selectKeys.map(k => ({ value: k, label: t(`${tk}.columns.${k}`) }))]} />
```

**Pagination + show:**
```jsx
<div className="flex items-center justify-between border-t px-2 py-2">
  <Select value={String(perPage)} onValueChange={(v)=>setPerPage(Number(v))}
    options={[10,25,50,100].map(n=>({value:String(n),label:String(n)}))} />
  <div className="flex items-center gap-2">
    <Pagination currentPage={pagination.currentPage}
      totalPages={pagination.lastPage} onPageChanged={setPage} />
    <span className="text-sm text-muted-foreground">Total: {pagination.total}</span>
  </div>
</div>
```

**Filter UI:** `<FilterBuilder columns={columnMap} value={userFilters} onChange={setUserFilters} />` + tombol
Clear/Apply (`applyFilters`/`clearFilters` dari hook). `userFilters` = filter user-only (`{root:{k,o,v,c}}`
native); **`from.filters` TIDAK di-set ke `value`** (non-editable, tak tampil). Output `FilterBuilder` dikirim
**apa adanya** sebagai param `filters` — tanpa konversi (§3.4).

**Hapus:** import `PermissionLinkModel`, blok `filterModel`/`normalizeFilters` lama, `configModel` body, `console.log`, blok komentar mati. `qs` dihapus bila tak lagi dipakai (request pakai axios JSON, bukan querystring).

### 5.5 `loadFromModel` (selaras `onSelected`)

```js
/**
 * @param {string} model, @param {string|number} id,
 * @param {string|null} select, @param {function} t (required)
 * @returns {Promise<{items, model, mode, sourceModel, sourceIds} | null>}
 */
export const loadFromModel = async (model, id, select, t) => {
  try {
    // by-id via baseFilters (tree LinkModel) { id } — konsisten dgn kanal baseFilters (§3),
    // tanpa bergantung cabang `id` macro. select null → SELF (direct), select → relasi.
    const res = await axios.post(route("model.selectData"), {
      model,
      select: select ?? undefined,
      baseFilters: { id },                      // tree LinkModel: id = <id>
      with: select ? [select] : undefined,
      show: 1, page: 1,
    });
    const rows = res.data?.data?.data ?? [];
    const resolved = res.data?.model ?? model;
    if (!select) {
      return { items: rows, model: resolved, mode: "direct", sourceModel: null, sourceIds: null };
    }
    return {
      items: rows.flatMap(r => r[select] ?? []),   // ekstrak relasi (mis. items)
      model: resolved,
      mode: "self-extraction",
      sourceModel: model,
      sourceIds: [id],
    };
  } catch (e) {
    gooeyToast.error(t("core.errors.fetch_failed"));
    return null;
  }
};
```

> **By-id terkunci:** `loadFromModel` memakai `model.selectData` dengan `baseFilters: { id }` (tree LinkModel) — bukan cabang `id` macro, bukan `model.datatable`. Return selaras `onSelected` (R6.2). Catatan: saat `select`, `resolved` = model relasi, jadi `r[select]` diekstrak dari row induk yang di-`with`.

## 6. Migrasi Consumer

| Consumer | Perubahan |
|----------|-----------|
| `PurchaseOrders/Form.jsx` | `from` object: `select:`→`selects:`; `filters` tetap tree LinkModel apa adanya (`{ status: "submitted" }`); `columnAlias` tetap (`unordered_quantity`); `mergeItems(value, model)` → `mergeItems({ items, model })`; `loadFromModel(...)` + arg `t`, hasil → `mergeItems(result)` (guard null) |
| `PurchaseRequests/Form.jsx` | sudah `selects:` ✓ (perbaiki bila perlu); `filters` tree LinkModel apa adanya; `mergeItems({ items, model })` |
| `SalesOrders/Form.jsx` | `select:`→`selects:`; `filters` tree LinkModel apa adanya; `columnAlias` (`quantity:remaining_quantity`); `mergeItems({ items, model })`; `loadFromModel` + `t` |

> Filter di `from` TIDAK dikonversi — tree LinkModel dikirim apa adanya sebagai `baseFilters` (NON-EDITABLE) (§3, §5.1).

`mergeItems` baru (contoh PO):
```js
const mergeItems = useCallback(({ items, model }) => {
  setData((prev) => {
    const map = new Map((prev.items ?? []).map(it =>
      [`${it.referenceable_type}_${it.referenceable_id}`, it]));
    items.forEach((item) => {
      const key = `${model}_${item.id}`;
      const next = {
        id: generateRandom(5), item: item.item, description: item.description,
        target_warehouse: item.target_warehouse, required_date: prev.required_date,
        quantity: item.unordered_quantity,           // field dari columnAlias server-side? tidak — alias FE
        unit: item.unit, referenceable_type: model, referenceable_id: item.id,
      };
      if (next.quantity <= 0) { map.delete(key); return; }
      map.set(key, map.has(key) ? { ...map.get(key), ...next } : next);
    });
    return { ...prev, items: Array.from(map.values()) };
  });
}, [setData]);
```

> `columnAlias` diterapkan **di SelectModel** (`applyColumnAlias`) sebelum `onSelected`, sehingga `mergeItems` membaca field yang sudah ter-alias. Verifikasi field yang dibaca tiap `mergeItems` cocok dengan `columnAlias` model masing-masing (TV4).

## 7. Diagram Arsitektur

```
Consumer Form ──<SelectModel from onSelected>──┐
                                               ▼
                                       useSelectModel hook
        ┌──────────────────────────────────────┼─────────────────────────────┐
        ▼                                        ▼                             ▼
  FilterBuilder (ad-hoc, user-only)  Select (model/view)              Table2 + Pagination
        │ onChange → userFilters ({root:{k,o,v,c}})                       ▲ data
        ▼                                                                 │
  baseFilters (from, NON-EDITABLE) + filters (userFilters native) — DUA field, tanpa konversi
        │                                                                 │
        ▼                                                                 │
  POST model.selectData { model, select, columns, baseFilters, filters, fid?, sort, page, show, with }
        │  (baseFilters=LinkModel; filters={root:{k,o,v,c}}; fid HANYA saved filter; AbortController) │
        ▼                                                                 │
  ModelController::selectData                                             │
     resolve target (+ parentRelation per-item)                          │
     getColumns(1) + un-ignore parent  ─────────────────► columns ───────┘
     baseFilters → LinkModelFilterConverter → FilterEvaluator ; filters → FilterEvaluator ;
     fid → FilterEvaluator (macro) ; sort/page/show/submitable (macro)  [semua AND]
        │
        ▼
  { model, route, translateKey, columns, parentColumn, data }
        │
        ▼ user centang → Select(N)
  confirmSelection → mode (direct|self-extraction|per-item)
        │  items = direct:rows | self:flatMap(r[rel]) | per-item:rows
        ▼
  applyColumnAlias → onSelected({ items, model, mode, sourceModel, sourceIds }) → mergeItems
```

## 8. Risiko & Mitigasi

| Risiko | Mitigasi |
|--------|----------|
| Filter tree LinkModel salah grammar → query error | Ikuti §3.1 operator persis; converter+`FilterEvaluator` skip item invalid diam-diam (aman); feature test operator (`=`,`>`,`in`,`like`,`or`,relasi,date,between) |
| `from.filters` bocor ke FilterBuilder → jadi editable/tampil | `FilterBuilder` `value` = `userFilters` user-only; `from.filters` HANYA dikirim sbg `baseFilters` (tak pernah di-set ke value) |
| `getColumns` `usort` by name → urutan hilang (`:624`) | Frontend re-sort by `order` di `columnMap` (pertahankan logic FE) |
| Macro `dataTable` baca cookie kolom per-path | Andalkan `showedColumns`/`columns` body sbg sumber visible; `persistColumns={false}` di Table2 |
| Filter diterapkan di luar macro (sort/paginate) | `selectData` apply `baseFilters`+`filters` via `FilterEvaluator` (where-closure → AND otomatis) sebelum macro paginate; macro hanya `fid`/sort/page/show/submitable (§4.2) |
| Relasi parent `ignore:true` → per-item tak punya kolom asal | un-ignore kondisional via `$parentRelation` (§4.3); degradasi anggun. **✅ FIXED (§8.1):** re-inject kolom relasi parent ke `$columns` (metadata) + `addSelect` FK eksplisit sebelum macro (data). |
| `onSelected` breaking → consumer rusak | Migrasi ketiga `mergeItems` ke objek tunggal; uji manual end-to-end |
| `columnAlias` arah keliru → quantity 0/null | `applyColumnAlias` di FE sebelum callback; test TV4 (SO `remaining_quantity`, PO `unordered_quantity`) |
| `loadFromModel` by-id | Terkunci: `baseFilters: { id }` (tree LinkModel) ke `model.selectData` (§5.5); kontrak return §6 |

### 8.1 BUG (R9.2 + R9.3) — Kolom parent absen + eager-load gagal saat `ignore:true` — ✅ FIXED

**Ditemukan oleh:** `tests/Feature/Http/ModelSelectDataTest` (`test_select_parent_column_present_in_metadata`, `test_select_eager_loads_parent_relation_in_data`).

**Gejala:** Di per-item mode, saat relasi parent ber-`ignore:true` di `configColumns` child (persis kondisi `WorkOrderItem::workOrder` & `PurchaseRequestItem::purchaseRequest`):
- **R9.3:** `getColumns` membuang relasi `ignore:true` (`LinkModel.php:605`); loop un-ignore `selectData` hanya men-set `show=true` BILA kolom sudah ada → NO-OP. `parentColumn` string ter-set tapi **kolom absen** dari array `columns`.
- **R9.2:** `data.parent = null` walau `with:[parent]` ditambahkan. Akar: macro `dataTable` membangun ULANG metadata via `getColumns(1)` internal (`DataTableScope:51`) — mengabaikan `$columns` yang di-inject `selectData` — sehingga adaptive-select tak tahu perlu FK relasi `ignore:true` → FK `<parent>_id` **tak ikut SELECT** → `belongsTo` null.

**Fix diterapkan (`ModelController::selectData`):** dua tindakan terpisah karena dua sumber pembacaan kolom berbeda (response metadata vs query macro):
1. **Re-inject** entri kolom relasi parent ke `$columns` (`name`, `type=relation`, `nameOfFunction=$parentRel`, `show=true`) → fix R9.3 metadata.
2. **`addSelect("{$targetTable}.{$fkParent}")`** eksplisit sebelum macro (akumulatif dengan adaptive-select) → fix R9.2 data.

**Catatan kunci:** `nameOfFunction` HARUS relasi balik di child (`$parentRel`, mis. `workOrder`), bukan `$select` (relasi parent→child). Macro tetap me-`with(parent)` via `$request->merge` (`:321`).

**Verifikasi:** `test_select_parent_column_present_in_metadata` & `test_select_eager_loads_parent_relation_in_data` HIJAU; suite penuh `ModelSelectDataTest` hijau (13 test).

## 9. Data Models

Tidak ada migrasi DB. Endpoint membaca metadata via `getColumns()`, preference `num_per_page`, dan `saved_filters` (sudah ada). `$parentRelation` sudah ada di item model.

## 10. Testing Strategy

- **Backend PHPUnit** (`tests/Feature/Http/ModelSelectDataTest.php`):
  - model valid tanpa `select` → response shape (`model,route,translateKey,columns,data` paginated).
  - model valid + `select` valid → `model` = related class; `parentColumn` terisi; relasi parent ter-load di data.
  - model invalid → 422; `select` invalid → 422.
  - `baseFilters` (tree LinkModel: `=`,`>`,`in`,`like`,`or`,relasi nested,date→in_period) → hasil terfilter.
  - `filters` (`{root:{k,o,v,c}}` builder native) → hasil terfilter; `baseFilters`+`filters` bersama → AND.
  - `fid` (SavedFilter) → hasil terfilter (buat SavedFilter via factory/seed); kombinasi dgn baseFilters/filters → AND.
  - `sort`/`page`/`show` → urutan & pagination benar.
  - submitable scope diterapkan.
  - jalankan `php artisan test --compact --filter=ModelSelectData`.
- **Frontend (manual):** PO Form — self-extraction (semua items 1 WO), per-item (item lintas WO+PR). Filter apply (FilterBuilder native → terfilter; `from.filters` non-editable tetap berlaku), clear, pagination, per-page. `mergeItems` menerima objek tunggal. SO/PR regresi. `loadFromModel` deep-link (by-id `baseFilters:{id}`).
- **Lint (akhir):** `vendor/bin/pint --dirty --format agent` + eslint.

## 11. Implementation Notes

1. Debounce 300ms hanya untuk filter; model/view/page/sort fetch langsung.
2. `SELF_OPTION = "__self__"` dipertahankan.
3. Sort convention: prefix `-` = desc (sama existing).
4. `FilterBuilder` dipakai langsung — JANGAN bangun ulang `FilterItem`.
5. Filter dikirim sbg dua field (`baseFilters` tree LinkModel + `filters` `{root:{k,o,v,c}}` native) via axios JSON — bukan querystring, bukan persist → `qs` bisa dihapus. `fid` hanya saat user pilih saved filter.
6. Selected count: `tableRef.current.getSelectedItem().length` atau reaktif via `data.filter(x=>x.isSelected)`.
