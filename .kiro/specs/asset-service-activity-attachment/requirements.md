# Requirements Document

## Introduction

`AssetServiceActivity` (Log Aktivitas di dalam fitur AssetService / "Work Orders") saat ini tidak punya dukungan file sama sekali — tidak ada relasi `files()`, tidak ada input upload di `ActivityFormDialog`. Teknisi yang mencatat aktivitas servis (mis. hasil pengecekan, foto kerusakan, nota part) tidak punya cara melampirkan bukti ke catatan aktivitas tersebut.

Perubahan ini menambah kemampuan attach/hapus file per-activity, mereplikasi pola widget "Lampiran" generic (`Attachments.jsx`) yang sudah dipakai di seluruh Show/Form page lain — bukan mekanisme baru. Detail teknis lengkap ada di `design.md`.

## Glossary

- **Activity**: satu baris di Log Aktivitas AssetService (`AssetServiceActivity`) — catatan tindakan servis dengan tanggal, PIC, deskripsi, status selesai.
- **Fileable**: pivot polymorphic (`app/Models/Core/Fileable.php`) yang menghubungkan sebuah `File` ke model manapun (`fileable_type`/`fileable_id`).
- **File draft**: `File` yang sudah ter-upload tapi belum di-attach ke record manapun (`is_draft = true`) — dipakai saat mode create (activity belum punya id).
- **Mode create**: `ActivityFormDialog` dibuka untuk menambah activity baru (belum ada `activity.id`).
- **Mode edit**: `ActivityFormDialog` dibuka untuk mengubah activity yang sudah tersimpan (`activity.id` ada).

## Requirements

### Requirement 1: Lampirkan file saat membuat Activity baru

**User Story:** As a teknisi yang mencatat activity baru di Log Aktivitas, I want melampirkan file (foto/dokumen) langsung saat membuat activity, so that bukti pekerjaan tercatat bersamaan dengan activity-nya tanpa langkah terpisah.

#### Acceptance Criteria

1. WHEN user membuka dialog Tambah Aktivitas (mode create) DAN memilih satu atau lebih file lewat tombol Lampiran, THE sistem SHALL meng-upload file tersebut sebagai draft dan menampilkannya di daftar lampiran dialog TANPA langsung meng-attach ke activity manapun.
2. WHEN user menekan Simpan pada mode create DENGAN satu atau lebih file di daftar lampiran, THE sistem SHALL mengirim id file-file tersebut (`filesId`) bersama payload activity, DAN membuat baris `Fileable` yang menghubungkan tiap file ke activity yang baru dibuat.
3. THE baris `Fileable` yang dibuat SHALL memiliki `fileable_type = AssetServiceActivity::class` dan `fileable_id` sama dengan id activity yang baru dibuat — BUKAN id AssetService induknya.
4. WHEN user menekan Simpan pada mode create TANPA memilih file apapun, THE sistem SHALL membuat activity seperti biasa TANPA membuat baris `Fileable` apapun DAN tanpa error.
5. WHEN user menghapus file dari daftar lampiran SEBELUM menekan Simpan (mode create), THE sistem SHALL menghapus file tersebut dari daftar lokal saja — TIDAK ada panggilan ke server, karena file belum pernah ter-attach.
6. WHEN user menutup dialog Tambah Aktivitas tanpa menekan Simpan, THE sistem SHALL TIDAK membuat activity maupun baris `Fileable` apapun (file draft yang sempat ter-upload dibiarkan sebagai draft, konsisten dengan perilaku `UploadDialog` di form lain).

### Requirement 2: Lampirkan file ke Activity yang sudah ada

**User Story:** As a teknisi, I want menambahkan lampiran ke activity yang sudah tersimpan sebelumnya, so that saya bisa melengkapi bukti pekerjaan meski activity-nya sudah lama dicatat.

#### Acceptance Criteria

1. WHEN user membuka dialog Edit Aktivitas (mode edit, activity sudah punya id) DAN memilih file lewat tombol Lampiran, THE sistem SHALL langsung meng-upload DAN meng-attach file tersebut ke activity yang sedang dibuka — TANPA menunggu tombol Simpan ditekan.
2. THE endpoint attach file pada mode edit SHALL menolak (melempar error) permintaan JIKA AssetService induk dari activity tersebut belum berstatus approved — konsisten dengan gating yang sudah berlaku untuk membuat/mengubah activity.
3. WHEN attach file pada mode edit berhasil, THE daftar lampiran pada dialog SHALL menampilkan file yang baru ditambahkan tanpa perlu membuka ulang dialog.
4. THE baris `Fileable` yang dibuat lewat mode edit SHALL memiliki `fileable_type = AssetServiceActivity::class` dan `fileable_id` sama dengan id activity yang sedang dibuka.

### Requirement 3: Hapus lampiran dari Activity

**User Story:** As a teknisi, I want menghapus lampiran yang salah atau sudah tidak relevan dari sebuah activity, so that daftar lampiran tetap akurat dan tidak menyesatkan.

#### Acceptance Criteria

1. WHEN user menekan tombol hapus pada salah satu file di daftar lampiran activity yang SUDAH tersimpan (mode edit), THE sistem SHALL langsung menghapus (soft-delete) baris `Fileable` yang menghubungkan file tersebut ke activity — efek terjadi seketika, TIDAK menunggu tombol Simpan pada dialog.
2. WHEN sebuah file dihapus dari satu activity, THE sistem SHALL TIDAK menghapus file ATAU lampiran milik activity lain, meski file yang sama kebetulan juga terlampir di tempat lain.
3. WHEN user menghapus file dari daftar lampiran SEBELUM activity baru disimpan (mode create), THE penghapusan SHALL cukup terjadi di daftar lokal (lihat Requirement 1.5) — TIDAK ada baris `Fileable` yang perlu dihapus karena belum pernah dibuat.
4. THE aksi hapus lampiran pada mode edit SHALL ditolak (melempar error) JIKA AssetService induk dari activity tersebut belum berstatus approved, konsisten dengan Requirement 2.2.

### Requirement 4: Lihat lampiran pada daftar Activity

**User Story:** As a pengguna yang melihat Log Aktivitas sebuah AssetService, I want tahu activity mana saja yang punya lampiran, so that saya bisa langsung membuka activity yang relevan tanpa mengecek satu-satu.

#### Acceptance Criteria

1. WHEN halaman AssetService dibuka, THE sistem SHALL menyertakan daftar file tiap activity (relasi `activities.files`) sebagai bagian dari data activity yang dimuat.
2. WHEN sebuah activity di daftar Log Aktivitas memiliki satu atau lebih lampiran, THE tampilan baris activity tersebut SHALL menunjukkan indikator (ikon dan/atau jumlah) bahwa activity itu punya lampiran.
3. WHEN sebuah activity TIDAK memiliki lampiran, THE tampilan baris activity tersebut SHALL TIDAK menampilkan indikator lampiran apapun.

## Out of Scope

- Batas ukuran/jumlah file khusus untuk lampiran Activity — memakai default validasi `File::uploadFile()` apa adanya (keputusan user, lihat `design.md`).
- Preview inline gambar/PDF di dalam daftar lampiran — cukup link ke halaman preview file yang sudah ada secara generic.
- Cascade hapus `Fileable` otomatis saat activity dihapus (soft-delete) — konsisten dengan model lain yang belum punya perilaku ini, di luar scope iterasi ini.
- Cleanup otomatis file draft yang tidak jadi dipakai (dialog ditutup tanpa Simpan pada mode create) — perilaku umum lintas fitur, bukan spesifik Activity.
