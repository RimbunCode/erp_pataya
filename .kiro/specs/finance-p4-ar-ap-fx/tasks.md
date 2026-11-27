# Implementation Plan: Finance P4 — AR/AP, Payment Allocation, FX

## Overview

Urutan: baca kode pembayaran + audit data (1), FX Engine dan kurs (2–3, tanpa perubahan perilaku), jejak kurs dokumen (4), pihak pada baris jurnal + `PartyLedgerService` (5), alokasi + calculator (6), rule `payment_settlement` + sakelar (7), retur/uang muka (8), rekonsiliasi + backfill (9), UI (10), checkpoint (11). **Sakelar `finance_payment_allocation_enabled` default `false`**: merge tidak mengubah perilaku sampai ada keputusan. Lint/Pint sekali di akhir.

**Prasyarat**: Fase 1–2 selesai (Payment Entry, Sales Invoice, Purchase Invoice mode `on` stabil); D-16/D-17/D-18 dijawab sebelum Task 7; Q-P4-1…4 terjawab. Branch baru dari `origin/feat/finance-engine` terbaru (BR-6, PRD Bagian 10).

**Aturan eksekusi**:
- Jangan mengubah `paid_amount` historis atau jurnal lama (tidak ada restatement).
- Jangan menambah penyedia kurs berbasis jaringan di fase ini.
- Perubahan jumlah jurnal pembayaran (F-10) adalah **perubahan perilaku disengaja**; jalankan hanya dengan persetujuan pemilik produk dan catat di decision log.
- Task `*` opsional; konfirmasi sebelum dilewati.

## Tasks

- [x] 1. Verifikasi dan audit (read-only)
  - [x] 1.1 Baca penuh `PaymentEntryService`, `PaymentEntryController`, `PaymentEntryRequest`, form React Payment Entry, dan `UpdatePaymentableStatus`; catat arti `account_paid_from/to` untuk `receive` dan `pay`, serta alur jalur invoice ke pembayaran
    - _Requirements: 5.4, 7.2–7.3_
    - **Temuan (audit kode 28 November 2026, tanpa perubahan perilaku):**
      - `account_paid_from_id`/`account_paid_to_id` TIDAK lagi bermakna: `PaymentEntryService::fillRelations` selalu mengosongkannya (Q-P2-23) dan `PaymentEntryPostingContextFactory` tidak membacanya. Akun datang dari Posting Profile: kas/bank dari `default_account_id` Metode Pembayaran (peran `cash_or_bank`), lawan dari peran `receivable`/`payable`. `PaymentEntryRule`: `receive` = Debit `cash_or_bank`, Kredit lawan; `pay` = Debit lawan, Kredit `cash_or_bank`. Asumsi tabel rule Fase 4 (design: receive/pay) cocok; tidak perlu mengubah `design.md`.
      - F-10 sudah ditutup hotfix PR #277: jumlah jurnal = `paid_amount` entri ini (`amounts['paid_amount']`), bukan kumulatif. Jurnal masih tanpa konversi kurs (F-11 = Fase 4).
      - Alur satu-invoice: `onApproved` mengunci `paymentable` lalu Payment Entry, menghitung `newPaidAmount = paymentable.paid_amount + paid_amount`, mendistribusi ke `payment_schedules` (`allocateToSchedules`, dihitung dari total), memicu `PaymentApplied` (listener sinkron `UpdatePaymentableStatus` menulis `paid_amount` dan status `PAID`/`PARTIALLY_PAID`), lalu memposting lewat `PostingGateway`. `cancel`/`reversePayment` membalik `paid_amount`, termin, dan status; GL di-soft-delete hook `Submitable`. Ini kode yang dipindah ke `PaymentAllocationService` (Task 6.3), bukan ditulis ulang.
      - Mata uang tidak divalidasi terhadap invoice: `fillRelations` mengambil `currency.code` dari input (default mata uang dasar) dan mewajibkan `exchange_rate` bila bukan mata uang dasar, tetapi tidak membandingkan dengan mata uang `paymentable`. `exchange_rate` default 0 di tabel; dipaksa 1 bila mata uang = dasar. Task 4.2/6.3 harus menambah validasi kombinasi mata uang.
      - `PaymentEntryRequest`: `paid_amount` dibatasi `outstanding_amount` paymentable (bukan retur); `partyable.id`/`paymentable.id` wajib kecuali `internal_transfer`. `fillRelations` tetap membaca `partyable['id']` dan `paymentable['id']` tanpa menjaga `internal_transfer` (kemungkinan galat undefined index); `internal_transfer` belum punya alur nyata (menunggu T-4).
      - Controller `create` mengisi `defaultData` dari `salesInvoice`/`purchaseInvoice` (`paymentSchedule` sebagai alur ketiga); `payment_type` dibalik untuk invoice retur (`return_against_id` terisi: Sales retur = `pay`, Purchase retur = `receive`), jadi retur hari ini dibayar tunai lewat Payment Entry berarah terbalik, bukan lewat alokasi.
      - Form React (`PaymentEntries/Form.jsx`): satu `paymentable` per Payment Entry, `currency`/`exchange_rate` mengikuti `paymentable` yang dipilih, `payment_schedules` hanya ditampilkan. UI alokasi banyak baris (Task 10) adalah komponen baru; alur satu-invoice harus tetap menerima `paymentable`.
  - [x] 1.2 Baca alur retur di `SalesInvoiceService`/`PurchaseInvoiceService` (efek terhadap `paid_amount`/status invoice asal) untuk menentukan alokasi `credit_note`
    - _Requirements: 6.1–6.4_
    - **Temuan (audit kode 28 November 2026, tanpa perubahan perilaku):**
      - Retur disetujui sebagai invoice sendiri (`return_against_id` terisi, `status = RETURNED`, `amount` = nilai retur setelah pajak potong). `returned_quantity` pada item asal ditambah per item.
      - Efek pada invoice ASAL hanya status: bila seluruh kuantitas sudah diretur → `PAID` (dari `UNPAID`/`PARTIALLY_PAID`); bila sebagian → `PARTIALLY_PAID` atau `PAID` menurut `outstanding_amount <= 0`; diterapkan lewat event `SalesInvoiceReturnStatusChanged` (Sales) atau langsung (Purchase, dengan `lockForUpdate`). `paid_amount` dan `outstanding_amount` (generated `amount - paid_amount`) invoice asal TIDAK berubah; nilai retur tidak mengurangi sisa tagihan asal. Akibatnya retur penuh membuat invoice asal berstatus `PAID` padahal `paid_amount` < `amount`, dan Req 5.6 (`sisa = amount − Σ alokasi − Σ credit_note`) berbeda dari perilaku sekarang sampai alokasi `credit_note` ada.
      - Penyelesaian retur hari ini: Payment Entry berarah terbalik pada invoice retur itu sendiri (lihat 1.1), dengan batas `outstanding_amount` tidak diterapkan pada retur (`PaymentEntryRequest`). Alokasi `credit_note` (Task 8.1) menambah jalur kedua; perlu diputuskan bagaimana keduanya berdampingan (pertanyaan terbuka di laporan Task 2).
      - Perhitungan `returned_quantity` dan status `RETURNED` tidak boleh berubah (Req 6.4); hook `autoAllocateCreditNote()` aman ditambahkan sesudah baris `event(...ReturnStatusChanged)`/sesudah blok status Purchase dalam transaksi yang sama.
  - [x] 1.3 Audit data: Payment Entry berkurs ≠ 1, invoice mata uang asing, pembayaran parsial ganda (konfirmasi F-10 dari Fase 0), `paid_amount` vs Σ termin
    - _Requirements: 10.3_
    - **Hasil audit DB dev (28 November 2026, query baca-saja oleh koordinator):** 5 Payment Entry (2 paid, 3 canceled), 2 Sales Invoice, 1 Purchase Invoice; semuanya mata uang dasar (kurs 1, `currency_code` null/IDR); tidak ada data valas. Piutang cocok dengan jurnal: Piutang Dagang saldo 1.700.000 = sisa SI-0001 700.000 + SI-0002 1.000.000.
  - [x] 1.4 Audit baris GL receivable/payable tanpa `partyable_*` (jumlah) dan akun kontrol yang dipakai
    - _Requirements: 4.2, 4.5_
    - **Hasil audit DB dev (28 November 2026, query baca-saja oleh koordinator):** seluruh 14 baris GL pada akun receivable (Piutang Dagang) dan payable (Hutang Dagang Dalam Negeri) tidak membawa `partyable_*` (backfill Task 5.3 wajib); tidak ada baris valas. Selisih: PI-0001 lunas (outstanding 0) tetapi Hutang Dagang masih kredit 800.000 karena ada baris kredit 800.000 bertanggal 2026-11-11 untuk PaymentEntry-0003 selain jurnal debit asli 2026-11-04 (sisa posting pra-hotfix arah N-4; data uji dev). Rekonsiliasi Task 9 harus menandainya.

- [ ] 2. Master kurs dan FX Engine
  - [x] 2.1 Migration `create_exchange_rates_table`; model `ExchangeRate` (guard immutability bila dirujuk), enum `RateType`, izin; test `initPermissions()`
    - _Requirements: 1.1–1.3, 12.3_
    - Catatan implementasi: izin `select`/`read`/`write` + `import` (`extraPermissions`, Req 1.5). "Dirujuk" = kolom `have_transactions` (`ExchangeRate::isReferenced()`); pengikatan ke dokumen dikerjakan Task 4 dan `HaveTransactionsSyncService` perlu dicek saat itu (lihat pertanyaan terbuka).
  - [x] 2.2 `ExchangeRateService` (tepat → terdekat sebelum dalam batas umur → exception; inverse), setting `finance_fx_*`
    - _Requirements: 2.1–2.2_
    - Catatan implementasi: setting `fx_max_age_days` (7) dan `fx_allow_inverse` (true) sebagai kolom `finance_settings` (internal, belum tampil di halaman setting). Kurs langsung dan kebalikan dipertimbangkan bersama: tanggal terbaru menang; bila tanggal sama, kurs langsung menang. Pengecualian `NoExchangeRateException`/`ImmutableRateException`/`InvalidExchangeRateException` ada di `app/Exceptions/Finances/` (konvensi codebase), bukan `Currency/Exceptions/` seperti di design.
  - [x] 2.3 `FxConversion` + `FxEngine::convert()` (aritmetika skala bilangan bulat, HALF_UP minor unit, `from = to`) dan tandai `Currency::convertMoney` deprecated
    - _Requirements: 2.3–2.6_
    - Catatan implementasi: aritmetika memakai `Brick\Math\BigDecimal` (`Decimal`; dependensi transitif `laravel/framework`, bukan bcmath), bukan bilangan bulat 64-bit yang dapat meluap. Konversi kebalikan membagi dengan kurs tersimpan (bukan mengalikan dengan 1/rate yang dibulatkan 8 digit).
  - [x]* 2.4 Write unit tests FX
    - Tanggal tepat/terdekat/melewati batas; inverse; minor unit 0/2; `from = to`; rate besar/kecil; **P-8** kurs dirujuk tidak dapat diubah
    - **Validates: Requirements 1.3, 2.1–2.4**
  - [x] 2.5 `ExchangeRateProvider`, `ManualProvider`, `CsvImportProvider` + perintah `finance:import-exchange-rates` (validasi per baris, laporan galat, idempoten)
    - _Requirements: 1.4_
    - Catatan implementasi: header CSV `from_currency_code,to_currency_code,rate_type,rate,rate_date` (urutan bebas, `,` atau `;`); baris valid tersimpan walau baris lain galat; duplikat dalam berkas dilaporkan pada kemunculan berikutnya; kurs berbeda pada kunci yang sama hanya mengubah baris yang belum dirujuk. Perintah mendukung `--dry-run` dan keluar non-nol bila ada baris galat.
  - [x]* 2.6 Write tests impor CSV (baris valid/invalid/duplikat, kode mata uang tak dikenal)
    - **Validates: Requirements 1.2, 1.4**
  - **Pertanyaan Terbuka Task 2** (keputusan implementasi diterapkan sementara, menunggu konfirmasi pemilik produk):
    - Tipe kurs: enum tetap lima tipe (Req 1.1: `spot`/`transaction`/`closing`/`contract`/`historical`), padahal D-16 hanya memakai `transaction` dan `closing`. Alasan: sesuai Req 1.1 dan tidak membatasi data; dipersempit bila pemilik menghendaki.
    - Izin `ExchangeRate`: `select`/`read`/`write` ditambah `import` (`extraPermissions`, mengikuti Req 1.5), sedangkan Req 12.3 hanya menyebut `select`/`read`. Req 12.3 belum diubah; diubah hanya bila disetujui.
    - Konversi kebalikan membagi dengan kurs tersimpan (bukan mengalikan 1/rate yang dibulatkan 8 digit): IDR 15.800.000 dengan USD→IDR 15800 = tepat USD 1000,00, bukan 999,98. `FxConversion::$rate` menampilkan 1/rate (8 digit) hanya sebagai penjelasan. Perlu persetujuan akuntan.
    - Pemilihan kurs: kurs langsung dan kebalikan dibandingkan bersama; tanggal terbaru menang, bila sama kurs langsung menang (spek hanya menyebut "tepat → terdekat sebelum").
    - Impor CSV: baris valid tetap tersimpan walau baris lain galat (bukan semua-atau-tidak); duplikat pasangan/tipe/tanggal dalam satu berkas dilaporkan galat pada kemunculan berikutnya; kurs berbeda pada kunci yang sama mengubah baris bila belum dirujuk, galat per baris bila sudah dirujuk; header `from_currency_code,to_currency_code,rate_type,rate,rate_date` (urutan bebas, pemisah `,` atau `;`).
    - Setting `fx_max_age_days` dan `fx_allow_inverse` hanya internal (tidak tampil di halaman Finance Settings). Perlu keputusan apakah dibuka di UI.
    - Pengecualian baru di `app/Exceptions/Finances/` (konvensi codebase), bukan `Currency/Exceptions/` seperti di design; `FxEngine::baseCurrency()` mengembalikan `?string` (design: `string`).
    - **Prasyarat Task 4:** definisi kurs "dirujuk" yang tahan reset. Saat ini `ExchangeRate::isReferenced()` memakai kolom `have_transactions`, yang dapat di-reset `HaveTransactionsSyncService` untuk tabel yang dilacak sehingga kurs terbuka kembali. Task 4 harus menentukan pengikatan dokumen ke kurs yang tidak bergantung pada reset itu (mis. menandai `have_transactions` dari service dokumen dan mengecualikan tabel ini dari reset, atau menyimpan `exchange_rate_id`).
    - Rekomendasi reviewer untuk prasyarat Task 4 di atas: `exchange_rate_id` nullable FK pada dokumen/baris jurnal yang merujuk kurs, dan JANGAN memasukkan `exchange_rates` ke `tracked_tables` `have_transactions`. `FxConversion` sudah membawa `exchangeRateId` dan `storedRate` untuk keperluan itu.
    - Perintah impor tanpa opsi `--user=` (pembuat kurs tercatat null pada impor CLI); opsi itu di luar spek dan menunggu keputusan pemilik.
    - Konflik izin Req 1.5 (`import`) vs Req 12.3 (hanya `select`/`read`) dan pemaparan setting FX di halaman Finance Settings (Task 3) tetap menunggu keputusan; Req 12.3 tidak diubah.
    - Penegasan: kode mata uang dinormalkan `strtoupper(trim())` lalu dicocokkan ke `currencies.code` (tanpa regex 3 huruf), sehingga kode kustom non-ISO yang ada di master tetap diterima.
    - **Prasyarat Task 8:** cara alokasi `credit_note` (Task 8.1) berdampingan dengan jalur retur yang sudah ada (Payment Entry berarah terbalik pada invoice retur; lihat temuan 1.1 dan 1.2), agar tidak terjadi pelunasan ganda atas retur yang sama.

- [ ] 3. UI kurs
  - [ ] 3.1 `ExchangeRateController` + rute + izin; halaman `Finances/ExchangeRates/{Index,Form}.jsx` + impor CSV; `.rtl.test.jsx`; terjemahan
    - _Requirements: 1.5, 11.4–11.5_

- [ ] 4. Jejak kurs pada dokumen
  - [ ] 4.1 Migration kolom `exchange_rate_type/date/source` pada `sales_invoices`, `purchase_invoices`, `payment_entries`
    - _Requirements: 3.1_
  - [ ] 4.2 Service dokumen mengisi kurs dari `FxEngine` (tipe `transaction`; override dengan izin + alasan); tangani default 0 pada `payment_entries.exchange_rate`
    - _Requirements: 3.2, 3.5_
  - [ ] 4.3 Rule posting invoice (Fase 2/3) mengisi `foreign_*` dan `exchange_rate` pada baris receivable/payable; validasi `JournalService` (asing × kurs ≈ dasar)
    - _Requirements: 3.3–3.4, 8.1–8.2_
  - [ ]* 4.4 Write tests jejak kurs: dokumen asing terisi; legacy null tetap valid; validasi jurnal menolak ketidakcocokan
    - **Validates: Requirements 3.2–3.4, 8.1**

- [ ] 5. Pihak pada jurnal dan sub-ledger
  - [ ] 5.1 Pabrik konteks invoice meneruskan `party` pada baris `receivable`/`payable`; indeks `(partyable_type, partyable_id, account_id, transaction_date)`
    - _Requirements: 4.1_
  - [ ] 5.2 `PartyLedgerService` (`openItems`, `balance`, `statement`) berbasis baris jurnal akun kontrol + alokasi
    - _Requirements: 4.3–4.5_
  - [ ] 5.3 Perintah `finance:backfill-party-lines` (dry-run, idempoten; tidak mengubah `debit/credit`)
    - _Requirements: 4.2, 10.4_
  - [ ]* 5.4 Write tests ledger pihak: posting baru membawa pihak; backfill; saldo per pihak = saldo akun kontrol (**P-5**)
    - **Validates: Requirements 4.1–4.4**

- [ ] 6. Payment Allocation
  - [ ] 6.1 Migration `create_payment_allocations_table`; model `PaymentAllocation` (izin, guard immutability pada alokasi aktif)
    - _Requirements: 5.1, 5.7_
  - [ ] 6.2 `SettlementCalculator` murni + unit test tabel kasus
    - **P-2** realized FX untuk receive/pay, untung/rugi, kombinasi mata uang; tiga mata uang ditolak
    - _Requirements: 7.4–7.5, 7.7_
  - [ ] 6.3 `PaymentAllocationService::allocate()` (lock, validasi, hitung, simpan, jalankan distribusi termin + `PaymentApplied` per alokasi — kode existing dipindah, bukan ditulis ulang); `reverse()`
    - _Requirements: 5.2–5.7_
  - [ ]* 6.4 Write tests alokasi
    - **P-4** sisa dokumen; alokasi berlebih/pihak beda/arah salah/status tak valid ditolak; konkurensi dua pembayaran paralel; alur satu-`paymentable` lama menghasilkan satu alokasi; `PaymentEntrySubmitTest` tetap hijau
    - **Validates: Requirements 5.2–5.6**

- [ ] 7. Jurnal pelunasan dan realized FX (butuh D-16/D-17)
  - [ ] 7.1 Tambah peran `customer_advance`, `supplier_advance`, `payment_difference` ke `AccountRole`; label terjemahan; perluas `finance:init-posting-profile`
    - _Requirements: 7.8_
  - [ ] 7.2 `PaymentEntryPostingContextFactory` (alokasi + FX) dan `PaymentSettlementRule` (receive/pay, banyak alokasi, uang muka, `fx_gain`/`fx_loss`, toleransi)
    - _Requirements: 7.1–7.4, 7.6_
  - [ ] 7.3 Sakelar `finance_payment_allocation_enabled` (default `false`) di gateway Payment: `false` → rule Fase 2; `true` → `payment_settlement`; aktivasi ditolak bila rekonsiliasi/backfill belum hijau
    - _Requirements: 12.1–12.2_
  - [ ]* 7.4 Write golden tests G1–G6 dan property test
    - **P-1** seimbang acak; **P-2**; **P-3** parsial dua kali memposting jumlahnya sendiri; **P-9** sakelar `false` identik Fase 2; posting key idempoten (**P-6**)
    - **Validates: Requirements 7.1–7.7, 12.1, 12.5**

- [ ] 8. Retur dan uang muka
  - [ ] 8.1 `autoAllocateCreditNote()` saat retur disetujui (hook pada service invoice, sesudah posting) dan alokasi kredit terbuka ke invoice lain
    - _Requirements: 6.1–6.4_
  - [ ] 8.2 `applyAdvance()` + jurnal reklasifikasi `advance_application`
    - _Requirements: 5.8_
  - [ ]* 8.3 Write tests retur & uang muka (retur menyerap sebagian; sisa menjadi kredit terbuka; alokasi uang muka; selisih kurs pada retur)
    - **Validates: Requirements 5.8, 6.1–6.4**

- [ ] 9. Rekonsiliasi dan backfill
  - [ ] 9.1 `finance:backfill-allocations {--dry-run}` (idempoten; `legacy = true`; tanpa restatement; laporan inkonsistensi)
    - _Requirements: 10.1–10.3_
  - [ ] 9.2 `finance:reconcile-subledger {--as-of=}` (a–d) + jadwal harian di `routes/console.php`
    - _Requirements: 9.1–9.3_
  - [ ]* 9.3 Write tests: backfill idempoten & **P-7** tanpa restatement; rekonsiliasi mendeteksi pelanggaran yang disuntikkan; **P-5** pada data campuran legacy + baru
    - **Validates: Requirements 9.1–9.3, 10.1–10.4**
  - [ ] 9.4 **(Manual, staging)** Jalankan backfill → rekonsiliasi hijau → aktifkan sakelar di staging → skenario valas bersama akuntan; catat hasil
    - _Requirements: 12.2_

- [ ] 10. Antarmuka
  - [ ] 10.1 Form Payment Entry: pilih pihak → daftar invoice terbuka → input alokasi; ringkasan (dibayar/teralokasi/uang muka); kurs terpakai + override ber-izin; estimasi FX per alokasi; tetap menerima alur satu-invoice
    - _Requirements: 11.1–11.2_
  - [ ] 10.2 Detail Payment Entry (alokasi, jurnal, FX) dan detail invoice (alokasi pelunas); aksi alokasi uang muka/kredit
    - _Requirements: 11.3–11.4_
  - [ ] 10.3 Test `.rtl.test.jsx` (banyak baris alokasi, uang muka, validasi sisa, override kurs, kasus galat kurs tidak ditemukan); terjemahan `lang/id` & `lang/en`
    - _Requirements: 11.5_

- [ ] 11. Checkpoint akhir Fase 4
  - Jalankan `php artisan test --compact tests/Feature/Finances tests/Feature/Asset tests/Unit` + test frontend yang disentuh
  - Setelah semua task: `vendor/bin/pint --dirty --format agent`, `npm run lint`, `graphify update .`
  - Exit criteria: P-1…P-9 hijau; rekonsiliasi sub-ledger hijau di staging; golden G1–G6 ditinjau akuntan; keputusan D-16/D-17/D-18 dan perubahan F-10 terdokumentasi
  - Ensure all tests pass, ask the user if questions arise.

## Catatan

- Fase 5 menyediakan laporan AR/AP Aging dan buku besar pihak di atas `PartyLedgerService`; jangan menduplikasi query di laporan.
- Fase 6 akan merevaluasi saldo valas (unrealized FX) dengan kurs `closing`; simpan jejak kurs agar revaluasi dapat dibalik.
- Jika Task 1 mengungkap semantik `account_paid_from/to` berbeda dari asumsi tabel rule, perbarui `design.md` dan minta konfirmasi sebelum Task 7.
