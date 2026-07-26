# Requirements Document

## Introduction

Fitur kirim email (generic email template + `EmailSendDialog`) punya beberapa bug yang ditemukan saat review manual:

1. Halaman/menu **Email Templates** tidak bisa diakses dari sidebar meski route CRUD backend (`resourceDetail('emailTemplate', ...)`) sudah tersedia.
2. Dialog kirim email menampilkan **key terjemahan mentah** (`core.emailTemplate.send.*`) karena key tersebut belum didefinisikan di file lang.
3. Upload attachment di dialog kirim email pakai implementasi manual (`<input type="file">` + axios + refresh manual), tidak konsisten dengan komponen `UploadDialog` yang jadi standar upload di aplikasi.
4. Default nilai **Send From** memakai nama sistem (`config('mail.from.name')`), bukan nama user yang sedang login — sehingga penerima tidak tahu email dikirim oleh siapa.

Selain perbaikan bug, ada juga perubahan layout: bagian attachments dan checkbox "Sertakan PDF" dipindah ke sidebar kanan dialog (mengikuti pola visual `FormPageDialog`), supaya konten utama (from/to/cc/bcc/subject/body) punya ruang lebih lega di kiri.

## Glossary

- **EmailSendDialog**: komponen dialog (`resources/js/Pages/Core/Components/EmailSendDialog.jsx`) untuk mengirim email manual dari halaman detail dokumen (mis. Sales Order), dipicu dari tombol kirim email.
- **EmailTemplate**: model & halaman admin untuk mengelola template subjek/body email per jenis dokumen.
- **UploadDialog**: komponen upload standar (`resources/js/Pages/Core/Components/UploadDialog.jsx`) yang punya mode `onBuffer` (upload ke `files.store`, hasil dikembalikan via callback tanpa langsung attach ke record) dan mode langsung (submit ke route attach file record).
- **resourceDetail**: route macro Laravel custom yang generate route CRUD standar (index/fields/create/update/destroy) untuk resource dengan pola sidebar-settings.
- **FormPageDialog**: varian dialog dari `FormPage.jsx` yang punya layout 2 kolom — konten utama kiri, sidebar kanan (`w-72`, `border-l`) untuk attachments/tags.

## Requirements

### Requirement 1: Menu Email Templates muncul di sidebar

**User Story:** As an admin, I want membuka halaman Email Templates dari menu Settings, so that saya bisa mengelola template email tanpa mengetik URL manual.

#### Acceptance Criteria

1. THE sidebar settings SHALL menampilkan entry "Email Templates" mengikuti pola entry "Print Templates" yang sudah ada (title, url `/settings/emailTemplates`, urlPattern `/settings/emailTemplates/*`, model `App\Models\Core\EmailTemplate`).
2. WHEN user mengklik entry "Email Templates", THE aplikasi SHALL menampilkan halaman list Email Templates yang sudah didukung route `resourceDetail('emailTemplate', ...)`.
3. THE entry SHALL diposisikan berdekatan dengan entry "Print Templates" (urutan menu tetap konsisten/logis, mengikuti kelompok template).

### Requirement 2: Lang key dialog kirim email lengkap

**User Story:** As a user, I want semua label dan pesan pada dialog kirim email tampil dalam bahasa yang benar (ID/EN), so that saya paham setiap field dan aksi tanpa melihat key mentah.

#### Acceptance Criteria

1. THE `lang/php_id.json` dan `lang/php_en.json` SHALL memiliki seluruh key yang dipakai `EmailSendDialog.jsx` di bawah namespace `core.emailTemplate.send.*`, meliputi minimal: `title`, `from`, `fromNamePlaceholder`, `to`, `cc`, `bcc`, `attachments`, `includePdf`, `uploadFile`, `button`, `queued`.
2. THE key `core.emailTemplate.columns.subject` dan `core.emailTemplate.columns.body` SHALL sudah tersedia (dipakai ulang dari resource EmailTemplate) — jika belum ada, ditambahkan juga.
3. WHEN dialog kirim email dibuka, THE semua label/placeholder/tombol SHALL tampil sebagai teks manusiawi (bukan raw key seperti `core.emailTemplate.send.title`), baik di locale ID maupun EN.

### Requirement 3: Upload attachment via UploadDialog

**User Story:** As a user, I want menambah attachment di dialog kirim email dengan pengalaman upload yang sama seperti bagian lain aplikasi (drag & drop, pilih dari library, progress bar), so that pengalaman konsisten dan tidak ada kode upload duplikat yang rawan bug.

#### Acceptance Criteria

1. THE `EmailSendDialog.jsx` SHALL mengganti implementasi `<input type="file">` + `handleUpload` manual dengan komponen `UploadDialog` (mode `onBuffer`), dipicu lewat trigger button/dialog terpisah (pola sama seperti `Attachments.jsx`).
2. WHEN user memilih/upload file baru lewat `UploadDialog`, THE file yang berhasil diupload (hasil `onBuffer`) SHALL otomatis ditambahkan ke daftar attachment yang dicentang (`selectedFileIds`) tanpa perlu refresh manual via `emailPreview`.
3. THE daftar attachment existing (dari `preview.files`, termasuk generated PDF) SHALL tetap tampil dan bisa dicentang/dilepas seperti sebelumnya — perubahan hanya pada mekanisme *menambah* file baru.
4. THE request upload SHALL tetap menyimpan file ke storage yang sama (`files.store`) dan tidak mengubah kontrak `sendEmail` (`fileIds[]` di payload submit tetap berisi id file yang dicentang).

### Requirement 4: Default Send From pakai nama user login

**User Story:** As a user yang mengirim email dari dokumen, I want nama pengirim default terisi nama saya sendiri, so that penerima tahu siapa yang mengirim email tersebut.

#### Acceptance Criteria

1. WHEN `emailPreview()` di `Controller.php` dipanggil, THE response `fromName` SHALL berisi nama user yang sedang login (`auth()->user()->name`), bukan `config('mail.from.name')`.
2. IF user login tidak punya nama (kasus tepi/edge case tidak mungkin karena `name` wajib di tabel users), THEN THE sistem tidak perlu fallback tambahan — cukup pakai `auth()->user()->name` apa adanya.
3. THE `fromAddress` (alamat email pengirim aktual/SMTP) SHALL tetap memakai `config('mail.from.address')` — tidak berubah, karena ini alamat teknis pengiriman, bukan nama tampilan.
4. THE field "Send From" di dialog SHALL tetap dapat diedit user sebelum kirim (behavior existing dipertahankan) — hanya nilai default awal yang berubah.

### Requirement 5: Layout dialog — attachments & opsi PDF di sidebar kanan

**User Story:** As a user, I want form utama (to/cc/bcc/subject/body) punya ruang lega di kiri dan attachments terpisah rapi di kanan, so that dialog lebih mudah dibaca terutama saat attachment banyak.

#### Acceptance Criteria

1. THE `EmailSendDialog.jsx` SHALL mengubah struktur konten menjadi 2 kolom: kolom kiri berisi From/To/Cc/Bcc/Subject/Body, kolom kanan (sidebar) berisi daftar attachment + checkbox "Sertakan PDF" + tombol upload.
2. THE sidebar kanan SHALL mengikuti pola visual `FormPageDialog` (`FormPage.jsx` sekitar baris 2038–2065): lebar tetap (`lg:w-72`), border pemisah kiri (`lg:border-l`), pada layar sempit (mobile) sidebar turun ke bawah konten utama (stack vertikal, border atas menggantikan border kiri).
3. THE lebar dialog (`DialogContent`) SHALL diperbesar dari `max-w-2xl` menjadi ukuran yang cukup menampung kolom kiri + sidebar kanan baru tanpa membuat kolom kiri terlalu sempit (mis. `max-w-4xl`), agar penambahan sidebar tidak mengurangi ruang konten utama dibanding layout sebelumnya.
4. THE sidebar kanan SHALL memisahkan attachment menjadi section berlabel jelas: "Attachment Dokumen" (attachment yang sudah ada di dokumen — `otherFiles`, masing-masing checkbox tercentang/tidak sesuai `selectedFileIds`), "PDF Dokumen" (file PDF yang sudah pernah digenerate dan tersimpan sebagai attachment — tampil sebagai checkbox, hanya render jika `preview.hasGeneratedPdf` true), dan "Lampiran Baru" (file yang baru diupload lewat `UploadDialog` pada sesi dialog ini berjalan).
5. THE checkbox "Sertakan PDF" (opsi generate PDF baru saat pengiriman, `includePdf`) SHALL tetap hanya muncul ketika `!preview.hasGeneratedPdf && preview.canOfferPdf` — behavior existing ini dipertahankan (bukan requirement baru): jika PDF sudah ada di attachment dokumen (`hasGeneratedPdf` true), opsi generate baru tidak perlu ditampilkan karena PDF existing sudah bisa dicentang langsung dari section "PDF Dokumen".
6. THE perubahan layout SHALL murni presentasional — tidak mengubah state/logic pemilihan file (`selectedFileIds`), field checkbox PDF (`includePdf`), atau payload yang dikirim ke `handleSend`.
7. THE dialog SHALL tetap scrollable dengan baik pada kedua kolom saat konten panjang (mis. banyak attachment atau body email panjang), konsisten dengan constraint `max-h-[85vh]` yang sudah ada.
