# Requirements Document

## Introduction

Spec 1 (`email-template`) membangun `EmailTemplate` sebagai entitas yang bisa dibuat/diedit (CRUD, editor TipTap, merge-tag, test send ke diri sendiri). Spec ini menambahkan cara **memakainya secara nyata**: tombol di FormPage dokumen submitable (SalesOrder, PurchaseOrder, Invoice, dll) yang membuka dialog kirim email ke pihak luar (customer/supplier), lengkap dengan penerima, salinan (Cc/Bcc), isi yang bisa diedit lebih lanjut, dan lampiran.

Berbeda dari Test Send (spec 1) yang mengirim hasil compile apa adanya ke diri sendiri untuk validasi template, trigger manual di spec ini mengirim ke pihak eksternal — sehingga user diberi kesempatan meninjau dan mengedit ulang subject, body, dan daftar penerima sebelum benar-benar terkirim.

### Infrastruktur PDF yang Sudah Tersedia

Proyek prasyarat (render PDF server-side dan auto-attach saat approval) sudah selesai sebelum spec ini dikerjakan. Kontraknya: dokumen yang sudah di-approve atau di-print secara manual memiliki relasi `Fileable` dengan `is_generated_pdf = true`. Spec ini memakai kontrak tersebut secara langsung, dan juga menyediakan cara men-generate PDF baru (fallback on-the-fly) untuk dokumen yang belum memilikinya, memakai layanan render server-side yang sama dengan yang dipakai proyek prasyarat.

## Glossary

- **Trigger manual**: aksi user menekan tombol "Kirim Email" pada FormPage dokumen submitable, membuka dialog pengiriman.
- **Dialog kirim email**: modal berisi field From Name, To, Cc, Bcc, Subject, Body, dan daftar lampiran, yang seluruhnya dapat diedit sebelum email benar-benar dikirim.
- **Nilai ter-resolve (resolved value)**: nilai aktual dari field dokumen yang sedang dikirim (mis. `"PO-00123"`), berbeda dari token merge-tag (`{{ $doc->number }}`) yang dipakai saat authoring template di spec 1.
- **Recipient path**: dot-path relasi pada `EmailTemplate` yang menunjuk ke alamat email penerima default (mis. `customer.email`).
- **EmailChipInput**: komponen input baru untuk field To/Cc/Bcc — teks bebas yang diubah menjadi chip alamat email saat Enter/koma/Tab ditekan.

## Requirements

### Requirement 1: Kolom Recipient Path pada EmailTemplate

**User Story:** As a user penyusun template, I want menentukan field/relasi mana pada Model target yang berisi alamat email penerima, so that saat template dipakai untuk trigger manual, field To sudah terisi otomatis tanpa harus dicari manual setiap kali.

#### Acceptance Criteria

1. THE system SHALL menambahkan kolom `recipient_path` (string, nullable) pada tabel `email_templates`.
2. THE system SHALL menyediakan cara memilih `recipient_path` dari daftar field yang tersedia pada Model target EmailTemplate (memakai sumber data yang sama dengan picker merge-tag di spec 1).
3. THE system SHALL memperlakukan `recipient_path` sebagai opsional — EmailTemplate tetap valid dan dapat disimpan tanpa `recipient_path` diisi.

### Requirement 2: Tombol Trigger Manual pada FormPage

**User Story:** As a user yang mengelola dokumen submitable, I want menekan tombol untuk mengirim email terkait dokumen yang sedang saya lihat, so that saya tidak perlu berpindah halaman atau menyalin data secara manual untuk mengirim email ke customer/supplier.

#### Acceptance Criteria

1. THE system SHALL menampilkan tombol "Kirim Email" pada FormPage untuk setiap dokumen submitable, mengikuti pola tombol Print yang sudah ada.
2. WHEN terdapat lebih dari satu EmailTemplate untuk Model dokumen tersebut, THE system SHALL menampilkan dropdown untuk memilih EmailTemplate mana yang dipakai.
3. WHEN hanya terdapat satu EmailTemplate untuk Model dokumen tersebut, THE system SHALL langsung membuka dialog kirim email dengan template itu tanpa langkah pemilihan tambahan.
4. IF Model dokumen belum memiliki EmailTemplate sama sekali, THEN THE system SHALL tetap menampilkan tombol dalam keadaan aktif (bukan disabled), dan mengklik tombol tersebut SHALL tetap membuka dialog kirim email dengan subject dan body kosong.
5. WHEN dialog kirim email dibuka, THE system SHALL mengambil data pratinjau (subject, body ter-compile, penerima default, daftar lampiran yang tersedia) dari server berdasarkan data dokumen yang sedang dilihat — bukan data contoh (example data).
6. IF user tidak memiliki permission yang relevan untuk mengirim email pada Model dokumen tersebut, THEN THE system SHALL menyembunyikan tombol "Kirim Email" sepenuhnya (bukan menampilkan dalam keadaan disabled atau membiarkan gagal setelah diklik).

### Requirement 3: Field yang Dapat Diedit pada Dialog Kirim Email

**User Story:** As a user yang mengirim email, I want meninjau dan mengubah semua bagian email (pengirim, penerima, subjek, isi) sebelum benar-benar terkirim, so that saya bisa menyesuaikan isi email untuk transaksi spesifik ini tanpa mengubah template aslinya.

#### Acceptance Criteria

1. THE system SHALL menampilkan alamat From sebagai informasi tidak dapat diedit (selalu berasal dari konfigurasi aplikasi), dan menyediakan field nama tampilan pengirim (From Name) yang dapat diedit secara bebas.
2. THE system SHALL menyediakan field To yang dapat diisi lebih dari satu alamat email, pre-filled dari alamat hasil resolusi `recipient_path` jika tersedia.
3. THE system SHALL menyediakan field Cc dan Bcc yang masing-masing dapat diisi lebih dari satu alamat email dan bersifat opsional (boleh dikosongkan).
4. THE system SHALL menerima field To, Cc, dan Bcc dalam bentuk kumpulan alamat (bukan satu string gabungan), dengan setiap alamat divalidasi format email-nya sebelum diterima sebagai entri yang sah.
5. THE system SHALL menyediakan field Subject yang dapat diedit, pre-filled dari hasil compile EmailTemplate (atau kosong jika tidak ada EmailTemplate).
6. THE system SHALL menyediakan editor rich-text untuk Body yang dapat diedit, pre-filled dari hasil compile EmailTemplate (atau kosong jika tidak ada EmailTemplate).
7. WHEN user mengetik dan memilih data tambahan dari dokumen (mekanisme mention) pada field Subject atau Body, THE system SHALL menyisipkan nilai aktual (nilai ter-resolve) dari field tersebut — bukan token placeholder yang memerlukan compile ulang.
8. THE system SHALL TIDAK PERNAH menyimpan perubahan yang dilakukan pada dialog kirim email kembali ke EmailTemplate sumber — setiap pengiriman bersifat satu kali (one-shot) terhadap salinan data, bukan mengubah template.
9. THE system SHALL menolak pengiriman WHEN field To kosong atau berisi alamat yang tidak valid.

### Requirement 4: Lampiran (Attachment)

**User Story:** As a user yang mengirim email dokumen, I want menyertakan file pendukung (dokumen yang sudah ter-attach, file baru, atau PDF hasil print) sebagai lampiran email, so that penerima mendapatkan semua informasi relevan dalam satu email tanpa saya harus men-generate PDF secara terpisah lebih dulu.

#### Acceptance Criteria

1. THE system SHALL menampilkan daftar file yang sudah ter-*attach* pada dokumen (relasi Fileable yang sudah ada) sebagai pilihan lampiran yang dapat dicentang.
2. THE system SHALL menyediakan cara mengunggah file baru langsung dari dialog kirim email, dan file yang berhasil diunggah SHALL otomatis tercentang sebagai lampiran untuk pengiriman ini.
3. IF dokumen yang sedang dilihat memiliki lampiran PDF hasil generate yang sudah tersimpan (ditandai `is_generated_pdf` pada relasi Fileable), THEN THE system SHALL menampilkan dan mencentang otomatis lampiran tersebut sebagai opsi (mengambil versi paling baru jika ada lebih dari satu).
4. IF dokumen yang sedang dilihat TIDAK memiliki lampiran PDF hasil generate yang tersimpan, DAN Model dokumen tersebut memiliki template cetak default yang dapat dipakai untuk merender, THEN THE system SHALL menyediakan opsi checkbox terpisah bagi user untuk menandai keinginan menyertakan PDF pada pengiriman ini.
5. THE system SHALL TIDAK memicu proses pembuatan PDF pada saat checkbox tersebut dicentang — pembuatan PDF (jika diperlukan) SHALL hanya terjadi sebagai bagian dari proses pengiriman email itu sendiri (lihat Requirement 5), bukan sebagai aksi terpisah yang dieksekusi segera di dalam dialog.
6. WHEN proses pengiriman (Requirement 5) benar-benar membuat PDF baru karena checkbox tersebut dicentang, THE system SHALL menyimpan PDF tersebut sebagai lampiran permanen pada dokumen (bukan sekadar lampiran sementara untuk pengiriman email ini saja), sehingga tersedia juga untuk kebutuhan lain di kemudian hari (unduhan manual, pengiriman email berikutnya).
7. IF dokumen yang sedang dilihat TIDAK memiliki lampiran PDF tersimpan DAN Model dokumen tersebut TIDAK memiliki template cetak default, THEN THE system SHALL TIDAK menampilkan opsi lampiran PDF sama sekali (tidak ada dasar untuk merender).
8. THE system SHALL menyertakan seluruh file yang dicentang sebagai lampiran email yang dikirim.

### Requirement 5: Pengiriman Email

**User Story:** As a user yang telah meninjau isi email, I want menekan tombol kirim dan email benar-benar terkirim ke penerima yang ditentukan, so that komunikasi dengan pihak eksternal dapat dilakukan langsung dari dalam aplikasi, tanpa harus menunggu proses pembuatan PDF selesai di layar.

#### Acceptance Criteria

1. WHEN user menekan tombol kirim pada dialog, THE system SHALL menjadwalkan seluruh proses pengiriman (termasuk pembuatan PDF jika ditandai) sebagai satu unit kerja pada mekanisme queue yang sudah ada — tombol kirim TIDAK menunggu proses tersebut selesai secara synchronous.
2. THE system SHALL mengirim email ke seluruh alamat pada field To, Cc, dan Bcc sesuai yang diisi user pada saat pengiriman.
3. THE system SHALL menggunakan alamat From dari konfigurasi aplikasi dan nama tampilan dari field From Name yang diisi user (jika diisi).
4. THE system SHALL menyertakan subject dan body persis seperti yang terlihat oleh user di dialog pada saat tombol kirim ditekan (bukan hasil compile ulang dari template).
5. IF user menandai keinginan menyertakan PDF (Requirement 4.4) DAN dokumen belum memiliki PDF tersimpan, THEN proses pengiriman SHALL membuat PDF tersebut terlebih dahulu sebelum mengirim email, sebagai bagian dari unit kerja queue yang sama.
6. IF pembuatan PDF yang diminta pada langkah di atas gagal (template hilang, kegagalan render atau mesin PDF), THEN THE system SHALL membatalkan seluruh pengiriman email tersebut — email SHALL TIDAK terkirim, baik dengan maupun tanpa lampiran PDF.
7. WHEN sebuah unit kerja pengiriman gagal (baik karena kegagalan pembuatan PDF maupun sebab lain), THE system SHALL mencatat kegagalan tersebut agar dapat ditelusuri kemudian (minimal melalui log aplikasi).
8. IF permintaan pengiriman gagal divalidasi (field wajib kosong atau tidak valid) sebelum dijadwalkan ke queue, THEN THE system SHALL menampilkan pesan kesalahan kepada user dan dialog SHALL tetap terbuka agar user dapat memperbaiki input.
9. THE system SHALL menerapkan permission yang konsisten dengan aksi Print/Print PDF yang sudah ada — user tanpa izin yang sesuai SHALL ditolak dengan status 403.

## Out of Scope

- Pembuatan PDF otomatis saat dokumen di-approve — sudah diselesaikan di proyek prasyarat terpisah (`print-pdf-server-render-autoattach`), tidak dikerjakan ulang di sini. Spec ini hanya memakai hasilnya (Requirement 4) dan menyediakan jalur pembuatan PDF tambahan yang terjadi sebagai bagian dari proses pengiriman email.
- Notifikasi in-app kepada user ketika pengiriman email gagal — belum ada infrastruktur notifikasi in-app di aplikasi ini. Kegagalan hanya dicatat ke log aplikasi (Requirement 5.7); user perlu memeriksa secara manual.
- Trigger otomatis berbasis event dokumen (approve/reject, notifikasi role tertentu) — menyusul di spec berikutnya.
- Template untuk email sistem (reset password, invite user, verifikasi email) — menyusul di spec berikutnya.
- Riwayat/log email yang pernah dikirim per dokumen (siapa mengirim, kapan, ke mana) — tidak diminta pada iterasi ini.
