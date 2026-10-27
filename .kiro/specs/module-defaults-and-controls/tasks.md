# Implementation Plan: Module Defaults and Controls

## Overview

Urutan: verifikasi (1), skema dan model (2), resolver dan pengiriman `defaults` ke form (3), frontend (4), halaman setting (5), toleransi (6, GATED hasil Task 1), task opsional (7), dan checkpoint (8). Default pajak/gudang/termin berawal kosong; toleransi null berawal unrestricted, sedangkan nilai 0 berarti batas ketat. Lint/Pint dijalankan sekali di akhir.

**Prasyarat**: `module-settings-foundation` selesai (Task 1–9 spec itu): `ModuleSetting`, `SettingsService`, `SettingsRegistry`, `ModuleSettingsPage`, menu. Branch terbaru dari remote (aturan git worktree project).

**Aturan eksekusi**:
- Task 6 **GATED** hasil Task 1.2 (validasi sisa yang ada).
- Task bertanda `*` pada Task 7 adalah **opsional**; pemilik produk telah mengotorisasi seluruh task opsional.
- Jika Task 1 mengungkap asumsi tabel "Fakta codebase" salah, perbarui `design.md` dan minta konfirmasi sebelum lanjut.

## Tasks

- [x] 1. Verifikasi dan persiapan
  - [x] 1.1 Inventarisasi jalur pembuatan dokumen: apakah Purchase Receipt, Purchase Invoice, Delivery Note, Sales Invoice dapat dibuat tanpa dokumen sumber, kolom sumbernya (`purchase_order_id`, `delivery_note_id`, dan seterusnya), dan perlakuan retur; perbarui tabel kontrol di `design.md` dan hapus `[TODO]`
    - _Requirements: 6.1, 6.3_
  - [x] 1.2 Baca validasi sisa kuantitas yang ada (penerimaan `received_quantity`, pengiriman, penagihan, `ReturnAgainstItemRules`) dan titik pemanggilannya pada simpan dan approve
    - _Requirements: 7.4_
  - [x] 1.3 Baca spec dan kode fitur baris di luar sumber; pastikan perilaku dan izinnya tetap tidak dibatasi oleh setting baru
    - _Requirements: 6.2_
  - [x] 1.4 Baca `PaymentSchedule.jsx` dan pemilih `PaymentTermTemplateLinkModel` (konversi item templat → baris jadwal), dokumen yang memakainya (PO, SO, PI, SI), dan tentukan cara mengekstrak konversi menjadi fungsi bersama
    - _Requirements: 4.1, 4.6_
  - [x] 1.5 Baca controller `create` dan form React PO, SO, PI, SI, Receipt, DN, Quotation: cara baris baru ditambahkan, dan cara `QuotationController` meneruskan pajak default; verifikasi field aktif/nonaktif pada `taxes` dan `warehouses`
    - _Requirements: 2.1, 3.1, 3.5_
  - [x] 1.6 Jalankan baseline test dokumen Purchase/Sales/Inventory yang akan disentuh dan simpan hasil hijau
    - _Requirements: 9.1_

- [x] 2. Skema dan model
  - [x] 2.1 Migrasi + model `PurchaseSetting`, `InventorySetting`; migrasi penambahan kolom pada `sales_settings`; `rules()` (persentase 0–100, referensi aktif); factory
    - _Requirements: 1.1–1.6_
  - [x] 2.2 Kolom `default_payment_term_template_id` pada `purchase_settings` dan `sales_settings` (FK `payment_term_templates`, `nullOnDelete`)
    - _Requirements: 4.1, 4.4_
  - [x]* 2.3 Write tests model: nilai awal netral, validasi persentase, FK `nullOnDelete`
    - **Validates: Requirements 1.2–1.6**

- [x] 3. Resolver dan pengiriman defaults
  - [x] 3.1 `DocumentDefaultsResolver` + enum `DefaultsDocumentType` (urutan modul → inventory, buang referensi nonaktif; templat termin beserta item untuk PO, SO, PI, SI)
    - _Requirements: 2.1, 3.1–3.5_
  - [x]* 3.2 Write unit tests **P-D5** referensi nonaktif/terhapus, urutan gudang
    - **Validates: Requirements 2.4, 3.2, 3.5**
  - [x] 3.3 Controller `create` PO, SO, PI, SI, Receipt, DN, Quotation mengirim prop `defaults` (tidak pada edit/show); Quotation memakai sumber baru
    - _Requirements: 2.1, 2.5, 3.1_
  - [x]* 3.4 Write feature tests **P-D8** `defaults` hanya pada create; nilai sesuai setting
    - **Validates: Requirements 2.1, 2.6, 3.1**

- [x] 4. Frontend defaults
  - [x] 4.1 Ekstrak konversi templat → jadwal dari `PaymentSchedule.jsx` menjadi fungsi bersama; hook `useDocumentDefaults` (`applyToNewLine`, hanya field kosong, gudang hanya item stok; `applyPaymentTerm` mengisi jadwal kosong)
    - _Requirements: 2.2, 2.3, 3.3, 3.4_
  - [x] 4.2 Terapkan pada form PO, SO, PI, SI, Receipt, DN, Quotation untuk baris baru manual (bukan baris dari sumber); `.rtl.test.jsx`
    - _Requirements: 2.1–2.3, 3.1–3.4_
  - [x]* 4.3 Write tests **P-D1**, **P-D3** pada hook dan form
    - **Validates: Requirements 2.2, 3.3, 3.4**

- [x] 5. Halaman setting
  - [x] 5.1 Halaman Purchase Settings, Sales Settings (lengkapi), Inventory Settings: tab Default dan Transaksi, pemilih hanya baris aktif, peringatan referensi, keterangan kontrol; registry dan desk
    - _Requirements: 5.1–5.4_
  - [x] 5.2 Kunci terjemahan `lang/id` dan `lang/en`; `LocaleKeysTest` hijau; `.rtl.test.jsx` halaman
    - _Requirements: 5.6, 9.4_
  - [x] 5.3 Checkpoint - jalankan test setting dan menu; verifikasi struktur desk/menu melalui test registry
    - Ensure all tests pass, ask the user if questions arise.

- [x] 6. **(GATED Task 1.2)** Toleransi
  - [x] 6.1 `ToleranceCalculator` + integrasi pada validasi kuantitas/nilai penerimaan, pengiriman, dan tagihan (simpan dan approve di bawah lock)
    - _Requirements: 7.1, 7.2, 7.4, 7.5_
  - [x]* 6.2 Write tests **P-D4**: null tidak membatasi; 0 ketat; >0 menaikkan batas tepat; ulang di bawah lock saat approve
    - **Validates: Requirements 7.1–7.4**

- [x] 7. Opsional (konfirmasi pemilik produk sebelum memulai; seluruh opsi disetujui 2026-10-20)
  - [x]* 7.1 `rate_change_action` (`none`/`warn`/`stop`) antar dokumen dalam rantai
    - _Requirements: 8.1_
  - [x]* 7.2 Validasi harga jual di bawah harga beli/valuasi
    - _Requirements: 8.1_
  - [x]* 7.3 Evaluasi izin stok negatif; tidak diaktifkan karena jalur Delivery Note menolak stok kurang dan valuasi mengambil batch dari stock queue, sehingga mengizinkan saldo negatif belum aman tanpa desain valuasi baru
    - _Requirements: 8.1; hasil audit: `DeliveryNoteService::onApproved` menolak jika `actual_quantity < quantity` dan pengeluaran mengambil nilai dari `stock_queue`._

- [x] 8. Penutupan
  - [x] 8.1 Checkpoint akhir: `php artisan test --compact tests/Feature/Purchase tests/Feature/Sales tests/Feature/Inventory tests/Feature/Finances tests/Feature/CRM tests/Unit`, test frontend yang disentuh; setelah semua task: `vendor/bin/pint --dirty --format agent`, `npm run lint`, `graphify update .`
    - Exit criteria: regresi toleransi null (**P-D2**) hijau; default tampil di form baru; toleransi terbukti di test.
    - Ensure all tests pass, ask the user if questions arise.
    - `graphify update .` tidak dijalankan karena executable `graphify` tidak tersedia di environment.

## Catatan

- Jangan memperkenalkan akun, diskon, atau selisih kurs di spec ini (Finance Engine).
- Default bersyarat menurut tipe/kategori barang ditangani spec `module-conditional-defaults` (bergantung spec ini); jaga bentuk `defaults` agar dapat diperluas.
- Setting dalam spec ini tidak menambahkan kontrol rantai dokumen; fleksibilitas sumber dan baris off-source yang ada harus dipertahankan.
