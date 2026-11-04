# Implementation Plan: Finance P0 — Foundation Audit

## Overview

Fase ini read-only: tidak ada migration dan tidak ada perubahan pada listener/service existing. Urutan: kerangka dan auditor (dengan test per anomali), snapshot saldo, helper fixture, characterization test per titik posting, known-issue test, lalu dokumen laporan dan decision log. Lint/Pint dijalankan setelah semua task selesai (aturan project).

**Prasyarat**: Branch baru dari `origin/feat/finance-engine` terbaru (BR-6, PRD Bagian 10). Baca `docs/prd/finance-engine-prd.md` (terutama Lampiran A dan B) sebelum mulai.

**Catatan eksekusi**: Task 6.5 bersifat manual (butuh akses staging/produksi). Task 7 membutuhkan input pemilik produk; jangan memutuskan D-1/D-11 sendiri (D-4 sudah diputuskan: satu perusahaan).

## Tasks

- [x] 1. Kerangka kode audit
  - [x] 1.1 Buat `app/Services/Finances/Audit/AuditReport.php` (DTO: `toArray()`, `toJson()`)
    - _Requirements: 1.3, 1.4_
  - [x] 1.2 Buat `app/Console/Commands/Finances/AuditGeneralLedgerCommand.php` dengan signature `finance:audit-gl {--limit=20} {--json=} {--connection=}`; pastikan auto-discovery menemukan subfolder `Finances/`
    - _Requirements: 1.1, 1.4, 8.1, 8.2_

- [x] 2. Auditor integritas dan referensi
  - [x] 2.1 Buat `IntegrityChecks` (tak seimbang, nol/negatif, soft-deleted, akun hilang/terhapus, duplikasi) dengan agregasi database
    - _Requirements: 1.2.1–1.2.4, 1.2.7, 1.5_
  - [x] 2.2 Buat `ReferenceChecks` (referenceable hilang; soft-delete diharapkan vs anomali; dokumen `canceled` dengan GL aktif)
    - _Requirements: 1.2.3, 1.2.5, 1.2.6_
  - [x] 2.3 Buat `DocumentCoverageMatrix` (9 jenis dokumen; tracked vs tidak; `posting_not_posted`)
    - _Requirements: 2.1–2.4_
    - Temuan 2026-11-03 (N-9): kolom `approved` tidak bermakna pada data nyata; lihat DV-D. Checkbox tidak diubah.
  - [x] 2.4 Buat `GeneralLedgerAuditor::run()` yang merakit ketiganya + total ringkasan
    - _Requirements: 1.3, 1.6_
  - [x]* 2.5 Write property/feature tests auditor
    - Satu test per kategori anomali (suntik satu anomali → hitung tepat 1); test data sehat → semua kategori 0 (P-4); test tabel kosong (1.6); test determinisme (P-2)
    - **Validates: Requirements 1.2, 1.3, 1.6**
    - Temuan 2026-11-03 (N-9): fixture test menyetel status `approved` secara manual, sehingga test lulus meski matriks tidak bermakna pada data nyata; lihat DV-D. Checkbox tidak diubah.
  - [x] 2.6 Perbaiki subjek `approved`/`posting_*` di `DocumentCoverageMatrix` menjadi dokumen pasca-`onApproved` (DV-D opsi a, 2026-11-03) + test
    - Selesai 2026-11-04: daftar status pasca-`onApproved` per jenis (`design.md`, "Definisi `approved` pada matriks"); guard `LogicException` untuk daftar kosong; `posting_missing` kolom informasi (DV-E). `tests/Feature/Finances/Audit` 33 lulus.
    - _Requirements: 2.2_

- [x] 3. Baseline saldo
  - [x] 3.1 Verifikasi nilai `accounts.balance_type` dan konvensi tanda `balance_amount` (baca `AccountSeeder`, `StockEntryService` ~555–640, data staging) lalu kunci rumus `net`/`difference`; hapus `[TODO]` di design.md
    - Selesai 2026-11-01: rumus dikunci mengikuti kode (balance_amount bertanda debit − kredit untuk semua akun); Requirement 3.2 dan 3.5 disesuaikan, disahkan pemilik produk 2026-11-03 (DV-A). Verifikasi data staging: **terkonfirmasi sebagian (2026-11-03):** sesuai untuk akun ber-`balance_type` debit yang ditulis `StockEntryService` (5110, 1241); akun ber-`balance_type` kredit tidak punya cache di staging, sehingga belum teruji data.
    - _Requirements: 3.2, 3.5_
  - [x] 3.2 Buat `BalanceSnapshotService` + `app/Console/Commands/Finances/SnapshotBalancesCommand.php` (`finance:snapshot-balances`), CSV streaming, `LEFT JOIN` agar akun tanpa transaksi ikut
    - _Requirements: 3.1, 3.3, 3.4_
  - [x]* 3.3 Write tests snapshot: header CSV, jumlah baris = jumlah akun, akun tanpa transaksi bernilai nol, `balance_type` null → `note`
    - **Validates: Requirements 3.1–3.5**

- [x] 4. Checkpoint - Auditor dan snapshot
  - Jalankan test berkas Task 2.5 dan 3.3; pastikan P-1 (read-only: jumlah baris semua tabel tak berubah) lulus
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Helper fixture dan characterization test
  - [x] 5.1 Buat `tests/Support/BuildsFinanceFixtures.php` (user, branch, akun standar, setting, `initPermissions()` model terkait, `is_example` seperti pola `GeneralLedgerControllerTest`; `queue.default=sync`)
    - _Requirements: 4.4, 4.5_
  - [x] 5.2 Characterization: Sales Invoice (normal + retur)
    - _Requirements: 4.1–4.3_
  - [x] 5.3 Characterization: Purchase Invoice (cabang stok/SRNB + expense/credit; normal + retur)
    - Selesai 2026-11-01: jalur expense/kredit lewat `onApproved`; cabang stok/SRNB di batas event + listener asli (nilai `totalStockGL` berasal dari valuasi SLE, sudah dicakup `PurchaseInvoicePendingSlesFifoOrderTest`). Temuan: `onApproved` tanpa PO gagal `TypeError` (event rekalkulasi PO butuh PO non-null).
    - _Requirements: 4.1–4.3_
  - [x] 5.4 Characterization: Purchase Receipt (normal + retur) dan Delivery Note (normal + retur; jalur rental bila terjangkau)
    - Selesai 2026-11-01 dengan cakupan dipersempit: dikunci di batas event + listener asli (`totalRatesForGL`/`totalPicked` adalah keluaran valuasi stok, di luar refactor posting). Jalur rental Delivery Note tidak dibuat: posting rental ada di `PostAssetDisposalGainLoss` (task 5.6).
    - _Requirements: 4.1–4.3_
  - [x] 5.5 Characterization: Payment Entry (satu pembayaran penuh) dan Stock Entry (`item_receipt` + jenis lain yang memposting GL)
    - _Requirements: 4.1–4.2_
  - [x] 5.6 Characterization: Asset — depresiasi, scrap, value adjustment, disposal gain/loss (perluas test `PostAssetDepreciationCommandTest`/`PurchaseInvoiceServiceFixedAssetDispatchTest` yang ada alih-alih menduplikasi bila sudah mencakup)
    - Selesai 2026-11-01: depresiasi lewat command penuh, scrap lewat `Asset::scrap()`, penyesuaian nilai dan disposal di batas event + listener asli. Temuan: tanda laba/rugi disposal tampak terbalik terhadap konvensi umum (lihat docblock test).
    - _Requirements: 4.1–4.2_

- [x] 6. Known-issue test dan audit data nyata
  - [x] 6.1 Known-issue F-10: dua pembayaran parsial berurutan; catat jumlah yang diposting GL ke-2
    - _Requirements: 5.1, 5.5_
  - [x] 6.2 Known-issue F-11 (FX): pembayaran mata uang asing dengan `exchange_rate` ≠ 1
    - _Requirements: 5.2, 5.5_
  - [x] 6.3 Known-issue F-04: cancel Sales Invoice, Payment Entry, dan Stock Entry; catat bahwa GL/SLE di-soft-delete (hook `Submitable`) dan apakah `accounts.balance_amount` ikut disesuaikan
    - _Requirements: 5.3, 5.5_
  - [x] 6.3b Known-issue F-16: dispatch event posting (listener queued ditahan), batalkan dokumen, lalu jalankan listener; catat apakah GL aktif tercipta untuk dokumen `canceled`
    - _Requirements: 5.4, 5.5_
  - [x] 6.4 Perbarui status temuan di PRD (terkonfirmasi / tidak terkonfirmasi) sesuai hasil 6.1–6.3b
    - _Requirements: 5.6_
  - [x] 6.5 **(Manual)** Jalankan `finance:audit-gl --json` dan `finance:snapshot-balances` di staging (produksi tidak diperlukan: belum ada data sama sekali (GL produksi kosong), Q1 versi PRD dijawab 2026-11-03); simpan keluaran di `storage/app/finance-audit/`
    - _Requirements: 1.4, 3.1, 7.1_
    - Selesai 2026-11-03 oleh pemilik produk (staging): `audit-20261103-155516.json`, `baseline-20261103-155540.csv`; disimpan di `storage/app/finance-audit/` (ter-ignore git). Produksi tidak diperlukan (Q1 versi PRD dijawab 2026-11-03). `APP_ENV` dan skema aktual `accounts`/`general_ledgers` diserahkan pemilik produk 2026-11-04 (lihat 7.1).

- [x] 7. Audit skema dan dokumen keputusan
  - Selesai 2026-11-04: 7.1, 7.2, dan 7.3 selesai.
  - [x] 7.1 Dokumentasikan kolom yang ditambah `initPermissions()` per jenis model dan skema aktual `accounts`/`general_ledgers` di staging (bandingkan dengan migration)
    - Draft 2026-11-03 di `docs/prd/finance-audit-report.md` Bagian 1: Req 6.1, 6.3, 6.4 selesai dari kode; Req 6.2 (skema aktual staging dan selisihnya) diserahkan pemilik produk dan dicatat 2026-11-04: `APP_ENV` staging = `staging` (bukan `local`, sehingga dua jalur penghapusan kolom yang dibatasi `isLocal()` tidak berlaku di staging) dan skema `accounts`/`general_ledgers` (hanya struktur) tanpa drift terhadap migration + kolom runtime `initPermissions()`; hasil di `docs/prd/finance-audit-report.md` Bagian 1.5.2, kesimpulan 1.3/1.4 diperbarui. Selesai 2026-11-04.
    - _Requirements: 6.1–6.4_
  - [x] 7.2 Tulis `docs/prd/finance-audit-report.md` (ringkasan audit, hasil known-issue, estimasi beban backfill)
    - Draft 2026-11-03: hasil known-issue dan temuan baru (Req 7.3) lengkap; angka `finance:audit-gl` (Req 7.1) dan estimasi backfill (Req 7.4) diisi dari hasil Task 6.5 (2026-11-03). Laporan disetujui pemilik produk 2026-11-03 (PR #272/#273); tambahan staging (angka dan N-4…N-9, PR #274) disetujui 2026-11-03 (AP-2); angka staging diisi.
    - _Requirements: 7.1, 7.3, 7.4_
  - [x] 7.3 Tulis `docs/prd/finance-decision-log.md` (D-1, D-4, D-11, D-12, Q1–Q7) dan **minta konfirmasi pemilik produk**
    - Draft 2026-11-03 selesai. Disahkan pemilik produk 2026-11-03: BR-2…BR-5, DV-A, dan DV-B; DV-C diterima. Decision log disetujui pemilik produk 2026-11-03 (AP-3); keputusan penanganan per bug disetujui 2026-11-03 (PB); DV-D disetujui opsi (a) 2026-11-03 (implementasi Task 2.6).
    - _Requirements: 7.2, 7.5_

- [x] 8. Checkpoint akhir Fase 0
  - Jalankan seluruh test yang disentuh (`php artisan test --compact tests/Feature/Finances`), lalu `vendor/bin/pint --dirty --format agent` dan `npm run lint` bila ada perubahan JS (tidak diharapkan)
  - Exit criteria: laporan audit & decision log disetujui; Q1 versi PRD terjawab 2026-11-03 (belum ada data sama sekali (GL produksi kosong); D-4 sudah diputuskan); temuan F-04/F-10/F-11 berstatus terkonfirmasi/tidak. _Diubah 2026-11-03 (disetujui pemilik produk): rumusan Q1 dirinci menjadi Q1 versi PRD._ Status 2026-11-03: laporan audit dan decision log disetujui. Task 2.6 (DV-D) selesai 2026-11-04.
  - **Selesai 2026-11-04.** Hasil: `tests/Feature/Finances` 270 test, 1096 assertion, OK (2026-11-04, branch `docs/finance-p0-closure`); Pint `--dirty` lulus tanpa perubahan. Exit criteria terpenuhi: laporan audit dan decision log disetujui (2026-11-03); Q1 versi PRD terjawab (2026-11-03); F-04/F-10/F-11 terkonfirmasi (laporan audit Bagian 3); D-4 diputuskan, D-1 dan D-11 ditunda dengan alasan tertulis; DV-D selesai (Task 2.6, PR #275); skema staging Req 6.2 dan `APP_ENV` diterima (Task 7.1). Fase 0 selesai 2026-11-04; keputusan Fase 1 yang menyertainya (D-3, D-8, D-14, Q-P1-1, Q-P1-2) tercatat di decision log.
  - Ensure all tests pass, ask the user if questions arise.

## Catatan

- Tasks bertanda `*` bersifat opsional untuk MVP spec ini tetapi sangat disarankan karena auditor dipakai sebagai alat verifikasi Fase 1–2; **konfirmasi cakupan dengan pemilik produk sebelum dilewati**.
- Jangan memperbaiki bug yang ditemukan di fase ini (Requirement 5.7); catat dan ajukan keputusan.
