# Feature Flows — Diagram Alur Fitur

Dokumen ini berisi diagram aktivitas (flowchart) dan diagram sequence untuk setiap fitur utama dalam sistem ERP Inkindo. Setiap diagram menggambarkan alur langkah demi langkah dari perspektif pengguna dan sistem.

---

## Daftar Isi

1. [Course Management (Instruktur)](#1-course-management-instruktur)
2. [Course Discovery & Enrollment (Student)](#2-course-discovery-enrollment-student)
3. [Learning & Progress (Student)](#3-learning-progress-student)
4. [Grading & Student Management (Instruktur)](#4-grading-student-management-instruktur)
5. [Payment Verification (Admin)](#5-payment-verification-admin)
6. [Payout Pipeline (Lengkap)](#6-payout-pipeline-lengkap)
7. [Course Approval Workflow (Admin)](#7-course-approval-workflow-admin)
8. [Role Request Workflow](#8-role-request-workflow)
9. [Multi-Role Login & Switching](#9-multi-role-login-switching)
10. [User Registration & Onboarding](#10-user-registration-onboarding)
11. [Cart & Checkout System](#11-cart-checkout-system)
12. [Financial Configuration (Admin)](#12-financial-configuration-admin)
13. [Landing Page Management (Admin)](#13-landing-page-management-admin)
14. [User Management (Admin)](#14-user-management-admin)

---

## 1. Course Management (Instruktur)

### 1.1 Pembuatan Course

```mermaid
flowchart TD
    A([Buka /instructor/classes]) --> B[Klik Buat Course Baru]
    B --> C[Isi form: title, description,\nprice, discount, level, category,\ntotal_hours, certificate_type]
    C --> D{Upload thumbnail?}
    D -->|Ya| E[Upload gambar via File::uploadFile\nis_public = true]
    D -->|Tidak| F[thumbnail = null]
    E --> G[Course::create\nis_published = false\ncreated_by = auth user]
    F --> G
    G --> H[Attach category via pivot]
    H --> I{Tambahan sections\ndalam form?}
    I -->|Ya| J[Loop: create section + contents\norder otomatis dari index]
    I -->|Tidak| K[Redirect ke CourseDetail]
    J --> K
```

### 1.2 Update Course (Termasuk Perubahan Harga)

```mermaid
flowchart TD
    A([Buka CourseDetail]) --> B[Edit form course]
    B --> C[PATCH /instructor/classes/course]
    C --> D{Harga/diskon berubah?}
    D -->|Tidak| E[Update data course langsung]
    D -->|Ya| F{Course sudah published?}
    F -->|Tidak| E
    F -->|Ya| G{Ada pending\npublish request?}
    G -->|Ya| H[Error: masih ada request pending]
    G -->|Tidak| I[Update course tapi\nharga lama tetap di katalog]
    I --> J[Buat CoursePublishRequest\nstatus = pending\nsnapshot harga baru disimpan]
    E --> K[Sync category jika diubah]
    J --> K
    K --> L[Redirect ke CourseDetail]
```

### 1.3 Section Management

```mermaid
flowchart TD
    A([Buka CourseDetail]) --> B[Tambah Section]
    B --> C[POST /classes/course/sections\ntitle + order auto]
    C --> D[Section muncul di UI]

    A --> E[Edit Section]
    E --> F[PATCH /classes/sections/section\nubah title]
    F --> G[UI terupdate]

    A --> H[Hapus Section]
    H --> I[DELETE /classes/sections/section\ncascade ke contents]
    I --> J[Section hilang dari UI]
```

### 1.4 Content Management (Upload File & Materi)

```mermaid
flowchart TD
    A([Pilih Section]) --> B[Tambah Content]
    B --> C[POST /sections/section/contents\ntitle, type, description, url, deadline]
    C --> D[Content dibuat dengan order]

    A --> E[Upload file ke content]
    E --> F[POST /contents/content/upload\nmultipart file]
    F --> G[File disimpan di storage\nFileable di-link ke CourseContentFile]

    A --> H[Hapus file dari content]
    H --> I[DELETE /contents/content/files/file\nsoft delete fileable]
    I --> J[File unlink dari content]

    A --> K[Edit/Hapus Content]
    K --> L[PATCH/DELETE /contents/content]
    L --> M[UI terupdate]
```

### 1.5 Toggle Publish / Submit Publish Request

```mermaid
flowchart TD
    A([Instruktur klik Toggle Publish]) --> B{Course sudah published?}
    B -->|Ya| C[is_published = false\nCourse di-unpublish]
    B -->|Tidak| D{Ada pending\npublish request?}
    D -->|Ya| E[Error: masih ada request pending]
    D -->|Tidak| F{Request terakhir rejected\ndan course belum diupdate?}
    F -->|Ya| G[Error: update course dulu\nsebelum submit ulang]
    F -->|Tidak| H[Buat CoursePublishRequest\nstatus = pending\nsubmitted_price, submitted_discount,\nsubmitted_discount_type disimpan]
    H --> I[Menunggu review admin]
```

---

## 2. Course Discovery & Enrollment (Student)

### 2.1 Browse Katalog Course

```mermaid
flowchart TD
    A([Student buka /student/course-catalogue]) --> B[Query courses\nis_published = true\nexclude enrolled]
    B --> C[Map data: title, price, level,\ninstructor, categories, thumbnail,\ninCart status]
    C --> D[Load cartCourses untuk\npanel keranjang]
    D --> E[Tampilkan CourseCatalogue page]
```

### 2.2 Preview Course

```mermaid
flowchart TD
    A([Klik course di katalog]) --> B[Buka /student/course-preview/course]
    B --> C[Load sections + contents\n+ categories + creator]
    C --> D{User sudah enrolled?}
    D -->|Ya| E[Tampilkan status enrollment\n+ rejection reason jika ada]
    D -->|Tidak| F[Tampilkan tombol\nAdd to Cart / Enroll]
    E --> G[Render CoursePreview page]
    F --> G
```

### 2.3 Add to Cart

```mermaid
flowchart TD
    A([Klik Add to Cart]) --> B[POST /student/cart\ncourse_id]
    B --> C{Course sudah di cart?}
    C -->|Ya| D[firstOrCreate: skip\ntidak duplikat]
    C -->|Tidak| E[Cart::firstOrCreate\nuser_id + course_id]
    D --> F[Reload page\ncartCourses updated]
    E --> F
```

### 2.4 Checkout & Payment

```mermaid
flowchart TD
    A([Buka CartPanel]) --> B[Pilih courses yang mau dibeli]
    B --> C[Upload bukti bayar\njpg/jpeg/png/pdf maks 2MB]
    C --> D[Pilih payment method\ntf / va / qris]
    D --> E[Tambahkan notes opsional]
    E --> F[POST /student/enroll\ncourse_ids + payment_proof + method]
    F --> G[Store file ke storage/payment-proofs]
    G --> H[Loop per courseId]
    H --> I{Enrollment sudah ada?}
    I -->|Ya, active/pending| J[Error: sudah terdaftar]
    I -->|Tidak ada| K[Buat Payment pending\n+ Enrollment pending]
    I -->|Ada, rejected| L[Update enrollment\npayment_id baru, status pending]
    K --> M[Menunggu verifikasi admin]
    L --> M
```

---

## 3. Learning & Progress (Student)

### 3.1 Navigasi Konten Course

```mermaid
flowchart TD
    A([Buka /student/my-courses]) --> B[Pilih course aktif]
    B --> C[Lihat daftar sections]
    C --> D[Pilih section]
    D --> E[Lihat daftar contents\ndalam section]
    E --> F{Tipe content?}
    F -->|material| G[Tonton video / baca materi]
    F -->|assignment| H[Lihat instruksi tugas\n+ deadline]
    F -->|pre_assessment| I[Lihat pre-assessment]
```

### 3.2 Material Completion (Tandai Selesai)

```mermaid
flowchart TD
    A([Student klik Tandai Selesai]) --> B[POST /student/progress/content]
    B --> C{Content type = material?}
    C -->|Tidak| D[403 Forbidden]
    C -->|Ya| E[UserProgress::firstOrCreate\nuser_id + content_id\nis_completed = true\ncompleted_at = now]
    E --> F[Recalculate progress %]
    F --> G{Progress = 100%?}
    G -->|Ya| H[Enrollment status\npotensial COMPLETED]
    G -->|Tidak| I[Progress bar terupdate]
```

### 3.3 Assignment Submission

```mermaid
flowchart TD
    A([Student buka assignment]) --> B{Deadline sudah lewat?}
    B -->|Ya| C[Error: Deadline sudah lewat]
    B -->|Tidak| D[Upload file tugas\n+ catatan opsional]
    D --> E[POST /student/submissions/content]
    E --> F[Submission::updateOrCreate\nuser_id + content_id\nstatus = submitted]
    F --> G{Files via ID atau upload baru?}
    G -->|filesId| H[Link existing File ke Submission\nvia Fileable polymorphic]
    G -->|files upload| I[File::create + store\nFileable::create]
    H --> J[Submission tercatat\ndengan file terlampir]
    I --> J
    J --> K[Progress dihitung ulang\nsubmittedContentLookup updated]
```

### 3.4 Progress Calculation Formula

```mermaid
flowchart TD
    A[Mulai perhitungan]) --> B[Ambil semua contents\ndari semua sections course]
    B --> C[Hitung totalContents]
    C --> D[Untuk setiap content]
    D --> E{Tipe content?}
    E -->|material| F{Ada di completedContentLookup?\ndari UserProgress is_completed=true}
    E -->|assignment / pre_assessment| G{Ada di submittedContentLookup?\ndari Submission dengan files}
    F -->|Ya| H[completed++]
    F -->|Tidak| I[skip]
    G -->|Ya| H
    G -->|Tidak| I
    H --> J[progress = round\ncompleted / total * 100]
    I --> J
    J --> K[Clamp 0-100]
```

### 3.5 Course Completion Trigger

```mermaid
flowchart TD
    A[Progress mencapai 100%]) --> B[resolveStatusFromProgress\nreturn COMPLETED]
    B --> C[Student melihat course\nsebagai completed di MyCourses]
```

---

## 4. Grading & Student Management (Instruktur)

### 4.1 Lihat Daftar Student

```mermaid
flowchart TD
    A([Buka /instructor/students]) --> B[Query enrollments\nstatus = active, course.created_by = auth]
    B --> C[Load user, course.sections.contents]
    C --> D[Build completedLookup per user\n+ submittedLookup per user]
    D --> E[Hitung progress per student\ndengan CourseProgressService]
    E --> F[Build modules per section\ndone, completed_contents, total_contents]
    F --> G[Resolve lastActiveAt per student]
    G --> H[Render StudentManagement page\ndengan students + courses filter]
```

### 4.2 Review & Grading Submission

```mermaid
flowchart TD
    A([Pilih student]) --> B[Lihat detail submissions]
    B --> C[Pilih submission yang\nperlu dinilai]
    C --> D[Download file yang dikumpulkan]
    D --> E[Input grade 0-100\n+ feedback text]
    E --> F[PATCH /instructor/enrollments/enrollment\n/submissions/submission/grade]
    F --> G[Update submission:
status = graded
grade = nilai
feedback = catatan
graded_at = now]
    G --> H[Nilai muncul di\nMyCourses student]
```

---

## 5. Payment Verification (Admin)

### 5.1 Lihat Daftar Payments Pending

```mermaid
flowchart TD
    A([Admin buka /admin/finance]) --> B[Query semua payments\nwith user, course, verifier]
    B --> C[Group by user_id + course_id\nuntuk rejection history]
    C --> D[Map data: student, course,\namount, method, proof URL,\nstatus, rejection history]
    D --> E[Tampilkan daftar payments\ndi SystemFinance page]
```

### 5.2 Approve Payment

```mermaid
flowchart TD
    A([Klik Approve pada payment]) --> B{Status = pending?}
    B -->|Tidak| C[Error: sudah diproses]
    B -->|Ya| D[Load enrollment relasi]
    D --> E{Enrollment ada?}
    E -->|Tidak| F[Error: enrollment tidak ditemukan]
    E -->|Ya| G[DB Transaction]
    G --> H[Payment: status = approved\nverified_at = now\nverified_by = admin_id]
    H --> I[Enrollment: status = active\nenrolled_at = now]
    I --> J[createEarningFromApprovedPayment:
gross = payment.amount
company = gross * fee%
instructor = gross - company
available_at = now + delay_days]
    J --> K[Student bisa akses kursus]
```

### 5.3 Reject Payment

```mermaid
flowchart TD
    A([Klik Reject pada payment]) --> B[Input alasan penolakan\nrequired, maks 1000]
    B --> C{Status = pending?}
    C -->|Tidak| D[Error: sudah diproses]
    C -->|Ya| E[DB Transaction]
    E --> F[Payment: status = rejected\nrejection_reason = alasan\nverified_at, verified_by diisi]
    F --> G[Enrollment: status = rejected]
    G --> H[Student bisa re-upload\nbukti bayar baru]
```

---

## 6. Payout Pipeline (Lengkap)

### 6.1 Earning Creation (dari Approved Payment)

```mermaid
flowchart TD
    A[Payment di-approve]) --> B[Load course.creator = instructor]
    B --> C[Hitung:
grossAmount = payment.amount
companyFee = resolveCompanyFeePercentage
companyAmount = gross * fee / 100
instructorAmount = gross - company]
    C --> D[Hitung available_at:\nverified_at + payout_delay_days]
    D --> E[InstructorEarning::updateOrCreate\npayment_id sebagai unique key]
    E --> F[Earning tercatat\ntapi belum bisa ditarik]
```

### 6.2 Eligible Balance Calculation

```mermaid
flowchart TD
    A[Hitung balance available]) --> B[Query earnings:\navailable_at <= now\nreleased_at IS NULL]
    B --> C[Left join reserved amounts\ndari payout_request_items\nwhere status in draft,pending,approved,paid]
    C --> D[Per earning:\navailable = instructor_amount - reserved]
    D --> E[Filter: available > 0]
    E --> F[Sum semua available amounts\n= eligible balance]
```

### 6.3 Manual Payout Request (Instruktur)

```mermaid
flowchart TD
    A([Instruktur buka /instructor/financial]) --> B[Lihat available balance]
    B --> C{Balance > 0?}
    C -->|Tidak| D[Tidak bisa request]
    C -->|Ya| E[Input nominal + note]
    E --> F[POST /instructor/financial/payout-requests]
    F --> G{Nominal <= eligible balance?}
    G -->|Tidak| H[Error: melebihi saldo]
    G -->|Ya| I[DB Transaction]
    I --> J[Buat InstructorPayoutRequest\nstatus = pending, source = manual]
    J --> K[Loop eligible earnings:\ncreate PayoutRequestItem\ndengan amount dari earning]
    K --> L[remaining amount berkurang\nsampai 0]
    L --> M[Request menunggu review admin]
```

### 6.4 Batch Payout Generation (Admin)

```mermaid
flowchart TD
    A([Admin klik Run Batch]) --> B[POST /admin/finance/payouts/batch]
    B --> C[resolveBatchCandidateInstructorIds:\nsemua instructor dengan\nearning available_at <= now]
    C --> D[Loop per instructor]
    D --> E[Query eligible earnings]
    E --> F{Amount > 0?}
    F -->|Tidak| G[skipped++]
    F -->|Ya| H[DB Transaction:\nBuat PayoutRequest\nstatus = draft, source = batch\nrequested_by = admin]
    H --> I[Create PayoutRequestItem\nuntuk setiap earning\namount = full available]
    I --> J[created++]
    J --> K[Lanjut instructor berikutnya]
    G --> K
    K --> L[Return: created X, skipped Y]
```

### 6.5 Payout Approval & Payment Release

```mermaid
flowchart TD
    A([Admin review payout request]) --> B{Status draft/pending?}
    B -->|Tidak| C[Error: tidak bisa disetujui]
    B -->|Ya| D{Keputusan}
    D -->|Approve| E[status = approved\napproved_by, approved_at diisi\napproved_amount = requested_amount]
    D -->|Reject| F[status = rejected\nrejection_reason diisi\nearnings bebas kembali]

    E --> G([Admin transfer ke bank])
    G --> H[Upload bukti transfer\n+ transfer_reference]
    H --> I[PATCH mark as PAID]
    I --> J[DB Transaction:\nstatus = paid\npaid_by, paid_at diisi]
    J --> K[Check semua earnings terkait:\njika total paid >= instructor_amount\nreleased_at = now]
    K --> L[Earning ditandai released]
```

---

## 7. Course Approval Workflow (Admin)

### 7.1 Review & Approve Course

```mermaid
flowchart TD
    A([Admin buka /admin/approvals]) --> B[Lihat semua CoursePublishRequest\ndengan course, creator, reviewer]
    B --> C[Group by course_id\nuntuk rejection history]
    C --> D[Map data: title, instructor,\nsubmitted price/discount,\nfinal price calculation]
    D --> E{Keputusan}
    E -->|Approve| F[DB Transaction]
    F --> G[Request: status = approved\nreviewed_by, reviewed_at diisi]
    G --> H[Course: price = submitted_price\ndiscount = submitted_discount\ndiscount_type = submitted_discount_type\nis_published = true]
    H --> I[Course muncul di katalog student]
```

### 7.2 Reject Course

```mermaid
flowchart TD
    A([Admin klik Reject]) --> B[Input alasan penolakan]
    B --> C[DB Transaction]
    C --> D[Request: status = rejected\nreviewed_by, reviewed_at diisi\nrejection_reason = alasan]
    D --> E[Course: is_published tidak berubah]
    E --> F[Instruktur lihat rejection reason\ndi ManageClasses]
    F --> G[Instruktur revisi course\ndan submit ulang]
```

---

## 8. Role Request Workflow

### 8.1 Student Ajukan Jadi Instruktur

```mermaid
flowchart TD
    A([Student klik Ajukan Jadi Instruktur]) --> B[Isi alasan + upload bukti pendukung]
    B --> C[POST /student/instructor-requests]
    C --> D[RoleRequest::create\nrequested_role = instructor\nstatus = pending\nproof_file_id dari uploaded file]
    D --> E[Menunggu review admin]
```

### 8.2 Admin Review Role Request

```mermaid
flowchart TD
    A([Admin buka /admin/user tab Requests]) --> B[Lihat daftar role requests\nwith user, reviewer, proofFile]
    B --> C{Keputusan}
    C -->|Approve| D[DB Transaction]
    D --> E[userRoleManager.attachInstructorRole\nuser dapat role instructor]
    E --> F[RoleRequest: status = approved\nreviewed_by, reviewed_at diisi]
    F --> G[User bisa akses /instructor/*]

    C -->|Reject| H[Input alasan penolakan]
    H --> I[RoleRequest: status = rejected\nrejection_reason = alasan]
    I --> J[Student bisa request ulang]
```

---

## 9. Multi-Role Login & Switching

### 9.1 Login Flow dengan Role Detection

```mermaid
flowchart TD
    A([Buka /login]) --> B[Isi email + password]
    B --> C[POST /login/roles\nverify credentials]
    C --> D{Kredensial valid?}
    D -->|Tidak| E[Error: kredensial salah]
    D -->|Ya| F[Normalize roles dari user.roles]
    F --> G{Jumlah role?}
    G -->|0 role| H[Logout + Error: no role access]
    G -->|1 role| I[Return auto_role]
    G -->|2+ roles| J[Return requires_selection = true\n+ daftar roles]
    I --> K[POST /login dengan preferred_role]
    J --> L[Tampilkan halaman SelectRole]
    L --> M[User pilih role]
    M --> K
    K --> N[Auth::login + session regenerate]
    N --> O[Set cookie last_active_role]
    O --> P[Redirect ke dashboard role terpilih]
```

### 9.2 Role Switching Tanpa Logout

```mermaid
flowchart TD
    A([User klik role lain di UI]) --> B[Navigate ke /role/path]
    B --> C{User punya role ini?}
    C -->|Tidak| D[403 Forbidden]
    C -->|Ya| E[Redirect ke dashboard role\n+ set cookie last_active_role]
    E --> F[UI load dashboard baru\ntanpa logout/re-login]
```

### 9.3 Google OAuth Flow

```mermaid
flowchart TD
    A([Klik Login with Google]) --> B[Redirect ke Google OAuth]
    B --> C[Google callback ke /auth/google/callback]
    C --> D{User sudah login?}
    D -->|Ya| E[Link provider ke akun existing\nupdateOrCreate UserProvider]
    D -->|Tidak| F{Provider sudah pernah di-link?}
    F -->|Ya| G[Login via provider existing]
    F -->|Tidak| H{Email ada di DB?}
    H -->|Ya| I[Link ke user existing]
    H -->|Tidak| J[Buat user baru\nstatus = pre_registered\nemail_verified_at = now]
    J --> K[Create UserProvider]
    I --> K
    G --> L[ensureStudentRole]
    K --> L
    L --> M{Status user?}
    M -->|inactive| N[Error: akun nonaktif]
    M -->|pre_registered / invited| O[Redirect ke /setup]
    M -->|active| P[Login + redirect ke dashboard]
```

---

## 10. User Registration & Onboarding

### 10.1 Registrasi Normal

```mermaid
flowchart TD
    A([Buka /register]) --> B[Isi: name, username, email,\nphone, password, gender, birthdate]
    B --> C{Email sudah di DB?}
    C -->|Ya, status = invited| D[Update user existing\nset password, name, dll\nstatus = active]
    C -->|Ya, bukan invited| E[Error: Email already exists]
    C -->|Tidak ada| F[User::create\nstatus = active\npassword = hash]
    D --> G{Request role instructor?}
    F --> G
    G -->|Ya| H[Attach role student + instructor]
    G -->|Tidak| I[Attach role student saja]
    H --> J[Auth::login]
    I --> J
    J --> K{2+ role?}
    K -->|Ya| L[Redirect ke /select-role]
    K -->|Tidak| M[Redirect ke /student/dashboard]
```

### 10.2 Setup User (Invited / OAuth)

```mermaid
flowchart TD
    A([Redirect ke /setup]) --> B{Status user?}
    B -->|active| C[Redirect ke dashboard]
    B -->|pre_registered / invited| D[Tampilkan form setup]
    D --> E[Isi: name, password,\nprofile data]
    E --> F{User ingin role instructor?}
    F -->|Ya| G[Attach instructor role]
    F -->|Tidak| H[Ensure student role saja]
    G --> I[Save data]
    H --> I
    I --> J{Status invited + has password\n+ has branch?}
    J -->|Ya| K[status = active]
    J -->|Tidak| L[status tetap sama]
    K --> M[Redirect ke dashboard]
    L --> M
```

---

## 11. Cart & Checkout System

### 11.1 Cart Panel Flow

```mermaid
flowchart TD
    A([Student klik icon cart]) --> B[Buka CartPanel sidebar]
    B --> C[Load cartCourses\ndari Cart where user_id]
    C --> D[Tampilkan daftar course di cart\ndengan harga + instructor]
    D --> E{Aksi student}
    E -->|Hapus course| F[DELETE /student/cart/courseId]
    F --> G[Cart dihapus\ncartCourses reload]
    E -->|Checkout| H[Pilih courses yang mau dibeli]
    H --> I[Upload bukti bayar]
    I --> J[Pilih payment method]
    J --> K[Submit enrollment\nlihat flow 2.4]
```

### 11.2 Payment Method Options

```mermaid
flowchart LR
    A[Payment Method] --> B[tf = Bank Transfer]
    A --> C[va = Virtual Account]
    A --> D[qris = QRIS]
```

---

## 12. Financial Configuration (Admin)

### 12.1 Company Fee Percentage

```mermaid
flowchart TD
    A([Admin buka /admin/finance tab Settings]) --> B[Lihat company_fee_percentage saat ini]
    B --> C[Input persentase baru 0-100]
    C --> D[PATCH /admin/finance/settings/company-fee]
    D --> E[Normalize: min 0, max 100, round 2 desimal]
    E --> F[Preference::updateOrCreate\nkey = company_fee_percentage]
    F --> G[Setting baru berlaku untuk\nearning yang dibuat SETELAH perubahan\ntidak retroaktif]
```

### 12.2 Payout Delay Days

```mermaid
flowchart TD
    A([Admin buka tab Settings]) --> B[Lihat payout_delay_days saat ini]
    B --> C[Input jumlah hari delay >= 0]
    C --> D[PATCH /admin/finance/settings/payout-delay]
    D --> E[Preference::updateOrCreate\nkey = payout_delay_days]
    E --> F[Delay baru berlaku untuk\nearning yang dibuat SETELAH perubahan]
```

---

## 13. Landing Page Management (Admin)

### 13.1 Content Settings

```mermaid
flowchart TD
    A([Admin buka /admin/landing-page-settings]) --> B[Load settings dari Preferences\nhero, about, features, testimonial, dll]
    B --> C[Edit konten per section]
    C --> D{Upload media?}
    D -->|Ya| E[POST /admin/landing-page-settings/media\nstore ke storage]
    D -->|Tidak| F[Edit text saja]
    E --> G[PATCH /admin/landing-page-settings\nsave all settings]
    F --> G
    G --> H[Guest pages pull dari\nGuestPageContentService]
```

---

## 14. User Management (Admin)

### 14.1 User Directory

```mermaid
flowchart TD
    A([Admin buka /admin/user]) --> B[Query semua users\nwith roles, inactiveByUser]
    B --> C[Transform via UserTransformer:\nname, email, roles, status,\ninactive info]
    C --> D[Load role requests\nwhere requested_role = instructor]
    D --> E[Load admin users\nwith permissions]
    E --> F[Render UserDirectory page\ntabs: Users, Requests, Admins]
```

### 14.2 User Status Management

```mermaid
flowchart TD
    A([Admin klik toggle status user]) --> B{Status target?}
    B -->|inactive| C[Input alasan deaktivasi]
    C --> D[Update user:
status = inactive
inactive_reason = alasan
inactive_by = admin_id
inactive_at = now]
    B -->|active| E[Update user:\nstatus = active\nclear inactive_reason/by/at]
    D --> F[User tidak bisa login\njika inactive]
    E --> G[User bisa login kembali]
```

### 14.3 Admin Permission Management

```mermaid
flowchart TD
    A([Tab Admins - hanya super_admin]) --> B[Pilih admin user]
    B --> C[Pilih permissions:\nfinance_admin, course_admin,\nuser_admin, content_admin]
    C --> D[PATCH /admin/user/admins/user/permissions]
    D --> E[AdminPermissionService.syncAdminPermissions]
    E --> F{Actor = super_admin?}
    F -->|Tidak| G[Error: tidak punya akses]
    F -->|Ya| H[Sync admin_user_permissions pivot\nsoft delete untuk revoke]
    H --> I[Admin bisa akses route\nsesuai permission yang diberikan]
```

### 14.4 Last Super Admin Protection

```mermaid
flowchart TD
    A([Super_admin ingin menghapus\npermission super_admin sendiri]) --> B[AdminPermissionService check]
    B --> C{Ini super_admin terakhir?}
    C -->|Ya| D[Error: tidak bisa menghapus\nsuper_admin terakhir]
    C -->|Tidak| E[Izinkan perubahan]
```
