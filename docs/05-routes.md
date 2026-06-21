# Routes

Semua route didefinisikan di `routes/web.php`. Sistem menggunakan route groups berbasis role dengan middleware yang sesuai.

---

## Auth Routes (Publik)

Route-route ini dapat diakses tanpa login.

| Method | Path | Nama Route | Deskripsi |
|--------|------|------------|-----------|
| GET | `/` | — | Landing page (redirect ke login) |
| GET | `/auth/login` | `login` | Halaman login |
| POST | `/auth/login` | — | Proses login |
| GET | `/auth/register` | `register` | Halaman registrasi |
| POST | `/auth/register` | — | Proses registrasi |
| GET | `/auth/forgot-password` | `password.request` | Halaman lupa password |
| POST | `/auth/forgot-password` | `password.email` | Kirim link reset |
| GET | `/auth/reset-password/{token}` | `password.reset` | Form reset password |
| POST | `/auth/reset-password` | `password.update` | Proses reset password |
| GET | `/auth/verify-email` | `verification.notice` | Pemberitahuan verifikasi email |
| GET | `/auth/verify-email/{id}/{hash}` | `verification.verify` | Konfirmasi email |
| POST | `/auth/email/verification-notification` | `verification.send` | Kirim ulang email verifikasi |
| GET | `/auth/confirm-password` | `password.confirm` | Konfirmasi password |
| POST | `/auth/confirm-password` | — | Proses konfirmasi |
| POST | `/auth/logout` | `logout` | Logout |
| GET | `/auth/select-role` | `login.select-role` | Pilih role (untuk multi-role user) |
| GET | `/auth/setup` | `setup.show` | Setup profil awal (user INVITED) |
| POST | `/auth/setup` | `setup.update` | Proses setup |
| GET | `/auth/google` | — | Redirect ke Google OAuth |
| GET | `/auth/google/callback` | — | Callback Google OAuth |

---

## Route Publik Global

| Method | Path | Nama Route | Deskripsi |
|--------|------|------------|-----------|
| GET | `/files/{file}/preview` | `files.preview` | Preview/download file (publik) |
| GET | `/company-logo` | `company-logo` | Logo perusahaan |
| GET/POST | `/lang` | `lang.*` | Set bahasa aplikasi |
| GET | `/health` | — | Health check endpoint |
| POST | `/model` | `model` | Ambil data model (untuk datatable) |
| POST | `/model/datatable` | `model.datatable` | Data untuk datatable |
| GET | `/model/{model}` | `model.columns` | Kolom model |

---

## Student Routes

**Middleware**: `auth`, `role:student`  
**Prefix**: `/student`  
**Prefix Nama**: `student.`

| Method | Path | Controller | Nama Route | Deskripsi |
|--------|------|-----------|------------|-----------|
| GET | `/student/dashboard` | StudentDashboardController@index | `student.dashboard` | Dashboard |
| GET | `/student/my-courses` | CourseListController@index | `student.courses.index` | Daftar kursus yang diikuti |
| GET | `/student/course-catalogue` | StudentCourseController@index | `student.course-catalogue` | Katalog kursus |
| GET | `/student/course-preview/{course}` | StudentCourseController@show | `student.course.preview` | Preview detail kursus |
| POST | `/student/enroll` | EnrollmentController@store | `student.enroll` | Daftar kursus + upload bukti bayar |
| POST | `/student/cart` | CartController@store | `student.cart.store` | Tambah ke keranjang |
| DELETE | `/student/cart/{courseId}` | CartController@destroy | `student.cart.destroy` | Hapus dari keranjang |
| POST | `/student/progress/{content}` | ProgressController@store | `student.progress.store` | Tandai materi selesai |
| POST | `/student/submissions/{content}` | SubmissionController@store | `student.submissions.store` | Upload tugas |
| DELETE | `/student/submissions/{content}/files/{file}` | SubmissionController@destroyFile | `student.submissions.files.destroy` | Hapus file tugas |
| GET | `/student/profile` | StudentProfileController@index | `student.profile` | Lihat profil |
| PUT | `/student/profile` | StudentProfileController@update | `student.profile.update` | Update profil |
| POST | `/student/profile/avatar` | StudentProfileController@updateAvatar | `student.avatar.update` | Ganti foto profil |
| DELETE | `/student/profile/avatar` | StudentProfileController@destroyImage | `student.image.delete` | Hapus foto profil |
| POST | `/student/instructor-requests` | InstructorRoleRequestController@store | `student.instructor-requests.store` | Ajukan jadi instruktur |
| GET | `/student/certificates` | — | `student.certificates` | Sertifikat |

---

## Instructor Routes

**Middleware**: `auth`, `role:instructor`  
**Prefix**: `/instructor`  
**Prefix Nama**: `instructor.`

### Dashboard & Profil

| Method | Path | Controller | Nama Route | Deskripsi |
|--------|------|-----------|------------|-----------|
| GET | `/instructor/dashboard` | InstructorDashboardController@index | `instructor.dashboard` | Dashboard |
| GET | `/instructor/growth` | — | `instructor.growth` | Analitik pertumbuhan |
| GET | `/instructor/students` | StudentManagementController@index | `instructor.students` | Manajemen siswa & grading |
| GET | `/instructor/financial` | InstructorFinancialController@index | `instructor.financial` | Laporan keuangan & payout |
| GET | `/instructor/profile` | InstructorProfileController@index | `instructor.profile` | Lihat profil |
| PUT | `/instructor/profile` | InstructorProfileController@update | `instructor.profile.update` | Update profil |
| POST | `/instructor/profile/avatar` | InstructorProfileController@updateAvatar | `instructor.avatar.update` | Ganti foto profil |
| DELETE | `/instructor/profile/avatar` | InstructorProfileController@destroyImage | `instructor.image.delete` | Hapus foto profil |

### Manajemen Kursus

| Method | Path | Controller | Nama Route | Deskripsi |
|--------|------|-----------|------------|-----------|
| GET | `/instructor/classes` | InstructorCourseController@index | `instructor.classes.index` | Daftar kursus milik instruktur |
| POST | `/instructor/classes` | InstructorCourseController@store | `instructor.classes.store` | Buat kursus baru |
| GET | `/instructor/classes/{course}` | InstructorCourseController@show | `instructor.classes.show` | Detail kursus |
| PATCH | `/instructor/classes/{course}` | InstructorCourseController@update | `instructor.classes.update` | Update kursus |
| PATCH | `/instructor/classes/{course}/publish` | InstructorCourseController@togglePublish | `instructor.classes.togglePublish` | Submit/unpublish kursus |
| POST | `/instructor/classes/{course}/avatar` | InstructorCourseController@updateThumbnail | `instructor.classes.thumbnail.update` | Ganti thumbnail |
| DELETE | `/instructor/classes/{course}/avatar` | InstructorCourseController@destroyThumbnail | `instructor.classes.thumbnail.delete` | Hapus thumbnail |

### Sections & Contents

| Method | Path | Controller | Nama Route | Deskripsi |
|--------|------|-----------|------------|-----------|
| POST | `/instructor/classes/{course}/sections` | CourseSectionController@store | `instructor.classes.sections.store` | Buat section baru |
| PATCH | `/instructor/classes/sections/{section}` | CourseSectionController@update | `instructor.classes.sections.update` | Edit judul section |
| DELETE | `/instructor/classes/sections/{section}` | CourseSectionController@destroy | `instructor.classes.sections.destroy` | Hapus section |
| POST | `/instructor/classes/sections/{section}/notes` | CourseSectionNoteController@store | `instructor.classes.sections.notes.store` | Tambah pengumuman section |
| DELETE | `/instructor/classes/notes/{note}` | CourseSectionNoteController@destroy | `instructor.classes.sections.notes.destroy` | Hapus pengumuman |
| POST | `/instructor/classes/sections/{section}/contents` | CourseContentController@store | `instructor.classes.sections.contents.store` | Tambah konten |
| PATCH | `/instructor/classes/contents/{content}` | CourseContentController@update | `instructor.classes.sections.contents.update` | Edit konten |
| DELETE | `/instructor/classes/contents/{content}` | CourseContentController@destroy | `instructor.classes.sections.contents.destroy` | Hapus konten |
| POST | `/instructor/classes/contents/{content}/upload` | CourseContentController@upload | `instructor.classes.sections.contents.upload` | Upload file materi |
| DELETE | `/instructor/classes/contents/{content}/files/{file}` | CourseContentController@destroyFile | `instructor.classes.sections.contents.files.destroy` | Hapus file materi |

### Grading & Payout

| Method | Path | Controller | Nama Route | Deskripsi |
|--------|------|-----------|------------|-----------|
| PATCH | `/instructor/enrollments/{enrollment}/submissions/{submission}/grade` | InstructorSubmissionController@grade | `instructor.enrollments.submissions.grade` | Nilai tugas siswa |
| POST | `/instructor/financial/payout-requests` | InstructorFinancialController@storePayout | `instructor.financial.payout-requests.store` | Ajukan payout |

---

## Admin Routes

**Middleware**: `auth`, `role:admin`  
**Prefix**: `/admin`  
**Prefix Nama**: `admin.`

### Dashboard & Profil (Semua Admin)

| Method | Path | Controller | Nama Route | Deskripsi |
|--------|------|-----------|------------|-----------|
| GET | `/admin/dashboard` | AdminDashboardController@index | `admin.dashboard` | Dashboard admin |
| GET | `/admin/profile` | AdminProfileController@index | `admin.profile` | Profil admin |
| PUT | `/admin/profile` | AdminProfileController@update | `admin.profile.update` | Update profil |
| POST | `/admin/profile/avatar` | AdminProfileController@updateAvatar | `admin.avatar.update` | Ganti foto |
| DELETE | `/admin/profile/avatar` | AdminProfileController@destroyImage | `admin.image.delete` | Hapus foto |

### Course Management (`course_admin` atau `super_admin`)

| Method | Path | Controller | Nama Route | Deskripsi |
|--------|------|-----------|------------|-----------|
| GET | `/admin/approvals` | CourseApprovalController@index | `admin.approval` | Daftar pengajuan publish |
| PATCH | `/admin/approvals/{request}/approve` | CourseApprovalController@approve | `admin.approval.approve` | Setujui publish kursus |
| PATCH | `/admin/approvals/{request}/reject` | CourseApprovalController@reject | `admin.approval.reject` | Tolak publish kursus |
| GET | `/admin/course-categories` | CourseCategoryController@index | `admin.course-categories.index` | Kelola kategori |
| POST | `/admin/course-categories` | CourseCategoryController@store | `admin.course-categories.store` | Buat kategori baru |

### Finance Management (`finance_admin` atau `super_admin`)

| Method | Path | Controller | Nama Route | Deskripsi |
|--------|------|-----------|------------|-----------|
| GET | `/admin/finance` | SystemFinanceController@index | `admin.finance` | Dashboard keuangan |
| PATCH | `/admin/finance/{payment}/approve` | SystemFinanceController@approve | `admin.finance.approve` | Setujui pembayaran |
| PATCH | `/admin/finance/{payment}/reject` | SystemFinanceController@reject | `admin.finance.reject` | Tolak pembayaran |
| GET | `/admin/finance/{payment}/proof` | SystemFinanceController@proof | `admin.finance.proof` | Lihat bukti bayar |
| POST | `/admin/finance/payouts/batch` | SystemFinanceController@runPayoutBatch | `admin.finance.payouts.batch` | Batch payout otomatis |
| PATCH | `/admin/finance/payouts/{request}/approve` | SystemFinanceController@approvePayoutRequest | `admin.finance.payouts.approve` | Setujui payout |
| PATCH | `/admin/finance/payouts/{request}/reject` | SystemFinanceController@rejectPayoutRequest | `admin.finance.payouts.reject` | Tolak payout |
| PATCH | `/admin/finance/payouts/{request}/paid` | SystemFinanceController@markPayoutAsPaid | `admin.finance.payouts.paid` | Tandai payout terbayar |
| GET | `/admin/finance/payouts/{request}/proof` | SystemFinanceController@payoutProof | `admin.finance.payouts.proof` | Lihat bukti transfer |
| PATCH | `/admin/finance/settings/payout-delay` | SystemFinanceController@updatePayoutDelay | `admin.finance.settings.payout-delay` | Update delay payout (hari) |
| PATCH | `/admin/finance/settings/company-fee` | SystemFinanceController@updateCompanyFee | `admin.finance.settings.company-fee` | Update fee platform (%) |

### User Management (`user_admin` atau `super_admin`)

| Method | Path | Controller | Nama Route | Deskripsi |
|--------|------|-----------|------------|-----------|
| GET | `/admin/user` | UserDirectoryController@index | `admin.user` | Direktori user |
| PATCH | `/admin/user/requests/{request}/approve` | UserDirectoryController@approveRequest | `admin.user.requests.approve` | Setujui role request |
| PATCH | `/admin/user/requests/{request}/reject` | UserDirectoryController@rejectRequest | `admin.user.requests.reject` | Tolak role request |
| PATCH | `/admin/user/users/{user}/status` | UserDirectoryController@updateUserStatus | `admin.user.users.status` | Aktifkan/nonaktifkan user |
| PATCH | `/admin/user/admins/{user}/permissions` | UserDirectoryController@updateAdminPermissions | `admin.user.admins.permissions` | **Super Admin only**: edit permission admin |

### Content Management (`content_admin` atau `super_admin`)

| Method | Path | Controller | Nama Route | Deskripsi |
|--------|------|-----------|------------|-----------|
| GET | `/admin/landing-page-settings` | LandingPageSettingController@index | `admin.landing-page-settings.index` | Kelola landing page |
| PATCH | `/admin/landing-page-settings` | LandingPageSettingController@update | `admin.landing-page-settings.update` | Update konten landing page |
| POST | `/admin/landing-page-settings/media` | LandingPageSettingController@uploadMedia | `admin.landing-page-settings.media.upload` | Upload media |

---

## Organization Routes

**Middleware**: `auth`, `role:organization`  
**Prefix**: `/organization`

| Method | Path | Nama Route | Deskripsi |
|--------|------|------------|-----------|
| GET | `/organization/dashboard` | `organization.dashboard` | Dashboard |
| GET | `/organization/partner` | `organization.partner` | Partner trainers |
| GET | `/organization/profile` | `organization.profile` | Profil organisasi |
| GET | `/organization/financial` | `organization.financial` | Keuangan |

---

## Catatan

- Semua route menggunakan metode HTTP yang tepat sesuai konvensi REST (GET untuk read, POST untuk create, PATCH untuk update parsial, DELETE untuk hapus)
- Route yang melibatkan upload file (payment proof, submission, thumbnail) harus mengirim request sebagai `multipart/form-data`
- Inertia.js menambahkan header `X-Inertia: true` di setiap XHR request — controller mengembalikan JSON jika header ini ada, HTML penuh jika tidak

---

## Dokumen Terkait

- [17 — API Reference](./17-api-reference.md) — Versi lebih lengkap dengan Inertia page, props, dan permission matrix
- [16 — Sequence Diagrams](./16-sequence-diagrams.md) — Interaksi timeline per route
- [19 — Developer Guide](./19-developer-guide.md) — Cara menambah route baru

