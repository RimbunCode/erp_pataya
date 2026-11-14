# Implementation Plan: Finance P2 — Posting Engine

## Overview

Urutan: fondasi data dan resolver (1–3), kontrak + rule + service + gateway dengan test (4–5), UI profil (6), migrasi per jenis dokumen di balik mode `off/shadow/on` (7–9), lalu bagian GATED (sakelar eksekusi — D-1; pembatalan reversal — D-13), akun tanpa input pengguna dan aturan bersyarat (12), posting diskon GATED (13), dan pembersihan legacy (14). **Semua mode default `off`**: merge tidak mengubah perilaku sampai ada keputusan eksplisit per jenis dokumen. Lint/Pint dijalankan sekali di akhir.

**Prasyarat**: Fase 1 selesai (JournalService, adapter, backfill, reconcile hijau); characterization Fase 0 + test Fase 1 hijau; service setting Finances dari spec `module-settings-foundation` tersedia (D-25). Branch baru dari `origin/feat/finance-engine` terbaru (BR-6, PRD Bagian 10).

**Aturan eksekusi**:
- Task 10 (sakelar eksekusi) dan Task 11 (reversal saat cancel) **GATED**: kerjakan hanya setelah D-1 / D-13 terjawab.
- Task 13 (posting diskon) **GATED**: kerjakan hanya setelah Q-P2-5 terjawab akuntan; mengubah bentuk jurnal sehingga hanya aktif lewat tanggal cutover.
- Task 12 dikerjakan per jenis dokumen **setelah** jenis itu berada pada mode `on`; field akun pada form tidak dihapus sebelum itu.
- Perpindahan ke mode `on` adalah **keputusan pemilik produk**, bukan bagian dari menyelesaikan task; task hanya menyiapkan dan membuktikan parity.
- Sebelum menulis rule untuk Stock Entry, scrap, value adjustment, dan disposal, baca penuh kode sumbernya (tanda `[TODO]` di design) dan perbarui tabel peta rule.
- Jangan memperbaiki F-10 diam-diam; ikuti keputusan Q-P2-3.

## Tasks

- [ ] 1. Verifikasi dan persiapan
  - [x] 1.1 Baca penuh `StockEntryService` (~540–650, semua jenis stock entry), `PostScrapWriteOff`, `PostValueAdjustmentEntry`, `PostAssetDisposalGainLoss`; lengkapi tabel peta rule di `design.md` dan hapus `[TODO]`
    - _Requirements: 4.3, 7.4_
  - [x] 1.2 Inventarisasi kolom akun per-dokumen (`*_account_id` di Sales/Purchase Invoice, Payment Entry, Stock Entry, Additional Cost, Asset Value Adjustment), field form dan request validasinya yang akan dihapus (Req. 13), serta tabel item yang perlu kolom `posted_account_id`; catat juga akun master (`PaymentMethod.default_account_id`, `AssetCategoryAccount`)
    - _Requirements: 3.1, 13.1–13.3_
  - [ ] 1.3 Audit COA aktual vs `account_type` yang dibutuhkan peran (jalankan `init-posting-profile` dalam mode laporan pada salinan data staging); catat peran ambigu/hilang untuk akuntan
    - _Requirements: 2.5_

- [ ] 2. Enum, kontrak, dan model data
  - [x] 2.1 Enum `PostingDocumentType`, `AccountRole` (+ `legacyPair()`), DTO `PostingContext`, `RoleJournalDraft`, `RoleLine`, kontrak `PostingRule`; label peran di `lang/id` & `lang/en`
    - _Requirements: 1.1–1.4, 4.1–4.2_
  - [x] 2.2 Migration `create_posting_profiles_table`, `create_posting_profile_accounts_table`, `create_posting_profile_rules_table`, `create_posting_parity_logs_table`; model `PostingProfile`, `PostingProfileAccount`, `PostingProfileRule`, `PostingParityLog` (izin, `configColumns`, `translateKey`); `config/finance.php`
    - Catatan: izin `switch_posting_mode` (Req. 11.3) sengaja belum didaftarkan di Sprint A; didaftarkan pada Task 5.1 bersama `PostingModeService`.
    - _Requirements: 2.1, 6.6, 11.2–11.3, 12.1_
  - [x] 2.3 Test `initPermissions()` pada model baru (tidak menambah/menghapus kolom tak terduga)
    - _Requirements: 11.2_
  - [x] 2.4 Exception: `UnresolvedAccountRoleException`, `InvalidPostingProfileException`, `UnknownPostingDocumentTypeException`, `PartialPostingException` (+ kunci pesan)
    - _Requirements: 3.2, 5.4, 5.6_

- [ ] 3. Profil dan resolver
  - [x] 3.1 `PostingProfileService` (profil global; validasi akun non-group/aktif, larangan tumpang-tindih, buat versi baru/salin termasuk aturan, aktivasi, retire; validasi aturan: duplikat kondisi, kondisi barang hanya untuk peran peka-barang) + test
    - _Requirements: 2.2–2.4, 12.5–12.6_
  - [x] 3.2 Perintah `finance:init-posting-profile` (laporkan peran tak ter-resolve & ambiguitas; idempoten; tidak menebak saat ambigu) + test
    - _Requirements: 2.5_
  - [x] 3.3 `AccountRoleResolver` (master → aturan bersyarat → default profil → legacy; cache per instance, validasi akun, peringatan legacy/ambiguitas) memakai `AccountRuleMatcher` 
    - _Requirements: 3.1–3.6_
  - [x]* 3.4 Write tests resolver
    - **P-3** deterministik; urutan master > aturan bersyarat > default > legacy; fallback legacy dimatikan konfig; akun group/disabled ditolak; profil efektif berdasarkan tanggal; cache tidak melintasi job
    - **Validates: Requirements 3.1–3.5**
  - [x] 3.5 `AccountRuleMatcher` (kondisi non-null, spesifisitas, `priority`, varian retur dengan fallback ke normal) + `AccountRole::isLineSensitive()`
    - _Requirements: 12.2–12.4_
  - [x]* 3.6 Write tests matcher
    - **P-10** spesifisitas deterministik (acak urutan simpan); **P-11** retur tanpa aturan khusus = akun normal (separuh "sisi ditukar" belum dapat diuji karena `PostingRule` belum ada; ditunda ke Task 4.3)
    - **Validates: Requirements 12.2–12.3**

- [x] 4. Rule dan PostingService
  - [x] 4.1 `PostingRuleRegistry` + rule untuk 6 jenis yang sudah jelas bentuknya: Sales Invoice, Purchase Invoice (dua `purpose`), Purchase Receipt, Delivery Note, Payment Entry, Asset depreciation
    - _Requirements: 4.2–4.3, 4.6_
  - [x] 4.2 Rule untuk Stock Entry, Asset scrap, value adjustment, disposal (setelah Task 1.1)
    - _Requirements: 4.3_
  - [x]* 4.3 Write unit tests setiap rule (tanpa DB; **P-2**; **P-11** bagian "sisi ditukar": retur tanpa aturan khusus memakai akun normal dengan sisi debit/kredit ditukar): normal, retur, jumlah 0, `stock_total` 0, akun master, baris peka-barang (gabung per akun, **P-12**)
    - **Validates: Requirements 4.3, 4.6**
  - [x] 4.4 `PostingService::preview()` dan `post()` (idempotensi, `PartialPostingException`, guard dokumen `canceled`)
    - _Requirements: 5.1–5.6_
  - [x]* 4.5 Write tests `PostingService`
    - **P-4** idempoten; sebagian ada → exception; atomik multi-jurnal (kegagalan jurnal ke-2 menggulung ke-1)
    - **Validates: Requirements 5.2–5.4**
  - [x] 4.6 Test arsitektur: tidak ada `use` terlarang pada `Posting/**` dan `Ledger/**` (**P-8**)
    - _Requirements: 4.4_

- [ ] 5. Gateway, mode, dan parity
  - [x] 5.1 `PostingModeResolver` (cache 60 dtk) + `PostingModeService::switch()` (izin `switch_posting_mode`, audit, invalidasi cache); seed setting Finances default `off` lewat service setting (`module-settings-foundation`); daftarkan juga izin `switch_posting_mode` (Req. 11.3; ditunda dari Task 2.2)
    - _Requirements: 6.1, 6.8_
  - [x] 5.2 `ParityComparator` (kanonisasi per `purpose`, `match/rounding/config_diff/mismatch`) + test unit
    - _Requirements: 6.5–6.6_
  - [x] 5.3 `PostingGateway` (guard cancel semua mode; `off/shadow/on`; engine error di `shadow` ditelan) 
    - _Requirements: 6.2–6.4, 10.5, 10.6_
  - [x]* 5.4 Write tests gateway
    - **P-5** mode aman; **P-6** guard cancel pada tiga mode; `GlPostingStatus` menjadi `skipped` bila pending
    - **Validates: Requirements 6.2–6.4, 10.5, 10.6**
  - [x] 5.5 Perintah `finance:parity-report {--type=} {--since=}` dan `finance:prune-parity-logs`
    - _Requirements: 6.7, 11.4_
  - [ ] 5.6 Checkpoint - jalankan semua test Fase 0–2 pada mode `off`
    - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Antarmuka Posting Profile dan Parity
  - [x] 6.1 `PostingProfileController` + rute + izin; halaman `Finances/PostingProfiles/{Index,Form}.jsx` (tabel peran → akun default, salin versi, aktifkan, peringatan peran belum terpetakan; tanpa cakupan cabang; didaftarkan sebagai menu item grup setting di desk Core dan Finances); `.rtl.test.jsx`
    - _Requirements: 8.1–8.2, 8.4_
  - [x] 6.2 Halaman Parity Log + kontrol ubah mode per jenis dokumen (izin khusus); `.rtl.test.jsx`
    - _Requirements: 8.3–8.4_
  - [x] 6.3 Kunci terjemahan `lang/id` & `lang/en`; `LocaleKeysTest` hijau; item menu/desk
    - _Requirements: 8.4_

- [ ] 7. Migrasi jenis dokumen — kelompok 1 (Asset, Payment)
  - [x] 7.1 `AssetPostingContextFactory` (akun master dari `AssetCategoryAccount`) + ubah 4 listener Asset memakai `PostingGateway` (closure legacy = kode Fase 1)
    - _Requirements: 7.1, 7.4_
  - [x] 7.2 `PaymentEntryPostingContextFactory` + ubah `PaymentEntryService::onApproved` memakai gateway (nilai tetap seperti jalur lama; ikuti keputusan Q-P2-3 untuk F-10)
    - _Requirements: 7.1, 7.4_
  - [x]* 7.3 Write parity test end-to-end kelompok 1 pada tiga mode
    - **P-1** hasil identik pada `off`, `shadow`, `on`
    - **Validates: Requirements 7.2, 11.5**
  - [ ] 7.4 **(Manual, staging)** Set `shadow` untuk kelompok 1, kumpulkan parity (≥200 dokumen atau 14 hari), laporkan ke pemilik produk; **tunggu keputusan** sebelum `on`
    - _Requirements: 7.2_

- [ ] 8. Migrasi jenis dokumen — kelompok 2 (inventori dan penjualan/pembelian)
  - [x] 8.1 Purchase Receipt dan Delivery Note: pabrik konteks + gateway
    - _Requirements: 7.1, 7.4_
  - [x] 8.2 Sales Invoice dan Purchase Invoice: pabrik konteks (bawa baris beratribut barang; tidak membaca kolom akun dokumen) + gateway; Purchase Invoice menghasilkan dua jurnal
    - _Requirements: 7.1, 7.4_
  - [x] 8.3 Stock Entry: pabrik konteks + gateway; `balance_amount` tidak dimutasi engine
    - _Requirements: 7.1, 7.5_
  - [x]* 8.4 Write parity test end-to-end kelompok 2 pada tiga mode
    - **P-1** identik; kasus retur; Purchase Invoice stok & non-stok
    - **Validates: Requirements 7.2, 11.5**
  - [ ] 8.5 **(Manual, staging)** Shadow & laporan parity per jenis; tunggu persetujuan `on`
    - _Requirements: 7.2_

- [x] 9. Pengerasan dan kinerja
  - [x] 9.1 Ukur overhead engine vs jalur lama (benchmark seed data; batas 25%) dan optimasi resolver bila perlu
    - _Requirements: 11.1_
  - [x] 9.2 Uji statik **P-9**: self-check detektor (mengenali pola `where('account_type'` di jalur yang masih memuat closure legacy, mengabaikan komentar) dan, untuk jenis dokumen pada daftar `on` dari konfigurasi uji (kosong sampai Task 14.1), pola tidak muncul di jalurnya; penegakan penuh setelah Task 14.1 (Q-P2-19)
    - _Requirements: 7.3_

- [ ] 10. **(GATED D-1)** Sakelar eksekusi queue/inline
  - [ ] 10.1 Setting `finance_posting_execution.{type}` + jalur `inline` (transaksi dokumen, `GlPostingStatus` langsung `posted`) untuk jenis yang diizinkan (Payment, Asset); tolak `inline` untuk jenis terjalin stok
    - _Requirements: 9.2–9.4_
  - [ ]* 10.2 Write tests: kegagalan inline membatalkan transaksi dokumen; sakelar dapat dibalik tanpa deploy
    - **Validates: Requirements 9.3, 9.5**

- [ ] 11. **(GATED D-13)** Pembatalan sebagai reversal
  - [ ] 11.1 `DocumentCancellationLedgerService` + setting `finance_cancel_mode` (`soft_delete` default / `reversal`); ubah hook `Submitable` mendelegasikan bagian GL (SLE tetap di-soft-delete)
    - _Requirements: 10.2–10.4_
  - [ ] 11.2 Penanganan periode tertutup (reversal pada periode terbuka; tolak bila tak ada) dan pesan pengguna
    - _Requirements: 10.7_
  - [ ]* 11.3 Write tests
    - **P-7** reversal bersih untuk Sales Invoice, Payment Entry, Stock Entry; kedua mode; cancel sebelum posting queued → `skipped`
    - **Validates: Requirements 10.2–10.6**
  - [ ] 11.4 Audit laporan yang memfilter GL aktif/`deleted_at` untuk dampak reversal (D-13 konsekuensi 3); catat hasil di decision log
    - _Requirements: 10.2_

- [ ] 12. Akun tanpa input pengguna dan aturan bersyarat (per jenis dokumen yang sudah `on`)
  - [ ] 12.1 Migration `posted_account_id` pada tabel item terkait; engine menulis balik akun yang dipakai ke kolom catatan (header dan baris) dalam transaksi posting
    - _Requirements: 13.2_
  - [ ] 12.2 UI aturan akun bersyarat pada form Posting Profile (grid jenis dokumen/varian/peran/kondisi barang/akun/prioritas, validasi, salin versi); `.rtl.test.jsx`
    - _Requirements: 12.1–12.6_
  - [ ] 12.3 Hapus field akun dari form, request validasi, dan controller per jenis dokumen yang `on` (Sales Invoice, Purchase Invoice, Payment Entry, Stock Entry, Additional Cost, Asset Value Adjustment); hapus pengisian default dari `account_type`/`is_contra`
    - _Requirements: 13.1, 13.3, 13.5–13.6_
  - [ ] 12.4 Panel baca-saja "Akun pencatatan" pada form dan detail dokumen (preview sebelum approve, kolom tercatat sesudahnya); `.rtl.test.jsx`
    - _Requirements: 13.4, 13.7_
  - [ ] 12.5 Perluas `finance:init-posting-profile` mode laporan: usulan aturan awal (barang non-stok, retur, kategori) untuk akuntan; tidak membuat aturan otomatis
    - _Requirements: 12.7_
  - [ ]* 12.6 Write tests: **P-12** penggabungan per baris tetap seimbang; **P-14** request berisi kolom akun diabaikan dan akun tercatat = hasil resolver
    - **Validates: Requirements 12.4, 13.1–13.2**
  - [ ] 12.7 Checkpoint - jalankan test Finances, Sales, Purchase, Inventory yang disentuh
    - Ensure all tests pass, ask the user if questions arise.

- [ ] 13. **(GATED Q-P2-5)** Posting diskon terpisah
  - [ ] 13.1 Jumlah bernama `gross_amount`/`discount_amount` di pabrik konteks Sales Invoice (dan Purchase Invoice non-stok) + flag `discount_split` dari setting `finance_discount_split_from.*`; validasi peran `discount` terpetakan sebelum setting boleh diisi
    - _Requirements: 14.1, 14.4_
  - [ ] 13.2 Rule Sales Invoice (dan Purchase Invoice non-stok) bentuk jurnal diskon; baris pajak dan DPP tidak berubah
    - _Requirements: 14.2, 14.3, 14.5_
  - [ ]* 13.3 Write tests **P-13** jurnal seimbang, total `receivable` = total bersih; alasan `discount_split` pada shadow; dokumen sebelum cutover tidak berubah
    - **Validates: Requirements 14.1–14.6**

- [ ] 14. Penutupan fase dan pembersihan legacy
  - [ ] 14.1 **(Setelah semua jenis `on` stabil satu siklus tutup bulan, atas persetujuan)** matikan `legacy_account_fallback`, hapus closure legacy dari listener dan pencarian `account_type`; pada saat ini penegakan P-9 (Requirement 7.3; uji `PostingLegacyLookupTest` dengan daftar `on` terisi, dan grep CI) mulai berlaku (Q-P2-19)
    - _Requirements: 7.3_
  - [ ] 14.2 **(Setelah semua jenis `on`, Task 12.3 selesai, dan Fase 5 tidak lagi merujuknya)** hapus kolom `accounts.is_contra`: migrasi reversible, `Account` (cast + `configColumns`), `AccountSeeder`, terjemahan `lang/id` dan `lang/en`, sisa rujukan di controller/form/test; tambah test bahwa laporan/pemilihan akun tidak bergantung padanya
    - _Requirements: 12.8, 13.8_
  - [ ] 14.3 Checkpoint akhir: `php artisan test --compact tests/Feature/Finances tests/Feature/Asset tests/Unit`, test frontend yang disentuh; setelah semua task: `vendor/bin/pint --dirty --format agent`, `npm run lint`, `graphify update .`
    - Exit criteria: parity 100% terbukti untuk jenis yang `on`; sisa legacy fallback = 0 untuk jenis tersebut; keputusan D-1/D-13 terdokumentasi
    - Ensure all tests pass, ask the user if questions arise.

## Catatan

- Kontrak listener pada Task 7/8 (Q-P2-12, disetujui pemilik produk 2026-11-12): `PostingGateway::post()` mengembalikan `PostingOutcome`; listener WAJIB (a) tidak menimpa `GlPostingStatus` `skipped` menjadi `posted`, (b) tidak menerapkan efek samping non-idempoten (mis. `gross_purchase_amount` nilai aset pada Task 7.1, mutasi SLE) saat `already_posted`, (c) memakai `journals` hasil untuk kebutuhan seperti `journal_entry_for_scrap_id`.
- Task 7.1/8.x (Q-P2-13, disetujui 2026-11-12): pabrik konteks disposal aset mengisi `guardDocument` dengan Sales Invoice sumber baris penjualan (bukan aset); `GlPostingStatus` `skipped` menyasar baris status dokumen penjaga itu. Karena baris status disposal dibuat listener pada SalesInvoiceItem setelah posting, listener Task 7.1 wajib membuat baris `skipped` untuk SalesInvoiceItem saat disposal dilewati (tidak membuat `POSTED`, tidak menimpa `skipped`); disetujui pemilik produk 2026-11-12.
- Sprint C (Task 6.x, 2026-11-13): UI memakai halaman Inertia kustom (pola `FiscalPeriodController`), bukan `FormPage`/DataTable. Rute di `/settings/postingProfiles` dan `/settings/postingParityLogs`; izin: `select` (daftar), `read` (detail/selisih parity), `write` (buat/ubah/salin/hapus draft), `activate` (aktifkan/pensiunkan), `switch_posting_mode` (ubah mode; `on` wajib `confirmed`). Aturan akun bersyarat pada form ditampilkan baca-saja; editornya tetap Task 12.2. Peringatan "peran belum terpetakan" memakai `PostingRoleRequirements` (peran non-master per jenis dokumen yang modenya bukan `off`). Endpoint lookup generik `ModelController` (`model`, `model.selectData`, `model.datatable`) tidak memeriksa izin `select` model sasaran; model baru ikut serta lewat `lookupRequiresSelectPermission()` (catatan S3).
- Keputusan 2026-11-13 (disetujui pemilik produk, Q-P2-15 s.d. Q-P2-17): Finance Officer baca-saja pada Posting Profile; salin versi dari `draft` ditolak di `PostingProfileService`; guard `select` lookup generik tetap opt-in (`PostingProfile`, `PostingParityLog`). Lihat decision log.
- Sprint D (Task 7.1-7.3, 8.1-8.4, 9.1-9.2, 2026-11-14): seluruh 10 titik posting kini memanggil `PostingGateway` dengan pabrik konteks milik domain dokumen (lihat design.md, "Sprint D"); mode default tetap `off` dan closure legacy dipindah apa adanya. Sales/Purchase Invoice dan Payment Entry memakai `PostingGateway::postDeferred()` agar konteks penuh tidak dibangun pada `off`; pada `shadow` konteks dibangun setelah jalur lama di dalam blok penelan. Test: `PostingParityGroup1Test`, `PostingParityGroup2Test` (P-1 pada tiga mode, termasuk retur, PI stok/non-stok, saldo Stock Entry), `PostingRoutingTest` (akun dokumen vs akun profil per mode; konteks SI/PI/Payment tidak dibangun pada `off`; deadlock pada insert parity muncul dari listener dan status tetap `pending`), `PostingLegacyLookupTest` (P-9; daftar jenis `on` konfigurasi uji, kosong), `PostingEngineOverheadTest` (benchmark opt-in lewat env `RUN_POSTING_BENCHMARK=1`; pembanding closure legacy dipanggil langsung; rasio query engine/legacy <= 1,25 sebagai proksi terdokumentasi; `PostingService` di-resolve baru per dokumen (resolver dingin), dilaporkan per ronde dan maksimum). `CancelBeforeQueuedPostingTest` (sebelumnya known-issue F-16) kini mengunci perbaikan (guard gateway pada semua mode). Keputusan pemilik produk 2026-11-14 (Q-P2-18 s.d. Q-P2-21, lihat decision log): guard cancel pada semua mode; penegakan P-9 bersamaan Task 14.1; saldo Stock Entry `on` dari jurnal engine dan disposal dilewati tidak mengisi `processed_at`; error konkurensi pada `shadow` dilempar ulang (termasuk pada insert `engine_error`), diperluas 2026-11-14 ke error koneksi putus dan level transaksi yang turun di bawah level sebelum savepoint (Q-P2-21); status disposal aset satu baris per disposal dengan upsert di semua jalur (M-9, disetujui 2026-11-14). Hardening gagal tertutup baris invoice TIDAK disetujui (risiko diterima). Task 7.4 dan 8.5 (manual staging) belum dikerjakan; T-3/T-4 tetap di luar klaim parity Payment.
- Task 7.4/8.5/14.1 bersifat operasional dan menunggu waktu/persetujuan; jangan menandainya selesai sebelum bukti parity tersimpan di laporan.
- Fase 3 akan menambah rule pajak ke rule Sales/Purchase Invoice yang dibuat di sini; jaga bentuk `RoleJournalDraft` tetap dapat menampung ≥3 baris.
- Jika Task 1 mengungkap asumsi tabel "Fakta codebase" salah, perbarui `design.md` dan minta konfirmasi sebelum lanjut.
