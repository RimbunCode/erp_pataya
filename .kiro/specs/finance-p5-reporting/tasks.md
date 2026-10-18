# Implementation Plan: Finance P5 — Reporting

## Overview

Urutan: verifikasi infrastruktur laporan dan audit COA (1), proyeksi saldo + view (2), pembaca saldo dan builder (3–4), laporan datar dan statement per rilis (5–9), pensiun `balance_amount` (10), UI/ekspor (11), checkpoint (12). Laporan dirilis **bertahap** (lihat Rollout di design): TB dan Buku Besar tidak menunggu fase lain. Lint/Pint sekali di akhir.

**Prasyarat**: Fase 1 selesai (TB/Buku Besar); Fase 2 (semua posting via engine) untuk keandalan angka; Fase 3/4 untuk Rekap Pajak/Aging. Branch terbaru dari remote.

**Aturan eksekusi**:
- Jangan mengubah laporan operasional existing (`tests/Feature/Report/*` harus hijau).
- Task statement (Laba Rugi/Neraca/Arus Kas) menunggu keputusan D-11/D-20 dan klasifikasi akun oleh akuntan untuk finalisasi format; kerangka teknis boleh dikerjakan lebih dulu.
- Jangan menebak klasifikasi akun yang tidak jelas; tampilkan sebagai peringatan.
- Task `*` opsional; konfirmasi sebelum dilewati.

## Tasks

- [ ] 1. Verifikasi dan audit
  - [ ] 1.1 Baca `ReportExporter` (`csv`, `pdf`), `ReportFilter`, `ReportKpi`, `ReportConsistencyChecker`, `ReportAccess`, `ReportFilterStore`, satu controller laporan (`SalesInvoiceReportController`), halaman `Report/SalesInvoice.jsx`, dan migration view `create_report_sales_invoice_view`; tentukan kebutuhan adaptor ekspor untuk statement (hapus `[TODO]` di design)
    - _Requirements: 1.4, 11.1–11.3_
  - [ ] 1.2 Audit COA aktual: setiap akun berklasifikasi `root_type`/`report_type`/`balance_type` konsisten dengan induknya; akun HPP; akun ekuitas "Laba"; laporkan anomali ke akuntan (Q-P5-3)
    - _Requirements: 4.1, 5.2_
  - [ ] 1.3 Verifikasi cara pembatasan cabang diterapkan pada laporan (`DataTableScope::applyBranchFilter`, `BranchScopeCache`) dan cara menerapkannya pada query agregat non-DataTable
    - _Requirements: 7.6, 11.2_
  - [ ] 1.4 Ukur ukuran `general_ledgers` di staging/produksi untuk menetapkan target kinerja realistis
    - _Requirements: 12.1_

- [ ] 2. Proyeksi saldo dan view dasar
  - [ ] 2.1 Migration `create_account_balances_table` + model `AccountBalance`; migration `create_report_ledger_line_view` (pola view existing, aman SQLite) + model `LedgerLineRow`; test `initPermissions()` untuk model baru
    - _Requirements: 1.1–1.3, 1.6, 3.1_
  - [ ] 2.2 `AccountBalanceProjector::apply()` dipanggil di dalam `JournalService::post()` (satu transaksi); optimasi upsert per driver; penjaga duplikasi baris `NULL`
    - _Requirements: 3.2, 3.8_
  - [ ] 2.3 `AccountBalanceProjector::void()` dan panggil dari hook `Submitable` (legacy cancel) pada titik yang sama dengan penandaan `voided`
    - _Requirements: 3.5_
  - [ ] 2.4 `rebuild()` + `finance:rebuild-balances {--from=} {--to=} {--dry-run}` (chunk, idempoten) dan `finance:reconcile-balances` (jadwal harian; status hijau/merah disimpan untuk `BalanceReader`)
    - _Requirements: 3.4, 3.6–3.7_
  - [ ]* 2.5 Write tests proyeksi
    - **P-3** proyeksi = agregasi view pada dataset acak (posting, reversal, void legacy); **P-7** void legacy; **P-8** rebuild idempoten; transaksi posting gagal tidak menyisakan proyeksi; baris tanpa periode
    - **Validates: Requirements 3.1–3.8**
  - [ ]* 2.6 Write tests view: baris soft-deleted dan jurnal `voided` tidak muncul; `reversed` muncul; baris tanpa `journal_id` tetap muncul; `legacy_unbalanced` bertanda
    - **Validates: Requirements 1.1–1.3**

- [ ] 3. Pembaca saldo dan filter
  - [ ] 3.1 `BalanceReader` (`trialBalance`, `closingBalance`, `usesProjection`; sumber proyeksi vs view; rentang memotong periode)
    - _Requirements: 2.1–2.2, 2.6_
  - [ ] 3.2 `TrialBalanceFilter`, `LedgerFilter` (+ `KEYS`, `applyTo`, `toSummary`) dan filter bersama (rentang/periode, cabang, mata uang, opsi legacy)
    - _Requirements: 1.5_
  - [ ]* 3.3 Write tests: hasil proyeksi = hasil view (identik); rentang memotong periode; pembatasan cabang (**P-10**)
    - **Validates: Requirements 2.6, 1.5**

- [ ] 4. Trial Balance dan Buku Besar (rilis 1)
  - [ ] 4.1 `FinancialStatementBuilder` bagian TB (rollup `lft/rgt`, hanya-akun-bertransaksi) + `StatementNode`
    - _Requirements: 2.1–2.3_
  - [ ] 4.2 `TrialBalanceReportController`, `GeneralLedgerDetailReportController` (Row model `LedgerLineRow`, KPI, paginasi, saldo berjalan, filter pihak/sumber, tautan jurnal), entri `ReportCatalog`, rute `/reports/trial-balance` dan `/reports/general-ledger`, ekspor CSV/PDF
    - _Requirements: 2.4–2.7, 11.1–11.2_
  - [ ] 4.3 `FinanceConsistencyChecker` + `PostingLagIndicator` + banner (TB: debit=kredit; Buku Besar: saldo akhir=TB; lag)
    - _Requirements: 9.1–9.4_
  - [ ]* 4.4 Write tests
    - **P-1** TB seimbang; **P-4** Buku Besar = TB; ekspor; banner lag muncul saat ada `GlPostingStatus` pending/failed; kasus tabel kosong
    - **Validates: Requirements 2.1–2.7, 9.1–9.2**
  - [ ] 4.5 **(Manual, staging)** Bandingkan TB dengan baseline Fase 0 (`finance:snapshot-balances`); catat selisih dan penyebab
    - _Requirements: 10.3_

- [ ] 5. Laba Rugi dan Neraca (rilis 2 — setelah D-11 / Task 1.2)
  - [ ] 5.1 `FinancialStatementBuilder`: Laba Rugi (bagian pendapatan/HPP/beban/lain-lain, laba kotor/bersih, kontra, pembanding)
    - _Requirements: 4.1–4.3_
  - [ ] 5.2 Neraca (as-of, Laba Berjalan virtual, Laba Ditahan Belum Ditutup, cek keseimbangan, pembanding)
    - _Requirements: 5.1–5.5_
  - [ ] 5.3 Controller, halaman, rute, ekspor; konsistensi (Neraca seimbang, LR=Laba Berjalan)
    - _Requirements: 4.5, 5.5, 9.2, 11.1_
  - [ ]* 5.4 Write tests unit/feature
    - **P-2** Neraca seimbang; **P-5** LR = Laba Berjalan; akun kontra; golden dataset lengkap ditinjau akuntan
    - **Validates: Requirements 4.1–4.4, 5.1–5.4**

- [ ] 6. Arus Kas (rilis 3 — setelah D-20)
  - [ ] 6.1 Migration `accounts.cash_flow_category`; UI pengaturan kategori pada form Akun; daftar peringatan akun neraca belum berkategori
    - _Requirements: 6.1, 6.4_
  - [ ] 6.2 Builder Arus Kas tidak langsung + rekonsiliasi Δ kas + "belum terklasifikasi"
    - _Requirements: 6.2–6.3_
  - [ ]* 6.3 Write tests **P-9** pada dataset golden; akun tak berkategori muncul sebagai peringatan
    - **Validates: Requirements 6.2–6.4**

- [ ] 7. AR/AP Aging dan Buku Besar Pihak (rilis 4 — setelah rekonsiliasi sub-ledger Fase 4)
  - [ ] 7.1 `AgingBuilder` (bucket dikonfigurasi, jatuh tempo dari termin, valas, uang muka/kredit terbuka) dan `AgingFilter`
    - _Requirements: 7.1–7.3_
  - [ ] 7.2 Controller + halaman Aging (piutang/utang) dan Buku Besar Pihak (`PartyStatement`); rekonsiliasi dengan akun kontrol; cabang
    - _Requirements: 7.4–7.6_
  - [ ]* 7.3 Write tests **P-6** Aging = akun kontrol; bucket batas hari; valas; cabang (**P-10**)
    - **Validates: Requirements 7.1–7.6**

- [ ] 8. Rekap Pajak (rilis 5 — setelah cutover Fase 3)
  - [ ] 8.1 `TaxSummaryBuilder` + `TaxSummaryFilter` + Row/controller/halaman; blok rekonsiliasi Faktur Pajak; invoice pra-cutover dipisah
    - _Requirements: 8.1–8.4_
  - [ ]* 8.2 Write tests rekonsiliasi (invoice terpisah vs pra-cutover; campuran PPN + pajak lain)
    - **Validates: Requirements 8.1–8.3**

- [ ] 9. Kinerja
  - [ ] 9.1 Seed ≥1 juta baris jurnal di MySQL staging; ukur TB/Buku Besar/Neraca; optimasi indeks/query; catat hasil vs target Req. 12.1–12.3
    - _Requirements: 12.1–12.3_

- [ ] 10. Pensiun `balance_amount` sebagai sumber
  - [ ] 10.1 Hapus mutasi langsung `balance_amount` di `StockEntryService` (~572–639); `AccountBalanceProjector` memperbarui cermin dalam transaksi posting
    - _Requirements: 10.1_
  - [ ]* 10.2 Write tests: total saldo per akun sebelum/sesudah migrasi sama (selisih drift lama dilaporkan); tampilan akun existing tetap benar
    - **Validates: Requirements 10.1, 10.4**
  - [ ] 10.3 **(Setelah dua siklus tutup bulan hijau, atas persetujuan)** ganti pembaca `balance_amount` ke `BalanceReader`, tandai kolom deprecated
    - _Requirements: 10.2_

- [ ] 11. Antarmuka, terjemahan, dan menu
  - [ ] 11.1 Halaman `Report/*` untuk seluruh laporan (filter, KPI/ringkasan, tabel/pohon, banner lag & konsistensi, ekspor, laporkan masalah) mengikuti pola halaman laporan existing; `.rtl.test.jsx` per halaman
    - _Requirements: 11.1, 11.3, 11.5_
  - [ ] 11.2 Entri menu/desk laporan keuangan; izin; kunci terjemahan `lang/id` & `lang/en` (`report.finance.*`, `report_rows`); `LocaleKeysTest` hijau
    - _Requirements: 11.2, 11.4–11.5_

- [ ] 12. Checkpoint akhir Fase 5
  - Jalankan `php artisan test --compact tests/Feature/Report tests/Feature/Finances tests/Unit` + test frontend yang disentuh
  - Setelah semua task: `vendor/bin/pint --dirty --format agent`, `npm run lint`, `graphify update .`
  - Exit criteria: P-1…P-10 hijau; rekonsiliasi `account_balances` nol selisih di staging; TB cocok dengan baseline (selisih terklasifikasi); laporan ditinjau akuntan; keputusan D-11/D-19/D-20 terdokumentasi
  - Ensure all tests pass, ask the user if questions arise.

## Catatan

- Fase 6 menambah jurnal penutup dan status periode; Neraca/Laba Berjalan sudah disiapkan agar tetap benar sebelum dan sesudah penutupan (Req. 5.2).
- Jangan menduplikasi query sub-ledger di laporan; gunakan `PartyLedgerService`.
- Jika Task 1.1 menunjukkan `ReportExporter` tidak cocok untuk statement, buat adaptor minimal alih-alih menyalin pola ekspor.
