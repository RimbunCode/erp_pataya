# Implementation Plan: NumberInput

Status: `[ ]` todo · `[~]` queued · `[-]` in progress · `[x]` done. Optional: `- [ ]* <id>`.

Lint (eslint) & Pint dijalankan **hanya setelah semua task selesai** (task 9), bukan per task.

## Backend — sumber format tunggal

- [x] 1. Tambah preference `default_number_format` di seeder
  - Tambah `'default_number_format' => '#.###,##'` ke `$preferencesArr` di `database/seeders/PreferenceSeeder.php`.
  - Jalankan `php artisan db:seed --class=PreferenceSeeder` (idempotent) dan verifikasi row tersimpan via `database-query`.
  - _Requirements: 1.1, 1.5_
  - _Files: `database/seeders/PreferenceSeeder.php`_

- [x] 2. Derive `default_number_format` saat simpan preference + feature test
  - Di `app/Http/Controllers/Core/CompanyController.php` method `update()`, setelah loop simpan preferences (masih dalam transaksi), set `default_number_format` dari `Currency::find(default_currency_id)->number_format` dengan fallback `#,###.##`.
  - Pastikan `use App\Models\Core\Currency;` ada.
  - Buat feature test PHPUnit: submit update dgn `default_currency_id` → assert `default_number_format` sesuai `Currency.number_format`; assert fallback saat currency tak ada. Buat via `php artisan make:test --phpunit`.
  - Jalankan test: `php artisan test --compact --filter=<NamaTest>`.
  - _Requirements: 1.2, 1.3, 1.4_
  - _Files: `app/Http/Controllers/Core/CompanyController.php`, `tests/Feature/...`_

## Frontend — fungsi murni (testable)

- [x] 3. `parseNumberFormat` + test
  - Buat `resources/js/Components/NumberInput/parseNumberFormat.js`.
  - Tulis test untuk 3 varian DB + edge (tanpa desimal, tanpa group, invalid → fallback) di `resources/js/Components/NumberInput/index.test.js`.
  - _Requirements: 2.1–2.6, 8.1_
  - _Files: `.../NumberInput/parseNumberFormat.js`, `.../NumberInput/index.test.js`_

- [x] 4. `formatNumber` + test
  - Buat `resources/js/Components/NumberInput/formatNumber.js` (pure, sinkron; pakai `parseNumberFormat` saat `numberFormat` di-set).
  - Implementasi round half-up (lolos `1.005→1.01`, `1.004→1.00`, `2.5→3`).
  - Test: rounding, negatif, nol, scale 0, prefix/suffix, override numberFormat.
  - _Requirements: 3.1–3.9, 8.2_
  - _Files: `.../NumberInput/formatNumber.js`, `.../NumberInput/index.test.js`_

- [x] 5. `cleanNumber` + test + property round-trip
  - Buat `resources/js/Components/NumberInput/cleanNumber.js`.
  - Test strip separator/prefix per locale + property test fast-check `cleanNumber(formatNumber(x)) ≈ x`.
  - _Requirements: 4.1–4.3, 8.3, 8.4_
  - _Files: `.../NumberInput/cleanNumber.js`, `.../NumberInput/index.test.js`_

## Frontend — resolusi currency

- [x] 6. `getCurrencyConfig` + hook `useCurrency`
  - Buat `resources/js/Components/NumberInput/getCurrencyConfig.js` (async, reuse `getDataModel` + `saveToLocalStorage`/`getFromLocalStorage`, key `currency:<code>`, expiry 7 hari, return `{ symbol }`).
  - Buat `resources/js/Components/NumberInput/useCurrency.js` (state `{ symbol, loading }`, resolusi `default` dari `preferences.default_currency_id`, race handling flag `ignore`).
  - _Requirements: 5.1–5.6_
  - _Files: `.../NumberInput/getCurrencyConfig.js`, `.../NumberInput/useCurrency.js`_

## Frontend — komponen

- [x] 7. Komponen `<NumberInput/>`
  - Buat `resources/js/Components/NumberInput/index.jsx` (forwardRef, re-export `formatNumber`/`parseNumberFormat`/`getCurrencyConfig`).
  - Resolusi config: base `preferences.default_number_format` → override `numberFormat`/props individual; prefix dari `currencyCode` symbol (kecuali prop `prefix` eksplisit).
  - Perilaku: format-on-blur, typing kirim float mentah, clamp min/max, sync parent via `useDidMountEffect`, styling default + `cn`.
  - _Requirements: 6.1–6.14, 7.1, 7.2_
  - _Files: `.../NumberInput/index.jsx`_

## Penyelesaian

- [x] 8. Script test di package.json
  - Tambah `"test": "vitest run"` ke `scripts` di `package.json`.
  - Jalankan `npm run test` → semua test hijau.
  - _Requirements: 8.5_
  - _Files: `package.json`_

- [x] 9. Lint & Pint (akhir)
  - `npm run lint` untuk file JS baru (perbaiki bila perlu).
  - `vendor/bin/pint --dirty --format agent` untuk file PHP yang berubah.
  - **Checkpoint** — jalankan full test (`npm run test` + `php artisan test --compact`), konfirmasi ke user.
  - _Files: file baru/berubah_
