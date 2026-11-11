# Requirements Document

## Introduction

Fase 1 dari 7 fase program **Finance Engine** (lihat `docs/prd/finance-engine-prd.md`). Fase ini membangun inti ledger yang benar: **Journal** (header) berisi N baris `general_ledgers` yang dijamin seimbang, tidak dapat diubah setelah diposting, dapat dibalik lewat reversal, dan diposting hanya pada periode fiskal yang terbuka. Seluruh titik posting GL yang ada dialihkan ke satu pintu (`JournalService`) **tanpa mengubah hasil akuntansinya**, dan data GL lama di-backfill menjadi jurnal.

Temuan audit yang menjadi dasar (PRD Lampiran A): F-01 (tanpa header, tak ada jaminan seimbang), F-02 (SoftDeletes + `cascadeOnDelete` pada GL), F-07 (`double`), F-08 (tanpa periode fiskal), F-13 (mata uang tanpa minor unit), F-15 (kode series per baris), dan F-04 (cancel men-soft-delete GL lewat update massal di `Submitable`, yang melewati event model).

**Prasyarat:** Fase 0 selesai — laporan audit disetujui, D-4 (satu perusahaan; sudah diputuskan, PRD) dan Q1 (ada/tidaknya data produksi, versi PRD) terjawab 2026-11-03 (belum ada data sama sekali (GL produksi kosong)), characterization test untuk 10 titik posting hijau, dan spec `module-settings-foundation` (D-25) menyediakan service setting Finances untuk `finance_enforce_fiscal_period`. Characterization test itu adalah jaring pengaman utama fase ini.

**Prinsip fase:** aditif dan reversibel. Struktur lama tetap hidup; yang berubah adalah jalur penulisan (semua lewat `JournalService`) dan jaminan yang diberikan.

**Di luar scope:**
- Posting Profile / resolver akun berbasis peran (Fase 2). Listener tetap memilih akun seperti sekarang.
- Memisahkan baris pajak (Fase 3) dan FX/alokasi pembayaran (Fase 4); kolom foreign currency hanya **disiapkan** (nullable, belum diisi).
- Mengganti soft-delete saat cancel dengan reversal otomatis (Fase 2, bergantung D-13). Fase ini hanya memastikan jurnal tetap konsisten terhadap perilaku cancel yang ada (Requirement 8.6).
- Penutupan periode penuh, jurnal penutup tahun, revaluasi (Fase 6). Fase ini hanya status `open`/`closed` dasar.
- Pensiun `accounts.balance_amount` (Fase 5) dan konversi kolom uang tabel operasional ke `decimal` (di luar program).
- Jurnal manual oleh pengguna adalah **opsional** (D-14, disetujui pemilik produk 2026-11-04 sebagai task opsional) — lihat Requirement 12.

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
5. THE model `Journal` SHALL memiliki relasi `lines()` (hasMany `GeneralLedger`), `source()` (morphTo), `fiscalPeriod()`, `reverses()`, `reversedBy()`, `postedBy()`, dan `branch()`. Kolom integritas (`Journal`: `status`, `posting_key`, `total_*`, tautan dan alasan reversal, `legacy_*`, `posted_at`/`posted_by_id`; `FiscalPeriod`: `status`, `closed_at`, `closed_by_id`; `FiscalYear`: `status`) SHALL dilindungi dari mass assignment (`$guarded`) dan hanya ditulis oleh service (`forceCreate()`/query builder). _Ditambahkan 2026-11-04 (review independen Putaran A; temuan keamanan, sesuai spek)._
6. THE penomoran `Journal.code` SHALL memakai `FormatingSeries` dengan format default `JV-@[iiii]/@[yy]` dan dibuat di dalam transaksi posting.
7. THE kolom wajib tabel baru SHALL dideklarasikan eksplisit di migration (tidak bergantung pada penambahan runtime oleh `initPermissions()`, F-12), yaitu **persis kolom yang akan ditambahkan `initPermissions()` menurut flag model tabel itu** (diverifikasi ke `app/Traits/DataTable.php`; skema staging 2026-11-04, laporan audit Bagian 1.4 butir 8 dan 1.5.2): `is_example` (boolean default `false` + indeks `<tabel>_is_example_index`) untuk **semua** model `DataTable`; `code` (string NOT NULL + unique `<tabel>_code_unique`) hanya bila `$is_submitable` atau `$generateCodeSeries`; `have_transactions` (boolean default `false`) hanya untuk model non-submitable (untuk model submitable kolom ini dihapus di semua lingkungan); kolom Submitable hanya bila `$is_submitable`; kolom tree hanya bila `$is_tree_view`. Berlaku untuk tabel `journals`, `fiscal_years`, dan `fiscal_periods` (baris jurnal tetap di `general_ledgers`; tidak ada tabel `journal_lines`). Bila deklarasi sengaja berbeda (mis. `journals.code` nullable sementara), test Task 2.5 SHALL membuktikan `initPermissions()` tidak menambah atau mengubah kolom.

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
8. THE setiap baris jurnal SHALL mengisi `transaction_date`, `referenceable_type`/`referenceable_id` (dari sumber; bila jurnal tidak punya sumber, mis. jurnal manual, baris merujuk jurnal itu sendiri karena kolom NOT NULL — diperjelas 2026-11-04, Task 1.1), `partyable_*` (bila ada), `branch_id`, `line_no` berurutan dari 1, dan `description`.
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
6. THE sistem SHALL menambahkan test arsitektur ringan yang gagal bila ada kode di `app/` (selain `JournalService`, `JournalReversalService`, dan perintah backfill) yang menulis baris GL: `GeneralLedger::create`/`insert`/`make`, `GeneralLedger::query()->create`, `generalLedgerEntries()->create` (dan relasi `lines()`), `DB::table('general_ledgers')->insert`, `new GeneralLedger`, atau `replicate()` baris ledger; test yang sama SHALL gagal bila ada update/delete massal baris GL (`GeneralLedger::...->update/delete`, `DB::table('general_ledgers')->update/delete`, relasi `->update/delete`) selain hook cancel `Submitable` (Requirement 4.5). Pola regex diuji terhadap cuplikan positif dan negatif agar tidak menghasilkan positif palsu. _Diperluas 2026-11-04 (review independen Putaran A)._

### Requirement 5: Reversal

**User Story:** Sebagai akuntan, saya ingin mengoreksi jurnal dengan jurnal pembalik, so that riwayat tetap utuh dan koreksi terlihat.

#### Acceptance Criteria

1. THE sistem SHALL menyediakan `JournalReversalService::reverse(Journal $journal, ?CarbonInterface $date = null, ?string $reason = null): Journal`.
2. THE jurnal pembalik SHALL memiliki baris-baris yang sama dengan jurnal asal dengan sisi debit/kredit ditukar, `reverses_journal_id` menunjuk jurnal asal, dan `posting_key` berbentuk `{posting_key asal atau journal:{id}}:reversal`.
3. THE jurnal asal SHALL diperbarui: `status = reversed` dan `reversed_by_journal_id` menunjuk jurnal pembalik, dalam transaksi yang sama.
4. IF jurnal asal sudah `reversed` atau `voided`, atau merupakan jurnal pembalik itu sendiri, THEN THE sistem SHALL menolak (`JournalAlreadyReversedException` / `InvalidJournalException`).
5. THE tanggal jurnal pembalik SHALL default ke hari ini; IF tanggal tersebut jatuh pada periode tertutup DAN penegakan periode aktif, THEN THE sistem SHALL menolak (Requirement 6.5); bila penegakan nonaktif (default, Requirement 6.6), reversal tidak ditolak karena status periode. _Diperjelas 2026-11-04 (Task 1.1): menyelaraskan dengan Requirement 6.6._
6. THE net efek (jurnal asal + pembalik) per akun SHALL sama dengan nol.
7. THE jurnal legacy yang `legacy_unbalanced = true` SHALL tidak dapat dibalik otomatis (ditolak dengan pesan yang menjelaskan perlunya koreksi manual).
8. THE reversal SHALL memerlukan izin `reverse` pada model `Journal`.

### Requirement 6: Periode fiskal dasar

**User Story:** Sebagai pemilik keuangan, saya ingin periode fiskal yang dapat dibuka/ditutup, so that transaksi tidak masuk ke periode yang sudah dilaporkan.

#### Acceptance Criteria

1. THE sistem SHALL membuat tabel `fiscal_years` (`name` unik, `start_date`, `end_date`, `status` `open`/`closed`) dan `fiscal_periods` (`fiscal_year_id`, `name`, `start_date`, `end_date`, `status` `open`/`closed`, `closed_at`, `closed_by_id`).
2. THE sistem SHALL menolak tahun/periode yang tumpang-tindih tanggalnya, dan menolak periode di luar rentang tahun fiskalnya.
3. THE sistem SHALL menyediakan perintah `finance:generate-fiscal-year {year}` yang membuat satu tahun fiskal berisi 12 periode bulanan (kalender), idempoten; bila tahun bernama sama sudah ada dengan rentang non-kalender, perintah SHALL menolak dengan pesan eksplisit (`finances/fiscalYear.errors.not_calendar_year`) dan tidak membuat periode. _Diperjelas 2026-11-04 (review independen Putaran A)._
4. THE sistem SHALL menambah setting `finance_enforce_fiscal_period` (default `false`). _Diputuskan 2026-11-04 (Q-P1-2, pemilik produk):_ penegakan periode **nonaktif** dulu dan **diaktifkan manual**; penutupan periode penuh tetap di Fase 6. _Detail desain (bukan keputusan pemilik produk):_ pengaktifan lewat toggle di halaman setting (Requirement 11.5); tidak ada pengaktifan otomatis.
5. WHEN setting aktif dan `post()` dipanggil dengan `transaction_date` yang periodenya `closed` atau tidak ditemukan, THE sistem SHALL menolak (`ClosedPeriodException`).
6. WHEN setting nonaktif, THE sistem SHALL tetap mengisi `fiscal_period_id` bila periode ditemukan, dan tidak menolak.
7. THE sistem SHALL menyediakan aksi buka/tutup periode dengan izin `close_period`/`reopen_period`; penutupan penuh (checklist, jurnal penutup) adalah Fase 6.
8. THE backfill SHALL membuat tahun/periode yang menutupi rentang `transaction_date` GL lama sampai akhir tahun berjalan, semua berstatus `open`, sehingga penegakan dapat diaktifkan tanpa memblokir data historis.
9. THE sistem SHALL menentukan periode fiskal dari `transaction_date` dan menentukan "hari" jurnal dalam **zona waktu perusahaan** (`CoreSetting.timezone`, default `Asia/Jakarta`), bukan zona penyimpanan (UTC): transaksi 17.30 UTC tanggal 30 November (00.30 WIB tanggal 1 Desember) SHALL masuk periode bulan WIB (Desember), dan 23.30 WIB tanggal 30 November SHALL masuk November. `transaction_date` tetap disimpan sebagai instan UTC. Pembacaan setting memakai `SettingsService::getForRead()` (tanpa memo dan tanpa membuat baris singleton di dalam transaksi posting). `JournalService::post()` SHALL menormalisasi `transactionDate` ke `APP_TIMEZONE` (UTC) di satu titik masuk sebelum dipakai, sehingga nilai tersimpan, baris GL, dan periode fiskal konsisten bila dihitung ulang dari tanggal tersimpan (termasuk reversal). _Diputuskan 2026-11-04 (Q-P1-5, disetujui pemilik produk); mengubah rumusan sebelumnya (hari UTC)._

### Requirement 7: Mata uang, minor unit, dan kolom FX

**User Story:** Sebagai developer, saya ingin pembulatan dan pengecekan keseimbangan memakai minor unit mata uang, so that hasilnya konsisten dan siap untuk FX di Fase 4.

#### Acceptance Criteria

1. THE sistem SHALL menambah kolom `currencies.minor_unit` (smallint, default 2) dan `currencies.numeric_code` (string(3) nullable).
2. THE sistem SHALL mengisi `minor_unit`/`numeric_code` untuk **seluruh kode ISO 4217** secara lengkap (mis. JPY=0, KWD/BHD/OMR/TND/JOD/IQD/LYD=3, CLF=4) dari satu daftar statis, lewat migration data yang idempoten untuk baris yang sudah ada dan lewat `CountrySeeder` untuk mata uang yang di-seed kemudian; kode yang tidak dikenal (non-ISO) tetap default 2 tanpa kode numerik. _Diputuskan 2026-11-04 (Q-P1-4, disetujui pemilik produk); semula hanya mata uang yang sudah ada._
3. THE sistem SHALL menyediakan helper pembulatan yang menerima nominal dan `minor_unit`, membulatkan HALF_UP, dan mengonversi ke bilangan bulat minor unit untuk perbandingan.
4. THE `journals.currency_code` SHALL berisi mata uang dasar dari setting umum `default_currency_id` saat posting.
5. THE kolom `foreign_*` dan `exchange_rate` SHALL tersedia tetapi tidak diisi oleh adapter Fase 1 (bernilai null).

### Requirement 8: Adapter — semua titik posting lewat `JournalService`

**User Story:** Sebagai pemilik produk, saya ingin seluruh posting GL yang ada melalui satu pintu tanpa mengubah hasil akuntansi, so that jaminan ledger berlaku di semua modul.

#### Acceptance Criteria

1. THE 10 titik posting pada Lampiran B PRD SHALL dialihkan dari `generalLedgerEntries()->create` / `GeneralLedger::create` langsung menjadi pemanggilan `JournalService::postPair()` (atau `post()` bila lebih dari dua baris, mis. cabang stok/SRNB pada Purchase Invoice yang menjadi dua jurnal terpisah dengan `purpose` berbeda).
2. FOR setiap titik posting, THE hasil baris (akun, `debit`, `credit`, `transaction_date`, `referenceable_*`, `against_account_id`) SHALL identik dengan sebelum perubahan, kecuali tambahan `journal_id`/`line_no`; characterization test Fase 0 SHALL tetap lulus tanpa perubahan ekspektasi (kecuali butir 2.10). **Selisih yang diizinkan (diputuskan pemilik produk 2026-11-04, I-2; disetujui pemilik produk; alasan: konsekuensi langsung D-3 dan validasi akun/jumlah yang memang menjadi tujuan fase ini):** (i) pembulatan HALF_UP ke minor unit mata uang dasar di batas posting (D-3), termasuk residu pada `balance_amount` Stock Entry (butir 5) dan SRNB Purchase Receipt/Invoice; (ii) mode gagal baru: akun tidak valid (tidak ditemukan, soft-deleted, `is_group`, `is_disabled`) dan jumlah negatif ditolak (Requirement 2.4/2.6), yang sebelumnya diam-diam diposting. Seri penomoran `Journal` dibuat otomatis oleh `JournalService` bila belum ada (keputusan A, 2026-11-04), sehingga tidak ada lagi mode gagal `seriesMissing`. Normalisasi `transaction_date` ke UTC di batas posting adalah pengaman defensif turunan Requirement 6.9 (bukan keputusan pemilik produk) dan tidak mengubah hasil bila semua pemanggil sudah mengirim Carbon UTC. Urutan `id` baris dalam satu pasangan (debit dulu) dan pasangan bernilai 0 (butir 2.10) juga bukan pelanggaran paritas.
3. THE listener queued SHALL tetap `ShouldQueue` dengan `tries`/`backoff`/`failed()` dan tetap memperbarui `GlPostingStatus` seperti sekarang (D-1 tidak diubah di fase ini).
4. THE listener SHALL menyertakan `postingKey` agar retry idempoten (Requirement 3).
5. THE mutasi `accounts.balance_amount` oleh `StockEntryService` SHALL dipertahankan apa adanya (pensiun di Fase 5).
6. WHEN hook `Submitable` men-soft-delete baris GL dokumen yang dibatalkan, THE sistem SHALL menandai jurnal terkait (`source` = dokumen itu) sebagai `voided` (status saja; baris tidak diubah selain oleh hook yang sudah ada), sehingga tidak ada jurnal aktif dengan seluruh baris terhapus. _Diputuskan 2026-11-04 (review Putaran B, disetujui pemilik produk; alasan tidak dinyatakan):_ hook men-`voided` jurnal berstatus `posted` **maupun** `reversed` milik sumber itu (jurnal asal dan jurnal pembaliknya berbagi sumber yang sama); jurnal yang sudah `voided` tidak berubah. Perilaku cancel dari sisi pengguna tidak berubah.
7. THE posting yang menemukan dokumen sumber sudah berstatus `canceled` SHALL tetap mengikuti perilaku saat ini (penanganan balapan F-16 adalah Fase 2); karena itu pelanggaran dilaporkan oleh audit, bukan diperbaiki di sini.

### Requirement 9: Backfill GL lama menjadi jurnal

**User Story:** Sebagai pemilik produk, saya ingin data GL lama ikut tergabung dalam jurnal tanpa mengubah angka, so that seluruh ledger konsisten dalam satu model.

#### Acceptance Criteria

1. THE sistem SHALL menyediakan perintah `finance:backfill-journals {--dry-run} {--chunk=1000} {--limit=}` yang idempoten (menjalankan ulang tidak mengubah hasil).
2. THE perintah SHALL mengelompokkan baris `general_ledgers` yang belum memiliki `journal_id` (aktif maupun soft-deleted; butir 4) per dokumen sumber (`referenceable_type`, `referenceable_id`) menjadi satu `journal` (`legacy_origin = true`), mengisi `journal_id` dan `line_no`. Kelompok SHALL dipecah per **tanggal** (hari kalender = hari dalam **zona waktu perusahaan** `CoreSetting.timezone`, default `Asia/Jakarta`; **diputuskan pemilik produk 2026-11-04, Q-P1-5**, mengubah rumusan hari UTC; dihitung di PHP lewat `FiscalPeriodService::businessDay()`, bukan `DATE(transaction_date)` di SQL; alasan di `design.md`) hanya bila dokumen punya posting di hari berbeda; pasangan baris satu dokumen yang hanya berbeda detik (N-3: `now()` per baris di `StockEntryService` dan `PostAssetDisposalGainLoss`) SHALL tetap satu jurnal. `journals.transaction_date` jurnal legacy SHALL = nilai `transaction_date` terkecil di kelompok. Dokumen yang posting-nya melintasi tengah malam dapat terpecah per tanggal dan, bila tiap bagiannya tak seimbang, ditandai `legacy_unbalanced`. _Diubah 2026-11-04 (D-8, disetujui pemilik produk, termasuk detail tanggal jurnal legacy dan pemecahan lintas tengah malam; semula per `referenceable_type`, `referenceable_id`, `transaction_date` penuh); alasan: N-3._
3. FOR kelompok seimbang (dalam toleransi minor unit), THE jurnal berstatus `posted`; FOR kelompok tak seimbang, THE jurnal diberi `legacy_unbalanced = true` dan dimasukkan ke laporan rekonsiliasi — nilai `debit`/`credit` TIDAK diubah.
4. THE baris GL yang soft-deleted SHALL ikut diproses menjadi jurnal legacy berstatus **`voided`** (sehingga setiap baris punya `journal_id` dan migration NOT NULL Rilis 2 dapat berjalan) dan jumlahnya dilaporkan. Pengelompokannya per dokumen sumber dan per hari (zona waktu perusahaan) seperti butir 2, tetapi baris soft-deleted **tidak pernah digabung** dengan baris aktif dokumen yang sama: bila dokumen punya keduanya pada hari yang sama, terbentuk dua jurnal (satu `posted`, satu `voided`). Jurnal `voided` hasil backfill tetap `legacy_origin = true`, dan `legacy_unbalanced` dihitung seperti butir 3. _Diputuskan 2026-11-04 (I-1, disetujui pemilik produk; alasan: agar semua baris punya `journal_id`); mengubah rumusan sebelumnya (baris soft-deleted tidak digabungkan)._
5. THE backfill SHALL TIDAK mengubah `debit`, `credit`, `account_id`, `transaction_date`, atau `code` baris yang ada.
6. WHEN `--dry-run`, THE perintah SHALL melaporkan jumlah jurnal yang akan dibuat, jumlah baris, dan jumlah kelompok tak seimbang tanpa menulis apa pun.
7. THE perintah SHALL memproses per kelompok dalam transaksi sendiri dan dapat dilanjutkan setelah gagal di tengah jalan (idempoten per kelompok).
8. AFTER selesai, THE laporan SHALL menampilkan rekonsiliasi: jumlah baris sebelum/sesudah, Σdebit/Σkredit per akun sebelum/sesudah (harus sama), dan jumlah baris yang masih tanpa `journal_id` (aktif dan soft-deleted; keduanya harus nol setelah backfill selesai). Σ per akun dihitung atas baris aktif (baris soft-deleted tidak ikut). Jalankan di luar jam transaksi agar posting baru di antara pengukuran sebelum dan sesudah tidak tampak sebagai selisih.
9. THE `fiscal_period_id` jurnal legacy SHALL diisi bila periode tersedia (Requirement 6.8).
10. THE baris contoh (`is_example = true`) SHALL ikut di-backfill (jurnalnya `is_example` bila semua barisnya contoh). _Diputuskan 2026-11-04 (Q-P1-8, disetujui pemilik produk; alasan tidak dinyatakan pemilik produk; catatan implementer: agar tidak ada baris tanpa `journal_id` yang menghambat NOT NULL)._
11. THE jurnal legacy SHALL memakai seri nomor jurnal yang sama dengan jurnal baru, tanpa awalan khusus; penandanya `legacy_origin`. _Diputuskan 2026-11-04 (Q-P1-7, disetujui pemilik produk; alasan tidak dinyatakan pemilik produk)._ Risiko yang diterima: akhiran tahun/bulan pada `code` jurnal legacy diambil dari `now()` saat backfill, bukan dari tanggal transaksi.

### Requirement 10: Rekonsiliasi dan pemantauan invarian

**User Story:** Sebagai operator, saya ingin peringatan otomatis bila ledger melanggar invarian, so that masalah ketahuan sebelum tutup buku.

#### Acceptance Criteria

1. THE sistem SHALL menyediakan perintah `finance:reconcile-ledger` yang memeriksa: (a) setiap jurnal non-legacy `posted` seimbang berdasarkan baris aktif; (b) `journals.total_debit/total_credit` sama dengan Σ barisnya; (c) tidak ada baris (aktif maupun soft-deleted) tanpa `journal_id` sesudah backfill selesai; (d) tidak ada jurnal `posted` tanpa baris aktif.
2. THE perintah SHALL memakai `GeneralLedgerAuditor` dari Fase 0 untuk pemeriksaan yang beririsan, bukan menduplikasi query.
3. THE perintah SHALL dijadwalkan harian di `routes/console.php` dan keluar dengan kode non-nol serta mencatat peringatan di log bila ada pelanggaran. _Diputuskan 2026-11-04 (Q-P1-11, disetujui pemilik produk; alasan tidak dinyatakan):_ di Rilis 1 jadwal memakai opsi `--ignore-unjournaled` (butir (c) menjadi informasi) karena backfill (Task 7.5) belum dijalankan; opsi itu dicabut dari jadwal setelah backfill dijalankan dan paling lambat di Rilis 2 (NOT NULL, Task 9).
4. THE jurnal `legacy_unbalanced` SHALL dilaporkan sebagai informasi (bukan kegagalan) sampai ditangani.

### Requirement 11: Antarmuka pengguna

**User Story:** Sebagai akuntan, saya ingin melihat jurnal utuh dan mengelola periode fiskal dari UI, so that saya tidak perlu membaca baris GL satu per satu.

#### Acceptance Criteria

1. THE sistem SHALL menyediakan halaman daftar Journal (DataTable: kode, tanggal, sumber, status, total debit/kredit, periode) dan halaman detail Journal (header, tabel baris dengan total dan indikator seimbang, tautan ke dokumen sumber, tautan ke jurnal asal/pembalik).
2. THE halaman detail SHALL menampilkan tombol Balik (reverse) hanya untuk pengguna ber-izin `reverse` dan hanya untuk jurnal yang dapat dibalik; aksi meminta tanggal dan alasan. **Diputuskan 2026-11-12 (pemilik produk, Q-P1-14): alasan WAJIB diisi, dan tanggal pembalikan dibatasi: tidak boleh sebelum tanggal jurnal asal dan tidak boleh di masa depan, keduanya sebagai hari dalam zona waktu perusahaan (Requirement 6.9); batas dan tanggal default dikirim server.**
3. THE halaman General Ledger existing SHALL tetap berfungsi, menampilkan kolom `Journal` (tautan) dan menampilkan "Beberapa akun" bila `against_account_id` null.
4. THE sistem SHALL menyediakan halaman pengaturan Periode Fiskal (daftar tahun/periode, generate tahun, buka/tutup periode) di balik izin, didaftarkan sebagai menu item grup setting (desk Finances dan Core) mengikuti spec `module-settings-foundation`.
5. THE sistem SHALL menyediakan toggle penegakan periode (`finance_enforce_fiscal_period`) pada halaman pengaturan yang sama, dengan peringatan bila ada transaksi di periode tak terdefinisi.
6. THE seluruh teks UI SHALL memakai kunci terjemahan di `lang/id` dan `lang/en` (dijaga `LocaleKeysTest`).
7. THE komponen React baru SHALL memiliki test `.rtl.test.jsx`.

### Requirement 12: Jurnal manual (OPSIONAL — D-14 disetujui 2026-11-04)

**User Story:** Sebagai akuntan, saya ingin membuat jurnal penyesuaian manual yang seimbang, so that saya dapat mengoreksi tanpa dokumen bisnis.

#### Acceptance Criteria

1. THE sistem SHALL menyediakan (sebagai requirement opsional; D-14 disetujui pemilik produk 2026-11-04) form Journal Voucher sederhana untuk pembuatan jurnal manual (tanggal, deskripsi, ≥2 baris akun/debit/kredit/keterangan, indikator seimbang waktu nyata) yang wajib seimbang. **Diubah 2026-11-07 (disetujui pemilik produk, D-14 keputusan lanjutan): jurnal manual melewati alur persetujuan modul Approval yang sudah ada dan baru diposting lewat `JournalService::post()` setelah disetujui; sebelum disetujui tidak ada jurnal maupun baris GL yang terbentuk.**
2. THE jurnal manual SHALL memiliki `source` = dokumen `JournalVoucher` asalnya (**diubah 2026-11-07, Q-P1-13, disetujui pemilik produk; sebelumnya `source` null atau penanda `manual`**), pembuatan Journal Voucher memerlukan izin `create` pada `JournalVoucher`, dan jurnal tunduk pada semua validasi Requirement 2 dan 6.
3. THE jurnal manual SHALL dapat dibalik seperti jurnal lain, dan tidak dapat diedit setelah diposting.
4. THE Requirement 12 SHALL dikerjakan sebagai task opsional (`- [ ]*`, Task 11): cakupannya **dikonfirmasi pemilik produk 2026-11-07: dengan approval (butir 5)**, dan bila tidak dikerjakan SHALL tidak memengaruhi requirement lain atau exit criteria fase ini.
5. WHEN Journal Voucher diajukan, THE sistem SHALL menjalankan alur Approval yang sama dengan dokumen submitable lain; WHEN disetujui, THE sistem SHALL memposting jurnal lewat `JournalService::post()` dengan `posting_key` idempoten; WHEN ditolak atau dibatalkan sebelum disetujui, THE sistem SHALL tidak membentuk jurnal; WHEN dibatalkan setelah diposting, THE sistem SHALL membalik/mem-void jurnalnya mengikuti Requirement 8.6. **Bentuk model (Q-P1-13, diputuskan pemilik produk 2026-11-07): dokumen `JournalVoucher` (+ item) tersendiri yang submitable dan memakai modul Approval; `Journal` tidak mendapat status draft dan tetap tidak dapat diubah. Journal yang dihasilkan memakai `source` = dokumen `JournalVoucher` tersebut. Pembuat/penyetuju dan penomoran mengikuti pola dokumen submitable yang ada.**

### Requirement 13: Perubahan tipe kolom dan FK (gated)

**User Story:** Sebagai developer, saya ingin kolom uang ledger bertipe presisi tetap dan FK yang aman, so that perhitungan tidak terpengaruh floating point dan penghapusan akun tidak menghapus riwayat.

#### Acceptance Criteria

1. BEFORE mengubah tipe, THE sistem SHALL menjalankan pra-pemeriksaan (read-only) yang melaporkan baris dengan `debit`/`credit` yang memiliki presisi lebih dari 4 desimal bermakna (`ABS(ROUND(x,4) - x) > 1e-9`), dan perubahan SHALL TIDAK dijalankan bila ada pelanggaran yang belum disetujui. Pra-pemeriksaan SHALL tersedia sebagai perintah artisan read-only (berguna untuk Rilis 2 dan seterusnya). Karena perintah itu kode baru yang tiba di staging dalam deploy yang sama dengan migration tipe kolom (BR-6/BR-7), pra-pemeriksaan untuk staging dijalankan lebih dulu oleh pemilik produk sebagai **query SQL read-only** (praktik Task 6.5 Fase 0), sebelum Rilis 1 digabung ke `dev-1` (detail desain; Task 8.1). Bila query 8.1(a) menunjukkan `hit_ketat` > 0, ambang pengaman migration atau daftar pengecualian yang disetujui ditetapkan **oleh pemilik produk** sebelum Rilis 1 digabung ke `dev-1`, agar pengaman tidak menggagalkan deploy staging; mekanismenya di dalam migration (detail desain): ambang yang dapat dikonfigurasi (mis. konstanta atau config) dan/atau daftar pengecualian.
2. THE sistem SHALL mengubah `general_ledgers.debit` dan `credit` menjadi `decimal(20,4)` default 0 dengan migration terpisah yang aman dijalankan ulang dan terdokumentasi. _Diputuskan 2026-11-04 (Q-P1-1, pemilik produk):_ **tidak** diperlukan jendela pemeliharaan (GL produksi kosong). _Detail desain (bukan keputusan pemilik produk):_ staging hanya 64 baris; migration ini ikut **Rilis 1** (butir 5) setelah query pra-pemeriksaan (butir 1) dijalankan pemilik produk di staging dan hasilnya dilaporkan; pra-pemeriksaan di dalam migration tetap ada sebagai pengaman. Tipe `decimal(20,4)` dan pembulatan HALF_UP di batas posting disetujui (D-3, 2026-11-04, pemilik produk).
3. THE sistem SHALL mengubah FK `account_id` dan `against_account_id` dari `cascadeOnDelete` menjadi `restrictOnDelete`.
4. THE sistem SHALL mengaudit seluruh pemakai kolom `debit`/`credit` (query mentah, view, laporan, `groupAggregate`) sebelum konversi dan memastikan hasil `SUM` decimal tetap ditangani benar (cast numerik) di PHP dan frontend.
5. WHEN backfill selesai dan audit menunjukkan nol baris tanpa `journal_id` (**termasuk baris soft-deleted**, yang kini di-backfill menjadi jurnal `voided`; Requirement 9.4), THE sistem SHALL menyediakan migration terpisah yang mengubah `general_ledgers.journal_id` menjadi NOT NULL; migration ini SHALL dikunci oleh pemeriksaan di dalam migration yang menolak jalan bila masih ada baris tanpa `journal_id`, aktif maupun soft-deleted. _Diputuskan 2026-11-04 (BR-7, pemilik produk; terpisah dari Q-P1-1):_ rilis Fase 1 dua tahap. **Rilis 1** = tabel jurnal, `journal_id` nullable, dan perintah backfill (Requirement 1–12 dan 13.1–13.4); backfill dijalankan di staging dan produksi. **Rilis 2** = migration NOT NULL ini, di PR/tahapan terpisah yang digabung ke `feat/finance-engine` dan kemudian ke `dev-1` **hanya setelah** backfill dijalankan dan diverifikasi di staging dan produksi. Urutan ini **dirancang** agar deploy tidak gagal karena urutan (`.scripts/deploy-*.sh` memakai `set -e` dan `migrate --force` sebelum release diaktifkan); bila migration Rilis 2 tetap gagal (mis. ada baris baru tanpa `journal_id`), dapat dipulihkan dengan menjalankan backfill lalu deploy ulang. Merge PR ke `dev-1` memicu deploy staging; deploy produksi: tag `v*` mendeploy produksi, sedangkan `workflow_dispatch` punya input `environment` (staging atau produksi, default produksi; `deploy-cpanel.yml:15-28`) dan dapat dijalankan dari ref mana pun, sehingga urutan BR-7 juga berlaku untuk deploy manual, bukan `dev-1`. Rilis 1 dan Rilis 2 adalah dua penggabungan berbeda ke `dev-1` (Q-BR-1). Tidak diperlukan jendela pemeliharaan (Q-P1-1).

### Requirement 14: Izin, audit, dan kompatibilitas

#### Acceptance Criteria

1. THE model `Journal` SHALL mendaftarkan izin `select`, `read`, `export`, `print`, `reverse` (**tanpa** `create`: **diputuskan 2026-11-12, Q-P1-15, pemilik produk**, izin `create` jurnal manual didaftarkan pada `JournalVoucher` sesuai Requirement 12.2; `Journal` tidak pernah dibuat langsung oleh pengguna); `FiscalYear`/`FiscalPeriod` mendaftarkan izin dasar plus `close_period`/`reopen_period`; seluruhnya dijalankan melalui `initPermissions()` dan seeder izin. **Pembuatan tahun fiskal (izin `create` pada `FiscalYear`/`FiscalPeriod`) hanya untuk profil `full`** (**diputuskan 2026-11-12, Q-P1-15, pemilik produk**): peran Finance Officer (profil `operator`) tidak mendapat `create` pada kedua model itu lewat `scope_overrides` di `AdministratorSeeder`, tetapi tetap memperoleh izin operator lain.
2. THE setiap perubahan status periode dan setiap reversal SHALL tercatat (siapa, kapan, alasan) pada kolom model dan pada model `Log` melalui event `AuditableModelSaved` (listener `RecordAuditLog`) dengan aksi `reversed`, `closed`, `reopened`; alasan disimpan di `data_after.reason`. _Diverifikasi Task 1.4, 2026-11-04: `Changelog` adalah catatan rilis, bukan audit._
3. THE `GeneralLedgerController`, `GlPostingStatusController::retry`, dan laporan yang membaca `general_ledgers` SHALL tetap berfungsi tanpa perubahan perilaku.
4. THE seluruh migration SHALL aditif atau terdokumentasi reversible (`down()`), kecuali konversi tipe pada Requirement 13 yang `down()`-nya mengembalikan tipe dengan peringatan kehilangan presisi.
5. THE test suite SHALL lulus: characterization Fase 0, test baru fase ini, dan test existing yang menyentuh Finance.

## Pertanyaan dan Keputusan

| ID | Pertanyaan | Dampak |
|---|---|---|
| D-4 | Satu perusahaan — DECIDED 2026-10-18 (PRD) | `company_id` tidak ditambahkan di `journals` |
| D-3 | `decimal(20,4)` dan pembulatan HALF_UP di batas posting — **DECIDED 2026-11-04, disetujui pemilik produk** (alasan: tidak dinyatakan pemilik produk; usulan PRD/implementer: menghilangkan galat floating point di ledger sebelum laporan Fase 5) | Requirement 2.5, 7, 13 |
| D-8 | Granularitas backfill — **DECIDED 2026-11-04 (diubah), disetujui pemilik produk**: per dokumen (`referenceable_type` + `referenceable_id`), dipecah per tanggal hanya bila dokumen punya posting di hari berbeda (alasan N-3); detail disetujui 2026-11-04: `transaction_date` jurnal legacy = nilai terkecil di kelompok, dokumen lintas tengah malam terpecah dan bila tiap bagian tak seimbang ditandai `legacy_unbalanced` | Requirement 9.2 |
| D-14 | Jurnal manual masuk fase ini? — **DECIDED 2026-11-04, disetujui pemilik produk**: masuk sebagai task opsional (form Journal Voucher sederhana, wajib seimbang, via `JournalService`) | Requirement 12 (opsional), Task 11 |
| Q-P1-1 | Jendela pemeliharaan untuk `ALTER TABLE general_ledgers`? — **DECIDED 2026-11-04, disetujui pemilik produk**: tidak diperlukan (GL produksi kosong); Task 9.1 tetap memeriksa nol baris tanpa `journal_id` sebelum kolom dikunci | Requirement 13 |
| BR-7 | Urutan rilis Fase 1 — **DECIDED 2026-11-04, disetujui pemilik produk** (terpisah dari Q-P1-1): **Rilis 1** = tabel jurnal + `journal_id` nullable + perintah backfill (backfill dijalankan di staging dan produksi); **Rilis 2** = migration NOT NULL, di PR/tahapan terpisah, digabung ke `feat/finance-engine` lalu `dev-1` hanya setelah backfill terverifikasi di staging dan produksi; dua penggabungan berbeda ke `dev-1` (Q-BR-1) | Requirement 13.5, Task 9 |
| Q-P1-2 | Penegakan periode diaktifkan kapan? — **DECIDED 2026-11-04, disetujui pemilik produk**: nonaktif dulu (`finance_enforce_fiscal_period` = off), diaktifkan manual; penutupan periode tetap di Fase 6. Detail desain (bukan keputusan pemilik produk): pengaktifan lewat toggle di halaman setting | Requirement 6.4, 11.5 |
| D-21 | `transaction_date` posting invoice sekarang `now()` saat approve, bukan tanggal dokumen (F-19). Fase 1 **tidak mengubah** hal ini; keputusan menentukan makna periode fiskal | Requirement 6 (fase ini hanya mencatat; keputusan dibawa ke Fase 6) |
| Q-P1-3 | `against_account_id` nullable dimajukan ke migration Fase 1 (`..._100005`), bukan Task 8.3 — **DECIDED 2026-11-04, disetujui pemilik produk**. Alasan tidak dinyatakan pemilik produk; temuan implementer: jurnal 3 baris atau lebih tidak dapat disimpan tanpa kolom nullable, dan melonggarkan NOT NULL bersifat aditif dan aman. Task 8.3 tidak lagi memuat `against_account_id` | Requirement 1.3, Task 2, Task 8.3 |
| Q-P1-4 | Kelengkapan `minor_unit` mata uang — **DECIDED 2026-11-04, disetujui pemilik produk**: diisi **lengkap ISO 4217** untuk semua kode di `currencies` (statis, idempoten; contoh JPY=0, KWD/BHD/OMR/TND/JOD/IQD/LYD=3, CLF=4), lewat migration dan `CountrySeeder`; kode tak dikenal tetap 2. Alasan tidak dinyatakan pemilik produk | Requirement 7.2 |
| Q-P1-5 | Zona waktu "hari" jurnal dan periode fiskal — **DECIDED 2026-11-04, disetujui pemilik produk**: mengikuti `CoreSetting.timezone` (default `Asia/Jakarta`), bukan UTC; berlaku juga untuk pemecahan per hari backfill D-8 (Putaran B). Alasan tidak dinyatakan pemilik produk. Konsekuensi: pada dini hari WIB, bulan WIB mendahului bulan UTC; backfill mengonversi zona di PHP | Requirement 6.9, 9.2 |
| Q-P1-6 | Pembeda `posting_key` untuk sumber yang diposting lebih dari sekali (Asset) — **DECIDED 2026-11-04, disetujui pemilik produk**: scrap `posting_key` = `Asset:{id}:write_off`; disposal (penjualan aset) dibedakan **per baris invoice**: `posting_key` = `Asset:{id}:disposal:{sales_invoice_item_id}` (setiap baris penjualan aset punya posting sendiri; baris yang sama tidak dapat diposting dua kali). Alasan tidak dinyatakan pemilik produk. Implementasi di Task 6.7 (Putaran B) | Requirement 3, Task 6.7 |
| Q-P1-7 | Awalan nomor jurnal legacy — **DECIDED 2026-11-04, disetujui pemilik produk**: jurnal legacy memakai seri nomor jurnal yang sama, tanpa awalan `LJ-`; cukup `legacy_origin`. Alasan tidak dinyatakan pemilik produk. Risiko dari reviewer yang diterima: akhiran tahun pada `code` jurnal legacy diambil dari `now()` saat backfill, bukan dari tanggal transaksi | Requirement 9.11, Task 7.1 |
| Q-P1-8 | Baris GL contoh (`is_example`) di backfill — **DECIDED 2026-11-04, disetujui pemilik produk**: ikut di-backfill (jurnal `is_example` bila semua barisnya contoh). Alasan tidak dinyatakan pemilik produk (catatan implementer: agar NOT NULL Task 9 tidak terblokir) | Requirement 9.10, Task 7.1 |
| Q-P1-9 | `purpose` biaya tambahan Stock Entry — **DECIDED 2026-11-04, disetujui pemilik produk**: `additional_cost:{id}` (id baris biaya tambahan) disetujui; pola berparameter (`additional_cost:{id}`, `disposal:{sales_invoice_item_id}`) masuk daftar `purpose` baku. Alasan tidak dinyatakan | Requirement 3, Task 6.6, daftar `purpose` di `tasks.md` |
| Q-P1-10 | Bentuk `posting_key` — **DECIDED 2026-11-04, disetujui pemilik produk**: memakai FQCN model (`App\Models\Asset\Asset:{id}:write_off`) karena tidak ada `morphMap`; teks Q-P1-6 "`Asset:{id}:...`" dipahami sebagai singkatan. Alasan tidak dinyatakan | Requirement 3, Task 6.7 |
| Q-P1-11 | Jadwal `finance:reconcile-ledger` sebelum backfill — **DECIDED 2026-11-04, disetujui pemilik produk**: di Rilis 1 jadwal memakai `--ignore-unjournaled`; opsi dicabut dari `routes/console.php` setelah backfill (Task 7.5) dijalankan, dan paling lambat di Rilis 2 (NOT NULL, Task 9). Alasan tidak dinyatakan pemilik produk (catatan implementer: agar jadwal harian tidak gagal sebelum backfill) | Requirement 10.3, Task 7.5, Task 9 |
| Q-P1-12 | Celah `migrate` lalu `db:seed` untuk seri `Journal` — **DECIDED 2026-11-04, disetujui pemilik produk**: risiko semula **diterima**, **dan kini tidak relevan** karena seri `Journal` dibuat otomatis (keputusan A); tidak ada prasyarat seeder/`initPermissions` lagi. Fakta dari reviewer: `.scripts/deploy-staging.sh:61-73` menjalankan `migrate` lalu `db:seed` **sebelum** symlink `current` dipindah, sehingga kode baru baru aktif setelah seri terdaftar; risiko nyata hanya pada deploy manual. Alasan tidak dinyatakan pemilik produk | Requirement 5, `design.md` Migrasi dan Urutan Aman |
| I-1 | Baris GL soft-deleted di backfill — **DECIDED 2026-11-04, disetujui pemilik produk**: diproses menjadi jurnal legacy `voided` (dipisah dari baris aktif dokumen yang sama) agar semua baris punya `journal_id` dan NOT NULL Rilis 2 dapat jalan. Alasan: tujuan itu. Mengubah Requirement 9.4 dan 9.8 serta pengaman Requirement 13.5/Task 9.1 (memeriksa semua baris, termasuk soft-deleted) | Requirement 9.4, 9.8, 13.5, Task 7.1, Task 9.1 |
| I-2 | Selisih paritas adapter — **DECIDED 2026-11-04, disetujui pemilik produk**: hanya (i) pembulatan HALF_UP (D-3) dan (ii) penolakan akun tidak valid (tidak ditemukan, soft-deleted, `is_group`, `is_disabled`) serta jumlah negatif (Requirement 2.4/2.6). Butir `seriesMissing` dihapus karena seri kini dibuat otomatis (A); normalisasi UTC bukan selisih yang diputuskan pemilik produk, melainkan pengaman defensif turunan Requirement 6.9. Alasan: pembulatan dan validasi adalah tujuan fase ini | Requirement 8.2, Task 6.9 |
| A | Seri penomoran `Journal` — **DECIDED 2026-11-04, disetujui pemilik produk**: dibuat otomatis oleh `JournalService` lewat `FormatingSeries::ensureExists()` (hanya membuat bila belum ada, `createOrFirst`; tidak pernah menulis pada seri yang ada), sedangkan jalur seeding `DataTable::initPermissions()` memakai `FormatingSeries::ensureFor()` (logika lama yang diekstrak, perilaku seri model lain tidak berubah); format `JV-@[iiii]/@[yy]`; idempoten. Pengecekan `seriesMissing`, `InvalidJournalException::seriesMissing()`, dan kunci bahasa `series_missing` dihapus. Alasan: model `Journal` sudah punya `$defaultFormatCode` dan logika pembuatannya sudah ada di `initPermissions()`, sehingga prasyarat seeder tidak perlu | Requirement 2, 8.2, Task 6, 7.5 |
| B | Arah pembulatan — **DECIDED 2026-11-04, disetujui pemilik produk**: tetap HALF_UP sesuai D-3; konfigurasi arah pembulatan (HALF_UP/HALF_DOWN/HALF_EVEN di `CoreSetting`) **tidak dikerjakan**, hanya dicatat sebagai ide fase berikutnya | Requirement 2.5 (D-3) |
| Minor-4 | Hook cancel `Submitable` — **DECIDED 2026-11-04, disetujui pemilik produk** (review Putaran B): men-`voided` jurnal `posted` maupun `reversed` milik sumber (jurnal asal dan pembaliknya). Alasan tidak dinyatakan | Requirement 8.6, Task 6.8 |

## Catatan Perubahan (2026-11-04)

**Task 1 (Putaran A).** Requirement 14.2 (mekanisme log ditetapkan), 5.5 (diperjelas terhadap 6.6), dan 2.8 (sumber null) diubah sebagai klarifikasi teks tanpa menambah perilaku di luar spek.

**Keputusan pemilik produk 2026-11-04 (putaran perbaikan Putaran A).** Q-P1-3 sampai Q-P1-6 diputuskan dan ditutup di tabel di atas. Butir yang diubah sebagai konsekuensi: Requirement 6.9 (baru; zona waktu perusahaan), 7.2 (ISO 4217 lengkap), 9.2 (hari backfill = hari zona perusahaan, bukan UTC). Dari review independen (sesuai spek): Requirement 1.5 (mass assignment), 4.6 (cakupan test arsitektur diperluas), 6.3 (tahun non-kalender ditolak dengan pesan eksplisit).

**Keputusan A dan B pemilik produk 2026-11-04 (putaran perbaikan kedua Putaran B).** A: seri `Journal` dibuat otomatis (`FormatingSeries::ensureExists()`), selisih paritas I-2 butir (iii) `seriesMissing` dihapus; B: pembulatan tetap HALF_UP, konfigurasi pembulatan hanya ide fase berikutnya. Butir diubah: Requirement 8.2 dan baris I-2, Q-P1-12; `design.md` (langkah 6 `JournalService`, hasil Task 1.5, bagian backfill, baris risiko penomoran), `tasks.md` (catatan Task 6 dan prosedur 7.5), dan `docs/prd/finance-decision-log.md`. Lokasi `design.md` yang diubah: langkah 6 (baris 174), hasil Task 1.5 (179), bagian backfill (304), tabel risiko penomoran (412); `tasks.md` catatan Task 6 (baris 97). Pada putaran keempat pembuatan seri menangkap `UniqueConstraintViolationException` (race di bawah snapshot). Pada putaran ketiga: jalur posting hanya membuat seri bila belum ada (`FormatingSeries::ensureExists()`) dan tidak pernah menulis pada seri yang sudah ada; jalur seeding tetap `ensureFor()`.

**Keputusan pemilik produk 2026-11-04 (putaran perbaikan Putaran B).** Q-P1-7 sampai Q-P1-12, I-1, I-2, dan Minor-4 diputuskan dan ditutup di tabel di atas. Butir yang diubah sebagai konsekuensi: Requirement 8.2 (selisih paritas yang diizinkan), 8.6 (`posted` dan `reversed`), 9.2/9.4/9.8 (baris soft-deleted menjadi jurnal `voided`), 9.10 dan 9.11 (baru), 10.1(c) dan 10.3 (semua baris; `--ignore-unjournaled` di jadwal Rilis 1), 13.5 (pengaman NOT NULL memeriksa semua baris).
