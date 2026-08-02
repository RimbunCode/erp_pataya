# Implementation Plan: Invite User

## Overview

Mengisi `UserController::store()` (saat ini stub) dengan alur invite: split rule `UserRequest` untuk create vs update, buat User dengan `status = INVITED` dalam transaksi + sync roles/branches, dan sesuaikan `Form.jsx` supaya field non-invite tersembunyi total saat `isCreate`. Tidak ada perubahan skema DB, notifikasi, atau `SetupUserController`.

## Tasks

- [x] 1. Backend: validasi dan create User

  - [x] 1.1 Split `UserRequest::rules()` untuk create vs update
    - Tambah percabangan `$this->isMethod('post')` di `app/Http/Requests/User/UserRequest.php`
    - Rule create: `name` (required, string, min:3, max:255), `email` (required, email:rfc, unique users where deleted_at IS NULL), `roles`/`roles.*` (nullable array + ExistsExcludingTrashed), `branches`/`branches.*` (nullable array + ExistsExcludingTrashed), `default_branch_id` (nullable + ExistsExcludingTrashed)
    - Rule update: pertahankan rule set existing apa adanya (jangan ubah behavior update)
    - _Requirements: 2.1, 2.3, 2.4, 4.1_

  - [x] 1.2 Implementasi `UserController::store()`
    - Terima `UserRequest $request`, ambil `$request->validated()`
    - Bungkus dalam `DB::beginTransaction()` / `commit()` / `rollBack()` + rethrow (pola sama seperti `destroy()`)
    - `User::create()` dengan `name`, `email`, `status = FormStatus::INVITED`, `default_branch_id` (biarkan `password`/`username` null karena `$guarded=['id']` dan tidak dikirim)
    - Sync `roles()` dan `branches()` jika masing-masing dikirim dan tidak kosong
    - Panggil `logForCreated()` (pola sama seperti `logForUpdated()`/`logForDeleted()` di controller ini)
    - Redirect ke `route('users.index')`
    - _Requirements: 3.1, 3.3, 3.4, 3.5, 4.2_

  - [x] 1.3 Write feature tests untuk `UserController::store()` (Property 1, 2, 4)
    - **Property 1: Invite hanya menerima field whitelist** — submit payload berisi `username`/`password`/`gender`/`phone` selain field whitelist, assert field tersebut tidak tersimpan ke DB
    - **Property 2: Status dan null fields** — submit invite valid (name+email saja), assert `status === FormStatus::INVITED`, `password === null`, `username === null`
    - **Property 2 (lanjutan): multiple invited users tanpa username** — buat 2+ user invite berurutan tanpa username, assert tidak ada exception unique constraint
    - **Property 4: Atomicity** — mock/force exception saat sync roles (mis. role id invalid di tengah proses jika memungkinkan, atau assert lewat DB transaction test), assert tidak ada record `User` tersisa setelah rollback
    - Test tambahan: email duplikat user aktif → 422 tanpa record baru tersimpan; email milik user soft-deleted → diizinkan
    - **Validates: Requirements 2.1, 2.2, 3.1, 4.1, 4.2**
    - File: `tests/Feature/User/UserInviteTest.php` — 7 test, semua pass

- [x] 2. Checkpoint - Ensure backend tests pass

  - Jalankan `php artisan test --compact --filter=UserController` (atau nama test class yang dipakai), pastikan semua pass sebelum lanjut ke frontend.
  - Hasil: `php artisan test --compact --filter=UserInviteTest` → 7 passed (26 assertions)

- [x] 3. Frontend: form Create User dibatasi field

  - [x] 3.1 Tambah `isCreate` dari `useFormPage()` di `Form.jsx`
    - Ambil `isCreate` di `resources/js/Pages/Users/ManageUsers/Form.jsx` bersama `data`, `setData` existing
    - _Requirements: 1.1_

  - [x] 3.2 Sembunyikan field non-invite saat create
    - Bungkus field `username`, `gender`, `phone`, `birthdate` dengan kondisi `!isCreate` (hilang total dari DOM, bukan sekadar disabled)
    - Ubah `disabled={authUser.id != data?.id}` pada field Email dan Nama menjadi `disabled={!isCreate && authUser.id != data?.id}` supaya tidak ter-disable salah saat create
    - _Requirements: 1.1_

  - [x] 3.3 Sesuaikan required pada `default_branch_id`
    - Ubah `required={true}` pada Select `default_branch_id` (tab Roles and Permission) menjadi `required={!isCreate}`
    - _Requirements: 1.2, 3.4_

  - [x] 3.4\* Verifikasi manual tab Roles and Permission tidak perlu diubah
    - Konfirmasi kondisi `canUser("manage_roles")` / `canUser("manage_branches")` sudah otomatis benar untuk create (tidak bergantung `isCreate`) — task opsional, hanya jika ada keraguan saat review manual
    - _Requirements: 1.2, 1.3, 1.4_
    - Diverifikasi via code review: kondisi render tab hanya bergantung `canUser(...)`, tidak ada perubahan diperlukan

- [x] 4. Checkpoint - Ensure all tests pass dan verifikasi manual

  - Jalankan full test suite terkait User (`php artisan test --compact tests/Feature/User`)
  - Build frontend (`npm run build` atau `npm run dev`) dan cek manual: buka `/users/create`, pastikan hanya Email, Nama, dan tab Roles and Permission (Roles+Branches) yang tampil, submit form, dan pastikan user baru berstatus invited serta notifikasi terkirim (cek log/mailtrap sesuai `.env`)
  - Hasil: `tests/Feature/User` → 8 passed (37 assertions). `npm run build` sukses tanpa error. Pint (`--dirty --format agent`) → pass. eslint pada `Form.jsx` → tanpa error.
  - Full suite project (`php artisan test`, di luar folder User) menunjukkan 422 failed baik SEBELUM maupun SESUDAH perubahan spec ini (diverifikasi via `git stash` baseline check) — kegagalan pre-existing, tidak berkaitan dengan invite-user (root cause: `SQLSTATE[HY000]: cannot start a transaction within a transaction`, state leakage antar test SQLite di full-suite run, urutan-dependent, tidak muncul saat test folder User dijalankan terisolasi).
  - Verifikasi visual browser TIDAK dilakukan (Herd MCP tidak tersedia/gagal koneksi di sesi ini) — hanya diverifikasi via automated test + `npm run build` sukses. Rekomendasi: user cek manual `/users/create` sebelum merge.

## Notes

- Formatter/linter (`vendor/bin/pint --dirty`, eslint) dijalankan sekali di akhir setelah semua task selesai, bukan per task.
- Tidak ada task migrasi DB — skema `users` sudah cukup (kolom `username`, `password` nullable; `status` enum sudah punya value `INVITED`).
- Task 3.4 ditandai optional karena sifatnya verifikasi, bukan perubahan kode — bisa dilewati jika review manual di Task 4 sudah cukup meyakinkan.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["1.3"] },
    { "id": 3, "tasks": ["2"] },
    { "id": 4, "tasks": ["3.1"] },
    { "id": 5, "tasks": ["3.2", "3.3"] },
    { "id": 6, "tasks": ["3.4"] },
    { "id": 7, "tasks": ["4"] }
  ]
}
```
