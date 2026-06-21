# API & Controller Reference

Dokumen ini berisi referensi lengkap semua endpoint yang tersedia, diorganisasi berdasarkan role group. Setiap entry mencakup controller, route, HTTP method, middleware, halaman Inertia yang di-render, dan props yang dikirim.

> **Catatan:** Sistem ini bukan REST API — semua endpoint mengembalikan Inertia response (HTML + JSON props). Route didefinisikan di [`routes/web.php`](../routes/web.php), [`routes/auth.php`](../routes/auth.php), dan [`routes/guest.php`](../routes/guest.php).

---

## Daftar Isi

1. [Guest (Public)](#1-guest-public)
2. [Authentication](#2-authentication)
3. [Student](#3-student)
4. [Instructor](#4-instructor)
5. [Organization](#5-organization)
6. [Admin](#6-admin)
7. [Core (Shared)](#7-core-shared)

---

## 1. Guest (Public)

**Route file:** `routes/guest.php`
**Prefix:** `/`
**Middleware:** None (public access)

| Method | Route | Controller@Method | Inertia Page | Keterangan |
|--------|-------|-------------------|--------------|------------|
| GET | `/` | `GuestPageController@home` | `Guest/Home` | Landing page |
| GET | `/training` | `TrainingController@index` | `Guest/Training` | Daftar training publik |
| GET | `/training/{course}` | `TrainingController@show` | `Guest/TrainingPreview` | Preview course untuk guest |
| GET | `/verify` | `GuestPageController@verify` | `Guest/Verify` | Halaman verifikasi |
| GET | `/about` | `GuestPageController@about` | `Guest/About` | Tentang perusahaan |
| GET | `/contact` | `GuestPageController@contact` | `Guest/Contact` | Kontak |

---

## 2. Authentication

**Route file:** `routes/auth.php`
**Middleware:** `guest` (untuk login/register) atau `auth` (untuk logout/setup)

### Guest Routes (belum login)

| Method | Route | Controller@Method | Inertia Page | Keterangan |
|--------|-------|-------------------|--------------|------------|
| GET | `/register` | `RegisteredUserController@create` | `Auth/Register` | Form registrasi |
| POST | `/register` | `RegisteredUserController@store` | — (redirect) | Proses registrasi |
| GET | `/login` | `AuthenticatedSessionController@create` | `Auth/Login` | Form login |
| POST | `/login/roles` | `AuthenticatedSessionController@roles` | — (JSON) | Cek roles user |
| POST | `/login` | `AuthenticatedSessionController@store` | — (redirect) | Proses login |
| GET | `/auth/{driver}/redirect` | `AuthenticatedSessionController@redirectToProvider` | — (redirect) | OAuth redirect |
| GET | `/auth/{driver}/callback` | `AuthenticatedSessionController@handleProviderCallback` | — (redirect) | OAuth callback |

### Auth Routes (sudah login)

| Method | Route | Controller@Method | Inertia Page | Keterangan |
|--------|-------|-------------------|--------------|------------|
| GET | `/verify-email` | `EmailVerificationPromptController` | `Auth/VerifyEmail` | Prompt verifikasi email |
| GET | `/verify-email/{id}/{hash}` | `VerifyEmailController` | — (redirect) | Verifikasi email |
| POST | `/email/verification-notification` | `EmailVerificationNotificationController@store` | — (redirect) | Kirim ulang email verifikasi |
| GET | `/setup` | `SetupUserController@show` | `Auth/SetupUser` | Setup user (invited/OAuth) |
| PUT | `/setup` | `SetupUserController@update` | — (redirect) | Proses setup |
| GET | `/select-role` | `AuthenticatedSessionController@showRoleSelection` | `Auth/SelectRole` | Pilih role (multi-role) |
| POST | `/select-role` | `AuthenticatedSessionController@selectRole` | — (redirect) | Submit pilihan role |
| PUT | `/password` | `PasswordController@update` | — (redirect) | Update password |
| POST | `/logout` | `AuthenticatedSessionController@destroy` | — (redirect) | Logout |

---

## 3. Student

**Route file:** `routes/web.php`
**Prefix:** `/student`
**Middleware:** `auth`, `role:student`

| Method | Route | Controller@Method | Inertia Page | Keterangan |
|--------|-------|-------------------|--------------|------------|
| GET | `/student/dashboard` | `StudentDashboardController@index` | `Students/Dashboard` | Dashboard student |
| GET | `/student/my-courses` | `CourseListController@index` | `Students/MyCourses` | Daftar course yang diikuti |
| GET | `/student/course-catalogue` | `StudentCourseController@index` | `Students/CourseCatalogue` | Katalog course |
| GET | `/student/course-preview/{course}` | `StudentCourseController@show` | `Students/CoursePreview` | Preview course |
| POST | `/student/enroll` | `EnrollmentController@store` | — (back) | Checkout + upload payment proof |
| POST | `/student/cart` | `CartController@store` | — (back) | Tambah ke cart |
| DELETE | `/student/cart/{courseId}` | `CartController@destroy` | — (back) | Hapus dari cart |
| POST | `/student/submissions/{content}` | `SubmissionController@store` | — (back) | Submit tugas |
| DELETE | `/student/submissions/{content}/files/{file}` | `SubmissionController@destroyFile` | — (back) | Hapus file submission |
| POST | `/student/progress/{content}` | `ProgressController@store` | — (back) | Tandai material selesai |
| GET | `/student/profile` | `StudentProfileController@index` | `Students/Profile` | Profil student |
| PUT | `/student/profile` | `StudentProfileController@update` | — (back) | Update profil |
| POST | `/student/profile/avatar` | `StudentProfileController@updateAvatar` | — (back) | Upload avatar |
| DELETE | `/student/profile/avatar` | `StudentProfileController@destroyImage` | — (back) | Hapus avatar |
| POST | `/student/instructor-requests` | `InstructorRoleRequestController@store` | — (back) | Ajukan jadi instruktur |
| GET | `/student/certificates` | — (closure) | `Students/Certificates` | Sertifikat |

---

## 4. Instructor

**Route file:** `routes/web.php`
**Prefix:** `/instructor`
**Middleware:** `auth`, `role:instructor`

### Dashboard & Navigation

| Method | Route | Controller@Method | Inertia Page | Keterangan |
|--------|-------|-------------------|--------------|------------|
| GET | `/instructor/dashboard` | `InstructorDashboardController@index` | `Instructors/Dashboard` | Dashboard instruktur |
| GET | `/instructor/students` | `StudentManagementController@index` | `Instructors/StudentManagement` | Manajemen student |
| GET | `/instructor/growth` | — (closure) | `Instructors/GrowthAnalytics` | Analytics pertumbuhan |
| GET | `/instructor/financial` | `InstructorFinancialController@index` | `Instructors/Financials` | Keuangan instruktur |
| GET | `/instructor/profile` | `InstructorProfileController@index` | `Instructors/Profile` | Profil instruktur |
| PUT | `/instructor/profile` | `InstructorProfileController@update` | — (back) | Update profil |
| POST | `/instructor/profile/avatar` | `InstructorProfileController@updateAvatar` | — (back) | Upload avatar |
| DELETE | `/instructor/profile/avatar` | `InstructorProfileController@destroyImage` | — (back) | Hapus avatar |

### Course Management (prefix: `/instructor/classes`)

| Method | Route | Controller@Method | Keterangan |
|--------|-------|-------------------|------------|
| GET | `/instructor/classes` | `InstructorCourseController@index` | Daftar course instruktur |
| POST | `/instructor/classes` | `InstructorCourseController@store` | Buat course baru |
| GET | `/instructor/classes/{course}` | `InstructorCourseController@show` | Detail course |
| PATCH | `/instructor/classes/{course}` | `InstructorCourseController@update` | Update course |
| POST | `/instructor/classes/{course}/avatar` | `InstructorCourseController@updateThumbnail` | Upload thumbnail |
| DELETE | `/instructor/classes/{course}/avatar` | `InstructorCourseController@destroyThumbnail` | Hapus thumbnail |
| PATCH | `/instructor/classes/{course}/publish` | `InstructorCourseController@togglePublish` | Toggle publish/unpublish |

### Section & Content Management

| Method | Route | Controller@Method | Keterangan |
|--------|-------|-------------------|------------|
| POST | `/classes/{course}/sections` | `CourseSectionController@store` | Tambah section |
| PATCH | `/classes/sections/{section}` | `CourseSectionController@update` | Update section |
| DELETE | `/classes/sections/{section}` | `CourseSectionController@destroy` | Hapus section |
| POST | `/sections/{section}/notes` | `CourseSectionNoteController@store` | Tambah note |
| DELETE | `/notes/{note}` | `CourseSectionNoteController@destroy` | Hapus note |
| POST | `/sections/{section}/contents` | `CourseContentController@store` | Tambah content |
| PATCH | `/contents/{content}` | `CourseContentController@update` | Update content |
| DELETE | `/contents/{content}` | `CourseContentController@destroy` | Hapus content |
| POST | `/contents/{content}/upload` | `CourseContentController@upload` | Upload file ke content |
| DELETE | `/contents/{content}/files/{file}` | `CourseContentController@destroyFile` | Hapus file content |

### Financial

| Method | Route | Controller@Method | Keterangan |
|--------|-------|-------------------|------------|
| POST | `/instructor/financial/payout-requests` | `InstructorFinancialController@storePayoutRequest` | Request payout |

### Grading

| Method | Route | Controller@Method | Keterangan |
|--------|-------|-------------------|------------|
| PATCH | `/instructor/enrollments/{enrollment}/submissions/{submission}/grade` | `InstructorSubmissionController@grade` | Nilai submission |

---

## 5. Organization

**Route file:** `routes/web.php`
**Prefix:** `/organization`
**Middleware:** `auth`, `role:organization`

| Method | Route | Controller@Method | Inertia Page | Keterangan |
|--------|-------|-------------------|--------------|------------|
| GET | `/organization/dashboard` | — (closure) | `Organizations/Dashboard` | Dashboard organisasi |
| GET | `/organization/partner` | — (closure) | `Organizations/PartnerTrainers` | Partner trainers |
| GET | `/organization/profile` | — (closure) | `Organizations/ProfileSettings` | Pengaturan profil |
| GET | `/organization/financial` | — (closure) | `Organizations/Financials` | Keuangan organisasi |

> **Catatan:** Organization routes masih menggunakan closure (belum ada controller khusus). Backend integration ditandai "not implemented yet".

---

## 6. Admin

**Route file:** `routes/web.php`
**Prefix:** `/admin`
**Middleware:** `auth`, `role:admin`, + `admin.permission:*` per route group

### Dashboard

| Method | Route | Controller@Method | Permission | Inertia Page | Keterangan |
|--------|-------|-------------------|------------|--------------|------------|
| GET | `/admin/dashboard` | `AdminDashboardController@index` | — (all admins) | `Admin/Dashboard` | Dashboard admin |

### Course Admin / Super Admin

| Method | Route | Controller@Method | Permission | Inertia Page | Keterangan |
|--------|-------|-------------------|------------|--------------|------------|
| GET | `/admin/approvals` | `CourseApprovalController@index` | `course_admin` | `Admin/Approvals` | Daftar publish requests |
| PATCH | `/admin/approvals/{request}/approve` | `CourseApprovalController@approve` | `course_admin` | — (back) | Approve publish |
| PATCH | `/admin/approvals/{request}/reject` | `CourseApprovalController@reject` | `course_admin` | — (back) | Reject publish |
| GET | `/admin/course-categories` | `CourseCategoryController@index` | `course_admin` | `Admin/CourseCategories` | Daftar kategori |
| POST | `/admin/course-categories` | `CourseCategoryController@store` | `course_admin` | — (back) | Tambah kategori |

### Finance Admin / Super Admin

| Method | Route | Controller@Method | Permission | Keterangan |
|--------|-------|-------------------|------------|------------|
| GET | `/admin/finance` | `SystemFinanceController@index` | `finance_admin` | Halaman finance |
| PATCH | `/admin/finance/{payment}/approve` | `SystemFinanceController@approve` | `finance_admin` | Approve payment |
| PATCH | `/admin/finance/{payment}/reject` | `SystemFinanceController@reject` | `finance_admin` | Reject payment |
| GET | `/admin/finance/{payment}/proof` | `SystemFinanceController@proof` | `finance_admin` | Stream bukti bayar |
| POST | `/admin/finance/payouts/batch` | `SystemFinanceController@runPayoutBatch` | `finance_admin` | Run batch payout |
| PATCH | `/admin/finance/payouts/{request}/approve` | `SystemFinanceController@approvePayoutRequest` | `finance_admin` | Approve payout |
| PATCH | `/admin/finance/payouts/{request}/reject` | `SystemFinanceController@rejectPayoutRequest` | `finance_admin` | Reject payout |
| PATCH | `/admin/finance/payouts/{request}/paid` | `SystemFinanceController@markPayoutRequestAsPaid` | `finance_admin` | Mark paid |
| GET | `/admin/finance/payouts/{request}/proof` | `SystemFinanceController@payoutProof` | `finance_admin` | Stream bukti transfer |
| PATCH | `/admin/finance/settings/payout-delay` | `SystemFinanceController@updatePayoutDelay` | `finance_admin` | Update delay |
| PATCH | `/admin/finance/settings/company-fee` | `SystemFinanceController@updateCompanyFee` | `finance_admin` | Update company fee |

### User Admin / Super Admin

| Method | Route | Controller@Method | Permission | Keterangan |
|--------|-------|-------------------|------------|------------|
| GET | `/admin/user` | `UserDirectoryController@index` | `user_admin` | User directory |
| PATCH | `/admin/user/requests/{request}/approve` | `UserDirectoryController@approveRequest` | `user_admin` | Approve role request |
| PATCH | `/admin/user/requests/{request}/reject` | `UserDirectoryController@rejectRequest` | `user_admin` | Reject role request |
| PATCH | `/admin/user/users/{user}/status` | `UserDirectoryController@updateUserStatus` | `user_admin` | Toggle user status |

### Content Admin / Super Admin

| Method | Route | Controller@Method | Permission | Inertia Page | Keterangan |
|--------|-------|-------------------|------------|--------------|------------|
| GET | `/admin/landing-page-settings` | `LandingPageSettingController@index` | `content_admin` | `Admin/LandingPageSettings` | Landing page settings |
| PATCH | `/admin/landing-page-settings` | `LandingPageSettingController@update` | `content_admin` | — (back) | Update settings |
| POST | `/admin/landing-page-settings/media` | `LandingPageSettingController@uploadMedia` | `content_admin` | — (back) | Upload media |

### Super Admin Only

| Method | Route | Controller@Method | Permission | Keterangan |
|--------|-------|-------------------|------------|------------|
| PATCH | `/admin/user/admins/{user}/permissions` | `UserDirectoryController@updateAdminPermissions` | `super_admin` | Update admin permissions |

### Admin Profile (all admins)

| Method | Route | Controller@Method | Keterangan |
|--------|-------|-------------------|------------|
| GET | `/admin/profile` | `AdminProfileController@index` | Profil admin |
| PUT | `/admin/profile` | `AdminProfileController@update` | Update profil |
| POST | `/admin/profile/avatar` | `AdminProfileController@updateAvatar` | Upload avatar |
| DELETE | `/admin/profile/avatar` | `AdminProfileController@destroyImage` | Hapus avatar |

---

## 7. Core (Shared)

**Route file:** `routes/web.php`
**Middleware:** varies

| Method | Route | Controller@Method | Middleware | Keterangan |
|--------|-------|-------------------|------------|------------|
| GET | `/files/{file}/preview` | `FileController@preview` | — | Preview file |
| POST | `/model` | `ModelController` | `auth` | Get model data |
| POST | `/model/datatable` | `ModelController@datatable` | `auth` | Datatable data |
| GET | `/model/{model}` | `ModelController@columns` | `auth` | Get model columns |
| GET | `/lang` | `LanguageController@index` | — | Get language |
| POST | `/lang` | `LanguageController@set` | — | Set language |
| GET | `/company-logo` | `CompanyLogoController` | — | Company logo |
| GET | `/health` | — (closure) | — | Health check |
| GET | `/{role}/{path?}` | — (closure) | `auth` | Role prefix fallback redirect |

---

## Middleware Chain

```
Request
  → auth (semua route terproteksi)
    → role:X (student/instructor/organization/admin)
      → admin.permission:* (khusus admin routes)
        → Controller
```

### Middleware Details

| Middleware | File | Keterangan |
|-----------|------|------------|
| `auth` | Laravel built-in | Pastikan user sudah login |
| `role` | `app/Http/Middleware/RoleMiddleware.php` | Cek user punya role yang diminta |
| `admin.permission` | `app/Http/Middleware/AdminPermissionMiddleware.php` | Cek admin punya permission spesifik |

---

## Permission Matrix

| Permission | Route Group | Deskripsi |
|-----------|-------------|-----------|
| `super_admin` | Semua admin routes | Akses penuh semua fitur admin |
| `course_admin` | Approvals, Categories | Review dan approve course |
| `finance_admin` | Finance, Payouts, Settings | Verifikasi payment dan payout |
| `user_admin` | Users, Role Requests | Kelola user dan role request |
| `content_admin` | Landing Page | Kelola konten landing page |
