# Implementation Plan: Finance P6 — Period Closing, Year-End, FX Revaluation

## Overview

Urutan: verifikasi + keputusan kebijakan (1), skema aditif (2), penegakan status periode (3), kerangka checklist + check (4), UI Tutup Periode (5), revaluasi FX (6–7), penutupan tahun (8), pelaporan `excludeClosing` (9), checkpoint (10). **`finance_enforce_fiscal_period` tetap `false` sampai D-21 diputuskan**: merge tidak mengubah perilaku produksi. Lint/Pint sekali di akhir.

**Prasyarat**: Fase 1, 4, 5 selesai; D-21/D-22/D-23/D-24 terjawab sebelum Task 3 (transisi status) dan Task 8 (penutupan tahun); peran akun `unrealized_fx_*` dan `retained_earnings` dapat dipetakan akuntan. Branch terbaru dari remote.

**Aturan eksekusi**:
- Jangan mengubah `transaction_date` posting tanpa keputusan D-21 (Requirement 9).
- Blocking check tidak boleh dapat di-override dalam kode maupun UI.
- Operasi penutupan/revaluasi harus atomik dan idempoten; uji dengan injeksi kegagalan.
- Task `*` opsional; konfirmasi sebelum dilewati.

## Tasks

- [ ] 1. Verifikasi dan kebijakan
  - [ ] 1.1 Dokumentasikan alur tanggal pembukuan setiap titik posting (invoice `now()`, payment `date ?? now()`, depresiasi, dll.) dan usulkan opsi D-21 bersama dampak ke Faktur Pajak/pajak; kirim ke pemilik produk dan akuntan
    - _Requirements: 9.1–9.4_
  - [ ] 1.2 Audit akun bermata uang asing (`accounts.currency_code`) dan kelengkapan jejak `foreign_*` pada baris kas/bank dan piutang/utang valas (data Fase 4); daftar akun yang tidak dapat direvaluasi
    - _Requirements: 4.2_
  - [ ] 1.3 Tentukan pemetaan `retained_earnings` (akun "Laba" pada seeder = laba ditahan atau laba tahun berjalan?) dan `unrealized_fx_*` bersama akuntan; catat di decision log
    - _Requirements: 6.9, 4.10_
  - [ ] 1.4 Tinjau mekanisme notifikasi in-app yang ada (`app/Notifications`, `Services/Core/Notification`) untuk pemberitahuan pembukaan kembali
    - _Requirements: 7.6_

- [ ] 2. Skema aditif
  - [ ] 2.1 Migration: perluas `fiscal_periods` (status tiga nilai, kolom `soft_closed_*`, `hard_closed_*`, `reopened_*`, `reopen_reason`) + migrasi data `closed → hard_closed` (reversible); `fiscal_years` (`closing_journal_id`, `closed_*`)
    - _Requirements: 1.1, 1.3_
  - [ ] 2.2 Migration `journals`: `is_closing`, `is_revaluation`, `posted_in_soft_closed`, `posted_in_reopened_period` + indeks
    - _Requirements: 1.4, 6.3, 4.5, 7.5_
  - [ ] 2.3 Migration + model: `fiscal_period_transitions`, `period_close_runs`, `period_close_run_items`, `fx_revaluations`, `fx_revaluation_lines`; izin per model; test `initPermissions()`
    - _Requirements: 1.3, 2.1, 4.1, 10.2_
  - [ ] 2.4 Tambah peran `unrealized_fx_gain`, `unrealized_fx_loss`, `retained_earnings` ke `AccountRole` + label; perluas `finance:init-posting-profile` (laporan peran belum terpetakan); preferensi `finance_close_sequential`, `finance_pending_doc_check_types`
    - _Requirements: 4.10, 6.9_

- [ ] 3. Penegakan status periode (butuh D-22/D-23)
  - [ ] 3.1 `FiscalPeriodService::assertCanPost()` dan properti `JournalDraft::allowSoftClosed`; integrasikan ke `JournalService::post()` (ganti `assertOpen`); tandai `posted_in_soft_closed`/`posted_in_reopened_period`
    - _Requirements: 1.4–1.6_
  - [ ] 3.2 Transisi status (`softClose`, `hardClose`, `reopen`) dengan `lockForUpdate`, izin (`close_period`, `hard_close_period`, `reopen_period`), riwayat `fiscal_period_transitions`, log audit, notifikasi pembukaan
    - _Requirements: 1.2–1.3, 1.7, 7.1, 7.3–7.4, 7.6, 8.1, 8.4_
  - [ ]* 3.3 Write tests
    - **P-1** matriks status × pengguna × izin × `allowSoftClosed` (acak seed tetap); transisi sah/tidak sah; konkurensi dua operator; **P-10** audit
    - **Validates: Requirements 1.2–1.7, 7.1–7.5, 8.1**

- [ ] 4. Kerangka checklist dan pemeriksaan
  - [ ] 4.1 `PeriodCloseCheck`, `CheckResult`, `CheckSeverity`; `PeriodCloseService::runChecks()` menyimpan run + item; konfigurasi daftar check di `config/finance.php`; kedaluwarsa run (Req. 2.7)
    - _Requirements: 2.1, 2.4, 2.7_
  - [ ] 4.2 Check blocking: `PostingQueueCheck`, `LedgerIntegrityCheck`, `TrialBalanceCheck`, `BalanceProjectionCheck`, `SubledgerCheck`, `DepreciationPostedCheck`, `FxRevaluationPostedCheck`, `PreviousPeriodsClosedCheck`, `RevaluationReversalPendingCheck`
    - _Requirements: 2.2_
  - [ ] 4.3 Check warning: `PendingDocumentsCheck`, `UnclassifiedTaxCheck`, `LegacyUnbalancedCheck`, `PostingDateMismatchCheck` (hanya jika D-21 = tanggal approve), `StockValuationCheck`*
    - _Requirements: 2.3_
  - [ ] 4.4 Override warning dengan alasan + izin `override_close_warning`; blocking tidak dapat di-override; hard close ditolak bila blocking `fail`
    - _Requirements: 2.5–2.6, 2.8_
  - [ ]* 4.5 Write tests tiap check (kasus lulus dan gagal yang disuntikkan)
    - **P-2** blocking tak dapat di-override; **P-3** run kedaluwarsa setelah jurnal baru
    - **Validates: Requirements 2.1–2.8**
  - [ ] 4.6 Perintah `finance:run-close-checks {period}` untuk eksekusi terjadwal/manual dan keluaran terstruktur
    - _Requirements: 8.3_

- [ ] 5. Antarmuka Tutup Periode
  - [ ] 5.1 `PeriodCloseController` + rute + izin; halaman `Finances/PeriodClose/Index.jsx` (daftar periode, jalankan pemeriksaan, hasil checklist, aksi sesuai izin/status, konfirmasi + alasan, riwayat transisi, banner enforcement)
    - _Requirements: 3.1–3.3_
  - [ ] 5.2 Penanda "diposting saat soft close" pada halaman jurnal; terjemahan `lang/id` & `lang/en`; test `.rtl.test.jsx`
    - _Requirements: 3.4–3.5_

- [ ] 6. Revaluasi unrealized FX (butuh Q-P6-1 dan pemetaan peran)
  - [ ] 6.1 `FxRevaluationService::preview()` (piutang/utang valas dari `PartyLedgerService`, kas/bank valas dari `foreign_*`, kurs `closing`, daftar mata uang tanpa kurs, daftar akun tak dapat direvaluasi)
    - _Requirements: 4.1–4.4_
  - [ ] 6.2 `post()` (jurnal berpihak/berreferensi, `is_revaluation`, `postingKey`, `allowSoftClosed`, `fx_revaluation_lines`, penolakan ganda, validasi periode berikutnya)
    - _Requirements: 4.5, 4.7–4.8_
  - [ ] 6.3 Auto-reversal: `autoReverseDue()` + perintah terjadwal `finance:auto-reverse-revaluations` (harian di `routes/console.php`)
    - _Requirements: 4.6_
  - [ ] 6.4 `PartyLedgerService` mengekspos `revaluation_adjustment`; kolom "Penyesuaian revaluasi" pada Aging (Fase 5)
    - _Requirements: 4.9_
  - [ ]* 6.5 Write tests dan golden G1–G3
    - **P-4** sub-ledger tetap hijau; **P-5** seimbang/idempoten/net nol setelah pembalikan; **P-6** total ekonomis; kurs tidak ada; akun tanpa jejak asing; periode tujuan tidak open
    - **Validates: Requirements 4.1–4.10, 5.2–5.3**
  - [ ] 6.6 Controller + halaman `Finances/FxRevaluations` (preview rinci, post, daftar riwayat, tombol pembalik manual); `.rtl.test.jsx`
    - _Requirements: 4.1, 3.5_
  - [ ] 6.7 Laba Rugi (Fase 5) menampilkan `unrealized_fx_*` pada bagian terpisah
    - _Requirements: 5.1_

- [ ] 7. **(Manual, staging)** Simulasi satu siklus tutup bulan
  - [ ] 7.1 Isi kurs `closing`, jalankan pemeriksaan → revaluasi → soft close → hard close → buka kembali → tutup lagi bersama akuntan; catat temuan
    - _Requirements: 8.5_

- [ ] 8. Penutupan tahun buku (butuh D-24)
  - [ ] 8.1 `YearEndClosingService::preview()` (saldo P&L per akun tahun itu, tanpa `is_closing`, laba bersih)
    - _Requirements: 6.1, 6.4_
  - [ ] 8.2 `close()` (prasyarat, jurnal penutup `is_closing`, `postingKey`, periode → `hard_closed`, tahun → `closed`, atomik, idempoten)
    - _Requirements: 6.2–6.6_
  - [ ] 8.3 `reopen()` (balik jurnal penutup lalu buka periode dari yang terakhir; tolak bila tahun berikutnya tertutup)
    - _Requirements: 7.2–7.3_
  - [ ]* 8.4 Write tests dan golden G4–G5
    - **P-7** saldo P&L tahun = 0 setelah penutupan, Neraca seimbang, LR tidak berubah; **P-8** idempoten & reopen/close ulang; **P-9** atomik (injeksi kegagalan); dua tahun (tidak bocor lintas tahun)
    - **Validates: Requirements 6.1–6.8, 7.2–7.3**
  - [ ] 8.5 Controller + halaman `Finances/YearEndClosing` (preview, tutup, buka kembali); `.rtl.test.jsx`
    - _Requirements: 6.1, 3.5_

- [ ] 9. Penyesuaian pelaporan
  - [ ] 9.1 Scope `excludeClosing` pada `LedgerLineRow`/pembaca saldo; Laba Rugi, mutasi TB, dan KPI laba default `true`; Neraca `false`; opsi filter "sertakan jurnal penutup"; baris Laba Berjalan/Laba Ditahan Belum Ditutup nol untuk tahun tertutup
    - _Requirements: 6.7–6.8_
  - [ ]* 9.2 Write tests laporan sebelum/sesudah penutupan (angka LR sama; Neraca seimbang; saldo ekuitas benar)
    - **Validates: Requirements 6.7–6.8, 5.3**

- [ ] 10. Checkpoint akhir Fase 6 dan program
  - Jalankan seluruh suite terkait: `php artisan test --compact tests/Feature/Finances tests/Feature/Asset tests/Feature/Report tests/Unit` + test frontend yang disentuh
  - Setelah semua task: `vendor/bin/pint --dirty --format agent`, `npm run lint`, `graphify update .`
  - Exit criteria: P-1…P-10 hijau; satu siklus tutup bulan penuh di staging bersama akuntan tanpa temuan blocking; D-21…D-24 terdokumentasi; penegakan periode dapat dihidupkan/dimatikan tanpa deploy
  - **Penutupan program**: perbarui PRD (status fase, metrik keberhasilan terukur), arsipkan temuan F-xx yang selesai, dan catat utang teknis yang tersisa (kolom `double` operasional, penghapusan `balance_amount`, `legacy_account_fallback`)
  - Ensure all tests pass, ask the user if questions arise.

## Catatan

- Jangan mengaktifkan `finance_enforce_fiscal_period` di produksi sebelum D-21 diputuskan, periode historis terisi, dan staging berhasil satu siklus.
- Penambahan check penutupan baru cukup mendaftarkan kelas di `config/finance.php` tanpa mengubah `PeriodCloseService`.
- Jika Task 1.2 menunjukkan jejak `foreign_*` tidak lengkap pada saldo valas, revaluasi hanya mencakup pos yang jejaknya lengkap dan melaporkan sisanya; jangan menebak nilai asing.
