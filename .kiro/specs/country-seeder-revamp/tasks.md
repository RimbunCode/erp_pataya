# Tasks

## Task 1: Konfigurasi API & Environment
- [x] 1.1 Tambah `RC_API_KEY=` ke `.env.example`
- [x] 1.2 Tambah entry `restcountries` ke `config/services.php`

**Files:** `.env.example`, `config/services.php`

---

## Task 2: Migrasi Schema Countries
- [x] 2.1 Tambah kolom `lang_code` (string nullable), `url_flag` (string nullable), `timezones` (json nullable) ke migration `create_countries_table`
- [x] 2.2 Update `Country` model: tambah `casts()` method untuk `timezones` sebagai array, update `$configColumns`

**Files:** `database/migrations/0001_01_01_000000_create_countries_table.php`, `app/Models/Core/Country.php`

---

## Task 3: Migrasi Schema Currencies
- [x] 3.1 Tambah kolom `symbol` (string nullable), `number_format` (string nullable) ke migration `create_currencies_table`
- [x] 3.2 Update `Currency` model: update `$configColumns` untuk reflect field baru

**Files:** `database/migrations/0001_01_01_000000_create_currencies_table.php`, `app/Models/Core/Currency.php`

---

## Task 4: Rewrite CountrySeeder
- [x] 4.1 Rewrite `CountrySeeder` menggunakan API v5 dengan:
  - Bearer auth dari `config('services.restcountries.key')`
  - Loop pagination (limit=100, loop hingga `meta.more === false`)
  - Field mapping: `codes.alpha_2` → code, `names.official` → name, `languages[0].bcp47` → lang_code, `flag.url_svg` → url_flag
  - Konversi `timezones[]` UTC offset → IANA names via helper method `buildTimezoneMap()`
  - Seed currencies sekaligus dari data `currencies[]` + `number_formats` tiap negara
- [x] 4.2 Tambah private method `buildTimezoneMap()` untuk konversi UTC offset → array IANA
- [x] 4.3 Tambah private method `deriveNumberFormat()` untuk derive format dari separator

**Files:** `database/seeders/CountrySeeder.php`

---

## Task 5: Backend Countries CRUD
- [x] 5.1 Buat `CountryRequest` dengan validasi field
- [x] 5.2 Buat `CountryController` dengan method index/show/store/update/destroy (ikuti pola BranchController)
- [x] 5.3 Tambah `Route::resourceDetail('country', CountryController::class)` ke group `/settings` di `routes/web.php`

**Files:** `app/Http/Requests/Core/CountryRequest.php`, `app/Http/Controllers/Core/CountryController.php`, `routes/web.php`

---

## Task 6: Backend Currencies CRUD
- [x] 6.1 Buat `CurrencyRequest` dengan validasi field
- [x] 6.2 Buat `CurrencyController` dengan method index/show/store/update/destroy
- [x] 6.3 Tambah `Route::resourceDetail('currency', CurrencyController::class)` ke group `/settings`

**Files:** `app/Http/Requests/Core/CurrencyRequest.php`, `app/Http/Controllers/Core/CurrencyController.php`, `routes/web.php`

---

## Task 7: Frontend Pages Countries
- [x] 7.1 Buat `resources/js/Pages/Settings/Countries/Form.jsx` — fields: code, name, lang_code, url_flag
- [x] 7.2 Buat `resources/js/Pages/Settings/Countries/Index.jsx` — DataTable2 + Form dialog
- [x] 7.3 Buat `resources/js/Pages/Settings/Countries/Show.jsx` — FormPage + Form

**Files:** `resources/js/Pages/Settings/Countries/Form.jsx`, `Index.jsx`, `Show.jsx`

---

## Task 8: Frontend Pages Currencies
- [x] 8.1 Buat `resources/js/Pages/Settings/Currencies/Form.jsx` — fields: code, name, symbol, number_format
- [x] 8.2 Buat `resources/js/Pages/Settings/Currencies/Index.jsx` — DataTable2 + Form dialog
- [x] 8.3 Buat `resources/js/Pages/Settings/Currencies/Show.jsx` — FormPage + Form

**Files:** `resources/js/Pages/Settings/Currencies/Form.jsx`, `Index.jsx`, `Show.jsx`

---

## Task 9: Navigasi Sidebar
- [x] 9.1 Tambah item Countries & Currencies ke group Settings di `AppSidebar.jsx`

**Files:** `resources/js/Components/Sidebar/AppSidebar.jsx`

---

## Task 10: Tests & Verifikasi
- [x] 10.1 Buat feature test untuk CountrySeeder (mock HTTP response API v5)
- [x] 10.2 Buat feature test untuk CountryController (index, show, store, update, destroy)
- [x] 10.3 Buat feature test untuk CurrencyController (index, show, store, update, destroy)
- [x] 10.4 Jalankan `php artisan migrate:fresh --seed` dan verifikasi data tersimpan benar
- [x] 10.5 Jalankan `php artisan test --compact` — semua test harus pass

**Files:** `tests/Feature/CountrySeederTest.php`, `tests/Feature/CountryControllerTest.php`, `tests/Feature/CurrencyControllerTest.php`
