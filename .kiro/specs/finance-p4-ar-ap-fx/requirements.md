# Requirements Document

## Introduction

Fase 4 dari 7 fase program **Finance Engine** (lihat `docs/prd/finance-engine-prd.md`). Fase ini membuat piutang/utang (AR/AP) dapat diturunkan dari ledger per pihak dan per dokumen, mengganti model pembayaran 1-ke-1 menjadi **alokasi pembayaran N:M**, dan memperkenalkan **FX Engine**: master kurs bertipe, konversi yang dapat dijelaskan, dan pengakuan **selisih kurs terealisasi** saat pelunasan.

Kondisi nyata yang membentuk fase ini (diverifikasi di kode):

- `payment_entries` terhubung ke **satu** dokumen lewat morph `paymentable` (Sales/Purchase Invoice). Distribusi ke termin hanya terjadi di dalam satu invoice (`payment_schedules.paid_amount`, `PaymentEntryService::onApproved`). Tidak ada uang muka, tidak ada satu pembayaran untuk banyak invoice.
- Invoice menyimpan `exchange_rate` tunggal; kolom `paid_amount_base_currency` dan `outstanding_amount_base_currency` adalah *generated* `paid_amount × exchange_rate` — pelunasan selalu dinilai pada **kurs invoice**, sehingga selisih kurs tidak pernah muncul (F-11).
- GL pembayaran tidak memperhitungkan `exchange_rate` dan memposting nilai dari `paid_amount` dokumen setelah `PaymentApplied` (dugaan F-10).
- Listener posting invoice tidak mengisi `partyable_*` pada baris GL, jadi buku besar pembantu per pihak tidak dapat diturunkan dari ledger (F-18).
- Mata uang dasar berasal dari setting umum `default_currency_id`; `Currency::convertMoney` hanya perkalian; tidak ada master kurs.
- Retur diperlakukan sebagai invoice dengan `return_against_id`.

**Prasyarat:** Fase 1 (JournalService, kolom `foreign_*`/`exchange_rate` pada baris jurnal, `minor_unit`) dan Fase 2 (Posting Engine untuk Payment Entry, Sales Invoice, Purchase Invoice dalam mode `on`) selesai. Fase 3 diutamakan selesai untuk pajak pada alokasi, tetapi tidak memblokir. Kebijakan kurs **D-16** dan pengakuan selisih kurs **D-17** harus disetujui akuntan sebelum Task 6.

**Di luar scope:**
- Revaluasi *unrealized* FX dan jurnal penutup (Fase 6); fase ini hanya selisih kurs **terealisasi** saat pelunasan.
- Penyedia kurs otomatis (API Bank Indonesia/ECB). Fase ini menyediakan antarmuka `ExchangeRateProvider` dan penyedia **manual/CSV**; penyedia API ditambahkan kemudian.
- Rekonsiliasi bank otomatis, ISO 20022, cek/giro mundur.
- Laporan aging dan buku besar pihak (Fase 5); fase ini menyediakan **layanan**-nya.
- Pembayaran silang mata uang di mana mata uang pembayaran, mata uang invoice, dan mata uang dasar ketiganya berbeda (dicatat sebagai batasan; ditolak dengan pesan jelas).

## Glossary

- **Sub-ledger AR/AP / buku besar pembantu**: rincian piutang/utang per pihak dan per dokumen yang totalnya sama dengan saldo akun kontrol (receivable/payable) di GL.
- **Open item**: invoice (atau uang muka) yang masih memiliki sisa belum teralokasi.
- **Payment Allocation**: baris yang menyatakan sebagian pembayaran dipakai melunasi satu dokumen.
- **Uang muka / advance**: pembayaran tanpa invoice; jumlah tak teralokasi dicatat pada akun uang muka dan dapat dialokasikan kemudian.
- **Kurs invoice / kurs pembayaran**: kurs yang berlaku saat invoice diposting / saat pembayaran diposting.
- **Realized FX**: selisih nilai dasar antara kurs invoice dan kurs pembayaran atas bagian yang dilunasi; keuntungan (+) atau kerugian (−).
- **Rate type**: `spot`, `transaction`, `closing`, `contract`, `historical`.
- **Mata uang dasar**: `default_currency_id`; mata uang fungsional ledger.

## Requirements

### Requirement 1: Master kurs bertipe

**User Story:** Sebagai akuntan, saya ingin mengelola kurs per tipe dan tanggal, so that setiap konversi dapat ditelusuri ke kurs, tanggal, dan sumbernya.

#### Acceptance Criteria

1. THE sistem SHALL membuat tabel `exchange_rates` dengan: `from_currency_code`, `to_currency_code` (FK `currencies`), `rate_type` (`spot`/`transaction`/`closing`/`contract`/`historical`), `rate` (`decimal(20,8)` > 0), `rate_date` (date), `source` (`manual`/`import`/`provider`), `source_ref` (nullable), `created_by_id`, timestamps; unik `(from_currency_code, to_currency_code, rate_type, rate_date)`.
2. THE sistem SHALL menolak `from = to`, `rate <= 0`, dan kurs untuk kode mata uang yang tidak ada.
3. THE kurs yang sudah dirujuk transaksi SHALL tidak diubah; koreksi dilakukan dengan baris baru pada tanggal/tipe yang sama hanya jika belum dirujuk, atau dengan tipe/tanggal berbeda; upaya mengubah kurs yang dirujuk ditolak.
4. THE sistem SHALL menyediakan antarmuka `ExchangeRateProvider` dengan penyedia `ManualProvider` (input UI) dan `CsvImportProvider` (impor berkas dengan validasi per baris dan laporan galat), tanpa ketergantungan jaringan.
5. THE halaman Kurs SHALL menampilkan daftar (filter pasangan/tipe/tanggal), form tambah, dan impor CSV, di balik izin `ExchangeRate` (`select`, `read`, `write`, `import`).

### Requirement 2: `FxEngine` dan konversi yang dapat dijelaskan

**User Story:** Sebagai pengguna, saya ingin tahu kurs apa yang dipakai suatu konversi, so that angka dapat dipertanggungjawabkan.

#### Acceptance Criteria

1. THE sistem SHALL menyediakan `ExchangeRateService::get(from, to, date, type): ExchangeRate` yang mengambil kurs pada tanggal tepat; bila tidak ada, kurs dengan tanggal terdekat sebelumnya dalam batas `finance_fx_max_age_days` (default 7); bila tetap tidak ada → `NoExchangeRateException` yang menyebut pasangan, tipe, dan tanggal.
2. THE sistem SHALL menyediakan kurs kebalikan (`to→from = 1/rate`) hanya bila setting `finance_fx_allow_inverse` aktif (default aktif), dan menandainya pada hasil.
3. THE sistem SHALL menyediakan `FxEngine::convert(amount, from, to, date, type): FxConversion` yang mengembalikan `amount`, `rate`, `rate_type`, `rate_date`, `source`, `inverse` (bool), dan pembulatan HALF_UP ke minor unit mata uang tujuan.
4. WHEN `from = to`, THE konversi SHALL mengembalikan jumlah yang sama dengan `rate = 1` tanpa mencari kurs.
5. THE `FxConversion` SHALL dapat diserialisasi dan dipakai sebagai penjelasan pada UI.
6. THE `Currency::convertMoney` yang ada SHALL ditandai deprecated dan tidak dipakai kode baru.

### Requirement 3: Jejak kurs pada dokumen dan jurnal

**User Story:** Sebagai auditor, saya ingin dokumen dan jurnal menyimpan kurs beserta tipe, tanggal, dan sumbernya, so that transaksi dapat direkonstruksi.

#### Acceptance Criteria

1. THE sistem SHALL menambah kolom `exchange_rate_type`, `exchange_rate_date`, `exchange_rate_source` (nullable) pada `sales_invoices`, `purchase_invoices`, dan `payment_entries`.
2. WHEN dokumen berhasil diposting dengan mata uang ≠ mata uang dasar, THE kolom jejak kurs SHALL terisi dari `FxConversion` yang dipakai; invoice lama tanpa jejak tetap valid (null = legacy).
3. THE baris jurnal piutang/utang dalam mata uang asing SHALL mengisi `foreign_currency_code`, `foreign_debit`/`foreign_credit`, dan `exchange_rate` (kolom dari Fase 1); baris dalam mata uang dasar membiarkannya null.
4. THE `JournalService` SHALL memvalidasi bahwa untuk baris berkolom asing, `debit/credit` dasar sama dengan `foreign × exchange_rate` dalam toleransi satu minor unit (`InvalidJournalException` bila tidak).
5. THE kurs dokumen SHALL berasal dari `FxEngine` (tipe `transaction` untuk invoice dan pembayaran secara default; dapat dioverride pengguna ber-izin dengan alasan tercatat), bukan diketik bebas tanpa jejak, kecuali impor legacy.

### Requirement 4: Jurnal piutang/utang membawa pihak dan referensi

**User Story:** Sebagai akuntan, saya ingin saldo piutang/utang per pihak berasal dari ledger, so that sub-ledger dan GL tidak pernah berbeda.

#### Acceptance Criteria

1. THE rule posting Sales Invoice dan Purchase Invoice SHALL menyertakan `party` (customer/supplier) pada baris peran `receivable`/`payable`, sehingga `general_ledgers.partyable_*` terisi pada posting baru (F-18).
2. THE jurnal legacy yang tidak memiliki `partyable_*` SHALL di-backfill pada baris receivable/payable dengan mengambil pihak dari dokumen sumber (`referenceable`), secara idempoten, tanpa mengubah `debit`/`credit`.
3. THE sistem SHALL menyediakan `PartyLedgerService`: `openItems(party, asOf)`, `balance(party, asOf)`, `statement(party, from, to)` yang bersumber dari baris jurnal akun kontrol dan alokasi.
4. THE total `balance` seluruh pihak untuk akun kontrol SHALL sama dengan saldo GL akun kontrol itu pada tanggal yang sama (Requirement 9).
5. THE akun kontrol SHALL ditentukan oleh peran `receivable`/`payable` (Posting Profile) serta override akun pada dokumen, sehingga lebih dari satu akun kontrol didukung.

### Requirement 5: Payment Allocation (N:M)

**User Story:** Sebagai staf keuangan, saya ingin satu pembayaran melunasi beberapa invoice (atau sebagian), dan menyimpan uang muka, so that alur kas sesuai praktik.

#### Acceptance Criteria

1. THE sistem SHALL membuat tabel `payment_allocations`: `payment_entry_id`, `allocatable_type`/`allocatable_id` (morph: Sales Invoice/Purchase Invoice), `kind` (`invoice`/`credit_note`/`advance_application`), `allocated_amount` (mata uang invoice), `payment_amount` (mata uang pembayaran), `invoice_rate`, `payment_rate`, `base_at_invoice_rate`, `base_at_payment_rate`, `realized_fx`, `status` (`active`/`reversed`), `journal_id` (nullable), timestamps.
2. THE `PaymentEntry` SHALL mendukung nol, satu, atau banyak alokasi; jumlah tak teralokasi (`paid_amount − Σ alokasi aktif`) diperlakukan sebagai uang muka.
3. THE alokasi SHALL ditolak jika: melebihi sisa belum dibayar dokumen, dokumen bukan milik pihak yang sama dengan pembayaran, dokumen berstatus draft/canceled, atau arah tidak sesuai (`receive`→Sales, `pay`→Purchase).
4. THE alur lama (satu `paymentable`) SHALL tetap berjalan: pembuatan Payment Entry dengan satu `paymentable` otomatis menghasilkan satu alokasi senilai pembayaran; UI lama tidak rusak.
5. THE `paid_amount`, `status` (`UNPAID`/`PARTIALLY_PAID`/`PAID`), dan distribusi termin (`payment_schedules.paid_amount`) pada dokumen SHALL tetap dipelihara oleh jalur existing (`PaymentApplied`/`UpdatePaymentableStatus`) berdasarkan alokasi, agar laporan dan UI lama konsisten.
6. THE sisa dokumen SHALL = `amount − Σ alokasi aktif (invoice) − Σ alokasi credit_note`; kolom `paid_amount` menjadi turunan yang direkonsiliasi (Requirement 9).
7. THE alokasi aktif SHALL tidak diubah; pembatalan Payment Entry membalik jurnal pelunasan dan menandai alokasi `reversed` (bergantung perilaku cancel D-13: pada mode `soft_delete` alokasi ditandai `reversed` dan jurnal di-soft-delete oleh hook yang ada).
8. THE uang muka yang kemudian dialokasikan SHALL menghasilkan jurnal reklasifikasi (uang muka → piutang/utang) pada tanggal alokasi.

### Requirement 6: Credit/debit note (retur) pada alokasi

**User Story:** Sebagai staf keuangan, saya ingin retur mengurangi sisa invoice asal atau dikompensasi ke invoice lain, so that saldo pihak benar.

#### Acceptance Criteria

1. THE retur (invoice dengan `return_against_id`) SHALL dapat dialokasikan terhadap invoice asalnya secara otomatis saat disetujui (alokasi `credit_note`) sebesar yang dapat diserap; sisa yang tidak terserap menjadi kredit terbuka pihak tersebut.
2. THE kredit terbuka SHALL dapat dialokasikan ke invoice lain milik pihak yang sama lewat form alokasi (tanpa Payment Entry; alokasi bersumber dokumen retur).
3. THE jurnal retur existing (Fase 2) SHALL tetap membalik sisi piutang/utang; alokasi `credit_note` tidak menghasilkan jurnal kas tambahan, hanya jurnal selisih kurs bila ada.
4. THE perilaku status retur existing (`RETURNED`) dan perhitungan `returned_quantity` SHALL tidak berubah.

### Requirement 7: Jurnal pelunasan dan selisih kurs terealisasi

**User Story:** Sebagai akuntan, saya ingin selisih kurs antara invoice dan pelunasan tercatat otomatis, so that laba rugi kurs benar.

#### Acceptance Criteria

1. THE rule posting Payment Entry (Fase 2) SHALL diganti oleh rule `payment_settlement` yang membentuk jurnal dari alokasi pembayaran **ini** (bukan dari total kumulatif dokumen), sehingga dugaan F-10 tidak dapat terjadi secara struktural.
2. FOR pembayaran penerimaan (`receive`) atas invoice penjualan: Debit akun kas/bank sebesar `base_at_payment_rate` total; Kredit piutang (`receivable`) sebesar `base_at_invoice_rate` per alokasi (dengan `party`, referensi invoice); selisih sebagai Kredit `fx_gain` atau Debit `fx_loss` sebesar |`realized_fx`|; uang muka (jika ada) Kredit `customer_advance`.
3. FOR pembayaran keluar (`pay`) atas invoice pembelian: arah dibalik dengan peran `payable`, `supplier_advance`, dan tanda selisih kurs dibalik (kurs naik pada utang = kerugian).
4. THE `realized_fx` per alokasi SHALL dihitung dari `base_at_payment_rate − base_at_invoice_rate` dengan tanda sesuai arah (Requirement 7.2–7.3), dibulatkan ke minor unit mata uang dasar; jumlah baris `fx_*` sama dengan Σ per alokasi.
5. WHEN invoice dan pembayaran sama-sama dalam mata uang dasar, THE `realized_fx` SHALL nol dan baris `fx_*` tidak dibuat.
6. THE jurnal pelunasan SHALL seimbang dan melewati `JournalService`; `postingKey` = `{PaymentEntry}:{id}:settlement`.
7. THE sistem SHALL menolak kombinasi tiga mata uang berbeda (invoice, pembayaran, dasar) dengan pesan jelas.
8. THE peran `fx_gain`, `fx_loss`, `customer_advance`, `supplier_advance`, dan `payment_difference` (selisih kecil dalam toleransi `finance_payment_tolerance`, default 0) SHALL ditambahkan ke katalog `AccountRole` dan dipetakan di Posting Profile; posting gagal dengan `UnresolvedAccountRoleException` bila perlu dan belum terpetakan.

### Requirement 8: Invoice mata uang asing

#### Acceptance Criteria

1. WHEN Sales/Purchase Invoice berkurs ≠ dasar diposting, THE jurnal piutang/utang SHALL membawa jumlah asing, kurs, dan jejak kurs (Requirement 3) dan nilai dasar = jumlah asing × kurs dibulatkan.
2. THE baris pendapatan/beban/pajak dalam mata uang asing SHALL dikonversi dengan kurs yang sama; selisih pembulatan ≤ 1 minor unit diserap oleh baris pendapatan/beban (selaras Fase 3).
3. THE kolom generated `*_base_currency` pada invoice SHALL tetap ada untuk kompatibilitas; sumber kebenaran nilai dasar untuk pelaporan keuangan adalah jurnal, bukan kolom tersebut.
4. THE sistem SHALL mendokumentasikan bahwa `paid_amount_base_currency` (generated, kurs invoice) bukan nilai kas dasar aktual; nilai kas dasar ada pada alokasi (`base_at_payment_rate`).

### Requirement 9: Rekonsiliasi sub-ledger

**User Story:** Sebagai operator, saya ingin peringatan bila sub-ledger tidak cocok dengan GL, so that selisih ketahuan lebih awal.

#### Acceptance Criteria

1. THE sistem SHALL menyediakan `finance:reconcile-subledger {--as-of=}` yang memeriksa: (a) Σ open items per akun kontrol = saldo GL akun kontrol; (b) `invoice.paid_amount` = Σ alokasi aktif (invoice) + advance_application; (c) setiap alokasi aktif memiliki jurnal (kecuali `credit_note` tanpa selisih); (d) tidak ada alokasi yang melebihi dokumen.
2. THE perintah SHALL dijadwalkan harian, keluar non-nol dan mencatat peringatan bila ada pelanggaran, dan melaporkan selisih per pihak.
3. THE perintah SHALL memperhitungkan dokumen legacy (pra-fase) lewat backfill alokasi (Requirement 10).

### Requirement 10: Backfill data historis

#### Acceptance Criteria

1. THE sistem SHALL menyediakan `finance:backfill-allocations {--dry-run}` yang untuk setiap Payment Entry berstatus approved/paid membuat satu alokasi `invoice` ke `paymentable`-nya, idempoten, tanpa mengubah jumlah/jurnal historis.
2. THE alokasi historis SHALL ditandai `legacy = true` dengan `realized_fx = 0` dan `payment_rate`/`invoice_rate` diisi dari `payment_entries.exchange_rate` / `sales|purchase_invoices.exchange_rate` bila ada; selisih kurs historis TIDAK dihitung ulang (tidak ada restatement).
3. THE backfill SHALL melaporkan Payment Entry yang `paid_amount`-nya tidak konsisten dengan Σ distribusi termin atau yang dokumennya hilang.
4. THE backfill `partyable_*` baris receivable/payable (Requirement 4.2) SHALL dijalankan dalam perintah yang sama atau terpisah dengan `--dry-run` dan laporan.

### Requirement 11: Antarmuka

#### Acceptance Criteria

1. THE form Payment Entry SHALL mendukung: pilihan pihak, daftar invoice terbuka pihak tersebut dengan input alokasi per baris, ringkasan (dibayar, teralokasi, uang muka), dan tetap menerima alur satu-invoice dari halaman invoice.
2. THE form SHALL menampilkan kurs yang dipakai (tipe, tanggal, sumber), mengizinkan override oleh pengguna ber-izin dengan alasan, dan menampilkan estimasi selisih kurs per alokasi sebelum submit.
3. THE halaman detail Payment Entry SHALL menampilkan alokasi, jurnal terkait, dan selisih kurs; halaman detail invoice menampilkan alokasi yang melunasinya.
4. THE halaman Kurs (Requirement 1.5) dan aksi "Alokasikan uang muka/kredit" tersedia di balik izin.
5. THE kunci terjemahan baru di `lang/id` & `lang/en` (`LocaleKeysTest` hijau); komponen React baru memiliki `.rtl.test.jsx`.

### Requirement 12: Non-fungsional dan keamanan transisi

#### Acceptance Criteria

1. THE perubahan jurnal Payment Entry SHALL diaktifkan lewat mode Posting Engine yang ada (`finance_posting_mode.payment_entry`) dan sakelar tambahan `finance_payment_allocation_enabled` (default `false`); saat `false`, alur Fase 2 (parity) tetap berjalan.
2. THE sistem SHALL menolak aktivasi sakelar bila rekonsiliasi sub-ledger awal tidak hijau atau backfill belum selesai.
3. THE tabel/model baru SHALL mendeklarasikan kolom eksplisit di migration dan diuji terhadap `initPermissions()` (F-12); izin: `ExchangeRate`, `PaymentAllocation` (`select`, `read`).
4. THE operasi alokasi pada satu dokumen SHALL aman terhadap konkurensi (`lockForUpdate` pada dokumen dan Payment Entry; pola yang sudah dipakai `PaymentEntryService`).
5. THE characterization Fase 0, test Fase 1–3, dan test Payment/Invoice existing (`PaymentEntrySubmitTest`, `PurchaseInvoice*`, `SalesInvoice*`) SHALL tetap hijau pada sakelar `false`.
6. THE perubahan perilaku yang disengaja (jumlah jurnal pembayaran, F-10) SHALL dicatat di decision log beserta persetujuan pemilik produk.

## Pertanyaan yang Menunggu Konfirmasi

| ID | Pertanyaan | Dampak |
|---|---|---|
| D-16 | Kebijakan tipe kurs: invoice dan pembayaran memakai `transaction`? Revaluasi akhir periode memakai `closing`? Apakah kurs BI/pajak (`spot`) dipakai untuk pajak? | Requirement 3.5, 2 |
| D-17 | Selisih kurs diakui saat pelunasan (terealisasi) — sudah standar; apakah ada kebijakan toleransi/pembulatan selisih kecil (`payment_difference`)? | Requirement 7.8 |
| D-18 | Granularitas alokasi: per invoice (usulan) atau per termin (`payment_schedules`)? Usulan: per invoice di alokasi, termin tetap dipelihara jalur existing | Requirement 5.5 |
| Q-P4-1 | Apakah transaksi tiga mata uang berbeda perlu didukung nanti? | Requirement 7.7 |
| Q-P4-2 | Bagaimana pembayaran dalam mata uang asing diterima di bank (rekening valas atau dikonversi bank ke IDR)? Menentukan mata uang `payment_entries` | Requirement 7.2, 11.2 |
| Q-P4-3 | Apakah uang muka dipakai sekarang (proses bisnis nyata)? Menentukan prioritas Requirement 5.8 | Requirement 5 |
| Q-P4-4 | F-10: apakah dikonfirmasi sebagai bug oleh Fase 0? Tentukan apakah hotfix terpisah lebih dulu | Requirement 7.1 |
