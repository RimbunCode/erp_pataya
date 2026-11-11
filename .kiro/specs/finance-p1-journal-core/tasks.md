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
- F-10 (Payment kumulatif) dan N-4 (arah jurnal Payment) sudah diperbaiki oleh hotfix Payment Entry (2026-11-04); adapter Task 6.5 mempertahankan perilaku pasca-hotfix (arah, jumlah per pembayaran, guard status, alokasi jadwal), bukan perilaku lama. _Diselaraskan Task 1.1, 2026-11-04._

## Tasks

- [x] 1. Verifikasi asumsi desain (read-only)
  - [x] 1.1 Baca ulang `docs/prd/finance-engine-prd.md` (Lampiran A/B), `finance-audit-report.md`, dan `finance-decision-log.md` (hasil Fase 0); verifikasi bahwa keputusan D-3/D-4/D-8/D-14/Q-P1-1/Q-P1-2 (sudah dicatat di bagian atas `design.md` per 2026-11-04) tidak bertentangan dengan temuan Task 1.2–1.6
    - _Requirements: seluruh_
  - [x] 1.2 Cari semua penulisan/ubah/hapus `GeneralLedger` di `app/`, `database/seeders/`, `tests/` (`GeneralLedger::create|insert|where(...)->update|delete`, `generalLedgerEntries()->…`); daftar hasil menjadi allowlist test arsitektur
    - _Requirements: 4.1, 4.2, 4.6_
  - [x] 1.3 Inventarisasi pemakai kolom `debit`/`credit` (query mentah, view DB, laporan, `groupAggregate`, frontend) untuk Task 8
    - _Requirements: 13.4_
  - [x] 1.4 Tentukan mekanisme audit aplikasi (`Log` model / pencatat lain) dan cara memakainya dari service; hapus `[TODO]` Req. 14.2
    - _Requirements: 14.2_
  - [x] 1.5 Verifikasi mekanisme `FormatingSeries::generate()` (pendaftaran baris series untuk model baru, keamanan terhadap balapan); tentukan strategi kunci untuk `Journal.code`; hapus `[TODO]` di design
    - _Requirements: 1.6_
  - [x] 1.6 Verifikasi kontrak service setting Finances dari spec `module-settings-foundation` (cara menambah setting baru pada lingkungan berjalan, cara membacanya dari service/listener) dan pakai untuk `finance_enforce_fiscal_period`
    - _Requirements: 6.4_
  - Berkas berubah: `design.md` (bagian Hasil Verifikasi Task 1), `requirements.md` (Req 2.8, 5.5, 14.2; Q-P1-3 s.d. Q-P1-6), `tasks.md`.

- [x] 2. Migration, model, dan exception (aditif)
  - [x] 2.1 Migration `create_journals_table` (kolom sesuai Req. 1.1; indeks `transaction_date`, `(source_type, source_id)`, unik `posting_key`, unik `code`)
    - _Requirements: 1.1_
  - [x] 2.2 Migration `create_fiscal_years_table` dan `create_fiscal_periods_table`
    - _Requirements: 6.1_
  - [x] 2.3 Migration `add_journal_columns_to_general_ledgers_table` (`journal_id`, `line_no`, `foreign_*`, `exchange_rate`, indeks `(account_id, transaction_date)` dan `(journal_id, line_no)`) — aditif saja, belum mengubah tipe
    - _Requirements: 1.2_
  - [x] 2.4 Migration `add_minor_unit_to_currencies_table` + migration data ISO 4217 **lengkap** (daftar statis `Iso4217`, idempoten) dan pengisian oleh `CountrySeeder` (Q-P1-4, disetujui pemilik produk 2026-11-04)
    - _Requirements: 7.1, 7.2_
  - [x] 2.5 Buat `Journal`, `FiscalYear`, `FiscalPeriod` (trait `DataTable`, `HasUlids`, `permissions()`, `configColumns`, `translateKey`), enum `JournalStatus`, relasi `GeneralLedger::journal()`; tulis test yang menjalankan `initPermissions()` pada ketiga model dan memastikan tidak ada kolom tak terduga ditambah/dihapus (F-12)
    - _Requirements: 1.4, 1.5, 1.7, 14.1_
  - [x] 2.6 Buat 6 exception di `app/Exceptions/Finances/` dengan kunci pesan `finances.journal.*` di `lang/id` dan `lang/en`
    - _Requirements: 2.3–2.6, 3.2, 4.1, 5.4_
  - Berkas: migration `database/migrations/2026_11_04_100001`..`100007` (100005 `against_account_id` nullable dimajukan dari 8.3, 100007 setting `enforce_fiscal_period`); `app/Enums/JournalStatus.php`; `app/Exceptions/Finances/*` (6); `app/Models/Finances/{Journal,FiscalYear,FiscalPeriod}.php`; ubah `GeneralLedger.php`, `FinanceSetting.php`; `lang/{id,en}/finances/{journal,fiscalYear,fiscalPeriod}.php`; test `tests/Feature/Finances/Ledger/JournalSchemaTest.php`.

- [x] 3. Checkpoint - Skema
  - Jalankan migrasi pada DB uji (SQLite) dan, manual, pada MySQL dev; `php artisan test --compact tests/Feature/Finances` untuk memastikan test existing tetap hijau
  - Ensure all tests pass, ask the user if questions arise.
  - Dijalankan pada SQLite (`RefreshDatabase`): akhir Putaran A `tests/Feature/Finances` = 332 test hijau (hitungan reviewer independen; angka "395" pada laporan awal keliru karena menggabungkan `tests/Unit/Finances` dan `LogControllerTest`); setelah putaran perbaikan 2026-11-04: `tests/Feature/Finances` = 397 test hijau (2112 assertion; termasuk tes baru di `Ledger/`), plus `tests/Unit/Finances` dan `LogControllerTest` hijau. Uji migrasi di MySQL 8.0 dev dijalankan koordinator (batasan putaran: implementer tidak menulis ke DB dev); `down()` migration `100004` diperbaiki setelah galat 1553 di MySQL.

- [x] 4. Service inti (TDD: test lebih dulu)
  - [x] 4.1 `MinorUnit` (`round`, `toMinor`, `fromMinor`, batas nilai) + unit test (1.005, 0.125, nilai besar, minor unit 0)
    - _Requirements: 2.5, 7.3_
  - [x] 4.2 `FiscalPeriodService` (`resolve`, `assertOpen`, `generateYear` (menolak tahun non-kalender bernama sama), `close`, `open`, larangan tumpang-tindih; hari/periode dalam zona waktu perusahaan `CoreSetting.timezone`, Q-P1-5) + perintah `finance:generate-fiscal-year {year}` + test
    - _Requirements: 6.1–6.3, 6.5–6.7_
  - [x] 4.3 `JournalDraft`, `JournalLineDraft`, `JournalService::post()` dan `postPair()` (urutan langkah di design; idempotensi; kode series sesuai 1.5)
    - _Requirements: 2.1–2.10, 3.1–3.4_
  - [x]* 4.4 Write property-style tests `JournalService` _(Dikerjakan atas persetujuan pemilik produk: "semua task termasuk opsional", 2026-11-04.)_
    - **P-1** 1.000 draft acak valid (seimbang) diterima dan 1.000 tak seimbang ditolak (seed tetap); **P-2** kegagalan di baris ke-k tidak menyisakan data; **P-3** `postingKey` ganda; **P-8** enforcement aktif/mati terhadap periode closed/tak ada; akun group/disabled/terhapus; pasangan 0 → `null`
    - **Validates: Requirements 2.2–2.10, 3.1–3.2, 6.5–6.6**
  - [x] 4.5 Guard immutability `GeneralLedger` dan `Journal` (+ jalur backfill terizinkan) + test **P-5** (update/delete/forceDelete ditolak; update `journal_id`/`line_no` pada baris `journal_id` null diizinkan)
    - _Requirements: 4.1–4.3_
  - [x] 4.6 `JournalReversalService` + test **P-4** (net nol per akun, status, tautan dua arah, reversal ganda ditolak, jurnal legacy tak seimbang ditolak, periode tertutup ditolak, izin `reverse`)
    - _Requirements: 5.1–5.8_
  - [x] 4.7 Test arsitektur: pindai `app/` terhadap allowlist dari Task 1.2 (hanya `JournalService`, `JournalReversalService`, backfill yang menulis GL; pengecualian `Submitable` hook update massal didokumentasikan)
    - _Requirements: 4.5, 4.6_
  - Berkas: `app/Services/Finances/Ledger/{MinorUnit,JournalLineDraft,JournalDraft,NormalizedLine,NormalizedJournal,JournalDraftValidator,FiscalPeriodService,JournalService,JournalReversalService}.php`; `app/Console/Commands/Finances/GenerateFiscalYearCommand.php`; ubah `app/Listeners/Core/Audit/RecordAuditLog.php`, `lang/{id,en}/core/log.php`; test `tests/Unit/Finances/Ledger/{MinorUnitTest,JournalDraftValidatorTest}.php`, `tests/Feature/Finances/Ledger/{FiscalPeriodServiceTest,JournalServiceTest,LedgerImmutabilityTest,JournalReversalServiceTest,LedgerWriteAllowlistTest}.php`.

- [x] 5. Checkpoint - Service inti
  - Jalankan test Task 4; characterization Fase 0 masih hijau (belum ada adapter)
  - Ensure all tests pass, ask the user if questions arise.
  - Test Task 4 hijau; belum ada adapter sehingga characterization Fase 0 tidak berubah (seluruh `tests/Feature/Finances` hijau).

- [x] 6. Adapter 10 titik posting (satu rilis, urutan pengerjaan di bawah)
  - [x] 6.1 `PostSalesInvoiceGeneralLedger` → `postPair` + `postingKey` + tangani `DuplicatePostingException`
    - _Requirements: 8.1–8.4_
  - [x] 6.2 `PostPurchaseInvoiceGeneralLedger` → dua jurnal (`stock`, `expense`) dengan `postingKey` berbeda
    - _Requirements: 8.1–8.4_
  - [x] 6.3 `PostPurchaseReceiptGeneralLedger` → `postPair`
    - _Requirements: 8.1–8.4_
  - [x] 6.4 Alihkan `PostDeliveryNoteGeneralLedger` (pola sudah dibaca di Task 1.1: debit HPP, kredit stok, `isReturn` menukar sisi; periksa jalur rental)
    - _Requirements: 8.1–8.4_
  - [x] 6.5 `PaymentEntryService::onApproved` → `postPair` (perilaku pasca-hotfix: debit `accountPaidTo`, kredit `accountPaidFrom`, jumlah `paid_amount` PE itu; `PaymentEntryPostingTest` dan `PaymentEntryPartialPaymentTest` menjaga paritas)
    - _Requirements: 8.1, 8.2_
  - [x] 6.6 `StockEntryService` (GL + biaya tambahan) → `postPair`; `balance_amount` dibiarkan
    - _Requirements: 8.1, 8.2, 8.5_
  - [x] 6.7 Empat listener Asset (`PostDepreciationEntry`, `PostScrapWriteOff`, `PostValueAdjustmentEntry`, `PostAssetDisposalGainLoss`) → `postPair`; `purpose` Asset: `write_off` dan `disposal` diputuskan pemilik produk 2026-11-04 (Q-P1-6, ditutup; alasan tidak dinyatakan): scrap `Asset:{id}:write_off`; disposal dibedakan per baris invoice, `posting_key` = `Asset:{id}:disposal:{sales_invoice_item_id}` (tiap baris penjualan punya posting sendiri, baris yang sama tidak dapat diposting dua kali; verifikasi model baris `$event->line` yang tepat saat implementasi)
    - _Requirements: 8.1–8.4_
  - [x] 6.8 Hook `Submitable`: tandai jurnal sumber `voided` setelah update massal soft-delete + test untuk Sales Invoice, Payment Entry, Stock Entry
    - _Requirements: 8.6, 4.5_
  - [x] 6.9 Jalankan seluruh characterization Fase 0 (Payment kini dijaga `tests/Feature/Finances/PaymentEntryPostingTest` dan `PaymentEntryPartialPaymentTest` hasil hotfix; `Characterization/KnownIssues/` hanya F-04 bagian GL dan F-11) + test arsitektur 4.7 (kosongkan daftar `LEGACY_WRITERS` di `LedgerWriteAllowlistTest` seiring Task 6.1–6.7); selisih hanya boleh pada kasus pasangan 0 dan urutan `id` (dicatat eksplisit)
    - **P-6** parity
    - _Requirements: 8.2, 14.5_
    - **Catatan berkas Task 6 (Putaran B, 2026-11-04):** adapter: `app/Listeners/Finances/Ledger/{PostSalesInvoiceGeneralLedger,PostPurchaseInvoiceGeneralLedger}.php`, `app/Listeners/Purchase/Ledger/PostPurchaseReceiptGeneralLedger.php`, `app/Listeners/Inventory/Ledger/PostDeliveryNoteGeneralLedger.php`, `app/Services/Finances/PaymentEntryService.php`, `app/Services/Inventory/StockEntryService.php`, `app/Listeners/Asset/Depreciation/{PostDepreciationEntry,PostScrapWriteOff,PostValueAdjustmentEntry}.php`, `app/Listeners/Asset/Rental/PostAssetDisposalGainLoss.php`; hook `app/Traits/Submitable.php` (jurnal sumber `voided`); `JournalService::baseCurrency()` dibuat public. Test: `tests/Feature/Finances/Ledger/PostingAdaptersTest.php` (12 test), `LedgerImmutabilityTest` (asersi `voided`), `LedgerWriteAllowlistTest` (`LEGACY_WRITERS` dan test "tidak basi" dihapus; 28 test), fixture `tests/Support/BuildsFinanceFixtures.php` (seri `Journal` terdaftar default) serta tujuh test lama yang menyiapkan skema sendiri kini mendaftarkan seri `Journal` (`PaymentEntrySubmitTest`, `StockEntrySubmitTest`, `PostAssetDepreciationCommandTest`, `PurchaseInvoiceServiceFixedAssetDispatchTest`, dan lima test listener di `tests/Unit/Listeners/`, termasuk `PostDepreciationEntryTest` dan `PostValueAdjustmentEntryTest`). Selisih characterization (6.9): characterization Fase 0 dan test Payment Entry lulus tanpa mengubah ekspektasi; selisih yang dicatat hanya pasangan 0 (tanpa baris 0/0) dan urutan `id` (debit dulu); `purpose` `additional_cost:{id}` (Q-P1-9) dan `posting_key` berkelas penuh (Q-P1-10) disetujui pemilik produk 2026-11-04. **Putaran perbaikan (2026-11-04):** hook `Submitable` men-`voided` jurnal `posted` dan `reversed` (Minor-4); `StockEntryService::onApproved` dibungkus `DB::transaction` (rollback penuh bila `JournalService` menolak; test di `PostingAdaptersTest`); selisih paritas diizinkan hanya: pembulatan HALF_UP dan penolakan akun tidak valid/jumlah negatif (I-2); `seriesMissing` hilang (seri dibuat otomatis, keputusan A) dan normalisasi UTC adalah pengaman defensif turunan Req 6.9; test parity nilai pecahan (99.9999 menjadi 100.00). **Putaran perbaikan kedua dan ketiga (2026-11-04):** seri `Journal` dibuat otomatis (`FormatingSeries::ensureExists()`, `Journal::ensureNumberingSeries()`; jalur seeding `ensureFor()` dengan perilaku lama; jalur posting tidak pernah menulis pada seri yang ada); `InvalidJournalException::seriesMissing()` dan kunci `series_missing` dihapus; berkas: `app/Models/Core/FormatingSeries.php`, `app/Traits/DataTable.php`, `app/Models/Finances/Journal.php`, `app/Services/Finances/Ledger/{JournalService,JournalBackfillService}.php`, `app/Exceptions/Finances/InvalidJournalException.php`, `lang/{en,id}/finances/journal.php`, test `JournalServiceTest`, `JournalBackfillTest`.

- [-] 7. Backfill dan rekonsiliasi (7.1–7.4 selesai; 7.5 manual di staging menunggu Rilis 1 dideploy)
  - [x] 7.1 `finance:backfill-journals` (`--dry-run`, `--chunk`, `--limit`): kelompok per dokumen (`referenceable_type`, `referenceable_id`), dipecah per tanggal **dalam zona waktu perusahaan (`CoreSetting.timezone`, dihitung di PHP lewat `FiscalPeriodService::businessDay()`; Q-P1-5, 2026-11-04)** hanya bila dokumen punya posting di hari berbeda (D-8, 2026-11-04), jurnal legacy, `legacy_unbalanced`, panggil generate periode, rekonsiliasi sebelum/sesudah
    - _Requirements: 6.8, 9.1–9.9_
  - [x]* 7.2 Write tests backfill _(Dikerjakan atas persetujuan pemilik produk: "semua task termasuk opsional", 2026-11-04.)_
    - **P-7** Σ per akun sama sebelum/sesudah; idempoten (run dua kali); kelompok seimbang/tak seimbang/soft-deleted; resume setelah gagal di tengah; dry-run tidak menulis; pasangan satu dokumen yang beda detik tetap satu jurnal (N-3); dokumen dengan posting di dua hari berbeda menjadi dua jurnal (D-8)
    - **Validates: Requirements 9.1–9.8**
  - [x] 7.3 `finance:reconcile-ledger` memakai `GeneralLedgerAuditor` (Fase 0) + pemeriksaan jurnal (a)–(d); jadwalkan harian di `routes/console.php`; kode keluar non-nol saat pelanggaran
    - _Requirements: 10.1–10.4_
  - [x]* 7.4 _(Dikerjakan atas persetujuan pemilik produk: "semua task termasuk opsional", 2026-11-04.)_ Write tests reconcile: pelanggaran yang disuntikkan terdeteksi; data sehat lolos; `legacy_unbalanced` dilaporkan sebagai informasi
    - **Validates: Requirements 10.1–10.4**
  - [ ] 7.5 **(Manual, staging; setelah Rilis 1 dideploy ke staging, yaitu setelah merge ke `dev-1` — waktunya bergantung Q-BR-1)** `finance:backfill-journals --dry-run` → tinjau → jalankan nyata → bandingkan dengan baseline Fase 0 (`finance:snapshot-balances`); catat hasil di laporan
    - _Requirements: 9.8_
    - **Catatan berkas Task 7 (Putaran B, 2026-11-04):** `app/Services/Finances/Ledger/{JournalBackfillService,LedgerReconciliationService}.php`, `app/Console/Commands/Finances/{BackfillJournalsCommand,ReconcileLedgerCommand}.php`, `routes/console.php` (jadwal harian 03:00 Asia/Jakarta, `withoutOverlapping`), test `tests/Feature/Finances/Ledger/{JournalBackfillTest,LedgerReconciliationTest}.php`. Keputusan Q-P1-7 sampai Q-P1-12, I-1, I-2, Minor-4, A, B (semuanya disetujui pemilik produk 2026-11-04; A dan B juga menyentuh Task 6 dan 7.5) ada di `requirements.md`. **Putaran perbaikan (2026-11-04):** backfill juga memproses baris soft-deleted menjadi jurnal legacy `voided` (dipisah dari baris aktif; I-1; test di `JournalBackfillTest`), pemeriksaan (c) reconcile memeriksa semua baris, jadwal `finance:reconcile-ledger` memakai `--ignore-unjournaled` di Rilis 1 (Q-P1-11).
    - **Prosedur Task 7.5 (manual, staging; jangan dijalankan implementer):** (1) seri `Journal` dibuat otomatis oleh backfill/`JournalService` (keputusan A, 2026-11-04), tidak perlu seeder sebagai prasyarat; (2) `php artisan finance:snapshot-balances` (baseline Fase 0) bila belum ada; (3) `php artisan finance:backfill-journals --dry-run`, tinjau ringkasan (jurnal, baris, `legacy_unbalanced`, rentang tahun fiskal); (4) `php artisan finance:backfill-journals` (aman diulang; `--limit`/`--chunk` untuk bertahap); (5) pastikan laporan "Σdebit/Σkredit per akun sama sebelum dan sesudah" dan exit code 0, bandingkan dengan baseline; (6) `php artisan finance:reconcile-ledger` harus hijau (sebelum langkah 4 gunakan `--ignore-unjournaled`); (7) **cabut `--ignore-unjournaled` dari jadwal** di `routes/console.php` (Q-P1-11, keputusan pemilik produk 2026-11-04; paling lambat di Rilis 2), lalu pastikan reconcile hijau tanpa opsi itu; catat hasil di laporan. **Jalankan langkah 3–5 di luar jam transaksi** (Σ sebelum/sesudah atas seluruh tabel; posting baru di antaranya tampak sebagai selisih palsu). Baris soft-deleted kini ikut di-backfill sebagai jurnal `voided` (I-1); setelah langkah 4, `rows_without_journal` aktif dan soft-deleted harus nol.

- [ ] 8. **(Dikunci pra-pemeriksaan, Rilis 1)** Konversi tipe kolom dan FK — D-3 disetujui 2026-11-04; tanpa jendela pemeliharaan (Q-P1-1)
  - [ ] 8.1 Pra-pemeriksaan presisi, dua bentuk: (a) **query SQL read-only yang dijalankan pemilik produk di staging sebelum Rilis 1 digabung ke `dev-1`** (praktik Task 6.5 Fase 0; query dan catatan verifikasinya di `design.md` Rilis 1 langkah 2: dua ambang `1e-9` dan `1e-5` karena ambang mutlak `1e-9` memberi positif palsu pada nilai besar), hasilnya dilaporkan ke pemilik produk; (b) **perintah artisan** (usulan nama `finance:check-ledger-precision`) dengan logika yang sama plus ukuran tabel, tetap dibuat untuk Rilis 2 dan seterusnya (tidak dapat dijalankan di staging sebelum Rilis 1 karena kode barunya tiba bersama migration 8.3)
    - _Requirements: 13.1_
  - [x] 8.2 Selesaikan audit pemakai `debit`/`credit` (Task 1.3): perbaiki cast/format di PHP dan frontend yang terdampak string `decimal`; tambah test laporan terkait
    - _Requirements: 13.4_
  - [x] 8.3 Migration terpisah: (`against_account_id` nullable sudah dimajukan ke Task 2, migration `..._100005`; **disetujui pemilik produk 2026-11-04, Q-P1-3**, jadi tidak dikerjakan lagi di sini) `debit`/`credit` → `decimal(20,4)`; FK akun → `restrictOnDelete`; `down()` terdokumentasi; uji di SQLite dan pada salinan atau DB dev MySQL (staging baru tersedia setelah Rilis 1 dideploy); berisi pra-pemeriksaan presisi sebagai pengaman; Rilis 1 baru digabung ke `dev-1` setelah query 8.1(a) dijalankan pemilik produk di staging dan hasilnya dilaporkan; Bila query 8.1(a) menunjukkan `hit_ketat` > 0, ambang pengaman migration atau daftar pengecualian yang disetujui ditetapkan **oleh pemilik produk** sebelum Rilis 1 digabung ke `dev-1`, agar pengaman tidak menggagalkan deploy staging; mekanismenya di dalam migration (detail desain): ambang yang dapat dikonfigurasi (mis. konstanta atau config) dan/atau daftar pengecualian.
    - _Requirements: 1.3, 13.2, 13.3_
    - **Catatan berkas Task 8 (Putaran C, 2026-11-11):** `app/Services/Finances/Audit/{LedgerPrecisionChecker,AmountColumns}.php`, `app/Console/Commands/Finances/CheckLedgerPrecisionCommand.php`, `config/finance.php` (`ledger_precision_guard_threshold`, **default 1e-9 sesuai Req 13.1**; pelonggaran hanya oleh pemilik produk), migration `..._100008` (konversi per kolom sehingga aman dilanjutkan bila terhenti di antara dua `ALTER`; menolak nilai >= 1e16), test `LedgerPrecisionTest`, `DecimalAmountReportTest`, `GroupNodeQueryDecimalTest`. Migration sudah diuji di MySQL dev (naik, turun, naik lagi; skema `decimal(20,4)` dan FK `RESTRICT` terverifikasi). **8.1(a) masih menunggu hasil query pemilik produk di staging; penggabungan ke `dev-1` tetap terkunci olehnya.**

- [ ] 9. **(Rilis 2, PR/tahapan terpisah; BR-7)** `journal_id` NOT NULL — deploy produksi: tag `v*` mendeploy produksi, sedangkan `workflow_dispatch` punya input `environment` (staging atau produksi, default produksi; `deploy-cpanel.yml:15-28`) dan dapat dijalankan dari ref mana pun, sehingga urutan BR-7 juga berlaku untuk deploy manual (bukan `dev-1`; merge ke `dev-1` memicu deploy staging). Prasyarat sebelum PR Rilis 2 digabung ke `feat/finance-engine`: (a) Rilis 1 sudah dideploy ke produksi (tag `v*` atau dispatch manual ke produksi); (b) backfill produksi terverifikasi (dan staging); (c) pemeriksaan "nol baris tanpa `journal_id`" (**termasuk baris soft-deleted**, I-1) diulang di staging dan produksi tepat sebelum penggabungan Rilis 2 ke `dev-1`
  - [ ] 9.1 Migration terpisah yang di dalamnya memeriksa nol baris tanpa `journal_id` (**semua baris, termasuk soft-deleted**; backfill kini mengubah baris soft-deleted menjadi jurnal `voided`, I-1, 2026-11-04) dan menolak jalan jika tidak (pengaman; urutan rilis dijaga oleh BR-7, bukan oleh pemeriksaan ini). Dikirim di PR/tahapan terpisah dari Rilis 1; tanpa jendela pemeliharaan (Q-P1-1, 2026-11-04)
    - _Requirements: 13.5_
    - **Pencabutan opsi jadwal (Q-P1-11, 2026-11-04):** sebelum atau bersamaan dengan Rilis 2, cabut `['--ignore-unjournaled']` dari `Schedule::command('finance:reconcile-ledger', ...)` di `routes/console.php` (dan sesuaikan `LedgerReconciliationTest::test_command_is_scheduled_daily`), agar pemeriksaan (c) kembali menjadi kegagalan.

- [x] 10. Antarmuka pengguna
  - [x] 10.1 `JournalController` (`index`, `show`, `reverse`) + `FiscalPeriodController` + rute (`Route::resourceDetail('journals', …)` mengikuti pola `generalLedger` di `routes/web.php`) + izin di seeder
    - _Requirements: 11.1, 11.2, 11.4, 14.1_
  - [x] 10.2 Halaman `Finances/Journals/Index.jsx` dan `Show.jsx` (header, tabel baris, total, indikator seimbang, tautan sumber/asal/pembalik, dialog Balik) — ikuti pola `Finances/GeneralLedger.jsx` dan `GeneralLedgers/Show.jsx`; test `.rtl.test.jsx`
    - _Requirements: 11.1, 11.2, 11.7_
    - **Keputusan 2026-11-12 (Q-P1-14, pemilik produk):** dialog Balik mewajibkan alasan dan membatasi tanggal (tidak sebelum tanggal jurnal asal, tidak di masa depan, zona waktu perusahaan); batas dan default dikirim server. Dikerjakan di PR terpisah dari Putaran C.
  - [x] 10.3 Halaman `Finances/FiscalPeriods/Index.jsx` (daftar, generate tahun, buka/tutup, toggle enforcement + peringatan); test `.rtl.test.jsx`
    - _Requirements: 11.4, 11.5, 11.7_
  - [x] 10.4 Perbarui halaman General Ledger: kolom `Journal` (tautan) dan "Beberapa akun" untuk `against_account_id` null; perbarui `GeneralLedger::$configColumns`; sesuaikan `Show.rtl.test.jsx` yang ada
    - _Requirements: 11.3_
  - [x] 10.5 Kunci terjemahan `lang/id` dan `lang/en` (jurnal, periode, exception, menu); pastikan `LocaleKeysTest` hijau; daftarkan item menu/desk sesuai mekanisme project
    - _Requirements: 11.6_
    - **Catatan berkas Task 10 (Putaran C, 2026-11-11):** `JournalController` (`index`, `show`, `reverse`; rute eksplisit, bukan `resourceDetail`, agar tidak ada permukaan tulis yang tidak dipakai), `FiscalPeriodController` (rute di bawah `settings/fiscalPeriods`), FormRequest `JournalReverseRequest`/`FiscalPeriodStatusRequest`/`FiscalYearGenerateRequest`/`FiscalEnforcementRequest`, halaman `Finances/Journals/*` dan `Finances/FiscalPeriods/Index.jsx`, perubahan `GeneralLedgers/{Form,Show}.jsx`, `DeskSeeder` (menu Journals dan Fiscal Periods), lang id/en. Diverifikasi di browser (daftar, detail, Balik, tutup/buka periode) pada DB dev.

- [x]* 11. Jurnal manual dengan approval (opsional; D-14 disetujui 2026-11-04, cakupan dikonfirmasi pemilik produk 2026-11-07: **dengan approval**, Q-P1-13: dokumen `JournalVoucher` tersendiri)
  - [x]* 11.1 `JournalVoucher` + item (model, migration, factory, izin `create`/`submit`/`cancel`, penomoran, submitable memakai modul Approval) mengikuti pola dokumen submitable yang ada; `Journal` tidak mendapat status draft
    - _Requirements: 12.1, 12.2, 12.5_
  - [x]* 11.2 Form Journal Voucher (tanggal, deskripsi, ≥2 baris akun/debit/kredit/keterangan, indikator seimbang waktu nyata); setelah disetujui, posting lewat `JournalService::post()` dengan `posting_key` `{FQCN JournalVoucher}:{id}:default`; sebelum disetujui, ditolak, atau dibatalkan sebelum disetujui tidak ada jurnal/baris GL; batal setelah posting membalik/mem-void jurnalnya (Req 8.6)
    - _Requirements: 12.1, 12.3, 12.5_
  - [x]* 11.3 Test: tidak seimbang ditolak; periode tertutup ditolak; approval memicu posting tepat sekali (idempoten); ditolak/dibatalkan tidak memposting; jurnal hasilnya dapat dibalik dan tidak dapat diedit
    - **Validates: Requirements 12.2, 12.3, 12.5**
    - **Keputusan 2026-11-12 (Q-P1-15, pemilik produk):** izin `create` hanya pada `JournalVoucher` (Req 14.1 diubah); approval yang sudah `approved` tetapi gagal posting dibiarkan seperti dokumen submitable lain (perbaikan lintas modul untuk fase berikutnya); amend dibatasi di server ke status `canceled`/`rejected`.
    - **Catatan berkas Task 11 (2026-11-12):** migration `2026_11_11_100001/100002` (`journal_vouchers`, `journal_voucher_items`), model `JournalVoucher`/`JournalVoucherItem` (flat di `app/Models/Finances/`, relasi baris `items()`), factory, `JournalVoucherService`, `JournalVoucherController`, `JournalVoucherRequest`, rute `resourceDetail('journalVoucher', ..., isSubmmitable: true)`, `DeskSeeder` (menu Journal Vouchers), lang id/en `finances/journalVoucher.php`, halaman `Finances/JournalVouchers/{Index,Show,Form}.jsx` + `balance.js`, test `tests/Feature/Finances/JournalVoucherFlowTest.php` (18 test), `balance.test.js` dan `Form.rtl.test.jsx` (16 test), daftar registri `SubmitableServicePropertyTest`/`SubmitableServiceContractTest`, dan `JournalSchemaTest` (initPermissions no-op). Detail desain: bagian "Journal Voucher" di `design.md`. `DocumentCoverageMatrix` (audit Fase 0) sengaja tidak diubah.

- [ ] 12. Checkpoint akhir Fase 1
  - Jalankan `php artisan test --compact tests/Feature/Finances tests/Feature/Asset tests/Unit` dan test frontend yang disentuh (`npx vitest run <path>`)
  - Setelah semua task selesai: `vendor/bin/pint --dirty --format agent`, `npm run lint`, lalu `graphify update .`
  - Exit criteria **checkpoint kode** (dapat dipenuhi sebelum Rilis 1 dideploy): P-1…P-8 hijau; characterization Fase 0 hijau; test dan review selesai; PR Rilis 1 digabung ke `feat/finance-engine`; query presisi 8.1(a) dijalankan pemilik produk di staging dan hasilnya dilaporkan; Task 8 diputuskan (dijalankan atau ditunda dengan alasan tertulis); Task 11 (opsional) dikerjakan atau dilewati dengan alasan tertulis.
  - Exit criteria **checkpoint staging** (bergantung pada Q-BR-1, kapan Rilis 1 digabung ke `dev-1` dan dideploy ke staging): backfill staging selesai dengan laporan selisih nol (atau `legacy_unbalanced` terdokumentasi) (Task 7.5); `finance:reconcile-ledger` hijau di staging. Backfill produksi dan Task 9 (Rilis 2) bukan bagian PR Rilis 1; Task 9 dikerjakan sebagai Rilis 2 setelah backfill terverifikasi di staging dan produksi.
  - Ensure all tests pass, ask the user if questions arise.

## Catatan

- Seluruh `postingKey` memakai `purpose` baku: `default`, `stock`, `expense`, `depreciation`, `write_off`, `value_adjustment`, `disposal`, `reversal`, ditambah pola berparameter `additional_cost:{id}` (id baris biaya tambahan Stock Entry; Q-P1-9) dan `disposal:{sales_invoice_item_id}` (Q-P1-6). `posting_key` = `{FQCN model sumber}:{id}:{purpose}` (Q-P1-10, tidak ada `morphMap`). Daftar ini menjadi kontrak untuk Fase 2. Pengecualian (Q-P1-6, pemilik produk 2026-11-04): `disposal` Asset memakai sufiks id baris invoice, yaitu `Asset:{id}:disposal:{sales_invoice_item_id}`.
- Fase 2 menghapus pengecualian `Submitable` (soft-delete GL saat cancel) dan status `voided`; jangan membangun fitur baru yang bergantung pada `voided`. Backfill (I-1) juga membuat jurnal legacy `voided` dari baris soft-deleted; Fase 2 perlu memutuskan nasib jurnal itu saat `voided` dihapus.
- Jika Task 1.2–1.6 mengungkap asumsi design yang salah, perbarui `design.md` lebih dulu dan minta konfirmasi sebelum lanjut.
- Catatan Task 4.3: `JournalService::postPair()` mengembalikan `null` bila jumlah 0 setelah pembulatan (Req. 2.10); ini bagian dari kontrak adapter Task 6 (N-8/PB-14 mengacu Req. 2.10).
