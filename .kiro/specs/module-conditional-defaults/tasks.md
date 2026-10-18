# Implementation Plan: Module Conditional Defaults

## Overview

Urutan: verifikasi (1), skema dan model (2), pencocok, resolver, dan endpoint (3), frontend (4), halaman setting (5), checkpoint (6). **Tanpa aturan, perilaku sama dengan spec `module-defaults-and-controls`**: merge tidak mengubah perilaku sampai admin membuat aturan. Lint/Pint dijalankan sekali di akhir.

**Prasyarat**: `module-settings-foundation` dan `module-defaults-and-controls` selesai (resolver default, hook `useDocumentDefaults`, halaman Purchase/Sales Settings). Branch terbaru dari remote (aturan git worktree project).

**Aturan eksekusi**:
- Jangan membuat penyimpanan banyak pajak per baris; itu spec `multi-tax-per-line`. Pertahankan bentuk `tax_ids` berupa daftar.
- Jangan menambah aturan akun; itu Finance P2.
- Jika Task 1 mengungkap asumsi tabel "Fakta codebase" salah, perbarui `design.md` dan minta konfirmasi sebelum lanjut.

## Tasks

- [ ] 1. Verifikasi dan persiapan
  - [ ] 1.1 Verifikasi atribut `Item` (`type`, `is_stock_item`, `category_id`), nilai `items.type` yang dipakai, dan struktur/hierarki `categories`; tentukan apakah kondisi kategori cukup kecocokan langsung (Q-C2)
    - _Requirements: 1.1, 1.2_
  - [ ] 1.2 Baca implementasi `DocumentDefaultsResolver`, prop `defaults`, dan `useDocumentDefaults` dari spec defaults; tentukan titik perluasan
    - _Requirements: 2.2, 4.1_
  - [ ] 1.3 Periksa apakah Finance P2 sudah menulis `AccountRuleMatcher`; putuskan pencocok bersama atau terpisah (Q-C3) dan catat di `design.md`
    - _Requirements: 2.1_
  - [ ] 1.4 Baca cara form PO, SO, PI, SI, Quotation menambah baris dan memilih barang (komponen LinkModel item) untuk menentukan titik pemanggilan endpoint
    - _Requirements: 4.1, 4.4_
  - [ ] 1.5 Jalankan baseline test default dan form dokumen yang akan disentuh; simpan hasil hijau
    - _Requirements: 6.1_

- [ ] 2. Skema dan model
  - [ ] 2.1 Migrasi + model `DefaultTaxRule` dan `DefaultWarehouseRule` (kolom eksplisit, FK, `rules()`, izin/audit mengikuti setting, factory)
    - _Requirements: 1.1–1.7_
  - [ ]* 2.2 Write tests model/service: duplikat ditolak, tanpa kondisi ditolak, `tax_id = null` valid, gudang dengan `is_stock_item = false` ditolak, referensi nonaktif ditolak
    - **Validates: Requirements 1.3–1.7**

- [ ] 3. Pencocok, resolver, endpoint
  - [ ] 3.1 `ItemAttributes`, `DefaultRule`, `DefaultRuleMatcher` (spesifisitas, prioritas, murni)
    - _Requirements: 2.1, 2.4, 2.5_
  - [ ]* 3.2 Write unit tests **P-C1**, **P-C5**
    - **Validates: Requirements 2.1, 2.4, 2.5**
  - [ ] 3.3 `DocumentDefaultsResolver::resolveForItems` (pajak, gudang, fallback berurutan, non-stok, pengecualian pajak)
    - _Requirements: 2.2, 2.3, 1.5, 1.6_
  - [ ]* 3.4 Write tests **P-C2**, **P-C3**, **P-C4**, **P-C7**
    - **Validates: Requirements 2.2, 2.3, 3.2**
  - [ ] 3.5 `DefaultsResolveController` + `DefaultsResolveRequest` + rute `POST /defaults/resolve`; izin, batas jumlah barang, query konstan
    - _Requirements: 3.1–3.5_
  - [ ]* 3.6 Write feature tests endpoint (validasi, izin 403, **P-C8**)
    - **Validates: Requirements 3.1–3.5**

- [ ] 4. Frontend
  - [ ] 4.1 Perluas `useDocumentDefaults`: `resolveForItem` (pengelompokan), `applyToNewLine` dari hasil, fallback ke `defaults` modul saat gagal
    - _Requirements: 4.1–4.4_
  - [ ] 4.2 Hubungkan pada form PO, SO, PI, SI, Quotation (baris baru manual saja); `.rtl.test.jsx`
    - _Requirements: 4.1, 4.2, 4.5_
  - [ ]* 4.3 Write tests **P-C6** tanpa timpa; fallback gagal; baris dari sumber tidak berubah
    - **Validates: Requirements 4.2, 4.3**

- [ ] 5. Halaman setting
  - [ ] 5.1 Tab "Aturan Default" pada Purchase Settings dan Sales Settings: tabel pajak dan gudang yang dapat diedit, pemilih referensi aktif, peringatan referensi, pratinjau hasil
    - _Requirements: 5.1–5.3_
  - [ ] 5.2 Kunci terjemahan `lang/id` dan `lang/en`; `LocaleKeysTest` hijau; `.rtl.test.jsx`
    - _Requirements: 5.5, 6.4_
  - [ ]* 5.3 Write feature test audit aturan dan izin `read`/`write`
    - **Validates: Requirements 5.4**

- [ ] 6. Penutupan
  - [ ] 6.1 Checkpoint akhir: `php artisan test --compact tests/Feature/Purchase tests/Feature/Sales tests/Feature/CRM tests/Feature/Core tests/Unit`, test frontend yang disentuh; setelah semua task: `vendor/bin/pint --dirty --format agent`, `npm run lint`, `graphify update .`
    - Exit criteria: netral tanpa aturan (**P-C2**) hijau; aturan menghasilkan default benar di form baru.
    - Ensure all tests pass, ask the user if questions arise.

## Catatan

- Pajak default menurut pelanggan/pemasok (Q-C1) bukan bagian spec ini; tulis spec lanjutan bila dibutuhkan.
- Saat spec `multi-tax-per-line` datang, ubah `tax_id` pada aturan menjadi himpunan (pivot) dan penerapan form menjadi seluruh `tax_ids`; kontrak endpoint tidak berubah.
