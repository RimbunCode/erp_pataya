# Design Document: Value-Before Optimization & Diff-Highlight Rollout

## Overview

Fitur log ERP menyimpan snapshot `data_before` & `data_after` (JSON) tiap dokumen diubah. Saat user klik **"Tampilkan Perbedaan"**, halaman `ShowLog` me-mount `FormPageDiff` yang me-render ulang **Form.jsx dokumen yang sama** dalam mode read-only, meng-inject `dataBefore` + `data`(=`dataAfter`) ke context. Field yang berubah di-highlight kuning + tooltip strikethrough (old → new).

Struktur `valueBefore` saat ini **belum optimal**:

1. **Hanya `LinkModel` yang mengimplementasi.** `Select` & `DatetimePicker` punya kode diff tetapi **di-comment total**; `NumberInput`, base `Input`, `Textarea`, `FormCheckbox`, `FormTable` **tidak ada** dukungan.
2. **Perbandingan hanya string-label.** LinkModel memakai `convertTemplateLink()` yang mengembalikan `""` untuk non-model (angka/tanggal/teks/boolean) → primitif tidak bisa di-diff.
3. **Prop-drill manual per field.** Tiap field harus menulis `valueBefore={dataBefore.X}` secara manual. Terbukti rawan: satu-satunya konsumen nyata = `Services/WorkOrders/Form.jsx` (3 field, semua LinkModel). `Items/FormDetail.jsx` menerima `dataBefore` tetapi tidak mengaplikasikannya sama sekali.

**Tujuan design ini:** membuat diff-highlight jalan **otomatis** di **semua ~40 modul** dengan perubahan Form.jsx seminimal mungkin, untuk **semua tipe input** termasuk line-items (`FormTable`).

### Keputusan desain (terkonfirmasi user)

| Aspek | Keputusan |
|---|---|
| Distribusi `valueBefore` | **Auto-diff via context** — `FormInput` inject otomatis by field `name`. + escape hatch (`ignoreDiff` / override eksplisit). |
| Logika perbandingan | **Helper generik `isChanged`** type-aware — satu sumber kebenaran. |
| FormTable (line-items) | **Row + cell highlight** — baris baru=hijau, dihapus=merah strikethrough, cell berubah=kuning. |

## Architecture

### Alur data (tidak berubah — konteks)

```
Log (data_before / data_after : JSON cast)
  └─ LogController@show ──► Inertia props { dataBefore, dataAfter, log, formPathname }
       └─ Pages/Core/ShowLog.jsx  (lazy-load Form via formPathname)
            └─ FormPageDiff (FormPage.jsx)  baca usePage().props.{dataBefore, dataAfter}
                 └─ FormChildren (dataBefore + data)
                      └─ FormPageProvider  ──► FormPageContext.dataBefore
                           └─ Form.jsx dokumen  (read-only, disabled)
                                └─ FormInput / komponen input  ──► highlight bila before ≠ after
```

**Fakta kunci yang memungkinkan auto-diff:**

- `dataBefore` dan `data`(=`dataAfter`) **shape-nya identik**: keduanya `$model->toArray()` (relasi ter-load `loadRelationsOnShow()`), difilter `logableFields()`, key-aligned per field. (`app/Traits/DataTable.php:98-152, 237-240`)
- **`name` di `FormInput` == key `dataBefore`**: `<FormInput name="customer">` ↔ `setData("customer")` ↔ `dataBefore.customer`. Konvensi konsisten di semua Form.jsx.
- **`dataBefore` di form normal = `{}`** (di-stub `FormPageProvider`), jadi auto-diff aman: tidak ada highlight di mode edit biasa.

### Aliran auto-inject (baru)

```
FormPageProvider  ──►  metaContextValue { disabled, errors, fieldNameTrans, dataBefore }   ◄── TAMBAH dataBefore
       └─ FormInput  useFormPageMeta()
            └─ hitung diffValue = dataBefore[name]   (bila mode diff & tidak ignoreDiff)
                 └─ cloneElement/render-prop child:  valueBefore = child.valueBefore ?? diffValue   ◄── eksplisit menang
                      └─ komponen input  (LinkModel/Select/Datetime/Number/Input/Textarea/Checkbox)
                           └─ isChanged(valueBefore, value) ? highlight + tooltip : normal
```

## Components and Interfaces

### 1. `resources/js/lib/diffUtils.js` — **BARU**

Satu sumber kebenaran perbandingan + kelas highlight.

```js
import { isEqual } from "lodash";
import { convertTemplateLink } from "@/lib/linkModelUtils";

const normalize = (v) => {
  if (v == null || v === "") return null;
  if (v instanceof Date) return v.getTime();
  if (typeof v === "object" && v.templateLink) return convertTemplateLink(v);
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "" && !isNaN(v)) return Number(v);
  return v;
};

export const isChanged = (before, after) => {
  const a = normalize(before);
  const b = normalize(after);
  if (a == null && b == null) return false;
  if (typeof a === "object" || typeof b === "object") return !isEqual(a, b);
  return a !== b;
};

export const DIFF_HIGHLIGHT = "bg-yellow-200 dark:bg-yellow-900";
export const DIFF_ADDED = "bg-green-100 dark:bg-green-900/40";
export const DIFF_REMOVED = "bg-red-100 dark:bg-red-900/40 line-through";
```

**Cabang tanggal ISO** (keputusan): backend Laravel serialize Carbon → `toArray()` menghasilkan string ISO 8601 konsisten (`data_before`/`data_after`), sedang `value` di form Date object. `normalize` deteksi string berformat ISO date (`/^\d{4}-\d{2}-\d{2}/`) → `new Date(v).getTime()`, sejajar cabang `Date instanceof`:

```js
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?)?/;
const normalize = (v) => {
  if (v == null || v === "") return null;
  if (v instanceof Date) return v.getTime();
  if (typeof v === "string" && ISO_DATE_RE.test(v)) {
    const t = new Date(v).getTime();
    if (!Number.isNaN(t)) return t;
  }
  if (typeof v === "object" && v.templateLink) return convertTemplateLink(v);
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "" && !isNaN(v)) return Number(v);
  return v;
};
```

### 2. `resources/js/Pages/Core/FormPage.jsx`

`FormPageProvider` (baris ~586-593): sertakan `dataBefore` ke `metaContextValue` (saat ini hanya `disabled/errors/fieldNameTrans`). Tidak ada perubahan alur lain.

### 3. `resources/js/Components/FormInput.jsx`

- Baca `dataBefore` dari `useFormPageMeta()`.
- `_name` sudah dihitung (`name || firstChild.props.name`).
- Prop baru **`ignoreDiff`** (opt-out).
- Inject default `valueBefore`:

```js
const diffValue =
  !ignoreDiff && _name && form?.dataBefore && Object.keys(form.dataBefore).length
    ? form.dataBefore[_name]
    : undefined;
// saat clone / render-prop:  valueBefore: child.props?.valueBefore ?? diffValue
```

**Edge case wajib:** ada `name` duplikat/salah, mis. `SalesOrders/Form.jsx:347` `name="date"` padahal child value `data.referenceable`. Untuk itu: child `valueBefore` eksplisit selalu menang, dan field seperti ini ditandai `ignoreDiff`.

### 4. Dukungan `valueBefore` pada komponen input

Semua memakai `isChanged` + `DIFF_HIGHLIGHT`, pola sama LinkModel (highlight wrapper + tooltip strikethrough).

| Komponen | Perubahan |
|---|---|
| `LinkModel.jsx` | Refactor `diff` memo → pakai `isChanged` (model tetap via `convertTemplateLink`, backward-compat). |
| `Select.jsx` | Un-comment + benahi; diff via label option (`getOption(valueBefore)?.label`). |
| `DatetimePicker.jsx` | Terima `valueBefore`; diff via `getDateValue()` / `isChanged`. |
| `NumberInput/index.jsx` | Terima `valueBefore`; bungkus `<input>` dengan wrapper highlight; before via `formatNumber`. |
| `ui/input.jsx`, `ui/textarea.jsx` | `valueBefore` opsional; Textarea manfaatkan `StrikethroughDiff.jsx` (saat ini dead code) untuk tooltip diff teks. |
| `ui/checkbox.jsx` (FormCheckbox) | `valueBefore` boolean; tooltip "sebelum: ✓/✗". |

### 5. `resources/js/Components/FormTable.jsx` — row + cell diff

- Baca `dataBefore` dari context; ambil array before via `name` tabel (mis. `name="SalesOrderItems"` → key items) atau `valueBefore` eksplisit.
- Match baris before↔after **by `id`** (fallback index).
- Teruskan `valueBefore` per-cell ke `col.cell(...)` — tambah field `dataRowBefore` / `dataBefore` di object argumen `col.cell` (sejajar `dataRow`/`data`, `CellComponent` baris ~149-165).
- Baris hijau (`DIFF_ADDED`) untuk baris baru; merah strikethrough (`DIFF_REMOVED`) untuk baris hilang; cell kuning untuk field berubah.
- Aktif **hanya saat `disabled`** (mode diff).

**Ghost row** (keputusan): baris yang ada di `before` tapi hilang di `after` disisipkan **di posisi index asalnya** (bukan di akhir tabel) — urutan asli dokumen lebih mudah dibaca user saat dibandingkan dengan versi setelah. Implementasi: saat membangun array gabungan untuk render, iterasi `before` dan `after` sekaligus by matched `id`; baris `before` tanpa pasangan di `after` di-inject pada index kemunculannya di `before`, ditandai `__diffStatus: "removed"` (vs `"added"` untuk baris `after` tanpa pasangan di `before`, `"changed"`/`undefined` untuk baris ter-match).

### 6. Rollout modul (~40 Form.jsx + sub-form)

Karena auto via context, mayoritas Form.jsx **tidak perlu diedit**. Tugas:

- Audit `name` tiap `FormInput` (`resources/js/Pages/**/Form.jsx` + sub-form seperti `FormDetail.jsx`) — pastikan match key `dataBefore`.
- Tandai `ignoreDiff` untuk field readonly/referenceable yang value-nya ≠ `data[name]`.
- Pastikan `name` `FormTable` = key array di `dataBefore`.
- Opsional: bersihkan prop-drill manual lama di `WorkOrders/Form.jsx` (eksplisit tetap kompatibel, tidak konflik).

## Data Models

Tidak ada perubahan skema/backend. `data_before`/`data_after` (`json` cast via `App\Casts\Json`) sudah menyediakan shape yang cukup dan di-spec sebagai out-of-scope untuk diubah (lihat `global-log-viewer` spec). **Fitur ini FE-only.**

## Error Handling & Edge Cases

- **Field tanpa `name`** → `diffValue` `undefined` → tidak highlight (aman, degradasi mulus).
- **`name` salah/duplikat** → `ignoreDiff` atau override `valueBefore` eksplisit.
- **Tanggal string ISO vs Date object** → ditangani `normalize` (cabang regex ISO-date, lihat §1).
- **Mode edit normal** (`dataBefore={}`) → semua field tidak highlight.
- **Dokumen di-hard-delete** → `formPathname=''`, form tidak ditemukan; diff data tetap dikirim (di luar scope FE ini).

## Testing Strategy

- **Manual mode diff**: edit dokumen (Sales Order: ubah customer, tanggal, qty item, tambah/hapus baris) → buka log → "Tampilkan Perbedaan":
  - Skalar berubah → kuning + tooltip strikethrough.
  - Item baru → hijau; item dihapus → merah strikethrough; qty berubah → cell kuning.
- **Regresi edit normal**: form create/edit → tidak ada highlight.
- **Edge case** `SalesOrders/Form.jsx:347` → tidak salah highlight setelah `ignoreDiff`.
- **Cross-module**: LinkModel-heavy (Purchase Order), primitive-heavy (Item detail), FormTable-heavy (Sales Invoice line items).
- **Build FE hanya di akhir** (`npm run build`); lint/Pint hanya setelah semua task selesai.
- **Unit test** (keputusan): project sudah pakai Vitest secara konsisten untuk util `lib/*` (mis. `resources/js/lib/linkModelToFilterTree.test.js`). Tambah `resources/js/lib/diffUtils.test.js` menutup kasus: model (`templateLink`), tanggal (Date vs ISO string vs beda hari), angka (number vs numeric-string), string biasa, boolean, null/undefined/`""` (dianggap sama), array (via `isEqual`).

## Keputusan atas Open Questions (final)

1. **Tanggal ISO**: dikonfirmasi — backend serialize Carbon via `toArray()` → ISO 8601 string konsisten. `normalize` tambah cabang regex ISO-date → `Date.getTime()`.
2. **Ghost row**: disisipkan **di posisi index asalnya** di `before`, ditandai `__diffStatus`.
3. **Unit test**: **ya**, tambah `diffUtils.test.js` (Vitest) — konsisten pola project untuk util `lib/*`.
4. **Prop-drill lama `WorkOrders/Form.jsx`**: **dibiarkan** — `valueBefore` eksplisit tetap kompatibel (menang atas auto-inject), tidak ada konflik, hemat kerja perubahan.
