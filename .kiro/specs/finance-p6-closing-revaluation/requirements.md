# Requirements Document

## Introduction

Fase 6 (terakhir) dari program **Finance Engine** (lihat `docs/prd/finance-engine-prd.md`). Fase ini menambahkan **penutupan periode** yang dapat dipercaya: siklus status periode (`open` → `soft_closed` → `hard_closed`) dengan penegakan di `JournalService`, daftar pemeriksaan pra-penutupan, **revaluasi unrealized FX** dengan pembalikan otomatis, **jurnal penutup tahun buku** ke laba ditahan, dan pembukaan kembali yang terkontrol dan teraudit.

Kondisi nyata yang membentuk fase ini (diverifikasi di kode):

- **Tanggal pembukuan = waktu approve.** Posting invoice memakai `now()` sebagai `transaction_date` (`SalesInvoiceService` ~327, `PurchaseInvoiceService` ~351), bukan `sales_invoices.date` / tanggal invoice (F-19). Faktur tanggal 30 September yang disetujui 2 Oktober masuk ke periode Oktober di ledger. Penutupan periode hanya bermakna bila kebijakan tanggal pembukuan jelas (**D-21**, PENDING). Payment Entry memakai `date ?? now()`; depresiasi memakai tanggal yang dibawa event.
- Fase 1 hanya menyediakan status periode `open`/`closed` dan penegakan di balik preferensi `finance_enforce_fiscal_period`; belum ada checklist, jurnal penutup, atau revaluasi.
- Posting GL asinkron (D-1): jurnal dapat tertinggal dari dokumen. D-1 opsi B mensyaratkan penutupan **diblokir** selama ada posting `pending`/`failed`.
- `accounts.currency_code` ada (akun bermata uang asing), jurnal piutang/utang valas membawa `foreign_*` dan kurs (Fase 4), dan `FxEngine` menyediakan kurs bertipe `closing`.
- Seeder COA memiliki akun ekuitas "Laba" (kandidat laba ditahan); peran `retained_earnings` belum ada.
- Laporan (Fase 5) sudah menampilkan *Laba Berjalan* virtual untuk tahun yang belum ditutup dan harus tetap benar setelah penutupan.

**Prasyarat:** Fase 1 (periode, reversal), Fase 4 (kurs, party ledger, selisih kurs terealisasi), Fase 5 (TB, Neraca, rekonsiliasi proyeksi dan sub-ledger). Keputusan **D-21**, **D-22**, **D-23**, dan **D-24** terjawab sebelum Task 3 (siklus status) dan Task 6 (penutupan tahun).

**Di luar scope:**
- Konsolidasi, minoritas, eliminasi antar-entitas.
- Revaluasi aset non-moneter (persediaan, aset tetap) dan impairment; hanya pos **moneter** mata uang asing.
- Akrual/penangguhan otomatis (prepaid/accrued), alokasi biaya.
- Pembekuan data dokumen operasional (stok, PO) di luar jurnal; hanya jurnal yang dikunci.
- Rekonsiliasi bank dan pelaporan resmi regulator.

## Glossary

- **Soft close**: periode tertutup untuk pengguna biasa; hanya pengguna ber-izin khusus yang dapat memposting (dicatat).
- **Hard close**: tidak ada posting sama sekali; satu-satunya jalan adalah membuka kembali.
- **Checklist pra-penutupan**: kumpulan pemeriksaan bersifat *blocking* (harus lulus) atau *warning* (dapat di-override dengan alasan).
- **Revaluasi unrealized FX**: penyesuaian akhir periode atas saldo moneter valas ke kurs `closing`, diakui ke akun selisih kurs *belum terealisasi* dan dibalik otomatis di periode berikutnya.
- **Jurnal penutup (closing entry)**: jurnal tahun buku yang menolkan akun laba rugi ke laba ditahan; ditandai `is_closing`.
- **Posting key penutupan**: kunci idempotensi `fiscal_year:{id}:closing` / `fx_revaluation:{id}`.

## Requirements

### Requirement 1: Siklus status periode

**User Story:** Sebagai pemilik keuangan, saya ingin periode yang dapat ditutup bertahap dan dibuka kembali dengan kontrol, so that angka yang sudah dilaporkan tidak berubah diam-diam.

#### Acceptance Criteria

1. THE status periode SHALL diperluas menjadi `open`, `soft_closed`, `hard_closed`; migrasi data mengubah status `closed` dari Fase 1 menjadi `hard_closed`.
2. THE transisi yang diizinkan SHALL: `open → soft_closed`, `soft_closed → hard_closed`, `soft_closed → open`, `hard_closed → soft_closed` (pembukaan kembali, Requirement 7); transisi lain ditolak.
3. THE sistem SHALL menyimpan `soft_closed_at/by`, `hard_closed_at/by`, `reopened_at/by`, `reopen_reason` pada `fiscal_periods`, dan setiap transisi dicatat ke tabel riwayat `fiscal_period_transitions` (`from`, `to`, `user`, `reason`, `checklist_run_id`, waktu).
4. THE `JournalService::post()` SHALL memanggil `FiscalPeriodService::assertCanPost(date, ?user, draft)`: periode `open` → diizinkan; `soft_closed` → diizinkan hanya bagi pengguna terautentikasi ber-izin `post_in_soft_closed` dan jurnal ditandai `posted_in_soft_closed = true`; `hard_closed` → selalu ditolak (`ClosedPeriodException`).
5. THE posting tanpa pengguna terautentikasi (job/queue, perintah terjadwal) pada periode `soft_closed` atau `hard_closed` SHALL ditolak, kecuali draft menandai `allowSoftClosed` secara eksplisit (hanya dipakai oleh layanan penutupan dan revaluasi milik fase ini).
6. THE penegakan SHALL aktif hanya bila `finance_enforce_fiscal_period` = true; aksi `soft_close`/`hard_close` pertama SHALL mensyaratkan preferensi itu aktif (atau mengaktifkannya dengan konfirmasi).
7. THE transisi SHALL memerlukan izin `close_period` (soft/hard) dan `reopen_period` (pembukaan kembali); hard close dapat dibatasi ke peran lebih tinggi lewat izin terpisah `hard_close_period`.
8. THE `reversal` jurnal (Fase 1) pada periode tertutup SHALL mengikuti Fase 1 Req. 5.5 (tanggal pembalik pada periode terbuka); aturan ini tidak diubah.

### Requirement 2: Pemeriksaan pra-penutupan (checklist)

**User Story:** Sebagai akuntan, saya ingin sistem memeriksa kesiapan sebelum menutup, so that periode tidak ditutup dengan data yang belum lengkap.

#### Acceptance Criteria

1. THE sistem SHALL menyediakan kerangka `PeriodCloseCheck` (kontrak: `key`, `severity` `blocking`/`warning`, `run(FiscalPeriod): CheckResult`) dan `PeriodCloseService::runChecks(period)` yang menyimpan hasil pada `period_close_runs` + `period_close_run_items`.
2. THE pemeriksaan **blocking** minimal: (a) tidak ada `GlPostingStatus` `pending`/`failed` dengan `created_at` ≤ akhir periode (D-1 opsi B); (b) semua jurnal periode seimbang (rekonsiliasi ledger Fase 1); (c) Trial Balance seimbang sampai akhir periode; (d) rekonsiliasi proyeksi saldo hijau (Fase 5); (e) rekonsiliasi sub-ledger AR/AP hijau pada akhir periode (Fase 4); (f) semua jadwal depresiasi aset dengan `schedule_date` ≤ akhir periode telah `posted`; (g) revaluasi unrealized FX periode sudah diposting bila ada saldo valas (Requirement 4); (h) periode sebelumnya dalam tahun fiskal yang sama sudah `soft_closed` atau lebih (bila D-23 mensyaratkan berurutan).
3. THE pemeriksaan **warning** minimal: (i) dokumen draft/menunggu persetujuan bertanggal dalam periode (jenis dokumen dapat dikonfigurasi); (j) pajak `unclassified` dipakai pada invoice periode; (k) selisih stok: saldo akun `stock` dengan nilai stock ledger [opsional `*`, bergantung ketersediaan nilai valuasi]; (l) jurnal `legacy_unbalanced` dalam periode.
4. THE hasil SHALL berstatus `pass`/`warn`/`fail` per pemeriksaan dengan detail dan tautan ke daftar penyebab (mis. halaman monitoring posting, daftar dokumen draft).
5. THE `hard_close` SHALL ditolak bila ada pemeriksaan blocking `fail` pada run terbaru; pemeriksaan blocking TIDAK dapat di-override.
6. THE pemeriksaan warning SHALL dapat di-override dengan alasan wajib dan izin `override_close_warning`; override tercatat di `period_close_run_items`.
7. THE run SHALL kedaluwarsa bila ada jurnal baru pada periode setelah run (hasil lama tidak boleh dipakai untuk menutup); run baru diwajibkan.
8. THE soft close SHALL mensyaratkan run terbaru tanpa blocking `fail`, kecuali pemeriksaan (g) dan (h) yang boleh ditunda hingga hard close (D-22).

### Requirement 3: Antarmuka penutupan periode

#### Acceptance Criteria

1. THE sistem SHALL menyediakan halaman **Tutup Periode**: daftar periode dengan status, tombol Jalankan Pemeriksaan, hasil checklist (pass/warn/fail, detail, tautan), tombol Soft Close / Hard Close / Buka Kembali (sesuai izin dan status), dan riwayat transisi.
2. THE halaman SHALL menampilkan banner bila `finance_enforce_fiscal_period` belum aktif dan menjelaskan konsekuensinya.
3. THE aksi dengan dampak (hard close, buka kembali) SHALL meminta konfirmasi dan alasan.
4. THE halaman jurnal (Fase 1) SHALL menampilkan penanda "diposting saat soft close" bila berlaku.
5. THE kunci terjemahan `lang/id` & `lang/en` (`LocaleKeysTest` hijau); komponen React baru memiliki `.rtl.test.jsx`.

### Requirement 4: Revaluasi unrealized FX

**User Story:** Sebagai akuntan, saya ingin saldo valas dinilai ulang ke kurs penutup di akhir periode, so that neraca mencerminkan nilai wajar dan laba rugi kurs belum terealisasi terlihat.

#### Acceptance Criteria

1. THE sistem SHALL menyediakan `FxRevaluationService` dengan `preview(period, rateType = closing)` dan `post(period, ...)`; `preview` tidak menulis apa pun dan menampilkan baris rinci.
2. THE cakupan pos moneter SHALL: (a) saldo piutang/utang valas per pihak dan per dokumen (open items dengan jumlah asing dan kurs asal dari ledger); (b) saldo akun kas/bank bermata uang asing (`accounts.currency_code` ≠ mata uang dasar), dengan saldo asing berasal dari kolom `foreign_*` baris jurnal; akun tanpa jejak `foreign_*` dilaporkan sebagai tidak dapat direvaluasi (bukan diabaikan).
3. THE kurs SHALL berasal dari `FxEngine` bertipe `closing` pada tanggal akhir periode; bila kurs tidak ada → `NoExchangeRateException` dan preview menampilkan daftar mata uang tanpa kurs.
4. FOR tiap pos, THE penyesuaian = (saldo asing × kurs closing, dibulatkan) − saldo dasar tercatat saat ini (termasuk revaluasi periode sebelumnya yang sudah dibalik); selisih positif/negatif diakui ke `unrealized_fx_gain` / `unrealized_fx_loss` dengan tanda mengikuti sisi aset/kewajiban.
5. THE jurnal revaluasi SHALL satu per periode per cakupan: baris pada akun kontrol (dengan `party` dan referensi dokumen untuk piutang/utang agar sub-ledger tetap sejalan), baris pada akun kas/bank terkait, dan lawan pada `unrealized_fx_*`; `is_revaluation = true`, `postingKey = fx_revaluation:{period}:{scope}`; seimbang.
6. THE jurnal revaluasi SHALL otomatis dibalik pada hari pertama periode berikutnya (jurnal pembalik terjadwal memakai `JournalReversalService` dengan `allowSoftClosed` bila periode tujuan `open`); `fx_revaluations.status` bergerak `posted → reversed`.
7. IF periode berikutnya belum ada atau tidak `open`, THEN THE sistem SHALL menolak posting revaluasi dengan pesan jelas (atau membuat periode berikutnya bila tahun fiskal belum tersedia dan pengguna ber-izin).
8. THE sistem SHALL mendukung revaluasi ulang periode yang sama hanya setelah revaluasi sebelumnya dibalik/dibatalkan; revaluasi ganda ditolak.
9. THE `PartyLedgerService.balance` SHALL memperlakukan baris revaluasi sebagai penyesuaian nilai dasar (tidak mengubah jumlah asing) sehingga rekonsiliasi sub-ledger (Fase 4) tetap hijau; Aging menampilkan kolom "Penyesuaian revaluasi".
10. THE peran `unrealized_fx_gain` dan `unrealized_fx_loss` SHALL ditambahkan ke katalog `AccountRole` dan dipetakan di Posting Profile.

### Requirement 5: Penanganan hasil revaluasi pada laporan dan realized FX

#### Acceptance Criteria

1. THE Laba Rugi SHALL menampilkan `unrealized_fx_*` pada bagian terpisah ("Selisih kurs belum terealisasi") sehingga dapat dibedakan dari realized FX.
2. THE pelunasan valas sesudah revaluasi dan pembalikannya SHALL menghasilkan realized FX terhadap kurs invoice asal (Fase 4), karena revaluasi telah dibalik; test golden SHALL membuktikan total (unrealized + realized) lintas dua periode sama dengan selisih kurs ekonomi sebenarnya.
3. THE laporan SHALL tetap benar bila revaluasi periode ke-n belum dibalik (periode berjalan) dan setelah dibalik.

### Requirement 6: Penutupan tahun buku

**User Story:** Sebagai akuntan, saya ingin menutup tahun buku sehingga laba/rugi tahun itu pindah ke laba ditahan, so that tahun berikutnya dimulai dengan akun laba rugi nol.

#### Acceptance Criteria

1. THE sistem SHALL menyediakan `YearEndClosingService::preview(FiscalYear)` dan `close(FiscalYear)`; `preview` menampilkan setiap akun laba rugi yang akan dinolkan dan laba bersih yang dipindahkan.
2. THE prasyarat `close`: seluruh periode tahun itu minimal `soft_closed` dan pemeriksaan pra-penutupan periode terakhir lulus; revaluasi periode terakhir telah diposting (dan pembaliknya akan jatuh ke tahun berikutnya).
3. THE jurnal penutup SHALL: untuk setiap akun `report_type = profit_and_loss` dengan saldo tahun ≠ 0, satu baris yang menolkannya; selisih bersih dicatat pada akun peran `retained_earnings`; `is_closing = true`; tanggal = hari terakhir tahun fiskal; `postingKey = fiscal_year:{id}:closing`; melewati `JournalService` dengan `allowSoftClosed`.
4. THE jurnal penutup SHALL dihitung dari saldo akun laba rugi **tahun fiskal itu saja** (tidak termasuk tahun lain), dan mengecualikan jurnal penutup sebelumnya.
5. THE `close` SHALL idempoten: pemanggilan kedua mengembalikan jurnal yang ada tanpa membuat baru.
6. WHEN jurnal penutup diposting, THE tahun fiskal SHALL berstatus `closed` dan seluruh periodenya `hard_closed` dalam satu transaksi; kegagalan membatalkan semuanya.
7. THE laporan Laba Rugi, Trial Balance mutasi, dan KPI laba SHALL, secara default, **mengecualikan** jurnal `is_closing` agar laba tahun tertutup tetap terlihat; Neraca dan saldo SHALL menyertakannya. Opsi filter "sertakan jurnal penutup" tersedia.
8. THE Neraca setelah penutupan SHALL tetap seimbang dan baris Laba Berjalan/Laba Ditahan Belum Ditutup (Fase 5) SHALL hilang untuk tahun yang sudah ditutup (nol), digantikan saldo `retained_earnings`.
9. THE peran `retained_earnings` SHALL ditambahkan ke `AccountRole` dan dipetakan di Posting Profile ke akun ekuitas yang ditetapkan akuntan (D-24); penutupan tanpa pemetaan ditolak.

### Requirement 7: Pembukaan kembali terkontrol

**User Story:** Sebagai pemilik keuangan, saya ingin membuka periode yang sudah ditutup hanya dengan alasan dan jejak, so that koreksi sah tetap mungkin tanpa mengorbankan integritas.

#### Acceptance Criteria

1. THE pembukaan kembali SHALL memerlukan izin `reopen_period`, alasan wajib, dan tercatat di `fiscal_period_transitions`.
2. IF tahun fiskal periode tersebut telah ditutup (ada jurnal penutup), THEN THE sistem SHALL mensyaratkan pembalikan jurnal penutup terlebih dulu (`YearEndClosingService::reopen`), lalu pembukaan periode dari yang terakhir ke yang terawal.
3. THE pembukaan SHALL ditolak bila periode setelahnya berstatus `hard_closed` kecuali dibuka berurutan dari yang terakhir (D-23).
4. WHEN periode `hard_closed` dibuka kembali, THE statusnya SHALL menjadi `soft_closed` (bukan `open`), dan `open` memerlukan transisi eksplisit berikutnya.
5. THE jurnal yang diposting pada periode yang pernah dibuka kembali SHALL ditandai (`posted_in_reopened_period`) untuk kebutuhan audit.
6. THE sistem SHALL memberi tahu (notifikasi in-app ke pemegang izin `close_period`) saat periode dibuka kembali.

### Requirement 8: Konsistensi dan keamanan operasi

#### Acceptance Criteria

1. THE operasi penutupan, revaluasi, dan penutupan tahun SHALL berjalan dalam transaksi atomik dengan penguncian periode (`lockForUpdate` pada baris `fiscal_periods`/`fiscal_years`) sehingga dua operator tidak dapat menutup/membuka bersamaan.
2. THE operasi SHALL bersifat idempoten dan tahan terhadap pengulangan (posting key).
3. THE operasi berat (revaluasi, penutupan tahun, checklist besar) SHALL dapat dijalankan sebagai job yang melaporkan progres, atau sinkron pada skala kecil; hasil dan galat terlihat di UI.
4. THE sistem SHALL mencatat semua aksi ke log audit aplikasi.
5. THE characterization Fase 0 dan test Fase 1–5 SHALL tetap hijau; penegakan periode bernilai default `false` sehingga perilaku produksi tidak berubah sampai diaktifkan.

### Requirement 9: Kebijakan tanggal pembukuan (GATED — D-21)

**User Story:** Sebagai akuntan, saya ingin tahu apakah faktur bertanggal September yang disetujui Oktober dibukukan di September atau Oktober, so that penutupan periode sesuai praktik.

#### Acceptance Criteria

1. THE spec ini SHALL TIDAK mengubah `transaction_date` posting tanpa keputusan D-21 (pemilik produk + akuntan).
2. IF D-21 memutuskan "tanggal pembukuan = tanggal dokumen", THEN THE pabrik konteks posting (Fase 2) SHALL memakai tanggal dokumen (`date`) sebagai `transactionDate`; Payment Entry sudah demikian. Dokumen dengan tanggal dokumen pada periode tertutup SHALL ditolak saat approve (pesan jelas); data historis tidak dibukukan ulang.
3. IF D-21 memutuskan "tanggal pembukuan = tanggal approve" (perilaku sekarang), THEN THE checklist SHALL menambah pemeriksaan warning (m): dokumen bertanggal dokumen di periode ini tetapi diposting pada periode lain, dan laporan pajak/Faktur Pajak SHALL dijelaskan perbedaannya.
4. THE keputusan D-21 SHALL dicatat di decision log sebelum `finance_enforce_fiscal_period` diaktifkan di produksi.

### Requirement 10: Non-fungsional

#### Acceptance Criteria

1. THE checklist periode dengan ≥1 juta baris jurnal SHALL selesai ≤ 60 detik (komponen berat memakai proyeksi Fase 5).
2. THE tabel/model baru SHALL mendeklarasikan kolom eksplisit di migration dan diuji terhadap `initPermissions()` (F-12); izin: `FiscalPeriod` (`close_period`, `hard_close_period`, `reopen_period`, `post_in_soft_closed`, `override_close_warning`), `FxRevaluation` (`select`, `read`, `post`), `YearEndClosing` (`close`, `reopen`).
3. THE seluruh migration aditif dengan `down()`; migrasi status `closed → hard_closed` reversible.
4. THE seluruh perubahan perilaku (penegakan) SHALL dapat dimatikan lewat preferensi tanpa deploy.

## Pertanyaan yang Menunggu Konfirmasi

| ID | Pertanyaan | Dampak |
|---|---|---|
| D-21 | Tanggal pembukuan: tanggal dokumen atau tanggal approve (sekarang)? Menentukan periode jurnal, pajak, dan makna penutupan | Requirement 9, seluruh fase |
| D-22 | Kebijakan soft vs hard close: apa yang boleh ditunda hingga hard close; siapa memegang izin `post_in_soft_closed` dan `hard_close_period` | Requirement 1, 2.8 |
| D-23 | Penutupan/pembukaan wajib berurutan antarperiode? | Requirement 2.2(h), 7.3 |
| D-24 | Akun laba ditahan (dan akun "Laba" di seeder = laba tahun berjalan atau laba ditahan?) | Requirement 6.9 |
| Q-P6-1 | Frekuensi revaluasi (bulanan/triwulan/tahunan) dan kurs closing mana yang dipakai (BI JISDOR, kurs pajak) | Requirement 4.3 |
| Q-P6-2 | Pos moneter lain yang perlu direvaluasi (mis. pinjaman valas, uang muka valas) | Requirement 4.2 |
| Q-P6-3 | Perlukah periode penyesuaian ke-13 untuk jurnal audit pasca-tutup? | Requirement 6 |
