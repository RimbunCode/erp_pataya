# Requirements Document

## Introduction

Saat ini halaman print dokumen (`Core/Print.jsx`) hanya mendukung cetak lewat
dialog print browser (`window.print()`) di dalam iframe. Tidak ada cara untuk
menghasilkan file PDF yang bisa disimpan/diunduh/dilampirkan (mis. dikirim
lewat email, diarsipkan). Aplikasi akan di-deploy di shared hosting yang tidak
punya akses root, tidak punya Node.js/Chromium, tapi mengizinkan `exec()` —
sehingga solusi harus bisa jalan dalam batasan tersebut.

Fitur ini menambahkan endpoint server untuk mengonversi HTML hasil render
print preview menjadi file PDF, menggunakan wkhtmltopdf (binary eksternal
via `exec`) sebagai engine utama, dengan dompdf (pure-PHP) sebagai fallback
otomatis bila wkhtmltopdf tidak tersedia/gagal di server.

## Glossary

- **PrintTemplate**: model konfigurasi tata letak dokumen (kertas, margin,
  HTML/CSS custom) yang dipakai untuk mencetak dokumen model lain (Sales
  Order, dsb). Lihat `app/Models/Core/PrintTemplate.php`.
- **Print preview**: halaman `resources/js/Pages/Core/Print.jsx`, merender
  `PrintTemplate` + data dokumen jadi HTML di dalam `<iframe>` (komponen
  `PrintPreview.jsx`).
- **wkhtmltopdf**: binary command-line yang mengonversi HTML menjadi PDF
  memakai rendering engine QtWebKit.
- **dompdf**: library PHP murni untuk mengonversi HTML/CSS menjadi PDF,
  tanpa dependency proses eksternal.
- **Letter head**: `PrintTemplate` lain yang ditandai `is_letter_head`,
  dipakai sebagai kop surat yang digabung ke HTML dokumen utama.

## Requirements

### Requirement 1: Unduh dokumen print sebagai PDF

**User Story:** As a pengguna yang sedang melihat print preview suatu
dokumen, I want mengunduh dokumen tersebut sebagai file PDF, so that saya
bisa menyimpan, mengarsipkan, atau mengirim dokumen tanpa harus mencetak
fisik atau save-as-PDF manual lewat dialog print browser.

#### Acceptance Criteria

1. THE halaman print preview (`Core/Print.jsx`) SHALL menampilkan tombol
   "Download PDF" di samping tombol "Print" yang sudah ada.
2. WHEN pengguna mengklik tombol "Download PDF", THE sistem SHALL mengambil
   HTML lengkap yang sedang ditampilkan di iframe preview (termasuk letter
   head dan styling yang sudah di-resolve) dan mengirimkannya ke server.
3. WHEN server menerima permintaan, THE sistem SHALL menghasilkan file PDF
   yang ukuran kertas, orientasi, dan margin-nya sesuai konfigurasi
   `PrintTemplate` (paper, orientation, width/height, margin_top/bottom/
   left/right).
4. WHEN proses konversi selesai, THE sistem SHALL mengirim file PDF tersebut
   ke browser pengguna sebagai unduhan langsung (bukan navigasi halaman).
5. IF `PrintTemplate` memiliki `page_number` aktif, THEN THE PDF yang
   dihasilkan SHALL menampilkan nomor halaman sesuai posisi dan format
   (`page_number_format`) yang dikonfigurasi, selama didukung oleh engine
   konversi yang dipakai.

### Requirement 2: Engine konversi PDF dengan fallback otomatis

**User Story:** As pemilik sistem yang mendeploy aplikasi ini di shared
hosting, I want proses konversi PDF tetap berjalan meskipun binary
wkhtmltopdf tidak tersedia atau gagal dieksekusi, so that fitur ini tidak
menyebabkan error fatal atau downtime hanya karena keterbatasan environment
hosting.

#### Acceptance Criteria

1. THE sistem SHALL mencoba mengonversi HTML ke PDF menggunakan wkhtmltopdf
   (binary eksternal) sebagai metode utama.
2. IF binary wkhtmltopdf tidak ditemukan pada path yang dikonfigurasi, OR IF
   proses wkhtmltopdf mengembalikan exit code kegagalan, OR IF proses
   melebihi batas waktu (timeout) yang ditentukan, THEN THE sistem SHALL
   secara otomatis menggunakan dompdf untuk menghasilkan PDF dari HTML yang
   sama, tanpa mengembalikan error ke pengguna.
3. WHEN sistem menggunakan jalur fallback (dompdf), THE sistem SHALL mencatat
   kejadian tersebut ke log aplikasi (level warning) untuk keperluan
   monitoring operasional.
4. IF kedua metode (wkhtmltopdf dan dompdf) gagal menghasilkan PDF, THEN THE
   sistem SHALL mengembalikan response error yang jelas ke pengguna tanpa
   membocorkan detail internal (path server, pesan error mentah proses).

### Requirement 3: Otorisasi dan keamanan endpoint export PDF

**User Story:** As pemilik sistem, I want endpoint export PDF hanya bisa
diakses oleh pengguna yang memang berhak melihat dokumen tersebut, dan tidak
menjadi celah keamanan baru, so that data dokumen tidak bocor dan server
tidak bisa dieksploitasi lewat konten HTML yang dikirim client.

#### Acceptance Criteria

1. THE endpoint export PDF SHALL menerapkan pengecekan permission yang sama
   dengan endpoint print yang sudah ada (permission key `'print'` per model).
2. IF pengguna tidak memiliki permission `'print'` untuk model dokumen
   terkait, THEN THE sistem SHALL menolak permintaan (403) tanpa memproses
   konversi PDF.
3. THE sistem SHALL membatasi ukuran payload HTML yang diterima dari client
   pada suatu batas wajar, dan menolak permintaan yang melebihi batas
   tersebut.
4. THE sistem SHALL menonaktifkan akses file lokal server dan resource
   remote yang tidak terkontrol pada kedua engine konversi (wkhtmltopdf:
   `--disable-local-file-access`; dompdf: `isRemoteEnabled = false`), untuk
   mencegah HTML yang dikirim client membaca file di luar cakupan yang
   dimaksudkan.
5. THE sistem SHALL tetap mengambil ulang data dokumen dan `PrintTemplate`
   dari database berdasarkan ID (bukan mempercayai data selain markup HTML
   dari client) untuk keperluan otorisasi dan penamaan file unduhan.

### Requirement 4: Kompatibilitas dengan environment shared hosting

**User Story:** As pemilik sistem, I want fitur ini berjalan pada shared
hosting cPanel tanpa akses root, tanpa Node.js/Chromium, so that fitur PDF
tidak memaksa migrasi infrastruktur atau upgrade paket hosting.

#### Acceptance Criteria

1. THE sistem SHALL tidak bergantung pada Node.js, npm/npx, atau browser
   headless (Chromium/Puppeteer) untuk menghasilkan PDF.
2. THE binary wkhtmltopdf yang dipakai SHALL berupa static build yang tidak
   memerlukan instalasi sistem tambahan (package manager OS) di luar upload
   file binary itu sendiri.
3. THE lokasi binary wkhtmltopdf SHALL dapat dikonfigurasi melalui env var
   (`WKHTMLTOPDF_BINARY_PATH`), bukan hardcode path absolut.
4. THE dependency dompdf (fallback) SHALL diinstal melalui composer sebagai
   package PHP standar, tanpa dependency proses eksternal.

## Out of Scope

- Generate PDF dari konteks selain halaman print preview (mis. tombol PDF di
  halaman `Show.jsx` per dokumen, generate PDF terjadwal/batch, lampiran PDF
  otomatis di email) — dipertimbangkan untuk iterasi berikutnya.
- Render ulang HTML sepenuhnya di server (port logic Handlebars/formatData
  dari JS ke PHP) — versi ini memakai HTML hasil render client yang dikirim
  ke server.
- Upgrade atau penggantian binary wkhtmltopdf secara otomatis/terjadwal.
