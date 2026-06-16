# Tasks: number-input-total-migration

Status: `[ ]` todo · `[~]` queued · `[-]` in progress · `[x]` done

> Aturan: satu task sekaligus. Tandai `[-]` saat mulai, `[x]` hanya jika implementasi + validasi pass. Sebut file berubah tiap task. Lint/ESLint hanya di akhir. PHP tidak tersentuh → Pint skip.

## Fase 0 — Enhancement komponen (prasyarat)

- [ ] T00 `currencyCode` terima string ATAU object di `useCurrency`
  - File: `resources/js/Components/NumberInput/useCurrency.js`, `resources/js/Components/NumberInput/index.test.js` (+ `getCurrencyConfig.js` bila perlu)
  - string → jalur `getCurrencyConfig` (lama). object dengan `symbol` → pakai langsung tanpa fetch. object tanpa `symbol` → fallback fetch by `object.code`. null → symbol null.
  - Return tetap `{ symbol, loading }`. Object-path tidak di-cache.
  - Validasi: `npx vitest run` — test string-path, object-with-symbol, object-without-symbol pass.

## Fase 1 — Migrasi formatValue → formatNumber (paling berisiko, dahulukan)

- [ ] T01 Migrasi `variableTokenUtils.js` + update `variableTokenUtils.test.js`
  - File: `resources/js/Pages/Core/PrintTemplate/utils/variableTokenUtils.js`, `.../variableTokenUtils.test.js`
  - Currency-path (`locale:"id", currency:"IDR"`) → resolve symbol, pass `prefix`. Numeric-path → `decimalScale`.
  - Validasi: `npx vitest run variableTokenUtils` pass + output string identik.

- [ ] T02 Migrasi `formatValue` sisa: `initHandlebar.js`, `gjsRelationsTable.js`, `PrintPreview.jsx`
  - File: `resources/js/lib/initHandlebar.js`, `resources/js/lib/gjsRelationsTable.js`, `resources/js/Pages/Core/Components/PrintPreview.jsx`
  - **PrintPreview.formatData** (pure function): precedence currency 3-level (sama Table2) — `col.currencyCode` → `row.currency` (data yg diformat) → `default_currency_id`. (existing 2-level → tambah `row.currency`). Pre-resolve symbol code unik (dari col + data.currency rekursif + default) di komponen → pass map `{code→symbol}` via `opts.currencySymbols` → `formatData` lookup sync, pass sbg `prefix`. `type=number`→tanpa symbol. Pertahankan `absoluteNumber`.
  - Validasi: verifikasi output string identik (spot-check render print).

## Fase 2 — Migrasi CurrencyInput → NumberInput (per modul)

- [ ] T03 Modul Finances
  - File: `Finances/Taxes/Form.jsx`, `Finances/Components/PaymentSchedule.jsx`, `Finances/PaymentEntries/Form.jsx`, `Finances/Components/AdditionalDiscount.jsx`, `Finances/Accounts/Form.jsx`, `Finances/PurchaseInvoice/Form.jsx`, `Finances/SalesInvoice/Form.jsx`, `Finances/PaymentTermTemplate/Form.jsx`
  - Set `decimalScale` eksplisit tiap field. Cek handler arg-2/3.

- [ ] T04 Modul Sales
  - File: `Sales/SalesOrders/Form.jsx`, `Sales/InternalOrders/Form.jsx`

- [ ] T05 Modul Purchase
  - File: `Purchase/PurchaseOrders/Form.jsx`, `Purchase/PurchaseRequests/Form.jsx`, `Purchase/PurchaseReceipts/Form.jsx`

- [ ] T06 Modul Inventory
  - File: `Inventory/StockEntries/Form.jsx`, `Inventory/DeliveryNotes/Form.jsx`, `Inventory/Items/Form.jsx`

- [ ] T07 Modul Core/Print (cek SPECIAL_DISPLAY_VALUES `∞`/`-`)
  - File: `Core/Print.jsx`, `Core/PrintTemplate/Form.jsx`
  - Verifikasi field yang andalkan display khusus tetap benar.

- [ ] T08 FormTable + Table/Filter
  - File: `Components/FormTable.jsx` (column-width integer mode: `min/max/step`→integer props), `Components/Table/Filter/ValueField.jsx` (samakan pola, hapus import CurrencyInput jika ada)

- [ ] T08b Table2 Cell — case `number`/`currency` via `formatNumber`
  - File: `Components/Table/Table2.jsx` (komponen `Cell`, L112-270)
  - Tambah case `number` + `currency` di switch sebelum `default`. `currency`→prefix symbol, `number`→tanpa symbol.
  - Precedence currency: `colProps.currencyCode` (utama, string/object) → `row.currency` (object, `.symbol` langsung) → `default_currency_id`. Symbol dari object `.symbol` tanpa fetch; string code pakai object-path/resolve (T00). Fallback default bila semua null.
  - decimalScale/format dari colProps (`decimalScale`/`numberFormat`), fallback `preferences.default_number_format`.
  - Import `formatNumber` dari `@/Components/NumberInput/formatNumber`; ambil `preferences` via `usePage()`.
  - Validasi: render tabel dengan kolom currency (multi-currency row) + number, cek format & symbol benar.

## Fase 3 — Migrasi native type=number → NumberInput

- [ ] T09 Native input (10 tempat) + sesuaikan handler string→float
  - File: `Users/Roles/FormNewRule.jsx` (level int), `Inventory/Attributes/Form.jsx` (from/to_range, increment), `Settings/Company.jsx` (mail_port int, per-page option int), `Core/PrintTemplate/Components/CustomModeHeaderEditor.jsx` (colspan/rowspan int), `Core/PrintTemplate/Components/StyleFields/UnitInputField.jsx` (CSS value)
  - Integer → `allowDecimals={false}`. Handler baca float, bukan `e.target.value`.

## Fase 4 — Cleanup & docs

- [ ] T10 Hapus kode lama (HANYA jika grep referensi = 0)
  - Cek: `grep -rn "CurrencyInput\|formatValue" resources/js` → 0; `grep -rn 'type="number"' resources/js` → 0
  - Hapus: `resources/js/Components/CurrencyInput.jsx`, folder `resources/js/Components/CurrencyInput/`

- [ ] T11 Update docs
  - File: `docs/frontend.md` (section CurrencyInput→NumberInput + TOC + contoh + tambah formatNumber), `docs/architecture.md` (struktur dir)

## Checkpoint

- [ ] T12 (CHECKPOINT — stop & konfirmasi user) Build + full test
  - `npm run build` sukses; `npx vitest run` pass; ESLint/Prettier bila perlu.
  - Manual spot-check: SalesInvoice form, 1 Print render, Settings/Company port field.
  - Konfirmasi ke user sebelum dianggap selesai.
