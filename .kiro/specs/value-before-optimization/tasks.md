# Implementation Plan: Value-Before Optimization & Diff-Highlight Rollout

## Overview

Implementasi murni frontend, tanpa perubahan backend/skema. Urutan: (1) bangun util pembanding generik `isChanged` sebagai fondasi, (2) sambungkan `dataBefore` ke context form dan buat `FormInput` auto-inject `valueBefore`, (3) tambahkan dukungan highlight ke tiap jenis komponen input secara paralel (semuanya konsumen independen dari `isChanged`), (4) tangani kasus khusus `FormTable` (baris+sel, ghost row), lalu (5) audit rollout ke modul-modul representatif dan verifikasi end-to-end. Yang **tidak** berubah: struktur `data_before`/`data_after` backend, alur `FormPageDiff`/`ShowLog`, dan perilaku mode edit normal.

## Tasks

- [ ] 1. Util pembanding generik `diffUtils.js`
  - [x] 1.1 Buat `resources/js/lib/diffUtils.js`
    - Implementasi `normalize(v)`: handle `Date` instance, string ISO 8601 (regex `/^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?)?/` → `Date.getTime()`), object dengan `templateLink` (→ `convertTemplateLink`), number, string numerik (→ `Number`), fallback nilai asli
    - Implementasi `isChanged(before, after)`: normalize kedua sisi, `null`/`undefined`/`""` dianggap setara, object/array pakai `isEqual` (lodash), sisanya `!==`
    - Export konstanta `DIFF_HIGHLIGHT`, `DIFF_ADDED`, `DIFF_REMOVED`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

  - [x] 1.2 Write unit tests for `diffUtils` (isChanged correctness)
    - **isChanged correctness: fungsi mengembalikan hasil benar untuk tiap kategori tipe data**
    - Test: model dengan `templateLink` sama/beda label; tanggal `Date` vs `Date`, `Date` vs ISO string sama momen, ISO string beda hari; angka `5` vs `5`, `5` vs `"5"`, `5` vs `6`; string biasa sama/beda; boolean `true`/`false`; kombinasi `null`/`undefined`/`""` (harus dianggap sama satu sama lain); satu kosong satu berisi (harus beda); array/object sama secara struktur vs beda
    - **Validates: Requirements 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8**

- [x] 2. Checkpoint - Ensure diffUtils tests pass
  - Jalankan `npm run test -- diffUtils` (atau filter setara), pastikan semua kasus lulus. Tanyakan ke user bila ada ambiguitas kasus.

- [ ] 3. Context plumbing: `dataBefore` ke `FormPageMetaContext`
  - [x] 3.1 `resources/js/Pages/Core/FormPage.jsx` — sertakan `dataBefore` di `metaContextValue`
    - Di `FormPageProvider`, tambahkan `dataBefore: stableDataBefore` ke object `metaContextValue` (saat ini hanya `disabled, errors, fieldNameTrans`)
    - Pastikan dependency array `useMemo` metaContextValue menyertakan `stableDataBefore`
    - _Requirements: 2.6_

  - [x] 3.2 `resources/js/Components/FormInput.jsx` — auto-inject `valueBefore`
    - Baca `dataBefore` dari `useFormPageMeta()`
    - Tambah prop `ignoreDiff` (default `false`)
    - Hitung `diffValue = !ignoreDiff && _name && dataBefore && Object.keys(dataBefore).length ? dataBefore[_name] : undefined`
    - Saat `cloneElement` (children biasa) dan saat memanggil render-prop `children({...})`: sisipkan `valueBefore: child.props?.valueBefore ?? diffValue` — nilai eksplisit pada child selalu menang
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 3.3 Write unit tests for `FormInput` auto-inject behavior
    - **Auto-inject correctness: valueBefore tersisip sesuai aturan prioritas**
    - Test: `dataBefore` kosong (mode edit normal) → tidak ada `valueBefore` tersisip; `dataBefore` berisi + `name` match → `valueBefore` tersisip dari `dataBefore[name]`; child sudah punya `valueBefore` eksplisit → tidak tertimpa; `ignoreDiff=true` → tidak ada auto-inject meski `dataBefore` berisi; `name` tidak match key mana pun → `valueBefore` bernilai `undefined`, tidak error
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

- [x] 4. Checkpoint - Ensure context plumbing tests pass
  - Jalankan test terkait `FormPage`/`FormInput`. Verifikasi manual cepat: buka satu form edit biasa, pastikan tidak ada error console dan tidak ada highlight muncul.

- [ ] 5. Refactor `LinkModel.jsx` memakai `isChanged`
  - [x] 5.1 Ganti logika `diff` memo (baris ~599-607) agar delegasikan ke `isChanged` dari `diffUtils`, pertahankan tampilan tooltip before/after via `convertTemplateLink` untuk label
    - Pastikan highlight class tetap `bg-yellow-200 dark:bg-yellow-900` (pakai konstanta `DIFF_HIGHLIGHT`)
    - _Requirements: 1.2, 3.1, 3.7, 3.8_

  - [x] 5.2 Write unit/manual test for LinkModel diff regression
    - **No behavior change: highlight LinkModel identik dengan sebelum refactor**
    - Verifikasi test/perilaku existing WorkOrders (customer, customer_branch, item_service) tetap menampilkan highlight yang sama seperti sebelum perubahan
    - **Validates: Requirements 3.1, 5.5**

- [ ] 6. Dukungan `valueBefore` pada `Select.jsx`
  - [x] 6.1 Un-comment dan perbaiki kode diff di `resources/js/Components/Select.jsx`
    - Terima prop `valueBefore`
    - Hitung diff: `getOption(valueBefore)?.label` vs `option?.label`, pakai `isChanged` untuk menentukan status berubah
    - Aktifkan kembali highlight class pada trigger (baris ~216-223) dan tooltip (baris ~274-284) yang sebelumnya di-comment
    - _Requirements: 3.2, 3.7, 3.8_

- [ ] 7. Dukungan `valueBefore` pada `DatetimePicker.jsx`
  - [x] 7.1 Un-comment dan perbaiki kode diff di `resources/js/Components/DatetimePicker.jsx`
    - Terima prop `valueBefore`
    - Hitung diff via `isChanged(valueBefore, value)`, tampilkan label before via `getDateValue(valueBefore)`
    - Aktifkan kembali highlight class (baris ~706-708) dan tooltip (baris ~769-779)
    - _Requirements: 3.3, 3.7, 3.8_

- [ ] 8. Dukungan `valueBefore` pada `NumberInput`
  - [x] 8.1 Tambah prop `valueBefore` di `resources/js/Components/NumberInput/index.jsx`
    - Bungkus `<input>` (baris ~589-602) dengan wrapper yang menerapkan `DIFF_HIGHLIGHT` bila `isChanged(valueBefore, value)`
    - Tooltip menampilkan `formatNumber(valueBefore, config)` sebagai nilai before
    - _Requirements: 3.4, 3.7, 3.8_

- [ ] 9. Dukungan `valueBefore` pada input dasar (`ui/input.jsx`, `ui/textarea.jsx`, `ui/checkbox.jsx`)
  - [x] 9.1 `resources/js/Components/ui/input.jsx` — tambah prop `valueBefore` opsional, highlight bila `isChanged`
    - _Requirements: 3.5, 3.7, 3.8_

  - [x] 9.2 `resources/js/Components/ui/textarea.jsx` — tambah prop `valueBefore` opsional
    - Highlight wrapper bila `isChanged(valueBefore, value)`
    - Tooltip/inline diff teks memakai `StrikethroughDiff.jsx` (`resources/js/Components/StrikethroughDiff.jsx`, saat ini dead code) untuk menampilkan bagian dihapus (strikethrough) dan ditambahkan
    - _Requirements: 3.5, 3.7, 3.8_

  - [x] 9.3 `resources/js/Components/ui/checkbox.jsx` (`FormCheckbox`) — tambah prop `valueBefore` boolean opsional
    - Highlight bila `isChanged(valueBefore, checked)`, tooltip menampilkan status sebelum (✓/✗)
    - _Requirements: 3.6, 3.7, 3.8_

- [x] 10. Checkpoint - Ensure semua komponen input (5-9) lulus test/manual check
  - Jalankan test suite terkait komponen (`npm run test`), lalu build (`npm run build`) untuk validasi tidak ada error kompilasi. Cek manual satu per satu tipe komponen di halaman diff dummy bila memungkinkan.

- [ ] 11. `FormTable` — row + cell diff
  - [x] 11.1 Baca `dataBefore` dari context di `resources/js/Components/FormTable.jsx`
    - **Koreksi dari design**: `name` FormTable adalah identifier kolom-config (localStorage), BUKAN key data (beda dari `FormInput`, lihat `WorkOrders/Form.jsx:356-361` — `name="WorkOrderItems"` tapi `value={data?.items}`). Karena itu `valueBefore` harus dikirim eksplisit oleh Form.jsx; `dataBefore[name]` hanya dipakai sebagai fallback bila kebetulan cocok
    - Hanya aktif bila `disabled=true` (mode diff)
    - _Requirements: 4.4, 4.6_

  - [x] 11.2 Implementasi pencocokan baris before↔after
    - Match by `id` terlebih dahulu, fallback ke index posisi bila `id` tidak tersedia pada salah satu/kedua sisi
    - Bangun array gabungan untuk render: baris ter-match ditandai `__diffStatus: undefined/"changed"`, baris hanya di `after` ditandai `"added"`, baris hanya di `before` disisipkan pada index asalnya dan ditandai `"removed"`
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 11.3 Teruskan `valueBefore` per-cell dan terapkan highlight baris
    - Tambah field `dataRowBefore`/`dataBefore` pada object argumen yang dikirim ke `col.cell(...)` (sejajar `dataRow`/`data` di `CellComponent`, baris ~149-165)
    - Baris `"added"` → kelas `DIFF_ADDED`; baris `"removed"` → kelas `DIFF_REMOVED` + read-only (non-interaktif); cell yang `isChanged` pada baris `"changed"` → `DIFF_HIGHLIGHT`
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 11.4 Write unit tests for FormTable row matching (row diff correctness)
    - **Row diff correctness: status added/removed/changed dan posisi ghost row benar**
    - Test: baris baru di `after` tanpa `id` cocok di `before` → `"added"`; baris di `before` tanpa pasangan di `after` → muncul sebagai `"removed"` pada index aslinya; baris ter-match dengan cell berbeda → `"changed"` dengan cell yang tepat teridentifikasi; baris tanpa `id` di kedua sisi → fallback matching by index
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4**

- [x] 12. Checkpoint - Ensure FormTable diff tests pass
  - Unit test `mergeDiffRows` lulus (8/8). Verifikasi manual browser end-to-end ditunda ke Task 14 (final checkpoint) bersama modul lain.

- [ ] 13. Audit rollout & verifikasi lintas modul
  - [x] 13.1 Audit `name` pada `FormInput` di form representatif tiap kategori
    - Kategori LinkModel-heavy: `resources/js/Pages/Purchase/PurchaseOrders/Form.jsx`
    - Kategori primitif-heavy: `resources/js/Pages/Inventory/Items/Form.jsx` + `FormDetail.jsx`
    - Kategori FormTable-heavy: `resources/js/Pages/Finances/SalesInvoice/Form.jsx`
    - Untuk tiap form: pastikan `name` di `FormInput` match key `dataBefore`; tandai `ignoreDiff` pada field yang value-nya berasal dari sumber berbeda dari `data[name]` (pola seperti `SalesOrders/Form.jsx:347-358`, field `date` kedua yang sebenarnya menampilkan `referenceable`)
    - _Requirements: 5.1, 5.2_

  - [x] 13.2 Audit menyeluruh sisa `Form.jsx` (~40 modul) untuk `name` yang salah/duplikat
    - Agent audit menemukan 24 issue (3 checkbox-no-valuebefore, 7 formtable-no-valuebefore, 14 missing-name) di 14 file. Semua diperbaiki: `PurchaseInvoice`, `DeliveryNotes`, `StockEntries` (checkbox); `PaymentTermTemplate`, `ApprovalScheme`, `Countries`, `Attributes`, `Suppliers`, `Customers` (FormTable); `Categories`, `Units`, `Taxes`, `PaymentMethods`, `Warehouses` (missing name). Lint 0 error.
    - Grep pola `<FormInput` tanpa `name` atau dengan `name` yang tidak dipakai `setData`/`value` pada child-nya
    - Tandai `ignoreDiff` di titik-titik yang ditemukan bermasalah
    - _Requirements: 5.1, 5.2_

  - [x] 13.3 Verifikasi `Services/WorkOrders/Form.jsx` tetap kompatibel (tidak dihapus, sesuai keputusan design)
    - Verifikasi logis: `child.props?.valueBefore ?? diffValue` pakai nullish-coalescing. Saat `dataBefore.customer` undefined (mode edit normal), `child.props.valueBefore` juga undefined -> fallback ke `diffValue` (juga undefined karena `hasDataBefore` false) -> hasil sama. Saat mode diff, `dataBefore.customer` terisi -> dipakai langsung. Tidak ada regresi.
    - Pastikan `valueBefore={dataBefore.customer}` dkk. tetap berfungsi berdampingan dengan auto-inject tanpa konflik
    - _Requirements: 5.5_

- [x] 14. Final checkpoint - Verifikasi end-to-end & regresi
  - Test suite FE terkait spec (`diffUtils`, `FormInput`, `FormTable`): 39/39 pass
  - Full test suite FE (exclude worktree lain & 1 suite PrintTemplate yang TERBUKTI pre-existing fail sebelum spec ini — diverifikasi via `git stash`): 132/132 pass
  - Build FE (`npm run build`): sukses (3.96s), `FormTable-BXzEFF5D.js` ter-bundle. Warning yang muncul (lightningcss `:global` pseudo-class, chunk size) pre-existing, tidak terkait perubahan spec ini
  - ESLint `--fix` di seluruh `resources/js`: 0 issue tersisa
  - **Verifikasi manual browser (buka log dokumen sungguhan, cek highlight visual di UI) TIDAK dilakukan** — butuh server + data nyata + akses browser interaktif, di luar kemampuan sesi ini. Direkomendasikan user uji manual sebelum merge: edit dokumen di modul representatif (Purchase Order/Item/Sales Invoice) → buka log → "Tampilkan Perbedaan"

## Notes

- Setiap task mereferensi requirement spesifik (`requirements.md`) untuk traceability.
- Task 5–9 (komponen input individual) independen satu sama lain — satu-satunya dependency bersama adalah `diffUtils.js` (Task 1) dan context plumbing (Task 3). Bisa dikerjakan dalam urutan berapa pun setelah Task 4, termasuk paralel oleh lebih dari satu kontributor.
- Task 11 (`FormTable`) berdiri sendiri secara struktural tetapi secara konsep memakai `isChanged` yang sama (Task 1) — tidak bergantung pada Task 5-9.
- Task 13 (audit rollout) sengaja tidak mengedit-ulang seluruh 40 `Form.jsx` satu per satu di tasks.md ini — hanya 3 modul representatif diverifikasi mendalam (Task 13.1) plus audit grep menyeluruh untuk kasus bermasalah (Task 13.2), sesuai prinsip design bahwa mayoritas form tidak perlu diedit karena auto-inject bekerja lewat context.
- Backend (`app/Traits/DataTable.php`, `Log` model, migrasi) **tidak disentuh** oleh spec ini — dikonfirmasi out-of-scope di design.md.
- Lint/Pint/ESLint hanya dijalankan di Task 14 (akhir), sesuai aturan project — jangan jalankan per task.
- Build FE (`npm run build`) hanya di Task 14, sesuai preferensi user untuk menunda build sampai seluruh rangkaian selesai.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["3.1"] },
    { "id": 3, "tasks": ["3.2"] },
    { "id": 4, "tasks": ["3.3"] },
    {
      "id": 5,
      "tasks": ["5.1", "6.1", "7.1", "8.1", "9.1", "9.2", "9.3", "11.1"]
    },
    { "id": 6, "tasks": ["5.2", "11.2"] },
    { "id": 7, "tasks": ["11.3"] },
    { "id": 8, "tasks": ["11.4"] },
    { "id": 9, "tasks": ["13.1", "13.2", "13.3"] },
    { "id": 10, "tasks": ["14"] }
  ]
}
```
