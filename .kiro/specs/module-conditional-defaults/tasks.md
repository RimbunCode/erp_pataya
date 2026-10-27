# Implementation Plan: Module Conditional Defaults

## Overview

Urutan: verifikasi (1), skema dan model (2), pencocok, resolver, dan endpoint (3), frontend (4), halaman setting (5), checkpoint (6). **Tanpa aturan, perilaku sama dengan spec `module-defaults-and-controls`**: merge tidak mengubah perilaku sampai admin membuat aturan. Lint/Pint dijalankan sekali di akhir.

**Prasyarat**: `module-settings-foundation` dan `module-defaults-and-controls` selesai (resolver default, hook `useDocumentDefaults`, halaman Purchase/Sales Settings). Branch terbaru dari remote (aturan git worktree project).

**Aturan eksekusi**:
- Jangan membuat penyimpanan banyak pajak per baris; itu spec `multi-tax-per-line`. Pertahankan bentuk `tax_ids` berupa daftar.
- Jangan menambah aturan akun; itu Finance P2.
- Jika Task 1 mengungkap asumsi tabel "Fakta codebase" salah, perbarui `design.md` dan minta konfirmasi sebelum lanjut.

## Tasks

- [x] 1. Verifikasi dan persiapan
  - [x] 1.1 Verifikasi atribut `Item` (`type`, `is_stock_item`, `category_id`), nilai `items.type` yang dipakai, dan struktur/hierarki `categories`; tentukan apakah kondisi kategori cukup kecocokan langsung (Q-C2)
    - _Requirements: 1.1, 1.2_
  - [x] 1.2 Baca implementasi `DocumentDefaultsResolver`, prop `defaults`, dan `useDocumentDefaults` dari spec defaults; tentukan titik perluasan
    - _Requirements: 2.2, 4.1_
  - [x] 1.3 Periksa apakah Finance P2 sudah menulis `AccountRuleMatcher`; putuskan pencocok bersama atau terpisah (Q-C3) dan catat di `design.md`
    - _Requirements: 2.1_
  - [x] 1.4 Baca cara form PO, SO, PI, SI, Quotation menambah baris dan memilih barang (komponen LinkModel item) untuk menentukan titik pemanggilan endpoint
    - _Requirements: 4.1, 4.4_
  - [x] 1.5 Jalankan baseline test default dan form dokumen yang akan disentuh; simpan hasil hijau
    - Baseline Vitest: 6 files / 155 tests passed. Backend PHP belum tersedia pada awal task; validasi backend pasca-implementasi dijalankan dengan runtime PHP dan seluruh tes terkait lulus.
    - _Requirements: 6.1_

- [x] 2. Skema dan model
  - [x] 2.1 Migrasi + model `DefaultTaxRule` dan `DefaultWarehouseRule` (kolom eksplisit, FK, `rules()`, izin/audit mengikuti setting, factory)
    - _Requirements: 1.1–1.7_
  - [x]* 2.2 Write tests model/service: duplikat ditolak, tanpa kondisi ditolak, `tax_id = null` valid hanya untuk SO/SI (D-S18), gudang dengan `is_stock_item = false` ditolak, referensi nonaktif ditolak
    - **Validates: Requirements 1.3–1.7**

- [x] 3. Pencocok, resolver, endpoint
  - [x] 3.1 `ItemAttributes`, `DefaultRule`, `DefaultRuleMatcher` (spesifisitas, prioritas, murni)
    - _Requirements: 2.1, 2.4, 2.5_
  - [x]* 3.2 Write unit tests **P-C1**, **P-C5**
    - **Validates: Requirements 2.1, 2.4, 2.5**
  - [x] 3.3 `DocumentDefaultsResolver::resolveForItems` (pajak, gudang, fallback berurutan, non-stok, pengecualian pajak)
    - _Requirements: 2.2, 2.3, 1.5, 1.6_
  - [x]* 3.4 Write tests **P-C2**, **P-C3**, **P-C4**, **P-C7**
    - **Validates: Requirements 2.2, 2.3, 3.2**
  - [x] 3.5 `DefaultsResolveController` + `DefaultsResolveRequest` + rute `POST /defaults/resolve`; izin, batas jumlah barang, query konstan
    - _Requirements: 3.1–3.5_
  - [x]* 3.6 Write feature tests endpoint (validasi, izin 403, **P-C8**)
    - **Validates: Requirements 3.1–3.5**

- [x] 4. Frontend
  - [x] 4.1 Perluas `useDocumentDefaults`: `resolveForItem` (pengelompokan), `applyToNewLine` dari hasil, fallback ke `defaults` modul saat gagal
    - _Requirements: 4.1–4.4_
- [x] 4.2 Hubungkan pada form PO, SO, PI, SI, Quotation (baris baru manual saja); dukung resolver gudang hanya pada dokumen yang menyediakan field gudang, termasuk Penerimaan Pembelian dan Surat Jalan untuk baris manual; `.rtl.test.jsx`
    - _Requirements: 4.1, 4.2, 4.5_
  - [x]* 4.3 Write tests **P-C6** tanpa timpa; fallback gagal; baris dari sumber tidak berubah
    - **Validates: Requirements 4.2, 4.3**

- [x] 5. Halaman setting
  - [x] 5.1 Tab "Aturan Default" pada Purchase Settings dan Sales Settings: tabel pajak dan gudang yang dapat diedit, pemilih referensi aktif, peringatan referensi, pratinjau hasil
    - _Requirements: 5.1–5.3_
  - [x] 5.2 Kunci terjemahan `lang/id` dan `lang/en`; `LocaleKeysTest` hijau; `.rtl.test.jsx`
    - _Requirements: 5.5, 6.4_
  - [x]* 5.3 Write feature test audit aturan dan izin `read`/`write`
    - **Validates: Requirements 5.4**

- [x] 6. Penutupan
  - [x] 6.1 Checkpoint akhir: `php artisan test --compact tests/Feature/Purchase tests/Feature/Sales tests/Feature/CRM tests/Feature/Core tests/Unit`, test frontend yang disentuh; setelah semua task: `vendor/bin/pint --dirty --format agent`, `npm run lint`, `graphify update .`
    - Exit criteria: netral tanpa aturan (**P-C2**) hijau; aturan menghasilkan default benar di form baru.
    - Validasi backend: 1.996 tes / 7.063 assertions lulus; 40 deprecation dan 2 tes skipped. Tes terkait conditional defaults dan atomic save: 63 tes / 280 assertions lulus.
    - Validasi frontend: seluruh Vitest 513 file / 7.253 tes lulus; RTL terfokus terbaru 32 tes lulus. `npm run build` berhasil untuk client dan SSR. `npm run lint` selesai tanpa error (404 warning yang sudah ada di basis kode).
    - Pint dan `git diff --check` lulus. `graphify update .` tidak dapat dijalankan karena perintah `graphify` tidak tersedia pada environment ini.
    - Browser in-app: aturan pajak uji disimpan, bertahan setelah reload, dihapus, lalu reload ulang memastikan data uji tidak tersisa. Perilaku submit aturan saat versi stale juga dicakup tes backend/frontend.
    - Review keamanan read-only: tidak ada temuan P0–P2. Token wrapper, locking read terhadap snapshot MySQL, transaksi atomik, dan batas dokumen gudang telah ditinjau. Cakupan review tidak menguji konkurensi dua koneksi MySQL secara langsung.

## Catatan

- Pajak default menurut pelanggan/pemasok (Q-C1) bukan bagian spec ini; tulis spec lanjutan bila dibutuhkan.
- Saat spec `multi-tax-per-line` datang, ubah `tax_id` pada aturan menjadi himpunan (pivot) dan penerapan form menjadi seluruh `tax_ids`; kontrak endpoint tidak berubah.
