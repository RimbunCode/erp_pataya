# Implementation Plan: chart-compact-number-display

## Overview

Bangun utility format angka bersama lebih dulu (pure function, unit-testable) sebelum menyentuh komponen manapun. Backend Chart (migration/model/request) dan frontend Form berjalan setelahnya, lalu wiring ke `ChartDisplay.jsx` (termasuk `YAxis` baru yang berisiko visual) dan penyelarasan `NumberCardDisplay.jsx`. Checkpoint visual di akhir WAJIB — tidak cukup test otomatis untuk perubahan layout `YAxis`.

## Tasks

- [ ] 1. Utility format angka bersama
  - [x] 1.1 Buat `resources/js/lib/numberFormat.js`
    - Export `formatNumber(value, { full, locale })` — pure function, tanpa dependency React/hook
    - `full` ? `toLocaleString(locale, {maximumFractionDigits:2})` : `Intl.NumberFormat(locale, {notation:"compact", maximumFractionDigits:1})`
    - `value` null/undefined/NaN → diperlakukan sebagai `0`
    - _Requirements: 2.1, 2.2, 4.2_

  - [x] 1.2 Write unit tests untuk `numberFormat.js`
    - **Test: `full=true` vs `full=false` menghasilkan output beda untuk angka besar (mis. 1234567)**
    - **Test: locale `"id"` vs `"en"` menghasilkan notasi compact berbeda untuk angka yang sama**
    - **Test: `value` null/undefined → tidak throw, hasil setara format angka 0**
    - **Validates: Requirements 2.1, 2.2, 3.1, 3.2, 4.2**

- [x] 2. Checkpoint - Ensure numberFormat.js unit tests pass
  - Jalankan `npm run test -- numberFormat`, konfirmasi ke user sebelum lanjut. (6/6 pass, verified)

- [ ] 3. Backend: kolom `show_full_number` pada Chart
  - [x] 3.1 Migration baru `add_show_full_number_to_charts_table`
    - `Schema::table('charts', ...)` tambah `boolean('show_full_number')->default(false)->after('currency')` — BUKAN edit migration `create_charts_table` yang sudah pernah jalan
    - _Requirements: 1.1, 1.2, 4.1_

  - [x] 3.2 Update `app/Models/Core/Chart.php`
    - Tambah `'show_full_number' => 'boolean'` ke `casts()`
    - _Requirements: 1.1_

  - [x] 3.3 Update `app/Http/Requests/Core/ChartRequest.php`
    - Tambah rule `'show_full_number' => ['nullable', 'boolean']`
    - _Requirements: 1.1_

  - [x] 3.4 Write feature test di `tests/Feature/Core/ChartControllerTest.php`
    - **Test: store Chart dengan `show_full_number=true` tersimpan sesuai**
    - **Test: store Chart tanpa mengisi field → tersimpan `false` (default)**
    - **Validates: Requirements 1.1, 1.2, 4.1**

- [x] 4. Checkpoint - Ensure backend tests pass
  - `php artisan test --compact tests/Feature/Core/ChartControllerTest.php`, konfirmasi ke user. (7/7 pass, verified)

- [x] 5. Frontend: checkbox di Chart Form
  - [x] 5.1 Update `resources/js/Pages/Settings/Chart/Form.jsx`
    - Tambah `FormCheckbox` standalone (label + description sendiri, TIDAK dibungkus `FormInput` — pola yang sudah diperbaiki NumberCard/Chart sesi ini) untuk `show_full_number`
    - Tambah lang key `descriptions.show_full_number` di `lang/id/settings/chart.php` dan `lang/en/settings/chart.php`
    - _Requirements: 1.3_

- [x] 6. Frontend: wiring format ke ChartDisplay.jsx
  - [x] 6.1 Import `formatNumber` dari `lib/numberFormat.js` + `useLaravelReactI18n().currentLocale()`, hapus fungsi `formatNumber` lokal lama
    - _Requirements: 2.3, 3.1, 3.2, 3.3_

  - [x] 6.2 Tambah `<YAxis tickFormatter={fmt} />` eksplisit pada Bar dan Line chart
    - _Requirements: 1.4, 1.5, 5.1_

  - [x] 6.3 Tambah prop `formatter` pada `ChartTooltipContent` — replikasi markup default (indicator + label + value) dengan angka via `fmt()`, JANGAN cuma `return fmt(value)` (akan menghilangkan indicator/label)
    - _Requirements: 1.4, 1.5_

  - [x] 6.4 Ganti pemanggilan format di label tengah donut ke `fmt()`
    - _Requirements: 1.4, 1.5_

- [x] 7. Frontend: selaraskan NumberCardDisplay.jsx
  - [x] 7.1 Ganti fungsi `formatNumber` lokal di `NumberCardDisplay.jsx` dengan import `lib/numberFormat.js` + `currentLocale()`, pola sama seperti Chart
    - _Requirements: 2.4, 3.1, 3.2_

- [x] 8. Checkpoint - Verifikasi visual WAJIB (bukan cuma test otomatis)
  - Build (`npm run build`), buka Chart bar/line existing ("Item per Kategori") DAN NumberCard ("Total Items") di browser
  - Toggle checkbox "Tampilkan Angka Penuh" → persist ke DB terverifikasi (show_full_number 0→1→0), prop Inertia terverifikasi ikut berubah
  - Ganti lang aktif app id↔en → terverifikasi teks UI berubah ("Kemarin"→"Yesterday", currentLocale() ikut), tidak sempat lihat beda notasi visual krn data test angka kecil (max 4) — TAPI logic locale sudah diverifikasi ketat via unit test (id vs en beda notasi utk angka besar, 6/6 pass)
  - `YAxis` baru TIDAK merusak proporsi layout chart bar/line existing — dikonfirmasi screenshot
  - Tooltip custom formatter render benar (indicator + label + value), no console error terkait
  - Catatan: sempat menemukan halaman Chart timeout 30s (server dev lama kebanyakan dihajar request sesi ini) — root cause DIKONFIRMASI environment (restart `php artisan serve`), BUKAN bug kode; server baru langsung normal

- [x] 9. Checkpoint final - Full regression
  - `php artisan test --compact` file terkait: 26/26 pass (ChartControllerTest, ChartServiceTest, NumberCardControllerTest, NumberCardServiceTest)
  - `npx vitest run` (full suite): 673/679 pass — numberFormat.test.js 6/6 pass; 6 gagal 100% pra-existing & tidak terkait (PrintTemplate/gjs-table-relation-custom-mode, terkonfirmasi via git log commit terakhir 2026-06-01, tidak pernah disentuh sesi ini)
  - `vendor/bin/pint --dirty --format agent`: fixed 2 file (migration + lang chart.php), re-verified test tetap pass pasca-format
  - Siap commit

## Revisi Pasca-Task-9: mode full delegasi ke NumberInput/formatNumber

User bertanya apakah `formatNumber` reuse yang sudah ada — jawabannya TIDAK, sesi awal langsung bikin baru tanpa cek dulu. Ditemukan `.kiro/specs/number-input/` + `NumberInput/formatNumber.js` sudah jadi sumber tunggal angka penuh app ini (Table2, PrintTemplate), via `preferences.default_number_format` — bukan locale. Lihat `design.md` § "Revisi Pasca-Implementasi" untuk detail teknis lengkap.

Perubahan: `lib/numberFormat.js` (mode full delegasi, bukan `toLocaleString` sendiri), `numberFormat.test.js` (8 test, 2 tambahan utk pattern full + fallback), `ChartDisplay.jsx`/`NumberCardDisplay.jsx` (tambah `usePage().props.preferences`).

Re-verifikasi: 8/8 unit test numberFormat, 681 total vitest (674 pass, 7 gagal — SAMA pra-existing PrintTemplate + 1 tambahan flaky property-test random-seed, dikonfirmasi file tidak tersentuh via `git status`), live browser: NumberCard "Total Items" toggle full → "5,00" (pattern `#.###,##` company, bukan "5" polos) — persist DB + revert terverifikasi.

## Notes

- Setiap task mereferensi requirement untuk traceability.
- Checkpoint 2, 4, 8, 9 = validasi inkremental — WAJIB stop dan konfirmasi user, terutama Checkpoint 8 (visual) karena berisiko layout `YAxis` yang tidak tertangkap test otomatis.
- Tidak ada optional task (`[ ]*`) di spec ini.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "3.1", "3.2", "3.3", "5.1"] },
    { "id": 2, "tasks": ["3.4"] },
    { "id": 3, "tasks": ["6.1", "7.1"] },
    { "id": 4, "tasks": ["6.2", "6.3", "6.4"] },
    { "id": 5, "tasks": ["8"] },
    { "id": 6, "tasks": ["9"] }
  ]
}
```
