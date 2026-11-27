# Implementation Plan: Finance P3 — Tax Engine

## Overview

Bagian A (Task 1–8) tidak mengubah angka di dokumen; Bagian B (Task 9) adalah konversi kolom yang **GATED D-15**. Urutan: audit data pajak (1), skema + model (2), backfill versi 1 (3), resolver + engine dengan test (4), snapshot di service dokumen (5), pemisahan baris pajak di rule posting + cutover (6), Faktur Pajak + UI (7–8), konversi kolom (9), checkpoint (10). Lint/Pint sekali di akhir.

**Prasyarat**: Fase 2 selesai untuk Sales Invoice dan Purchase Invoice (mode `on` stabil); D-12 (kebijakan posting pajak) disetujui pemilik produk 22 November 2026 sebagai usulan PRD (implementasi di Task 6); Q-P3-1…4 terjawab pemilik produk 27 November 2026 (Q-P3-2 sementara, dikonfirmasi akuntan; lihat decision log). Branch baru dari `origin/feat/finance-engine` terbaru (BR-6, PRD Bagian 10).

**Aturan eksekusi**:
- Task 9 **GATED**: D-15 disetujui 2026-11-15 (pemilik produk); tetap hanya dengan hasil audit pemakai kolom dan jendela pemeliharaan.
- Jangan mengubah `taxes.rate` data lama; perubahan tarif = versi baru.
- Jangan menebak klasifikasi pajak (`unclassified` sampai akuntan menetapkan).
- Spec `dpp-discount-and-tax-compliance`: beri catatan "Requirement 4 disupersede oleh finance-p3-tax-engine" hanya setelah D-15 disetujui.
- Task bertanda `*` opsional; konfirmasi sebelum dilewati.

## Tasks

- [-] 1. Audit dan verifikasi asumsi (read-only; 1.2–1.4 selesai 2026-11-21, 1.1 tidak berlaku: produksi tanpa data pajak historis, Q-P3-1)
  - [ ] 1.1 (status: tidak berlaku, bukan selesai) **TIDAK BERLAKU (27 November 2026, Q-P3-1):** produksi tidak punya data pajak historis sama sekali, sehingga tidak ada dump untuk direkonsiliasi dan `finance:init-tax-rules` di produksi menghasilkan kosong. Tidak dicentang `[x]` karena memang tidak dikerjakan. Teks semula: Dump seluruh `taxes` (nama, rate) di staging/produksi dan jumlah pemakaian per pajak pada item invoice 12 bulan; tandai `rate` yang mencurigakan terhadap DPP 11/12; kirim ke pemilik produk/akuntan (Q-P3-1)
    - _Requirements: 6.3_
  - [x] 1.2 Audit pemakai kolom `dpp_amount`/`tax_amount`/`amount` item invoice: view (`report_sales_invoice_view`), laporan, `assignTaxInvoice`, cetak, frontend
    - _Requirements: 12.6_
  - [x] 1.3 Baca `PurchaseInvoiceService` untuk alur pajak (fillItemRelations, onApproved, retur, off-PO) dan `SalesInvoiceService` baris 60–200 dan 280–340; catat perbedaan dengan asumsi design
    - _Requirements: 5.2–5.3_
  - [x] 1.4 Audit COA: akun `account_type = tax` dan kebutuhan PPN Keluaran/Masukan/PPh (Q-P3-4); verifikasi status task 11 spec DPP (belum dikerjakan)
    - _Requirements: 1.5, 7.7_
  - [x] 1.5 Seed `PPN 12% (DPP Nilai Lain 11/12)` (`TaxSeeder`, dipanggil `DatabaseSeeder`): hanya bila belum ada pajak `ppn_standard` (termasuk terhapus lunak), idempoten, tidak menimpa; versi 1 berfaktor 11/12 lewat `TaxRuleVersionService::createInitialVersion()`; test `TaxSeederTest`
    - _Requirements: 1.4_

- [x] 2. Skema dan model (aditif)
  - [x] 2.1 Migration `add_classification_columns_to_taxes_table` (`category`, `behavior`, `jurisdiction_code`, `is_creditable`); model `Tax` (`$casts`, `$configColumns`)
    - _Requirements: 1.1–1.2_
  - [x] 2.2 Migration `create_tax_rule_versions_table` + model `TaxRuleVersion` (izin `manage_rule_versions`, `configColumns`, `translateKey`)
    - _Requirements: 2.1, 13.3_
  - [x] 2.3 Migration kolom snapshot: `tax_rule_version_id` pada `sales_invoice_items`, `purchase_invoice_items`, `general_ledgers`; `tax_breakdown` JSON pada `sales_invoices`, `purchase_invoices`
    - _Requirements: 5.1, 5.4_
  - [x] 2.4 Setting `finance_tax_split_from.*`, `finance_company_is_pkp`, `finance_tax_engine_calc_enabled`
    - _Requirements: 2.7, 7.5, 7.9_
  - [x] 2.5 Test `initPermissions()` pada `TaxRuleVersion` dan perubahan `Tax` (F-12)
    - _Requirements: 13.2_

- [x] 3. Backfill versi awal
  - [x] 3.1 `finance:init-tax-rules {--dry-run}`: versi 1 per pajak (`rate` dari `taxes.rate`, 11/12, `per_line`, `active`, `needs review`), idempoten, laporan rate mencurigakan
    - _Requirements: 6.1–6.3_
  - [x] 3.2 `finance:report-unclassified-taxes` (pajak `unclassified` + pemakaian)
    - _Requirements: 10.5_
  - [x]* 3.3 Write tests backfill dan laporan
    - **P-6** idempoten; tidak menimpa; laporan menandai rate mencurigakan
    - **Validates: Requirements 6.1–6.3**

- [x] 4. Resolver dan engine (TDD)
  - [x] 4.1 `TaxInput`, `TaxComponent`, `TaxResult` (serialisasi/`fromJson`), exception `NoEffectiveTaxRuleException`, `InvalidTaxRuleVersionException`
    - _Requirements: 3.2, 4.2, 4.6_
  - [x] 4.2 `TaxRuleVersionService` (tumpang-tindih, versi baru, aktivasi, **guard faktor 11/12** selama `finance_tax_engine_calc_enabled=false`)
    - _Requirements: 2.2–2.3, 2.7_
  - [x] 4.3 `TaxRuleResolver` (query efektif, cache per `(tax,date)`)
    - _Requirements: 3.1–3.4_
  - [x] 4.4 `TaxEngine` (`calculate`, `calculateDocument`, `verify`; aritmetika integer minor unit)
    - _Requirements: 4.1–4.6, 8.1_
  - [x]* 4.5 Write tests resolver dan engine
    - **P-3** batas tanggal; **P-4** versi baru lewat data; **P-5** verify versi 1 = kolom generated; **P-7** guard faktor; pembulatan per_line/per_document; minor unit 0
    - **Validates: Requirements 2.2–2.7, 3.1–3.4, 4.1–4.6**
  - [x] 4.6 Test arsitektur **P-9**: `Tax/**` tanpa `use` model Sales/Purchase/Inventory
    - _Requirements: 4.4_

- [x] 5. Snapshot di service dokumen
  - [x] 5.1 `SalesInvoiceService::fillItemRelations()` memakai resolver (tanggal dokumen) → isi `tax_rate` dan `tax_rule_version_id`
    - _Requirements: 5.2_
  - [x] 5.2 Padanan di `PurchaseInvoiceService` (termasuk jalur off-PO dan retur)
    - _Requirements: 5.2_
  - [x] 5.3 `onApproved()` kedua service menyimpan `tax_breakdown` (`TaxResult` dari nilai tersimpan + `warnings` bila beda dengan engine); immutable setelah approved
    - _Requirements: 5.3_
  - [x]* 5.4 Write tests snapshot
    - **P-2** angka dokumen tidak berubah (golden); invoice legacy tanpa snapshot tetap valid; versi tak ada → `NoEffectiveTaxRuleException`; `tax_breakdown` tak berubah setelah approved
    - **Validates: Requirements 5.1–5.6**

- [-] 6. Pemisahan baris pajak di jurnal (6.1-6.5 selesai 27 November 2026; 6.6 manual staging belum) (D-12 disetujui 22 November 2026; Q-P3-2…4 dijawab 27 November 2026: default PKP/kreditabel sementara, cutover awal periode fiskal terbuka berikutnya per jenis dokumen, peran Posting Profile tanpa menebak akun COA)
  - [x] 6.1 Perluas `PostingContext` dengan `taxComponents` (kompatibel mundur) dan `RoleLine` dengan `taxRuleVersionId`; teruskan ke `general_ledgers.tax_rule_version_id`
    - _Requirements: 5.4, 7.4_
  - [x] 6.2 Pabrik konteks invoice: kelompokkan komponen dari item tersimpan; hitung `classified`, `isCreditable`; set `flags['tax_split']` berdasarkan `finance_tax_split_from.*`
    - _Requirements: 7.1–7.3, 7.5, 7.9_
  - [x] 6.3 Rule Sales Invoice dan Purchase Invoice: baris pajak terpisah, baris pendapatan/beban sebagai sisa, retur menukar sisi; bentuk lama bila tidak ada komponen/pra-cutover; log `unsplit_tax`
    - _Requirements: 7.1–7.4, 7.6, 8.2_
  - [x] 6.4 Lengkapi `finance:init-posting-profile` melaporkan akun `tax` ambigu dan peran `tax_*` yang belum terpetakan (tanpa menebak)
    - _Requirements: 7.7–7.8_
  - [x]* 6.5 Write golden tests G1–G6 dan test properti
    - **P-1** seimbang & Σ pajak = Σ tersimpan; **P-6** unclassified tidak dipisah; **P-8** retur & reversal pasca-cutover/pra-cutover; invoice pra-cutover tetap berbentuk lama
    - **Validates: Requirements 7.1–7.6, 8.1–8.2, 11.1**
  - [ ] 6.6 **(Manual, staging)** Set cutover di staging, posting contoh, verifikasi rekap PPN dan neraca dengan akuntan; catat hasil
    - _Requirements: 7.5, 11.3_

- [x] 7. Faktur Pajak
  - [x] 7.1 `assignTaxInvoice`: sumber `tax_invoice_dpp_amount`/`tax_invoice_ppn_amount` dari komponen PPN bila ter-snapshot terklasifikasi, selain itu perilaku lama
    - _Requirements: 9.1–9.2_
    - Catatan implementasi: logika di `Tax/TaxInvoiceAmounts::fromBreakdown()`, dipakai `SalesInvoiceService::assignTaxInvoice` dan `PurchaseInvoiceService::recordTaxInvoice` (audit 1.2). "Terklasifikasi" diartikan: `tax_breakdown.components` tidak kosong dan TIDAK ada komponen berkategori `unclassified`; bila ya, hanya komponen `ppn_standard`/`ppn_luxury` dijumlahkan (dpp dan tax). Snapshot kosong/gagal (`snapshot_build_failed`), tanpa snapshot, atau ada komponen `unclassified` memakai perilaku lama. Terklasifikasi tanpa komponen PPN menghasilkan 0/0. Nomor seri tak disentuh.
    - Keputusan pemilik produk 27 November 2026 (Q-P3-9), sesuai perilaku di atas: (1) satu komponen `unclassified` membuat seluruh dokumen memakai penjumlahan item lama; (2) terklasifikasi tanpa komponen PPN menghasilkan 0/0; (3) komponen legacy berkategori terklasifikasi dianggap terklasifikasi. Cakupan `recordTaxInvoice` dimasukkan ke Requirement 9.1. Pertanyaan terbuka Task 7 ditutup; tidak ada perubahan kode.
  - [x]* 7.2 Pastikan `TaxInvoiceAssignmentTest` tetap hijau dan tambah kasus campuran PPN + pajak lain
    - **Validates: Requirements 9.1–9.3**

- [x] 8. Antarmuka dan terjemahan (selesai 27 November 2026)
  - [x] 8.1 `Finances/Taxes/Form.jsx`: field `category`/`behavior`/`is_creditable`, peringatan `unclassified` terpakai, larangan withholding+PPN; tab **Versi Aturan** (daftar, versi baru, aktivasi); `.rtl.test.jsx`
    - _Requirements: 1.3, 10.1, 10.4_
  - [x] 8.2 Panel **Rincian Pajak** di detail Sales/Purchase Invoice (snapshot atau rekonstruksi legacy); tautan versi di halaman jurnal; `.rtl.test.jsx`
    - _Requirements: 5.5–5.6, 10.2–10.3_
  - [x] 8.3 Kunci terjemahan `lang/id` & `lang/en` (`LocaleKeysTest` hijau); izin dan menu
    - _Requirements: 10.4, 13.3_

- [x] 9. **(D-15 disetujui 15 November 2026, dikonfirmasi 27 November 2026)** Bagian B — konversi kolom hitung dokumen (selesai di kode 27 November 2026, branch `feat/finance-p3-calc-conversion`; uji MySQL 8 menunggu koordinator)
  - [x] 9.1 Selesaikan audit pemakai kolom (Task 1.2): daftar perubahan view/laporan/cetak
    - _Requirements: 12.6_
    - Audit (27 November 2026). **Penulis** (semua dialihkan ke `InvoiceItemTaxCalculator`/`TaxEngine`): `SalesInvoiceService` dan `PurchaseInvoiceService` (`fillItemRelations`, `create`, `update`, `onApproved`), `DocumentDiscountCalculator` (reduksi diskon grand_total per baris, kini memakai faktor/behavior versi aturan), `InvoiceBilledValueResolver::netValues` (basis toleransi penagihan; konstanta `DPP_FACTOR` dihapus, memakai versi pada tanggal dokumen). **Pembaca nilai tersimpan** (tidak perlu diubah, kolom tetap bernama sama): `TaxInvoiceAmounts` dan `DocumentTaxSnapshot` (kini menambah `withholding_amount` ke pajak tersimpan), `TaxBreakdownPanel`, `InvoiceLineAttributesBuilder`, `InvoiceTaxComponentsBuilder`, `SalesInvoicePanelSource`/`PurchaseInvoicePanelSource`, kedua `PostingContextFactory`, template cetak (`database/seeders/PrintTemplates/**` membaca kolom tersimpan). **View**: `report_sales_invoices` dan `report_purchase_invoices` (migrasi `2026_10_15_100400`/`100500`) merujuk tabel item sehingga di-drop sebelum DDL dan dibuat ulang dengan menjalankan `up()` migrasi aslinya; definisinya tidak berubah (hanya membaca kolom). **Laporan** (`Report/*InvoiceReport`) membaca view. **Frontend**: `SalesInvoice/Form.jsx`, `PurchaseInvoice/Form.jsx`, `lib/discountAllocation.js` (konstanta `DPP_FACTOR` dihapus; faktor/tarif dari prop `taxRuleVersions`, Requirement 12.8). **Tidak berubah (di luar lingkup, Requirement 12.7)**: `SalesOrder*`/`PurchaseOrder*`/`Quotation*` (kolom sudah biasa) dan `ExampleDataSeeder` (tetap mengisi 11/12 legacy lewat jaring pengaman model).
  - [x] 9.2 Migration: tambah `*_v2`, salin, pra-pemeriksaan paritas, drop generated sesuai urutan dependensi, rename, buat ulang view; `down()` terdokumentasi; uji SQLite + MySQL staging; aktifkan `finance_tax_engine_calc_enabled`
    - _Requirements: 12.2, 12.5_
    - Catatan implementasi: `database/migrations/2026_11_27_100001_convert_invoice_item_calculated_columns_to_stored_values.php`. Urutan: tambah `dpp_amount_v2`/`tax_amount_v2`(/`amount_v2`) default 0 dan `withholding_amount` default 0 (guard `hasColumn`, aman diulang) → salin → pra-pemeriksaan paritas (selisih > 1 minor unit = 0,01 menghentikan migrasi sebelum perubahan skema; NULL dihitung) → drop view → drop kolom generated berurutan `amount` → `tax_amount` → `dpp_amount` (`tax_amount` membaca `dpp_amount`, `amount` membaca `tax_amount`) → rename `_v2` → buat ulang view → set setting `tax_engine_calc_enabled` true (default `FinanceSetting` juga true). `basic_amount` tetap generated. Dokumen order tidak disentuh. `down()` memulihkan kolom generated hanya bila tidak ada `withholding_amount` > 0 dan semua angka tersimpan masih sama (±0,01) dengan formula 11/12 lama; selain itu menolak dengan pesan, karena memulihkan akan mengubah angka dokumen. Jendela pemeliharaan dan pembersihan manual terdokumentasi di docblok migrasi. Terbukti di SQLite (`InvoiceDppMigrationTest`: round-trip down→up, penolakan down, view dibuat ulang). **Belum diuji di MySQL 8** (DDL non-transaksional, rebuild tabel besar saat drop generated; lihat Pertanyaan terbuka Task 9).
  - [x] 9.3 Pindahkan perhitungan ke `TaxEngine` di `fillItemRelations`/`create`/`update` kedua service; withholding keluar dari total dokumen; rule posting memetakan ke `withholding_*`
    - _Requirements: 12.3–12.4_
    - Catatan implementasi: `Tax/InvoiceItemTaxCalculator::apply()` memanggil `TaxEngine::calculateDocument` (faktor DPP, tarif, behavior, pembulatan `per_line`/`per_document` dari versi aturan pada tanggal dokumen) lalu mengisi `discount_amount`, `dpp_amount`, `tax_amount`, `withholding_amount` (dan `amount` pada Purchase Invoice item). Nilai dari request diabaikan (anti pemalsuan). Pajak tanpa versi berlaku tetap gagal tertutup (Q-P3-5, tidak diubah). Withholding disimpan di kolom baru `withholding_amount` per item (default 0), `tax_amount` hanya pajak penambah; header `amount` = Σ bersih + Σ penambah − Σ withholding; ke posting diteruskan total bruto + `amounts['withholding']`. Rule `SalesInvoiceRule`: piutang = total − W, debit `withholding_receivable`; `PurchaseInvoiceRule`: utang = total − W, kredit `withholding_payable`; berlaku walau cutover `tax_split` belum aktif (Requirement 7.3 hanya untuk pajak penambah); retur menukar sisi. `TaxSplitResolver::isActiveForDocument` mengabaikan baris withholding agar bentuk retur tetap mengikuti dokumen asal. Jaring pengaman: trait `ComputesLegacyInvoiceItemAmounts` pada kedua model item mengisi dpp/tax/amount dengan formula 11/12 lama hanya bila penulis lain (seeder, fixture tes) tidak mengisinya; service menandai nilai sudah dihitung engine. UI (Requirement 12.8): kolom DPP (kolom baris dan ringkasan) hanya tampil bila faktor versi pajak baris selain 1/1; faktor/tarif dari prop server `taxRuleVersions` (`DocumentTaxRules::versionsForClient()`, dikirim `create` dan `show` kedua controller); baris ringkasan "Pajak Dipotong" dan total dikurangi withholding.
  - [x]* 9.4 Write tests Bagian B
    - Paritas pra/pasca konversi; faktor DPP non-11/12 diterima; withholding terpisah dari total; pembulatan `per_document` memakai peran `rounding`; dokumen order tidak berubah
    - **Validates: Requirements 12.2–12.7, 8.3**
    - Catatan implementasi: `tests/Feature/Finances/Tax/InvoiceCalcConversionTest.php` (faktor 1/1 dan 3/4, versi tarif/faktor baru tanpa ubah kode, paritas 11/12 ±0,01, anti pemalsuan, withholding SI/PI terpisah dari total, jurnal withholding seimbang dan retur, snapshot tanpa peringatan, `per_document` dengan sisa pada baris terbesar dan jurnal seimbang, tabel order tidak berubah, prop `taxRuleVersions`); `InvoiceDppMigrationTest` ditulis ulang (kolom biasa, round-trip migrasi, `down()` menolak); `TaxSchemaTest` (default true), `TaxRuleVersionServiceTest` (guard hanya bila setting dimatikan); frontend `taxRules.test.js` dan kedua `Form.rtl.test.jsx`. Tes `peran rounding` tidak dapat ditulis sesuai bunyi spek: lihat Pertanyaan terbuka Task 9 nomor 4.

**Pertanyaan terbuka Task 9 (belum diputuskan pemilik produk; keputusan sementara di kode)**
1. Penyimpanan withholding per item: kolom baru `withholding_amount` (tidak disebut spek; preseden spek DPP 11.5). Alternatif: tabel terpisah atau hanya di `tax_breakdown`.
2. Header `amount` (dan outstanding/jadwal bayar) NET dari withholding (agar GL = subledger) dipilih; alternatif: bruto dan potongan dicatat sebagai pembayaran terpisah.
3. Peran withholding tetap `withholding_receivable`/`withholding_payable`; peran kustom pada versi aturan diabaikan.
4. Requirement 8.3 (pembulatan `per_document` memakai peran `rounding`): engine membebankan sisa pada baris terbesar sehingga Σ item = total dokumen dan jurnal seimbang tanpa baris `rounding`; peran `rounding` tidak diperlukan pada jalur ini. Butuh keputusan apakah spek 8.3 direvisi.
5. Data "tanpa pajak" hasil backfill 11/12 tetap menampilkan kolom DPP sampai ada versi berfaktor 1/1.
6. Baris tanpa pajak kini menyimpan `dpp_amount` 0 (kolom generated lama menghasilkan basis × 11/12).
7. Jaring pengaman legacy di model item (hook `saving`) vs "kolom biasa" murni; `ExampleDataSeeder` tetap legacy 11/12.
8. Rumus reduksi diskon grand_total tidak eksak untuk faktor ≠ 1 (sudah demikian sebelumnya; tidak diubah).
9. Dokumen Bagian A berversi `per_document` dapat memunculkan peringatan mismatch snapshot saat dijelaskan ulang.
10. Baris withholding tetap membawa `tax_rule_version_id`; retur dibedakan lewat filter behavior penambah.
11. Peran `withholding_*` belum masuk `PostingRoleRequirements` (hanya dilaporkan `finance:init-posting-profile`).
12. Risiko migrasi MySQL (DDL non-transaksional, rebuild tabel besar, `renameColumn`, `require` ulang migrasi view) belum diuji di MySQL 8; uji staging wajib sebelum produksi.

- [ ] 10. Checkpoint akhir Fase 3
  - Jalankan `php artisan test --compact tests/Feature/Finances tests/Feature/TaxInvoiceAssignmentTest.php tests/Feature/PurchaseInvoiceMissingTaxItemTest.php tests/Feature/InvoiceDppMigrationTest.php tests/Unit`, serta test frontend yang disentuh
  - Setelah semua task selesai: `vendor/bin/pint --dirty --format agent`, `npm run lint`, `graphify update .`
  - Exit criteria: P-1…P-9 hijau; golden test lulus; PPN terpisah di staging sesuai verifikasi akuntan; penambahan versi tarif terbukti tanpa perubahan kode; keputusan D-12/D-15 terdokumentasi
  - Ensure all tests pass, ask the user if questions arise.

## Catatan

- Bagian A dapat berhenti di Task 8 dan sudah memberi nilai penuh pada GL; Bagian B dapat ditunda tanpa menghalangi Fase 4–6.
- Jika Task 1.3 menemukan perbedaan alur pajak Purchase Invoice (mis. off-PO) dibanding Sales Invoice, perbarui `design.md` dan minta konfirmasi sebelum Task 5.
- Peran pajak kustom (mis. PPh 23) dibuat sebagai kunci string di profil; jangan menambah nilai enum untuk setiap jenis pajak.

## Catatan penggabungan dengan Fase 2 (27 November 2026)

Bagian A (Task 1.2-1.4, 2-5) digabung dengan `origin/feat/finance-engine` (Fase 2 sudah ter-merge). Konflik di `FinanceSetting`, `AppServiceProvider`, `SalesInvoiceService`, `PurchaseInvoiceService` diselesaikan dengan mempertahankan kedua sisi: setting `posting_executions` dan kolom diskon Fase 2 beserta setting pajak Fase 3 (`tax_split_from`, `company_is_pkp`, `tax_engine_calc_enabled`; `posting_modes` sudah dihapus Fase 2); registrasi `PostingService`/`PanelSourceRegistry` beserta `TaxRuleResolver` scoped; di service invoice, akun dokumen tetap dikosongkan (Q-P2-23) dan `posted_account_id = null` (Q-P2-24), sementara `tax_rate` dan `tax_rule_version_id` berasal dari versi aturan pajak pada tanggal dokumen. `InvoiceTaxSnapshotTest` disesuaikan: `onApproved()` kini memicu engine posting, sehingga tes membuat Posting Profile aktif. Task 1.1 tetap `[ ]` (menunggu data staging).

**Prasyarat deploy Task 5**: jalankan `php artisan finance:init-tax-rules` (boleh `--dry-run` dahulu) SEBELUM kode Task 5 dideploy; tanpa versi aturan berlaku, service invoice gagal tertutup (422 pada `items.{i}.tax`) sesuai Q-P3-5 (21 November 2026).

**Pertanyaan terbuka (belum diputuskan, menunggu pemilik produk)**
- Konflik design.md vs Requirement 4.1 (lihat diskusi desain; perlu diputuskan mana yang berlaku).
- Retur: memakai versi aturan pada tanggal retur, atau mewarisi versi item dokumen asal.
- ~~`TaxesController::store` membuat pajak tanpa versi aturan~~ (ditutup 27 November 2026, Q-P3-11: disengaja; versi dibuat manual di tab Versi Aturan).
- `InvoiceBilledValueResolver` masih membaca `taxes.rate`, bukan versi aturan.

**Tindak lanjut review PR #330 (27 November 2026)**
- I-1 diperbaiki: `Submitable::amend()` kini mengecualikan kolom lewat `amendExcludedColumns()`; `SalesInvoice` dan `PurchaseInvoice` mengecualikan `tax_breakdown`, sehingga revisi hasil amend dihitung ulang saat approve (Requirement 5.3). M-1 (`activate()` mengunci baris pajak), M-2 (pemeriksaan "sudah punya versi" di dalam kunci baris pajak pada `createInitialVersion()`, hasil `null` bila sudah ada) dan M-4 (`ExampleDataSeeder` membuat versi awal pajak contoh) diperbaiki.
- **Catatan untuk Task 6 (M-5)**: `finance_tax_split_from.{type}` bernilai NULL berarti pemisahan baris pajak TIDAK aktif; rule posting harus memperlakukan NULL sebagai tidak aktif, bukan sebagai tanggal paling awal.
- Pertanyaan terbuka tambahan (V-1): tanggal dokumen untuk memilih versi aturan pajak diturunkan dengan `CarbonImmutable::parse($data['date'])->toDateString()` (zona UTC, `app.timezone`), sedangkan frontend mengirim datetime ISO UTC dan posting/guard periode fiskal memakai hari bisnis zona perusahaan (`FiscalPeriodService::businessDay()`, Asia/Jakarta). Dokumen antara 00.00-07.00 WIB bisa memakai versi aturan hari sebelumnya, sehingga berbeda dari tanggal jurnalnya pada hari pergantian tarif. Belum diubah karena menyangkut definisi "tanggal berlaku" pajak; perlu keputusan pemilik produk.
- M-3 diputuskan pemilik produk 27 November 2026 (Q-P3-6): kegagalan snapshot `tax_breakdown` tidak memblokir approve; `DocumentTaxSnapshot::buildOrDescribeFailure()` menyimpan `warnings` `snapshot_build_failed` dan mencatat log (Task 5.3).
- Requirement 1.4 (seed PPN 12%) kini dipetakan ke Task 1.5 dan selesai 27 November 2026; gap sebelumnya tertutup.
- Mata uang `tax_breakdown` diputuskan pemilik produk 27 November 2026 (Q-P3-7): mata uang dokumen; pertanyaan terbuka terkait ditutup.

**Catatan implementasi Task 6 (27 November 2026, branch `feat/finance-p3-tax-journal-split`)**
- `TaxComponentLine` (Posting/Contexts), `PostingContext::$taxComponents`, `RoleLine`/`JournalLineDraft::$taxRuleVersionId` (diteruskan ke `general_ledgers.tax_rule_version_id`, juga disalin pembalik jurnal). Baris pajak dengan versi berbeda tidak digabung walau akunnya sama, dan tidak menyerap sisa pembulatan selama ada baris `revenue`/`expense` (Requirement 7.4, 8.2).
- `InvoiceTaxComponentsBuilder` dan `TaxSplitResolver` (domain Finances/Accounting, bukan Posting; P-8) dipakai `SalesInvoicePostingContextFactory` dan `PurchaseInvoicePostingContextFactory`. Cutover memakai tanggal JURNAL (selaras `DiscountSplitResolver`); `finance_tax_split_from.{type}` NULL = tidak aktif dan tidak menuntut peran pajak.
- Komponen tidak dipisah (tertanam, log `posting.unsplit_tax` dengan `reason`): `unclassified_or_withholding`, `no_rule_version` (item legacy tanpa `tax_rule_version_id`), `not_creditable` (pembelian: `taxes.is_creditable` false atau `finance_company_is_pkp` false).
- `finance:init-posting-profile` melaporkan seluruh akun bertipe `tax` (ambigu bila lebih dari satu) dan peran `tax_output`, `tax_input`, `withholding_*` yang belum dipetakan; tidak pernah memetakannya.
- Tindak lanjut review PR #331 (27 November 2026): `forPosting(..., preview: true)` (panel akun draft) tidak mencatat `posting.unsplit_tax`, hanya posting nyata; laporan peran pajak `finance:init-posting-profile` membaca profil `active` yang berlaku hari ini (sama dengan `AccountRoleResolver::profileFor`, draft tidak dihitung) dan peran `tax_*`/`withholding_*` tidak diulang di bagian "tanpa padanan legacy".
- Tidak dikerjakan/ditunda: G6 minor unit 0 sebagai tes DB (mata uang dasar tes bukan minor unit 0; dicakup tes properti tingkat rule dan G6 pecahan); Task 6.6 (manual, staging).

**Catatan implementasi Task 8 (27 November 2026, branch `feat/finance-p3-tax-ui`)**
- 8.1: `TaxRequest` menerima `category`/`behavior`/`is_creditable` (opsional; bila tidak dikirim nilai tersimpan tak berubah) dan menolak `withholding` + kategori PPN terhadap gabungan input dan nilai tersimpan. `TaxRuleVersionController` (`save`, `updateDraft`, `discard`, `activate`, `retire` di `taxes/{tax}/ruleVersions`) memakai `TaxRuleVersionService`; SEMUA aksi tulis mensyaratkan izin `manage_rule_versions` (izin `write` model ini tidak memberi akses ke aksi apa pun), versi harus milik pajak pada URL (404 bila tidak), dan galat domain menjadi galat validasi pada kunci `version`. `TaxesController::show` memuat `ruleVersions` hanya bila pembaca punya izin `read` pada `TaxRuleVersion` (tanpa izin itu halaman Pajak tetap terbuka dan tab disembunyikan) serta `unclassifiedUsage` (jumlah invoice penjualan/pembelian 12 bulan terakhir yang memakai pajak `unclassified`, per tanggal invoice).
- Validasi `category` (disetujui pemilik produk 27 November 2026): `TaxRequest` memakai `Rule::in(Tax::CATEGORIES)` sehingga kategori di luar daftar (termasuk beda huruf besar/kecil) ditolak pada store dan update (galat validasi `category`; aplikasi merespons galat validasi Inertia dengan redirect + error session, bukan status 422 mentah); alasan: kategori tak dikenal akan diperlakukan diam-diam sebagai non-PPN oleh Task 7 (PR #332). Tes: `TaxClassificationHttpTest::test_category_outside_the_list_is_rejected_on_store_and_update`.
- Pajak baru dari UI TIDAK diberi versi awal otomatis (Requirement tidak menyebutnya): versi dibuat dan diaktifkan lewat tab Versi Aturan setelah pajak tersimpan; tab memperingatkan bila belum ada versi aktif (Q-P3-5 tetap fail-closed).
- 8.2: `TaxBreakdownPanel` (deferred prop `taxBreakdown` lewat `DataTable::showDetail`, hanya model yang mengembalikan `hasTaxBreakdownPanel() = true`: Sales/Purchase Invoice). Membaca `tax_breakdown` apa adanya (tanpa hitung ulang; peringatan tingkat dokumen `snapshot_build_failed` dibaca dari JSON mentah); invoice approved tanpa snapshot = `legacy` (dijelaskan dari nilai item tersimpan lewat `DocumentTaxSnapshot`, komponen tanpa versi berlabel legacy); invoice belum approved = `pending`; versi yang hilang = "versi tidak tersedia" (Requirement 5.6). Tautan versi memerlukan izin `read` pada Pajak dan `TaxRuleVersion`. Halaman jurnal: baris pajak menampilkan tautan versi (relasi `GeneralLedger::taxRuleVersion()`), mengikuti izin yang sama.
- 8.3: kunci terjemahan `finances/taxRuleVersion` (messages/tab), `finances/taxes` (errors/form), `finances/taxBreakdown` (baru), `finances/journal`, dan label izin `manage_rule_versions` di `user/role.php` (id dan en). Tidak ada entri menu baru: versi aturan hanyalah tab di halaman Pajak (menu `Taxes` sudah ada).
- Tidak dikerjakan: layar "Pajak tak terklasifikasi" (Requirement 10.5 bagian tampilan; perintah artisan sudah ada dan bagian tampilan tidak dipetakan ke Task 8) dan tampilan riwayat audit per versi (perubahan versi tercatat lewat `AuditableModelSaved`; daftar versi sendiri memuat seluruh status).

**Pertanyaan terbuka Task 8 (belum diputuskan pemilik produk)**
- ~~Izin `write` pada `TaxRuleVersion`~~ **DITUTUP 27 November 2026 (Q-P3-9, pemilik produk):** semua aksi tulis tetap hanya `manage_rule_versions` (Requirement 2.5 diubah); `write` tidak dipakai aksi apa pun.
- ~~Peringatan "unclassified terpakai"~~ **DITUTUP 27 November 2026 (Q-P3-10, pemilik produk):** hanya invoice penjualan/pembelian AKTIF (draf dan dibatalkan diabaikan), global tanpa scope cabang, menurut tanggal invoice dengan hari batas ikut terhitung (Requirement 1.3 diubah). Banner agregat di daftar Pajak tidak dikerjakan.
- Tindak lanjut review PR #333: state panel dibedakan dari status approval dokumen (draf/menunggu persetujuan/ditolak = `pending`; sisanya tanpa snapshot = `legacy`), bukan `submitted_at`; versi yang tidak ditemukan pada jalur pending/legacy tampil "versi tidak tersedia" memakai `tax_rule_version_id` asli item (Requirement 5.6). `TaxRuleResolver::findVersion()`/`findTax()` sudah ber-cache per id selama satu request, jadi tidak ada perubahan.
- ~~`TaxesController::store` membuat pajak tanpa versi aturan~~ **DITUTUP 27 November 2026 (Q-P3-11, pemilik produk):** pajak baru dari UI TIDAK diberi versi awal otomatis; versi dibuat manual di tab Versi Aturan (fail-closed Q-P3-5). Tidak ada perubahan kode.
- Tautan versi aturan membuka halaman Pajak (belum memilih tab Versi Aturan otomatis); tidak ada halaman/route detail versi tersendiri.

**Pertanyaan terbuka Task 6 (belum diputuskan pemilik produk)**
- ~~Cutover untuk RETUR~~ **DITUTUP 27 November 2026 (Q-P3-8, pemilik produk):** retur mengikuti bentuk jurnal invoice ASAL (`TaxSplitResolver::isActiveForDocument()`), selaras Q-P2-25; alasan: saldo `tax_output`/`tax_input` tidak boleh debit tanpa kredit asal. Requirement 7.5-7.6 diubah.
- Invoice lama tanpa `tax_rule_version_id` yang baru diposting setelah cutover (mis. retry): kini tertanam dan dicatat `no_rule_version`. Alternatif: memakai peran default `tax_output`/`tax_input`.
- Nilai komponen pajak memakai ruang nilai yang sama dengan `total` jurnal (mata uang dokumen, belum dikonversi kurs; FX di Fase 4). Dokumen valuta asing mengikuti perilaku total saat ini.
- Pajak `withholding` (PPh) tetap tertanam sebelum Bagian B (Requirement 7.3); peran `withholding_*` baru dilaporkan, belum dipakai.
- ~~Peran `tax_*` dalam `PostingRoleRequirements`~~ **DITUTUP 27 November 2026 (Q-P3-8, pemilik produk): YA**, peran `tax_output`/`tax_input` diperingatkan setelah `finance_tax_split_from.{type}` terisi (`PostingRoleRequirements::taxSplitRolesFor()`; tidak dituntut sebelumnya). Peran `withholding_*` tetap hanya dilaporkan `finance:init-posting-profile`.
- Baru (terbuka, tidak diubah): bila `InvoiceLineAttributesBuilder` mengembalikan daftar kosong (jumlah baris tak konsisten dengan `total`), posting diskon dimatikan dan dicatat, tetapi pemisahan pajak tetap berjalan (rule memakai satu baris `total - Σ pajak`, tetap seimbang karena pajak dari nilai tersimpan). Req 7 tidak mengaitkan pemisahan pajak dengan konsistensi baris; apakah pajak ikut dimatikan (dicatat `unsplit_tax`, alasan baris tak konsisten) perlu diputuskan pemilik produk.
