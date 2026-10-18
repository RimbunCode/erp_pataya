# Implementation Plan: Finance P0 — Foundation Audit

## Overview

Fase ini read-only: tidak ada migration dan tidak ada perubahan pada listener/service existing. Urutan: kerangka dan auditor (dengan test per anomali), snapshot saldo, helper fixture, characterization test per titik posting, known-issue test, lalu dokumen laporan dan decision log. Lint/Pint dijalankan setelah semua task selesai (aturan project).

**Prasyarat**: branch ini terbaru dari remote (aturan git worktree project). Baca `docs/prd/finance-engine-prd.md` (terutama Lampiran A dan B) sebelum mulai.

**Catatan eksekusi**: Task 6.5 bersifat manual (butuh akses staging/produksi). Task 7 membutuhkan input pemilik produk; jangan memutuskan D-1/D-11 sendiri (D-4 sudah diputuskan: satu perusahaan).

## Tasks

- [ ] 1. Kerangka kode audit
  - [ ] 1.1 Buat `app/Services/Finances/Audit/AuditReport.php` (DTO: `toArray()`, `toJson()`)
    - _Requirements: 1.3, 1.4_
  - [ ] 1.2 Buat `app/Console/Commands/Finances/AuditGeneralLedgerCommand.php` dengan signature `finance:audit-gl {--limit=20} {--json=} {--connection=}`; pastikan auto-discovery menemukan subfolder `Finances/`
    - _Requirements: 1.1, 1.4, 8.1, 8.2_

- [ ] 2. Auditor integritas dan referensi
  - [ ] 2.1 Buat `IntegrityChecks` (tak seimbang, nol/negatif, soft-deleted, akun hilang/terhapus, duplikasi) dengan agregasi database
    - _Requirements: 1.2.1–1.2.4, 1.2.7, 1.5_
  - [ ] 2.2 Buat `ReferenceChecks` (referenceable hilang; soft-delete diharapkan vs anomali; dokumen `canceled` dengan GL aktif)
    - _Requirements: 1.2.3, 1.2.5, 1.2.6_
  - [ ] 2.3 Buat `DocumentCoverageMatrix` (9 jenis dokumen; tracked vs tidak; `posting_not_posted`)
    - _Requirements: 2.1–2.4_
  - [ ] 2.4 Buat `GeneralLedgerAuditor::run()` yang merakit ketiganya + total ringkasan
    - _Requirements: 1.3, 1.6_
  - [ ]* 2.5 Write property/feature tests auditor
    - Satu test per kategori anomali (suntik satu anomali → hitung tepat 1); test data sehat → semua kategori 0 (P-4); test tabel kosong (1.6); test determinisme (P-2)
    - **Validates: Requirements 1.2, 1.3, 1.6**

- [ ] 3. Baseline saldo
  - [ ] 3.1 Verifikasi nilai `accounts.balance_type` dan konvensi tanda `balance_amount` (baca `AccountSeeder`, `StockEntryService` ~555–640, data staging) lalu kunci rumus `net`/`difference`; hapus `[TODO]` di design.md
    - _Requirements: 3.2, 3.5_
  - [ ] 3.2 Buat `BalanceSnapshotService` + `app/Console/Commands/Finances/SnapshotBalancesCommand.php` (`finance:snapshot-balances`), CSV streaming, `LEFT JOIN` agar akun tanpa transaksi ikut
    - _Requirements: 3.1, 3.3, 3.4_
  - [ ]* 3.3 Write tests snapshot: header CSV, jumlah baris = jumlah akun, akun tanpa transaksi bernilai nol, `balance_type` null → `note`
    - **Validates: Requirements 3.1–3.5**

- [ ] 4. Checkpoint - Auditor dan snapshot
  - Jalankan test berkas Task 2.5 dan 3.3; pastikan P-1 (read-only: jumlah baris semua tabel tak berubah) lulus
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Helper fixture dan characterization test
  - [ ] 5.1 Buat `tests/Support/BuildsFinanceFixtures.php` (user, branch, akun standar, setting, `initPermissions()` model terkait, `is_example` seperti pola `GeneralLedgerControllerTest`; `queue.default=sync`)
    - _Requirements: 4.4, 4.5_
  - [ ] 5.2 Characterization: Sales Invoice (normal + retur)
    - _Requirements: 4.1–4.3_
  - [ ] 5.3 Characterization: Purchase Invoice (cabang stok/SRNB + expense/credit; normal + retur)
    - _Requirements: 4.1–4.3_
  - [ ] 5.4 Characterization: Purchase Receipt (normal + retur) dan Delivery Note (normal + retur; jalur rental bila terjangkau)
    - _Requirements: 4.1–4.3_
  - [ ] 5.5 Characterization: Payment Entry (satu pembayaran penuh) dan Stock Entry (`item_receipt` + jenis lain yang memposting GL)
    - _Requirements: 4.1–4.2_
  - [ ] 5.6 Characterization: Asset — depresiasi, scrap, value adjustment, disposal gain/loss (perluas test `PostAssetDepreciationCommandTest`/`PurchaseInvoiceServiceFixedAssetDispatchTest` yang ada alih-alih menduplikasi bila sudah mencakup)
    - _Requirements: 4.1–4.2_

- [ ] 6. Known-issue test dan audit data nyata
  - [ ] 6.1 Known-issue F-10: dua pembayaran parsial berurutan; catat jumlah yang diposting GL ke-2
    - _Requirements: 5.1, 5.5_
  - [ ] 6.2 Known-issue F-11 (FX): pembayaran mata uang asing dengan `exchange_rate` ≠ 1
    - _Requirements: 5.2, 5.5_
  - [ ] 6.3 Known-issue F-04: cancel Sales Invoice, Payment Entry, dan Stock Entry; catat bahwa GL/SLE di-soft-delete (hook `Submitable`) dan apakah `accounts.balance_amount` ikut disesuaikan
    - _Requirements: 5.3, 5.5_
  - [ ] 6.3b Known-issue F-16: dispatch event posting (listener queued ditahan), batalkan dokumen, lalu jalankan listener; catat apakah GL aktif tercipta untuk dokumen `canceled`
    - _Requirements: 5.4, 5.5_
  - [ ] 6.4 Perbarui status temuan di PRD (terkonfirmasi / tidak terkonfirmasi) sesuai hasil 6.1–6.3b
    - _Requirements: 5.6_
  - [ ] 6.5 **(Manual)** Jalankan `finance:audit-gl --json` dan `finance:snapshot-balances` di staging (dan produksi bila disetujui, Q1); simpan keluaran di `storage/app/finance-audit/`
    - _Requirements: 1.4, 3.1, 7.1_

- [ ] 7. Audit skema dan dokumen keputusan
  - [ ] 7.1 Dokumentasikan kolom yang ditambah `initPermissions()` per jenis model dan skema aktual `accounts`/`general_ledgers` di staging (bandingkan dengan migration)
    - _Requirements: 6.1–6.4_
  - [ ] 7.2 Tulis `docs/prd/finance-audit-report.md` (ringkasan audit, hasil known-issue, estimasi beban backfill)
    - _Requirements: 7.1, 7.3, 7.4_
  - [ ] 7.3 Tulis `docs/prd/finance-decision-log.md` (D-1, D-4, D-11, D-12, Q1–Q7) dan **minta konfirmasi pemilik produk**
    - _Requirements: 7.2, 7.5_

- [ ] 8. Checkpoint akhir Fase 0
  - Jalankan seluruh test yang disentuh (`php artisan test --compact tests/Feature/Finances`), lalu `vendor/bin/pint --dirty --format agent` dan `npm run lint` bila ada perubahan JS (tidak diharapkan)
  - Exit criteria: laporan audit & decision log disetujui; Q1 terjawab (D-4 sudah diputuskan); temuan F-04/F-10/F-11 berstatus terkonfirmasi/tidak
  - Ensure all tests pass, ask the user if questions arise.

## Catatan

- Tasks bertanda `*` bersifat opsional untuk MVP spec ini tetapi sangat disarankan karena auditor dipakai sebagai alat verifikasi Fase 1–2; **konfirmasi cakupan dengan pemilik produk sebelum dilewati**.
- Jangan memperbaiki bug yang ditemukan di fase ini (Requirement 5.7); catat dan ajukan keputusan.
