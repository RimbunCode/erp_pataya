# Requirements Document: number-input-total-migration

## Introduction

Codebase frontend (`resources/js`) saat ini memakai tiga mekanisme angka berbeda: komponen `CurrencyInput` (wrapper library vendored berbasis `Intl.NumberFormat` locale), native `<input type="number">`, dan helper `formatValue`. Tujuan spec ini: migrasi total ketiganya ke `NumberInput` (komponen internal) dan `formatNumber` (helper internal) tanpa mengubah perilaku/format yang dilihat user, lalu hapus kode lama dan update dokumentasi.

Scope: **frontend only** (React/Inertia). Backend/PHP tidak tersentuh.

## Glossary

- **NumberInput** — komponen input angka internal di `@/Components/NumberInput`; format-on-blur, grouping realtime, round half-up.
- **formatNumber** — helper sinkron di `@/Components/NumberInput/formatNumber`; format string angka dengan opsi `numberFormat`/`decimalScale`/`prefix`/`suffix`.
- **CurrencyInput / formatValue** — komponen & helper lama (vendored) yang akan dihapus.
- **currency-path** — pemakaian `formatValue` dengan `intlConfig.currency` (menghasilkan symbol mata uang lokal).
- **SPECIAL_DISPLAY_VALUES** — nilai display khusus `∞` dan `-` yang ditangani CurrencyInput.

## Requirements

### Requirement 1: Migrasi input currency/angka di Form

**User Story:** As a user, I want semua field input angka di form tetap menampilkan format, jumlah desimal, dan separator yang sama setelah migrasi, so that pengalaman input tidak berubah.

#### Acceptance Criteria

1. THE migrasi SHALL mengganti setiap pemakaian `CurrencyInput` (~97 JSX) dengan `NumberInput`.
2. WHEN sebuah `CurrencyInput` memiliki `decimalScale` efektif tertentu, THE `NumberInput` pengganti SHALL menyertakan `decimalScale` eksplisit yang sama.
3. WHEN handler `onValueChange` lama hanya memakai argumen pertama (scalar float), THE handler SHALL tetap berfungsi tanpa perubahan body.
4. WHEN handler lama memakai argumen `name`/`values`, THE handler SHALL disesuaikan dengan signature `(float, values)` NumberInput.
5. THE props `min`, `max`, `prefix`, `suffix`, `className`, `readOnly`, `currencyCode` SHALL dipertahankan ekuivalen pada NumberInput.

### Requirement 2: Migrasi native input type=number

**User Story:** As a developer, I want semua native `<input type="number">` diganti NumberInput, so that input angka seragam dan handler menerima nilai numerik yang konsisten.

#### Acceptance Criteria

1. THE migrasi SHALL mengganti seluruh 10 native `type="number"` dengan `NumberInput`.
2. WHEN field bersifat integer, THE NumberInput SHALL memakai `allowDecimals={false}` atau `decimalScale={0}`.
3. WHEN handler lama membaca `e.target.value` (string), THE handler SHALL diubah menerima float dari `onValueChange`.
4. THE batasan `min`/`max` native SHALL dipetakan ke prop `min`/`max` NumberInput.

### Requirement 3: Migrasi formatValue ke formatNumber

**User Story:** As a user, I want semua nilai angka/mata uang yang ditampilkan (print template, handlebars, tabel) tetap identik, so that dokumen/laporan tidak berubah tampilan.

#### Acceptance Criteria

1. THE migrasi SHALL mengganti seluruh 10 call-site `formatValue` dengan `formatNumber`.
2. WHEN call-site adalah currency-path (`intlConfig.currency`), THE migrasi SHALL me-resolve symbol mata uang dan menyatakannya via `prefix` agar output string identik.
3. THE output string `formatNumber` (separator, jumlah desimal, posisi & bentuk symbol) SHALL identik dengan output `formatValue` sebelumnya untuk input yang sama.
4. THE test `variableTokenUtils.test.js` SHALL diperbarui dan tetap pass.
5. WHEN call-site `PrintPreview.formatData` memformat currency, THE resolusi currency SHALL mengikuti precedence: `col.currencyCode` → `row.currency` (data yang sedang diformat) → `default_currency_id` (sama seperti Table2 Cell).
6. THE `PrintPreview.formatData` (pure function) SHALL me-resolve symbol via map yang di-pre-resolve di komponen (sync lookup), bukan fetch per-nilai.

### Requirement 4: Cleanup kode lama

**User Story:** As a developer, I want kode lama dihapus setelah migrasi terverifikasi, so that tidak ada dependensi vendored & technical debt tersisa.

#### Acceptance Criteria

1. WHEN seluruh referensi `CurrencyInput`/`formatValue`/`type="number"` sudah 0, THE file `CurrencyInput.jsx`, folder `Components/CurrencyInput/`, dan re-export `formatValue` SHALL dihapus.
2. THE `npm run build` SHALL sukses tanpa error Vite manifest.
3. THE `npx vitest run` SHALL pass untuk test NumberInput dan variableTokenUtils.
4. THE penghapusan SHALL dilakukan HANYA setelah build & test pass.

### Requirement 5: Update dokumentasi

**User Story:** As a developer, I want docs mencerminkan komponen/helper baru, so that referensi frontend akurat.

#### Acceptance Criteria

1. THE `docs/frontend.md` SHALL mengganti section `CurrencyInput` (props, contoh, TOC) dengan `NumberInput`.
2. THE `docs/architecture.md` SHALL memperbarui daftar struktur direktori (`CurrencyInput/` → `NumberInput/`).
3. THE dokumentasi SHALL mencantumkan helper `formatNumber` jika sebelumnya `formatValue` tidak terdokumentasi.

### Requirement 6: Format angka/currency pada Table2 Cell

**User Story:** As a user, I want kolom tabel bertipe `number`/`currency` menampilkan angka terformat (bukan angka mentah), so that data tabel terbaca konsisten dengan form & dokumen.

Saat ini `Cell` di `Components/Table/Table2.jsx` tidak punya case `number`/`currency` — keduanya jatuh ke `default` dan menampilkan nilai mentah (`row[name]`).

#### Acceptance Criteria

1. THE `Cell` SHALL menambahkan case `number` dan `currency` yang memformat nilai memakai `formatNumber`.
2. WHEN type `currency`, THE Cell SHALL menampilkan symbol mata uang sebagai prefix; WHEN type `number`, THE Cell SHALL menampilkan angka tanpa symbol.
3. THE Cell SHALL me-resolve currency dengan precedence: `colProps.currencyCode` (utama, string/object) → `row.currency` (object) → `default_currency_id` (preferences).
4. WHEN symbol mata uang tersedia langsung pada row (`row.currency?.symbol`), THE Cell SHALL memakainya tanpa resolve async; WHEN hanya tersedia code, THE Cell SHALL me-resolve symbol (lihat catatan verifikasi shape data di design).
5. WHEN colProps memiliki `decimalScale`/`numberFormat`/opsi format lain, THE Cell SHALL memakainya; WHEN tidak ada, THE Cell SHALL fallback ke `preferences.default_number_format`.
6. THE output string Cell SHALL konsisten dengan format `formatNumber` yang dipakai di form & helper display.

### Requirement 7: NumberInput `currencyCode` menerima string atau object

**User Story:** As a developer, I want prop `currencyCode` (dan `useCurrency`) menerima string code ATAU object data currency, so that pemanggil yang sudah punya data currency (mis. `row.currency`) tidak perlu fetch ulang symbol.

#### Acceptance Criteria

1. WHEN `currencyCode` berupa string, THE `useCurrency` SHALL me-resolve symbol via `getCurrencyConfig` (jalur lama, dengan cache).
2. WHEN `currencyCode` berupa object dengan `symbol` terisi, THE `useCurrency` SHALL memakai `object.symbol` langsung tanpa fetch.
3. WHEN `currencyCode` berupa object tanpa `symbol`, THE `useCurrency` SHALL fallback fetch memakai `object.code`.
4. WHEN `currencyCode` null/undefined, THE symbol SHALL null (tanpa prefix).
5. THE return shape `useCurrency` SHALL tetap `{ symbol, loading }` untuk kedua jalur.
6. THE perubahan SHALL diuji di `index.test.js` (string-path, object-with-symbol, object-without-symbol).
