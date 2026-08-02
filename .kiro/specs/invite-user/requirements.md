# Requirements Document

## Introduction

Saat ini `UserController::store()` belum diimplementasikan — fitur Tambah User belum ada sama sekali. Model `User` sudah punya dukungan tidak langsung untuk alur invite: transisi `status` ke `FormStatus::INVITED` di `User::booted()` otomatis mengirim `UserInvitedNotification` (email berisi link ke `/setup`), dan `SetupUserController` menangani kelanjutan alur saat user mengisi password dan branch sendiri.

Fitur ini menyambungkan potongan yang sudah ada menjadi alur "Invite User": form Tambah User dibatasi hanya field **Email** (untuk mengirim undangan) dan **Nama**, ditambah tab **Roles and Permission** yang sudah ada di `Form.jsx` (berisi pemilihan Roles dan Branches). Field lain (username, gender, birthdate, phone) tidak diisi saat invite — dilengkapi user sendiri saat proses setup akun via `/setup`.

Pembatasan berlaku di dua level: UI (form hanya menampilkan field yang diizinkan) dan backend validation (field di luar itu ditolak eksplisit, bukan sekadar diabaikan).

## Glossary

- **Invite User**: alur membuat `User` baru dengan `status = FormStatus::INVITED`, tanpa password, memicu email undangan.
- **Setup Akun**: alur lanjutan di `SetupUserController` tempat user yang diundang mengisi password, username, dan data profil lain, hingga `status` berubah jadi `ACTIVE`.
- **Tab Roles and Permission**: tab pada `Form.jsx` (`value="roles_and_permissions"`) yang berisi dua seksi: pemilihan Roles dan pemilihan Branches (termasuk `default_branch_id`).

## Requirements

### Requirement 1: Form Invite User dibatasi field

**User Story:** As an admin dengan akses create user, I want form Tambah User hanya menampilkan Email, Nama, dan tab Roles and Permission, so that saya tidak salah mengisi data profil yang seharusnya diisi sendiri oleh user yang diundang.

#### Acceptance Criteria

1. WHEN admin membuka halaman Create User, THE sistem SHALL menampilkan hanya field Email dan Nama sebagai input identitas, tanpa field username, gender, birthdate, phone.
2. THE sistem SHALL menampilkan tab Roles and Permission (Roles dan Branches) pada form Create User, mengikuti hak akses `manage_roles` dan `manage_branches` yang sudah ada.
3. IF admin tidak memiliki permission `manage_roles`, THEN THE sistem SHALL menyembunyikan seksi Roles pada tab tersebut, mengikuti perilaku existing di `Form.jsx`.
4. IF admin tidak memiliki permission `manage_branches`, THEN THE sistem SHALL menyembunyikan seksi Branches pada tab tersebut, mengikuti perilaku existing di `Form.jsx`.

### Requirement 2: Validasi backend membatasi field yang diterima saat invite

**User Story:** As a developer/system, I want backend menolak field di luar Email, Nama, Roles, dan Branches saat request Create User, so that pembatasan tidak bisa dilewati lewat manipulasi request langsung ke endpoint.

#### Acceptance Criteria

1. WHEN request `store()` diterima pada `UserController`, THE sistem SHALL memvalidasi hanya `name`, `email`, `roles`, `branches`, `default_branch_id` sebagai field yang diizinkan.
2. IF request menyertakan field lain di luar daftar yang diizinkan (mis. `username`, `gender`, `birthdate`, `phone`, `password`), THEN THE sistem SHALL menolak field tersebut (tidak diteruskan ke proses create, baik lewat validasi eksplisit maupun `validated()` yang scoped).
3. THE sistem SHALL mewajibkan `name` dan `email` (format email valid, unique terhadap user yang belum di-soft-delete).
4. THE sistem SHALL memperlakukan `roles` dan `branches` sebagai opsional (array of id yang valid, sama seperti rule existing di `UserRequest`).

### Requirement 3: Proses invite membuat User dengan status INVITED

**User Story:** As an admin, I want submit form Invite User langsung membuat akun berstatus diundang dan mengirim email undangan, so that user baru bisa langsung setup akunnya sendiri.

#### Acceptance Criteria

1. WHEN `UserController::store()` menerima data valid, THE sistem SHALL membuat record `User` baru dengan `name`, `email`, `status = FormStatus::INVITED`, `password = null`, `username = null`.
2. WHEN `User` dibuat dengan `status = FormStatus::INVITED`, THE sistem SHALL memicu pengiriman `UserInvitedNotification` melalui mekanisme `User::booted()` yang sudah ada (tidak perlu implementasi baru untuk pengiriman email).
3. IF `roles` disertakan pada request, THEN THE sistem SHALL menyimpan relasi `user_role` sesuai roles yang dipilih, mengikuti pola sync yang sudah dipakai di `update()`.
4. IF `branches` dan/atau `default_branch_id` disertakan pada request, THEN THE sistem SHALL menyimpan relasi branches dan `default_branch_id` sesuai yang dipilih, mengikuti pola sync yang sudah dipakai di `update()`.
5. WHEN proses create berhasil, THE sistem SHALL redirect admin ke halaman Index User (atau halaman Show user yang baru dibuat) dengan pesan sukses, mengikuti konvensi flash message controller lain.

### Requirement 4: Penanganan error dan duplikasi

**User Story:** As an admin, I want mendapat pesan jelas kalau email yang saya undang sudah terdaftar, so that saya tidak membuat duplikasi user.

#### Acceptance Criteria

1. IF email yang diinput sudah terdaftar pada user aktif (belum di-soft-delete), THEN THE sistem SHALL menolak request dengan pesan validasi pada field `email`.
2. IF proses create gagal (mis. constraint DB, error notifikasi email), THEN THE sistem SHALL tidak meninggalkan record `User` parsial — proses create dan sync roles/branches SHALL dibungkus dalam transaksi database.
