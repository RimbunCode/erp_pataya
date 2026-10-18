# Implementation Plan: Module Defaults and Controls

## Overview

Urutan: verifikasi (1), skema dan model (2), resolver dan pengiriman `defaults` ke form (3), frontend (4), halaman setting (5), kontrol rantai dan toleransi (6–7, GATED hasil Task 1), lalu task opsional (8) dan checkpoint (9). **Semua nilai awal netral**: merge tidak mengubah perilaku sampai admin mengisi setting. Lint/Pint dijalankan sekali di akhir.

**Prasyarat**: `module-settings-foundation` selesai (Task 1–9 spec itu): `ModuleSetting`, `SettingsService`, `SettingsRegistry`, `ModuleSettingsPage`, menu. Branch terbaru dari remote (aturan git worktree project).

**Aturan eksekusi**:
- Task 6 dan 7 **GATED** hasil Task 1.1–1.3 (dokumen mana yang dapat dibuat tanpa sumber; validasi sisa yang ada) dan keputusan Q-S6.
- Task bertanda `*` pada Task 8 adalah **opsional**: tanyakan pemilik produk sebelum memulai.
- Jika Task 1 mengungkap asumsi tabel "Fakta codebase" salah, perbarui `design.md` dan minta konfirmasi sebelum lanjut.

## Tasks

- [ ] 1. Verifikasi dan persiapan
  - [ ] 1.1 Inventarisasi jalur pembuatan dokumen: apakah Purchase Receipt, Purchase Invoice, Delivery Note, Sales Invoice dapat dibuat tanpa dokumen sumber, kolom sumbernya (`purchase_order_id`, `delivery_note_id`, dan seterusnya), dan perlakuan retur; perbarui tabel kontrol di `design.md` dan hapus `[TODO]`
    - _Requirements: 6.1, 6.3_
  - [ ] 1.2 Baca validasi sisa kuantitas yang ada (penerimaan `received_quantity`, pengiriman, penagihan, `ReturnAgainstItemRules`) dan titik pemanggilannya pada simpan dan approve
    - _Requirements: 7.4_
  - [ ] 1.3 Baca spec dan kode fitur baris di luar sumber (`purchase-receipt-off-po-items`, `purchase-invoice-off-po-items`, `delivery-note-sales-invoice-off-source-items`) dan putuskan perlakuan terhadap kontrol (Q-S6)
    - _Requirements: 6.4_
  - [ ] 1.4 Baca `PaymentSchedule.jsx` dan pemilih `PaymentTermTemplateLinkModel` (konversi item templat → baris jadwal), dokumen yang memakainya (PO, SO, PI, SI), dan tentukan cara mengekstrak konversi menjadi fungsi bersama
    - _Requirements: 4.1, 4.6_
  - [ ] 1.5 Baca controller `create` dan form React PO, SO, PI, SI, Receipt, DN, Quotation: cara baris baru ditambahkan, dan cara `QuotationController` meneruskan pajak default; verifikasi field aktif/nonaktif pada `taxes` dan `warehouses`
    - _Requirements: 2.1, 3.1, 3.5_
  - [ ] 1.6 Jalankan baseline test dokumen Purchase/Sales/Inventory yang akan disentuh dan simpan hasil hijau
    - _Requirements: 9.1_

- [ ] 2. Skema dan model
  - [ ] 2.1 Migrasi + model `PurchaseSetting`, `InventorySetting`; migrasi penambahan kolom pada `sales_settings`; `rules()` (persentase 0–100, referensi aktif); factory
    - _Requirements: 1.1–1.6_
  - [ ] 2.2 Kolom `default_payment_term_template_id` pada `purchase_settings` dan `sales_settings` (FK `payment_term_templates`, `nullOnDelete`)
    - _Requirements: 4.1, 4.4_
  - [ ]* 2.3 Write tests model: nilai awal netral, validasi persentase, FK `nullOnDelete`
    - **Validates: Requirements 1.2–1.6**

- [ ] 3. Resolver dan pengiriman defaults
  - [ ] 3.1 `DocumentDefaultsResolver` + enum `DefaultsDocumentType` (urutan modul → inventory, buang referensi nonaktif; templat termin beserta item untuk PO, SO, PI, SI)
    - _Requirements: 2.1, 3.1–3.5_
  - [ ]* 3.2 Write unit tests **P-D5** referensi nonaktif/terhapus, urutan gudang
    - **Validates: Requirements 2.4, 3.2, 3.5**
  - [ ] 3.3 Controller `create` PO, SO, PI, SI, Receipt, DN, Quotation mengirim prop `defaults` (tidak pada edit/show); Quotation memakai sumber baru
    - _Requirements: 2.1, 2.5, 3.1_
  - [ ]* 3.4 Write feature tests **P-D8** `defaults` hanya pada create; nilai sesuai setting
    - **Validates: Requirements 2.1, 2.6, 3.1**

- [ ] 4. Frontend defaults
  - [ ] 4.1 Ekstrak konversi templat → jadwal dari `PaymentSchedule.jsx` menjadi fungsi bersama; hook `useDocumentDefaults` (`applyToNewLine`, hanya field kosong, gudang hanya item stok; `applyPaymentTerm` mengisi jadwal kosong)
    - _Requirements: 2.2, 2.3, 3.3, 3.4_
  - [ ] 4.2 Terapkan pada form PO, SO, PI, SI, Receipt, DN, Quotation untuk baris baru manual (bukan baris dari sumber); `.rtl.test.jsx`
    - _Requirements: 2.1–2.3, 3.1–3.4_
  - [ ]* 4.3 Write tests **P-D1**, **P-D3** pada hook dan form
    - **Validates: Requirements 2.2, 3.3, 3.4**

- [ ] 5. Halaman setting
  - [ ] 5.1 Halaman Purchase Settings, Sales Settings (lengkapi), Inventory Settings: tab Default dan Transaksi, pemilih hanya baris aktif, peringatan referensi, keterangan kontrol; registry dan desk
    - _Requirements: 5.1–5.4_
  - [ ] 5.2 Kunci terjemahan `lang/id` dan `lang/en`; `LocaleKeysTest` hijau; `.rtl.test.jsx` halaman
    - _Requirements: 5.6, 9.4_
  - [ ] 5.3 Checkpoint - jalankan test setting dan menu; verifikasi manual menu per desk (datar/submenu)
    - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. **(GATED Task 1.1–1.3, Q-S6)** Kontrol rantai dokumen
  - [ ] 6.1 `DocumentChainGuard` dengan peta kontrol terverifikasi; pengecualian retur dan baris di luar sumber sesuai keputusan
    - _Requirements: 6.1–6.4_
  - [ ] 6.2 Panggil guard pada simpan dan approve di service Receipt, Purchase Invoice, Delivery Note, Sales Invoice; pesan galat berlokalisasi
    - _Requirements: 6.2, 6.5, 6.7_
  - [ ] 6.3 UI: sembunyikan/nonaktifkan aksi "buat tanpa sumber" bila kontrol aktif
    - _Requirements: 6.6_
  - [ ]* 6.4 Write tests **P-D6**, **P-D7**, **P-D2**: kontrol nonaktif = perilaku lama; aktif menolak; retur lolos; dokumen lama tidak berubah
    - **Validates: Requirements 6.2–6.7**

- [ ] 7. **(GATED Task 1.2)** Toleransi
  - [ ] 7.1 `ToleranceCalculator` + integrasi pada validasi kuantitas/nilai penerimaan, pengiriman, dan tagihan (simpan dan approve di bawah lock)
    - _Requirements: 7.1, 7.2, 7.4, 7.5_
  - [ ]* 7.2 Write tests **P-D4**: toleransi 0 identik; >0 menaikkan batas tepat; ulang di bawah lock saat approve
    - **Validates: Requirements 7.1–7.4**

- [ ] 8. Opsional (konfirmasi pemilik produk sebelum memulai)
  - [ ]* 8.1 `rate_change_action` (`none`/`warn`/`stop`) antar dokumen dalam rantai
    - _Requirements: 8.1_
  - [ ]* 8.2 Validasi harga jual di bawah harga beli/valuasi
    - _Requirements: 8.1_
  - [ ]* 8.3 Izin stok negatif (hanya bila Task 1 / Q-D2 menunjukkan aman)
    - _Requirements: 8.1_

- [ ] 9. Penutupan
  - [ ] 9.1 Checkpoint akhir: `php artisan test --compact tests/Feature/Purchase tests/Feature/Sales tests/Feature/Inventory tests/Feature/Finances tests/Feature/CRM tests/Unit`, test frontend yang disentuh; setelah semua task: `vendor/bin/pint --dirty --format agent`, `npm run lint`, `graphify update .`
    - Exit criteria: regresi netral (**P-D2**) hijau; default tampil di form baru; kontrol/toleransi terbukti di test.
    - Ensure all tests pass, ask the user if questions arise.

## Catatan

- Jangan memperkenalkan akun, diskon, atau selisih kurs di spec ini (Finance Engine).
- Default bersyarat menurut tipe/kategori barang ditangani spec `module-conditional-defaults` (bergantung spec ini); jaga bentuk `defaults` agar dapat diperluas.
- Jika Task 1.1 menunjukkan semua dokumen turunan sudah selalu bersumber, Task 6 dikeluarkan dan dicatat di requirements.
