# Implementation Plan: Module Settings — Foundation

## Overview

Urutan: verifikasi (1), model dan tabel (2), service dan peta legacy (3), migrasi data (4), peralihan pembaca (5), halaman setting (6), izin dan menu (7), audit dan kontrak (8), lalu pensiun `preferences` yang GATED (10). **Tidak ada perubahan perilaku aplikasi** pada Task 1–8: setiap task memakai test existing sebagai jaring pengaman. Lint/Pint dijalankan sekali di akhir.

**Prasyarat**: tidak ada. Branch terbaru dari remote (aturan git worktree project). Baca `docs/prd/module-settings-prd.md` (Lampiran A) sebelum mulai.

**Aturan eksekusi**:

- Task 10 **GATED**: kerjakan hanya setelah satu rilis stabil dan persetujuan pemilik produk (Requirement 12).
- Task bertanda `[TODO]` pada design diselesaikan di Task 1 sebelum menulis kode.
- Jangan menambah penulisan baru ke `Preference`; baca lewat `SettingsService`/`LegacyPreferenceMap`.
- Jika Task 1 mengungkap asumsi tabel "Fakta codebase" salah, perbarui `design.md` dan minta konfirmasi sebelum lanjut.

## Tasks

- [x] 1. Verifikasi dan persiapan
  - [x] 1.1 Baca `app/Traits/DataTable.php` (`initPermissions`, `getModule`, flag `ignorePermission`) dan tentukan namespace/lokasi model setting serta flag trait agar tidak menambah kolom runtime
    - _Requirements: 1.5, 1.6_
  - [x] 1.2 Verifikasi tipe PK `countries` dan `currencies`, cast `App\Casts\Json`, dan mekanisme audit (`auditable`, `AuditableModelSaved`, `Log`) pada model singleton ulid; perbarui `design.md`
    - _Requirements: 1.4, 2.1, 10.1_
  - [x] 1.3 Inventarisasi final pembaca `Preference` (`grep "Preference::" app database routes config tests`) dan seluruh pemakaian prop `preferences` di `resources/js`; cocokkan dengan Requirement 6.1
    - _Requirements: 6.1_
  - [x] 1.4 Baca penuh `Settings/Company.jsx`, `FormPage`/`FormPageContent`, `CompanyController`; catat kontrak yang harus dipertahankan (rute, field, unggah logo)
    - _Requirements: 7.4, 7.5_
  - [x] 1.5 Jalankan baseline: `AppMiddlewareSharedPropsTest`, test render Print/Email template, test Quotation, `TaxInvoiceSerialAllocator`, test Asset yang memakai `company_name`; simpan hasil hijau
    - _Requirements: 6.4, 13.3_
  - [x] 1.6 **(Manual, staging/produksi)** Daftar semua kunci `preferences` aktual dan bandingkan dengan `legacy_map` (Q-S5)
    - Bukti 2026-10-19 (daftar 21 kunci dari pemilik produk): seluruhnya terpetakan di `legacy_map` (18 ke CoreSetting, 3 serial ke FinanceSetting); TIDAK ADA kunci tak dikenal. Kunci `mail_*` (8) dan `active_tax_id` tidak ada di produksi → email dan pajak default tak pernah dikonfigurasi; migrasi tak akan kehilangan data untuk kunci tersebut.
    - _Requirements: 5.3_

- [x] 2. Model dasar dan tabel
  - [x] 2.1 `ModuleSetting` abstrak (`current()`, `defaults()`, `rules()`, singleton) + `config/settings.php` (peta legacy dan registry kosong)
    - _Requirements: 1.1–1.3, 2.4_
  - [x] 2.2 Migrasi `create_core_settings_table`, `create_finance_settings_table`, `create_sales_settings_table` (kolom eksplisit, FK dengan perilaku hapus, `singleton` unik)
    - _Requirements: 1.4, 1.6, 2.1–2.3, 2.6_
  - [x] 2.3 Model `CoreSetting`, `FinanceSetting`, `SalesSetting` (casts, defaults, rules; izin; `translateKey`) + factory
    - _Requirements: 1.3, 1.5, 2.1–2.3_
  - [x] 2.4 Test: `initPermissions()` tidak menambah/menghapus kolom; **P-1** singleton di bawah pembuatan paralel
    - _Requirements: 1.2, 1.6_

- [x] 3. Service dan peta legacy
  - [x] 3.1 `SettingsService` (`get`, `update`, `lockedCurrent`, memo, event `ModuleSettingUpdated`, penurunan `default_number_format`)
    - _Requirements: 3.1–3.5_
  - [x]* 3.2 Write tests service: **P-5** validasi/FK/zona waktu, tanpa perubahan parsial; memo direset; `lockedCurrent`
    - **Validates: Requirements 3.1–3.5**
  - [x] 3.3 `LegacyPreferenceMap` (`build`, `snapshot`, kunci sensitif, `company_image`, nilai `null` tidak ditulis)
    - _Requirements: 4.1–4.3, 4.6_
  - [x]* 3.4 Write tests **P-2** parity peta lama vs baru untuk data seed; kunci tak dikenal tampil dan kunci sensitif tersembunyi
    - **Validates: Requirements 4.2, 4.5**

- [x] 4. Migrasi data
  - [x] 4.1 `PreferenceMigrator` (konversi tipe, validasi FK, idempoten, laporan terstruktur)
    - _Requirements: 5.1, 5.2, 5.4_
  - [x] 4.2 Perintah `settings:migrate-preferences {--dry-run} {--force} {--report}` dan pemanggilan non-force dari migrasi skema; rollback hanya menghapus tabel baru
    - _Requirements: 5.3, 5.5, 5.7_
  - [x] 4.3 Ubah `PreferenceSeeder` menyemai tabel baru (Branch utama tetap dibuat)
    - _Requirements: 5.6_
  - [x]* 4.4 Write tests **P-3**/**P-4**: idempoten, `--force`, `--dry-run`, nilai invalid, kunci tak dikenal tidak hilang
    - **Validates: Requirements 5.1–5.5**
  - [x] 4.5 Checkpoint - jalankan test Core terkait dan baseline Task 1.5
    - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Peralihan pembaca (tanpa perubahan perilaku)
  - [x] 5.1 `default_currency_id`: `SalesOrderService`, `PurchaseOrderService`, `SalesInvoiceService`, `PurchaseInvoiceService`, `PaymentEntryService`
    - _Requirements: 6.1_
  - [x] 5.2 `timezone`: `Quotation`, `FormatingSeries`, `FormatingSeriesService`; `num_per_page`: `DataTableScope`; `company_name`: `Asset`, `AssetController`; `city`, `company_image`: `QuotationController`, `CompanyLogoController`; `GroupLabelResolver`
    - _Requirements: 6.1_
  - [x] 5.3 `QuotationController`: pajak default dari `sales_settings.default_tax_id` (nama prop tetap)
    - _Requirements: 6.3_
  - [x] 5.4 `TaxInvoiceSerialAllocator` ke `finance_settings` dengan `lockedCurrent()`
    - _Requirements: 6.2_
  - [x] 5.5 `HandleInertiaRequests`, `PrintTemplateRenderService`, `EmailTemplateRenderService` memakai `LegacyPreferenceMap::snapshot()/build()`; ganti `config/command_search.php`
    - _Requirements: 4.4, 6.6_
  - [x] 5.6 Ubah test existing yang membuat `Preference` langsung: `AssetOwnershipGroupTest`, `AssetOwnershipMorphTest`, `QuotationLetterFieldsTest`, `QuotationTestCase`, `AssetServiceSplitTest`, `EmailTemplateRenderServiceTest`, `PermissionInitIgnorePermissionTest`, `ControllerPrintPreferencesDocInfoTest`; fixture skema minimal print memakai migrasi setting asli lewat `CreatesModuleSettingTables`
    - _Requirements: 6.4_
  - [x]* 5.7 Write test arsitektur **P-9**: `Preference::` tidak muncul di `app/` selain pengecualian terdaftar; test alokasi serial paralel **P-10**
    - **Validates: Requirements 6.2, 6.5**
  - [x] 5.8 Checkpoint - jalankan seluruh test Core, Asset, CRM, Finances terkait dan test frontend yang menyentuh prop `preferences`
    - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Halaman setting
  - [x] 6.1 `SettingsRegistry` + `ModuleSettingController` abstrak + `ModuleSettingRequest` + pembangkitan rute `moduleSettings.{modul}.*` di `routes/web.php`
    - _Requirements: 7.1–7.3_
  - [x] 6.2 Komponen `ModuleSettingsPage` (tab, simpan, belum tersimpan, toast, baca-saja) + `.rtl.test.jsx`
    - _Requirements: 7.4, 7.7_
  - [x] 6.3 `CompanyController` memakai `SettingsService` (Branch utama, format angka, logo tetap) dan `Company.jsx` menyesuaikan sumber data; pertahankan tab email melalui kolom Core bertipe, password terenkripsi/baca kosong
    - _Requirements: 7.5, 3.5_
  - [x] 6.4 Halaman **Finances Settings** (tab Faktur Pajak) dan **Sales Settings** (tab Default) + controller + registry + `.rtl.test.jsx`
    - _Requirements: 7.6_
  - [x] 6.5 Kunci terjemahan `lang/id` dan `lang/en`; `LocaleKeysTest` hijau
    - _Requirements: 7.7, 13.4_
  - [x]* 6.6 Write feature tests controller: **P-8** izin 403 tanpa `read`/`write`; validasi; perilaku Company sama (termasuk Branch utama)
    - **Validates: Requirements 7.3, 7.5**

- [x] 7. Izin dan menu
  - [x] 7.1 Migrasi data izin: salin izin `Preference` ke `CoreSetting`, beri Administrator izin pada semua model setting; perbarui `RolePermissionMigrator` (kunci legacy → `CoreSetting`)
    - _Requirements: 9.1–9.4_
  - [x] 7.2 `DeskSeeder`: `menuGroup('Module Settings', …)` dan `menuItem(...)` per halaman registry, multi-desk sesuai usulan, idempoten; menu "Company" memakai `CoreSetting`
    - _Requirements: 8.1, 8.2, 8.4, 8.5_
  - [x]* 7.3 Write tests menu **P-7**: 1 anggota → datar; ≥2 → submenu; filter izin; `MenuItem::forRoute()` untuk rute setting
    - **Validates: Requirements 8.3, 8.6**
  - [x] 7.4 Checkpoint - seeder dua kali tanpa duplikasi (dibuktikan `test_desk_seeder_is_idempotent_and_registers_registry_pages`); verifikasi visual browser diserahkan ke pemilik produk (login admin/admin, desk Core/Finances/Sales)
    - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Audit dan kontrak
  - [x] 8.1 Audit perubahan setting (nilai sebelum/sesudah), pengecualian seeder/migrasi data; tampil di halaman Logs
    - _Requirements: 10.1–10.3_
  - [x]* 8.2 Write tests **P-6**: satu entri audit per `update()` sukses; tidak ada entri pada seeder
    - **Validates: Requirements 10.1, 10.3**
  - [x] 8.3 Verifikasi bahwa `FinanceSetting` dapat menerima kolom baru lewat migrasi sendiri (uji kolom contoh pada test, tidak disimpan)
    - _Requirements: 11.3_

- [x] 9. Checkpoint akhir fase aditif
  - Jalankan `php artisan test --compact tests/Feature/Core tests/Feature/Asset tests/Feature/CRM tests/Feature/Finances tests/Unit` dan test frontend yang disentuh; `vendor/bin/pint --dirty --format agent`, `npm run lint`, `graphify update .`
    - Exit criteria: parity peta (**P-2**) hijau; **P-9** hijau; laporan `settings:migrate-preferences --report` tersimpan; menu terverifikasi manual.
    - Hasil 2026-10-19 (runner resmi `php -d memory_limit=2G vendor/bin/phpunit`; `artisan test` OOM pada batas 128M environment): Core 743 OK; Asset/CRM/Unit gabungan 1232 OK; Finances+Settings 143 OK; Settings pasca-pint 65 OK; frontend Settings 123 OK; pint fixed; lint 0 errors (322 warnings pre-existing, nihil di file sentuhan); graphify CLI tidak tersedia (graphify-out/ kosong) — dilewati.
    - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. **(GATED)** Pensiun `preferences`
  - [ ] 10.1 **(Setelah satu rilis stabil, laporan kunci tak dikenal bersih, dan persetujuan)** cadangkan isi `preferences` ke berkas terlampir pada laporan
    - Verifikasi staging lokal 2026-10-20: dump data-only berisi 327 `INSERT` untuk 103 tabel. Impor dilakukan per tabel; 46 tabel berhasil dengan FK aktif, 50 tabel dimuat dalam transaksi terpisah dengan FK checks dinonaktifkan hanya pada sesi tersebut setelah kegagalan FK berulang, dan 5 tabel runtime/migrasi lokal dipertahankan. Sebanyak 63 permission staging ditambahkan tanpa menghapus 65 permission hasil seeder; 21 baris `preferences` dicadangkan dan diimpor (kolom source-only `have_transactions` tidak ada di skema lokal). Audit 317 FK menghasilkan 0 orphan. `settings:migrate-preferences --dry-run --report` menunjukkan 21 migrated, 0 skipped, 0 invalid, dan 0 unknown keys; migrasi typed settings tidak dijalankan. Laporan dan backup ada di `storage/app/private/module-settings-task10/`. Task 10 tetap GATED karena rilis stabil produksi dan persetujuan pemilik produk belum dibuktikan.
    - _Requirements: 12.1, 12.3_
  - [ ] 10.2 Hapus model `Preference`, scope penyembunyi, tabel `preferences` (migrasi reversible), `PreferenceAuditLogSkipTest`, serta rujukan di `RolePermissionMigrator`, `DeskSeeder`, `PermissionSeeder`; pertahankan `LegacyPreferenceMap` beserta penyaringan kunci sensitif (pindahkan helper filter dari `Preference` sebelum model dihapus)
    - _Requirements: 12.2, 12.4_
  - [ ] 10.3 Checkpoint akhir: seluruh test hijau; **P-9** tanpa pengecualian
    - Ensure all tests pass, ask the user if questions arise.

## Catatan

- Task 1.6 dan 10.1 bersifat operasional dan menunggu akses/persetujuan; jangan menandainya selesai tanpa bukti laporan.
- Spec `module-defaults-and-controls` dan Finance P1–P6 menambah kolom lewat migrasi sendiri; jangan menambahkannya di sini.
- Label grup menu dan pemetaan desk (Q-S1, Q-S3) hanya mengubah konstanta registry/seeder, bukan arsitektur.
- Validasi pascareview 2026-10-19: 122 test backend terkait setting, Company, shared props, render print/email, faktur pajak, dan locale lulus; 24 test frontend modul/Company/FormChildren lulus; pemeriksaan sintaks PHP dan `git diff --check` lulus. Log backend: `storage/logs/settings-review-backend.log`. Ini bukan klaim seluruh suite proyek lulus.
- Test concurrency memakai dua proses PHP dan SQLite file terpisah; penguncian/latensi MySQL serta verifikasi manual staging tetap belum dibuktikan. Tidak ada migrasi yang diterapkan ke database development pada perbaikan ini. Lint/Pint tetap pada checkpoint akhir Task 9 sesuai workflow spec.
