# Requirements Document

## Introduction

Fitur amend (`Submitable::amend()`, `app/Traits/Submitable.php`) memungkinkan user membuat revisi baru dari dokumen (SalesOrder, PurchaseOrder, dll — 12 modul submitable) yang berstatus `canceled`/`rejected`, tanpa membuat dokumen dari nol. Audit menyeluruh terhadap fitur ini menemukan 2 bug pada proses replicate saat amend, dan 1 bug tambahan dilaporkan langsung oleh user pada alur submit dokumen hasil amend. Ketiganya membuat data hasil amend tidak konsisten dengan ekspektasi bisnis: relasi item rusak secara silent, amend concurrent bisa gagal dengan error mentah, dan jejak revisi hilang begitu dokumen amend disubmit ulang.

Root cause dan desain teknis sudah dirumuskan di `design.md` melalui pembacaan langsung kode (`app/Traits/Submitable.php`, `app/Models/Core/FormatingSeries.php`, 12 file service submitable) dan verifikasi ke live database (MySQL). Dokumen ini menurunkan acceptance criteria dari desain tersebut.

## Glossary

- **Amend**: proses membuat dokumen revisi baru dari dokumen berstatus `canceled`/`rejected`, via `Submitable::amend()`.
- **Root document**: dokumen asli yang belum pernah menjadi hasil amend (`amended_from_id` bernilai `null`).
- **Dokumen hasil amend**: dokumen yang `amended_from_id`-nya menunjuk ke root document (dibuat lewat proses amend).
- **Split-item**: item pada dokumen (mis. `PurchaseOrderItem`, `SalesOrderItem`) yang merupakan hasil pemecahan quantity dari item lain, ditandai kolom self-reference `parent_item_id` yang menunjuk ke item induknya pada tabel yang sama.
- **Revision number**: kolom `revision_number` pada root document, naik setiap kali root document (atau salah satu turunannya) di-amend; dipakai membentuk suffix `code` (`-1`, `-2`, dst).
- **FormatingSeries**: model (`app/Models/Core/FormatingSeries.php`) yang menghasilkan `code` dokumen dari template format + counter per-periode, dipanggil lewat `FormatingSeries::generate()`.

## Requirements

### Requirement 1: Item split (`parent_item_id`) tetap valid setelah amend

**User Story:** As a staff yang mengoreksi PO/SO dengan item hasil split quantity, I want relasi parent-child antar item tetap benar setelah dokumen di-amend, so that laporan/query yang bergantung pada struktur split-item tidak menunjukkan data yang salah atau hilang.

#### Acceptance Criteria

1. WHEN dokumen dengan item yang memiliki `parent_item_id` (menunjuk ke item lain pada dokumen yang sama) di-amend, THE sistem SHALL membuat item baru yang `parent_item_id`-nya menunjuk ke id item baru pada dokumen hasil amend (bukan id item pada dokumen lama).
2. WHEN dokumen dengan item yang `parent_item_id`-nya `null` (item biasa, bukan hasil split) di-amend, THE sistem SHALL mempertahankan nilai `null` tersebut pada item hasil amend.
3. THE sistem SHALL mendeteksi kolom self-reference pada tabel item secara generic (berdasarkan metadata foreign key yang mengarah ke tabel itu sendiri), bukan berdasarkan nama kolom yang di-hardcode, supaya tabel item baru di masa depan otomatis tercakup tanpa perubahan kode manual.
4. IF sebuah item pada dokumen hasil amend memiliki `parent_item_id` yang mengacu pada item yang tidak termasuk dalam batch item yang sedang di-replicate, THEN THE sistem SHALL membiarkan nilai kolom tersebut apa adanya (tidak melempar error, tidak melakukan remapping paksa).

### Requirement 2: Amend concurrent pada root yang sama tidak menghasilkan error mentah

**User Story:** As a user yang melakukan amend saat user lain juga sedang meng-amend revisi lain dari root document yang sama, I want proses amend tetap aman dan gagal dengan pesan yang jelas jika benar-benar bentrok, so that saya tidak mendapat error teknis (HTTP 500) yang membingungkan.

#### Acceptance Criteria

1. WHEN proses amend membaca `revision_number` milik root document untuk menentukan suffix `code` berikutnya, THE sistem SHALL mengunci baris root document tersebut (row-level lock) selama transaksi amend berlangsung.
2. WHEN dua proses amend berjalan bersamaan dan menyasar root document yang sama, THE sistem SHALL memproses keduanya secara berurutan (salah satu menunggu hingga transaksi pertama selesai), sehingga masing-masing menghasilkan `code` yang berbeda.
3. IF penyisipan dokumen hasil amend tetap gagal karena pelanggaran unique constraint pada kolom `code` (setelah row-lock), THEN THE sistem SHALL menampilkan pesan error yang jelas dan actionable kepada user, bukan `QueryException` mentah.
4. THE sistem SHALL tidak mengubah struktur/skema kolom `code` (unique constraint pada kolom tersebut sudah ada di seluruh tabel submitable dan tidak perlu migration baru).

### Requirement 3: Kode dokumen hasil amend tidak berubah saat disubmit ulang

**User Story:** As a user yang men-submit dokumen hasil amend (setelah mengoreksi datanya), I want kode dokumen (termasuk suffix revisi) tetap sama seperti saat amend dibuat, so that jejak bahwa dokumen ini adalah revisi ke-berapa dari dokumen mana tidak hilang.

#### Acceptance Criteria

1. WHEN dokumen dengan `amended_from_id` terisi (hasil amend) disubmit, THE sistem SHALL mempertahankan nilai `code` yang sudah ada apa adanya, tanpa memanggil ulang proses generate kode.
2. WHEN dokumen tanpa `amended_from_id` (dokumen normal, bukan hasil amend) disubmit, THE sistem SHALL tetap menghasilkan `code` melalui proses generate seperti perilaku saat ini (tidak ada regresi).
3. WHEN submit dokumen hasil amend terjadi, THE sistem SHALL tidak menaikkan counter internal (`logs`) milik `FormatingSeries` untuk model tersebut, karena kode tidak benar-benar di-generate ulang.
4. THE sistem SHALL menerapkan perbaikan ini pada satu titik terpusat (`FormatingSeries::generate()`) sehingga otomatis berlaku untuk seluruh modul submitable saat ini (12 modul) maupun modul baru di masa depan, tanpa perlu mengubah kode di setiap service satu per satu.

## Out of Scope

Ditegaskan dari `design.md`, TIDAK termasuk requirement di atas (butuh keputusan produk terpisah):

- Dokumen turunan (`ModelConnection`) tidak ikut ter-link ke dokumen hasil amend.
- `GeneralLedger`/`StockLedgerEntry` tidak otomatis dibuat ulang setelah amend.
- `ApprovalInstance` tidak otomatis dibuat untuk dokumen hasil amend; histori approval tidak diwariskan.
- Guard `canDelete` untuk dokumen yang sudah pernah di-amend saat ini bergantung kebetulan pada status `DRAFT`, bukan proteksi eksplisit berbasis keberadaan dokumen turunan hasil amend.
- Perilaku `FormatingSeries::generate()` di luar konteks amend (mis. edit manual `code` oleh user sebelum submit).
