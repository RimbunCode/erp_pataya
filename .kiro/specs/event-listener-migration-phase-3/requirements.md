# Requirements Document

## Introduction

Fase 3 menyasar area GL-entangled (General Ledger posting bercampur dengan mutasi Stock/StockLedgerEntry dalam satu `onApproved()`), yaitu bagian yang dikecualikan total dari Fase 2. Fase ini dipecah 3 kelompok:

1. **Perbaikan race condition** (Requirement 1) — titik query/mutasi yang belum `lockForUpdate()`, ditemukan lewat audit menyeluruh 2026-08-08 terhadap `DeliveryNoteService`, `PurchaseReceiptService`, `PurchaseInvoiceService`. Independen dari desain transaksi di bawah, dikerjakan lebih dulu (pola sama seperti Fase 2 menaruh koreksi Fase 1 sebagai Task pertama).
2. **Fondasi generik GL-via-queue** (Requirement 2-4) — kolom `transaction_date`, tabel tracking status posting (`gl_posting_statuses`, polymorphic — BUKAN spesifik 1 module, karena akan dipakai module lain ke depan), dan halaman monitoring lintas-dokumen. Dibangun sekali, dipakai bersama oleh Requirement 5-7.
3. **Migrasi GL per-service via queued Job** (Requirement 5-7) — `PurchaseReceiptService`, `DeliveryNoteService`, `PurchaseInvoiceService`, masing-masing memindahkan GL posting dari sync-inline ke queued Job memakai fondasi Requirement 2-4.

`LeadService::convertToCustomer()` (kandidat lama di memory `project_event_listener_migration_phases.md`) DIKELUARKAN dari scope — audit 2026-08-08 mengonfirmasi kategorinya beda: return-value-dependent (controller butuh `Customer::id` sebagai return value langsung), bukan transaction-entangled. Jadi solusinya beda pola, didiskusikan terpisah nanti.

**Keputusan desain kunci** (hasil diskusi, jangan diubah tanpa alasan kuat):
- GL posting dipindah dari sync-inline ke `ShouldQueue` Job — beda dari SEMUA listener Fase 1/2 yang sync. Ini SATU-SATUNYA titik di codebase yang benar-benar async terhadap DB.
- Data lama (GL/SLE existing) diisi `transaction_date` dari `created_at` (backfill migration) — tidak ada sumber tanggal transaksi lain yang lebih akurat untuk data lama.
- Laporan yang saat ini sort/filter berdasarkan `created_at` pada `general_ledgers`/`stock_ledger_entries` HARUS diaudit dan diganti ke `transaction_date`.
- Kalau Job GL gagal, retry otomatis di job berikutnya (queue retry Laravel standar) — status tersimpan `pending`/`failed` di tabel tracking, BUKAN silent log saja.
- Tabel tracking status (`gl_posting_statuses`) dan halaman monitoring **generik lintas-module** — pola ini akan dipakai fitur GL-via-queue lain di masa depan, bukan cuma 3 service Fase 3 ini.
- GL selalu 2 entry (debit+credit) per transaksi — desain event/listener HARUS 1 event/listener per titik posting GL (bukan pecah jadi 2), karena 2 entry itu satu kesatuan logis yang harus konsisten.

## Glossary

- **GL-entangled**: method `onApproved()` yang mencampur mutasi Stock/StockLedgerEntry dan posting GeneralLedgerEntry dalam satu transaksi DB, dengan dependency baca-balik (hasil satu operasi dipakai operasi berikutnya sebelum commit).
- **ALUR-1 / ALUR-2**: istilah existing di `PurchaseReceiptService` — ALUR-1 = PO item belum ada invoice (`billed_quantity == 0`), ALUR-2 = PO item sudah ada invoice (`billed_quantity > 0`), menentukan apakah StockLedgerEntry dibuat `is_valuated: true` (pakai rate invoice) atau `is_valuated: false` (pending revaluasi).
- **Transaction date**: tanggal/waktu transaksi bisnis terjadi (dokumen di-approve) — BEDA dari `created_at` (waktu baris ditulis ke DB, bisa telat kalau lewat queue).
- **GL posting status**: status pelacakan apakah GL untuk suatu dokumen sudah tercatat (`posted`), masih menunggu Job (`pending`), atau gagal setelah retry (`failed`).
- **Compensating action**: langkah untuk menangani kegagalan Job GL — di spec ini berupa retry otomatis + status `failed` yang terlihat di halaman monitoring, bukan rollback otomatis (karena transaksi Stock/SLE sudah commit duluan).

## Requirements

### Requirement 1: Perbaikan race condition (lockForUpdate)

**User Story:** Sebagai pemilik sistem, saya ingin titik-titik data yang dibaca lalu dipakai untuk keputusan kritis (percabangan alur, kalkulasi GL) dilindungi row-lock, supaya proses approval dokumen paralel tidak menghasilkan data GL/Stock yang salah akibat race condition.

#### Acceptance Criteria

1. WHEN `PurchaseReceiptService::onApproved()` membaca `PurchaseOrderItem.billed_quantity` untuk menentukan cabang ALUR-1/ALUR-2 (baris ~230, per audit 2026-08-08), THE sistem SHALL mengunci row `PurchaseOrderItem` tersebut dengan `lockForUpdate()` sebelum baca.
2. WHEN `PurchaseReceiptService::onApproved()` membaca/mengubah `PurchaseInvoiceItem.allocated_qty` vs `.quantity` untuk kalkulasi `$availableQty` (ALUR-2, baris ~243), THE sistem SHALL mengunci row `PurchaseInvoiceItem` yang di-query oleh `findInvoiceItemsForPoItem()` dengan `lockForUpdate()`.
3. WHEN `PurchaseReceiptService::onApproved()` (jalur retur) mengubah `returnAgainstItem.returned_quantity` (baris ~206), THE sistem SHALL mengunci row `PurchaseReceiptItem` (`returnAgainstItem`) dengan `lockForUpdate()` sebelum baca-modifikasi-tulis.
4. WHEN `PurchaseInvoiceService::updatePendingSLEs()` meng-query `StockLedgerEntry` pending (`is_valuated = false`) untuk di-split/dikonsumsi FIFO (baris ~399-406), THE sistem SHALL mengunci row `StockLedgerEntry` tersebut dengan `lockForUpdate()` — bukan hanya `Stock` yang sudah terkunci.
5. WHEN `PurchaseInvoiceService::onApproved()` membuat GL entry di blok Expense/Credit (baris ~330-344), THE sistem SHALL mengunci `$debitAccount`/`$creditAccount` dengan `lockForUpdate()`, konsisten dengan blok GL Stock/SRNB yang sudah terkunci.
6. WHEN `PurchaseInvoiceService::onApproved()` (jalur retur) membaca `$returnAgainst` (invoice asal) untuk kalkulasi status retur (baris ~354-373), THE sistem SHALL mengunci row `PurchaseInvoice` (`$returnAgainst`) dengan `lockForUpdate()`.
7. WHEN `DeliveryNoteService::onApproved()` (jalur retur non-rental) mengubah `returnAgainstItem.returned_quantity` (baris ~272-274), THE sistem SHALL mengunci row `DeliveryNoteItem` (`returnAgainstItem`) dengan `lockForUpdate()` sebelum baca-modifikasi-tulis (bukan `increment()` atomic biasa, karena nilai lama dibaca in-memory).
8. IF titik lock baru di atas berada di dalam method yang dipanggil dari `onApproved()` (mis. `updatePendingSLEs()`), THEN implementasi SHALL memverifikasi method tersebut selalu dipanggil di dalam transaksi DB aktif milik caller — TIDAK membuka transaksi baru sendiri.
9. THE sistem SHALL TIDAK mengubah urutan operasi, hasil kalkulasi, atau struktur data (SLE/GL/Stock) yang sudah ada — perubahan Requirement ini murni menambah lock, tanpa logic baru.

### Requirement 2: Kolom `transaction_date` di GeneralLedger dan StockLedgerEntry

**User Story:** Sebagai pemilik sistem, saya ingin GL dan SLE punya kolom tanggal transaksi yang eksplisit terpisah dari `created_at`, supaya kalau posting-nya lewat queue (Requirement 5-7), laporan keuangan/stok tetap merefleksikan kapan dokumen di-approve — bukan kapan worker kebetulan memproses job.

#### Acceptance Criteria

1. THE sistem SHALL menambah kolom `transaction_date` (datetime, NOT NULL) via migration baru ke tabel `general_ledgers` dan `stock_ledger_entries`.
2. WHEN migration dijalankan pada data existing, THE sistem SHALL mengisi `transaction_date` dari nilai `created_at` baris yang sama (backfill) — TIDAK ada sumber tanggal transaksi lain yang lebih akurat untuk data lama.
3. WHEN GL/SLE entry dibuat baru (baik sync langsung di Service yang belum dimigrasi, maupun via queued Job Requirement 5-7), THE sistem SHALL mengisi `transaction_date` dengan waktu dokumen sumber di-approve (`now()` di titik dispatch event/awal `onApproved()`) — BUKAN `now()` di titik Job benar-benar dieksekusi worker.
4. THE sistem SHALL mengaudit query/laporan existing yang sort/filter `general_ledgers`/`stock_ledger_entries` berdasarkan `created_at`, dan mengganti acuan tersebut ke `transaction_date`.

### Requirement 3: Tabel tracking status GL posting (generik, polymorphic)

**User Story:** Sebagai pemilik sistem, saya ingin ada satu mekanisme generik untuk melacak status posting GL suatu dokumen (pending/posted/failed), yang bisa dipakai bukan cuma 3 service Fase 3 ini tapi module manapun ke depan yang butuh GL-via-queue, supaya tidak perlu bikin kolom status berulang di tiap tabel dokumen.

#### Acceptance Criteria

1. THE sistem SHALL membuat tabel baru `gl_posting_statuses` dengan kolom: `id`, `referenceable` (polymorphic — dokumen sumber apapun: PurchaseReceipt/DeliveryNote/PurchaseInvoice/dst), `status` (enum: `pending`, `posted`, `failed`), `retry_count` (integer, default 0), `last_error` (text, nullable), `posted_at` (datetime, nullable), `timestamps`.
2. WHEN suatu Service (Requirement 5-7) dispatch event GL posting SETELAH transaksi Stock/SLE commit, THE sistem SHALL membuat baris `gl_posting_statuses` dengan `status = pending` SEBELUM event di-dispatch (dalam transaksi yang sama dengan Stock/SLE, bukan di dalam Job).
3. WHEN Job GL posting berhasil membuat GeneralLedgerEntry, THE sistem SHALL update baris `gl_posting_statuses` terkait jadi `status = posted`, `posted_at = now()`.
4. IF Job GL posting gagal (exception), THEN sistem SHALL menaikkan `retry_count`, mengisi `last_error` dengan pesan exception, dan MEMBIARKAN queue retry Laravil standar mencoba lagi Job yang sama pada kesempatan berikutnya.
5. IF Job GL posting gagal setelah mencapai batas maksimum retry queue (`tries` job), THEN sistem SHALL set `status = failed` (bukan terus mengulang tanpa batas).
6. THE sistem SHALL menyediakan method/scope query generik (mis. `GlPostingStatus::pending()`, `::failed()`) untuk dipakai Requirement 4 (halaman monitoring) tanpa perlu tahu detail tiap module.

### Requirement 4: Halaman monitoring GL posting lintas-dokumen

**User Story:** Sebagai staf finance/admin, saya ingin melihat satu halaman yang menampilkan semua dokumen (dari module manapun) yang GL-nya masih pending atau gagal, supaya saya bisa memantau dan menindaklanjuti tanpa harus cek satu-satu ke tiap halaman dokumen.

#### Acceptance Criteria

1. THE sistem SHALL menyediakan halaman baru (route + controller + halaman React) yang menampilkan daftar `gl_posting_statuses` dengan `status IN (pending, failed)`, menampilkan: tipe dokumen (nama model `referenceable`), kode/identifier dokumen, status, `retry_count`, `last_error` (jika ada), waktu dibuat.
2. WHEN staf mengklik baris di halaman ini, THE sistem SHALL menyediakan link ke halaman detail dokumen sumber (`referenceable`) yang sesuai.
3. THE sistem SHALL membatasi akses halaman ini dengan permission yang sesuai (konsisten dengan pola permission existing di codebase — cek modul Finance/Accounting yang sudah ada sebagai referensi).
4. WHEN staf mengklik aksi "retry" pada baris berstatus `failed`, THE sistem SHALL dispatch ulang event GL posting yang sesuai (Requirement 5-7) untuk dokumen tersebut, dan reset `retry_count` beserta `status` kembali ke `pending`.
5. THE sistem SHALL TIDAK menampilkan aksi "retry" pada baris berstatus `pending` (masih menunggu giliran queue normal) — aksi ini HANYA untuk `failed`.

### Requirement 5: GL posting `PurchaseReceiptService` via queued Job

**User Story:** Sebagai pemilik sistem, saya ingin posting GL dari penerimaan barang (PurchaseReceipt) berjalan di luar transaksi Stock/SLE utama, memakai fondasi Requirement 2-4, supaya method `onApproved()` lebih ringan dan siap dipisah jadi service terpisah ke depannya (microservice-ready).

#### Acceptance Criteria

1. WHEN `PurchaseReceiptService::onApproved()` menyelesaikan SELURUH mutasi Stock/StockLedgerEntry/status dokumen (termasuk dispatch `PurchaseOrderReceiveStatusRecalculationRequested`), THE sistem SHALL, MASIH DI DALAM transaksi DB yang sama, membuat baris `gl_posting_statuses` (`status = pending`, Requirement 3.2) dan dispatch SATU event baru (nama: `PurchaseReceiptGeneralLedgerPostingRequested`) yang membawa data cukup untuk membangun KEDUA GL entry (jumlah `$totalRatesForGL`/`$glAmount`, arah retur/normal, referensi `PurchaseReceipt`) — TANPA membawa objek yang bisa stale (mis. `$stocks` collection in-memory).
2. THE sistem SHALL membuat SATU listener untuk event ini sebagai `ShouldQueue` (Job), yang membuka transaksi DB BARU sendiri, membuat KEDUA `GeneralLedgerEntry` (kredit/debit sesuai arah retur/normal, identik logic lama) DALAM SATU Job (bukan dipecah 2 job/listener), mengisi `transaction_date` sesuai Requirement 2.3, lalu update `gl_posting_statuses` sesuai Requirement 3.3-3.5.
3. THE sistem SHALL TIDAK mengubah kondisi kapan GL dibuat (`$returnAgainst || $totalRatesForGL > 0`) maupun formula debit/credit — hanya memindahkan EKSEKUSI dari sync-inline ke queued Job.
4. THE sistem SHALL tetap menggunakan `Account::lockForUpdate()` di dalam Job (mengunci SELAMA Job dieksekusi, mencegah race ANTAR JOB yang berjalan bersamaan) — window waktu antara commit transaksi Stock/SLE dan Job mulai dieksekusi (saat masih di antrian) DITERIMA sebagai konsekuensi desain queue, dimitigasi oleh Requirement 2 (urutan via `transaction_date`) dan Requirement 3-4 (visibilitas status pending/failed), BUKAN dicegah dengan lock tambahan.

### Requirement 6: GL posting `DeliveryNoteService` via queued Job

**User Story:** Sebagai pemilik sistem, saya ingin pola yang sama (Requirement 5) diterapkan ke `DeliveryNoteService`, supaya konsisten satu pola migrasi GL-via-queue.

#### Acceptance Criteria

1. WHEN `DeliveryNoteService::onApproved()` menyelesaikan loop item (Stock/SLE, termasuk rental yang TIDAK menghasilkan GL) dan status-sync SalesOrder/InternalOrder (event `DocumentDeliveryStatusRecalculationRequested`, sudah ada dari Fase 2), THE sistem SHALL, MASIH DI DALAM transaksi yang sama, membuat baris `gl_posting_statuses` HANYA jika `$totalPicked > 0` (kondisi existing yang menentukan GL dibuat sama sekali — rental TETAP tidak menghasilkan `gl_posting_statuses` maupun GL entry apapun), dan dispatch SATU event baru (nama: `DeliveryNoteGeneralLedgerPostingRequested`).
2. THE sistem SHALL membuat SATU listener `ShouldQueue` yang membuat KEDUA `GeneralLedgerEntry` (stock vs COGS, forward-pick/retur) dalam satu Job, mengikuti pola Requirement 5.2-5.4 persis.
3. THE sistem SHALL TIDAK mengubah kondisi/formula GL yang sudah ada — hanya memindahkan eksekusi ke queued Job.

### Requirement 7: GL posting `PurchaseInvoiceService` via queued Job

**User Story:** Sebagai pemilik sistem, saya ingin pola yang sama (Requirement 5) diterapkan ke `PurchaseInvoiceService`, supaya ketiga titik GL-entangled konsisten.

#### Acceptance Criteria

1. WHEN `PurchaseInvoiceService::onApproved()` menyelesaikan loop item (billed_quantity via event Fase 2, `updatePendingSLEs()`) dan status-sync PO/retur, THE sistem SHALL, MASIH DI DALAM transaksi yang sama, membuat baris `gl_posting_statuses` dan dispatch SATU event baru (nama: `PurchaseInvoiceGeneralLedgerPostingRequested`) yang membawa data untuk KEDUA blok GL yang ada di method ini (Stock/SRNB kondisional `$totalStockGL > 0`, DAN Expense/Credit yang selalu jalan) — digabung jadi SATU event/listener/Job per approval (bukan dipecah per blok), konsisten prinsip "1 titik posting = 1 event" di Introduction.
2. THE sistem SHALL membuat SATU listener `ShouldQueue` yang membuat SELURUH GeneralLedgerEntry (2-4 entry tergantung apakah blok Stock/SRNB juga trigger) dalam satu Job, mengikuti pola Requirement 5.2-5.4.
3. THE sistem SHALL TIDAK mengubah kondisi/formula GL yang sudah ada — hanya memindahkan eksekusi ke queued Job.

## Catatan Audit (referensi implementasi)

Ringkasan temuan audit menyeluruh 2026-08-08 (detail lengkap ada di histori brainstorming, dirangkum di sini sebagai referensi cepat):

- **`DeliveryNoteService::onApproved()`** (`app/Services/Inventory/DeliveryNoteService.php:153-409`): loop item L183-363 (3 cabang: rental type='rents' TANPA GL, retur, forward-normal FIFO), GL posting L379-404 (2 entry, HANYA jika `$totalPicked > 0` — rental selalu skip).
- **`PurchaseReceiptService::onApproved()`** (`app/Services/Purchase/PurchaseReceiptService.php:121-412`): method terbesar — stock lookup+lock L139-172, loop item L177-371 (return branch vs ALUR-1/ALUR-2), event status-sync L374, GL posting L377-407 (2 entry, kondisi `$returnAgainst || $totalRatesForGL > 0`).
- **`PurchaseInvoiceService::onApproved()`** (`app/Services/Finances/PurchaseInvoiceService.php:246-384`): loop item L267-292 (event `PurchaseOrderItemBillingChanged` per item + `updatePendingSLEs()` kondisional ALUR-1/ALUR-2), GL Stock/SRNB L300-327 (kondisi `$totalStockGL > 0`), GL Expense/Credit L330-344 (selalu jalan), event status-sync L347 & L374.
- Baris di atas adalah snapshot 2026-08-08 — **verifikasi ulang sebelum implementasi**, kode bisa bergeser.
