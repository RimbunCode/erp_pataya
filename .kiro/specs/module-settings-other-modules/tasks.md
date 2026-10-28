# Implementation Plan: Module Settings — Other Modules

## Overview

Urutan: verifikasi dan validasi ulang kebutuhan (1), skema dan model (2), pengiriman `defaults` dan frontend per modul (3–5), halaman dan menu (6), checkpoint (7). **Semua nilai awal kosong**: merge tidak mengubah perilaku. Lint/Pint dijalankan sekali di akhir.

**Prasyarat**: `module-settings-foundation` selesai; Branch terbaru dari remote (aturan git worktree project). Disarankan setelah `module-defaults-and-controls` agar hook `useDocumentDefaults` dapat dipakai ulang.

**Aturan eksekusi**:
- Task 1 menentukan setting mana yang benar-benar dikerjakan; hentikan dan minta konfirmasi bila kebutuhan tidak terbukti (Q-O1).
- Jika Task 1 mengungkap asumsi tabel "Fakta codebase" salah, perbarui `design.md` dan minta konfirmasi sebelum lanjut.
- Jangan menambah akun ke `asset_settings` (Finance P2).

## Tasks

- [x] 1. Verifikasi dan validasi ulang
  - [x] 1.1 Baca `AssetCategory` (model, request, form) dan pastikan nilai yang diizinkan untuk metode/frekuensi/jumlah; tentukan sumber opsi untuk `rules()`
    - _Requirements: 1.1, 1.2_
    - Hasil 2026-10-27: request longgar (`nullable|string`, `integer`); sumber opsi = empat kunci `DepreciationMethodFactory`.
  - [x] 1.2 Baca `Quotation` (model, form, validasi `valid_until`) dan cara pajak default saat ini diterapkan
    - _Requirements: 2.2, 2.4_
    - Hasil 2026-10-27: `valid_until` wajib hanya untuk `new_unit`/`rental`; form `Quotations/Form.jsx` sudah memakai `useDocumentDefaults`.
  - [x] 1.3 Baca `Ticket` (model, request, form): opsi `type`/`priority`, aturan `start_date`/`due_date`
    - _Requirements: 3.1, 3.2_
    - Hasil 2026-10-27: opsi hanya `in:` di `TicketRequest`/`TicketResponseRequest`; `start_date` wajib, `due_date` nullable.
  - [x] 1.4 Kaji alur Work Order untuk kandidat setting Service; catat keputusan di requirements (tambah requirement atau keluarkan Service)
    - _Requirements: 4.1, 4.2_
    - Hasil 2026-10-27: tidak ada kandidat; Service dikeluarkan (D-O2).
  - [x] 1.5 Konfirmasi kebutuhan ketiga setting dengan pemilik produk (Q-O1) dan tentukan desk untuk CRM (Q-S2)
    - _Requirements: 5.3_
    - Hasil 2026-10-27: pemilik produk menyetujui ketiga setting (D-O1) dan pengeluaran Service (D-O2); Q-S2 tidak berlaku karena Quotation berada di Sales Settings.

- [x] 2. Skema dan model
  - [x] 2.1 Migrasi + model `AssetSetting` dan `HelpdeskSetting`; migrasi `quotation_validity_days` pada `sales_settings`; `rules()` terhadap opsi sumber; factory
    - _Requirements: 1.1, 2.1, 3.1_
  - [x]* 2.2 Write tests model: nilai awal null, validasi opsi, tanpa kolom akun (**P-O5**)
    - **Validates: Requirements 1.1, 1.4, 2.1, 3.1**

- [x] 3. Asset
  - [x] 3.1 Controller `create` aset mengirim `defaults`; form Aset mengisi tiga field depresiasi yang kosong saat "Hitung depresiasi" dicentang pada aset baru; `.rtl.test.jsx`
    - _Requirements: 1.2, 1.3_
  - [x]* 3.2 Write tests **P-O1**, **P-O2** pada aset
    - **Validates: Requirements 1.2**

- [x] 4. Quotation
  - [x] 4.1 Controller `create` mengirim `quotation_validity_days`; form mengisi `valid_until` dan mengikuti `date` sampai disentuh manual; `.rtl.test.jsx`
    - _Requirements: 2.2, 2.3_
  - [x]* 4.2 Write tests **P-O3** perhitungan dan perilaku mengikuti `date`
    - **Validates: Requirements 2.2**

- [x] 5. Helpdesk
  - [x] 5.1 Controller `create` tiket mengirim `defaults`; form mengisi tipe, prioritas, dan `due_date`; `.rtl.test.jsx`
    - _Requirements: 3.2, 3.3_
  - [x]* 5.2 Write tests **P-O4** opsi tidak valid tidak mengisi; dokumen lama tidak berubah
    - **Validates: Requirements 3.2–3.4**

- [x] 6. Halaman setting dan menu
  - [x] 6.1 Halaman Asset Settings dan Helpdesk Settings; tab Default pada Sales Settings; registry dan desk; kunci terjemahan; `LocaleKeysTest` hijau
    - _Requirements: 5.1, 5.2, 5.4, 6.3_
  - [x] 6.2 Verifikasi menu per desk (datar/submenu) setelah halaman baru terdaftar
    - _Requirements: 5.2_

- [x] 7. Penutupan
  - [x] 7.1 Checkpoint akhir: `php artisan test --compact tests/Feature/Asset tests/Feature/CRM tests/Feature/Helpdesk tests/Unit`, test frontend yang disentuh; setelah semua task: `vendor/bin/pint --dirty --format agent`, `npm run lint`, `graphify update .`
    - Exit criteria: regresi netral (**P-O2**) hijau; default tampil di form baru.
    - Ensure all tests pass, ask the user if questions arise.

## Catatan

- Task 1 selesai 2026-10-27; keputusan D-O1/D-O2/D-O3 ada di `requirements.md`.
- Task 7.1 selesai 2026-10-28: regresi backend (Settings, Asset, CRM, Helpdesk, LocaleKeys) 494 test dan Unit + test baru 1047 test hijau; frontend 313 test hijau; verifikasi browser Asset, Helpdesk, Sales, Quotation. `graphify update .` dilewati karena alat tidak terpasang di mesin ini.
- Setting User dan Report sengaja tidak ada; tambahkan sebagai requirement baru hanya bila ada kebutuhan nyata (Q-O2).
