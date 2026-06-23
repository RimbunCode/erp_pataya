# Requirements Document

## Introduction

`CountrySeeder` saat ini menggunakan endpoint `restcountries.com/v3.1/all` yang sudah tidak tersedia (usang).
Selain memperbaiki endpoint ke API v5 yang aktif, sistem perlu diperluas untuk menyimpan data yang lebih
lengkap pada tabel `countries` dan `currencies`, serta menyediakan halaman manajemen di modul Core
(group Settings) agar administrator dapat melihat dan mengelola data tersebut.

## Glossary

- **BCP47** — format tag bahasa standar (e.g. `id`, `en`, `zh-Hans`) digunakan untuk identifikasi bahasa
- **IANA Timezone** — nama timezone standar (e.g. `Asia/Jakarta`) yang digunakan PHP/sistem
- **UTC Offset** — format offset timezone (e.g. `UTC+07:00`) yang dikembalikan API restcountries
- **ISO Alpha-2** — kode negara 2 huruf (e.g. `ID`, `US`) — lebih umum digunakan di integrasi sistem
- **number_format** — pola format angka (e.g. `#.###,##`) yang mendefinisikan pemisah ribuan dan desimal
- **RC_API_KEY** — API key untuk autentikasi ke `api.restcountries.com/countries/v5`

## Requirements

### Requirement 1: Perbaiki CountrySeeder ke API v5

**User Story:** As a developer, I want the CountrySeeder to use the active restcountries v5 API, so that seeding data negara tidak gagal karena endpoint usang.

#### Acceptance Criteria

1. THE `CountrySeeder` SHALL menggunakan endpoint `https://api.restcountries.com/countries/v5`
2. THE `CountrySeeder` SHALL mengautentikasi menggunakan Bearer token dari `config('services.restcountries.key')`
3. THE `CountrySeeder` SHALL melakukan loop pagination otomatis (limit=100) hingga `meta.more === false`
4. WHEN API key tidak di-set, THE seeder SHALL melempar exception yang deskriptif
5. WHEN API call gagal, THE seeder SHALL menangkap exception dan menampilkan pesan error yang jelas

---

### Requirement 2: Perluas Schema Countries

**User Story:** As a system, I want each country record to store language code, flag URL, and timezones, so that data negara lebih lengkap untuk keperluan UI dan integrasi.

#### Acceptance Criteria

1. THE `countries` table SHALL memiliki kolom `lang_code` (string, nullable) — BCP47
2. THE `countries` table SHALL memiliki kolom `url_flag` (string, nullable) — URL SVG
3. THE `countries` table SHALL memiliki kolom `timezones` (json, nullable) — array IANA names
4. THE `CountrySeeder` SHALL mengisi `lang_code` dari field `languages[0].bcp47` response API
5. THE `CountrySeeder` SHALL mengisi `url_flag` dari field `flag.url_svg` response API
6. WHEN API mengembalikan timezone `"UTC+07:00"`, THE seeder SHALL mengkonversi ke array IANA names (e.g. `["Asia/Jakarta", "Asia/Bangkok"]`) menggunakan `DateTimeZone::listIdentifiers()`
7. THE `Country` model SHALL meng-cast kolom `timezones` sebagai array
8. THE kode negara SHALL menggunakan `codes.alpha_2` (ISO Alpha-2, 2 huruf)
9. THE nama negara SHALL menggunakan `names.official` (nama resmi/official)

---

### Requirement 3: Perluas Schema Currencies

**User Story:** As a system, I want each currency record to store symbol and number format, so that data mata uang dapat digunakan untuk formatting angka di UI.

#### Acceptance Criteria

1. THE `currencies` table SHALL memiliki kolom `symbol` (string, nullable) — e.g. `$`, `Rp`
2. THE `currencies` table SHALL memiliki kolom `number_format` (string, nullable) — e.g. `#.###,##`
3. THE `CountrySeeder` SHALL mengisi data currencies sekaligus (menggantikan sumber lain)
4. THE `CountrySeeder` SHALL mengisi `symbol` dari `currencies[].symbol` response API
5. THE `CountrySeeder` SHALL menderivasi `number_format` dari `number_formats.decimal_separator` dan `number_formats.thousands_separator`
6. WHEN `decimal_separator` adalah `,` dan `thousands_separator` adalah `.`, THE format SHALL menjadi `#.###,##`
7. WHEN `decimal_separator` adalah `.` dan `thousands_separator` adalah `,`, THE format SHALL menjadi `#,###.##`

---

### Requirement 4: Halaman Countries di Settings

**User Story:** As an administrator, I want to view and manage country data through a Settings page, so that saya dapat melihat dan mengedit informasi negara yang tersimpan di sistem.

#### Acceptance Criteria

1. THE halaman `/settings/countries` SHALL menampilkan daftar negara dengan DataTable
2. THE daftar SHALL menampilkan minimal kolom: code, name
3. THE administrator SHALL dapat membuat negara baru melalui dialog form
4. THE administrator SHALL dapat membuka detail negara via `/settings/countries/{code}`
5. THE halaman detail SHALL menampilkan semua field: code, name, lang_code, url_flag, timezones
6. THE administrator SHALL dapat mengupdate data negara
7. THE administrator SHALL dapat menghapus negara
8. THE navigasi sidebar group Settings SHALL menampilkan item "Countries"
9. THE Countries menu SHALL hanya muncul jika user memiliki permission `select` pada `App\Models\Core\Country`

---

### Requirement 5: Halaman Currencies di Settings

**User Story:** As an administrator, I want to view and manage currency data through a Settings page, so that saya dapat melihat dan mengedit informasi mata uang yang tersimpan di sistem.

#### Acceptance Criteria

1. THE halaman `/settings/currencies` SHALL menampilkan daftar mata uang dengan DataTable
2. THE daftar SHALL menampilkan minimal kolom: code, name, symbol
3. THE administrator SHALL dapat membuat mata uang baru melalui dialog form
4. THE administrator SHALL dapat membuka detail mata uang via `/settings/currencies/{code}`
5. THE halaman detail SHALL menampilkan semua field: code, name, symbol, number_format
6. THE administrator SHALL dapat mengupdate data mata uang
7. THE administrator SHALL dapat menghapus mata uang
8. THE navigasi sidebar group Settings SHALL menampilkan item "Currencies"
9. THE Currencies menu SHALL hanya muncul jika user memiliki permission `select` pada `App\Models\Core\Currency`

---

### Requirement 6: Konfigurasi API Key

**User Story:** As a developer, I want API key restcountries disimpan di environment variable, so that key tidak ter-commit ke codebase dan mudah dikonfigurasi per environment.

#### Acceptance Criteria

1. THE `.env.example` SHALL memiliki entry `RC_API_KEY=`
2. THE `config/services.php` SHALL memiliki entry `restcountries` dengan `key` dan `url`
3. THE `CountrySeeder` SHALL membaca key dari `config('services.restcountries.key')`
