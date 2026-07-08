# Requirements Document

## Introduction

Fitur sertifikat internal (dompdf) saat ini punya template PDF placeholder — portrait, tanpa branding lengkap, tanpa barcode, dan proses penerbitannya masih manual (admin harus klik "Terbitkan via Template" per student). Fitur ini merapikan tiga hal sekaligus:

1. **Desain ulang template PDF sertifikat** ke A4 Landscape dengan barcode 1D + QR (2D) pada halaman depan dan belakang.
2. **Halaman verifikasi publik** (`/verify/{credentialId}`) yang menampilkan status keabsahan sertifikat dan preview PDF via Google Docs Viewer, diakses lewat scan QR di sertifikat.
3. **Penerbitan otomatis** — begitu evaluasi peserta difinalisasi (final + lulus) oleh admin, sertifikat PDF langsung ter-generate tanpa perlu diklik manual.

Scope eksplisit **tidak termasuk**: editor WYSIWYG untuk `front_content`/`back_content` template (kolom sudah ada di database tapi belum dipakai, disepakati dikerjakan nanti), dan penambahan field tanggal mulai/selesai course baru (periode pelatihan tetap memakai `total_sessions`/`total_hours` yang sudah ada).

## Glossary

- **Sertifikat internal**: sertifikat yang di-generate sebagai PDF oleh aplikasi sendiri (dompdf), dibedakan dari jalur lama via Google Docs (`source = 'template'` vs sumber lain di kolom `certificates.source`).
- **Credential ID**: nomor sertifikat unik, format `INK-{tahun}-{prefix-course}-{urutan}`, sudah digenerate oleh `CertificateService::generateCredentialId()`.
- **Evaluasi final**: status `EnrollmentEvaluation.status = 'final'` — evaluasi peserta sudah disetujui admin (state terakhir dari alur draft → submitted_instructor → final).
- **Signed URL**: URL Laravel yang ditandatangani (`URL::temporarySignedRoute`), punya masa berlaku terbatas, ditolak (403) kalau signature tidak cocok atau sudah kedaluwarsa.
- **Halaman verifikasi**: halaman publik (tanpa login) yang menampilkan status keabsahan sebuah sertifikat berdasarkan credential ID.

## Requirements

### Requirement 1: Desain ulang layout PDF sertifikat ke A4 Landscape

**User Story:** Sebagai admin, saya ingin sertifikat yang diterbitkan aplikasi punya tampilan profesional dalam format A4 Landscape, sehingga peserta menerima dokumen yang layak dan konsisten dengan standar sertifikat pelatihan.

#### Acceptance Criteria

1. THE sistem SHALL menghasilkan PDF sertifikat dengan ukuran kertas A4 orientasi landscape.
2. THE halaman depan sertifikat SHALL memuat: logo INKINDO JATIM, nama penyelenggara "INKINDO JATIM", identitas peserta (nama), judul pelatihan, periode pelatihan, nomor sertifikat, dan tanda tangan pihak berwenang (gambar tanda tangan, nama, dan jabatan penandatangan).
3. THE halaman belakang sertifikat SHALL memuat: judul pelatihan, periode pelatihan, nama instruktur, nomor sertifikat, dan daftar materi/modul pelatihan yang diikuti peserta.
4. WHEN skema kelulusan course adalah "assignment" AND nilai akhir peserta tersedia, THE halaman depan SHALL menampilkan nilai akhir dan grade peserta.
5. THE sistem SHALL menghasilkan PDF yang siap diunduh melalui mekanisme download yang sudah ada tanpa perubahan pada cara file disimpan.

### Requirement 2: Barcode 1D dan QR code pada sertifikat

**User Story:** Sebagai penerima sertifikat atau pihak yang memverifikasi, saya ingin ada barcode dan QR code pada sertifikat, sehingga keaslian sertifikat bisa dicek secara cepat baik manual maupun digital.

#### Acceptance Criteria

1. THE barcode 1D pada halaman depan dan halaman belakang sertifikat SHALL mengenkode nomor sertifikat (credential ID) saja — bukan URL atau data lain — dan ditempatkan berdampingan (satu unit visual) dengan teks nomor sertifikat.
2. THE QR code (barcode 2D) pada halaman depan dan halaman belakang sertifikat SHALL mengenkode URL halaman verifikasi digital sertifikat tersebut (`/verify/{credentialId}`) — bukan nomor sertifikat saja.
3. WHEN PDF sertifikat digenerate, THE sistem SHALL membuat barcode dan QR code secara otomatis dari nomor sertifikat dan URL verifikasi, tanpa input manual dari admin.

### Requirement 3: Halaman verifikasi sertifikat publik

**User Story:** Sebagai pihak ketiga (misal HRD calon pemberi kerja) yang menerima sertifikat, saya ingin bisa memindai QR code pada sertifikat dan langsung melihat status keabsahannya beserta preview dokumennya, sehingga saya bisa memverifikasi keaslian sertifikat tanpa perlu login ke sistem.

#### Acceptance Criteria

1. THE sistem SHALL menyediakan halaman publik (tanpa autentikasi) yang dapat diakses melalui URL berisi nomor sertifikat.
2. WHEN nomor sertifikat tidak ditemukan, THE halaman verifikasi SHALL menampilkan pesan "Nomor sertifikat tidak ditemukan" tanpa menampilkan preview dokumen.
3. WHEN sertifikat ditemukan dengan status dicabut (revoked), THE halaman verifikasi SHALL menampilkan pesan "Sertifikat telah dicabut" tanpa menampilkan preview dokumen.
4. WHEN sertifikat ditemukan dengan status kedaluwarsa (expired), THE halaman verifikasi SHALL menampilkan pesan bahwa sertifikat telah kedaluwarsa beserta tanggal kedaluwarsanya, tanpa menampilkan preview dokumen.
5. WHEN sertifikat ditemukan dengan status aktif, THE halaman verifikasi SHALL menampilkan informasi identitas sertifikat (nama peserta, judul pelatihan, nomor sertifikat, tanggal terbit) dan preview dokumen PDF.
6. WHEN sertifikat berstatus aktif dan preview dokumen ditampilkan, THE preview SHALL dirender melalui Google Docs Viewer dalam iframe yang mengisi penuh area tampilan (full screen).
7. THE halaman verifikasi SHALL menyediakan input untuk memasukkan/mengubah nomor sertifikat secara manual, memungkinkan pengguna memverifikasi nomor sertifikat lain dari halaman yang sama.
8. THE halaman verifikasi publik SHALL tidak menyediakan tombol atau tautan unduh dokumen PDF dalam bentuk apapun — akses pada halaman ini terbatas pada preview saja, terlepas dari siapa yang mengaksesnya (termasuk pemilik sertifikat itu sendiri jika mengakses lewat halaman publik ini).

### Requirement 6: Akses preview dan unduh sertifikat oleh pemilik (student)

**User Story:** Sebagai student, saya ingin bisa melihat pratinjau dan mengunduh sertifikat milik saya sendiri melalui halaman "My Certificates", sehingga saya bisa menyimpan salinan pribadi tanpa batasan waktu seperti pada tautan verifikasi publik.

#### Acceptance Criteria

1. THE sistem SHALL menyediakan akses preview dan unduh dokumen PDF sertifikat khusus untuk pemilik sertifikat (student yang bersangkutan) melalui halaman "My Certificates" yang sudah ada, terpisah dari halaman verifikasi publik.
2. WHEN student mengakses preview atau unduh sertifikat, THE sistem SHALL memverifikasi bahwa sertifikat tersebut adalah milik student yang sedang login (kepemilikan dicocokkan berdasarkan user_id), dan menolak akses (403) jika bukan pemiliknya.
3. THE akses preview/unduh oleh pemilik sertifikat SHALL tidak menggunakan mekanisme signed URL 15 menit yang dipakai halaman verifikasi publik — akses ini dilindungi oleh autentikasi dan pengecekan kepemilikan, bukan oleh batas waktu.
4. THE perilaku preview dan unduh sertifikat oleh student yang sudah ada saat ini SHALL tetap berfungsi tanpa perubahan.

### Requirement 4: Akses dokumen PDF terbatas waktu untuk preview

**User Story:** Sebagai pemilik sistem, saya ingin URL dokumen PDF yang dipakai oleh Google Docs Viewer hanya valid dalam jangka waktu singkat, sehingga tautan tidak bisa disalahgunakan untuk mengakses dokumen secara permanen di luar konteks halaman verifikasi.

#### Acceptance Criteria

1. WHEN halaman verifikasi menampilkan preview untuk sertifikat aktif, THE sistem SHALL menghasilkan URL bertanda tangan (signed URL) yang valid selama 15 menit sejak dibuat.
2. WHEN URL bertanda tangan diakses setelah masa berlaku 15 menit habis, THE sistem SHALL menolak akses (403).
3. WHEN URL bertanda tangan diakses dengan signature yang tidak valid atau dimodifikasi, THE sistem SHALL menolak akses (403).
4. THE endpoint streaming PDF SHALL dapat diakses tanpa autentikasi pengguna (karena diakses oleh server Google Docs Viewer, bukan browser pengguna langsung), namun tetap dilindungi oleh validasi signature.
5. THE endpoint streaming PDF SHALL hanya melayani sertifikat yang berasal dari sumber template internal (bukan sertifikat hasil upload manual atau jalur Google Docs lama).

### Requirement 5: Penerbitan sertifikat otomatis saat evaluasi difinalisasi

**User Story:** Sebagai admin, saya ingin sertifikat langsung terbit secara otomatis begitu saya menyetujui (submit final) evaluasi seorang peserta yang lulus, sehingga saya tidak perlu lagi membuka halaman terpisah dan mengklik tombol terbitkan untuk setiap peserta satu per satu.

#### Acceptance Criteria

1. WHEN admin submit final evaluasi seorang peserta DAN peserta tersebut dinyatakan lulus (is_passed = true), THE sistem SHALL secara otomatis memicu proses penerbitan sertifikat untuk peserta tersebut tanpa memerlukan aksi manual tambahan.
2. THE proses penerbitan otomatis SHALL dijalankan secara asynchronous (queue job), tidak memblokir respon halaman submit final admin.
3. IF template sertifikat aktif tidak ditemukan untuk course tersebut, THEN sistem SHALL mencatat log peringatan dan evaluasi tetap berstatus final (proses approval tidak gagal/batal).
4. IF proses generate sertifikat gagal karena error lain, THEN sistem SHALL mencatat log peringatan dan evaluasi tetap berstatus final.
5. WHEN peserta sudah memiliki sertifikat yang diterbitkan sebelumnya, THE sistem SHALL tidak menerbitkan sertifikat duplikat.
6. THE sistem SHALL tetap menyediakan tombol penerbitan manual ("Terbitkan via Template") pada halaman admin yang sudah ada, sebagai jalur cadangan untuk menerbitkan ulang ketika penerbitan otomatis gagal atau untuk peserta yang final sebelum fitur ini ada.

## Out of Scope

- Editor WYSIWYG untuk kustomisasi `front_content`/`back_content` template per course (kolom database sudah tersedia, pengerjaan ditunda).
- Penambahan field tanggal mulai/selesai pelatihan pada model Course — periode pelatihan tetap dihitung dari `total_sessions`/`total_hours` yang sudah ada.
- Perubahan pada jalur penerbitan sertifikat lama via Google Docs (`issueCertificate()`), termasuk `IssueCertificateJob` yang sudah ada.
- Perubahan pada alur download sertifikat oleh student yang sudah ada (`Student\CertificateController::download()`).
