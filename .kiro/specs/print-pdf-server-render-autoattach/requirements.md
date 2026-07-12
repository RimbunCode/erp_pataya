# Requirements Document

## Introduction

Spec [[print-template-pdf-export]] menambahkan kemampuan mengunduh dokumen
print sebagai PDF secara manual dari halaman `Core/Print.jsx`. PDF yang
dihasilkan hanya diunduh ke browser pengguna — tidak pernah disimpan sebagai
lampiran resmi pada dokumen (Sales Order, Purchase Order, dll).

Fitur ini menambahkan dua hal:

1. Setiap PDF yang berhasil di-generate (baik manual maupun otomatis)
   disimpan sebagai lampiran (`Fileable`) pada dokumen sumbernya, dengan
   nama file berstempel waktu agar tidak menimpa lampiran sebelumnya.
2. PDF juga di-generate dan di-attach **secara otomatis** ketika sebuah
   dokumen selesai melalui seluruh alur approval-nya — tanpa aksi manual
   dari pengguna.

Trigger otomatis ini terjadi di backend murni (dalam
`ApprovalInstanceController::approve()`), yang tidak memiliki akses ke
browser/iframe. Karena alur render HTML yang sudah ada
(`PrintPreview.jsx` + Handlebars) berjalan di sisi client, memenuhi
kebutuhan ini mengharuskan kemampuan merender print template menjadi HTML
sepenuhnya di server (PHP) — mencakup port logic Handlebars helper dan
`formatData()` dari JavaScript.

## Glossary

- **PrintTemplate**: lihat [[print-template-pdf-export]].
- **PdfExportService**: service existing yang mengonversi HTML menjadi PDF
  (wkhtmltopdf + fallback dompdf), lihat [[print-template-pdf-export]].
- **ApprovalInstance / ApprovalInstanceStep**: model yang merepresentasikan
  proses approval berjalan pada sebuah dokumen — satu instance per dokumen
  yang butuh approval, dengan satu atau lebih step sesuai `ApprovalScheme`.
- **Fileable**: model pivot polymorphic yang menghubungkan `File` ke
  dokumen manapun (`fileable_id`/`fileable_type`).
- **PrintTemplateRenderService**: service baru yang merender model dokumen
  + `PrintTemplate` menjadi HTML lengkap di server, setara dengan yang
  dilakukan `PrintPreview.jsx` di browser.
- **PdfAttachmentService**: service baru yang menyimpan PDF hasil generate
  sebagai `File` + `Fileable` pada dokumen sumbernya.

## Requirements

### Requirement 1: Auto-attach PDF saat dokumen selesai approval

**User Story:** As a pengguna yang menyetujui dokumen melalui alur
approval, I want dokumen tersebut otomatis memiliki lampiran PDF begitu
approval selesai, so that saya tidak perlu membuka halaman print dan
mengunduh PDF secara manual setiap kali dokumen disetujui.

#### Acceptance Criteria

1. WHEN sebuah `ApprovalInstance` mencapai status `APPROVED` (seluruh step
   telah disetujui), THE sistem SHALL merender HTML dokumen tersebut
   menggunakan `PrintTemplate` default untuk model dokumen itu, sepenuhnya
   di server, tanpa bergantung pada browser/client.
2. WHEN HTML berhasil dirender, THE sistem SHALL mengonversinya menjadi PDF
   menggunakan `PdfExportService` yang sudah ada (termasuk mekanisme
   fallback dan sanitasi SSRF yang sudah dibangun).
3. WHEN PDF berhasil dihasilkan, THE sistem SHALL menyimpannya sebagai
   lampiran (`Fileable`) pada dokumen yang baru saja diapprove.
4. IF dokumen tidak memiliki `PrintTemplate` default yang dikonfigurasi,
   THEN THE sistem SHALL melewati proses attach tanpa menggagalkan proses
   approval, dan mencatat kejadian tersebut ke log level info.
5. IF proses render HTML atau generate PDF gagal karena sebab apa pun,
   THEN THE sistem SHALL mencatat kegagalan ke log level error, TANPA
   membatalkan atau me-rollback approval yang sudah tercatat — attach PDF
   adalah efek samping, bukan bagian dari transaksi approval.
6. THE proses attach otomatis SHALL terjadi setelah status approval
   di-commit ke database, bukan di dalam transaksi database yang sama.

### Requirement 2: Auto-attach PDF saat unduh manual

**User Story:** As a pengguna yang mengunduh PDF dari halaman print secara
manual, I want PDF tersebut juga tersimpan sebagai lampiran resmi pada
dokumen, so that riwayat dokumen tetap memiliki jejak PDF yang pernah
dihasilkan, konsisten dengan PDF yang di-generate otomatis saat approval.

#### Acceptance Criteria

1. WHEN pengguna menekan tombol "Download PDF" pada halaman print dan PDF
   berhasil dihasilkan, THE sistem SHALL menyimpan PDF tersebut sebagai
   lampiran (`Fileable`) pada dokumen yang sedang di-print, selain tetap
   mengirimkan PDF sebagai unduhan ke browser pengguna.
2. THE proses attach pada trigger manual SHALL menggunakan mekanisme
   penyimpanan (`PdfAttachmentService`) yang sama dengan trigger approval
   pada Requirement 1, agar tidak ada duplikasi logic penyimpanan file.
3. THE endpoint unduh manual SHALL tetap mengembalikan PDF sebagai response
   stream seperti sebelumnya — proses attach tidak boleh mengubah kontrak
   response yang sudah ada.

### Requirement 3: Penamaan file lampiran anti-overwrite

**User Story:** As a pengguna yang melihat riwayat lampiran sebuah dokumen,
I want setiap PDF yang di-generate ulang tersimpan sebagai file terpisah,
so that saya bisa melihat riwayat PDF dari waktu ke waktu (mis. sebelum dan
sesudah revisi/amend) tanpa kehilangan versi sebelumnya.

#### Acceptance Criteria

1. THE sistem SHALL memberi nama setiap file PDF lampiran dengan format
   yang menyertakan stempel waktu generate (mis.
   `{nama-dokumen}-{YmdHis}.pdf`).
2. WHEN PDF di-generate lebih dari sekali untuk dokumen yang sama (baik via
   approval berulang pada dokumen yang di-amend, maupun unduhan manual
   berulang), THE sistem SHALL membuat record `File` dan `Fileable` baru
   untuk setiap generate — TIDAK menimpa atau menghapus lampiran PDF
   sebelumnya.

### Requirement 4: Render HTML print template di server (PHP)

**User Story:** As pemilik sistem, I want print template bisa dirender
menjadi HTML sepenuhnya di server tanpa browser, so that fitur auto-attach
saat approval bisa berjalan di lingkungan backend murni, konsisten dengan
constraint shared hosting yang sudah ditetapkan pada fitur PDF export
sebelumnya.

#### Acceptance Criteria

1. THE sistem SHALL menyediakan `PrintTemplateRenderService` yang menerima
   model dokumen dan `PrintTemplate`, dan mengembalikan HTML lengkap
   (termasuk letter head bila dikonfigurasi) tanpa memerlukan proses
   browser/JavaScript apa pun.
2. THE render service SHALL mendukung seluruh helper Handlebars yang saat
   ini terdaftar di `initHandlebar.js`: `relation`, `label`, `trans`,
   `companyDetail`, `each`, `infoColumns`, `formatDate`, `formatCurrency`,
   `formatNumber`, `uppercase`, `multiply`, `subtract`, `add`, `divide`.
3. THE render service SHALL mereplikasi logic `formatData()` dari
   `PrintPreview.jsx` untuk seluruh tipe kolom yang didukung: `relation`,
   `relations`, `date`/`time`/`datetime`, `boolean`, `formStatus`,
   `string` (dengan `valueTrans`/`parse`), dan `currency`/`number`
   (dengan resolusi symbol currency).
4. THE render service SHALL menghormati pengaturan `default_language`,
   `show_absolute_values`, dan format halaman/margin yang sama seperti
   yang digunakan pada render client-side saat ini.
5. THE sistem TIDAK PERLU menjamin output HTML dari render server (PHP)
   byte-identik dengan output render client (JavaScript) — validasi
   dilakukan lewat unit test per-sisi terhadap nilai ekspektasi yang
   diketahui benar, bukan lewat automated parity check lintas bahasa (lihat
   design.md bagian "Keputusan yang Sudah Dikonfirmasi").

## Out of Scope

- Menjamin kesamaan byte-demi-byte antara render PHP dan render JavaScript
  (lihat Requirement 4.5).
- UI untuk melihat/mengelola riwayat lampiran PDF secara khusus (memakai
  UI lampiran/`Fileable` yang sudah ada di project).
- Notifikasi ke pengguna saat auto-attach gagal — kegagalan hanya tercatat
  di log server (lihat Requirement 1.4, 1.5).
- Mengubah endpoint/route yang sudah ada di [[print-template-pdf-export]]
  selain menambahkan langkah attach di dalamnya.
