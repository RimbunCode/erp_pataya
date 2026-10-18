# Requirements Document

## Introduction

Fase 2 dari 7 fase program **Finance Engine** (lihat `docs/prd/finance-engine-prd.md`). Fase 1 membuat semua penulisan GL melewati `JournalService`, tetapi *pemilihan akun* dan *bentuk jurnal* masih tersebar di 10 listener/service dan sebagian memakai pencarian rapuh `where('account_type', …)->latest()->first()` (F-06). Fase ini memusatkan keduanya ke **Posting Engine**: modul bisnis menyerahkan `PostingContext` (angka bernama + sumber), engine memutuskan akun lewat **peran akun (account role)** yang di-resolve dari **Posting Profile** berversi, lalu menghasilkan jurnal.

Selain itu fase ini memperbaiki perilaku pembatalan: dari soft-delete GL (F-04) menjadi jurnal pembalik, dan menutup balapan cancel-vs-posting-asinkron (F-16) — keduanya bergantung pada keputusan **D-13** (PENDING).

**Prinsip fase:** *parity dulu, perubahan kemudian.* Setiap jenis dokumen dimigrasikan di balik feature flag tiga mode (`off` → `shadow` → `on`), dan hasil engine harus identik dengan jalur lama (jurnal Fase 1) sebelum diaktifkan. Posting Profile default dibangkitkan dari COA yang ada sehingga hasilnya sama dengan pencarian `account_type` sekarang.

**Prasyarat:** Fase 1 selesai (JournalService, adapter, backfill hijau) dan spec `module-settings-foundation` menyediakan tempat penyimpanan setting Finances (D-25). D-1 (mode posting) dan D-13 (perilaku cancel) terjawab — atau bagian yang bergantung padanya (Requirement 9 dan 10) ditunda tanpa memblokir sisanya.

**Keputusan 2026-10-18 yang membentuk fase ini** (lihat PRD D-4, D-25, D-26, D-27):

- **Akun ditentukan seluruhnya oleh konfigurasi.** Dokumen transaksi tidak lagi menerima input akun; kolom akun di DB dipertahankan sebagai catatan audit yang diisi engine (Requirement 13).
- **Cakupan global.** Satu perusahaan; cabang hanyalah dimensi jurnal. Posting Profile tidak memiliki cakupan per cabang.
- **Aturan akun bersyarat dan varian retur.** Akun dapat berbeda menurut jenis dokumen, retur, serta tipe/kategori/status stok barang (Requirement 12).
- **Setting disimpan di tabel setting modul**, bukan tabel `preferences` (D-25).
- **Posting diskon terpisah** ditambahkan sebagai bagian GATED dengan tanggal cutover (Requirement 14).

**Di luar scope:**
- Pemisahan baris pajak dan versi aturan pajak (Fase 3). Rule Fase 2 meniru bentuk jurnal sekarang (total ke satu akun); *tempat* untuk baris pajak disiapkan lewat peran `tax_output`/`tax_input` tetapi belum dipakai.
- Alokasi pembayaran dan FX (Fase 4).
- Mengubah queue ↔ sinkron secara global (D-1). Fase ini hanya menyediakan sakelar eksekusi per jenis dokumen (Requirement 9).
- Perbaikan F-10 (nilai GL Payment kumulatif). Bila dikonfirmasi bug (Fase 0), perbaikan masuk sebagai langkah sadar di rule Payment dengan parity-diff yang dicatat, bukan diam-diam.

## Glossary

- **Account role / peran akun**: kunci logis akun (mis. `receivable`, `revenue`, `stock`) yang di-resolve menjadi `accounts.id` nyata.
- **Posting Profile**: himpunan pemetaan peran → akun default untuk seluruh perusahaan, berlaku pada rentang tanggal (*effective dating*); dapat memuat **aturan akun bersyarat**.
- **Posting Context**: DTO netral-modul yang menyerahkan jenis dokumen, sumber, tanggal, cabang (dimensi jurnal), pihak, jumlah bernama, bendera (retur), akun master, dan baris beratribut barang.
- **Posting Rule**: strategi per jenis dokumen yang mengubah `PostingContext` menjadi satu atau lebih `JournalDraft` berisi peran (bukan akun).
- **Legacy account fallback**: pencarian akun lama berdasarkan `(root_type, account_type)`; dipertahankan sementara sebagai lapis terakhir resolver untuk menjamin parity.
- **Aturan akun bersyarat (Account Rule)**: baris pada profil yang memetakan (jenis dokumen, varian, atribut barang) → akun untuk satu peran; menimpa akun default peran saat kondisinya cocok.
- **Varian dokumen**: `normal` atau `return` (retur: Credit/Debit Note, Sales/Purchase Return).
- **Akun master**: akun yang melekat pada data master, bukan pada transaksi: `default_account_id` Metode Pembayaran dan `AssetCategoryAccount`.
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

**User Story:** Sebagai akuntan, saya ingin mengatur akun default tiap peran untuk seluruh perusahaan dan per periode berlaku, so that perubahan COA tidak memerlukan perubahan kode.

#### Acceptance Criteria

1. THE sistem SHALL membuat tabel `posting_profiles` (`name`, `effective_from`, `effective_to` nullable, `status` `draft`/`active`/`retired`, `version`, catatan) dan `posting_profile_accounts` (`posting_profile_id`, `role` string, `account_id`), unik `(posting_profile_id, role)`. Profil bersifat **global**: tidak ada kolom cakupan atau cabang.
2. THE sistem SHALL menolak dua profil `active` dengan rentang tanggal yang tumpang-tindih.
3. THE sistem SHALL menolak penetapan akun yang `is_group`, `is_disabled`, atau terhapus pada `posting_profile_accounts`.
4. THE profil `active` yang sudah dipakai posting SHALL tidak diedit di tempat; perubahan dilakukan dengan membuat versi baru (salinan) dengan `effective_from` baru, dan versi lama diberi `effective_to`.
5. THE sistem SHALL menyediakan perintah `finance:init-posting-profile` yang membangkitkan profil awal dari COA saat ini memakai pemetaan legacy Requirement 1.2, melaporkan peran yang tidak dapat di-resolve, dan idempoten (tidak menduplikasi bila profil awal sudah ada).
6. THE perubahan profil SHALL tercatat (siapa, kapan, sebelum/sesudah) sesuai mekanisme audit yang dipilih di Fase 1 (Task 1.4).

### Requirement 3: Resolusi peran → akun

**User Story:** Sebagai pemilik produk, saya ingin akun ditentukan oleh aturan yang dapat dijelaskan dan konsisten, so that hasil posting dapat diprediksi dan diaudit.

#### Acceptance Criteria

1. THE sistem SHALL menyediakan `AccountRoleResolver::resolve(AccountRole|string $role, PostingContext $ctx, ?LineAttributes $line = null): Account` dengan urutan prioritas tetap:
   1. **akun master** yang dibawa `PostingContext` dari konfigurasi master, bukan input transaksi: `cash_or_bank` dari metode pembayaran, peran aset dari `AssetCategoryAccount`;
   2. **aturan akun bersyarat** pada profil `active` yang berlaku pada `transaction_date` (Requirement 12) yang cocok dengan jenis dokumen, varian, dan atribut barang `$line`;
   3. **akun default peran** pada profil `active` yang berlaku pada `transaction_date`;
   4. *legacy account fallback* `(root_type, account_type)` — hanya bila konfigurasi `finance.posting.legacy_account_fallback` aktif (default aktif selama transisi).
2. IF tidak ada lapis yang menghasilkan akun, THEN THE resolver SHALL melempar `UnresolvedAccountRoleException` yang menyebut peran, jenis dokumen, varian, tanggal, dan lapis yang diperiksa.
3. WHEN lapis 4 dipakai, THE resolver SHALL mencatat peringatan terstruktur (peran, jenis dokumen) agar sisa ketergantungan legacy dapat dihitung.
4. THE resolver SHALL deterministik: input sama → akun sama; saat pilihan legacy `latest()->first()` ambigu (lebih dari satu akun cocok), resolver SHALL mengambil yang ditetapkan profil, dan jika lewat fallback legacy SHALL memilih berdasarkan `created_at` terbaru **dan** mencatat peringatan ambiguitas.
5. THE resolver SHALL men-cache hasil per `(profil, peran)` selama satu request/job dan tidak melakukan query berulang untuk peran yang sama.
6. THE resolver SHALL menghasilkan akun terkunci bila dipanggil dalam transaksi posting (pengunciaan tetap dilakukan oleh `JournalService`, Fase 1 Req. 2.7); resolver sendiri tidak menahan kunci lama.

### Requirement 4: Posting Context dan Posting Rule

**User Story:** Sebagai developer modul bisnis, saya ingin menyerahkan fakta transaksi tanpa tahu akuntansi, so that modul tidak menyentuh akun.

#### Acceptance Criteria

1. THE sistem SHALL mendefinisikan `PostingContext` (readonly) dengan: `documentType` (enum `PostingDocumentType`), referensi sumber (`sourceType`, `sourceId`), `transactionDate`, `branchId`, `party` (opsional), `amounts` (peta nama → jumlah, mis. `total`, `stock_total`, `write_off`), `flags` (mis. `is_return`), `masterAccounts` (peta peran → `account_id` dari konfigurasi master), dan `lines` (baris dengan jumlah bernama dan atribut barang `item_type`, `is_stock_item`, `item_category_id`; kosong untuk dokumen tanpa barang).
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

1. THE sistem SHALL menyimpan mode per `PostingDocumentType` pada setting Finances (`finance_posting_mode.{type}` dengan nilai `off`/`shadow`/`on`, default `off`) dan membacanya saat runtime tanpa deploy.
2. WHEN mode `off`, THE listener/service SHALL memakai jalur Fase 1 (`postPair`) seperti sekarang.
3. WHEN mode `shadow`, THE listener/service SHALL tetap menulis lewat jalur lama, lalu memanggil `PostingService::preview()` dengan konteks yang sama dan membandingkan hasilnya dengan jurnal yang baru ditulis, mencatat hasil ke tabel `posting_parity_logs`; kegagalan/eksepsi engine pada mode `shadow` SHALL TIDAK menggagalkan posting lama.
4. WHEN mode `on`, THE listener/service SHALL memanggil `PostingService::post()` dan tidak memakai jalur lama.
5. THE perbandingan parity SHALL memeriksa himpunan (akun, debit, credit, tanggal) per jurnal dan jumlah jurnal; perbedaan nilai dalam toleransi satu minor unit tidak dihitung sebagai ketidakcocokan, melainkan dicatat sebagai `rounding`. Perbedaan yang hanya disebabkan akun yang dipilih pengguna pada dokumen lama berbeda dari akun hasil konfigurasi dicatat sebagai `config_diff` (bukan `mismatch`) beserta akun kedua sisi.
6. THE `posting_parity_logs` SHALL menyimpan: jenis dokumen, sumber, status (`match`/`rounding`/`config_diff`/`mismatch`/`engine_error`), ringkasan legacy dan engine (JSON), dan waktu.
7. THE sistem SHALL menyediakan perintah `finance:parity-report {--type=} {--since=}` yang meringkas jumlah match/mismatch/error per jenis dokumen.
8. THE perubahan mode ke `on` SHALL tercatat (siapa, kapan) dan hanya dapat dilakukan oleh pengguna ber-izin khusus.

### Requirement 7: Migrasi 10 titik posting

**User Story:** Sebagai pemilik produk, saya ingin seluruh titik posting memakai engine, so that tidak ada lagi pemilihan akun tersebar di kode.

#### Acceptance Criteria

1. THE urutan migrasi SHALL mengikuti risiko menaik: (1) Asset (depresiasi, scrap, penyesuaian nilai, disposal), (2) Payment Entry, (3) Purchase Receipt, (4) Delivery Note, (5) Sales Invoice, (6) Purchase Invoice, (7) Stock Entry.
2. FOR setiap jenis dokumen, THE kriteria sebelum mode `on` SHALL: (a) test parity unit (fixture characterization Fase 0) hijau; (b) minimal 200 dokumen atau 14 hari di mode `shadow` pada staging dengan 0 `mismatch` yang tidak dijelaskan; (c) persetujuan pemilik produk.
3. WHEN jenis dokumen berpindah ke `on`, THE query pencarian akun `where('account_type', …)->latest()->first()` pada jalur itu SHALL dihapus dari kode; `grep` CI SHALL gagal bila pola tersebut muncul pada listener/service yang sudah `on`.
4. THE pabrik `PostingContext` untuk tiap dokumen SHALL membawa akun master (metode pembayaran, `AssetCategoryAccount`) dan atribut barang tiap baris; pabrik TIDAK membaca kolom akun yang dipilih pengguna pada dokumen. Kolom akun dokumen diisi oleh engine saat posting sebagai catatan audit (Requirement 13.2).
5. THE `StockEntryService` SHALL tetap memutasi `accounts.balance_amount` sampai Fase 5 mempensiunkannya; engine tidak memutasinya.
6. IF mode `on` ditemukan menghasilkan `UnresolvedAccountRoleException` di produksi, THEN THE job SHALL gagal ke `GlPostingStatus=failed` dengan pesan jelas dan dapat dicoba ulang setelah profil dilengkapi, tanpa mem-fallback diam-diam ke jalur lama.

### Requirement 8: Antarmuka Posting Profile dan pemantauan parity

**User Story:** Sebagai akuntan, saya ingin mengelola profil akun dan melihat hasil parity dari UI, so that saya tidak perlu developer untuk mengubah akun posting.

#### Acceptance Criteria

1. THE sistem SHALL menyediakan halaman daftar dan form Posting Profile (nama, periode berlaku, status, tabel peran → akun default, dan tabel aturan akun bersyarat; pemilih akun hanya menampilkan akun non-group dan aktif).
2. THE halaman SHALL menyediakan aksi "Buat versi baru" (salin) dan "Aktifkan", serta menampilkan peringatan bila ada peran wajib untuk jenis dokumen aktif yang belum terpetakan.
3. THE sistem SHALL menyediakan halaman daftar Parity Log (filter jenis dokumen/status) dan tombol ubah mode per jenis dokumen (izin khusus).
4. THE kunci terjemahan baru SHALL tersedia di `lang/id` dan `lang/en` (`LocaleKeysTest` hijau); komponen React baru memiliki test `.rtl.test.jsx`.
5. THE halaman Posting Profile dan Parity Log SHALL didaftarkan sebagai menu item pada grup setting dan tampil di desk Core serta Finances, mengikuti aturan menu spec `module-settings-foundation` (datar bila satu item pada sebuah desk, submenu bila lebih).

### Requirement 9: Sakelar eksekusi queue vs inline (GATED — bergantung D-1)

**User Story:** Sebagai pemilik produk, saya ingin memilih apakah posting suatu jenis dokumen berjalan inline atau via queue, so that konsistensi GL dengan dokumen dapat ditingkatkan di titik yang penting tanpa membalik keputusan lama.

#### Acceptance Criteria

1. IF D-1 diputuskan opsi A, THEN Requirement 9 SHALL dikeluarkan dari fase ini.
2. IF D-1 diputuskan opsi B atau C, THEN THE sistem SHALL menyediakan setting `finance_posting_execution.{type}` (`queue`/`inline`, default `queue`) dan jalur `inline` yang memanggil `PostingService::post()` dalam transaksi dokumen sumber, dengan `GlPostingStatus` dibuat langsung bernilai `posted` bila sukses.
3. WHEN mode `inline` gagal, THE seluruh transaksi dokumen SHALL dibatalkan (dokumen tidak berstatus approved tanpa GL).
4. THE jalur `inline` SHALL tidak dipakai untuk jenis dokumen yang terjalin dengan mutasi Stock/SLE (Purchase Receipt, Delivery Note, Purchase Invoice cabang stok) kecuali ada keputusan eksplisit — alasan keputusan Fase 3 event-listener (`event-listener-migration-phase-3`).
5. THE perubahan sakelar SHALL tercatat dan dapat dibalik tanpa deploy.

### Requirement 10: Pembatalan sebagai reversal (GATED — bergantung D-13)

**User Story:** Sebagai auditor, saya ingin pembatalan dokumen meninggalkan jejak jurnal pembalik, so that riwayat tidak hilang dan periode lampau tidak berubah diam-diam.

#### Acceptance Criteria

1. IF D-13 diputuskan opsi A (pertahankan soft-delete), THEN Requirement 10 SHALL dikeluarkan dari fase ini kecuali butir 10.5 (guard F-16).
2. IF D-13 diputuskan opsi B, THEN THE sistem SHALL menyediakan `DocumentCancellationLedgerService::handle(Model $document)` yang untuk setiap jurnal `posted` bersumber dokumen tersebut memanggil `JournalReversalService::reverse()` dengan tanggal = tanggal pembatalan (atau hari ini bila periode asal tertutup).
3. THE hook `saving` pada `Submitable` SHALL memanggil service tersebut menggantikan update massal soft-delete GL, dikendalikan setting `finance_cancel_mode` (`soft_delete` default / `reversal`), sehingga perilaku dapat dibalik tanpa deploy; soft-delete **SLE** tetap berjalan (bukan bagian Finance Engine).
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

### Requirement 12: Aturan akun bersyarat dan varian retur

**User Story:** Sebagai akuntan, saya ingin akun dipilih otomatis menurut jenis dokumen, retur, dan jenis barang, so that user transaksi tidak perlu memahami akun mana yang harus dipakai.

#### Acceptance Criteria

1. THE sistem SHALL membuat tabel `posting_profile_rules` (`posting_profile_id`, `document_type` nullable, `variant` nullable `normal`/`return`, `role`, `item_type` nullable, `is_stock_item` nullable boolean, `item_category_id` nullable FK, `account_id` FK `restrictOnDelete`, `priority` unsigned integer, timestamps). Kondisi bernilai null berarti tidak dibatasi.
2. THE aturan SHALL cocok bila semua kondisi non-null sama dengan konteks. THE aturan paling spesifik (kondisi non-null terbanyak) SHALL menang; bila sama, `priority` lebih tinggi menang; dua aturan dengan kombinasi kondisi identik untuk peran yang sama pada satu profil SHALL ditolak saat disimpan.
3. WHEN konteks berbendera `is_return`, THE resolver SHALL mencoba aturan `variant=return` lebih dulu; bila tidak ada yang cocok, SHALL memakai aturan `normal`/tanpa varian dan Posting Rule menukar sisi seperti perilaku sekarang. Retur tanpa konfigurasi khusus karenanya berperilaku sama dengan sekarang.
4. THE enum `AccountRole` SHALL menandai peran peka-barang (`isLineSensitive()`), minimal: `revenue`, `expense`, `cost_of_goods_sold`, `stock`, `stock_adjustment`, `expense_included_in_valuation`. Peran peka-barang SHALL dievaluasi per baris `lines`, lalu baris dengan akun sama digabung menjadi satu baris jurnal; peran tingkat dokumen (`receivable`, `payable`, `tax_*`, `cash_or_bank`) dievaluasi sekali.
5. THE penyimpanan aturan SHALL menolak akun `is_group`/`is_disabled`, dan menolak kondisi barang pada peran yang bukan peka-barang.
6. THE versi baru profil SHALL menyalin aturannya; aturan mengikuti *effective dating* profil.
7. THE `finance:init-posting-profile` SHALL hanya membangkitkan akun default (jaminan parity) dan tidak membuat aturan bersyarat; usulan aturan awal (mis. barang non-stok → akun beban tertentu; retur → akun Retur Penjualan/Retur Pembelian) dilaporkan untuk disusun bersama akuntan.
8. THE kolom `accounts.is_contra` (non-standar) SHALL tidak dipakai engine, resolver, maupun pemilihan akun, dan SHALL dihapus (Requirement 13.8). Retur memakai akun lewat aturan `variant=return`, bukan flag akun.

### Requirement 13: Akun ditentukan konfigurasi, bukan input pengguna

**User Story:** Sebagai user transaksi, saya tidak ingin memilih akun pada form dokumen, so that pencatatan konsisten dan tidak bergantung pemahaman akuntansi saya.

#### Acceptance Criteria

1. WHEN sebuah jenis dokumen berada pada mode `on`, THE form dan request validasi dokumen itu SHALL tidak lagi menerima input akun transaksi: Sales Invoice (`debit_account_id`, `income_account_id`), Purchase Invoice (`credit_account_id`, `expanse_head_account_id`), Payment Entry (`account_paid_from_id`, `account_paid_to_id`), Stock Entry (`difference_account_id`), Additional Cost (`expense_account_id`), dan Asset Value Adjustment (`difference_account_id`).
2. THE kolom-kolom tersebut SHALL dipertahankan di DB dan diisi engine saat posting sebagai catatan audit akun yang dipakai. Untuk peran peka-barang, akun per baris SHALL disimpan pada kolom baru di tabel item dokumen terkait (FK nullable `restrictOnDelete`).
3. THE pengecualian SHALL terbatas pada: baris Jurnal Manual (D-14), karena akun adalah isi transaksi itu sendiri; serta master Metode Pembayaran dan `AssetCategoryAccount`, yang merupakan konfigurasi master.
4. THE halaman form dan detail dokumen SHALL menampilkan panel baca-saja "Akun pencatatan": hasil `PostingService::preview()` sebelum approve, dan kolom tercatat sesudah approve.
5. THE kode controller yang mengisi default akun dari `account_type` atau `is_contra` (mis. `SalesInvoiceController`) SHALL dihapus bersamaan perpindahan jenis dokumen ke `on`.
6. THE dokumen yang dibuat sebelum cutover SHALL tidak diubah; kolom lamanya tetap menunjukkan akun yang dulu dipilih pengguna.
7. IF peran tidak ter-resolve saat approve, THEN THE dokumen SHALL tidak berstatus approved tanpa pesan jelas yang menunjuk peran dan halaman konfigurasi yang harus dilengkapi.
8. WHEN seluruh jenis dokumen berada pada mode `on` dan pemakaiannya pada form telah dihapus, THE kolom `accounts.is_contra` SHALL dihapus lewat migrasi reversible beserta cast dan `configColumns` pada `Account`, kunci terjemahan terkait, flag pada `AccountSeeder` (akun Retur Penjualan dan Potongan Penjualan tetap ada sebagai akun biasa), dan seluruh rujukan di `SalesInvoiceController` serta form Sales/Purchase Invoice; laporan Fase 5 memakai saldo bertanda sehingga tidak bergantung pada kolom ini.

### Requirement 14: Posting diskon terpisah (GATED — perubahan perilaku)

**User Story:** Sebagai akuntan, saya ingin diskon penjualan dan pembelian tercatat pada akun diskon tersendiri, so that laporan laba rugi menunjukkan penjualan kotor dan potongannya.

#### Acceptance Criteria

1. THE sistem SHALL menyediakan setting Finances `finance_discount_split_from.{sales_invoice|purchase_invoice}` (tanggal; kosong = tidak aktif, default kosong). Dokumen bertanggal sebelum tanggal itu tetap memakai bentuk jurnal sekarang (total bersih).
2. WHEN aktif untuk Sales Invoice, THE rule SHALL memposting `receivable` debit sebesar total bersih, `discount` debit sebesar jumlah diskon, dan `revenue` kredit sebesar jumlah kotor; jurnal tetap seimbang. Diskon baris dan diskon dokumen sama-sama dicakup.
3. WHEN aktif untuk Purchase Invoice, THE baris non-stok SHALL memakai pola serupa dengan `discount` kredit (potongan pembelian); baris stok SHALL tetap bersih karena diskon mengurangi nilai persediaan (asumsi yang menunggu konfirmasi akuntan, Q-P2-5).
4. THE peran `discount` SHALL sudah terpetakan pada profil aktif sebelum tanggal cutover boleh diisi; bila tidak, penyimpanan setting ditolak dengan pesan jelas.
5. THE perhitungan dasar pajak (DPP bersih setelah diskon) SHALL tidak berubah; Fase 3 tetap memegang pajak.
6. THE perbedaan bentuk jurnal pada mode `shadow` setelah cutover aktif SHALL dicatat dengan alasan `discount_split` agar tidak dianggap regresi.
7. THE pembulatan dan selisih kurs berada di luar requirement ini (lihat Fase 3 Requirement 8, Fase 4, dan Fase 6).

## Pertanyaan yang Menunggu Konfirmasi

| ID | Pertanyaan | Dampak |
|---|---|---|
| D-1 | Mode posting (opsi A/B/C) | Requirement 9 |
| D-13 | Perilaku pembatalan (soft-delete vs reversal) | Requirement 10 |
| Q-P2-1 | Siapa yang menyetujui perpindahan mode `on` per jenis dokumen? | Requirement 6.8, 7.2 |
| Q-P2-2 | Apakah COA saat ini sudah memisah akun PPN Masukan/Keluaran (seeder hanya memiliki `account_type = tax`)? Menentukan peta peran `tax_*` di profil default | Requirement 1, Fase 3 |
| Q-P2-3 | Apakah F-10 (Payment kumulatif) diperbaiki saat migrasi Payment atau sebagai hotfix terpisah? | Requirement 7 |
| Q-P2-4 | Daftar awal aturan akun bersyarat (barang non-stok, retur, kategori) disusun bersama akuntan saat `init-posting-profile` | Requirement 12.7 |
| Q-P2-5 | Perlakuan diskon pembelian untuk baris stok (net ke persediaan) dan non-stok (potongan pembelian) | Requirement 14.3 |
