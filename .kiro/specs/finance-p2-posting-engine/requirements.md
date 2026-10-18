# Requirements Document

## Introduction

Fase 2 dari 7 fase program **Finance Engine** (lihat `docs/prd/finance-engine-prd.md`). Fase 1 membuat semua penulisan GL melewati `JournalService`, tetapi *pemilihan akun* dan *bentuk jurnal* masih tersebar di 10 listener/service dan sebagian memakai pencarian rapuh `where('account_type', …)->latest()->first()` (F-06). Fase ini memusatkan keduanya ke **Posting Engine**: modul bisnis menyerahkan `PostingContext` (angka bernama + sumber), engine memutuskan akun lewat **peran akun (account role)** yang di-resolve dari **Posting Profile** berversi, lalu menghasilkan jurnal.

Selain itu fase ini memperbaiki perilaku pembatalan: dari soft-delete GL (F-04) menjadi jurnal pembalik, dan menutup balapan cancel-vs-posting-asinkron (F-16) — keduanya bergantung pada keputusan **D-13** (PENDING).

**Prinsip fase:** *parity dulu, perubahan kemudian.* Setiap jenis dokumen dimigrasikan di balik feature flag tiga mode (`off` → `shadow` → `on`), dan hasil engine harus identik dengan jalur lama (jurnal Fase 1) sebelum diaktifkan. Posting Profile default dibangkitkan dari COA yang ada sehingga hasilnya sama dengan pencarian `account_type` sekarang.

**Prasyarat:** Fase 1 selesai (JournalService, adapter, backfill hijau). D-1 (mode posting) dan D-13 (perilaku cancel) terjawab — atau bagian yang bergantung padanya (Requirement 9 dan 10) ditunda tanpa memblokir sisanya.

**Di luar scope:**
- Pemisahan baris pajak dan versi aturan pajak (Fase 3). Rule Fase 2 meniru bentuk jurnal sekarang (total ke satu akun); *tempat* untuk baris pajak disiapkan lewat peran `tax_output`/`tax_input` tetapi belum dipakai.
- Alokasi pembayaran dan FX (Fase 4).
- Mengubah queue ↔ sinkron secara global (D-1). Fase ini hanya menyediakan sakelar eksekusi per jenis dokumen (Requirement 9).
- Perbaikan F-10 (nilai GL Payment kumulatif). Bila dikonfirmasi bug (Fase 0), perbaikan masuk sebagai langkah sadar di rule Payment dengan parity-diff yang dicatat, bukan diam-diam.

## Glossary

- **Account role / peran akun**: kunci logis akun (mis. `receivable`, `revenue`, `stock`) yang di-resolve menjadi `accounts.id` nyata.
- **Posting Profile**: himpunan pemetaan peran → akun, bercakupan (perusahaan/cabang) dan berlaku pada rentang tanggal (*effective dating*).
- **Posting Context**: DTO netral-modul yang menyerahkan jenis dokumen, sumber, tanggal, cabang, pihak, jumlah bernama, bendera (retur), dan override akun dari dokumen.
- **Posting Rule**: strategi per jenis dokumen yang mengubah `PostingContext` menjadi satu atau lebih `JournalDraft` berisi peran (bukan akun).
- **Legacy account fallback**: pencarian akun lama berdasarkan `(root_type, account_type)`; dipertahankan sementara sebagai lapis terakhir resolver untuk menjamin parity.
- **Mode engine**: `off` (jalur lama), `shadow` (jalur lama menulis; engine menghitung dan membandingkan), `on` (engine menulis).
- **Parity log**: catatan hasil perbandingan shadow (cocok/tidak cocok) per dokumen.

## Requirements

### Requirement 1: Katalog peran akun

**User Story:** Sebagai developer, saya ingin daftar peran akun yang baku, so that rule posting tidak menyebut akun spesifik.

#### Acceptance Criteria

1. THE sistem SHALL mendefinisikan enum `AccountRole` yang minimal memuat peran yang dipakai 10 titik posting hari ini: `receivable`, `payable`, `revenue`, `cost_of_goods_sold`, `stock`, `stock_received_but_not_billed`, `expense` (beban per dokumen), `stock_adjustment`, `expense_included_in_valuation`, `fixed_asset`, `accumulated_depreciation`, `depreciation_expense`, `capital_work_in_progress`, `gain_loss_disposal`, `cash_or_bank` (diisi dokumen), serta peran cadangan `tax_output`, `tax_input`, `withholding_receivable`, `withholding_payable`, `rounding`, `discount`, `fx_gain`, `fx_loss`.
2. THE enum SHALL memiliki pemetaan ke pasangan legacy `(root_type, account_type)` untuk setiap peran yang punya padanan (mis. `stock` → `asset/stock`, `stock_received_but_not_billed` → `liability/stock_received_but_not_billed`, `cost_of_goods_sold` → `income/cost_of_goods_sold`, `receivable` → `asset/receivable`, `payable` → `liability/payable`, `revenue` → `income/income_account`).
3. THE peran SHALL bersifat tertutup pada kode untuk peran yang dirujuk rule; profil boleh memuat peran kustom bertipe string (dipakai Fase 3 untuk pajak spesifik) yang diabaikan oleh rule yang tidak merujuknya.
4. THE sistem SHALL menyediakan label terjemahan peran di `lang/id` dan `lang/en`.

### Requirement 2: Posting Profile berversi

**User Story:** Sebagai akuntan, saya ingin mengatur akun yang dipakai tiap peran per cabang dan per periode berlaku, so that perubahan COA tidak memerlukan perubahan kode.

#### Acceptance Criteria

1. THE sistem SHALL membuat tabel `posting_profiles` (`name`, `scope` `company`/`branch`, `branch_id` nullable, `effective_from`, `effective_to` nullable, `status` `draft`/`active`/`retired`, `is_default`, `version`, catatan) dan `posting_profile_accounts` (`posting_profile_id`, `role` string, `account_id`), unik `(posting_profile_id, role)`.
2. THE sistem SHALL menolak dua profil `active` bercakupan sama dengan rentang tanggal yang tumpang-tindih.
3. THE sistem SHALL menolak penetapan akun yang `is_group`, `is_disabled`, atau terhapus pada `posting_profile_accounts`.
4. THE profil `active` yang sudah dipakai posting SHALL tidak diedit di tempat; perubahan dilakukan dengan membuat versi baru (salinan) dengan `effective_from` baru, dan versi lama diberi `effective_to`.
5. THE sistem SHALL menyediakan perintah `finance:init-posting-profile` yang membangkitkan profil default perusahaan dari COA saat ini memakai pemetaan legacy Requirement 1.2, melaporkan peran yang tidak dapat di-resolve, dan idempoten (tidak menduplikasi bila profil default sudah ada).
6. THE perubahan profil SHALL tercatat (siapa, kapan, sebelum/sesudah) sesuai mekanisme audit yang dipilih di Fase 1 (Task 1.4).

### Requirement 3: Resolusi peran → akun

**User Story:** Sebagai pemilik produk, saya ingin akun ditentukan oleh aturan yang dapat dijelaskan dan konsisten, so that hasil posting dapat diprediksi dan diaudit.

#### Acceptance Criteria

1. THE sistem SHALL menyediakan `AccountRoleResolver::resolve(AccountRole|string $role, PostingContext $ctx): Account` dengan urutan prioritas tetap:
   1. **override dokumen** (mis. `debit_account_id`/`income_account_id` pada Sales Invoice, `credit_account_id`/`expanse_head_account_id` pada Purchase Invoice, `account_paid_from/to`, `difference_account_id`, akun pada `AssetCategoryAccount`) — dibawa `PostingContext`;
   2. profil `active` bercakupan **cabang** yang berlaku pada `transaction_date`;
   3. profil `active` default **perusahaan** yang berlaku pada `transaction_date`;
   4. *legacy account fallback* `(root_type, account_type)` — hanya bila konfigurasi `finance.posting.legacy_account_fallback` aktif (default aktif selama transisi).
2. IF tidak ada lapis yang menghasilkan akun, THEN THE resolver SHALL melempar `UnresolvedAccountRoleException` yang menyebut peran, cabang, tanggal, dan lapis yang diperiksa.
3. WHEN lapis 4 dipakai, THE resolver SHALL mencatat peringatan terstruktur (peran, jenis dokumen) agar sisa ketergantungan legacy dapat dihitung.
4. THE resolver SHALL deterministik: input sama → akun sama; saat pilihan legacy `latest()->first()` ambigu (lebih dari satu akun cocok), resolver SHALL mengambil yang ditetapkan profil, dan jika lewat fallback legacy SHALL memilih berdasarkan `created_at` terbaru **dan** mencatat peringatan ambiguitas.
5. THE resolver SHALL men-cache hasil per `(profil, peran)` selama satu request/job dan tidak melakukan query berulang untuk peran yang sama.
6. THE resolver SHALL menghasilkan akun terkunci bila dipanggil dalam transaksi posting (pengunciaan tetap dilakukan oleh `JournalService`, Fase 1 Req. 2.7); resolver sendiri tidak menahan kunci lama.

### Requirement 4: Posting Context dan Posting Rule

**User Story:** Sebagai developer modul bisnis, saya ingin menyerahkan fakta transaksi tanpa tahu akuntansi, so that modul tidak menyentuh akun.

#### Acceptance Criteria

1. THE sistem SHALL mendefinisikan `PostingContext` (readonly) dengan: `documentType` (enum `PostingDocumentType`), referensi sumber (`sourceType`, `sourceId`), `transactionDate`, `branchId`, `party` (opsional), `amounts` (peta nama → jumlah, mis. `total`, `stock_total`, `write_off`), `flags` (mis. `is_return`), dan `accountOverrides` (peta peran → `account_id`).
2. THE sistem SHALL mendefinisikan kontrak `PostingRule::build(PostingContext): list<RoleJournalDraft>` yang menghasilkan jurnal dengan baris berperan (peran + sisi + jumlah), bukan akun.
3. THE sistem SHALL menyediakan satu `PostingRule` per `PostingDocumentType` untuk 10 titik posting, yang menghasilkan jumlah jurnal, sisi, dan `purpose` identik dengan jalur Fase 1 (Sales Invoice: 1 jurnal `default`; Purchase Invoice: `stock` + `expense`; dst.).
4. THE kode di `app/Services/Finances/{Posting,Ledger}` SHALL TIDAK mengimpor kelas dari `App\Models\Sales`, `App\Models\Purchase`, atau `App\Models\Inventory`; hal ini ditegakkan oleh test arsitektur.
5. THE pembuatan `PostingContext` SHALL dilakukan oleh pabrik milik modul (mis. `SalesInvoicePostingContextFactory` di `app/Services/Sales/...` atau `Finances/...` sesuai kepemilikan dokumen), bukan oleh engine.
6. THE `PostingRule` SHALL murni (tanpa efek samping DB) sehingga dapat diuji tanpa database dan dipakai oleh mode `shadow`.

### Requirement 5: `PostingService`

**User Story:** Sebagai developer, saya ingin satu panggilan untuk memposting konteks, so that semua modul diposting dengan cara yang sama.

#### Acceptance Criteria

1. THE sistem SHALL menyediakan `PostingService::post(PostingContext): list<Journal>` dan `PostingService::preview(PostingContext): list<JournalDraft>` (resolve akun dan bentuk draft tanpa menulis).
2. THE `post()` SHALL menjalankan rule, me-resolve peran, dan memanggil `JournalService::post()` untuk tiap draft dengan `postingKey` `{sourceType}:{sourceId}:{purpose}` (kontrak purpose dari Fase 1).
3. THE `post()` SHALL atomik untuk seluruh jurnal satu konteks (semua atau tidak sama sekali) dalam satu transaksi.
4. THE `post()` SHALL idempoten: bila semua `postingKey` konteks sudah ada, mengembalikan jurnal yang ada tanpa menulis; bila sebagian ada, melaporkan kondisi inkonsisten (`PartialPostingException`) alih-alih menulis sisanya diam-diam.
5. THE `post()` SHALL TIDAK memposting bila dokumen sumber sudah berstatus `canceled` (guard F-16): ia mengembalikan hasil kosong, menandai `GlPostingStatus` sebagai `skipped` bila ada, dan mencatat log informasi.
6. THE `PostingService` SHALL menolak `documentType` tanpa rule terdaftar (`UnknownPostingDocumentTypeException`).

### Requirement 6: Mode engine per jenis dokumen (off / shadow / on)

**User Story:** Sebagai pemilik produk, saya ingin migrasi per jenis dokumen yang dapat dibuktikan dan dibalik, so that risiko transisi rendah.

#### Acceptance Criteria

1. THE sistem SHALL menyimpan mode per `PostingDocumentType` pada preferensi (`finance_posting_mode.{type}` dengan nilai `off`/`shadow`/`on`, default `off`) dan membacanya saat runtime tanpa deploy.
2. WHEN mode `off`, THE listener/service SHALL memakai jalur Fase 1 (`postPair`) seperti sekarang.
3. WHEN mode `shadow`, THE listener/service SHALL tetap menulis lewat jalur lama, lalu memanggil `PostingService::preview()` dengan konteks yang sama dan membandingkan hasilnya dengan jurnal yang baru ditulis, mencatat hasil ke tabel `posting_parity_logs`; kegagalan/eksepsi engine pada mode `shadow` SHALL TIDAK menggagalkan posting lama.
4. WHEN mode `on`, THE listener/service SHALL memanggil `PostingService::post()` dan tidak memakai jalur lama.
5. THE perbandingan parity SHALL memeriksa himpunan (akun, debit, credit, tanggal) per jurnal dan jumlah jurnal; perbedaan nilai dalam toleransi satu minor unit tidak dihitung sebagai ketidakcocokan, melainkan dicatat sebagai `rounding`.
6. THE `posting_parity_logs` SHALL menyimpan: jenis dokumen, sumber, status (`match`/`mismatch`/`engine_error`), ringkasan legacy dan engine (JSON), dan waktu.
7. THE sistem SHALL menyediakan perintah `finance:parity-report {--type=} {--since=}` yang meringkas jumlah match/mismatch/error per jenis dokumen.
8. THE perubahan mode ke `on` SHALL tercatat (siapa, kapan) dan hanya dapat dilakukan oleh pengguna ber-izin khusus.

### Requirement 7: Migrasi 10 titik posting

**User Story:** Sebagai pemilik produk, saya ingin seluruh titik posting memakai engine, so that tidak ada lagi pemilihan akun tersebar di kode.

#### Acceptance Criteria

1. THE urutan migrasi SHALL mengikuti risiko menaik: (1) Asset (depresiasi, scrap, penyesuaian nilai, disposal), (2) Payment Entry, (3) Purchase Receipt, (4) Delivery Note, (5) Sales Invoice, (6) Purchase Invoice, (7) Stock Entry.
2. FOR setiap jenis dokumen, THE kriteria sebelum mode `on` SHALL: (a) test parity unit (fixture characterization Fase 0) hijau; (b) minimal 200 dokumen atau 14 hari di mode `shadow` pada staging dengan 0 `mismatch` yang tidak dijelaskan; (c) persetujuan pemilik produk.
3. WHEN jenis dokumen berpindah ke `on`, THE query pencarian akun `where('account_type', …)->latest()->first()` pada jalur itu SHALL dihapus dari kode; `grep` CI SHALL gagal bila pola tersebut muncul pada listener/service yang sudah `on`.
4. THE pabrik `PostingContext` untuk tiap dokumen SHALL membawa akun override yang ada di dokumen (lihat Requirement 3.1) sehingga akun pilihan pengguna tetap dihormati.
5. THE `StockEntryService` SHALL tetap memutasi `accounts.balance_amount` sampai Fase 5 mempensiunkannya; engine tidak memutasinya.
6. IF mode `on` ditemukan menghasilkan `UnresolvedAccountRoleException` di produksi, THEN THE job SHALL gagal ke `GlPostingStatus=failed` dengan pesan jelas dan dapat dicoba ulang setelah profil dilengkapi, tanpa mem-fallback diam-diam ke jalur lama.

### Requirement 8: Antarmuka Posting Profile dan pemantauan parity

**User Story:** Sebagai akuntan, saya ingin mengelola profil akun dan melihat hasil parity dari UI, so that saya tidak perlu developer untuk mengubah akun posting.

#### Acceptance Criteria

1. THE sistem SHALL menyediakan halaman daftar dan form Posting Profile (nama, cakupan, cabang, periode berlaku, status, tabel peran → akun dengan pemilih akun yang hanya menampilkan akun non-group dan aktif).
2. THE halaman SHALL menyediakan aksi "Buat versi baru" (salin) dan "Aktifkan", serta menampilkan peringatan bila ada peran wajib untuk jenis dokumen aktif yang belum terpetakan.
3. THE sistem SHALL menyediakan halaman daftar Parity Log (filter jenis dokumen/status) dan tombol ubah mode per jenis dokumen (izin khusus).
4. THE kunci terjemahan baru SHALL tersedia di `lang/id` dan `lang/en` (`LocaleKeysTest` hijau); komponen React baru memiliki test `.rtl.test.jsx`.

### Requirement 9: Sakelar eksekusi queue vs inline (GATED — bergantung D-1)

**User Story:** Sebagai pemilik produk, saya ingin memilih apakah posting suatu jenis dokumen berjalan inline atau via queue, so that konsistensi GL dengan dokumen dapat ditingkatkan di titik yang penting tanpa membalik keputusan lama.

#### Acceptance Criteria

1. IF D-1 diputuskan opsi A, THEN Requirement 9 SHALL dikeluarkan dari fase ini.
2. IF D-1 diputuskan opsi B atau C, THEN THE sistem SHALL menyediakan preferensi `finance_posting_execution.{type}` (`queue`/`inline`, default `queue`) dan jalur `inline` yang memanggil `PostingService::post()` dalam transaksi dokumen sumber, dengan `GlPostingStatus` dibuat langsung bernilai `posted` bila sukses.
3. WHEN mode `inline` gagal, THE seluruh transaksi dokumen SHALL dibatalkan (dokumen tidak berstatus approved tanpa GL).
4. THE jalur `inline` SHALL tidak dipakai untuk jenis dokumen yang terjalin dengan mutasi Stock/SLE (Purchase Receipt, Delivery Note, Purchase Invoice cabang stok) kecuali ada keputusan eksplisit — alasan keputusan Fase 3 event-listener (`event-listener-migration-phase-3`).
5. THE perubahan sakelar SHALL tercatat dan dapat dibalik tanpa deploy.

### Requirement 10: Pembatalan sebagai reversal (GATED — bergantung D-13)

**User Story:** Sebagai auditor, saya ingin pembatalan dokumen meninggalkan jejak jurnal pembalik, so that riwayat tidak hilang dan periode lampau tidak berubah diam-diam.

#### Acceptance Criteria

1. IF D-13 diputuskan opsi A (pertahankan soft-delete), THEN Requirement 10 SHALL dikeluarkan dari fase ini kecuali butir 10.5 (guard F-16).
2. IF D-13 diputuskan opsi B, THEN THE sistem SHALL menyediakan `DocumentCancellationLedgerService::handle(Model $document)` yang untuk setiap jurnal `posted` bersumber dokumen tersebut memanggil `JournalReversalService::reverse()` dengan tanggal = tanggal pembatalan (atau hari ini bila periode asal tertutup).
3. THE hook `saving` pada `Submitable` SHALL memanggil service tersebut menggantikan update massal soft-delete GL, dikendalikan preferensi `finance_cancel_mode` (`soft_delete` default / `reversal`), sehingga perilaku dapat dibalik tanpa deploy; soft-delete **SLE** tetap berjalan (bukan bagian Finance Engine).
4. THE status `voided` dari Fase 1 SHALL tidak lagi ditetapkan pada mode `reversal`; jurnal lama berstatus `voided` tetap dipertahankan sebagai riwayat.
5. WHEN `PostingService::post()` atau listener posting dijalankan untuk dokumen yang sudah `canceled` (balapan F-16), THE posting SHALL dilewati (Requirement 5.5) pada **semua** mode, termasuk `soft_delete` dan jalur lama.
6. WHEN dokumen dibatalkan sebelum job posting berjalan (`GlPostingStatus=pending`), THE sistem SHALL menandai status posting `skipped` agar tidak muncul sebagai kegagalan di halaman monitoring.
7. THE pembatalan dokumen pada periode yang ditutup SHALL menghasilkan reversal pada periode terbuka berikutnya dan menampilkan pemberitahuan kepada pengguna; bila penegakan periode aktif dan tidak ada periode terbuka, pembatalan ditolak dengan pesan jelas.

### Requirement 11: Non-fungsional

#### Acceptance Criteria

1. THE penambahan engine SHALL tidak menambah lebih dari 25% waktu posting rata-rata dibanding jalur lama pada dataset uji (diukur sebelum mode `on`).
2. THE seluruh tabel dan model baru SHALL mendeklarasikan kolom eksplisit di migration dan diuji terhadap `initPermissions()` (F-12).
3. THE izin baru: `PostingProfile` (`select`, `read`, `write`, `activate`), `PostingParityLog` (`select`, `read`), dan izin ubah-mode (`switch_posting_mode`).
4. THE seluruh perubahan SHALL reversible: mode kembali ke `off` mengembalikan jalur lama tanpa kehilangan data; migration baru aditif dengan `down()`.
5. THE characterization Fase 0 dan test Fase 1 SHALL tetap hijau pada mode `off`, `shadow`, dan `on`.

## Pertanyaan yang Menunggu Konfirmasi

| ID | Pertanyaan | Dampak |
|---|---|---|
| D-1 | Mode posting (opsi A/B/C) | Requirement 9 |
| D-13 | Perilaku pembatalan (soft-delete vs reversal) | Requirement 10 |
| Q-P2-1 | Siapa yang menyetujui perpindahan mode `on` per jenis dokumen? | Requirement 6.8, 7.2 |
| Q-P2-2 | Apakah COA saat ini sudah memisah akun PPN Masukan/Keluaran (seeder hanya memiliki `account_type = tax`)? Menentukan peta peran `tax_*` di profil default | Requirement 1, Fase 3 |
| Q-P2-3 | Apakah F-10 (Payment kumulatif) diperbaiki saat migrasi Payment atau sebagai hotfix terpisah? | Requirement 7 |
