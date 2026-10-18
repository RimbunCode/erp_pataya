# Implementation Plan: Finance P4 — AR/AP, Payment Allocation, FX

## Overview

Urutan: baca kode pembayaran + audit data (1), FX Engine dan kurs (2–3, tanpa perubahan perilaku), jejak kurs dokumen (4), pihak pada baris jurnal + `PartyLedgerService` (5), alokasi + calculator (6), rule `payment_settlement` + sakelar (7), retur/uang muka (8), rekonsiliasi + backfill (9), UI (10), checkpoint (11). **Sakelar `finance_payment_allocation_enabled` default `false`**: merge tidak mengubah perilaku sampai ada keputusan. Lint/Pint sekali di akhir.

**Prasyarat**: Fase 1–2 selesai (Payment Entry, Sales Invoice, Purchase Invoice mode `on` stabil); D-16/D-17/D-18 dijawab sebelum Task 7; Q-P4-1…4 terjawab. Branch terbaru dari remote.

**Aturan eksekusi**:
- Jangan mengubah `paid_amount` historis atau jurnal lama (tidak ada restatement).
- Jangan menambah penyedia kurs berbasis jaringan di fase ini.
- Perubahan jumlah jurnal pembayaran (F-10) adalah **perubahan perilaku disengaja**; jalankan hanya dengan persetujuan pemilik produk dan catat di decision log.
- Task `*` opsional; konfirmasi sebelum dilewati.

## Tasks

- [ ] 1. Verifikasi dan audit (read-only)
  - [ ] 1.1 Baca penuh `PaymentEntryService`, `PaymentEntryController`, `PaymentEntryRequest`, form React Payment Entry, dan `UpdatePaymentableStatus`; catat arti `account_paid_from/to` untuk `receive` dan `pay`, serta alur jalur invoice ke pembayaran
    - _Requirements: 5.4, 7.2–7.3_
  - [ ] 1.2 Baca alur retur di `SalesInvoiceService`/`PurchaseInvoiceService` (efek terhadap `paid_amount`/status invoice asal) untuk menentukan alokasi `credit_note`
    - _Requirements: 6.1–6.4_
  - [ ] 1.3 Audit data: Payment Entry berkurs ≠ 1, invoice mata uang asing, pembayaran parsial ganda (konfirmasi F-10 dari Fase 0), `paid_amount` vs Σ termin
    - _Requirements: 10.3_
  - [ ] 1.4 Audit baris GL receivable/payable tanpa `partyable_*` (jumlah) dan akun kontrol yang dipakai
    - _Requirements: 4.2, 4.5_

- [ ] 2. Master kurs dan FX Engine
  - [ ] 2.1 Migration `create_exchange_rates_table`; model `ExchangeRate` (guard immutability bila dirujuk), enum `RateType`, izin; test `initPermissions()`
    - _Requirements: 1.1–1.3, 12.3_
  - [ ] 2.2 `ExchangeRateService` (tepat → terdekat sebelum dalam batas umur → exception; inverse), preferensi `finance_fx_*`
    - _Requirements: 2.1–2.2_
  - [ ] 2.3 `FxConversion` + `FxEngine::convert()` (aritmetika skala bilangan bulat, HALF_UP minor unit, `from = to`) dan tandai `Currency::convertMoney` deprecated
    - _Requirements: 2.3–2.6_
  - [ ]* 2.4 Write unit tests FX
    - Tanggal tepat/terdekat/melewati batas; inverse; minor unit 0/2; `from = to`; rate besar/kecil; **P-8** kurs dirujuk tidak dapat diubah
    - **Validates: Requirements 1.3, 2.1–2.4**
  - [ ] 2.5 `ExchangeRateProvider`, `ManualProvider`, `CsvImportProvider` + perintah `finance:import-exchange-rates` (validasi per baris, laporan galat, idempoten)
    - _Requirements: 1.4_
  - [ ]* 2.6 Write tests impor CSV (baris valid/invalid/duplikat, kode mata uang tak dikenal)
    - **Validates: Requirements 1.2, 1.4**

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
