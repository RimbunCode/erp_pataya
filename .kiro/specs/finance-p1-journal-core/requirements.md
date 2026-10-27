# Requirements Document

## Introduction

Fase 1 dari 7 fase program **Finance Engine** (lihat `docs/prd/finance-engine-prd.md`). Fase ini membangun inti ledger yang benar: **Journal** (header) berisi N baris `general_ledgers` yang dijamin seimbang, tidak dapat diubah setelah diposting, dapat dibalik lewat reversal, dan diposting hanya pada periode fiskal yang terbuka. Seluruh titik posting GL yang ada dialihkan ke satu pintu (`JournalService`) **tanpa mengubah hasil akuntansinya**, dan data GL lama di-backfill menjadi jurnal.

Temuan audit yang menjadi dasar (PRD Lampiran A): F-01 (tanpa header, tak ada jaminan seimbang), F-02 (SoftDeletes + `cascadeOnDelete` pada GL), F-07 (`double`), F-08 (tanpa periode fiskal), F-13 (mata uang tanpa minor unit), F-15 (kode series per baris), dan F-04 (cancel men-soft-delete GL lewat update massal di `Submitable`, yang melewati event model).

**Prasyarat:** Fase 0 selesai — laporan audit disetujui, D-4 (satu perusahaan; sudah diputuskan, PRD) dan Q1 (ada/tidaknya data produksi) terjawab, characterization test untuk 10 titik posting hijau, dan spec `module-settings-foundation` (D-25) menyediakan service setting Finances untuk `finance_enforce_fiscal_period`. Characterization test itu adalah jaring pengaman utama fase ini.

**Prinsip fase:** aditif dan reversibel. Struktur lama tetap hidup; yang berubah adalah jalur penulisan (semua lewat `JournalService`) dan jaminan yang diberikan.

**Di luar scope:**
- Posting Profile / resolver akun berbasis peran (Fase 2). Listener tetap memilih akun seperti sekarang.
- Memisahkan baris pajak (Fase 3) dan FX/alokasi pembayaran (Fase 4); kolom foreign currency hanya **disiapkan** (nullable, belum diisi).
- Mengganti soft-delete saat cancel dengan reversal otomatis (Fase 2, bergantung D-13). Fase ini hanya memastikan jurnal tetap konsisten terhadap perilaku cancel yang ada (Requirement 8.6).
- Penutupan periode penuh, jurnal penutup tahun, revaluasi (Fase 6). Fase ini hanya status `open`/`closed` dasar.
- Pensiun `accounts.balance_amount` (Fase 5) dan konversi kolom uang tabel operasional ke `decimal` (di luar program).
- Jurnal manual oleh pengguna adalah **opsional** (D-14, menunggu konfirmasi) — lihat Requirement 12.

## Glossary

- **Journal**: header satu kesatuan pencatatan seimbang; memiliki ≥2 baris di `general_ledgers`.
- **Journal line / baris jurnal**: satu baris `general_ledgers` yang tertaut ke `journals` lewat `journal_id`; tepat satu sisi (debit atau kredit) bernilai > 0.
- **Posting**: membuat journal + semua barisnya dalam satu transaksi database; hasilnya permanen.
- **Reversal**: jurnal pembalik (debit↔kredit) yang tertaut dua arah ke jurnal asal.
- **Posting key**: kunci unik (`{source_type}:{source_id}:{purpose}`) yang mencegah posting ganda untuk tujuan yang sama atas dokumen yang sama.
- **Minor unit**: jumlah digit desimal mata uang menurut ISO 4217; dipakai untuk pembulatan dan pengecekan keseimbangan.
- **Jurnal legacy**: jurnal hasil backfill dari baris GL lama; ditandai `legacy_origin`.
- **Void (legacy cancel)**: status jurnal yang seluruh barisnya di-soft-delete oleh perilaku cancel `Submitable`.
- **Periode terbuka / tertutup**: status `fiscal_periods`; jurnal hanya boleh diposting pada periode terbuka bila penegakan diaktifkan.

## Requirements

### Requirement 1: Struktur data Journal dan baris jurnal

**User Story:** Sebagai akuntan, saya ingin setiap pencatatan GL tergabung dalam satu jurnal bernomor, so that saya dapat menelusuri satu transaksi utuh beserta seluruh barisnya.

#### Acceptance Criteria

1. THE sistem SHALL membuat tabel `journals` dengan kolom: `id` (ulid), `code`, `transaction_date` (datetime), `fiscal_period_id` (nullable), `branch_id` (nullable), `status` (`posted`/`reversed`/`voided`), `source_type`+`source_id` (morph nullable), `posting_key` (nullable, unik), `reverses_journal_id` (nullable), `reversed_by_journal_id` (nullable), `reversal_reason` (nullable), `currency_code` (mata uang dasar), `description`, `total_debit`, `total_credit` (`decimal(20,4)`), `posted_at`, `posted_by_id` (nullable), `legacy_origin` (bool), `legacy_unbalanced` (bool), timestamps — **tanpa** `deleted_at`.
2. THE sistem SHALL menambah kolom ke `general_ledgers`: `journal_id` (nullable, FK `restrictOnDelete`), `line_no` (nullable), `foreign_currency_code` (nullable, FK `currencies`), `foreign_debit`/`foreign_credit` (`decimal(20,4)` nullable), `exchange_rate` (`decimal(20,8)` nullable).
3. THE kolom `general_ledgers.against_account_id` SHALL menjadi nullable; untuk jurnal 2-baris hasil adapter nilainya tetap diisi lawan akun seperti sekarang; untuk jurnal ≥3 baris nilainya null.
4. THE model `GeneralLedger` SHALL tetap menjadi model baris jurnal (tidak diganti nama) agar halaman, izin, dan relasi existing tidak berubah; relasi `journal()` ditambahkan.
5. THE model `Journal` SHALL memiliki relasi `lines()` (hasMany `GeneralLedger`), `source()` (morphTo), `fiscalPeriod()`, `reverses()`, `reversedBy()`, `postedBy()`, dan `branch()`.
6. THE penomoran `Journal.code` SHALL memakai `FormatingSeries` dengan format default `JV-@[iiii]/@[yy]` dan dibuat di dalam transaksi posting.
7. THE kolom wajib tabel baru SHALL dideklarasikan eksplisit di migration (tidak bergantung pada penambahan runtime oleh `initPermissions()`, F-12).

### Requirement 2: Validasi dan pembuatan jurnal oleh `JournalService`

**User Story:** Sebagai akuntan, saya ingin sistem menolak jurnal yang tidak seimbang atau tidak valid, so that ledger selalu benar tanpa bergantung pada kehati-hatian tiap modul.

#### Acceptance Criteria

1. THE sistem SHALL menyediakan `JournalService::post(JournalDraft $draft): Journal` sebagai satu-satunya pintu penulisan jurnal baru.
2. WHEN `post()` dipanggil, THE sistem SHALL membuat `journals` + semua baris `general_ledgers` + `total_debit`/`total_credit` dalam **satu transaksi database**; kegagalan di titik mana pun membatalkan seluruhnya.
3. THE sistem SHALL menolak draft dengan kurang dari 2 baris (`InvalidJournalException`).
4. THE sistem SHALL menolak baris yang bernilai negatif, atau yang `debit` dan `credit`-nya sama-sama > 0, atau sama-sama 0.
5. THE sistem SHALL membulatkan setiap nilai baris ke minor unit mata uang dasar (HALF_UP), lalu menolak jurnal bila Σdebit ≠ Σkredit dalam satuan minor unit (`UnbalancedJournalException` dengan selisihnya).
6. THE sistem SHALL menolak baris yang akunnya tidak ada, soft-deleted, `is_group = true`, atau `is_disabled = true`.
7. THE sistem SHALL mengunci (`lockForUpdate`) seluruh akun yang terlibat dengan urutan `id` menaik untuk menghindari deadlock, dan tetap kompatibel dengan caller yang sudah mengunci akun yang sama dalam transaksi yang sama.
8. THE setiap baris jurnal SHALL mengisi `transaction_date`, `referenceable_type`/`referenceable_id` (dari sumber), `partyable_*` (bila ada), `branch_id`, `line_no` berurutan dari 1, dan `description`.
9. THE sistem SHALL menyediakan `JournalService::postPair(...)` (adapter dua baris: akun debit, akun kredit, jumlah, sumber, tanggal, opsi `reverseSides`) yang membangun draft 2 baris dan memanggil `post()`.
10. IF jumlah pasangan adalah 0, THEN `postPair()` SHALL tidak membuat jurnal dan mengembalikan `null` (perubahan disengaja dari perilaku lama yang membuat baris 0/0; dicatat di characterization test).

### Requirement 3: Idempotensi posting

**User Story:** Sebagai operator, saya ingin retry job posting tidak menghasilkan jurnal ganda, so that retry aman.

#### Acceptance Criteria

1. WHERE `JournalDraft` memuat `postingKey`, THE sistem SHALL menyimpannya pada `journals.posting_key` yang unik.
2. IF `post()` dipanggil dengan `postingKey` yang sudah ada, THEN THE sistem SHALL melempar `DuplicatePostingException` yang membawa `journal_id` yang sudah ada, tanpa membuat baris apa pun.
3. WHEN listener posting menangkap `DuplicatePostingException`, THE listener SHALL memperlakukannya sebagai sudah terposting (menandai `GlPostingStatus` = `posted` bila belum) dan tidak mengulang.
4. THE `postingKey` SHALL dibentuk `{source_type}:{source_id}:{purpose}` dengan `purpose` yang mendeskripsikan jurnal (mis. `default`, `stock`, `expense`, `write_off`).

### Requirement 4: Immutability

**User Story:** Sebagai auditor, saya ingin jurnal terposting tidak dapat diubah atau dihapus, so that riwayat keuangan tidak dapat dimanipulasi.

#### Acceptance Criteria

1. WHEN baris `general_ledgers` yang memiliki `journal_id` di-`update` lewat model, THE sistem SHALL menolak (`ImmutableLedgerException`), kecuali perubahan hanya pada `journal_id` dan `line_no` ketika nilai `journal_id` sebelumnya null (jalur backfill).
2. WHEN baris `general_ledgers` yang memiliki `journal_id` di-`delete` atau `forceDelete` lewat model, THE sistem SHALL menolak.
3. WHEN `Journal` di-`update` atau di-`delete` lewat model, THE sistem SHALL menolak. Perubahan status/tautan reversal dan penandaan `voided` dilakukan hanya lewat jalur terkontrol (query builder dalam service) yang diuji.
4. THE sistem SHALL mendokumentasikan bahwa guard ini melindungi dari penggunaan ORM yang tidak disengaja dan bukan dari SQL langsung; pengamanan level database ditunda (D-7).
5. THE perilaku legacy cancel (hook `Submitable` men-soft-delete baris GL lewat update massal) SHALL tetap berfungsi dan didokumentasikan sebagai satu-satunya pengecualian, sesuai Requirement 8.6; pengecualian itu dihapus pada Fase 2.
6. THE sistem SHALL menambahkan test arsitektur ringan yang gagal bila ada kode di `app/` (selain `JournalService`, `JournalReversalService`, dan perintah backfill) yang memanggil `GeneralLedger::create`/`insert` atau `generalLedgerEntries()->create`.

### Requirement 5: Reversal

**User Story:** Sebagai akuntan, saya ingin mengoreksi jurnal dengan jurnal pembalik, so that riwayat tetap utuh dan koreksi terlihat.

#### Acceptance Criteria

1. THE sistem SHALL menyediakan `JournalReversalService::reverse(Journal $journal, ?CarbonInterface $date = null, ?string $reason = null): Journal`.
2. THE jurnal pembalik SHALL memiliki baris-baris yang sama dengan jurnal asal dengan sisi debit/kredit ditukar, `reverses_journal_id` menunjuk jurnal asal, dan `posting_key` berbentuk `{posting_key asal atau journal:{id}}:reversal`.
3. THE jurnal asal SHALL diperbarui: `status = reversed` dan `reversed_by_journal_id` menunjuk jurnal pembalik, dalam transaksi yang sama.
4. IF jurnal asal sudah `reversed` atau `voided`, atau merupakan jurnal pembalik itu sendiri, THEN THE sistem SHALL menolak (`JournalAlreadyReversedException` / `InvalidJournalException`).
5. THE tanggal jurnal pembalik SHALL default ke hari ini; IF tanggal tersebut jatuh pada periode tertutup, THEN THE sistem SHALL menolak (Requirement 6.5).
6. THE net efek (jurnal asal + pembalik) per akun SHALL sama dengan nol.
7. THE jurnal legacy yang `legacy_unbalanced = true` SHALL tidak dapat dibalik otomatis (ditolak dengan pesan yang menjelaskan perlunya koreksi manual).
8. THE reversal SHALL memerlukan izin `reverse` pada model `Journal`.

### Requirement 6: Periode fiskal dasar

**User Story:** Sebagai pemilik keuangan, saya ingin periode fiskal yang dapat dibuka/ditutup, so that transaksi tidak masuk ke periode yang sudah dilaporkan.

#### Acceptance Criteria

1. THE sistem SHALL membuat tabel `fiscal_years` (`name` unik, `start_date`, `end_date`, `status` `open`/`closed`) dan `fiscal_periods` (`fiscal_year_id`, `name`, `start_date`, `end_date`, `status` `open`/`closed`, `closed_at`, `closed_by_id`).
2. THE sistem SHALL menolak tahun/periode yang tumpang-tindih tanggalnya, dan menolak periode di luar rentang tahun fiskalnya.
3. THE sistem SHALL menyediakan perintah `finance:generate-fiscal-year {year}` yang membuat satu tahun fiskal berisi 12 periode bulanan (kalender), idempoten.
4. THE sistem SHALL menambah setting `finance_enforce_fiscal_period` (default `false`).
5. WHEN setting aktif dan `post()` dipanggil dengan `transaction_date` yang periodenya `closed` atau tidak ditemukan, THE sistem SHALL menolak (`ClosedPeriodException`).
6. WHEN setting nonaktif, THE sistem SHALL tetap mengisi `fiscal_period_id` bila periode ditemukan, dan tidak menolak.
7. THE sistem SHALL menyediakan aksi buka/tutup periode dengan izin `close_period`/`reopen_period`; penutupan penuh (checklist, jurnal penutup) adalah Fase 6.
8. THE backfill SHALL membuat tahun/periode yang menutupi rentang `transaction_date` GL lama sampai akhir tahun berjalan, semua berstatus `open`, sehingga penegakan dapat diaktifkan tanpa memblokir data historis.

### Requirement 7: Mata uang, minor unit, dan kolom FX

**User Story:** Sebagai developer, saya ingin pembulatan dan pengecekan keseimbangan memakai minor unit mata uang, so that hasilnya konsisten dan siap untuk FX di Fase 4.

#### Acceptance Criteria

1. THE sistem SHALL menambah kolom `currencies.minor_unit` (smallint, default 2) dan `currencies.numeric_code` (string(3) nullable).
2. THE sistem SHALL mengisi `minor_unit`/`numeric_code` untuk mata uang yang sudah ada sesuai ISO 4217 lewat migration data yang idempoten; mata uang tak dikenal tetap default 2.
3. THE sistem SHALL menyediakan helper pembulatan yang menerima nominal dan `minor_unit`, membulatkan HALF_UP, dan mengonversi ke bilangan bulat minor unit untuk perbandingan.
4. THE `journals.currency_code` SHALL berisi mata uang dasar dari setting umum `default_currency_id` saat posting.
5. THE kolom `foreign_*` dan `exchange_rate` SHALL tersedia tetapi tidak diisi oleh adapter Fase 1 (bernilai null).

### Requirement 8: Adapter — semua titik posting lewat `JournalService`

**User Story:** Sebagai pemilik produk, saya ingin seluruh posting GL yang ada melalui satu pintu tanpa mengubah hasil akuntansi, so that jaminan ledger berlaku di semua modul.

#### Acceptance Criteria

1. THE 10 titik posting pada Lampiran B PRD SHALL dialihkan dari `generalLedgerEntries()->create` / `GeneralLedger::create` langsung menjadi pemanggilan `JournalService::postPair()` (atau `post()` bila lebih dari dua baris, mis. cabang stok/SRNB pada Purchase Invoice yang menjadi dua jurnal terpisah dengan `purpose` berbeda).
2. FOR setiap titik posting, THE hasil baris (akun, `debit`, `credit`, `transaction_date`, `referenceable_*`, `against_account_id`) SHALL identik dengan sebelum perubahan, kecuali tambahan `journal_id`/`line_no`; characterization test Fase 0 SHALL tetap lulus tanpa perubahan ekspektasi (kecuali butir 2.10).
3. THE listener queued SHALL tetap `ShouldQueue` dengan `tries`/`backoff`/`failed()` dan tetap memperbarui `GlPostingStatus` seperti sekarang (D-1 tidak diubah di fase ini).
4. THE listener SHALL menyertakan `postingKey` agar retry idempoten (Requirement 3).
5. THE mutasi `accounts.balance_amount` oleh `StockEntryService` SHALL dipertahankan apa adanya (pensiun di Fase 5).
6. WHEN hook `Submitable` men-soft-delete baris GL dokumen yang dibatalkan, THE sistem SHALL menandai jurnal terkait (`source` = dokumen itu) sebagai `voided` (status saja; baris tidak diubah selain oleh hook yang sudah ada), sehingga tidak ada jurnal `posted` dengan seluruh baris terhapus. Perilaku cancel dari sisi pengguna tidak berubah.
7. THE posting yang menemukan dokumen sumber sudah berstatus `canceled` SHALL tetap mengikuti perilaku saat ini (penanganan balapan F-16 adalah Fase 2); karena itu pelanggaran dilaporkan oleh audit, bukan diperbaiki di sini.

### Requirement 9: Backfill GL lama menjadi jurnal

**User Story:** Sebagai pemilik produk, saya ingin data GL lama ikut tergabung dalam jurnal tanpa mengubah angka, so that seluruh ledger konsisten dalam satu model.

#### Acceptance Criteria

1. THE sistem SHALL menyediakan perintah `finance:backfill-journals {--dry-run} {--chunk=1000} {--limit=}` yang idempoten (menjalankan ulang tidak mengubah hasil).
2. THE perintah SHALL mengelompokkan baris `general_ledgers` yang belum memiliki `journal_id` dan tidak soft-deleted per (`referenceable_type`, `referenceable_id`, `transaction_date`) menjadi satu `journal` (`legacy_origin = true`), mengisi `journal_id` dan `line_no`.
3. FOR kelompok seimbang (dalam toleransi minor unit), THE jurnal berstatus `posted`; FOR kelompok tak seimbang, THE jurnal diberi `legacy_unbalanced = true` dan dimasukkan ke laporan rekonsiliasi — nilai `debit`/`credit` TIDAK diubah.
4. THE baris GL yang soft-deleted SHALL tidak digabungkan ke jurnal dan dilaporkan jumlahnya; jurnal untuk sumber yang seluruh barisnya soft-deleted tidak dibuat.
5. THE backfill SHALL TIDAK mengubah `debit`, `credit`, `account_id`, `transaction_date`, atau `code` baris yang ada.
6. WHEN `--dry-run`, THE perintah SHALL melaporkan jumlah jurnal yang akan dibuat, jumlah baris, dan jumlah kelompok tak seimbang tanpa menulis apa pun.
7. THE perintah SHALL memproses per kelompok dalam transaksi sendiri dan dapat dilanjutkan setelah gagal di tengah jalan (idempoten per kelompok).
8. AFTER selesai, THE laporan SHALL menampilkan rekonsiliasi: jumlah baris sebelum/sesudah, Σdebit/Σkredit per akun sebelum/sesudah (harus sama), dan jumlah baris yang masih tanpa `journal_id` (hanya yang soft-deleted).
9. THE `fiscal_period_id` jurnal legacy SHALL diisi bila periode tersedia (Requirement 6.8).

### Requirement 10: Rekonsiliasi dan pemantauan invarian

**User Story:** Sebagai operator, saya ingin peringatan otomatis bila ledger melanggar invarian, so that masalah ketahuan sebelum tutup buku.

#### Acceptance Criteria

1. THE sistem SHALL menyediakan perintah `finance:reconcile-ledger` yang memeriksa: (a) setiap jurnal non-legacy `posted` seimbang berdasarkan baris aktif; (b) `journals.total_debit/total_credit` sama dengan Σ barisnya; (c) tidak ada baris aktif tanpa `journal_id` sesudah backfill selesai; (d) tidak ada jurnal `posted` tanpa baris aktif.
2. THE perintah SHALL memakai `GeneralLedgerAuditor` dari Fase 0 untuk pemeriksaan yang beririsan, bukan menduplikasi query.
3. THE perintah SHALL dijadwalkan harian di `routes/console.php` dan keluar dengan kode non-nol serta mencatat peringatan di log bila ada pelanggaran.
4. THE jurnal `legacy_unbalanced` SHALL dilaporkan sebagai informasi (bukan kegagalan) sampai ditangani.

### Requirement 11: Antarmuka pengguna

**User Story:** Sebagai akuntan, saya ingin melihat jurnal utuh dan mengelola periode fiskal dari UI, so that saya tidak perlu membaca baris GL satu per satu.

#### Acceptance Criteria

1. THE sistem SHALL menyediakan halaman daftar Journal (DataTable: kode, tanggal, sumber, status, total debit/kredit, periode) dan halaman detail Journal (header, tabel baris dengan total dan indikator seimbang, tautan ke dokumen sumber, tautan ke jurnal asal/pembalik).
2. THE halaman detail SHALL menampilkan tombol Balik (reverse) hanya untuk pengguna ber-izin `reverse` dan hanya untuk jurnal yang dapat dibalik; aksi meminta tanggal dan alasan.
3. THE halaman General Ledger existing SHALL tetap berfungsi, menampilkan kolom `Journal` (tautan) dan menampilkan "Beberapa akun" bila `against_account_id` null.
4. THE sistem SHALL menyediakan halaman pengaturan Periode Fiskal (daftar tahun/periode, generate tahun, buka/tutup periode) di balik izin, didaftarkan sebagai menu item grup setting (desk Finances dan Core) mengikuti spec `module-settings-foundation`.
5. THE sistem SHALL menyediakan toggle penegakan periode (`finance_enforce_fiscal_period`) pada halaman pengaturan yang sama, dengan peringatan bila ada transaksi di periode tak terdefinisi.
6. THE seluruh teks UI SHALL memakai kunci terjemahan di `lang/id` dan `lang/en` (dijaga `LocaleKeysTest`).
7. THE komponen React baru SHALL memiliki test `.rtl.test.jsx`.

### Requirement 12: Jurnal manual (OPSIONAL — menunggu konfirmasi D-14)

**User Story:** Sebagai akuntan, saya ingin membuat jurnal penyesuaian manual yang seimbang, so that saya dapat mengoreksi tanpa dokumen bisnis.

#### Acceptance Criteria

1. IF D-14 disetujui, THEN THE sistem SHALL menyediakan form pembuatan jurnal manual (tanggal, deskripsi, ≥2 baris akun/debit/kredit/keterangan, indikator seimbang waktu nyata) yang menyimpan lewat `JournalService::post()`.
2. THE jurnal manual SHALL memiliki `source` null atau penanda `manual`, memerlukan izin `create` pada `Journal`, dan tunduk pada semua validasi Requirement 2 dan 6.
3. THE jurnal manual SHALL dapat dibalik seperti jurnal lain, dan tidak dapat diedit setelah diposting.
4. IF D-14 ditunda, THEN Requirement 12 SHALL dikeluarkan dari fase ini tanpa memengaruhi requirement lain.

### Requirement 13: Perubahan tipe kolom dan FK (gated)

**User Story:** Sebagai developer, saya ingin kolom uang ledger bertipe presisi tetap dan FK yang aman, so that perhitungan tidak terpengaruh floating point dan penghapusan akun tidak menghapus riwayat.

#### Acceptance Criteria

1. BEFORE mengubah tipe, THE sistem SHALL menjalankan pra-pemeriksaan (read-only) yang melaporkan baris dengan `debit`/`credit` yang memiliki presisi lebih dari 4 desimal bermakna (`ABS(ROUND(x,4) - x) > 1e-9`), dan perubahan SHALL TIDAK dijalankan bila ada pelanggaran yang belum disetujui.
2. THE sistem SHALL mengubah `general_ledgers.debit` dan `credit` menjadi `decimal(20,4)` default 0 dengan migration terpisah yang aman dijalankan ulang dan terdokumentasi (jendela pemeliharaan untuk MySQL).
3. THE sistem SHALL mengubah FK `account_id` dan `against_account_id` dari `cascadeOnDelete` menjadi `restrictOnDelete`.
4. THE sistem SHALL mengaudit seluruh pemakai kolom `debit`/`credit` (query mentah, view, laporan, `groupAggregate`) sebelum konversi dan memastikan hasil `SUM` decimal tetap ditangani benar (cast numerik) di PHP dan frontend.
5. WHEN backfill selesai dan audit menunjukkan nol baris aktif tanpa `journal_id`, THE sistem SHALL menyediakan migration terpisah yang mengubah `general_ledgers.journal_id` menjadi NOT NULL; migration ini SHALL dikunci oleh pemeriksaan di dalam migration dan tidak dijalankan otomatis bersama migrasi lain.

### Requirement 14: Izin, audit, dan kompatibilitas

#### Acceptance Criteria

1. THE model `Journal` SHALL mendaftarkan izin `select`, `read`, `export`, `print`, `reverse` (dan `create` bila Requirement 12 diaktifkan); `FiscalYear`/`FiscalPeriod` mendaftarkan izin dasar plus `close_period`/`reopen_period`; seluruhnya dijalankan melalui `initPermissions()` dan seeder izin.
2. THE setiap perubahan status periode dan setiap reversal SHALL tercatat (siapa, kapan, alasan) pada kolom model dan pada mekanisme log aplikasi yang ada **[TODO: tentukan: `Log` model atau `Changelog` — verifikasi API di Task 1]**.
3. THE `GeneralLedgerController`, `GlPostingStatusController::retry`, dan laporan yang membaca `general_ledgers` SHALL tetap berfungsi tanpa perubahan perilaku.
4. THE seluruh migration SHALL aditif atau terdokumentasi reversible (`down()`), kecuali konversi tipe pada Requirement 13 yang `down()`-nya mengembalikan tipe dengan peringatan kehilangan presisi.
5. THE test suite SHALL lulus: characterization Fase 0, test baru fase ini, dan test existing yang menyentuh Finance.

## Pertanyaan yang Menunggu Konfirmasi

| ID | Pertanyaan | Dampak |
|---|---|---|
| D-4 | Satu perusahaan — DECIDED 2026-10-18 (PRD) | `company_id` tidak ditambahkan di `journals` |
| D-3 | `decimal(20,4)` dan pembulatan HALF_UP di batas posting disetujui? | Requirement 2.5, 7, 13 |
| D-14 | Jurnal manual masuk fase ini? | Requirement 12 |
| Q-P1-1 | Boleh membuat jendela pemeliharaan untuk `ALTER TABLE general_ledgers` di MySQL produksi? | Requirement 13 |
| Q-P1-2 | Penegakan periode diaktifkan kapan (setelah berapa periode terisi)? | Requirement 6.4 |
| D-21 | `transaction_date` posting invoice sekarang `now()` saat approve, bukan tanggal dokumen (F-19). Fase 1 **tidak mengubah** hal ini; keputusan menentukan makna periode fiskal | Requirement 6 (fase ini hanya mencatat; keputusan dibawa ke Fase 6) |
