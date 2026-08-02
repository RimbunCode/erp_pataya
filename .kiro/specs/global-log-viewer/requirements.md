# Requirements Document

## Introduction

Aplikasi ERP ini sudah memiliki mekanisme audit trail per-dokumen melalui model `App\Models\Core\Log` (tabel `logs`), yang dicatat otomatis lewat trait `DataTable` (`logForCreated()`, `logForUpdated()`, `logForDeleted()`, `logForRestore()`, `logForSubmitted()`, `logForCancelled()`, `logForAmended()`). Saat ini, log hanya bisa dilihat satu per satu lewat halaman detail (`GET /logs/{log}` → `Core/ShowLog.jsx`), yang diakses dari konteks dokumen tertentu (mis. dari halaman Work Order, tautan ke log miliknya).

Belum ada halaman yang menampilkan **seluruh log lintas semua modul** dalam satu tempat. Fitur ini menambahkan halaman index global (`GET /logs`) yang menampilkan semua record `logs` dari seluruh dokumen di aplikasi, dengan filter berdasarkan modul/tipe dokumen, user pelaku, rentang tanggal, dan jenis aksi — dilindungi permission baru khusus (`select` pada model `Log`) yang diatur lewat halaman Roles yang sudah ada.

## Glossary

- **Log**: satu baris di tabel `logs`, mencatat satu peristiwa (create/update/delete/dll) pada satu dokumen (`loggable`).
- **Loggable**: dokumen yang menjadi subjek log, direlasikan lewat kolom polymorphic `loggable_type` + `loggable_id` (mis. WorkOrder, SalesInvoice, User, Role).
- **Action**: jenis peristiwa yang dicatat log — nilai baku (created, updated, deleted, restored, submitted, cancelled, amended), disimpan terpisah dari kolom `activity` (yang berisi kalimat naratif per-bahasa untuk ditampilkan ke user).
- **Permission model Log**: baris di tabel `permissions` dengan `model = App\Models\Core\Log`, dipakai untuk mengontrol siapa yang boleh mengakses halaman index global ini lewat sistem RBAC yang sudah ada (role → permission → aksi `select`/`read`).

## Requirements

### Requirement 1: Kolom Action baku pada tabel logs

**User Story:** As a developer/auditor, I want setiap baris log punya kode aksi baku yang tidak bergantung bahasa, so that log bisa difilter secara presisi berdasarkan jenis peristiwa.

#### Acceptance Criteria

1. THE system SHALL menambahkan kolom `action` (string, nullable untuk data lama, indexed) pada tabel `logs` melalui migration baru.
2. WHEN `logForCreated()` dipanggil, THE system SHALL mengisi kolom `action` dengan nilai `created`.
3. WHEN `logForUpdated()` dipanggil, THE system SHALL mengisi kolom `action` dengan nilai `updated`.
4. WHEN `logForDeleted()` dipanggil, THE system SHALL mengisi kolom `action` dengan nilai `deleted`.
5. WHEN `logForRestore()` dipanggil, THE system SHALL mengisi kolom `action` dengan nilai `restored`.
6. WHEN `logForSubmitted()` dipanggil, THE system SHALL mengisi kolom `action` dengan nilai `submitted`.
7. WHEN `logForCancelled()` dipanggil, THE system SHALL mengisi kolom `action` dengan nilai `cancelled`.
8. WHEN `logForAmended()` dipanggil, THE system SHALL mengisi kolom `action` dengan nilai `amended`.
9. THE system SHALL TIDAK mengubah kolom `activity` (kalimat naratif per-bahasa) yang sudah ada — kolom `action` murni tambahan, bukan pengganti.
10. THE system SHALL TIDAK mengisi kolom `action` untuk log bertipe `comment` (dibuat lewat `Controller::addComment()`), karena bukan bagian dari audit trail dokumen.

### Requirement 2: Halaman index global log

**User Story:** As an auditor/administrator, I want melihat semua log dari seluruh modul aplikasi dalam satu halaman list, so that saya bisa memantau aktivitas sistem tanpa harus membuka setiap dokumen satu per satu.

#### Acceptance Criteria

1. THE system SHALL menyediakan route `GET /logs` bernama `logs.index`, ditangani oleh method baru `LogController::index()`.
2. WHEN pengguna dengan permission `select` pada model `Log` mengakses `/logs`, THE system SHALL menampilkan halaman React baru (`Core/Logs/Index.jsx`) yang memuat seluruh record `logs` (tidak dibatasi berdasarkan cabang atau pembuat) memakai mekanisme `Log::dataTable($request)` yang sudah ada.
3. WHEN pengguna TIDAK memiliki permission `select` pada model `Log`, THE system SHALL mengembalikan HTTP 403, konsisten dengan mekanisme permission check di `Controller::__construct()`.
4. THE system SHALL TIDAK menyediakan route/endpoint untuk create, update, atau delete pada `/logs` — halaman ini murni read-only, konsisten dengan sifat log sebagai audit trail immutable di level aplikasi.
5. WHEN pengguna mengklik satu baris log di halaman index, THE system SHALL mengarahkan ke halaman detail log yang sudah ada (`logs.show` / `Core/ShowLog.jsx`).

### Requirement 3: Kolom tampilan pada index log

**User Story:** As an auditor, I want melihat informasi penting tiap log (modul asal, dokumen, pelaku, waktu, jenis aksi) langsung dari list, so that saya tidak perlu membuka detail untuk mengetahui konteks dasar sebuah log.

#### Acceptance Criteria

1. THE system SHALL menampilkan kolom `loggable_type` (nama modul/model asal, ditampilkan dalam bentuk yang mudah dibaca, bukan FQCN mentah) pada tabel index.
2. THE system SHALL menampilkan kolom `loggable` yang menaut ke dokumen asal (mis. kode/nomor dokumen) apabila dokumen tersebut masih ada.
3. WHEN dokumen asal (`loggable`) sudah dihapus permanen atau relasinya tidak dapat di-resolve, THE system SHALL tetap menampilkan baris log tanpa error, dengan indikasi bahwa dokumen sudah tidak tersedia.
4. THE system SHALL menampilkan kolom `user` (nama pelaku aksi).
5. THE system SHALL menampilkan kolom `action` (jenis aksi, dari Requirement 1) dalam bentuk label yang diterjemahkan.
6. THE system SHALL menampilkan kolom `created_at` (waktu kejadian).

### Requirement 4: Filter pada index log

**User Story:** As an auditor, I want memfilter daftar log berdasarkan modul, pelaku, rentang tanggal, dan jenis aksi, so that saya bisa menelusuri aktivitas spesifik tanpa menyisir seluruh log.

#### Acceptance Criteria

1. THE system SHALL menyediakan filter berdasarkan `loggable_type` (modul/tipe dokumen).
2. THE system SHALL menyediakan filter berdasarkan `user_id` (pelaku aksi).
3. THE system SHALL menyediakan filter berdasarkan rentang tanggal pada `created_at` (dari tanggal – sampai tanggal).
4. THE system SHALL menyediakan filter berdasarkan `action` (jenis aksi, dari Requirement 1).
5. THE system SHALL mengizinkan kombinasi lebih dari satu filter sekaligus, konsisten dengan mekanisme filter DataTable yang sudah ada di modul lain.

### Requirement 5: Permission khusus model Log

**User Story:** As a system administrator, I want mengatur sendiri role mana saja yang boleh mengakses halaman log global, so that saya bisa membatasi visibility audit trail hanya untuk role yang berwenang (mis. Auditor, System Manager).

#### Acceptance Criteria

1. THE system SHALL mendaftarkan `Log` sebagai model permission-aware, memakai mekanisme registrasi otomatis (`PermissionSeeder` + `initPermissions()`) yang sudah dipakai model lain — tidak ada entri permission manual/hardcoded.
2. THE system SHALL membatasi permission model Log hanya pada aksi yang relevan untuk audit trail read-only: minimal `select` dan `read` — TIDAK termasuk `create`, `write`/`update`, atau `delete`, karena log tidak pernah dibuat/diubah/dihapus lewat endpoint aplikasi.
3. WHEN administrator membuka halaman Roles (`Users/Roles/Show`) yang sudah ada, THE system SHALL menampilkan permission model Log sebagai salah satu modul yang bisa dicentang/diatur, mengikuti pola UI permission existing.
4. THE system SHALL TIDAK secara otomatis memberi permission model Log ke role manapun secara default — assignment permission ke role dilakukan manual oleh administrator melalui halaman Roles.

## Out of Scope

- Tidak ada perubahan pada mekanisme pencatatan log yang sudah berjalan (kapan log dibuat, isi `data_before`/`data_after`) selain penambahan kolom `action`.
- Tidak ada endpoint edit/hapus/restore untuk log lewat halaman ini maupun API.
- Tidak ada scoping tambahan berdasarkan cabang (branch) atau kepemilikan (`created_by_id`) — visibility log murni dikontrol lewat permission `select` pada model Log (sudah dikonfirmasi user).
- Tidak mencakup migrasi/backfill nilai `action` untuk data log historis yang sudah ada sebelum kolom ini ditambahkan (nilai akan `NULL` untuk log lama, dan filter `action` tidak akan menjangkau log lama tersebut kecuali dibahas terpisah).
