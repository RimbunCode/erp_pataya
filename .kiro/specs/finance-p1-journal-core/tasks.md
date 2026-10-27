# Implementation Plan: Finance P1 — Journal Core

## Overview

Urutan kerja: verifikasi asumsi dulu (Task 1), lalu migration + model aditif (2), service inti dengan test (4), adapter 10 titik posting yang dijaga characterization test Fase 0 (6), backfill + rekonsiliasi (7), perubahan tipe kolom yang **dikunci gate** (8–9), UI (10), dan jurnal manual opsional (11). Setiap checkpoint menjalankan test yang relevan. Lint/Pint dijalankan sekali di akhir (aturan project).

**Prasyarat (wajib)**: Fase 0 selesai dan disetujui — characterization test hijau, laporan audit tersedia, Q1 terjawab (D-4 sudah diputuskan), dan service setting Finances dari spec `module-settings-foundation` tersedia (D-25). Jangan mulai Task 6 sebelum Task 4 selesai dan characterization test Fase 0 hijau di branch ini. Branch harus terbaru dari remote (aturan git worktree project).

**Aturan eksekusi**:
- Task 8 dan 9 bersifat *gated*: tidak dijalankan otomatis; membutuhkan hasil pra-pemeriksaan dan persetujuan jendela pemeliharaan.
- Task bertanda `*` opsional; konfirmasi cakupan dengan pemilik produk sebelum dikerjakan.
- Jangan mengubah perilaku akuntansi pada adapter (Req. 8.2); perubahan satu-satunya adalah Req. 2.10 (pasangan 0).
- Jangan memperbaiki F-10 (Payment kumulatif) di fase ini; adapter mempertahankan nilainya.

## Tasks

- [ ] 1. Verifikasi asumsi desain (read-only)
  - [ ] 1.1 Baca ulang `docs/prd/finance-engine-prd.md` (Lampiran A/B), `finance-audit-report.md`, dan `finance-decision-log.md` (hasil Fase 0); catat keputusan D-3/D-4/D-14 terbaru di bagian atas `design.md`
    - _Requirements: seluruh_
  - [ ] 1.2 Cari semua penulisan/ubah/hapus `GeneralLedger` di `app/`, `database/seeders/`, `tests/` (`GeneralLedger::create|insert|where(...)->update|delete`, `generalLedgerEntries()->…`); daftar hasil menjadi allowlist test arsitektur
    - _Requirements: 4.1, 4.2, 4.6_
  - [ ] 1.3 Inventarisasi pemakai kolom `debit`/`credit` (query mentah, view DB, laporan, `groupAggregate`, frontend) untuk Task 8
    - _Requirements: 13.4_
  - [ ] 1.4 Tentukan mekanisme audit aplikasi (`Log` model / pencatat lain) dan cara memakainya dari service; hapus `[TODO]` Req. 14.2
    - _Requirements: 14.2_
  - [ ] 1.5 Verifikasi mekanisme `FormatingSeries::generate()` (pendaftaran baris series untuk model baru, keamanan terhadap balapan); tentukan strategi kunci untuk `Journal.code`; hapus `[TODO]` di design
    - _Requirements: 1.6_
  - [ ] 1.6 Verifikasi kontrak service setting Finances dari spec `module-settings-foundation` (cara menambah setting baru pada lingkungan berjalan, cara membacanya dari service/listener) dan pakai untuk `finance_enforce_fiscal_period`
    - _Requirements: 6.4_

- [ ] 2. Migration, model, dan exception (aditif)
  - [ ] 2.1 Migration `create_journals_table` (kolom sesuai Req. 1.1; indeks `transaction_date`, `(source_type, source_id)`, unik `posting_key`, unik `code`)
    - _Requirements: 1.1_
  - [ ] 2.2 Migration `create_fiscal_years_table` dan `create_fiscal_periods_table`
    - _Requirements: 6.1_
  - [ ] 2.3 Migration `add_journal_columns_to_general_ledgers_table` (`journal_id`, `line_no`, `foreign_*`, `exchange_rate`, indeks `(account_id, transaction_date)` dan `(journal_id, line_no)`) — aditif saja, belum mengubah tipe
    - _Requirements: 1.2_
  - [ ] 2.4 Migration `add_minor_unit_to_currencies_table` + migration data ISO 4217 idempoten
    - _Requirements: 7.1, 7.2_
  - [ ] 2.5 Buat `Journal`, `FiscalYear`, `FiscalPeriod` (trait `DataTable`, `HasUlids`, `permissions()`, `configColumns`, `translateKey`), enum `JournalStatus`, relasi `GeneralLedger::journal()`; tulis test yang menjalankan `initPermissions()` pada ketiga model dan memastikan tidak ada kolom tak terduga ditambah/dihapus (F-12)
    - _Requirements: 1.4, 1.5, 1.7, 14.1_
  - [ ] 2.6 Buat 6 exception di `app/Exceptions/Finances/` dengan kunci pesan `finances.journal.*` di `lang/id` dan `lang/en`
    - _Requirements: 2.3–2.6, 3.2, 4.1, 5.4_

- [ ] 3. Checkpoint - Skema
  - Jalankan migrasi pada DB uji (SQLite) dan, manual, pada MySQL dev; `php artisan test --compact tests/Feature/Finances` untuk memastikan test existing tetap hijau
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Service inti (TDD: test lebih dulu)
  - [ ] 4.1 `MinorUnit` (`round`, `toMinor`, `fromMinor`, batas nilai) + unit test (1.005, 0.125, nilai besar, minor unit 0)
    - _Requirements: 2.5, 7.3_
  - [ ] 4.2 `FiscalPeriodService` (`resolve`, `assertOpen`, `generateYear`, `close`, `open`, larangan tumpang-tindih) + perintah `finance:generate-fiscal-year {year}` + test
    - _Requirements: 6.1–6.3, 6.5–6.7_
  - [ ] 4.3 `JournalDraft`, `JournalLineDraft`, `JournalService::post()` dan `postPair()` (urutan langkah di design; idempotensi; kode series sesuai 1.5)
    - _Requirements: 2.1–2.10, 3.1–3.4_
  - [ ]* 4.4 Write property-style tests `JournalService`
    - **P-1** 1.000 draft acak valid (seimbang) diterima dan 1.000 tak seimbang ditolak (seed tetap); **P-2** kegagalan di baris ke-k tidak menyisakan data; **P-3** `postingKey` ganda; **P-8** enforcement aktif/mati terhadap periode closed/tak ada; akun group/disabled/terhapus; pasangan 0 → `null`
    - **Validates: Requirements 2.2–2.10, 3.1–3.2, 6.5–6.6**
  - [ ] 4.5 Guard immutability `GeneralLedger` dan `Journal` (+ jalur backfill terizinkan) + test **P-5** (update/delete/forceDelete ditolak; update `journal_id`/`line_no` pada baris `journal_id` null diizinkan)
    - _Requirements: 4.1–4.3_
  - [ ] 4.6 `JournalReversalService` + test **P-4** (net nol per akun, status, tautan dua arah, reversal ganda ditolak, jurnal legacy tak seimbang ditolak, periode tertutup ditolak, izin `reverse`)
    - _Requirements: 5.1–5.8_
  - [ ] 4.7 Test arsitektur: pindai `app/` terhadap allowlist dari Task 1.2 (hanya `JournalService`, `JournalReversalService`, backfill yang menulis GL; pengecualian `Submitable` hook update massal didokumentasikan)
    - _Requirements: 4.5, 4.6_

- [ ] 5. Checkpoint - Service inti
  - Jalankan test Task 4; characterization Fase 0 masih hijau (belum ada adapter)
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Adapter 10 titik posting (satu rilis, urutan pengerjaan di bawah)
  - [ ] 6.1 `PostSalesInvoiceGeneralLedger` → `postPair` + `postingKey` + tangani `DuplicatePostingException`
    - _Requirements: 8.1–8.4_
  - [ ] 6.2 `PostPurchaseInvoiceGeneralLedger` → dua jurnal (`stock`, `expense`) dengan `postingKey` berbeda
    - _Requirements: 8.1–8.4_
  - [ ] 6.3 `PostPurchaseReceiptGeneralLedger` → `postPair`
    - _Requirements: 8.1–8.4_
  - [ ] 6.4 Baca lalu alihkan `PostDeliveryNoteGeneralLedger` (belum dibaca saat spec ditulis; sesuaikan bila polanya berbeda, mis. jalur rental)
    - _Requirements: 8.1–8.4_
  - [ ] 6.5 `PaymentEntryService::onApproved` → `postPair` (nilai tetap = perilaku sekarang, termasuk F-10)
    - _Requirements: 8.1, 8.2_
  - [ ] 6.6 `StockEntryService` (GL + biaya tambahan) → `postPair`; `balance_amount` dibiarkan
    - _Requirements: 8.1, 8.2, 8.5_
  - [ ] 6.7 Empat listener Asset (`PostDepreciationEntry`, `PostScrapWriteOff`, `PostValueAdjustmentEntry`, `PostAssetDisposalGainLoss`) → `postPair`
    - _Requirements: 8.1–8.4_
  - [ ] 6.8 Hook `Submitable`: tandai jurnal sumber `voided` setelah update massal soft-delete + test untuk Sales Invoice, Payment Entry, Stock Entry
    - _Requirements: 8.6, 4.5_
  - [ ] 6.9 Jalankan seluruh characterization Fase 0 + test arsitektur 4.7; selisih hanya boleh pada kasus pasangan 0 dan urutan `id` (dicatat eksplisit)
    - **P-6** parity
    - _Requirements: 8.2, 14.5_

- [ ] 7. Backfill dan rekonsiliasi
  - [ ] 7.1 `finance:backfill-journals` (`--dry-run`, `--chunk`, `--limit`): kelompok per (`referenceable_type`, `referenceable_id`, `transaction_date`), jurnal legacy, `legacy_unbalanced`, panggil generate periode, rekonsiliasi sebelum/sesudah
    - _Requirements: 6.8, 9.1–9.9_
  - [ ]* 7.2 Write tests backfill
    - **P-7** Σ per akun sama sebelum/sesudah; idempoten (run dua kali); kelompok seimbang/tak seimbang/soft-deleted; resume setelah gagal di tengah; dry-run tidak menulis
    - **Validates: Requirements 9.1–9.8**
  - [ ] 7.3 `finance:reconcile-ledger` memakai `GeneralLedgerAuditor` (Fase 0) + pemeriksaan jurnal (a)–(d); jadwalkan harian di `routes/console.php`; kode keluar non-nol saat pelanggaran
    - _Requirements: 10.1–10.4_
  - [ ]* 7.4 Write tests reconcile: pelanggaran yang disuntikkan terdeteksi; data sehat lolos; `legacy_unbalanced` dilaporkan sebagai informasi
    - **Validates: Requirements 10.1–10.4**
  - [ ] 7.5 **(Manual, staging)** `finance:backfill-journals --dry-run` → tinjau → jalankan nyata → bandingkan dengan baseline Fase 0 (`finance:snapshot-balances`); catat hasil di laporan
    - _Requirements: 9.8_

- [ ] 8. **(GATED)** Konversi tipe kolom dan FK — jangan dijalankan tanpa persetujuan jendela pemeliharaan
  - [ ] 8.1 Pra-pemeriksaan read-only: baris dengan presisi >4 desimal bermakna; ukuran tabel; hasil dilaporkan ke pemilik produk
    - _Requirements: 13.1_
  - [ ] 8.2 Selesaikan audit pemakai `debit`/`credit` (Task 1.3): perbaiki cast/format di PHP dan frontend yang terdampak string `decimal`; tambah test laporan terkait
    - _Requirements: 13.4_
  - [ ] 8.3 Migration terpisah: `against_account_id` nullable; `debit`/`credit` → `decimal(20,4)`; FK akun → `restrictOnDelete`; `down()` terdokumentasi; uji di SQLite dan MySQL staging
    - _Requirements: 1.3, 13.2, 13.3_

- [ ] 9. **(GATED)** `journal_id` NOT NULL
  - [ ] 9.1 Migration terpisah yang di dalamnya memeriksa nol baris aktif tanpa `journal_id` dan menolak jalan jika tidak; tidak ikut `migrate` otomatis lingkungan produksi tanpa persetujuan
    - _Requirements: 13.5_

- [ ] 10. Antarmuka pengguna
  - [ ] 10.1 `JournalController` (`index`, `show`, `reverse`) + `FiscalPeriodController` + rute (`Route::resourceDetail('journals', …)` mengikuti pola `generalLedger` di `routes/web.php`) + izin di seeder
    - _Requirements: 11.1, 11.2, 11.4, 14.1_
  - [ ] 10.2 Halaman `Finances/Journals/Index.jsx` dan `Show.jsx` (header, tabel baris, total, indikator seimbang, tautan sumber/asal/pembalik, dialog Balik) — ikuti pola `Finances/GeneralLedger.jsx` dan `GeneralLedgers/Show.jsx`; test `.rtl.test.jsx`
    - _Requirements: 11.1, 11.2, 11.7_
  - [ ] 10.3 Halaman `Finances/FiscalPeriods/Index.jsx` (daftar, generate tahun, buka/tutup, toggle enforcement + peringatan); test `.rtl.test.jsx`
    - _Requirements: 11.4, 11.5, 11.7_
  - [ ] 10.4 Perbarui halaman General Ledger: kolom `Journal` (tautan) dan "Beberapa akun" untuk `against_account_id` null; perbarui `GeneralLedger::$configColumns`; sesuaikan `Show.rtl.test.jsx` yang ada
    - _Requirements: 11.3_
  - [ ] 10.5 Kunci terjemahan `lang/id` dan `lang/en` (jurnal, periode, exception, menu); pastikan `LocaleKeysTest` hijau; daftarkan item menu/desk sesuai mekanisme project
    - _Requirements: 11.6_

- [ ]* 11. Jurnal manual (hanya jika D-14 disetujui)
  - [ ]* 11.1 Form jurnal manual (≥2 baris, indikator seimbang realtime) + `JournalController@store` → `JournalService::post()` + izin `create`
    - _Requirements: 12.1, 12.2_
  - [ ]* 11.2 Test: jurnal manual tidak seimbang ditolak; periode tertutup ditolak; dapat dibalik; tidak dapat diedit
    - **Validates: Requirements 12.2, 12.3**

- [ ] 12. Checkpoint akhir Fase 1
  - Jalankan `php artisan test --compact tests/Feature/Finances tests/Feature/Asset tests/Unit` dan test frontend yang disentuh (`npx vitest run <path>`)
  - Setelah semua task selesai: `vendor/bin/pint --dirty --format agent`, `npm run lint`, lalu `graphify update .`
  - Exit criteria: P-1…P-8 hijau; characterization Fase 0 hijau; backfill staging selesai dengan laporan selisih nol (atau `legacy_unbalanced` terdokumentasi); `finance:reconcile-ledger` hijau; Task 8–9 diputuskan (dijalankan atau ditunda dengan alasan tertulis)
  - Ensure all tests pass, ask the user if questions arise.

## Catatan

- Seluruh `postingKey` memakai `purpose` baku: `default`, `stock`, `expense`, `depreciation`, `write_off`, `value_adjustment`, `disposal`, `reversal`. Daftar ini menjadi kontrak untuk Fase 2.
- Fase 2 menghapus pengecualian `Submitable` (soft-delete GL saat cancel) dan status `voided`; jangan membangun fitur baru yang bergantung pada `voided`.
- Jika Task 1.2–1.6 mengungkap asumsi design yang salah, perbarui `design.md` lebih dulu dan minta konfirmasi sebelum lanjut.
