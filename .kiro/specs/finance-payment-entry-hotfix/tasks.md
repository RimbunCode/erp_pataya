# Implementation Plan: Finance Payment Entry Hotfix

## Overview

Hotfix bugfix pada alur Payment Entry (N-4, F-10, F-04 bagian `paid_amount`, N-10 jadwal pembayaran, N-11 guard status, default controller Purchase Invoice, validasi `paid_amount`). Tidak ada migration. Urutan: fixture dan test yang membuktikan bug lebih dulu (harus gagal terhadap kode lama), lalu perbaikan per requirement, lalu konversi/pemindahan test lama, terakhir checkpoint.

**Prasyarat**: baca `requirements.md` dan `design.md` spec ini. Branch `fix/finance-p0-payment-entry-hotfix`. Test memakai SQLite `:memory:` (`phpunit.xml`); jangan menulis ke DB dev.

**Catatan eksekusi**: Pint dan lint dijalankan setelah semua task selesai (checkpoint 8). Deviasi dari design dicatat di `design.md`, bagian "Deviasi implementasi". `lockForUpdate` tidak berefek di SQLite; konkurensi diverifikasi lewat idempotensi.

## Tasks

- [x] 1. Fixture bersama
  - [x] 1.1 Ubah `makePaymentEntry` di `tests/Support/BuildsFinanceFixtures.php`: tipe `$invoice` menjadi `SalesInvoice|PurchaseInvoice`; `payment_type`, `partyable_type`, `paymentable_type` diturunkan dari instance
    - _Requirements: 8.1, 8.5.8_
  - [x] 1.2 Tambah parameter jadwal pada `makeUnpaidSalesInvoice(float $amount, array $schedulePortions = [100])` (jadwal ganda dengan `due_date` berbeda) dan buat `makeUnpaidPurchaseInvoice(float $amount)`
    - _Requirements: 8.5.1, 8.5.8_

- [x] 2. Test pembuktian (ditulis dan dijalankan terhadap kode LAMA; harus gagal)
  - [x] 2.1 Buat `tests/Feature/Finances/PaymentEntryScheduleAllocationTest.php`: tiga kasus Requirement 3 (400.000 lalu 300.000; 400.000 lalu 600.000; cicilan ke-2 pada dua jadwal tidak me-reset jadwal pertama), kelebihan tidak dialokasikan
    - Jalankan terhadap kode lama dan catat kegagalannya di `design.md` ("Deviasi implementasi", subbagian "Bukti test gagal")
    - _Requirements: 3.1–3.4, 8.5.1_
  - [x] 2.2 Pastikan test F-10 (GL pembayaran kedua = 300.000) gagal terhadap kode lama (konversi di task 6.2 memakai test ini)
    - _Requirements: 2.1, 2.2_

- [x] 3. Perbaikan `PaymentEntryService`
  - [x] 3.1 Tulis ulang `onApproved`: `DB::transaction`, kunci paymentable lalu Payment Entry, guard status (`draft`/`need_approval`, selain itu no-op), alokasi jadwal, event `PaymentApplied`, GL debit `account_paid_to`/kredit `account_paid_from` sebesar `paid_amount` PE, `refresh()` model yang dioper
    - _Requirements: 1.1–1.5, 2.1–2.5, 5.2–5.4_
  - [x] 3.2 Tambah `allocateToSchedules` (hitung dari total, urutan `due_date` lalu `id`)
    - _Requirements: 3.1–3.7_
  - [x] 3.3 Tulis ulang `cancel` dan tambah `reversePayment` (kunci paymentable lalu PE, no-op bila `canceled`, pembalikan `paid_amount`/status/jadwal, tolak total negatif, tolak paymentable hilang)
    - _Requirements: 4.1–4.11_
  - [x] 3.4 Tambah guard `update` (kunci PE, periksa ulang `draft` di transaksi)
    - _Requirements: 5.1_
  - [x] 3.5 Tambah kunci terjemahan `errors.update_not_draft`, `errors.paid_amount_exceeds_outstanding`, `errors.cancel_exceeds_paid`, `errors.cancel_paymentable_missing` di `lang/id/finances/paymentEntry.php` dan `lang/en/finances/paymentEntry.php`
    - _Requirements: 9.6_

- [x] 4. Controller dan request
  - [x] 4.1 `PaymentEntryController::create`: default Purchase Invoice non-retur (`account_paid_from` = bank, `account_paid_to` = `creditAccount`)
    - _Requirements: 6.1–6.3_
  - [x] 4.2 `PaymentEntryRequest`: `paid_amount` `gt:0` dan batas atas terhadap `outstanding_amount` (lewati `internal_transfer` dan dokumen retur)
    - _Requirements: 7.1–7.4_

- [x] 5. Pemindahan dan konversi test lama
  - [x] 5.1 `git mv` `Characterization/PaymentEntryPostingTest.php` ke `tests/Feature/Finances/PaymentEntryPostingTest.php`; ubah namespace; balik test arah; urutan akun fixture mengikuti filter form
    - _Requirements: 8.1, 8.2, 8.7_
  - [x] 5.2 `git mv` `KnownIssues/PartialPaymentPostsCumulativeAmountTest.php` ke `tests/Feature/Finances/PaymentEntryPartialPaymentTest.php`; balik menjadi test regresi; lepas grup `known-issue`
    - _Requirements: 8.3, 8.7_
  - [x] 5.3 `KnownIssues/ForeignCurrencyPaymentPostingTest.php`: urutan akun dan arah dibalik; nilai 100 (F-11) tetap
    - _Requirements: 8.6, 2.4_
  - [x] 5.4 `KnownIssues/CancelSoftDeletesLedgerTest.php`: test Payment Entry hanya mengunci bagian GL (soft-delete tanpa pembalik); asersi `paid_amount` tidak dikembalikan dihapus; nama test diubah
    - _Requirements: 8.4_

- [x] 6. Test baru
  - [x] 6.1 `tests/Feature/Finances/PaymentEntryCancelTest.php`: pelunasan tunggal, parsial, PE belum diterapkan, cancel dua kali, salah satu dari dua PE, total negatif ditolak, paymentable di-soft-delete dan dihapus permanen, GL tetap soft-delete
    - _Requirements: 4.1–4.11, 8.5.2–8.5.7_
  - [x] 6.2 `tests/Feature/Finances/PaymentEntryStatusGuardTest.php`: guard `update` (termasuk model basi), `onApproved` no-op untuk `paid`/`canceled`/`rejected`, jalur `draft`/`need_approval`, pembayaran `pay` atas Purchase Invoice
    - _Requirements: 5.1–5.4, 8.5.8–8.5.9_
  - [x] 6.3 `tests/Feature/Finances/PaymentEntryHttpTest.php`: default controller Purchase Invoice, validasi `paid_amount`, guard `update` dan cancel negatif lewat HTTP
    - _Requirements: 6.1, 7.1–7.3, 8.5.10_

- [x] 7. Checkpoint: suite Finances
  - Jalankan test yang disentuh, lalu `tests/Feature/Finances` penuh, lalu test lain yang memakai Payment Entry (hasil grep). Semua harus lulus.

- [x] 8. Pint dan finalisasi
  - `vendor/bin/pint --dirty --format agent`; tandai task selesai; catat deviasi (bila ada) di `design.md`
  - _Requirements: 9.4, 9.5_

- [x] 9. Putaran perbaikan setelah review akhir independen
  - [x] 9.1 `onApproved`: verifikasi ulang `paymentable_type`/`paymentable_id` PE terkunci terhadap nilai yang dipakai untuk kunci paymentable; `ValidationException` kunci `paymentable`; kunci terjemahan `errors.paymentable_changed` (id dan en); test regresi dengan update query langsung sebelum `onApproved($stale)`
    - _Requirements: 5.5, 4.2(c)_
  - [x] 9.2 `PaymentEntryCancelTest`: test PE belum diterapkan menjadi data provider `need_approval` dan `rejected` (bukan `draft`); periksa `paid_amount`, status, dan jadwal faktur tidak berubah
    - _Requirements: 4.5, 8.5.2_
  - [x] 9.3 `PaymentEntryHttpTest`: test batas atas dipisah (`internal_transfer` dan dokumen retur) dengan request nyata `PaymentEntryRequest::create` dan kontrol negatif sehingga cabang pengecualian benar-benar teruji
    - _Requirements: 7.3_
  - [x] 9.4 Test rollback: galat setelah `allocateToSchedules` pada `cancel` (listener `eloquent.saving` pada `SalesInvoice`) di `PaymentEntryCancelTest` dan `PaymentEntryHttpTest`; jadwal dan `paid_amount` kembali seperti semula
    - _Requirements: 4.1, 4.9_
  - [x] 9.5 `PaymentEntryStatusGuardTest`: submit ganda lewat `PaymentEntryService::submit()`; `paid_amount`, jadwal, dan jumlah baris GL tidak berubah pada submit kedua
    - _Requirements: 5.3, 8.5.9_
  - [x] 9.6 Jalankan test yang disentuh, `tests/Feature/Finances` penuh, dan Pint

- [x] 10. Keputusan pemilik produk 2026-11-04 (Q11 dan Q12)
  - [x] 10.1 `PaymentSchedule::getDetailPayment` menjumlahkan `outstanding_amount`; `PaymentEntryController::create` membatasi default `paid_amount` dengan `outstanding_amount` faktur non-retur (Sales Invoice dan Purchase Invoice)
    - _Requirements: 10.1-10.3_
  - [x] 10.2 Test di `PaymentEntryHttpTest`: default 600.000 setelah pembayaran 400.000 dan POST dengan nilai itu lolos; default dibatasi sisa faktur; jadwal lunas dan cicilan belum jatuh tempo dilewati; Purchase Invoice
    - _Requirements: 10.4_
  - [x] 10.3 `PaymentEntryService::submit`: guard non-draft di bawah kunci PE dalam transaksi (membungkus `checkApproval`); kunci terjemahan `errors.submit_not_draft` (id dan en)
    - _Requirements: 5.6_
  - [x] 10.4 Test submit: submit pertama atas draft berhasil (`Event::fake` `DocumentSubmitted` terkirim sekali); submit kedua atas PE `paid` ditolak tanpa mengubah kode, jadwal, GL, dan tanpa `DocumentSubmitted`; provider non-draft (`paid`, `need_approval`, `canceled`, `rejected`); model basi; lewat HTTP. Test submit-ganda lama diganti (kini ditolak, bukan no-op)
    - _Requirements: 5.3, 5.6, 8.5.9_
  - [x] 10.5 Spec: Requirement 5.3/5.6/6.3/10, Q11/Q12 ditutup, design D-11/D-16/D-17
  - [x] 10.6 Jalankan test yang disentuh, `tests/Feature/Finances` penuh, test lain yang memakai `submit`/`getDetailPayment`, dan Pint
