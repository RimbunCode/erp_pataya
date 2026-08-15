# Requirements Document

## Introduction

Model-model di aplikasi ini (73 model) menggunakan `SoftDeletes`. Ketika sebuah record yang direferensikan lewat relasi (`belongsTo`, `morphTo`, `belongsToMany`) di-soft-delete, Eloquent secara default mengecualikannya dari query — sehingga:

1. Di halaman **List/DataTable**, kolom yang menampilkan nama relasi (mis. nama akun, nama item, nama customer) tiba-tiba tampil kosong/null, padahal baris transaksinya sendiri valid dan historis.
2. Di halaman **Show/Edit**, field relasi yang sudah di-soft-delete juga tampil null **tanpa pemberitahuan** ke user bahwa data aslinya sudah terhapus — user berpotensi submit ulang form dengan data yang sudah cacat tanpa sadar.
3. Validasi submit (`exists:table,column` di FormRequest) **tidak** mengecualikan record yang soft-deleted — record yang sudah dihapus tetap dianggap valid oleh validasi `exists`, sehingga user bisa lolos menyimpan referensi ke data yang sudah tidak aktif.

Spec ini mendefinisikan strategi `withTrashed()` yang **context-aware** — berbeda perilaku tergantung tempat relasi itu dipakai (List vs Show vs validasi submit) — dan mekanisme penerapannya yang tidak mengharuskan mengubah definisi relasi satu per satu di setiap model.

**Referensi riset/diskusi terkait** (lihat histori project, bukan bagian dari dokumen ini):
- Audit awal menemukan pola sudah benar di `PurchaseRequestItem.php:70-77` — `->withTrashed($this->status != 'draft')` — tapi tidak direplikasi ke model lain.
- Serialisasi ke frontend tidak memakai API Resources; controller mengembalikan model Eloquent langsung setelah `loadRelations()` (`app/Traits/DataTable.php`, `app/Traits/LinkModel.php`).
- Frontend (`LinkModel.jsx` dan turunannya seperti `CategoryLinkModel`, `CountryLinkModel`) sama sekali tidak sadar konsep `deleted_at` — 0 referensi di `resources/js`.
- Validasi `exists:table,column` di FormRequest (`AccountRequest.php`, `ItemRequest.php`, dll) tidak memakai `whereNull('deleted_at')` — beda dengan `Rule::unique()` yang sudah menerapkannya di beberapa Request.

## Glossary

- **Relasi ber-SoftDeletes**: relasi (`belongsTo`/`morphTo`/`belongsToMany`) yang model target-nya memakai trait `SoftDeletes`.
- **Konteks List**: tampilan tabular (DataTable/Index) yang menampilkan banyak baris data historis sekaligus.
- **Konteks Show**: tampilan detail satu record, termasuk form Edit dalam status draft yang bisa disubmit ulang.
- **Data historis**: nilai relasi pada record yang statusnya sudah final/non-draft (mis. dokumen yang sudah diposting), di mana relasi terhapus tetap harus ditampilkan sebagai catatan masa lalu.
- **Data aktif/assignable**: nilai relasi pada record berstatus draft yang masih bisa diubah — di sini relasi yang sudah terhapus TIDAK boleh dianggap valid untuk dipilih ulang.

## Requirements

### Requirement 1: List/DataTable selalu menampilkan nama relasi meski sudah soft-deleted

**User Story:** As a pengguna yang melihat daftar transaksi (mis. daftar Sales Order, General Ledger, Todo), I want nama/label relasi (item, akun, customer, user) tetap tampil walau data master-nya sudah dihapus, so that saya tidak kehilangan konteks histori saat membaca daftar data lama.

#### Acceptance Criteria

1. WHEN sebuah baris List/DataTable memuat relasi (`belongsTo`/`morphTo`/`belongsToMany`) ke model ber-SoftDeletes, THE sistem SHALL menyertakan record yang sudah soft-deleted dalam hasil query relasi tersebut.
2. THE mekanisme ini SHALL diterapkan di titik query List generik (bukan diulang manual di tiap definisi relasi model), agar berlaku ke seluruh model tanpa mengedit satu-satu.
3. WHEN relasi belongsToMany (pivot) ke model ber-SoftDeletes ditampilkan di List, THE sistem SHALL tetap menyertakan baris pivot ke record yang sudah soft-deleted.
4. THE cakupan "List" SHALL mencakup tampilan DataTable di layar maupun hasil export/print yang bersumber dari data List yang sama, agar konsisten.

### Requirement 2: Show/Edit menandai secara eksplisit relasi yang sudah terhapus

**User Story:** As a pengguna yang membuka form Edit sebuah dokumen draft, I want diberi tahu secara jelas kalau salah satu field relasinya mengacu ke data yang sudah dihapus, so that saya tidak submit ulang dokumen dengan data cacat tanpa sadar.

#### Acceptance Criteria

1. WHEN halaman Show/Edit memuat relasi yang record targetnya sudah soft-deleted, THE sistem SHALL tetap memuat data relasi tersebut (bukan null) sehingga nama/label aslinya bisa ditampilkan.
2. THE sistem SHALL menyertakan penanda (flag) bahwa relasi tersebut berasal dari record yang sudah soft-deleted, dikirim ke frontend bersama data relasi.
3. WHEN frontend menerima field relasi dengan penanda soft-deleted, THE komponen `LinkModel.jsx` (dan turunannya) SHALL menampilkan indikasi visual (mis. badge/warning) bahwa data tersebut sudah dihapus.
4. WHEN dokumen berstatus draft memiliki field relasi yang soft-deleted, THE sistem SHALL mewajibkan user memilih ulang relasi tersebut sebelum submit berhasil — bukan cuma peringatan visual pasif.
5. WHEN dokumen berstatus non-draft/final (data historis), THE sistem SHALL menampilkan data relasi apa adanya (dengan penanda soft-deleted jika berlaku) TANPA mewajibkan pengisian ulang, karena dokumen historis tidak lagi bisa diubah.
6. THE kewajiban "isi ulang" SHALL dibatasi pada field relasi ke master data operasional (mis. Item, Account, Customer, Supplier, Warehouse) yang mempengaruhi isi transaksi — field relasi non-operasional seperti User pembuat/approver dikecualikan karena sifatnya historis-read-only, bukan bagian yang perlu diedit ulang.

### Requirement 3: Validasi submit menolak referensi ke record yang sudah soft-deleted (untuk data draft/assignable)

**User Story:** As a sistem, I want validasi FormRequest menolak submit yang mengacu ke record ber-SoftDeletes yang sudah dihapus, so that tidak ada celah user bisa menyimpan referensi ke data mati lewat request manual maupun race condition.

#### Acceptance Criteria

1. WHEN sebuah field FormRequest divalidasi dengan rule `exists:table,column` ke model ber-SoftDeletes, THE validasi SHALL menolak jika record tersebut sudah soft-deleted (`deleted_at IS NOT NULL`).
2. THE perubahan rule validasi ini SHALL diterapkan secara konsisten di seluruh FormRequest yang relevan (bukan hanya satu-dua file), idealnya lewat helper/rule yang bisa dipakai ulang.
3. IF field relasi tersebut merepresentasikan data historis yang memang boleh tetap merujuk ke record terhapus (mis. dokumen non-draft yang tidak divalidasi ulang saat dibaca), THEN rule ini SHALL TIDAK diterapkan pada operasi baca — hanya pada operasi create/update yang benar-benar mengubah referensi.
4. THE audit dan perbaikan rule `exists:table,column` SHALL mencakup seluruh FormRequest di aplikasi yang mereferensikan model ber-SoftDeletes, bukan dibatasi ke prioritas tinggi saja — supaya celah validasi tertutup menyeluruh, konsisten dengan pola `Rule::unique()->whereNull('deleted_at')` yang sudah ada di beberapa Request.

### Requirement 4: Mekanisme penerapan tidak mengubah definisi relasi satu-satu di tiap model

**User Story:** As a developer yang memelihara 73 model ber-SoftDeletes, I want mekanisme withTrashed diterapkan lewat satu/sedikit titik ubah yang bisa dikontrol per konteks (List vs Show vs validasi), so that solusi ini scalable dan tidak butuh mengedit setiap method relasi secara manual.

#### Acceptance Criteria

1. THE solusi SHALL menghindari trait generik yang memaksa satu logic seragam untuk semua model (ditolak sebelumnya karena kondisi "kapan withTrashed" tidak konsisten antar model — kadang dari `$this->status`, kadang dari `parentRelation()->status`).
2. THE solusi SHALL memungkinkan model tertentu (mis. `PurchaseRequestItem`) tetap override perilaku default jika kondisinya spesifik, tanpa konflik dengan mekanisme global.
3. THE mekanisme SHALL dapat dibedakan perilakunya berdasarkan konteks pemanggil (List/DataTable vs Show vs validasi FormRequest) — bukan satu perilaku tunggal di level definisi relasi Model yang berlaku sama untuk semua caller.
4. THE mekanisme SHALL berupa kombinasi tiga titik ubah independen per konteks: macro query builder untuk List (`DataTableScope`), parameter opt-in pada `loadRelations()` untuk Show (`LinkModel` trait), dan custom Rule class untuk validasi (`app/Rules/`) — detail lengkap di design.md.

## Out of Scope

- Perbaikan `Relation::morphMap()` yang belum dipakai project ini (risiko struktural terpisah, ditemukan saat audit tapi bukan bagian dari bug soft-delete ini).
- Perbaikan nama tabel pivot yang tidak konsisten (`user_role` vs `user_roles`).
- Migrasi seluruh `*Item.php` sekaligus — sesuai keputusan audit sebelumnya, ini bisa jadi tasks bertahap dimulai dari prioritas tertinggi, bukan big-bang di satu PR.
