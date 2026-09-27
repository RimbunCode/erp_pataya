# Requirements: Approval Signature

## 1. Ringkasan

Fitur menambah **tanda tangan digital approver** ke dokumen yang melewati approval workflow.

Tiga bagian:

1. **Penyimpanan TTD per user** — tiap user menyimpan satu TTD di halaman profilnya, lewat *upload gambar* (format apa pun) atau *menggambar di canvas*.
2. **Normalisasi gambar** — TTD hasil upload diproses server menjadi **PNG dengan background transparan**, apa pun format dan kualitas aslinya.
3. **Render ke dokumen** — saat dokumen selesai di-approve, TTD tiap approver muncul di PDF pada posisi yang ditentukan print template.

**Yang DIPERTAHANKAN (tidak diubah):**

- Alur approval (`ApprovalInstanceController::approve()`/`reject()`, advancement `current_sequence`, hook `onApproved()`/`onRejected()`).
- Event `ApprovalDecided` dan listener `AttachApprovalPdf` beserta `AttachGeneratedPdfJob`.
- Mekanisme `File`/`Fileable` untuk penyimpanan berkas.
- Enum `FormStatus` (tidak bertambah).

**Yang BARU:** kolom TTD pada `users`, service pemrosesan gambar, endpoint upload/hapus TTD, komponen profil, helper Handlebars `approvalSignature`, dan blok GrapesJS.

## 2. Glosarium

| Istilah | Arti |
| --- | --- |
| **TTD** | Berkas gambar tanda tangan milik satu user, tersimpan sebagai PNG transparan |
| **Approver efektif** | User yang tercatat menyelesaikan sebuah step, yaitu `ApprovalInstanceStep.acted_by_id` — bukan `approverable_id` yang bisa berupa role |
| **Penandatangan final** | Approver efektif pada **step approved dengan `sequence` terbesar**. Hanya TTD orang ini yang tercetak (FR8a) |
| **Slot TTD** | Area pada print template yang diisi TTD penandatangan final |
| **Adaptive threshold** | Ambang pemisah tinta/kertas yang dihitung per blok lokal, bukan satu nilai untuk seluruh gambar |

## 3. Functional Requirements

### FR1: Penyimpanan TTD di Profil User

User membuka halaman profilnya (`Users/ManageUsers/Show`) dan menemukan bagian **Tanda Tangan** berisi pratinjau TTD saat ini (jika ada) beserta tombol aksi.

**Acceptance:**

- Tiap user memiliki **paling banyak satu** TTD aktif. Menyimpan TTD baru menggantikan yang lama.
- TTD hanya dapat diubah oleh **pemilik akun itu sendiri**. User lain, termasuk yang memiliki permission `write` pada model `User`, **tidak** dapat mengunggah atau mengubah TTD milik orang lain.
- Menghapus TTD tidak mengubah PDF yang terlanjur dibuat, karena PDF disimpan sebagai berkas statis.
- Pratinjau TTD ditampilkan di atas latar kotak-kotak (checkerboard) agar transparansi terlihat jelas oleh user.

### FR2: Jalur Input — Upload Gambar

User memilih berkas gambar dari perangkatnya.

**Acceptance:**

- Format yang diterima: **JPEG, PNG, WebP, GIF, BMP**. Format lain ditolak dengan pesan kesalahan yang menyebut daftar format yang didukung.
- Ukuran berkas maksimum **5 MB**. Melebihi itu ditolak sebelum diproses.
- Dimensi masukan maksimum **4000 × 4000 piksel**. Melebihi itu gambar diperkecil proporsional lebih dulu, bukan ditolak, karena foto ponsel modern rutin melampaui batas ini.
- Validasi tipe berkas dilakukan berdasarkan **isi berkas** (`finfo`/`getimagesize`), bukan ekstensi nama berkas maupun header `Content-Type` dari klien.
- Apa pun format masukannya, keluaran yang tersimpan **selalu PNG**.

### FR3: Jalur Input — Gambar di Canvas

User menggambar TTD langsung dengan mouse, stylus, atau jari pada area canvas.

**Acceptance:**

- Canvas mendukung pointer mouse maupun sentuh.
- Tersedia tombol **Bersihkan** untuk mengulang dari awal.
- Hasil canvas sudah transparan sejak dibuat, sehingga **tidak** melewati pipeline threshold pada FR4. Hanya di-trim dan di-normalisasi ukurannya (FR5).
- Canvas yang masih kosong tidak dapat disimpan; tombol simpan nonaktif sampai ada goresan.

### FR4: Normalisasi Gambar — Penghapusan Background

Gambar hasil upload diproses server menjadi PNG transparan.

**Algoritma:** *adaptive luminance threshold*.

1. Gambar dibaca ke sumber daya GD (`imagecreatefromstring`), apa pun formatnya.
2. Kecerahan tiap piksel dihitung untuk keperluan analisis.
3. Gambar dibagi menjadi grid blok (ukuran blok **32 × 32 piksel**). Tiap blok dihitung ambangnya sendiri dari statistik kecerahan piksel di dalamnya.
4. Ambang per-piksel diperoleh dengan interpolasi bilinear antar ambang blok tetangga, supaya tidak muncul batas kotak yang terlihat pada hasil.
5. Piksel dengan kecerahan **di bawah** ambang lokalnya dianggap tinta dan dipertahankan; yang **di atas** ambang dijadikan transparan penuh.
6. Piksel tinta diberi alpha bergradasi sebanding jaraknya dari ambang, sehingga tepi goresan halus dan tidak bergerigi.

**Acceptance:**

- Scan TTD hitam di atas kertas putih menghasilkan PNG dengan background sepenuhnya transparan.
- Foto TTD memakai kamera ponsel dengan pencahayaan tidak rata (satu sisi lebih gelap) **tidak** menghasilkan sisi gelap yang ikut terbaca sebagai tinta. Inilah alasan ambang dibuat adaptif, bukan global.
- TTD bertinta biru atau warna gelap lain tetap terdeteksi sebagai tinta, tidak ikut terhapus.
- Gambar yang **sudah** memiliki alpha channel (PNG transparan hasil aplikasi lain) dilewatkan tanpa threshold; alpha aslinya dipertahankan. Menerapkan threshold pada gambar semacam ini justru merusaknya.
- Warna tinta asli dipertahankan, tidak dipaksa menjadi hitam.

### FR5: Normalisasi Gambar — Trim dan Ukuran

**Acceptance:**

- Setelah background transparan, gambar di-**trim**: baris dan kolom terluar yang sepenuhnya transparan dibuang, menyisakan bounding box goresan. Tanpa ini, TTD yang difoto dari jauh akan tampil sangat kecil di dalam slot yang lapang.
- Setelah trim, gambar diperkecil proporsional hingga tinggi maksimum **200 piksel**, tanpa pernah memperbesar gambar yang sudah lebih kecil dari itu.
- Gambar yang setelah threshold ternyata **kosong** (tidak ada piksel tinta sama sekali, misalnya foto kertas polos) ditolak dengan pesan bahwa tidak ada tanda tangan terdeteksi.
- Gambar yang setelah threshold **hampir seluruhnya tinta** (di atas 90% piksel opak, misalnya foto gelap atau gambar terbalik) ditolak dengan pesan bahwa gambar terlalu gelap.

### FR6: Penyimpanan Berkas TTD

**Acceptance:**

- TTD disimpan lewat mekanisme `File` yang sudah ada, dengan `is_public = false` **dipaksa di sisi server**. Nilai `isPublic` dari request **diabaikan** untuk jalur ini.
- Berkas asli hasil upload **tidak** disimpan. Hanya PNG hasil proses yang dipertahankan, sehingga foto mentah TTD tidak tertinggal di storage.
- Relasi TTD ke user disimpan pada kolom baru di tabel `users`, mengikuti pola kolom `image` yang sudah ada.
- Mengganti TTD menghapus record `File` TTD lama beserta berkas fisiknya.

### FR7: Akses Berkas TTD

**Acceptance:**

- Berkas TTD hanya dapat diakses lewat route terautentikasi. URL tebakan tanpa sesi login harus ditolak.
- Seorang user dapat mengambil berkas TTD milik user lain **hanya** ketika ia berhak melihat dokumen tempat TTD itu muncul. Di luar itu, permintaan ditolak.
- Saat me-render PDF di sisi server, berkas TTD dibaca langsung dari storage dan disisipkan sebagai **data URI base64**, bukan sebagai URL. Renderer PDF tidak membawa sesi login sehingga URL terproteksi akan gagal dimuat.

### FR8a: Penandatangan Final — Satu TTD per Dokumen

Dokumen dapat melewati beberapa step approval, dan satu step dapat punya beberapa kandidat approver. Yang tercetak **hanya satu tanda tangan**: milik penandatangan final.

**Aturan penentuan:**

Penandatangan final adalah `acted_by_id` pada **step berstatus `APPROVED` dengan `sequence` terbesar**.

**Acceptance:**

- Dokumen melewati tiga step (Officer → Manager → Finance Manager), ketiganya approved: yang tercetak hanya TTD Finance Manager. TTD Officer dan Manager **tidak** muncul di dokumen.
- Dasar "tertinggi" adalah **urutan step**, bukan atribut jabatan pada Role. Tabel `roles` tidak memiliki kolom hierarki, dan spec ini **tidak** menambahkannya. Asumsi yang dipakai: scheme approval disusun dari jabatan rendah ke tinggi, yang merupakan cara scheme dipakai selama ini.
- Penentuan memakai **step yang approved**, bukan `sequence` terbesar dari seluruh step. Keduanya berbeda ketika ada step berstatus `SKIPPED` atau `WAITING`, dan hanya step yang benar-benar diselesaikan yang layak menjadi penandatangan.
- Pada step advanced (banyak kandidat, mode race), `acted_by_id` sudah berisi satu orang yang menang race; kandidat lain berstatus `SKIPPED`. Tidak diperlukan aturan tambahan untuk memilih di antara mereka.
- Bila step terakhir menjadi approved lewat **auto-approve** (requester adalah approver-nya sendiri, lihat `ApprovalInstance::applyAutoApprove()`), `acted_by_id` berisi requester dan TTD **requester** yang tercetak. Ini perilaku yang diinginkan: dialah otoritas tertinggi yang terlibat, meskipun tidak menekan tombol approve secara terpisah.
- Dokumen tanpa `ApprovalInstance` sama sekali (tidak ada scheme aktif) menghasilkan slot kosong.

**Yang sengaja tidak dilakukan:** menampilkan jejak seluruh penandatangan bertingkat. Bila kebutuhan itu muncul, penambahannya berupa helper terpisah, bukan pengubahan perilaku helper ini.

### FR8: Helper Handlebars `approvalSignature`

Template memanggil helper untuk menempatkan slot TTD penandatangan final.

```handlebars
{{approvalSignature}}
{{approvalSignature showName=true showDate=true}}
```

**Acceptance:**

- Helper **tidak menerima argumen posisional**. Step tidak dapat dipilih, karena yang tercetak selalu penandatangan final (FR8a).
- Helper menghasilkan potongan HTML berisi gambar TTD sebagai data URI, opsional diikuti nama penandatangan dan tanggal approve.
- Helper tersedia **di dua tempat** dengan perilaku identik: `initHandlebar.js` untuk pratinjau sisi klien, dan `PrintTemplateRenderService::helpers()` untuk render PDF sisi server. Perbedaan perilaku antar keduanya dianggap cacat.
- Pada pratinjau editor yang memakai data contoh, helper menampilkan TTD placeholder, bukan gagal atau kosong, sehingga perancang template dapat melihat tata letaknya.
- Dokumen tanpa step approved menghasilkan keluaran kosong, bukan kesalahan yang menggagalkan seluruh render.
- Memanggil helper dengan argumen posisional (sisa template lama atau salah tulis) mengabaikan argumen itu, bukan gagal render.

### FR9: Fallback Saat Penandatangan Final Belum Punya TTD

**Acceptance:**

- Bila penandatangan final belum menyimpan TTD, slot diisi **nama penandatangan dan tanggal approve** dalam bentuk teks, bukan dibiarkan kosong.
- Bila dokumen belum punya step approved sama sekali, slot menghasilkan keluaran kosong.
- Approve **tidak** diblokir karena user belum punya TTD. Tidak ada validasi yang mencegah approval berjalan.

### FR10: Blok GrapesJS

**Acceptance:**

- Tersedia blok baru bernama **Tanda Tangan** di panel blok editor print template, dapat di-drag ke canvas.
- Blok yang dijatuhkan menghasilkan markup berisi pemanggilan `{{approvalSignature}}`.
- Opsi tampil nama dan tampil tanggal dapat diubah lewat panel properti komponen setelah blok dipilih. **Tidak ada** pengaturan nomor step, sesuai FR8a.
- Template yang memuat blok ini tetap dapat diedit di mode kode; markup-nya tidak dirusak oleh serialisasi editor.

### FR11: Titik Render pada Alur Approval

**Acceptance:**

- PDF yang memuat TTD dihasilkan pada alur yang sudah ada, yaitu `AttachApprovalPdf` yang berjalan setelah instance mencapai status `APPROVED`. Pada titik itu penandatangan final sudah pasti tercatat.
- Unduh PDF manual pada dokumen yang sudah approved juga memuat TTD.
- Unduh PDF manual pada dokumen yang **belum** selesai approval memuat TTD approver dari step approved terakhir **sejauh ini**. Slot akan berubah isinya seiring approval berlanjut, dan itu konsekuensi wajar dari mencetak dokumen yang belum final.

### FR12: Perilaku Renderer PDF

`PdfExportService` memiliki dua jalur: wkhtmltopdf dan fallback dompdf.

**Acceptance:**

- PNG transparan ter-render benar pada **kedua** jalur. Latar yang menjadi kotak hitam atau putih solid pada salah satu jalur dianggap cacat.
- Data URI base64 tidak tersaring oleh `sanitizeRemoteUrls()`, yang saat ini menyaring URL sumber daya eksternal.

## 4. Non-Functional Requirements

### NFR1: Tanpa Dependency Baru

Pemrosesan gambar memakai ekstensi **GD** yang sudah tersedia. Tidak ada paket Composer baru dan tidak ada layanan luar.

**Alasan penolakan alternatif:** layanan penghapus background berbasis AI (rembg, U2-Net, API pihak ketiga) akan mengirim tanda tangan user keluar dari server. Untuk data setingkat tanda tangan, itu tidak sepadan dengan peningkatan kualitas yang tidak dibutuhkan pada kasus tinta-di-atas-kertas.

### NFR2: Waktu Proses

Pemrosesan satu gambar 4000 × 4000 piksel selesai di bawah **3 detik**. Bila melewati itu, pemrosesan dipindahkan ke queue job dan user diberi indikator proses.

### NFR3: Privasi

- Berkas TTD tidak pernah berstatus publik.
- Berkas asli hasil upload tidak disimpan (FR6).
- TTD tidak muncul di response API umum seperti daftar user.

### NFR4: Testability

Pipeline pemrosesan gambar diimplementasikan sebagai service murni yang menerima dan mengembalikan byte string, sehingga dapat diuji tanpa HTTP request, tanpa storage, dan tanpa database.

## 5. Di Luar Lingkup

Hal berikut **tidak** termasuk fitur ini:

- Tanda tangan kriptografis (PKI, sertifikat digital, PAdES). Fitur ini murni **gambar** tanda tangan, bukan jaminan keaslian kriptografis.
- **Hierarki jabatan pada Role.** Tabel `roles` tidak diberi kolom `level` atau sejenisnya. Urutan `sequence` pada step sudah cukup menentukan penandatangan final (FR8a), dan menambah hierarki role berarti mengisi ulang data seluruh role yang sudah ada demi kebutuhan yang belum terbukti.
- **Mencetak lebih dari satu tanda tangan** pada satu dokumen, misalnya jejak approval bertingkat atau kolom tanda tangan berdampingan.
- Beberapa TTD per user (misalnya TTD formal dan paraf).
- Stempel perusahaan.
- Verifikasi bahwa gambar yang diunggah benar-benar tanda tangan milik user tersebut.
- Audit trail khusus TTD di luar audit yang sudah dicatat `owen-it/laravel-auditing` pada perubahan model.
