# Requirements Document

## Introduction

Hotfix kecil pada alur **Payment Entry** (pembayaran atas Sales Invoice dan Purchase Invoice), dikerjakan **sebelum Fase 1** program Finance Engine (`docs/prd/finance-engine-prd.md`). Tiga bug ditemukan di Fase 0 dan dicatat di `docs/prd/finance-audit-report.md`; pemilik produk memutuskan (2026-11-03) menggabungkannya menjadi satu paket karena semuanya berada di `PaymentEntryService` dan memperbaikinya sekali lebih aman daripada tiga kali:

| ID | Bug | Rujukan laporan |
|---|---|---|
| N-4 | Arah jurnal Payment Entry terbalik terhadap konvensi akuntansi (debit `account_paid_from`, kredit `account_paid_to`) | Bagian 3.8 |
| F-10 | GL pembayaran ke-2 dan seterusnya memposting total kumulatif, bukan jumlah pembayaran itu | Bagian 3.2 |
| F-04 (bagian `paid_amount`) | Membatalkan Payment Entry tidak mengembalikan `paid_amount` dan status faktur | Bagian 3.1 |

_Cakupan diperluas 2026-11-04 (keputusan pemilik produk, menjawab pertanyaan spec ini)._ Verifikasi ke kode saat menyusun spec menemukan masalah tambahan pada alur yang sama. Pemilik produk memutuskan memasukkan ke paket:

| ID usulan | Tambahan | Requirement |
|---|---|---|
| N-10 | `paid_amount` jadwal pembayaran (`PaymentSchedule`) ditimpa, bukan ditambah, pada pembayaran bertahap, dan jadwal yang sudah lunas dapat di-reset | 3 |
| N-11 | Server tidak menjaga status Payment Entry: `update` non-draft diizinkan, `onApproved` tidak memeriksa ulang status (submit ulang dan pembatalan di sela approver menerapkan pembayaran lagi) | 5 |
| (Q2) | Default controller Purchase Invoice salah (relasi tidak ada, `paid_to` berlawanan dengan filter) | 6 |
| (Q9b) | Validasi server `paid_amount` > 0 dan tidak melebihi sisa tagihan | 7 |

ID N-10 dan N-11 adalah usulan; belum tercatat di `docs/prd/finance-audit-report.md` (dikerjakan agent lain).

Alasan dikerjakan sebelum Fase 1: bila tidak diperbaiki, backfill jurnal Fase 1 membawa nilai dan arah yang salah ke jurnal baru sebagai jurnal "seimbang", dan parity test Fase 2 mengunci kesalahan itu di engine. Jurnal yang salah **tetap seimbang**, sehingga `finance:audit-gl` tidak mendeteksinya.

**Di luar cakupan** (keputusan pemilik produk 2026-11-03 dan 2026-11-04):
- Mata uang asing (F-11, Fase 4): GL tetap memakai nilai yang dipakai sekarang (`paid_amount` dokumen, bukan `base_paid_amount`). Jangan diubah ke nilai dasar.
- Bagian GL dari F-04: soft-delete diganti jurnal pembalik (Fase 2, D-13). Hotfix ini tidak mengubah hook `Submitable` dan tetap membiarkan GL pembayaran yang dibatalkan di-soft-delete.
- `accounts.balance_amount` (Fase 2/5).
- **Koreksi data GL historis yang sudah salah** (staging). Hotfix tidak mengoreksi data otomatis dan tidak ada migration data; dicatat di decision log (D-14).
- Jalur retur (pelanggan + `pay`, pemasok + `receive`) dan `internal_transfer`: tidak diperbaiki; dicatat sebagai temuan baru (Q4). Default controller untuk retur (`customer_id` sebagai akun) tidak ikut.
- Validasi kesesuaian tipe akun `account_paid_from`/`account_paid_to` dengan `payment_type` di server (Q9 a).

Spec ini berjenis bugfix ringkas. `design.md` menyertai requirements ini; `tasks.md` dibuat setelah design disetujui.

## Glossary

- **Paymentable**: dokumen yang dibayar oleh Payment Entry, yaitu `SalesInvoice` atau `PurchaseInvoice` (`payment_entries.paymentable_type`/`paymentable_id`).
- **`account_paid_from` / `account_paid_to`**: kolom akun Payment Entry berlabel "Akun Dibayar Dari" dan "Akun Dibayar Kepada" (`lang/id/finances/paymentEntry.php:28-29`). Filter form menetapkan semantiknya (Requirement 1, Fakta F1).
- **Pasca-persetujuan**: Payment Entry yang `onApproved`-nya sudah berjalan dan berstatus `paid` (status ditimpa dari `need_approval`/`draft` oleh `PaymentEntryService.php:111-115`).
- **Jadwal pembayaran** (`PaymentSchedule`): baris `payment_schedules` milik paymentable; `outstanding_amount` adalah kolom turunan tersimpan `payment_amount - paid_amount`.
- **Total terbayar**: `paid_amount` paymentable, jumlah kumulatif seluruh Payment Entry yang sudah diterapkan atas dokumen itu.
- **Known-issue test**: characterization test untuk perilaku yang salah, ditandai grup `known-issue` dan merujuk ID temuan; dibalik menjadi test regresi saat bug diperbaiki.
- **PB-5**: prasyarat dari laporan audit: pemilik produk dan akuntan mengonfirmasi semantik `account_paid_from`/`account_paid_to` sebelum arah jurnal diubah. **Dikonfirmasi 2026-11-04 (pemilik produk).**

## Requirements

### Requirement 1: Arah jurnal Payment Entry (N-4)

**User Story:** Sebagai akuntan, saya ingin pelunasan piutang mengurangi Piutang dan menambah Kas/Bank (dan pembayaran utang sebaliknya), so that saldo Kas/Bank, Piutang, dan Utang di GL sesuai dengan subledger faktur.

**Perilaku sekarang** (terverifikasi dari kode):

- **F1.** Form membatasi akun menurut jenis pembayaran (`resources/js/Pages/Finances/PaymentEntries/Form.jsx:439-470`):
  - `receive`: `account_paid_from` = akun `receivable` (aset), `account_paid_to` = akun aset non-grup (kas/bank).
  - `pay`: `account_paid_from` = akun aset non-grup (kas/bank), `account_paid_to` = akun `payable` (liabilitas).

  Jadi "dari" adalah akun sisi pembayar/sumber uang dan "kepada" akun penerima, dan default form mengikuti ini: pelanggan mengisi `account_paid_from` dengan `debit_account` faktur (piutang), pemasok mengisi `account_paid_to` dengan `credit_account` (utang) (`Form.jsx:383-407`).
- **F2.** `onApproved` mengkredit `accountPaidTo` dan mendebit `accountPaidFrom` untuk semua `payment_type` (`PaymentEntryService.php:117-139`; kredit `:122-129`, debit `:132-139`).
- **F3.** Akibatnya pembayaran yang mengikuti filter form: `receive` menghasilkan **Dr Piutang / Cr Kas-Bank**; `pay` menghasilkan **Dr Kas-Bank / Cr Utang**. Keduanya terbalik dari konvensi (Dr Kas/Cr Piutang; Dr Utang/Cr Kas). Data staging konsisten dengan inversi ini secara agregat (laporan Bagian 3.8, berstatus dugaan pada tingkat dokumen).
- **F4.** Test karakterisasi mengunci arah lama (`PaymentEntryPostingTest::test_full_payment_debits_paid_from_and_credits_paid_to_with_payment_date`), dan fixture `makePaymentEntry` dipanggil dengan kas sebagai `paid_from` dan piutang sebagai `paid_to` untuk `receive` (`tests/Support/BuildsFinanceFixtures.php:231`; pemanggilan memakai `(cash, receivable)`), yang tidak sesuai filter form sehingga test tidak memperlihatkan inversi.

**Perilaku yang diharapkan.** _Dikonfirmasi 2026-11-04 (pemilik produk, PB-5): debit `account_paid_to`, kredit `account_paid_from`; filter dan label form tidak diubah._

#### Acceptance Criteria

1. WHEN sebuah Payment Entry `receive` di-approve, THE `PaymentEntryService::onApproved` SHALL memposting **debit** pada `account_paid_to` (kas/bank) dan **kredit** pada `account_paid_from` (piutang).
2. WHEN sebuah Payment Entry `pay` di-approve, THE `PaymentEntryService::onApproved` SHALL memposting **debit** pada `account_paid_to` (utang) dan **kredit** pada `account_paid_from` (kas/bank).
3. THE perilaku butir 1 dan 2 SHALL dirumuskan tunggal: **debit `account_paid_to`, kredit `account_paid_from`**, untuk semua `payment_type` yang diproses; tidak ada percabangan per jenis di kode posting.
4. THE `against_account_id` setiap baris GL SHALL tetap berisi akun lawannya (baris debit melawan `account_paid_from`, baris kredit melawan `account_paid_to`).
5. THE kedua baris GL SHALL tetap memakai `transaction_date` = `date` Payment Entry (atau `now()` bila kosong), `referenceable` = Payment Entry, dan jumlah yang sama (jurnal seimbang).
6. THE perubahan SHALL TIDAK mengubah filter akun form, label bahasa, atau data Payment Entry yang sudah ada.
7. THE butir 1-3 SHALL berlaku untuk jalur yang dapat dipakai pada sistem sekarang (faktur non-retur: `receive` atas Sales Invoice, `pay` atas Purchase Invoice). Pembayaran atas dokumen retur dan `internal_transfer` tidak dicakup (Q4).

### Requirement 2: GL pembayaran sebesar jumlah pembayaran itu (F-10)

**User Story:** Sebagai akuntan, saya ingin setiap Payment Entry memposting jumlahnya sendiri, so that pembayaran bertahap atas satu faktur tidak melipatgandakan saldo Kas dan Piutang/Utang.

**Perilaku sekarang** (terverifikasi dari kode dan `KnownIssues/PartialPaymentPostsCumulativeAmountTest`):

- **F5.** `onApproved` men-dispatch `PaymentApplied` secara sinkron (`PaymentEntryService.php:108-109`; listener `UpdatePaymentableStatus` terdaftar langsung di `app/Providers/EventServiceProvider.php:101-103`, tanpa antrean). Listener mengisi `paymentable->paid_amount` dengan total kumulatif pada objek yang sama (`UpdatePaymentableStatus.php:33-35`).
- **F6.** GL lalu diposting dari `$paymentable->paid_amount` (kumulatif), bukan dari `$paymentEntry->paid_amount` (`PaymentEntryService.php:124` dan `:135`). Pembayaran 400.000 lalu 300.000 atas faktur 1.000.000 memposting 400.000 lalu **700.000**; total debit kas 1.100.000 untuk pembayaran 700.000.
- **F7.** Kedua sisi jurnal sama-sama berlebih, jadi jurnal tetap seimbang dan tidak terdeteksi `finance:audit-gl`. `paid_amount` faktur benar (700.000).

#### Acceptance Criteria

1. THE `PaymentEntryService::onApproved` SHALL memposting kedua baris GL sebesar `$paymentEntry->paid_amount` (jumlah Payment Entry itu), bukan `$paymentable->paid_amount`.
2. WHEN dua atau lebih Payment Entry parsial di-approve atas paymentable yang sama, THE jumlah GL setiap Payment Entry SHALL sama dengan `paid_amount` Payment Entry tersebut, dan Σ GL seluruhnya SHALL sama dengan `paid_amount` kumulatif paymentable.
3. THE `paid_amount` dan status paymentable setelah pembayaran SHALL tidak berubah dibandingkan perilaku sekarang (nilai kumulatif yang benar tetap diisi `UpdatePaymentableStatus`).
4. THE nilai yang diposting SHALL tetap dalam satuan yang dipakai sekarang (`paid_amount` dokumen). Konversi kurs (F-11) di luar cakupan: `base_paid_amount` TIDAK dipakai.
5. THE alokasi `paid_amount` ke `PaymentSchedule` pada `onApproved` SHALL mengikuti Requirement 3.

### Requirement 3: Alokasi jadwal pembayaran menambah, bukan menimpa (N-10)

**User Story:** Sebagai staf keuangan, saya ingin jadwal pembayaran menunjukkan jumlah yang benar-benar sudah terbayar, so that sisa tagihan per termin akurat dan pembatalan pembayaran dapat dikembalikan dengan benar.

**Perilaku sekarang** (terverifikasi dari kode, **belum diuji**; dibuktikan lebih dulu dengan test yang gagal, lihat Requirement 8):

- **F19.** `outstanding_amount` adalah kolom generated `payment_amount - paid_amount` (`database/migrations/2025_09_06_094005_create_payment_schedules_table.php:22`). `PaymentEntryService.php:93-106` membaca `$paymentAmount = outstanding_amount` (sisa) dari baris yang dimuat, lalu menetapkan `paid_amount` = `$paymentAmount` (bila `$outstandingAmount >= $paymentAmount`) atau = sisa pembayaran (bila kurang), tanpa menambahkan `paid_amount` sebelumnya. Tiga kasus pada jadwal tunggal 1.000.000:
  1. parsial ke parsial: 400.000 lalu 300.000 menghasilkan `paid_amount` jadwal 300.000, seharusnya 700.000;
  2. pelunasan sisa: 400.000 lalu 600.000 menghasilkan 600.000, seharusnya 1.000.000 (pembayaran 700.000 juga menghasilkan 600.000);
  3. jadwal yang sudah lunas (`outstanding_amount` = 0) memenuhi `0 >= 0` pada pembayaran berikutnya atas faktur yang sama (mis. cicilan ke-2) dan di-reset menjadi 0.

  Relasi `paymentSchedules` pada Sales Invoice dan Purchase Invoice diurutkan `due_date` naik (`SalesInvoice.php:289-292`, `PurchaseInvoice.php:257-260`).

#### Acceptance Criteria

1. WHEN Payment Entry di-approve, THE `PaymentEntryService::onApproved` SHALL menghitung total terbayar baru (total terbayar paymentable sebelumnya + `paid_amount` Payment Entry) dan mengalokasikannya ke jadwal pembayaran berurutan menurut relasi `paymentSchedules`, sehingga `paid_amount` setiap jadwal = jumlah terkecil antara `payment_amount` jadwal itu dan sisa total yang belum dialokasikan.
2. THE pembayaran bertahap SHALL menambah, bukan menimpa: 400.000 lalu 300.000 menghasilkan 700.000; 400.000 lalu 600.000 menghasilkan 1.000.000.
3. THE jadwal yang sudah lunas SHALL tidak di-reset oleh pembayaran berikutnya atas faktur yang sama.
4. THE kelebihan alokasi (total terbayar melebihi jumlah semua jadwal) SHALL tidak dialokasikan; `paid_amount` setiap jadwal tidak melebihi `payment_amount`-nya. `paid_amount` paymentable tetap bertambah penuh seperti sekarang.
5. WHEN Payment Entry dibatalkan (Requirement 4), THE alokasi jadwal SHALL dihitung ulang dengan cara yang sama dari total terbayar yang baru.
6. THE perubahan SHALL TIDAK mengubah `payment_amount`, `discount`, `due_date`, atau atribut jadwal lain selain `paid_amount`.
7. THE hotfix SHALL TIDAK mengoreksi data jadwal historis yang sudah menyimpang (tanpa migration); jadwal faktur itu terkoreksi pada approve atau pembatalan berikutnya atas faktur yang sama karena alokasi dihitung dari total.

_Diputuskan 2026-11-04 (pemilik produk, Q3): bug jadwal pembayaran ikut paket, dibuktikan lebih dulu dengan test yang gagal; karena itu pemulihan jadwal saat pembatalan (Requirement 4.6) menjadi kewajiban._

### Requirement 4: Pembatalan Payment Entry mengembalikan paid_amount dan status paymentable (F-04, bagian `paid_amount`)

**User Story:** Sebagai staf keuangan, saya ingin faktur kembali menjadi belum lunas saat pembayarannya dibatalkan, so that piutang/utang tidak tampak lunas padahal pembayarannya tidak berlaku.

**Perilaku sekarang** (terverifikasi dari kode dan `KnownIssues/CancelSoftDeletesLedgerTest::test_f04_cancel_payment_entry_soft_deletes_ledger_but_does_not_restore_invoice_paid_amount`):

- **F8.** `PaymentEntryService::cancel` hanya mengubah status menjadi `canceled` (`PaymentEntryService.php:159-167`). GL pembayaran di-soft-delete oleh hook `saving` trait `Submitable` (`app/Traits/Submitable.php:98-106`), tetapi `paid_amount` dan status paymentable serta `paid_amount` jadwal pembayaran tidak disentuh: faktur tetap tampak lunas (test mengunci 1.000.000 dan status `paid`).
- **F9.** Aksi batal dapat dilakukan pada Payment Entry yang belum pernah diterapkan: `Controller::cancel` hanya mensyaratkan `canCancel` (`app/Http/Controllers/Controller.php:533-540`, yang membuka transaksi di sekitar `service->cancel`), dan `Submitable::getCanCancelAttribute` mengizinkan semua status selain `draft` dan `canceled` (`app/Traits/Submitable.php:165-173`), termasuk `need_approval` dan `rejected`. Pembayaran seperti itu tidak pernah menambah `paid_amount` faktur.
- **F10.** Listener `UpdatePaymentableStatus` tidak dapat dipakai apa adanya untuk pembalikan. Bila total terbayar 0, cabang `else` hanya mengganti `[UNPAID, PARTIALLY_PAID]` menjadi `PARTIALLY_PAID` (`UpdatePaymentableStatus.php:26-31`), sehingga status `paid` yang lama tetap tersimpan berdampingan dengan `partially_paid`. Cabang total sebagian (`:20-25`) mengganti `[UNPAID, PAID]` dan baru membuang `paid`.
- **F14 (race).** `Controller::cancel` membaca model dan memeriksa `canCancel` **di luar transaksi dan tanpa kunci**; transaksi baru dibuka sesudahnya (`Controller.php:533-540`). Dua pembatalan bersamaan atas Payment Entry yang sama sama-sama lolos pemeriksaan, dan bila pengurangan `paid_amount` ditambahkan tanpa pemeriksaan ulang, faktur dikurangi dua kali. Hal yang sama terjadi bila pembatalan PE-1 bersamaan dengan approve PE-2 atas faktur yang sama dan pengurangan dihitung dari nilai paymentable yang dibaca sebelum dikunci.
- **F15 (urutan kunci).** `onApproved` mengunci baris **paymentable** (`lockForUpdate`, `PaymentEntryService.php:84-86`) lebih dulu, lalu baru menulis baris Payment Entry (`->update(['status' => PAID])`, `:111`). Pembatalan yang mengunci Payment Entry dulu baru paymentable berurutan terbalik dan berpotensi deadlock dengan approve.

#### Acceptance Criteria

1. WHEN Payment Entry pasca-persetujuan (berstatus `paid`) dibatalkan, THE `PaymentEntryService::cancel` SHALL mengurangi `paid_amount` paymentable sebesar `paid_amount` Payment Entry tersebut, dalam satu transaksi database bersama perubahan status (controller sudah membuka transaksi; service tetap harus atomik bila dipanggil langsung). Nilai `paid_amount` Payment Entry terjamin sama dengan saat approve karena Requirement 5.1.
2. THE `cancel` SHALL berjalan aman terhadap pemanggilan bersamaan:
   1. (a) di dalam transaksi, `cancel` SHALL mengunci baris Payment Entry (`lockForUpdate`) dan **memeriksa ulang** statusnya; bila statusnya sudah `canceled`, `cancel` SHALL menjadi **no-op** (tidak mengubah apa pun dan tidak melempar galat). Service SHALL menyimpan perubahan lewat model Payment Entry yang **dibaca ulang setelah dikunci**, bukan lewat `$data` basi yang diteruskan controller;
   2. (b) pengurangan SHALL dihitung dari baris paymentable yang **dibaca ulang setelah dikunci** (`lockForUpdate`), bukan dari objek yang dimuat sebelum kunci;
   3. (c) urutan kunci SHALL konsisten dengan `onApproved`: **paymentable lebih dulu, lalu Payment Entry**. Paymentable ditentukan dari `paymentable_type`/`paymentable_id` pada model Payment Entry yang dibaca tanpa kunci. Requirement 5.1 hanya menjamin keduanya tidak berubah setelah status keluar dari `draft`; pada `onApproved` jalur tanpa skema approval status PE masih `draft` sehingga `update` yang bersamaan dapat menggantinya sebelum kunci Payment Entry didapat. Karena itu `onApproved` SHALL memverifikasi ulang kesamaan keduanya setelah mengunci Payment Entry (Requirement 5.5); `cancel` hanya berlaku untuk PE `paid`, yang tidak dapat diubah lagi (Requirement 5.1).
3. THE `Controller::cancel` generik tetap memicu `AuditableModelSaved('cancelled')` setelah service kembali (`Controller.php:540`); pada pembatalan bersamaan yang menjadi no-op, log audit dapat tercatat dua kali. THE hotfix SHALL TIDAK mengubah controller generik itu; duplikasi log audit pada kasus langka tersebut diterima. _Ini keputusan desain D-6 (bukan keputusan pemilik produk) dan dapat ditinjau._
4. WHEN total terbayar paymentable setelah pengurangan sama dengan nol, THE status paymentable SHALL kembali ke `unpaid`: status `paid` dan `partially_paid` SHALL dibuang dan `unpaid` ditambahkan. WHEN total lebih dari nol tetapi kurang dari `amount`, THE status `paid` SHALL dibuang dan `partially_paid` ditetapkan (tanpa `unpaid`). Status lain yang tidak terkait pembayaran (mis. `returned`) SHALL dipertahankan seperti pola `Utils::replaceStatus` yang sudah dipakai. Penambahan cabang pembalikan ini SHALL tidak mengubah hasil `UpdatePaymentableStatus` pada jalur approve.
5. WHEN Payment Entry yang belum pernah diterapkan (status `need_approval` atau `rejected`) dibatalkan, THE `paid_amount` dan status paymentable SHALL tidak berubah. Jaminan ini kini lengkap karena `onApproved` tidak menerapkan PE yang sudah dibatalkan (Requirement 5.2).
6. THE pembatalan SHALL tidak dapat mengurangi `paid_amount` dua kali untuk Payment Entry yang sama: pemanggilan `cancel` kedua (berturut-turut maupun bersamaan, lewat controller atau langsung lewat service) SHALL tidak mengubah `paid_amount` dan status paymentable (lihat butir 2(a)).
7. THE `paid_amount` setiap `PaymentSchedule` paymentable SHALL dikembalikan sehingga konsisten dengan total terbayar yang baru, dengan alokasi ulang menurut Requirement 3.5.
8. WHEN ada Payment Entry lain atas paymentable yang sama, THE pembatalan SHALL mengurangi total terbayar secara kumulatif sebesar `paid_amount` PE yang dibatalkan; urutan pembatalan tidak dibatasi. Contoh: PE-1 400.000 dan PE-2 300.000, PE-1 dibatalkan: total terbayar 300.000, status `partially_paid`, jadwal dialokasikan ulang dari 300.000.
9. THE pengurangan SHALL tidak pernah membuat total terbayar negatif: bila hasil pengurangan di bawah nol (di luar toleransi pembulatan 0,005), THE `cancel` SHALL ditolak dengan galat validasi berpesan jelas (kunci terjemahan baru), transaksi dibatalkan, dan status Payment Entry tidak berubah.
10. WHEN Payment Entry berstatus `paid` dibatalkan dan paymentable-nya tidak ditemukan (termasuk yang di-soft-delete tetap ditemukan; yang dihapus permanen tidak), THE `cancel` SHALL ditolak dengan galat validasi berpesan jelas (kunci terjemahan baru), bukan `TypeError`; transaksi dibatalkan dan status PE tidak berubah. Paymentable yang di-soft-delete tetap dikunci dan dibalik seperti biasa. Untuk PE yang belum diterapkan, paymentable yang hilang tidak menghalangi pembatalan.
11. THE hotfix SHALL TIDAK mengubah perilaku soft-delete GL (F-04 bagian GL) dan `accounts.balance_amount`. Baris GL pembayaran yang dibatalkan tetap di-soft-delete oleh hook `Submitable`.

_Diputuskan 2026-11-04 (pemilik produk): pemanggilan `cancel` kedua adalah no-op (Q10/M-7, butir 2(a)); pembatalan mengurangi total kumulatif dan jadwal dialokasikan ulang (Q5, butir 7-8); hasil negatif ditolak dengan galat (Q5, butir 9); jumlah pengurangan memakai `paid_amount` PE (Q10, opsi (b) tidak dipakai)._

### Requirement 5: Guard status Payment Entry di server (N-11)

**User Story:** Sebagai staf keuangan, saya ingin Payment Entry yang sudah diterapkan tidak dapat diubah atau diterapkan ulang, so that pembayaran tidak tercatat dua kali dan pembatalan selalu membalik nilai yang sama dengan yang diterapkan.

**Perilaku sekarang** (terverifikasi dari kode):

- **F16 (immutability belum ditegakkan server).** Route `PUT /paymentEntries/{paymentEntry}/{level?}` (`routes/web.php:110-111`) diteruskan ke `PaymentEntryController::update` (`:160-165`), lalu `PaymentEntryService::update` (`:57-63`), `fillRelations`, dan `DataTable::fillForUpdate` (`DataTable.php:228-242`), **tanpa pemeriksaan status `draft`**. Hook `saving` trait `Submitable` tidak menolak perubahan (hanya menetapkan status awal, `submitted_at`, dan soft-delete saat cancel; `Submitable.php:65-106`). Izin yang diperlukan hanya `write` (`Controller.php:153`, pemetaan `'update' => 'write'`). Akibatnya `paid_amount`, `paymentable`, dan akun Payment Entry berstatus `paid` dapat diubah lewat permintaan langsung. UI hanya menonaktifkan form di klien (`resources/js/Pages/Finances/PaymentEntries/Show.jsx`: `disabled={paymentEntry?.submitted_at}`), tanpa penegakan di server.
- **F17 (jalur approver).** Di `ApprovalInstanceController::approve`, `DB::commit()` dijalankan **sebelum** `onApproved` dipanggil (`ApprovalInstanceController.php:174-182`), dan `PaymentEntryService::onApproved` tidak memeriksa ulang status Payment Entry di bawah kunci (`PaymentEntryService.php:75-144`). Payment Entry `need_approval` yang dibatalkan tepat di sela commit dan `onApproved` tetap diterapkan, dan statusnya ditimpa menjadi `paid`.
- **F18 (submit ulang, terverifikasi dari kode, belum diuji).** `PaymentEntryController::submit` (`:168-172`) dan `PaymentEntryService::submit` (`:65-73`) tidak memeriksa status, dan tidak ada `canSubmit` atau guard sejenis di `app/`; route `PUT /paymentEntries/{paymentEntry}/submit` tersedia untuk semua dokumen (`routes/web.php:108`). Alurnya: `checkApproval` lalu `ApprovalService::check` (`:20-30`) lalu `ApprovalInstance::makeInstance` (`ApprovalInstance.php:70-92`). Tanpa skema approval, `makeInstance` mengembalikan `null` sehingga `onApproved` langsung dipanggil; dengan skema, `firstOrCreate` mengembalikan instance lama yang sudah `APPROVED` sehingga `onApproved` juga dipanggil. Akibatnya submit kedua atas Payment Entry `paid` menjalankan `onApproved` lagi: `paid_amount` faktur bertambah lagi, jadwal pembayaran ditimpa lagi, dan GL diposting ganda. Status Payment Entry saat `onApproved` dipanggil: **`draft`** pada jalur tanpa skema atau skema tanpa step (`submit` tidak mengubah status sebelum `checkApproval`), dan **`need_approval`** pada jalur approver (`ApprovalService.php:37` menyetel status itu lebih dulu).

#### Acceptance Criteria

1. WHEN `PaymentEntryService::update` dipanggil untuk Payment Entry yang statusnya bukan `draft`, THE service SHALL menolak dengan galat validasi (`ValidationException`; HTTP 422 untuk permintaan JSON, kembali dengan pesan galat untuk permintaan Inertia) berpesan jelas (kunci terjemahan baru) tanpa mengubah data. Pembaruan atas Payment Entry `draft` SHALL tidak berubah. Pemeriksaan ini SHALL dilakukan **di dalam transaksi setelah baris Payment Entry dikunci** (`lockForUpdate`) dan dibaca ulang, agar `update` atas draft yang berjalan bersamaan dengan submit dan `onApproved` tidak menimpa `paid_amount` atau akun PE yang baru diterapkan (F16).
2. WHEN `PaymentEntryService::onApproved` dipanggil, THE service SHALL mengunci baris paymentable terlebih dulu (seperti sekarang, `PaymentEntryService.php:84-86`), kemudian mengunci baris Payment Entry, lalu memeriksa ulang statusnya di bawah kunci: **izinkan `draft` dan `need_approval`; bila `paid`, `canceled`, atau `rejected`, `onApproved` SHALL menjadi no-op** (tidak memposting GL, tidak mengubah `paid_amount`, status, atau jadwal, tidak men-dispatch `PaymentApplied`, dan mengembalikan model tanpa galat).
3. THE submit ulang atas Payment Entry `paid` SHALL tidak lagi menerapkan pembayaran dua kali (akibat butir 2) dan SHALL ditolak sepenuhnya (butir 6); pembatalan di sela commit approver dan `onApproved` SHALL tidak menerapkan pembayaran.
4. THE guard butir 1-2 SHALL TIDAK mengubah jalur normal: draft yang di-submit tanpa skema, dan `need_approval` yang di-approve, tetap diterapkan seperti sekarang (dengan arah, jumlah, dan alokasi hasil Requirement 1-3).
5. WHEN `PaymentEntryService::onApproved` telah mengunci paymentable dan Payment Entry dan Payment Entry masih dapat diterapkan (`draft`/`need_approval`), IF `paymentable_type`/`paymentable_id` Payment Entry terkunci berbeda dari nilai yang dipakai untuk mengunci paymentable (mis. `update` draft yang bersamaan mengganti paymentable), THEN THE service SHALL melempar `ValidationException` (kunci galat `paymentable`) sehingga transaksi di-rollback dan tidak ada pembayaran yang diterapkan ke dokumen mana pun. _Ini keputusan desain D-15 (bukan keputusan pemilik produk) yang melengkapi guard immutability Q10._
6. WHEN `PaymentEntryService::submit` dipanggil untuk Payment Entry yang statusnya bukan `draft` (`need_approval`, `paid`, `canceled`, `rejected`), THE service SHALL menolak dengan `ValidationException` kunci `status` (pesan `finances/paymentEntry.errors.submit_not_draft`, tersedia di `lang/id` dan `lang/en`) tanpa mengubah kode Payment Entry, tanpa mengirim `DocumentSubmitted`, dan tanpa memanggil `checkApproval`. Status SHALL dibaca ulang di bawah kunci baris Payment Entry (`lockForUpdate`) di dalam transaksi, seperti guard `update`, dan kunci SHALL tertahan sampai `checkApproval` selesai, sehingga submit ganda yang bersamaan hanya diproses sekali. Jalur approver (`ApprovalInstanceController::approve` memanggil `onApproved` langsung, tidak lewat `submit`) SHALL tidak terkena guard ini; jalur submit pertama atas `draft` (tanpa skema maupun dengan skema) SHALL tetap berjalan seperti sekarang.

_Diputuskan 2026-11-04 (pemilik produk, Q11): guard `submit` ikut paket; menutup Q11. Keputusan ini di luar keputusan awal yang hanya mencakup Q10 (a) dan (c), dan telah disetujui pemilik produk._

_Diputuskan 2026-11-04 (pemilik produk, Q10): opsi (a) dan (c) dipakai; opsi (b) tidak dipakai._

### Requirement 6: Default akun controller untuk Purchase Invoice (Q2 a dan b)

**User Story:** Sebagai staf keuangan, saya ingin form pembayaran Purchase Invoice terisi akun yang benar secara default, so that pengguna yang menerima default tidak menghasilkan jurnal yang salah.

**Perilaku sekarang** (terverifikasi dari kode, belum diuji):

- **F20.** Untuk Purchase Invoice non-retur, default server mengisi `account_paid_from` dengan `$purchaseInvoice->debitAccount` (`PaymentEntryController.php:108`), padahal model `PurchaseInvoice` tidak memiliki relasi itu (relasi akunnya `expenseHeadAccount` dan `creditAccount`, `PurchaseInvoice.php:184,188`), sehingga hasilnya `null`; dan mengisi `account_paid_to` dengan bank (`:109`), berlawanan dengan filter `pay` (`paid_to` = akun utang) dan dengan default klien (`Form.jsx:383-407`). `PurchaseInvoice::loadRelationsOnShow` memuat `creditAccount` (`PurchaseInvoice.php:175`).

#### Acceptance Criteria

1. WHEN form pembayaran dibuka dari Purchase Invoice non-retur (`/paymentEntries/create/purchaseInvoice/{id}`), THE `PaymentEntryController::create` SHALL mengisi `account_paid_from` dengan akun bank default (`accountBank`) dan `account_paid_to` dengan `creditAccount` (utang) Purchase Invoice, sesuai filter `pay` dan default klien.
2. THE kode default SHALL TIDAK lagi mengacu ke relasi `debitAccount` pada Purchase Invoice.
3. THE default **akun** untuk Sales Invoice (non-retur dan retur) dan default akun Purchase Invoice retur (termasuk `customer_id` sebagai akun, Q2 c) SHALL tidak berubah; ditangani di Q4. Default **jumlah** (`paid_amount`) untuk Sales Invoice dan Purchase Invoice non-retur diubah oleh Requirement 10.

_Diputuskan 2026-11-04 (pemilik produk, Q2): (a) dan (b) ikut paket; (c) tidak ikut dan masuk Q4._

### Requirement 7: Validasi `paid_amount` di server (Q9 b)

**User Story:** Sebagai staf keuangan, saya ingin pembayaran dengan jumlah nol atau melebihi sisa tagihan ditolak, so that jurnal bernilai nol dan pembayaran berlebih tidak masuk ke GL.

**Perilaku sekarang** (terverifikasi dari kode):

- **F21.** `PaymentEntryRequest` memvalidasi `paid_amount` dengan `['required', 'numeric', 'min:0']` (`PaymentEntryRequest.php:25`): nilai 0 diterima dan menghasilkan jurnal bernilai nol; tidak ada batas atas terhadap sisa tagihan paymentable, sehingga total terbayar dapat melebihi `amount`.

#### Acceptance Criteria

1. THE `PaymentEntryRequest` SHALL menolak `paid_amount` yang kurang dari atau sama dengan nol untuk semua `payment_type` (aturan `gt:0`).
2. WHEN `paymentable` ada dan bukan dokumen retur (`return_against_id` kosong), THE `PaymentEntryRequest` SHALL menolak `paid_amount` yang melebihi `outstanding_amount` paymentable (toleransi 0,005), dengan pesan galat berkunci terjemahan baru.
3. THE aturan batas atas SHALL dilewati untuk `internal_transfer` (tanpa paymentable) dan untuk dokumen retur, agar tidak menambah kegagalan pada jalur yang belum dicakup (Q4).
4. THE validasi kesesuaian tipe akun dengan `payment_type` TIDAK ikut paket (Q9 a).

_Diputuskan 2026-11-04 (pemilik produk, Q9): hanya bagian (b) ikut paket; (a) tidak ikut._

### Requirement 8: Fixture dan test

**User Story:** Sebagai pengembang, saya ingin test pembayaran mengunci perilaku yang benar, so that perbaikan ini tidak kembali rusak dan parity test Fase 2 memakai acuan yang benar.

**Test terdampak** (dari pencarian `makePaymentEntry` serta pemanggil `onApproved`/`cancel` Payment Entry di `tests/`):

| Berkas | Memakai | Dampak perubahan |
|---|---|---|
| `Characterization/PaymentEntryPostingTest.php` (`makePaymentEntry` pada 4 test) | `makePaymentEntry(..., cash, receivable)` + `onApproved` | test pertama (`assertLedger`) mengunci arah lama dan **wajib dibalik**; tiga test lain tidak mengunci arah, cukup urutan akun fixture diperbaiki |
| `Characterization/KnownIssues/PartialPaymentPostsCumulativeAmountTest.php` | `makePaymentEntry` dua kali + `onApproved` | mengunci GL kumulatif dan debit kas; **wajib dibalik** (jumlah dan arah) |
| `Characterization/KnownIssues/ForeignCurrencyPaymentPostingTest.php` | `makePaymentEntry` + `onApproved` | mengunci debit kas dan kredit piutang bernilai 100; **arah dibalik**, nilai 100 dan F-11 tetap |
| `Characterization/KnownIssues/CancelSoftDeletesLedgerTest.php` (test Payment Entry) | `makePaymentEntry` + `onApproved` + `cancel` | mengunci `paid_amount` faktur tidak dikembalikan; **wajib dibalik** untuk bagian itu; bagian GL hanya perlu urutan akun fixture diperbaiki |
| `PaymentEntrySubmitTest.php` | membuat Payment Entry sendiri (`:129-136`), bukan lewat `makePaymentEntry`; `onApproved` | hanya mengunci `transaction_date`, tidak mengunci arah; **tidak perlu berubah** (urutan akun lokalnya boleh dirapikan, tidak wajib) |
| `Core/SubmitableServiceContractTest.php`, `Core/DocumentConnectionTest.php`, `Core/RelationPanelPagesTest.php`, `Report/SalesInvoiceReportTest.php`, `Report/PurchaseInvoiceReportTest.php` (membuat baris Payment Entry langsung lewat `reportInsertRow`, `:83`, tanpa `onApproved`) | tidak memanggil `onApproved`/`cancel` Payment Entry (hanya kontrak, relasi, atau data laporan) | tidak terdampak |

#### Acceptance Criteria

1. THE fixture `makePaymentEntry` dan setiap test yang memanggilnya SHALL memakai akun sesuai filter form: `receive` dengan `paid_from` = akun piutang dan `paid_to` = akun kas/bank. Pemanggilan `makePaymentEntry($invoice, $amount, $this->cash, $this->receivable)` menjadi `($invoice, $amount, $this->receivable, $this->cash)`.
2. THE test karakterisasi `PaymentEntryPostingTest::test_full_payment_debits_paid_from_and_credits_paid_to_with_payment_date` SHALL diperbarui menjadi test regresi arah baru (Dr kas/bank = `paid_to`, Cr piutang = `paid_from`), dengan nama dan komentar yang tidak lagi menyatakan arah lama.
3. THE known-issue test `PartialPaymentPostsCumulativeAmountTest` SHALL diubah menjadi test regresi: GL pembayaran kedua = 300.000, Σ debit kas = 700.000, `paid_amount` faktur 700.000; label F-10 dan grup `known-issue` dilepas.
4. THE known-issue test `CancelSoftDeletesLedgerTest::test_f04_cancel_payment_entry_...` SHALL tetap mengunci bagian GL yang masih salah (soft-delete tanpa pembalik, F-04 bagian GL) dan tidak lagi menegaskan bahwa `paid_amount` tidak dikembalikan; pemulihan `paid_amount`, status, dan jadwal dikunci oleh test regresi baru. Test untuk Sales Invoice dan Stock Entry di berkas itu tidak diubah.
5. THE test baru SHALL mencakup:
   1. jadwal pembayaran: tiga kasus Requirement 3 (400.000 lalu 300.000; 400.000 lalu pelunasan sisa; jadwal lunas tidak di-reset pada cicilan ke-2 atas jadwal ganda), **ditulis dan dijalankan lebih dulu terhadap kode lama sehingga gagal**, lalu lulus setelah perbaikan;
   2. pembatalan Payment Entry parsial: faktur kembali `partially_paid` dan status `paid` dibuang;
   3. pembatalan Payment Entry tunggal yang melunasi: faktur kembali `unpaid`, dan `paid` serta `partially_paid` tidak tersisa di larik status;
   4. pembatalan Payment Entry yang belum diterapkan (`need_approval`, `rejected`): faktur tidak berubah;
   5. **pemanggilan `cancel` dua kali berturut-turut** atas Payment Entry yang sama: `paid_amount` dan status faktur sama dengan setelah pemanggilan pertama (tidak dikurangi dua kali);
   6. pembatalan salah satu dari dua Payment Entry atas faktur yang sama: total kumulatif berkurang, status `partially_paid`, jadwal dialokasikan ulang;
   7. pembatalan yang akan menghasilkan total negatif ditolak dengan galat validasi dan tidak mengubah data;
   8. pembayaran `pay` atas Purchase Invoice: Dr utang = `paid_to`, Cr kas/bank = `paid_from`;
   9. guard: `update` Payment Entry non-draft ditolak dan `update` draft tetap berhasil; `onApproved` atas PE `paid`, `canceled`, atau `rejected` adalah no-op (submit kedua atas PE `paid` tidak mengubah `paid_amount`, status, jadwal, dan GL); `onApproved` atas `draft` dan `need_approval` tetap diterapkan;
   10. default controller Purchase Invoice: `account_paid_from` = bank, `account_paid_to` = `creditAccount`; guard `update` dan pembatalan bernilai negatif lewat HTTP (galat tampil pada respons, data tidak berubah);
   11. validasi `PaymentEntryRequest`: `paid_amount` 0 ditolak, melebihi sisa tagihan ditolak, sama dengan sisa diterima, dan `internal_transfer` serta dokumen retur tidak terkena batas atas.
6. THE test SHALL memakai PHPUnit dan helper `BuildsFinanceFixtures`, dan seluruh `tests/Feature/Finances` SHALL lulus.
7. THE penempatan test: test regresi untuk perilaku yang kini benar SHALL berada di `tests/Feature/Finances/` (bukan `Characterization/`), dan `Characterization/KnownIssues/` hanya memuat perilaku yang masih salah (F-04 bagian GL dan F-11). Konsekuensinya `PaymentEntryPostingTest` pindah ke `tests/Feature/Finances/` dan `PartialPaymentPostsCumulativeAmountTest` dikonversi menjadi berkas tersendiri `tests/Feature/Finances/PaymentEntryPartialPaymentTest.php` (bukan dilebur dan bukan dihapus; detail di design.md, D-10).

_Diputuskan 2026-11-04 (pemilik produk, Q6): penempatan test seperti butir 7._

### Requirement 9: Batasan non-fungsional

#### Acceptance Criteria

1. THE perubahan SHALL TIDAK menambah migration dan TIDAK mengubah data yang sudah ada (tidak ada backfill atau koreksi GL historis).
2. THE posting GL SHALL tetap sinkron di dalam transaksi `onApproved` seperti sekarang (tidak dipindah ke antrean, tidak menambah `GlPostingStatus`).
3. THE kode SHALL tetap berada di `PaymentEntryService` (dan listener terkait bila diperlukan), `PaymentEntryController` (default akun), `PaymentEntryRequest` (validasi), serta berkas terjemahan `lang/id/finances/paymentEntry.php` dan `lang/en/finances/paymentEntry.php`; tidak membuat folder dasar baru.
4. THE bagian kode PHP yang berubah SHALL lolos `vendor/bin/pint --dirty --format agent`.
5. THE test yang disentuh SHALL lulus pada `php artisan test --compact` (berkas yang disentuh, dan `tests/Feature/Finances` penuh sebelum merge).
6. THE kunci terjemahan baru (pesan galat guard update, guard submit, batas jumlah pembayaran, pembatalan negatif, paymentable tidak ditemukan, dan paymentable berubah) SHALL tersedia di `lang/id` dan `lang/en`.

### Requirement 10: Default `paid_amount` dari tombol bayar invoice (Q12)

**User Story:** Sebagai staf keuangan, saya ingin form pembayaran yang dibuka dari invoice terisi jumlah sisa tagihan, so that pengguna yang menerima default tidak ditolak validasi batas atas (Requirement 7) setelah pembayaran parsial.

**Perilaku sekarang** (terverifikasi dari kode):

- **F22.** `PaymentSchedule::getDetailPayment` menjumlahkan `payment_amount` jadwal yang `outstanding_amount`-nya masih positif (`PaymentSchedule.php:107-127`), bukan sisanya, dan `PaymentEntryController::create` memakainya sebagai `paid_amount` default untuk Sales Invoice dan Purchase Invoice. Setelah pembayaran parsial 400.000 atas faktur 1.000.000, default tetap 1.000.000, yang kini ditolak Requirement 7. Satu-satunya pemanggil `getDetailPayment` adalah dua cabang `PaymentEntryController::create` tersebut.

#### Acceptance Criteria

1. THE `PaymentSchedule::getDetailPayment` SHALL menjumlahkan `outstanding_amount` (bukan `payment_amount`) jadwal; jadwal yang sudah lunas (`outstanding_amount <= 0`) tetap dilewati, dan jadwal setelah yang pertama yang belum jatuh tempo tetap dilewati seperti sekarang.
2. THE `PaymentEntryController::create` untuk Sales Invoice dan Purchase Invoice **non-retur** SHALL mengisi `paid_amount` default dengan `min(total sisa jadwal, outstanding_amount faktur)`, tidak kurang dari 0.
3. THE default `paid_amount` untuk dokumen retur SHALL tidak dibatasi oleh `outstanding_amount` faktur (selaras dengan Requirement 7.3; retur ditangani di Q4).
4. WHEN form dibuka dari Sales Invoice 1.000.000 yang sudah dibayar 400.000, THE default `paid_amount` SHALL 600.000 dan penyimpanan dengan nilai itu SHALL lolos validasi Requirement 7; hal yang sama untuk Purchase Invoice.

_Diputuskan 2026-11-04 (pemilik produk, Q12): di luar keputusan awal, disetujui; ikut paket._

## Keputusan dan Pertanyaan

Semua pertanyaan spec ini dijawab pemilik produk pada **2026-11-04**. Tidak ada pertanyaan yang memblokir implementasi. Pertanyaan baru yang muncul saat menyusun design (Q11) dan saat review (Q12) juga telah dijawab pada hari yang sama.

| ID | Pertanyaan | Keputusan | Dampak |
|---|---|---|---|
| Q1 (PB-5) | Semantik `account_paid_from`/`account_paid_to` | **Diputuskan 2026-11-04 (pemilik produk):** debit `account_paid_to`, kredit `account_paid_from`; receive: Dr kas/bank, Cr piutang; pay: Dr utang, Cr kas/bank. Filter dan label form tidak diubah. | Req 1 |
| Q2 | Temuan sampingan controller | **Diputuskan 2026-11-04:** (a) relasi `debitAccount` yang tidak ada pada Purchase Invoice dan (b) `paid_to` = bank pada `pay` **ikut**; (c) `customer_id` sebagai akun pada retur **tidak ikut** (masuk Q4). | Req 6 |
| Q3 | Alokasi jadwal pembayaran ditimpa | **Diputuskan 2026-11-04:** ikut paket sebagai bug baru (N-10), dibuktikan dulu dengan test yang gagal; pemulihan jadwal saat pembatalan menjadi kewajiban. | Req 3, 4.7, 8.5.1 |
| Q4 | Retur dan `internal_transfer` | **Diputuskan 2026-11-04:** di luar paket; dicatat sebagai temuan baru. Catatan verifikasi kode (belum diuji): (a) `fillRelations` menurunkan kelas pihak dan dokumen dari `payment_type` (`PaymentEntryService.php:37-39`) sedangkan form dan request menurunkannya dari `party_type` (`PaymentEntryRequest.php:30,36`; `Form.jsx:345-368`), sehingga retur (pelanggan + `pay`, pemasok + `receive`) diduga gagal `ModelNotFoundException` di `onApproved` (`:84-86`); (b) filter akun form untuk `pay`/`receive` tidak cocok untuk pengembalian dana (`Form.jsx:439-470`) dan default retur mengisi `account_paid_to` dengan `customer_id` (`PaymentEntryController.php:81,109`); (c) `internal_transfer` lolos validasi (`PaymentEntryRequest.php:26`) tetapi `fillRelations` membaca `$data['partyable']['id']` dan `$data['paymentable']['id']` tanpa pengecekan (`:36,38`). Hotfix tidak boleh menambah kegagalan pada jalur ini. | Req 1.7, 6.3, 7.3 |
| Q5 | Pembatalan saat ada pembayaran lain; hasil negatif | **Diputuskan 2026-11-04:** pengurangan atas total kumulatif, urutan tidak dibatasi, jadwal dialokasikan ulang, hasil negatif ditolak dengan galat. | Req 4.7-4.9 |
| Q6 | Penempatan test regresi | **Diputuskan 2026-11-04:** perilaku yang kini benar pindah ke `tests/Feature/Finances/`; `KnownIssues` hanya untuk perilaku yang masih salah. | Req 8.7 |
| Q7 | Koreksi data historis dan reset staging | **Diputuskan 2026-11-03/04:** di luar hotfix; dicatat di decision log (D-14). | Backfill Fase 1; hasil `finance:audit-gl` |
| Q8 | GL tanpa konversi kurs | **Diputuskan:** diterima sampai Fase 4 (F-11); dicatat di decision log. | Req 2.4 |
| Q9 | Validasi sisi server | **Diputuskan 2026-11-04:** (b) `paid_amount` > 0 dan tidak melebihi sisa tagihan **ikut**; (a) validasi tipe akun **tidak ikut**. | Req 7 |
| Q10 | Guard status dan immutability | **Diputuskan 2026-11-04:** opsi (a) server menolak `update` PE non-draft, dan (c) `onApproved` memeriksa ulang status di bawah kunci (kunci Payment Entry setelah paymentable, `PaymentEntryService.php:84-86`): izinkan `draft`/`need_approval`, no-op bila `paid`/`canceled`/`rejected`. Opsi (b) tidak dipakai. | Req 4.1, 4.2, 4.5, 5 |
| Q11 | `PaymentEntryService::submit` tidak menolak submit ulang atas PE non-draft: efek samping selain penerapan pembayaran tetap terjadi (kode PE diganti nomor baru lewat `FormatingSeries::generate` yang menaikkan counter, dan `DocumentSubmitted` dikirim ulang). Apakah `submit` untuk non-draft juga ditolak? | **Diputuskan 2026-11-04 (pemilik produk):** ya, ikut paket sebagai guard `submit` (status dibaca ulang di bawah kunci, seperti guard `update`). Di luar keputusan awal; disetujui. | Req 5.3, 5.6 |
| Q12 | Default `paid_amount` dari tombol bayar invoice menjumlahkan `payment_amount` jadwal, sehingga setelah pembayaran parsial melebihi sisa tagihan dan ditolak Requirement 7. Apakah ikut paket? | **Diputuskan 2026-11-04 (pemilik produk):** ya, default menjadi `min(total sisa jadwal, sisa faktur)`. Di luar keputusan awal; disetujui. | Req 6.3, 10 |
