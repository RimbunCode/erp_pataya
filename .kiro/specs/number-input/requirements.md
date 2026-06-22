# Requirements Document

## Introduction

Komponen `CurrencyInput` saat ini (`resources/js/Components/CurrencyInput.jsx`) adalah wrapper tipis di atas package pihak ketiga yang di-_vendor_ ke dalam repo (`@/Components/CurrencyInput/`, asalnya `react-currency-input-field`). Karena kode itu milik orang lain, tim ingin implementasi **fresh & mandiri** dengan nama berbeda — **`NumberInput`** — tanpa menghapus komponen lama (masih dipakai di ~20 halaman Form).

Fitur ini menyediakan:

1. Fungsi formatting angka **standalone** (`formatNumber`) yang murni/sinkron dan dapat dipakai di luar konteks input (mis. tabel, label, print template).
2. Komponen input React (`NumberInput`, `forwardRef`) dengan perilaku format-on-blur dan dukungan konfigurasi currency.

Keputusan arsitektur inti: format angka (separator & jumlah desimal) memiliki **satu sumber app-wide** yaitu preference **`default_number_format`**. Kolom `Currency.number_format` hanya dipakai untuk men-_set_ `default_number_format` saat user menyimpan preference default currency. Prop `currencyCode` pada komponen hanya menarik **symbol** untuk dijadikan prefix.

## Glossary

- **numberFormat / number_format**: pola string yang meng-encode tiga informasi sekaligus dengan bentuk `#<groupSeparator>###<decimalSeparator>##`. Contoh: `#,###.##` (US), `#.###,##` (Eropa), `#'###.##` (Swiss). Jumlah `#`/`0` setelah decimalSeparator = decimalScale.
- **default_number_format**: preference (key di tabel `preferences`) yang menjadi sumber tunggal format angka untuk seluruh aplikasi.
- **default_currency_id**: preference berisi `code` currency default (lowercase, mis. `idr`).
- **groupSeparator**: pemisah ribuan (mis. `,` `.` `'`).
- **decimalSeparator**: pemisah desimal (mis. `.` `,`).
- **decimalScale**: jumlah digit desimal yang dipertahankan setelah pembulatan.
- **round half-up**: pembulatan matematis standar — digit `<5` dibulatkan ke bawah, `>=5` ke atas (`2.5 → 3`, `1.005 → 1.01`).
- **format-on-blur**: angka diformat penuh hanya saat input kehilangan fokus (`onBlur`); saat user masih mengetik, tidak ada formatting.
- **onValueChange payload**: objek `{ float: number|null, formatted: string, value: string }` yang dikembalikan callback (kompatibel dengan komponen lama).

## Requirements

### Requirement 1: Preference `default_number_format` sebagai sumber tunggal

**User Story:** As an administrator, I want the application's number format to come from a single preference derived from the chosen default currency, so that all number displays stay consistent across the app.

#### Acceptance Criteria

1. THE seeder `PreferenceSeeder` SHALL menyertakan key `default_number_format` dengan nilai default yang konsisten dengan default currency (`idr` → `#.###,##`).
2. WHEN user menyimpan preference melalui `CompanyController::update` dan request memuat `default_currency_id`, THE backend SHALL men-set `default_number_format` = `Currency::find(default_currency_id)->number_format`.
3. IF currency yang dirujuk tidak ditemukan atau `number_format`-nya null, THEN THE backend SHALL menggunakan fallback `#,###.##`.
4. THE operasi penyimpanan `default_number_format` SHALL berada dalam transaksi database yang sama dengan penyimpanan preference lain.
5. THE preference `default_number_format` SHALL ter-broadcast ke frontend melalui `usePage().props.preferences` tanpa perubahan tambahan pada pipeline shared preferences.

### Requirement 2: Fungsi `parseNumberFormat` (pure)

**User Story:** As a developer, I want to parse a `numberFormat` pattern into its parts, so that I can derive separators and decimal scale deterministically.

#### Acceptance Criteria

1. WHEN diberi pola `#,###.##`, THE `parseNumberFormat` SHALL mengembalikan `{ groupSeparator: ",", decimalSeparator: ".", decimalScale: 2 }`.
2. WHEN diberi pola `#.###,##`, THE `parseNumberFormat` SHALL mengembalikan `{ groupSeparator: ".", decimalSeparator: ",", decimalScale: 2 }`.
3. WHEN diberi pola `#'###.##` (Swiss), THE `parseNumberFormat` SHALL mengembalikan `{ groupSeparator: "'", decimalSeparator: ".", decimalScale: 2 }`.
4. WHEN diberi pola tanpa bagian desimal (mis. `#,###`), THE `parseNumberFormat` SHALL mengembalikan `decimalScale: 0`.
5. WHEN diberi pola tanpa group separator (mis. `###.##`), THE `parseNumberFormat` SHALL mengembalikan `groupSeparator: ""`.
6. IF pola kosong, null, atau tidak valid, THEN THE `parseNumberFormat` SHALL mengembalikan fallback `{ groupSeparator: ",", decimalSeparator: ".", decimalScale: 2 }`.

### Requirement 3: Fungsi `formatNumber` standalone (pure, sinkron)

**User Story:** As a developer, I want a pure synchronous function to format a number into a display string, so that I can use it anywhere without async or input context.

#### Acceptance Criteria

1. THE `formatNumber` SHALL menerima `(value, options)` di mana `options = { numberFormat?, groupSeparator, decimalSeparator, decimalScale?, prefix?, suffix?, allowNegativeValue? }` dan mengembalikan string.
2. THE `formatNumber` SHALL bersifat sinkron dan TIDAK menerima `currencyCode` maupun melakukan I/O.
3. WHEN `numberFormat` di-set pada options, THE `formatNumber` SHALL meng-override `groupSeparator`, `decimalSeparator`, dan `decimalScale` dari hasil `parseNumberFormat`.
4. WHEN `decimalScale` terdefinisi, THE `formatNumber` SHALL membulatkan desimal dengan aturan round half-up (`2.5 → 3`, `1.005 → 1.01`, `1.004 → 1.00`).
5. THE `formatNumber` SHALL menyisipkan `groupSeparator` setiap 3 digit pada bagian integer.
6. THE `formatNumber` SHALL menambahkan `prefix` di depan dan `suffix` di belakang hasil.
7. WHEN `value` negatif dan `allowNegativeValue` true, THE `formatNumber` SHALL menampilkan tanda minus; jika `allowNegativeValue` false, THE `formatNumber` SHALL menampilkan nilai absolut.
8. WHEN `value` kosong, null, undefined, atau NaN, THE `formatNumber` SHALL mengembalikan string kosong.
9. THE `formatNumber` SHALL menampilkan angka besar tanpa notasi ilmiah (tanpa `e+`).

### Requirement 4: Fungsi `cleanNumber` (pure)

**User Story:** As a developer, I want to strip formatting from a display string back into a raw numeric string, so that I can derive the float while the user types.

#### Acceptance Criteria

1. THE `cleanNumber` SHALL membuang `prefix`, `suffix`, dan seluruh `groupSeparator` dari string display.
2. THE `cleanNumber` SHALL menormalkan `decimalSeparator` menjadi `.` sehingga hasilnya dapat di-`parseFloat`.
3. WHEN string display kosong atau hanya berisi tanda/pemisah tanpa digit, THE `cleanNumber` SHALL mengembalikan string kosong.

### Requirement 5: Resolusi currency `getCurrencyConfig` + cache

**User Story:** As a developer, I want to resolve a currency's symbol by code with caching, so that the input can show the correct prefix without redundant network calls.

#### Acceptance Criteria

1. THE `getCurrencyConfig` SHALL menerima `(code, defaultCode?)` dan bersifat async.
2. WHEN `code === "default"`, THE `getCurrencyConfig` SHALL menggunakan `defaultCode` (dari `preferences.default_currency_id`).
3. WHEN `code` null atau undefined, THE `getCurrencyConfig` SHALL mengembalikan `null` tanpa melakukan fetch.
4. WHEN data currency untuk `code` tersedia di localStorage dan belum kedaluwarsa, THE `getCurrencyConfig` SHALL menggunakan data cache tanpa fetch.
5. WHEN cache tidak ada atau kedaluwarsa, THE `getCurrencyConfig` SHALL mengambil data via `getDataModel("Core\\Currency", { code }, { limit: 1 })` lalu menyimpannya ke localStorage dengan masa berlaku 7 hari.
6. THE `getCurrencyConfig` SHALL mengembalikan objek minimal `{ symbol }` (hanya untuk prefix; `number_format` currency TIDAK dipakai untuk formatting).

### Requirement 6: Komponen `<NumberInput/>`

**User Story:** As a developer, I want a forwardRef number input component with format-on-blur and currency support, so that I can collect numeric/monetary input consistently.

#### Acceptance Criteria

1. THE `NumberInput` SHALL dibungkus `forwardRef` dan meneruskan `ref` ke elemen `<input>` di dalamnya.
2. THE `NumberInput` SHALL meneruskan seluruh prop input HTML standar yang tidak dikenal (`...rest`) ke elemen `<input>`.
3. THE `NumberInput` SHALL menerima prop: `value`, `onValueChange`, `allowDecimals`, `allowNegativeValue`, `groupSeparator`, `decimalSeparator`, `decimalScale`, `numberFormat`, `min`, `max`, `maxLength`, `prefix`, `suffix`, `currencyCode`, `className`.
4. THE `NumberInput` SHALL menggunakan `preferences.default_number_format` sebagai konfigurasi format dasar.
5. WHEN prop `numberFormat` di-set, THE `NumberInput` SHALL meng-override groupSeparator/decimalSeparator/decimalScale dari default; WHEN prop individual (`groupSeparator`/`decimalSeparator`/`decimalScale`) di-set, THE `NumberInput` SHALL meng-override nilai terkait.
6. WHEN `currencyCode` ter-resolve ke sebuah currency, THE `NumberInput` SHALL menggunakan `symbol` currency tersebut sebagai `prefix` (kecuali prop `prefix` eksplisit diberikan), DAN TIDAK mengubah separator/decimalScale.
7. WHILE user masih mengetik, THE `NumberInput` SHALL menerapkan group separator secara realtime (via `formatTyping`) NAMUN TIDAK membulatkan/menerapkan decimalScale (desimal dipertahankan apa adanya, termasuk trailing separator/nol) — pembulatan ditunda hingga `onBlur`.
8. WHILE user masih mengetik, THE `NumberInput` SHALL memanggil `onValueChange` dengan `float` mentah (tanpa pembulatan) hasil `cleanNumber`.
9. WHEN input kehilangan fokus (`onBlur`), THE `NumberInput` SHALL memformat nilai penuh via `formatNumber` (termasuk round half-up sesuai decimalScale efektif).
10. WHEN `onBlur` dan nilai lebih kecil dari `min`, THE `NumberInput` SHALL meng-clamp nilai menjadi `min`.
11. WHEN `onBlur` dan nilai lebih besar dari `max`, THE `NumberInput` SHALL meng-clamp nilai menjadi `max`.
12. WHEN prop `value` berubah dari parent, THE `NumberInput` SHALL menyinkronkan dan memformat ulang tampilan.
13. THE `onValueChange` SHALL dipanggil dengan dua argumen: argumen pertama `float: number|null` (untuk pemakaian cepat/kompatibel `onChange` scalar), argumen kedua object detail `{ float: number|null, formatted: string, value: string }`.
14. THE `NumberInput` SHALL mempertahankan kelas styling default komponen lama (right-aligned, tinggi `h-8`, border, dll) dan menggabungkannya dengan `className` via util `cn`.
15. WHEN grouping diterapkan realtime saat mengetik, THE `NumberInput` SHALL mempertahankan posisi kursor relatif terhadap jumlah digit (kursor tidak melompat ke akhir).
16. THE `NumberInput` SHALL menyediakan `placeholder` default berupa hasil format nilai saat ini (atau `0` bila kosong) sesuai konfigurasi format berlaku; prop `placeholder` eksplisit meng-override default ini.
17. THE `NumberInput` SHALL membatasi jumlah DIGIT (integer + desimal, tidak termasuk separator/prefix/suffix/tanda) berdasarkan prop `maxLength` (default `12`) dan menolak input yang melebihi batas; `maxLength={null}` menonaktifkan pembatasan.
18. THE `NumberInput` SHALL TIDAK mengembalikan `NaN` untuk nilai sangat besar (di luar `Number.MAX_SAFE_INTEGER`); nilai numerik mengikuti presisi IEEE-754 double — gunakan `maxLength` untuk membatasi pada rentang aman.

### Requirement 7: Komponen lama tidak terdampak

**User Story:** As a maintainer, I want the existing CurrencyInput untouched, so that the ~20 forms using it keep working.

#### Acceptance Criteria

1. THE perubahan SHALL TIDAK memodifikasi `resources/js/Components/CurrencyInput.jsx` maupun folder `resources/js/Components/CurrencyInput/`.
2. THE komponen `NumberInput` SHALL TIDAK meng-import apa pun dari package vendored `@/Components/CurrencyInput/`.

### Requirement 8: Pengujian unit fungsi murni

**User Story:** As a maintainer, I want the pure functions covered by tests, so that rounding and parsing logic is protected against regressions.

#### Acceptance Criteria

1. THE suite test SHALL mencakup `parseNumberFormat` untuk tiga varian DB (`#,###.##`, `#.###,##`, `#'###.##`) dan edge case (tanpa desimal, tanpa group, invalid → fallback).
2. THE suite test SHALL mencakup `formatNumber` untuk round half-up, nilai negatif, nol, decimalScale 0, prefix/suffix, dan override `numberFormat`.
3. THE suite test SHALL mencakup `cleanNumber` untuk strip separator/prefix pada masing-masing locale.
4. THE suite test SHALL menyertakan property test (fast-check) yang memverifikasi round-trip `cleanNumber(formatNumber(x)) ≈ x` dalam batas decimalScale.
5. THE `package.json` SHALL menyediakan script `test` yang menjalankan vitest.
