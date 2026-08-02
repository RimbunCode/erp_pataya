# Implementation Plan: CRM Leads (Lead Management)

## Overview

Implementasi mengikuti pola arsitektur domain `Sales\Customer` yang sudah ada: model dengan trait `DataTable` untuk `Lead`, model polos bergaya `Country` untuk `LeadSource` (tanpa CRUD), controller+request+service standar, halaman Inertia/React standar (tanpa `Show.jsx`), dan permission yang ter-generate otomatis lewat `PermissionSeeder` — tidak ada mekanisme RBAC baru yang dibuat. Dua bugfix RBAC pre-existing di working tree (`LinkModel.jsx`, `UserController.php`) dibereskan lebih dulu sebagai commit terpisah, sebelum kode CRM ditambahkan, supaya diff CRM tetap bersih dan reviewable.

## Tasks

- [x] 1. Bersihkan bugfix RBAC pre-existing di working tree
  - [x] 1.1 Commit fix `!disabledAdd` di `resources/js/Components/LinkModel.jsx`
    - Sudah tercommit lewat `aec73b2a` (commit eksternal sebelum sesi ini)
    - _Requirements: (housekeeping, tidak terkait requirement fungsional CRM)_

  - [x] 1.2 Hapus `dd($file)` debug leftover di `app/Http/Controllers/User/UserController.php`
    - Ditemukan justru bertambah lewat commit `aec73b2a`; dihapus dan dicommit terpisah di `ba63b27d`
    - _Requirements: (housekeeping, tidak terkait requirement fungsional CRM)_

- [x] 2. Checkpoint - Pastikan branch bersih dari bugfix pre-existing
  - Diverifikasi via `git show`/diff, tidak lewat dev server manual.

- [x] 3. Buat LeadSource (lookup model, pola Country)
  - [x] 3.1 Migration `create_lead_sources_table` — `database/migrations/2026_07_11_202113_create_lead_sources_table.php`
  - [x] 3.2 Model `app/Models/CRM/LeadSource.php`
  - [x] 3.3 Seeder `database/seeders/LeadSourceSeeder.php` (pakai `updateOrCreate` untuk idempotency)
  - [x] 3.4 Frontend `resources/js/Pages/Core/LeadSourceLinkModel.jsx`
  - [x] 3.5 Test `tests/Feature/CRM/LeadSourceSeederTest.php` — 2 test, PASS
  - Commit: `edde3204`

- [x] 4. Checkpoint - Pastikan LeadSource berfungsi sebelum lanjut ke Lead
  - Terverifikasi lewat `php artisan test --filter=LeadSourceSeederTest` (PASS) setelah memperbaiki bug migration pre-existing (index duplikat `approverable_index`, commit `b4395cb0`).

- [x] 5. Buat Lead — backend
  - [x] 5.1 Migration `create_leads_table` — `database/migrations/2026_07_11_202114_create_leads_table.php`, diverifikasi via `migrate --pretend`
  - [x] 5.2 Model `app/Models/CRM/Lead.php`
  - [x] 5.3 Request `app/Http/Requests/CRM/LeadRequest.php` — shape `assigned_to.id` dikonfirmasi via pola `WarehouseController` (field `pic`)
  - [x] 5.4 Controller `app/Http/Controllers/CRM/LeadController.php`
  - [x] 5.5 Registrasi route di `routes/web.php`
  - [x] 5.6 Migration + route terverifikasi (`route:list --name=lead`); permission seeder belum dijalankan di DB dev sungguhan (hanya diverifikasi logikanya lewat test)
  - [x] 5.7 Test `tests/Feature/CRM/LeadRequestValidationTest.php` — 2 test, PASS
  - [x] 5.8 Test `tests/Feature/CRM/LeadPermissionTest.php` — RBAC store/update, PASS
  - Commit: `fbd26883` (backend + konversi digabung karena dikerjakan dan diuji sebagai satu unit)

- [x] 6. Checkpoint - Pastikan Lead CRUD backend berfungsi penuh
  - Diverifikasi via `php artisan test` (8 test CRM, semua PASS) + `route:list`. Tidak diuji manual lewat Postman/API call langsung.

- [x] 7. Buat Lead — frontend
  - [x] 7.1 `resources/js/Pages/CRM/Leads/Index.jsx`
  - [x] 7.2 `resources/js/Pages/CRM/Leads/Form.jsx` — termasuk tombol Convert to Customer
  - [x] 7.3 `resources/js/Pages/CRM/Leads/LeadLinkModel.jsx`
  - [x] 7.4 i18n `lang/en/crm/{lead,lead_source}.php` + `lang/id/crm/{lead,lead_source}.php` (key parity diverifikasi manual — sinkron 100%)
  - [~] 7.5 Golden path browser manual — **belum dilakukan**. Diverifikasi setara via `npx vite build` (sukses, tanpa error) + `npx eslint` (0 error, 1 warning kecil sudah diperbaiki) + test HTTP end-to-end (create/update/convert lewat request asli). Tidak dibuka di browser sungguhan.
  - Commit: `2c92b625`

- [~] 8. Checkpoint - Pastikan Lead CRUD frontend berfungsi penuh
  - Build produksi sukses, route Customer/Supplier dicek tetap utuh via `route:list`. **Belum** diverifikasi lewat browser interaktif (dev server tidak dijalankan/diklik manual).

- [x] 9. Implementasi konversi Lead → Customer
  - [x] 9.1 Service `app/Services/CRM/LeadService.php`
  - [x] 9.2 Method `convert` + override `matchMethodWithPermission` (pakai `$this->guard('write', 0)` yang sudah `abort(403)` sendiri di dalam `_checkPermission`, bukan `matchMethodWithPermission` bypass-style seperti `BranchController::switch`)
  - [x] 9.3 Route custom `PUT /leads/{lead}/convert`
  - [x] 9.4 Tombol "Convert to Customer" + tampilan link read-only setelah converted
  - [x] 9.5 Test idempotency + correctness — tercakup di `LeadPermissionTest::test_user_with_write_permission_can_convert_lead`
  - [x] 9.6 Test RBAC convert — `LeadPermissionTest::test_user_without_write_permission_cannot_convert_lead`
  - **Bug ditemukan & diperbaiki di luar rencana**: `Customer::getAddressAttribute()` crash saat `country` null (selalu computed via `$appends`). Fix null-safety satu baris, commit `cd43ff71`.

- [~] 10. Final checkpoint - Pastikan seluruh modul CRM Leads berfungsi end-to-end
  - `php artisan test tests/Feature/CRM tests/Feature/Database` → 10 test PASS.
  - Ditemukan 3 area kegagalan **pre-existing, tidak terkait CRM**: `LocaleKeysTest` (gap besar `lang/id` di seluruh project, sudah ada sebelum sesi ini; modul `crm.*` sendiri sudah sinkron sempurna en/id), serta `RegistrationTest`/`PasswordResetTest`/`PasswordUpdateTest`/`PasswordConfirmationTest` (gagal karena route `/register` dkk dijaga middleware `lang` yang redirect tanpa cookie `lang`, tidak disediakan test-test tersebut — dikonfirmasi lewat pembacaan `routes/auth.php`, tidak menyentuh file yang saya ubah sama sekali).
  - **Belum dilakukan**: klik manual end-to-end di browser (buka `/leads`, isi form, convert, cek `/customers`). Direkomendasikan sebelum merge ke `main`.

## Notes

- Setiap task mereferensi requirement dari `requirements.md` untuk traceability.
- Task 1 (bugfix RBAC pre-existing) dikerjakan lebih dulu; ternyata sebagian sudah tercommit sebelum sesi ini (`aec73b2a`) tapi meninggalkan `dd($file)` yang harus dihapus ulang.
- Dua bug pre-existing ditemukan dan diperbaiki di luar rencana awal (masing-masing commit terpisah, tidak dicampur dengan kode CRM): index migration duplikat (`b4395cb0`) dan `Customer::getAddressAttribute()` null-unsafe (`cd43ff71`).
- Tidak ada task untuk web form intake, email-to-lead, atau Deal/Opportunity — eksplisit di luar scope v1.
- Formatter/linter (`eslint`) dijalankan sekali di akhir pekerjaan frontend, bukan per task — sesuai catatan asli.
- **Follow-up yang direkomendasikan sebelum merge**: (1) verifikasi manual di browser (task 7.5/8/10 yang belum tuntas), (2) jalankan `php artisan db:seed --class=PermissionSeeder` di DB dev sungguhan dan assign permission "Leads" ke role via UI, (3) opsional — investigasi/perbaiki gap `LocaleKeysTest` dan test Auth yang gagal (di luar scope spec ini, tapi mengganggu sinyal test suite project).

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2"] },
    { "id": 2, "tasks": ["3.1"] },
    { "id": 3, "tasks": ["3.2", "3.3"] },
    { "id": 4, "tasks": ["3.4", "3.5"] },
    { "id": 5, "tasks": ["4"] },
    { "id": 6, "tasks": ["5.1"] },
    { "id": 7, "tasks": ["5.2"] },
    { "id": 8, "tasks": ["5.3", "5.4"] },
    { "id": 9, "tasks": ["5.5", "5.6"] },
    { "id": 10, "tasks": ["5.7", "5.8"] },
    { "id": 11, "tasks": ["6"] },
    { "id": 12, "tasks": ["7.1", "7.4"] },
    { "id": 13, "tasks": ["7.2", "7.3"] },
    { "id": 14, "tasks": ["7.5"] },
    { "id": 15, "tasks": ["8"] },
    { "id": 16, "tasks": ["9.1"] },
    { "id": 17, "tasks": ["9.2"] },
    { "id": 18, "tasks": ["9.3", "9.4"] },
    { "id": 19, "tasks": ["9.5", "9.6"] },
    { "id": 20, "tasks": ["10"] }
  ]
}
```
