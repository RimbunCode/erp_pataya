# Implementation Plan: Finance P1 — Journal Core

## Overview

Urutan kerja: verifikasi asumsi dulu (Task 1), lalu migration + model aditif (2), service inti dengan test (4), adapter 10 titik posting yang dijaga characterization test Fase 0 (6), backfill + rekonsiliasi (7), perubahan tipe kolom yang dikunci pra-pemeriksaan (8, Rilis 1) dan `journal_id` NOT NULL sebagai **Rilis 2 di PR/tahapan terpisah** (9), UI (10), dan jurnal manual opsional (11). Setiap checkpoint menjalankan test yang relevan. Lint/Pint dijalankan sekali di akhir (aturan project).

**Prasyarat (wajib)**: Fase 0 selesai dan disetujui — characterization test hijau, laporan audit tersedia, Q1 versi PRD terjawab 2026-11-03 (belum ada data sama sekali (GL produksi kosong); D-4 sudah diputuskan), dan service setting Finances dari spec `module-settings-foundation` tersedia (D-25). Jangan mulai Task 6 sebelum Task 4 selesai dan characterization test Fase 0 hijau di branch ini. Branch baru dari `origin/feat/finance-engine` terbaru (BR-6, PRD Bagian 10).

**Aturan eksekusi**:
- **Dua rilis (BR-7, diputuskan pemilik produk 2026-11-04; terpisah dari Q-P1-1).** Rilis 1 = Task 1–8, 10, dan opsional 11 (tabel jurnal, `journal_id` nullable, perintah backfill); backfill dijalankan di staging dan produksi. Rilis 2 = Task 9 (migration NOT NULL) di **PR/tahapan terpisah** yang digabung ke `feat/finance-engine` dan kemudian ke `dev-1` hanya setelah backfill dijalankan dan diverifikasi di staging dan produksi; jangan menggabungkannya lebih awal. Rilis 1 dan Rilis 2 adalah dua penggabungan berbeda ke `dev-1` (BR-6, Q-BR-1). Q-P1-1 (2026-11-04): tidak perlu jendela pemeliharaan.
- Task 8 dikunci pra-pemeriksaan: karena perintah artisan Task 8.1 adalah kode baru yang tiba di staging dalam deploy yang sama dengan migration Task 8.3 (BR-6/BR-7), pra-pemeriksaan staging dijalankan **pemilik produk sebagai query SQL read-only** (praktik Task 6.5 Fase 0) **sebelum Rilis 1 digabung ke `dev-1`**; perintah artisan tetap dibuat untuk Rilis 2 dan seterusnya. Task 9 dikunci pemeriksaan di dalam migration (pengaman) dan prasyarat BR-7 (lihat Task 9). Merge PR ke `dev-1` memicu deploy staging; deploy produksi: tag `v*` mendeploy produksi, sedangkan `workflow_dispatch` punya input `environment` (staging atau produksi, default produksi; `deploy-cpanel.yml:15-28`) dan dapat dijalankan dari ref mana pun, sehingga urutan BR-7 juga berlaku untuk deploy manual (`deploy-cpanel.yml`), bukan `dev-1`.
- Penegakan periode (`finance_enforce_fiscal_period`) tetap nonaktif pada rilis ini dan diaktifkan manual (Q-P1-2, 2026-11-04, pemilik produk; mekanisme toggle di halaman setting adalah detail desain).
- Task bertanda `*` opsional; konfirmasi cakupan dengan pemilik produk sebelum dikerjakan.
- Jangan mengubah perilaku akuntansi pada adapter (Req. 8.2); perubahan satu-satunya adalah Req. 2.10 (pasangan 0).
- Jangan memperbaiki F-10 (Payment kumulatif) di fase ini; adapter mempertahankan nilainya.

## Tasks

- [ ] 1. Verifikasi asumsi desain (read-only)
  - [ ] 1.1 Baca ulang `docs/prd/finance-engine-prd.md` (Lampiran A/B), `finance-audit-report.md`, dan `finance-decision-log.md` (hasil Fase 0); verifikasi bahwa keputusan D-3/D-4/D-8/D-14/Q-P1-1/Q-P1-2 (sudah dicatat di bagian atas `design.md` per 2026-11-04) tidak bertentangan dengan temuan Task 1.2–1.6
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
  - [ ] 7.1 `finance:backfill-journals` (`--dry-run`, `--chunk`, `--limit`): kelompok per dokumen (`referenceable_type`, `referenceable_id`), dipecah per tanggal hanya bila dokumen punya posting di hari berbeda (D-8, 2026-11-04), jurnal legacy, `legacy_unbalanced`, panggil generate periode, rekonsiliasi sebelum/sesudah
    - _Requirements: 6.8, 9.1–9.9_
  - [ ]* 7.2 Write tests backfill
    - **P-7** Σ per akun sama sebelum/sesudah; idempoten (run dua kali); kelompok seimbang/tak seimbang/soft-deleted; resume setelah gagal di tengah; dry-run tidak menulis; pasangan satu dokumen yang beda detik tetap satu jurnal (N-3); dokumen dengan posting di dua hari berbeda menjadi dua jurnal (D-8)
    - **Validates: Requirements 9.1–9.8**
  - [ ] 7.3 `finance:reconcile-ledger` memakai `GeneralLedgerAuditor` (Fase 0) + pemeriksaan jurnal (a)–(d); jadwalkan harian di `routes/console.php`; kode keluar non-nol saat pelanggaran
    - _Requirements: 10.1–10.4_
  - [ ]* 7.4 Write tests reconcile: pelanggaran yang disuntikkan terdeteksi; data sehat lolos; `legacy_unbalanced` dilaporkan sebagai informasi
    - **Validates: Requirements 10.1–10.4**
  - [ ] 7.5 **(Manual, staging; setelah Rilis 1 dideploy ke staging, yaitu setelah merge ke `dev-1` — waktunya bergantung Q-BR-1)** `finance:backfill-journals --dry-run` → tinjau → jalankan nyata → bandingkan dengan baseline Fase 0 (`finance:snapshot-balances`); catat hasil di laporan
    - _Requirements: 9.8_

- [ ] 8. **(Dikunci pra-pemeriksaan, Rilis 1)** Konversi tipe kolom dan FK — D-3 disetujui 2026-11-04; tanpa jendela pemeliharaan (Q-P1-1)
  - [ ] 8.1 Pra-pemeriksaan presisi, dua bentuk: (a) **query SQL read-only yang dijalankan pemilik produk di staging sebelum Rilis 1 digabung ke `dev-1`** (praktik Task 6.5 Fase 0; query dan catatan verifikasinya di `design.md` Rilis 1 langkah 2: dua ambang `1e-9` dan `1e-5` karena ambang mutlak `1e-9` memberi positif palsu pada nilai besar), hasilnya dilaporkan ke pemilik produk; (b) **perintah artisan** (usulan nama `finance:check-ledger-precision`) dengan logika yang sama plus ukuran tabel, tetap dibuat untuk Rilis 2 dan seterusnya (tidak dapat dijalankan di staging sebelum Rilis 1 karena kode barunya tiba bersama migration 8.3)
    - _Requirements: 13.1_
  - [ ] 8.2 Selesaikan audit pemakai `debit`/`credit` (Task 1.3): perbaiki cast/format di PHP dan frontend yang terdampak string `decimal`; tambah test laporan terkait
    - _Requirements: 13.4_
  - [ ] 8.3 Migration terpisah: `against_account_id` nullable; `debit`/`credit` → `decimal(20,4)`; FK akun → `restrictOnDelete`; `down()` terdokumentasi; uji di SQLite dan pada salinan atau DB dev MySQL (staging baru tersedia setelah Rilis 1 dideploy); berisi pra-pemeriksaan presisi sebagai pengaman; Rilis 1 baru digabung ke `dev-1` setelah query 8.1(a) dijalankan pemilik produk di staging dan hasilnya dilaporkan; Bila query 8.1(a) menunjukkan `hit_ketat` > 0, ambang pengaman migration atau daftar pengecualian yang disetujui ditetapkan **oleh pemilik produk** sebelum Rilis 1 digabung ke `dev-1`, agar pengaman tidak menggagalkan deploy staging; mekanismenya di dalam migration (detail desain): ambang yang dapat dikonfigurasi (mis. konstanta atau config) dan/atau daftar pengecualian.
    - _Requirements: 1.3, 13.2, 13.3_

- [ ] 9. **(Rilis 2, PR/tahapan terpisah; BR-7)** `journal_id` NOT NULL — deploy produksi: tag `v*` mendeploy produksi, sedangkan `workflow_dispatch` punya input `environment` (staging atau produksi, default produksi; `deploy-cpanel.yml:15-28`) dan dapat dijalankan dari ref mana pun, sehingga urutan BR-7 juga berlaku untuk deploy manual (bukan `dev-1`; merge ke `dev-1` memicu deploy staging). Prasyarat sebelum PR Rilis 2 digabung ke `feat/finance-engine`: (a) Rilis 1 sudah dideploy ke produksi (tag `v*` atau dispatch manual ke produksi); (b) backfill produksi terverifikasi (dan staging); (c) pemeriksaan "nol baris aktif tanpa `journal_id`" diulang di staging dan produksi tepat sebelum penggabungan Rilis 2 ke `dev-1`
  - [ ] 9.1 Migration terpisah yang di dalamnya memeriksa nol baris aktif tanpa `journal_id` dan menolak jalan jika tidak (pengaman; urutan rilis dijaga oleh BR-7, bukan oleh pemeriksaan ini). Dikirim di PR/tahapan terpisah dari Rilis 1; tanpa jendela pemeliharaan (Q-P1-1, 2026-11-04)
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

- [ ]* 11. Jurnal manual (opsional; D-14 disetujui pemilik produk 2026-11-04 sebagai task opsional, cakupan dikonfirmasi sebelum dikerjakan)
  - [ ]* 11.1 Form jurnal manual (≥2 baris, indikator seimbang realtime) + `JournalController@store` → `JournalService::post()` + izin `create`
    - _Requirements: 12.1, 12.2_
  - [ ]* 11.2 Test: jurnal manual tidak seimbang ditolak; periode tertutup ditolak; dapat dibalik; tidak dapat diedit
    - **Validates: Requirements 12.2, 12.3**

- [ ] 12. Checkpoint akhir Fase 1
  - Jalankan `php artisan test --compact tests/Feature/Finances tests/Feature/Asset tests/Unit` dan test frontend yang disentuh (`npx vitest run <path>`)
  - Setelah semua task selesai: `vendor/bin/pint --dirty --format agent`, `npm run lint`, lalu `graphify update .`
  - Exit criteria **checkpoint kode** (dapat dipenuhi sebelum Rilis 1 dideploy): P-1…P-8 hijau; characterization Fase 0 hijau; test dan review selesai; PR Rilis 1 digabung ke `feat/finance-engine`; query presisi 8.1(a) dijalankan pemilik produk di staging dan hasilnya dilaporkan; Task 8 diputuskan (dijalankan atau ditunda dengan alasan tertulis); Task 11 (opsional) dikerjakan atau dilewati dengan alasan tertulis.
  - Exit criteria **checkpoint staging** (bergantung pada Q-BR-1, kapan Rilis 1 digabung ke `dev-1` dan dideploy ke staging): backfill staging selesai dengan laporan selisih nol (atau `legacy_unbalanced` terdokumentasi) (Task 7.5); `finance:reconcile-ledger` hijau di staging. Backfill produksi dan Task 9 (Rilis 2) bukan bagian PR Rilis 1; Task 9 dikerjakan sebagai Rilis 2 setelah backfill terverifikasi di staging dan produksi.
  - Ensure all tests pass, ask the user if questions arise.

## Catatan

- Seluruh `postingKey` memakai `purpose` baku: `default`, `stock`, `expense`, `depreciation`, `write_off`, `value_adjustment`, `disposal`, `reversal`. Daftar ini menjadi kontrak untuk Fase 2.
- Fase 2 menghapus pengecualian `Submitable` (soft-delete GL saat cancel) dan status `voided`; jangan membangun fitur baru yang bergantung pada `voided`.
- Jika Task 1.2–1.6 mengungkap asumsi design yang salah, perbarui `design.md` lebih dulu dan minta konfirmasi sebelum lanjut.
