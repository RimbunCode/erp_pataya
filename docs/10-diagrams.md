# Semua Diagram (Ringkas)

Halaman ini mengumpulkan diagram ringkas sistem dalam satu tempat untuk referensi cepat. Semua diagram menggunakan format **Mermaid** yang render otomatis di GitHub.

> **Untuk versi lebih detail:** Lihat [`13-feature-flows.md`](./13-feature-flows.md) (flowchart fitur), [`14-state-machines.md`](./14-state-machines.md) (state machine detail), [`15-database-erd.md`](./15-database-erd.md) (ERD per modul), [`16-sequence-diagrams.md`](./16-sequence-diagrams.md) (sequence diagram), [`12-system-architecture.md`](./12-system-architecture.md) (arsitektur teknis).

---

## 1. Arsitektur Sistem

```mermaid
graph TB
    Browser["Browser\n(React 19 + Tailwind CSS)"]
    Inertia["Inertia.js Protocol"]
    Laravel["Laravel 12\nControllers → Services → Models"]
    MySQL["MySQL 8.0"]

    Browser <-->|"XHR / HTML"| Inertia
    Inertia <-->|"PHP"| Laravel
    Laravel <-->|"Eloquent ORM"| MySQL

    subgraph Backend ["Backend (Server)"]
        MW["Middleware\nauth · role · admin.permission"]
        CTL["Controllers\nAdmin / Instructor / Student"]
        SVC["Services\nPayoutService · ProgressService · ..."]
        MDL["Models\nEloquent + ULID + SoftDelete"]
        MW --> CTL --> SVC --> MDL
    end
```

---

## 2. ERD Ringkas

```mermaid
erDiagram
    users ||--o{ courses : "created_by"
    users }o--o{ roles : "user_role pivot"
    users ||--o{ enrollments : ""
    users ||--o{ payments : ""
    users ||--o{ instructor_earnings : ""
    users ||--o{ submissions : ""

    courses ||--o{ course_sections : ""
    courses ||--o{ enrollments : ""
    courses }o--o{ categories : "course_category pivot"

    course_sections ||--o{ course_contents : ""
    course_contents ||--o{ submissions : ""
    course_contents ||--o{ user_progress : ""

    payments ||--o| enrollments : "activates"
    payments ||--o| instructor_earnings : "generates"
    instructor_earnings }o--o{ instructor_payout_requests : "items pivot"
```

---

## 3. Activity: Registrasi User

```mermaid
flowchart TD
    A([Buka /auth/register]) --> B[Isi name, email, password]
    B --> C{Email di DB?}
    C -->|status=INVITED| D[Update user existing]
    C -->|Tidak ada| E[Buat user baru\nstatus=pending]
    C -->|Sudah aktif| F[Error: Email sudah terdaftar]
    D --> G[Attach role student]
    E --> G
    G --> H[Login otomatis]
    H --> I{2+ role?}
    I -->|Ya| J[/auth/select-role]
    I -->|Tidak| K[/student/dashboard]
```

---

## 4. Activity: Login & Pemilihan Role

```mermaid
flowchart TD
    A([Buka /auth/login]) --> B[Isi email + password]
    B --> C{Rate limit ok?\nmaks 5x/menit}
    C -->|Limit tercapai| D[Error: Coba lagi 1 menit]
    C -->|OK| E{Kredensial valid?}
    E -->|Tidak| F[Error: Kredensial salah]
    E -->|Ya| G{Status user?}
    G -->|inactive| H[Error: Akun nonaktif + alasan]
    G -->|active/pending| I[Login berhasil]
    I --> J{2+ role?}
    J -->|Ya| K[Tampilkan pilihan role]
    K --> L[User pilih role]
    L --> M[Set cookie last_active_role]
    M --> N[Redirect ke dashboard role]
    J -->|Tidak| M
```

---

## 5. Activity: Enrollment & Payment

```mermaid
flowchart TD
    A([Browse katalog]) --> B[Tambah ke cart]
    B --> C[Buka CartPanel]
    C --> D[Upload bukti bayar + pilih metode]
    D --> E[Submit checkout]
    E --> F[Buat Payment pending\n+ Enrollment pending]
    F --> G([Admin review])
    G --> H{Keputusan admin}
    H -->|Approve| I[Payment approved\nEnrollment active]
    I --> J[Buat InstructorEarning\ncalculate fee]
    J --> K[Student akses kursus]
    H -->|Reject| L[Payment rejected\nEnrollment rejected]
    L --> M[Student re-upload bukti]
    M --> G
```

---

## 6. State Machine: Course Status

```mermaid
stateDiagram-v2
    [*] --> DRAFT : Kursus dibuat
    DRAFT --> PENDING : Submit publish request
    PENDING --> PUBLISHED : Admin approve
    PENDING --> REJECTED : Admin reject
    REJECTED --> DRAFT : Instruktur revisi
    DRAFT --> PENDING : Submit ulang
    PUBLISHED --> DRAFT : Instruktur unpublish
    PUBLISHED --> PENDING : Update harga\n(trigger review ulang)
```

---

## 7. Activity: Course Approval (Admin)

```mermaid
flowchart TD
    A([Admin buka /admin/approvals]) --> B[Lihat pending requests]
    B --> C[Review detail kursus]
    C --> D{Keputusan}
    D -->|Approve| E[is_published = true\nharga dari submitted_price]
    D -->|Reject| F[Isi rejection_reason\nis_published tidak berubah]
    E --> G[Kursus muncul di katalog]
    F --> H[Instruktur revisi ulang]
```

---

## 8. Activity: Student Belajar & Progress

```mermaid
flowchart TD
    A([Buka konten kursus]) --> B{Tipe konten}
    B -->|material| C[Tonton video / baca materi]
    C --> D[Klik Tandai Selesai]
    D --> E[UserProgress.is_completed = true]
    B -->|assignment| F[Upload file tugas]
    F --> G[Buat Submission\nstatus=submitted]
    E --> H[Hitung ulang progress %]
    G --> H
    H --> I{Progress = 100%?}
    I -->|Ya| J[Enrollment = COMPLETED]
    I -->|Tidak| K[Tampilkan progress bar terbaru]
```

---

## 9. Activity: Grading oleh Instruktur

```mermaid
flowchart TD
    A([Buka /instructor/students]) --> B[Pilih kursus]
    B --> C[Pilih student]
    C --> D[Lihat daftar submissions]
    D --> E[Buka submission yang belum dinilai]
    E --> F[Download file yang dikumpulkan]
    F --> G[Input grade 0-100 + feedback]
    G --> H[PATCH .../grade]
    H --> I[Submission status = graded\ngraded_at diisi]
    I --> J[Nilai tampil di MyCourses student]
```

---

## 10. Activity: Payment Verification (Admin)

```mermaid
flowchart TD
    A([Admin buka /admin/finance]) --> B[Daftar payments pending]
    B --> C[Buka detail payment]
    C --> D[Lihat bukti bayar yang diupload]
    D --> E{Keputusan}
    E -->|Approve| F[Payment approved\nverified_at diisi]
    F --> G[Enrollment = active]
    G --> H[Buat InstructorEarning\ngross, company, instructor amounts\navailable_at = now + delay_days]
    E -->|Reject| I[Isi rejection_reason\nPayment = rejected\nEnrollment = rejected]
```

---

## 11. Activity: Payout Request & Release

```mermaid
flowchart TD
    A([Instruktur lihat balance available]) --> B{Balance > 0?}
    B -->|Tidak| C[Tidak bisa request]
    B -->|Ya| D[Input nominal]
    D --> E[Buat InstructorPayoutRequest\nstatus=pending, source=manual]
    E --> F[Admin review]
    F --> G{Keputusan}
    G -->|Approve| H[Status = approved]
    G -->|Reject| I[Status = rejected\nearnings bebas kembali]
    H --> J[Admin transfer ke bank instruktur]
    J --> K[Upload bukti transfer]
    K --> L[Mark as PAID]
    L --> M[released_at diisi pada semua earnings terkait]
```

---

## 12. Activity: Role Request (Student → Instructor)

```mermaid
flowchart TD
    A([Student klik Ajukan Jadi Instruktur]) --> B[Isi alasan + upload bukti]
    B --> C[Buat RoleRequest status=pending]
    C --> D([Admin review di /admin/user])
    D --> E{Keputusan}
    E -->|Approve| F[Attach role instructor ke user]
    F --> G[User bisa akses /instructor/dashboard]
    E -->|Reject| H[RoleRequest status=rejected + alasan]
    H --> I[Student bisa request ulang]
```

---

## 13. State Machine: User Status

```mermaid
stateDiagram-v2
    [*] --> pending : Register baru
    pending --> active : Email verified / Setup selesai
    active --> inactive : Admin nonaktifkan
    inactive --> active : Admin aktifkan kembali
    pending --> inactive : Admin nonaktifkan
```

---

## 14. State Machine: Payment Status

```mermaid
stateDiagram-v2
    [*] --> pending : Student submit payment
    pending --> approved : Admin approve
    pending --> rejected : Admin reject
    approved --> [*] : Final
    rejected --> pending : Student re-submit
```

---

## 15. State Machine: Enrollment Status

```mermaid
stateDiagram-v2
    [*] --> pending : Student daftar kursus
    pending --> active : Payment approved
    pending --> rejected : Payment rejected
    active --> [*] : Student bisa akses kursus
    rejected --> pending : Student re-submit payment
```

---

## 16. State Machine: Payout Request Status

```mermaid
stateDiagram-v2
    [*] --> draft : Admin batch create
    [*] --> pending : Instruktur manual request
    draft --> pending : Admin submit untuk review
    pending --> approved : Admin setujui
    pending --> rejected : Admin tolak
    approved --> paid : Admin mark as paid
    rejected --> [*]
    paid --> [*]
```

---

## 17. State Machine: Role Request Status

```mermaid
stateDiagram-v2
    [*] --> pending : Student submit request
    pending --> approved : Admin approve
    pending --> rejected : Admin reject
    approved --> [*] : User dapat role baru
    rejected --> pending : Student buat request baru
```

---

## 18. Middleware Chain

```mermaid
flowchart LR
    R[Request] --> AUTH{auth}
    AUTH -->|belum login| E1[redirect /login]
    AUTH -->|sudah login| ROLE{role:X}
    ROLE -->|tidak punya role| E2[403 Forbidden]
    ROLE -->|punya role| PERM{admin.permission?\njika admin route}
    PERM -->|tidak punya permission| E3[403 Forbidden]
    PERM -->|punya permission| CTL[Controller]
    CTL --> RESP[Response]
```
