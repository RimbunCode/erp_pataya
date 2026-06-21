# Database ER Diagrams — Per Modul

Dokumen ini berisi Entity Relationship Diagram (ERD) yang dipecah per modul untuk kemudahan pembacaan. Untuk dokumentasi schema lengkap per tabel, lihat [`03-database.md`](./03-database.md).

> **Konvensi:** Semua tabel menggunakan **ULID** sebagai Primary Key, dan tabel kritis menggunakan **Soft Delete** (`deleted_at`).

---

## Daftar Isi

1. [User & Authentication Module](#1-user-authentication-module)
2. [Course & Content Module](#2-course-content-module)
3. [Enrollment & Payment Module](#3-enrollment-payment-module)
4. [Finance & Payout Module](#4-finance-payout-module)
5. [Learning & Progress Module](#5-learning-progress-module)
6. [Content Management (Files) Module](#6-content-management-files-module)
7. [Full System ERD](#7-full-system-erd)

---

## 1. User & Authentication Module

ERD ini mencakup semua tabel yang berhubungan dengan user, role, permission, dan profil.

```mermaid
erDiagram
    users {
        string id PK "ULID"
        string name "NOT NULL"
        string username "nullable, unique"
        string email "unique"
        timestamp email_verified_at "nullable"
        string password "nullable (invited)"
        string image "nullable, File ID"
        string status "pending|active|inactive"
        text inactive_reason "nullable"
        string inactive_by "FK users, nullable"
        timestamp inactive_at "nullable"
        string gender "male|female, nullable"
        date birthdate "nullable"
        string phone "nullable, max 20"
        timestamp deleted_at "nullable"
    }

    roles {
        string id PK "ULID"
        string name "unique: student|instructor|organization|admin"
        text description "nullable"
        boolean is_disabled "default false"
        timestamp deleted_at "nullable"
    }

    user_role {
        string user_id FK "users.id, cascade"
        string role_id FK "roles.id, cascade"
    }

    permissions {
        string id PK "ULID"
        string module "nama modul"
        string name "super_admin|finance_admin|..."
        text model "model yang dilindungi"
        string route "nullable"
        json permissions "array aksi"
    }

    admin_user_permissions {
        string user_id FK "users.id, cascade"
        string permission_id FK "permissions.id, cascade"
        timestamp deleted_at "nullable, soft unique"
    }

    user_providers {
        string id PK "ULID"
        string user_id FK "users.id"
        string provider "google"
        string provider_id "ID dari provider"
        string avatar_url "nullable"
        string token "OAuth token"
        string refresh_token "nullable"
        timestamp token_expired_at "nullable"
    }

    role_requests {
        string id PK "ULID"
        string user_id FK "users.id, cascade"
        string requested_role "instructor|organization"
        text reason "alasan pengajuan"
        string proof_file_id FK "files.id"
        string status "pending|approved|rejected"
        string reviewed_by "FK users, nullable"
        timestamp reviewed_at "nullable"
        text rejection_reason "nullable"
        timestamp deleted_at "nullable"
    }

    student_profiles {
        string user_id FK "users.id, unique"
        string institution "nullable"
        string student_id_number "nullable"
        text bio "nullable"
        json socials "nullable"
    }

    instructor_profiles {
        string user_id FK "users.id, unique"
        string bank_name "nullable"
        string bank_account_number "nullable"
        string professional_title "nullable"
        string expertise "nullable"
        text bio "nullable"
        json socials "nullable"
    }

    users }o--o{ roles : "user_role pivot"
    users ||--o{ admin_user_permissions : "admin permissions"
    permissions ||--o{ admin_user_permissions : "per user"
    users ||--o{ user_providers : "OAuth accounts"
    users ||--o{ role_requests : "mengajukan role"
    users ||--o| student_profiles : "1 profil student"
    users ||--o| instructor_profiles : "1 profil instructor"
    users ||--o{ role_requests : "di-review oleh admin"
```

**Relasi penting:**
- User bisa punya banyak role (many-to-many via `user_role`)
- Setiap user punya maksimal 1 `student_profile` dan 1 `instructor_profile`
- Admin user punya permission khusus via `admin_user_permissions` pivot

---

## 2. Course & Content Module

ERD ini mencakup course, kategori, section, content, dan publish request.

```mermaid
erDiagram
    courses {
        string id PK "ULID"
        string created_by FK "users.id, cascade"
        string title "NOT NULL"
        text description "nullable"
        string thumbnail "nullable, File ID"
        decimal price "12,2, default 0"
        string discount_type "percentage|amount"
        decimal discount "12,2, default 0"
        boolean is_published "default false"
        string level "beginner|intermediate|advanced"
        string language "default id"
        string certificate_type "professional|competency|attendance"
        integer total_hours "default 0"
        integer total_sessions "default 0"
        timestamp deleted_at "nullable"
    }

    categories {
        string id PK "ULID"
        string name "NOT NULL"
        string slug "unique"
    }

    course_category {
        string course_id FK "courses.id, cascade"
        string category_id FK "categories.id, cascade"
    }

    course_sections {
        string id PK "ULID"
        string course_id FK "courses.id, cascade"
        string title "NOT NULL"
        integer order "default 0"
    }

    course_contents {
        string id PK "ULID"
        string section_id FK "course_sections.id, cascade"
        string title "NOT NULL"
        string type "material|assignment|pre_assessment"
        text description "nullable"
        string url "nullable"
        datetime deadline "nullable"
        boolean is_optional "default false"
        boolean is_required "default true"
        integer order "default 0"
    }

    course_notes {
        string id PK "ULID"
        string section_id FK "course_sections.id"
        text content "isi catatan"
    }

    course_publish_requests {
        string id PK "ULID"
        string course_id FK "courses.id, cascade"
        string requested_by FK "users.id, cascade"
        string status "pending|approved|rejected"
        string reviewed_by FK "users.id, nullable"
        timestamp reviewed_at "nullable"
        text rejection_reason "nullable"
        decimal submitted_price "12,2"
        decimal submitted_discount "12,2"
        string submitted_discount_type "percentage|amount"
    }

    courses ||--o{ course_sections : "memiliki sections"
    courses }o--o{ categories : "course_category pivot"
    courses ||--o{ course_publish_requests : "riwayat publish"
    course_sections ||--o{ course_contents : "memiliki contents"
    course_sections ||--o{ course_notes : "catatan section"
    courses }o--|| users : "created_by (instruktur)"
```

**Relasi penting:**
- Course dibuat oleh instruktur (`created_by` → `users.id`)
- Course punya banyak section, setiap section punya banyak content
- Content bertipe `assignment` atau `pre_assessment` memiliki deadline
- Publish request menyimpan snapshot harga saat submit

---

## 3. Enrollment & Payment Module

ERD ini mencakup pendaftaran kursus dan pembayaran.

```mermaid
erDiagram
    users {
        string id PK
        string name
        string email
    }

    courses {
        string id PK
        string title
        decimal price
        boolean is_published
    }

    enrollments {
        string id PK "ULID"
        string user_id FK "users.id, cascade"
        string course_id FK "courses.id, cascade"
        string payment_id FK "payments.id, nullOnDelete"
        string status "pending|active|rejected"
        timestamp enrolled_at "useCurrent"
    }

    payments {
        string id PK "ULID"
        string user_id FK "users.id, cascade"
        string course_id FK "courses.id, cascade"
        decimal amount "12,2"
        string payment_method "tf|va|qris"
        string status "pending|approved|rejected"
        string proof_image "nullable, path"
        string notes "nullable"
        text rejection_reason "nullable"
        timestamp paid_at "nullable"
        timestamp verified_at "nullable"
        string verified_by FK "users.id, nullable"
        timestamp deleted_at "nullable"
    }

    carts {
        string id PK "ULID"
        string user_id FK "users.id, cascade"
        string course_id FK "courses.id, cascade"
    }

    users ||--o{ enrollments : "mendaftar kursus"
    users ||--o{ payments : "melakukan pembayaran"
    courses ||--o{ enrollments : "didaftari"
    courses ||--o{ payments : "dibayar"
    payments ||--o| enrollments : "mengaktifkan (1:1)"
    users ||--o{ carts : "keranjang belanja"
    courses ||--o{ carts : "di cart"
```

**Constraint penting:**
- `enrollments` UNIQUE `(user_id, course_id)` — satu enrollment per user per course
- `carts` UNIQUE `(user_id, course_id)` — tidak duplikat di cart
- `payments` memiliki soft delete — riwayat pembayaran selalu dijaga
- Saat payment di-approve, enrollment berubah ke `active`

---

## 4. Finance & Payout Module

ERD ini mencakup earning instruktur dan sistem payout.

```mermaid
erDiagram
    users {
        string id PK
        string name
    }

    payments {
        string id PK
        decimal amount
        timestamp verified_at
    }

    courses {
        string id PK
        string title
    }

    instructor_earnings {
        string id PK "ULID"
        string instructor_id FK "users.id, cascade"
        string payment_id FK "payments.id, unique"
        string course_id FK "courses.id, nullable"
        decimal gross_amount "12,2"
        decimal company_amount "12,2, default 0"
        decimal instructor_amount "12,2"
        timestamp available_at "nullable"
        timestamp released_at "nullable"
        timestamp deleted_at "nullable"
    }

    instructor_payout_requests {
        string id PK "ULID"
        string instructor_id FK "users.id, cascade"
        string requested_by FK "users.id, nullable"
        string approved_by FK "users.id, nullable"
        string paid_by FK "users.id, nullable"
        decimal requested_amount "12,2"
        decimal approved_amount "12,2, nullable"
        string status "draft|pending|approved|rejected|paid"
        string source "manual|batch"
        text note "nullable"
        text rejection_reason "nullable"
        string transfer_reference "nullable"
        string proof_file_path "nullable"
        timestamp requested_at "nullable"
        timestamp approved_at "nullable"
        timestamp paid_at "nullable"
        timestamp deleted_at "nullable"
    }

    instructor_payout_request_items {
        string payout_request_id FK "payout_requests.id"
        string earning_id FK "earnings.id"
        decimal amount "jumlah dari earning"
    }

    users ||--o{ instructor_earnings : "menerima earning"
    payments ||--o| instructor_earnings : "1 earning per payment"
    courses ||--o{ instructor_earnings : "dari course mana"
    users ||--o{ instructor_payout_requests : "mengajukan payout"
    instructor_earnings }o--o{ instructor_payout_requests : "via items pivot"
    instructor_payout_requests ||--o{ instructor_payout_request_items : "detail earning"
    instructor_earnings ||--o{ instructor_payout_request_items : "earning di-include"
```

**Relasi penting:**
- Satu payment menghasilkan maksimal satu earning (`payment_id` unique)
- Payout request bisa berisi banyak earning via `instructor_payout_request_items`
- `available_at` menentukan kapan earning bisa ditarik
- `released_at` di-set saat payout sudah dibayarkan penuh

---

## 5. Learning & Progress Module

ERD ini mencakup progress tracking dan submission.

```mermaid
erDiagram
    users {
        string id PK
        string name
    }

    course_contents {
        string id PK
        string section_id
        string title
        string type "material|assignment|pre_assessment"
        datetime deadline "nullable"
    }

    enrollments {
        string id PK
        string user_id
        string course_id
        string status
    }

    user_progress {
        string id PK "ULID"
        string user_id FK "users.id, cascade"
        string content_id FK "course_contents.id, cascade"
        boolean is_completed "default false"
        timestamp completed_at "nullable"
    }

    submissions {
        string id PK "ULID"
        string user_id FK "users.id, cascade"
        string content_id FK "course_contents.id, cascade"
        text notes "nullable"
        string status "submitted|graded"
        integer grade "nullable, 0-100"
        text feedback "nullable"
        timestamp submitted_at "useCurrent"
        timestamp graded_at "nullable"
    }

    users ||--o{ user_progress : "progress material"
    users ||--o{ submissions : "mengumpulkan tugas"
    course_contents ||--o{ user_progress : "dilacak per content"
    course_contents ||--o{ submissions : "dikumpulkan per content"
    users ||--o{ enrollments : "enrolled courses"
```

**Constraint penting:**
- `user_progress` UNIQUE `(user_id, content_id)` — satu progress record per content
- `submissions` UNIQUE `(user_id, content_id)` — satu submission per content
- `user_progress` hanya untuk content bertipe `material`
- `submissions` hanya untuk content bertipe `assignment` atau `pre_assessment`
- Progress dihitung dari **kedua tabel** oleh `CourseProgressService`

---

## 6. Content Management (Files) Module

ERD ini mencakup sistem file polymorphic.

```mermaid
erDiagram
    users {
        string id PK
    }

    files {
        string id PK "ULID"
        string path "path di storage"
        string original_name "nama file asli"
        string name "display name"
        string extension "ekstensi file"
        string mime_type "MIME type"
        integer size "bytes"
        boolean is_public "accessible tanpa auth"
        string created_by_id FK "users.id, nullable"
        timestamp deleted_at "nullable"
    }

    fileables {
        string file_id FK "files.id"
        string fileable_id "ID model pemilik"
        string fileable_type "Class name model"
        timestamp deleted_at "soft delete untuk unlink"
    }

    files ||--o{ fileables : "polymorphic relation"
    users ||--o{ files : "upload file"
```

**Model yang menggunakan file (polymorphic):**

| `fileable_type` | Model | Keterangan |
|-----------------|-------|------------|
| `App\Models\Submission` | Submission | File tugas student |
| `App\Models\Course` | Course | Thumbnail course |
| `App\Models\CourseContentFile` | CourseContentFile | File materi course |
| `App\Models\RoleRequest` | RoleRequest | Bukti pendukung |

**Pattern:** Soft delete pada `fileables` untuk unlink file dari model (bukan menghapus file). File baru benar-benar dihapus jika tidak ada referensi tersisa.

---

## 7. Full System ERD

Diagram lengkap yang menunjukkan semua relasi antar modul.

```mermaid
erDiagram
    users ||--o{ courses : "created_by (instruktur)"
    users }o--o{ roles : "user_role pivot"
    users ||--o{ enrollments : "mendaftar"
    users ||--o{ payments : "membayar"
    users ||--o{ instructor_earnings : "menerima"
    users ||--o{ instructor_payout_requests : "mengajukan"
    users ||--o{ submissions : "mengumpulkan"
    users ||--o{ user_progress : "mencatat progress"
    users ||--o{ role_requests : "mengajukan role"
    users ||--o{ carts : "keranjang"
    users ||--o| student_profiles : "profil student"
    users ||--o| instructor_profiles : "profil instructor"
    users ||--o{ admin_user_permissions : "admin permissions"
    users ||--o{ user_providers : "OAuth"
    users ||--o{ files : "upload file"

    courses ||--o{ course_sections : "sections"
    courses ||--o{ course_publish_requests : "publish requests"
    courses }o--o{ categories : "course_category pivot"
    courses ||--o{ enrollments : "didaftari"
    courses ||--o{ payments : "dibayar"
    courses ||--o{ instructor_earnings : "sumber earning"

    course_sections ||--o{ course_contents : "contents"
    course_sections ||--o{ course_notes : "notes"

    course_contents ||--o{ submissions : "submission"
    course_contents ||--o{ user_progress : "progress"

    payments ||--o| enrollments : "mengaktifkan"
    payments ||--o| instructor_earnings : "menghasilkan"

    instructor_earnings }o--o{ instructor_payout_request_items : "dalam payout"
    instructor_payout_requests ||--o{ instructor_payout_request_items : "detail"

    permissions ||--o{ admin_user_permissions : "diberikan"
    roles }o--o{ role_requests : "target role"

    files ||--o{ fileables : "polymorphic"
```

---

## Tabel Soft Delete

Tabel-tabel berikut menggunakan soft delete (`deleted_at`):

| Tabel | Alasan |
|-------|--------|
| `users` | Data user tidak dihapus permanen |
| `courses` | Kursus bisa di-restore |
| `payments` | Riwayat pembayaran dijaga |
| `instructor_earnings` | Riwayat keuangan |
| `instructor_payout_requests` | Riwayat payout |
| `role_requests` | Riwayat pengajuan role |
| `course_publish_requests` | Riwayat approval kursus |
| `files` | File tidak dihapus jika masih ada referensi |
| `roles` | Role kustom |
| `permissions` | Permission kustom |
| `fileables` | Unlink file tanpa hapus fisik |
| `admin_user_permissions` | Revoke tanpa hapus riwayat |
