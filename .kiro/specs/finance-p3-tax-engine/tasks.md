# Implementation Plan: Finance P3 — Tax Engine

## Overview

Bagian A (Task 1–8) tidak mengubah angka di dokumen; Bagian B (Task 9) adalah konversi kolom yang **GATED D-15**. Urutan: audit data pajak (1), skema + model (2), backfill versi 1 (3), resolver + engine dengan test (4), snapshot di service dokumen (5), pemisahan baris pajak di rule posting + cutover (6), Faktur Pajak + UI (7–8), konversi kolom (9), checkpoint (10). Lint/Pint sekali di akhir.

**Prasyarat**: Fase 2 selesai untuk Sales Invoice dan Purchase Invoice (mode `on` stabil); D-12 (kebijakan posting pajak) disetujui akuntan sebelum Task 6; Q-P3-1…4 terjawab. Branch terbaru dari remote.

**Aturan eksekusi**:
- Task 9 **GATED**: hanya dengan persetujuan D-15, hasil audit pemakai kolom, dan jendela pemeliharaan.
- Jangan mengubah `taxes.rate` data lama; perubahan tarif = versi baru.
- Jangan menebak klasifikasi pajak (`unclassified` sampai akuntan menetapkan).
- Spec `dpp-discount-and-tax-compliance`: beri catatan "Requirement 4 disupersede oleh finance-p3-tax-engine" hanya setelah D-15 disetujui.
- Task bertanda `*` opsional; konfirmasi sebelum dilewati.

## Tasks

- [ ] 1. Audit dan verifikasi asumsi (read-only)
  - [ ] 1.1 Dump seluruh `taxes` (nama, rate) di staging/produksi dan jumlah pemakaian per pajak pada item invoice 12 bulan; tandai `rate` yang mencurigakan terhadap DPP 11/12; kirim ke pemilik produk/akuntan (Q-P3-1)
    - _Requirements: 6.3_
  - [ ] 1.2 Audit pemakai kolom `dpp_amount`/`tax_amount`/`amount` item invoice: view (`report_sales_invoice_view`), laporan, `assignTaxInvoice`, cetak, frontend
    - _Requirements: 12.6_
  - [ ] 1.3 Baca `PurchaseInvoiceService` untuk alur pajak (fillItemRelations, onApproved, retur, off-PO) dan `SalesInvoiceService` baris 60–200 dan 280–340; catat perbedaan dengan asumsi design
    - _Requirements: 5.2–5.3_
  - [ ] 1.4 Audit COA: akun `account_type = tax` dan kebutuhan PPN Keluaran/Masukan/PPh (Q-P3-4); verifikasi status task 11 spec DPP (belum dikerjakan)
    - _Requirements: 1.5, 7.7_

- [ ] 2. Skema dan model (aditif)
  - [ ] 2.1 Migration `add_classification_columns_to_taxes_table` (`category`, `behavior`, `jurisdiction_code`, `is_creditable`); model `Tax` (`$casts`, `$configColumns`)
    - _Requirements: 1.1–1.2_
  - [ ] 2.2 Migration `create_tax_rule_versions_table` + model `TaxRuleVersion` (izin `manage_rule_versions`, `configColumns`, `translateKey`)
    - _Requirements: 2.1, 13.3_
  - [ ] 2.3 Migration kolom snapshot: `tax_rule_version_id` pada `sales_invoice_items`, `purchase_invoice_items`, `general_ledgers`; `tax_breakdown` JSON pada `sales_invoices`, `purchase_invoices`
    - _Requirements: 5.1, 5.4_
  - [ ] 2.4 Setting `finance_tax_split_from.*`, `finance_company_is_pkp`, `finance_tax_engine_calc_enabled`
    - _Requirements: 2.7, 7.5, 7.9_
  - [ ] 2.5 Test `initPermissions()` pada `TaxRuleVersion` dan perubahan `Tax` (F-12)
    - _Requirements: 13.2_

- [ ] 3. Backfill versi awal
  - [ ] 3.1 `finance:init-tax-rules {--dry-run}`: versi 1 per pajak (`rate` dari `taxes.rate`, 11/12, `per_line`, `active`, `needs review`), idempoten, laporan rate mencurigakan
    - _Requirements: 6.1–6.3_
  - [ ] 3.2 `finance:report-unclassified-taxes` (pajak `unclassified` + pemakaian)
    - _Requirements: 10.5_
  - [ ]* 3.3 Write tests backfill dan laporan
    - **P-6** idempoten; tidak menimpa; laporan menandai rate mencurigakan
    - **Validates: Requirements 6.1–6.3**

- [ ] 4. Resolver dan engine (TDD)
  - [ ] 4.1 `TaxInput`, `TaxComponent`, `TaxResult` (serialisasi/`fromJson`), exception `NoEffectiveTaxRuleException`, `InvalidTaxRuleVersionException`
    - _Requirements: 3.2, 4.2, 4.6_
  - [ ] 4.2 `TaxRuleVersionService` (tumpang-tindih, versi baru, aktivasi, **guard faktor 11/12** selama `finance_tax_engine_calc_enabled=false`)
    - _Requirements: 2.2–2.3, 2.7_
  - [ ] 4.3 `TaxRuleResolver` (query efektif, cache per `(tax,date)`)
    - _Requirements: 3.1–3.4_
  - [ ] 4.4 `TaxEngine` (`calculate`, `calculateDocument`, `verify`; aritmetika integer minor unit)
    - _Requirements: 4.1–4.6, 8.1_
  - [ ]* 4.5 Write tests resolver dan engine
    - **P-3** batas tanggal; **P-4** versi baru lewat data; **P-5** verify versi 1 = kolom generated; **P-7** guard faktor; pembulatan per_line/per_document; minor unit 0
    - **Validates: Requirements 2.2–2.7, 3.1–3.4, 4.1–4.6**
  - [ ] 4.6 Test arsitektur **P-9**: `Tax/**` tanpa `use` model Sales/Purchase/Inventory
    - _Requirements: 4.4_

- [ ] 5. Snapshot di service dokumen
  - [ ] 5.1 `SalesInvoiceService::fillItemRelations()` memakai resolver (tanggal dokumen) → isi `tax_rate` dan `tax_rule_version_id`
    - _Requirements: 5.2_
  - [ ] 5.2 Padanan di `PurchaseInvoiceService` (termasuk jalur off-PO dan retur)
    - _Requirements: 5.2_
  - [ ] 5.3 `onApproved()` kedua service menyimpan `tax_breakdown` (`TaxResult` dari nilai tersimpan + `warnings` bila beda dengan engine); immutable setelah approved
    - _Requirements: 5.3_
  - [ ]* 5.4 Write tests snapshot
    - **P-2** angka dokumen tidak berubah (golden); invoice legacy tanpa snapshot tetap valid; versi tak ada → `NoEffectiveTaxRuleException`; `tax_breakdown` tak berubah setelah approved
    - **Validates: Requirements 5.1–5.6**

- [ ] 6. Pemisahan baris pajak di jurnal (butuh D-12, Q-P3-2…4)
  - [ ] 6.1 Perluas `PostingContext` dengan `taxComponents` (kompatibel mundur) dan `RoleLine` dengan `taxRuleVersionId`; teruskan ke `general_ledgers.tax_rule_version_id`
    - _Requirements: 5.4, 7.4_
  - [ ] 6.2 Pabrik konteks invoice: kelompokkan komponen dari item tersimpan; hitung `classified`, `isCreditable`; set `flags['tax_split']` berdasarkan `finance_tax_split_from.*`
    - _Requirements: 7.1–7.3, 7.5, 7.9_
  - [ ] 6.3 Rule Sales Invoice dan Purchase Invoice: baris pajak terpisah, baris pendapatan/beban sebagai sisa, retur menukar sisi; bentuk lama bila tidak ada komponen/pra-cutover; log `unsplit_tax`
    - _Requirements: 7.1–7.4, 7.6, 8.2_
  - [ ] 6.4 Lengkapi `finance:init-posting-profile` melaporkan akun `tax` ambigu dan peran `tax_*` yang belum terpetakan (tanpa menebak)
    - _Requirements: 7.7–7.8_
  - [ ]* 6.5 Write golden tests G1–G6 dan test properti
    - **P-1** seimbang & Σ pajak = Σ tersimpan; **P-6** unclassified tidak dipisah; **P-8** retur & reversal pasca-cutover/pra-cutover; invoice pra-cutover tetap berbentuk lama
    - **Validates: Requirements 7.1–7.6, 8.1–8.2, 11.1**
  - [ ] 6.6 **(Manual, staging)** Set cutover di staging, posting contoh, verifikasi rekap PPN dan neraca dengan akuntan; catat hasil
    - _Requirements: 7.5, 11.3_

- [ ] 7. Faktur Pajak
  - [ ] 7.1 `assignTaxInvoice`: sumber `tax_invoice_dpp_amount`/`tax_invoice_ppn_amount` dari komponen PPN bila ter-snapshot terklasifikasi, selain itu perilaku lama
    - _Requirements: 9.1–9.2_
  - [ ]* 7.2 Pastikan `TaxInvoiceAssignmentTest` tetap hijau dan tambah kasus campuran PPN + pajak lain
    - **Validates: Requirements 9.1–9.3**

- [ ] 8. Antarmuka dan terjemahan
  - [ ] 8.1 `Finances/Taxes/Form.jsx`: field `category`/`behavior`/`is_creditable`, peringatan `unclassified` terpakai, larangan withholding+PPN; tab **Versi Aturan** (daftar, versi baru, aktivasi); `.rtl.test.jsx`
    - _Requirements: 1.3, 10.1, 10.4_
  - [ ] 8.2 Panel **Rincian Pajak** di detail Sales/Purchase Invoice (snapshot atau rekonstruksi legacy); tautan versi di halaman jurnal; `.rtl.test.jsx`
    - _Requirements: 5.5–5.6, 10.2–10.3_
  - [ ] 8.3 Kunci terjemahan `lang/id` & `lang/en` (`LocaleKeysTest` hijau); izin dan menu
    - _Requirements: 10.4, 13.3_

- [ ] 9. **(GATED D-15)** Bagian B — konversi kolom hitung dokumen
  - [ ] 9.1 Selesaikan audit pemakai kolom (Task 1.2): daftar perubahan view/laporan/cetak
    - _Requirements: 12.6_
  - [ ] 9.2 Migration: tambah `*_v2`, salin, pra-pemeriksaan paritas, drop generated sesuai urutan dependensi, rename, buat ulang view; `down()` terdokumentasi; uji SQLite + MySQL staging; aktifkan `finance_tax_engine_calc_enabled`
    - _Requirements: 12.2, 12.5_
  - [ ] 9.3 Pindahkan perhitungan ke `TaxEngine` di `fillItemRelations`/`create`/`update` kedua service; withholding keluar dari total dokumen; rule posting memetakan ke `withholding_*`
    - _Requirements: 12.3–12.4_
  - [ ]* 9.4 Write tests Bagian B
    - Paritas pra/pasca konversi; faktor DPP non-11/12 diterima; withholding terpisah dari total; pembulatan `per_document` memakai peran `rounding`; dokumen order tidak berubah
    - **Validates: Requirements 12.2–12.7, 8.3**

- [ ] 10. Checkpoint akhir Fase 3
  - Jalankan `php artisan test --compact tests/Feature/Finances tests/Feature/TaxInvoiceAssignmentTest.php tests/Feature/PurchaseInvoiceMissingTaxItemTest.php tests/Feature/InvoiceDppMigrationTest.php tests/Unit`, serta test frontend yang disentuh
  - Setelah semua task selesai: `vendor/bin/pint --dirty --format agent`, `npm run lint`, `graphify update .`
  - Exit criteria: P-1…P-9 hijau; golden test lulus; PPN terpisah di staging sesuai verifikasi akuntan; penambahan versi tarif terbukti tanpa perubahan kode; keputusan D-12/D-15 terdokumentasi
  - Ensure all tests pass, ask the user if questions arise.

## Catatan

- Bagian A dapat berhenti di Task 8 dan sudah memberi nilai penuh pada GL; Bagian B dapat ditunda tanpa menghalangi Fase 4–6.
- Jika Task 1.3 menemukan perbedaan alur pajak Purchase Invoice (mis. off-PO) dibanding Sales Invoice, perbarui `design.md` dan minta konfirmasi sebelum Task 5.
- Peran pajak kustom (mis. PPh 23) dibuat sebagai kunci string di profil; jangan menambah nilai enum untuk setiap jenis pajak.
