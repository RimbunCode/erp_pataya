# Requirements Document

## Introduction

Spec fondasi dari program **Konfigurasi Modul** (lihat `docs/prd/module-settings-prd.md`). Aplikasi hanya punya tabel `preferences` (key/value JSON, tanpa tipe dan FK) dan satu halaman setting (`Settings/Company.jsx`). Spec ini menyediakan:

1. **Tabel setting bertipe**, satu baris per modul, dengan foreign key nyata.
2. **`SettingsService`** sebagai satu pintu baca/tulis, lengkap dengan audit.
3. **Migrasi data dari `preferences`** dan **`LegacyPreferenceMap`** yang menjaga kontrak lama (prop `preferences` untuk frontend, placeholder template cetak dan email).
4. **Halaman setting per modul** bertab, dibatasi izin.
5. **Menu "Module Settings"** pada desk Core dan desk yang relevan: satu item tampil datar, lebih dari satu menjadi submenu.

Spec ini sengaja **tidak mengubah perilaku aplikasi**: setelah selesai, nilai yang dibaca aplikasi sama dengan sebelumnya. Default transaksi dan kontrol dikerjakan di `module-defaults-and-controls`; akun, diskon, dan selisih kurs dimiliki Finance Engine.

**Keputusan 2026-10-18 yang mengikat spec ini:** setting bersifat global (tanpa per cabang); penyimpanan memakai tabel bertipe, bukan key/value; data `preferences` dipindahkan.

**Prasyarat:** tidak ada. Spec ini berjalan paralel dengan Finance P0 dan menjadi prasyarat Finance P1.

**Di luar scope:**
- Default pajak/gudang/termin dan kontrol rantai dokumen (`module-defaults-and-controls`).
- Akun default, aturan akun, posting diskon, pembulatan, selisih kurs (Finance Engine P2–P6).
- Tabel anak untuk kunci berindeks seperti `finance_posting_mode.{type}` (milik Finance P2).
- Preferensi per user (`DeskUserPreference`).

## Glossary

- **Module Setting**: satu baris konfigurasi bertipe milik sebuah modul, disimpan pada tabel singleton (mis. `core_settings`, `finance_settings`).
- **Singleton**: tabel yang dijamin hanya memiliki satu baris.
- **SettingsService**: layanan tunggal untuk membaca dan menulis Module Setting.
- **LegacyPreferenceMap**: peta key → value dengan kunci `preferences` lama, dihasilkan dari tabel baru.
- **Halaman setting modul**: halaman Inertia bertab untuk satu Module Setting.
- **Grup Module Settings**: `MenuItem` folder yang menjadi parent semua halaman setting modul.
- **Cutover**: saat seluruh pembaca beralih dari `preferences` ke tabel baru.

## Requirements

### Requirement 1: Model dasar Module Setting

**User Story:** Sebagai developer, saya ingin model dasar yang seragam untuk setting per modul, so that menambah setting baru tidak memerlukan infrastruktur baru.

#### Acceptance Criteria

1. THE sistem SHALL menyediakan kelas abstrak `ModuleSetting` dengan PK ulid, kolom `singleton` (boolean, default `true`, unik) yang menjamin satu baris, dan timestamps.
2. THE `ModuleSetting::current()` SHALL mengembalikan satu-satunya baris dan membuatnya dengan nilai bawaan model bila belum ada; pembuatan bersamaan SHALL aman (unique constraint + ulangi baca) dan tidak menghasilkan dua baris.
3. THE setiap model turunan SHALL mendeklarasikan `casts()`, nilai bawaan (`defaults()`), dan aturan validasi (`rules()`) sebagai satu sumber kebenaran.
4. THE kolom bernilai referensi (pajak, mata uang, negara, berkas) SHALL memakai foreign key nyata dengan perilaku hapus yang dinyatakan eksplisit di migrasi.
5. THE model SHALL terdaftar pada sistem izin berbasis model (Requirement 9) dan pada audit (Requirement 10).
6. THE migrasi tabel setting SHALL mendeklarasikan semua kolom secara eksplisit; test SHALL membuktikan `initPermissions()` tidak menambah atau menghapus kolom pada tabel setting.

### Requirement 2: Tabel awal dan pemetaan kunci `preferences`

**User Story:** Sebagai pemilik produk, saya ingin nilai konfigurasi yang sudah ada tetap tersedia di tempat baru, so that tidak ada yang hilang.

#### Acceptance Criteria

1. THE sistem SHALL membuat tabel `core_settings` dengan kolom: `company_name`, `short_name`, `email`, `phone`, `street`, `city`, `state`, `zip_code`, `country_id` (FK `countries`), `bank_name`, `bank_account_name`, `bank_account_number`, `default_currency_id` (FK `currencies`), `default_number_format`, `timezone`, `num_per_page` (unsigned integer), `per_page_options` (json), `company_image_id` (FK `files`, `nullOnDelete`), serta field tab email Company yang sudah ada: `mail_protocol`, `mail_encryption`, `mail_host`, `mail_port`, `mail_username`, `mail_password`, `mail_from_address`, `mail_from_name`. Password disimpan terenkripsi dan tidak diserialisasikan ke browser/peta publik/audit; input kosong mempertahankan password tersimpan.
2. THE sistem SHALL membuat tabel `finance_settings` dengan kolom `tax_invoice_serial_range_start`, `tax_invoice_serial_range_end`, `tax_invoice_serial_last_used` (unsigned big integer, default `0`; `0` tetap berarti "belum dikonfigurasi").
3. THE sistem SHALL membuat tabel `sales_settings` dengan kolom `default_tax_id` (FK `taxes`, `nullOnDelete`), menggantikan kunci `active_tax_id`.
4. THE pemetaan kunci lama → kolom baru SHALL dideklarasikan di satu tempat (`config/settings.php`) dan dipakai oleh migrasi data, `LegacyPreferenceMap`, dan test.
5. THE spec lain (Finance Engine, defaults) SHALL menambah kolom atau tabel setting lewat migrasi sendiri; aturan penamaan kolom: kunci logis `{modul}_{nama}` menjadi kolom `{nama}` pada tabel `{modul}_settings`.
6. THE tabel setting untuk modul yang belum punya setting SHALL tidak dibuat pada spec ini.

### Requirement 3: `SettingsService`

**User Story:** Sebagai developer, saya ingin satu pintu untuk membaca dan menulis setting, so that validasi, audit, dan cache konsisten.

#### Acceptance Criteria

1. THE `SettingsService::get(string $modelClass): ModuleSetting` SHALL mengembalikan baris singleton yang di-memo per request dan di-reset saat setting disimpan.
2. THE `SettingsService::update(string $modelClass, array $attributes): ModuleSetting` SHALL memvalidasi dengan `rules()` model, menyimpan dalam satu transaksi, mencatat audit (Requirement 10), dan memicu event `ModuleSettingUpdated` setelah transaksi terluar berhasil commit; rollback tidak menerbitkan event.
3. THE `SettingsService` SHALL menyediakan `lockedCurrent(string $modelClass)` yang membaca baris dengan `lockForUpdate()` untuk pemakaian penghitung (mis. `tax_invoice_serial_last_used`).
4. THE `update()` SHALL menolak atribut di luar kolom yang dideklarasikan model (mass-assignment aman) dan nilai yang melanggar FK atau aturan validasi, dengan `ValidationException` berlokalisasi.
5. THE `update()` pada `CoreSetting` yang mengubah `default_currency_id` SHALL menurunkan `default_number_format` dari mata uang tersebut, mempertahankan perilaku `CompanyController` saat ini.
6. THE penulisan setting SHALL hanya lewat `SettingsService`; test arsitektur SHALL menolak `Model::update`/`save` langsung pada model setting di luar service dan seeder. Pengecualian terdaftar: `PreferenceMigrator` (migrasi data sekali jalan `preferences` → tabel setting, dengan aturan idempoten dan `--force` sendiri; Requirement 5), diputuskan 2026-10-26.

### Requirement 4: `LegacyPreferenceMap`

**User Story:** Sebagai developer frontend dan penulis template, saya ingin kunci lama tetap tersedia, so that halaman dan template yang ada tidak rusak.

#### Acceptance Criteria

1. THE `LegacyPreferenceMap::build(bool $includeHidden = false): array` SHALL mengembalikan peta dengan kunci `preferences` lama (`company_name`, `default_currency_id`, `timezone`, `num_per_page`, `per_page_options`, `company_image`, `active_tax_id`, `tax_invoice_serial_*`, dan seterusnya) dari tabel baru.
2. THE peta SHALL menyertakan baris `preferences` yang belum termigrasi (kunci tak dikenal) dengan aturan penyembunyian kunci sensitif yang sama seperti sebelumnya (`%password%`, `%token%`, `%secret%`, `%private_key%`, `%api_key%`, `mail%`) kecuali `$includeHidden = true`. Akibatnya placeholder email `mail_from_name`/`mail_from_address` kosong pada template email (perbaikan keamanan yang diterima 2026-10-26; kunci `mail_*` tidak ada di produksi).
3. THE `LegacyPreferenceMap::snapshot()` SHALL menyertakan `updated_at` terbaru lintas tabel setting dan `preferences` untuk versi cache.
4. THE prop Inertia `preferences`, `PrintTemplateRenderService`, `EmailTemplateRenderService`, dan `GroupLabelResolver` SHALL membaca peta ini, bukan model `Preference`.
5. THE test parity SHALL membuktikan peta baru identik dengan peta lama untuk data seed (kunci, nilai, tipe).
6. THE `company_image` pada peta SHALL berisi id berkas (bukan `company_image_id`), sesuai kontrak lama.

### Requirement 5: Migrasi data `preferences` → tabel baru

**User Story:** Sebagai admin, saya ingin data konfigurasi yang ada terbawa otomatis, so that saya tidak mengisi ulang.

#### Acceptance Criteria

1. THE migrasi SHALL membuat tabel baru lalu menyalin nilai `preferences` yang dikenal ke kolom bertipe, mengonversi tipe (angka teks → integer, `per_page_options` → json) dan mengubah kode mata uang/negara menjadi huruf besar sesuai perilaku `CompanyController`.
2. THE penyalinan SHALL idempoten: dijalankan ulang tidak menimpa nilai yang sudah diedit di tabel baru kecuali dengan opsi eksplisit `--force`.
3. THE sistem SHALL menyediakan perintah `settings:migrate-preferences {--dry-run} {--force} {--report}` yang menampilkan: kunci termigrasi, kunci tak dikenal (dibiarkan di `preferences`), nilai yang gagal divalidasi (mis. kode mata uang tak ada), dan keputusan per kunci.
4. THE nilai yang gagal divalidasi SHALL tidak membatalkan migrasi: kolom dibiarkan `null`/bawaan, kunci dicatat di laporan, dan baris `preferences` asli tetap utuh.
5. THE migrasi SHALL tidak menghapus apa pun dari `preferences`.
6. THE `PreferenceSeeder` SHALL menyemai tabel baru (dan tetap membuat Branch utama), bukan `preferences`. Karena skrip deploy menjalankan `db:seed` di setiap rilis, seeder SHALL idempoten dan tidak pernah menimpa setting yang sudah ada atau menggeser `tax_invoice_serial_last_used`; kolom negara dan mata uang yang masih kosong karena `CountrySeeder` berjalan setelahnya hanya dilengkapi bila baris setting belum pernah diedit.
7. THE rollback migrasi SHALL menghapus tabel baru tanpa menyentuh `preferences`.

### Requirement 6: Peralihan pembaca tanpa perubahan perilaku

**User Story:** Sebagai pemilik produk, saya ingin aplikasi berperilaku sama setelah setting pindah, so that tidak ada regresi.

#### Acceptance Criteria

1. THE seluruh pembaca `Preference::find`/`where('key', …)` pada `app/` SHALL dialihkan ke `SettingsService` atau `LegacyPreferenceMap`: `default_currency_id` (Sales/Purchase Order dan Invoice, Payment Entry), `timezone` (Quotation, `FormatingSeries`, `FormatingSeriesService`), `num_per_page` (`DataTableScope`), `company_name` (`Asset`, `AssetController`), `city` dan `active_tax_id` (`QuotationController`), `company_image` (`CompanyLogoController`), kunci dinamis (`GroupLabelResolver`).
2. THE `TaxInvoiceSerialAllocator` SHALL memakai `finance_settings` dengan `lockedCurrent()`; semantik rentang, penghitung terakhir, dan sentinel `0` SHALL identik, dan test alokasi existing SHALL tetap hijau.
3. THE `QuotationController` SHALL membaca pajak default dari `sales_settings.default_tax_id` dan mengirimnya ke frontend dengan nama prop yang sama.
4. THE test yang membuat `Preference` langsung (daftar pada tasks) SHALL diubah memakai `SettingsService`/factory setting.
5. THE test arsitektur SHALL gagal bila `Preference::` muncul di `app/` selain `LegacyPreferenceMap`, perintah migrasi, dan model `Preference` itu sendiri (dan dihapus seluruhnya pada Requirement 12).
6. THE `config/command_search.php` SHALL tidak lagi merujuk `Preference::class` setelah cutover.

### Requirement 7: Halaman setting per modul

**User Story:** Sebagai admin, saya ingin satu halaman bertab untuk tiap modul, so that konfigurasi mudah ditemukan.

#### Acceptance Criteria

1. THE sistem SHALL menyediakan `SettingsRegistry` yang mendaftarkan tiap halaman setting: kunci modul, kelas model setting, controller, komponen halaman, ikon, kunci terjemahan judul, dan daftar desk (Requirement 8).
2. THE sistem SHALL menyediakan controller dasar `ModuleSettingController` (`show`, `update`) dan rute bernama `moduleSettings.{modul}.show|update` pada `/settings/modules/{modul}`, dibangkitkan dari registry.
3. THE controller SHALL memakai izin model setting terkait (`read` untuk melihat, `write` untuk menyimpan) lewat sistem izin yang ada dan memakai `rules()` model untuk validasi.
4. THE frontend SHALL menyediakan pembungkus halaman (`ModuleSettingsPage`) berbasis `FormPage`/`FormPageContent` yang menangani muat data, tab, simpan, status belum tersimpan, toast, dan mode baca-saja bila tanpa izin `write`.
5. THE halaman `Settings/Company.jsx` SHALL tetap pada rute `companies.*` dan kini membaca/menulis `core_settings` lewat `SettingsService`, termasuk pembaruan Branch utama dan unggah/hapus logo, dengan perilaku sama seperti sekarang.
6. THE sistem SHALL menyediakan halaman awal **Finances Settings** (tab "Faktur Pajak": rentang serial; penghitung terakhir baca-saja) dan **Sales Settings** (tab "Default": pajak default) agar menu dan izin dapat diuji end-to-end.
7. THE seluruh teks halaman SHALL memakai kunci terjemahan di `lang/id` dan `lang/en` (`LocaleKeysTest` hijau) dan setiap komponen React baru memiliki test `.rtl.test.jsx`.

### Requirement 8: Menu "Module Settings" multi-desk

**User Story:** Sebagai user, saya ingin setting modul tampil di desk yang relevan dan ringkas, so that mudah dijangkau tanpa menu yang berlebihan.

#### Acceptance Criteria

1. THE sistem SHALL membuat satu `MenuItem` folder "Module Settings" (label sesuai Q-S1) sebagai parent semua halaman setting modul, mengikuti mekanisme `menuGroup()`/`menuItem(..., group:)` yang ada.
2. THE tiap halaman terdaftar SHALL menjadi satu `MenuItem` (route `moduleSettings.{modul}.*`, model = model setting) yang dilekatkan ke desk-desk dalam registry lewat pivot `desk_menu_item`.
3. WHEN sebuah desk memuat tepat satu anggota grup setelah filter izin, THE menu SHALL menampilkannya sebagai item datar; WHEN lebih dari satu, THE menu SHALL menampilkan submenu berlabel grup. Perilaku ini berasal dari `ResolveActiveDesk::groupByMenuItemParent()` dan SHALL dibuktikan oleh test untuk tiap kombinasi.
4. THE pemetaan awal halaman → desk SHALL berupa usulan yang mudah diubah di registry (lihat design; Q-S3) dan SHALL dapat dikustomisasi pengguna lewat editor desk yang ada.
5. THE seeder menu SHALL idempoten dan tidak menghapus menu lain.
6. THE route `moduleSettings.{modul}.*` SHALL dikenali `MenuItem::forRoute()` sehingga item aktif tersorot pada halaman setting.

### Requirement 9: Izin

**User Story:** Sebagai admin, saya ingin akses setting diatur per modul lewat peran, so that hanya yang berwenang yang dapat mengubah.

#### Acceptance Criteria

1. THE tiap model setting SHALL memiliki izin `select`, `read`, `write` melalui sistem izin model yang ada; `select` menentukan tampilnya menu, `read` melihat halaman, `write` menyimpan.
2. THE izin yang saat ini melekat pada model `Preference` (peran yang memegang `manage_general_setting`, `manage_company_setting`, `manage_preference`, `manage_setting`) SHALL disalin ke `CoreSetting` melalui migrasi data idempoten; peran Administrator SHALL memperoleh izin pada seluruh model setting.
3. THE `RolePermissionMigrator` SHALL memetakan kunci legacy `manage_*_setting`/`manage_preference` ke `CoreSetting`.
4. THE halaman setting modul baru SHALL tidak terbuka bagi peran non-admin sampai izinnya diberikan eksplisit.
5. THE penyalinan dan pemberian izin oleh `ModuleSettingPermissionSeeder` SHALL idempoten dan hanya membuat baris yang belum ada: izin Preference yang sudah dicabut (soft delete) tidak disalin, dan flag atau pencabutan yang dilakukan admin lewat halaman Roles tidak dipulihkan oleh seeder maupun migrasi.
6. THE halaman Purchase Settings dan Sales Settings serta endpoint resolusi/aturan default SHALL memeriksa izin dari peran aktif pengguna di database (bukan hanya izin session yang dapat basi); halaman setting lain tetap memakai izin session. Keputusan 2026-10-26: dipertahankan dan dicatat di sini.
7. THE peran dengan profil read-only untuk semua modul (Auditor) SHALL memperoleh `select`/`read` pada halaman setting; ini diterima karena profil itu memang read-only (keputusan 2026-10-26).

### Requirement 10: Audit perubahan setting

**User Story:** Sebagai auditor, saya ingin tahu siapa mengubah setting apa dan kapan, so that perubahan konfigurasi dapat ditelusuri.

#### Acceptance Criteria

1. THE perubahan Module Setting SHALL tercatat (pengguna, waktu, nilai sebelum/sesudah per kolom) memakai mekanisme audit model yang ada, memanfaatkan PK ulid (berbeda dari `Preference` yang PK-nya string dan tidak diaudit).
2. THE catatan audit SHALL dapat dilihat dari halaman Logs yang ada dan dari tombol riwayat halaman setting bila komponen tersebut tersedia.
3. THE perubahan oleh seeder atau migrasi data SHALL tidak membanjiri audit; ia ditandai sistem atau dilewati secara eksplisit.

### Requirement 11: Kontrak untuk spec lain

**User Story:** Sebagai penulis spec Finance Engine dan defaults, saya ingin cara baku menambah setting, so that tidak ada rancangan yang saling bertabrakan.

#### Acceptance Criteria

1. THE design SHALL mendokumentasikan langkah menambah setting baru: migrasi kolom, `casts/defaults/rules` pada model, entri `config/settings.php` bila punya padanan legacy, field pada halaman, kunci terjemahan, dan test.
2. THE design SHALL mendokumentasikan langkah menambah halaman setting baru: entri registry (model, controller, halaman, desk), izin, dan item menu.
3. THE `FinanceSetting` SHALL siap menerima kolom dari Finance Engine (`enforce_fiscal_period`, tanggal cutover, dan seterusnya) tanpa perubahan infrastruktur. **Catatan (keputusan 2026-10-26, dikerjakan sebelum Finance P1):** `SettingsService` saat ini memuat cabang khusus `CoreSetting`/`FinanceSetting` (turunan format angka dari mata uang, `advanceTaxInvoiceSerial`); sebelum spec Finance P1 menambah validasi lintas-field, logika khusus model itu dipindahkan ke hook pada model setting agar kolom Finance baru tidak memaksa perubahan service.
4. THE test arsitektur Requirement 6.5 SHALL berlaku untuk semua spec berikutnya.

### Requirement 12: Pensiun tabel `preferences` (GATED)

**User Story:** Sebagai pemilik produk, saya ingin tabel lama dihapus setelah aman, so that hanya ada satu sumber setting.

#### Acceptance Criteria

1. THE pensiun SHALL dikerjakan hanya setelah: (a) cutover satu rilis stabil di produksi, (b) laporan `settings:migrate-preferences --report` tidak menyisakan kunci tak dikenal yang masih dibutuhkan, dan (c) persetujuan pemilik produk.
2. THE pensiun SHALL menghapus model `Preference`, tabel `preferences`, scope penyembunyi kunci, kunci sisa pada `LegacyPreferenceMap`, `PreferenceAuditLogSkipTest`, serta rujukannya pada `RolePermissionMigrator`/`DeskSeeder`/`PermissionSeeder`.
3. THE migrasi penghapusan SHALL reversible (membuat ulang tabel kosong) dan didahului pencadangan isi tabel ke berkas terlampir pada laporan.
4. THE `LegacyPreferenceMap` SHALL tetap ada karena kontrak frontend/template.

### Requirement 13: Non-fungsional

#### Acceptance Criteria

1. THE perubahan SHALL tidak menurunkan kinerja halaman: pembacaan setting per request SHALL paling banyak satu query per tabel setting (memo).
2. THE seluruh perubahan SHALL reversible: migrasi aditif dengan `down()`; pembaca lama (`preferences`) tetap utuh sampai Requirement 12.
3. THE test suite Backend memakai PHPUnit (bukan Pest) dan frontend Vitest; test existing yang disentuh SHALL tetap hijau.
4. THE kunci terjemahan baru tersedia di `lang/id` dan `lang/en`.
5. THE penamaan berkas mengikuti `{Domain}/{Feature}` (aturan proyek) tanpa folder dasar baru.

## Pertanyaan yang Menunggu Konfirmasi

| ID | Pertanyaan | Dampak |
|---|---|---|
| Q-S1 | Label grup menu: "Module Settings" atau "Pengaturan Modul" | Requirement 8.1 |
| Q-S2 | Setting CRM/Report ditempatkan di desk mana (enum `Domain` tidak memuat keduanya) | Requirement 8.4, spec other-modules |
| Q-S3 | Pemetaan desk awal (usulan di design) | Requirement 8.4 |
| Q-S5 | Apakah ada kunci `preferences` lain di produksi di luar yang di-seed (mis. `mail*`)? | Requirement 5.3, 12.1 |
