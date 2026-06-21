# State Machines — Diagram Mesin Status

Dokumen ini berisi semua state machine diagram untuk entitas dalam sistem ERP Inkindo. Setiap diagram menunjukkan transisi status, trigger, aktor, dan side effect yang terjadi.

> **Catatan:** Diagram ringkas sudah ada di [`10-diagrams.md`](./10-diagrams.md). Dokumen ini memberikan versi yang lebih detail dengan anotasi lengkap.

---

## Daftar Isi

1. [Course Status](#1-course-status)
2. [Payment Status](#2-payment-status)
3. [Enrollment Status](#3-enrollment-status)
4. [Payout Request Status](#4-payout-request-status)
5. [Instructor Earning Lifecycle](#5-instructor-earning-lifecycle)
6. [Role Request Status](#6-role-request-status)
7. [User Status](#7-user-status)
8. [Submission Status](#8-submission-status)
9. [Course Publish Request Status](#9-course-publish-request-status)

---

## 1. Course Status

Status course ditentukan oleh kombinasi kolom `is_published` dan status `CoursePublishRequest` terakhir.

```mermaid
stateDiagram-v2
    [*] --> DRAFT : Course dibuat oleh instruktur\nis_published = false

    DRAFT --> PENDING : Instruktur klik Toggle Publish\n→ CoursePublishRequest dibuat\nsubmitted_price/discount disimpan

    PENDING --> PUBLISHED : Admin approve request\n→ is_published = true\n→ harga = submitted_price\n→ discount = submitted_discount

    PENDING --> REJECTED : Admin reject request\n→ rejection_reason diisi\n→ is_published tetap false

    REJECTED --> DRAFT : Instruktur update course\n(course.updated_at > request.reviewed_at)\n→ bisa submit ulang

    DRAFT --> PENDING : Submit ulang setelah revisi

    PUBLISHED --> DRAFT : Instruktur klik Unpublish\n→ is_published = false

    PUBLISHED --> PENDING : Instruktur ubah harga/diskon\n→ CoursePublishRequest baru dibuat\n→ harga katalog tetap lama\nsampai admin approve

    note right of PUBLISHED
        Course tampil di katalog student
        dan bisa dibeli
    end note

    note right of PENDING
        Instruktur tidak bisa submit
        request baru selama ada
        request pending
    end note
```

### Trigger & Kondisi

| Transisi | Trigger | Aktor | Kondisi |
|----------|---------|-------|---------|
| `* → DRAFT` | `Course::create` | Instruktur | Selalu saat create |
| `DRAFT → PENDING` | `togglePublish` | Instruktur | Tidak ada pending request; tidak rejected tanpa update |
| `PENDING → PUBLISHED` | `approve` | Admin (course_admin/super_admin) | Request status = pending |
| `PENDING → REJECTED` | `reject` | Admin (course_admin/super_admin) | Request status = pending |
| `REJECTED → DRAFT` | `update` | Instruktur | `course.updated_at > request.reviewed_at` |
| `PUBLISHED → DRAFT` | `togglePublish` | Instruktur | Langsung, tanpa request |
| `PUBLISHED → PENDING` | `update` (harga berubah) | Instruktur | Harga/diskon berubah, tidak ada pending request |

### Status Resolution (Kode)

```php
// Instructor\CourseController::resolveStatus
if ($course->is_published) return 'published';
if ($latestRequest->status === 'pending') return 'pending';
if ($latestRequest->status === 'rejected') return 'rejected';
return 'draft';
```

---

## 2. Payment Status

```mermaid
stateDiagram-v2
    [*] --> pending : Student submit enrollment\n+ upload bukti bayar

    pending --> approved : Admin klik Approve\nverified_at = now\nverified_by = admin

    pending --> rejected : Admin klik Reject\nrejection_reason diisi\nverified_at, verified_by diisi

    approved --> [*] : Status final\nEnrollment = active\nInstructorEarning dibuat

    rejected --> pending : Student re-upload bukti bayar\nEnrollment + Payment baru dibuat\nuntuk course yang sama

    note right of approved
        Side effects:
        1. Enrollment.status = active
        2. InstructorEarning dibuat
           dengan available_at = now + delay
    end note

    note right of rejected
        Student bisa re-submit
        melalui enrollment baru
        untuk course yang sama
    end note
```

### Side Effects per Transisi

| Transisi | Side Effects |
|----------|-------------|
| `pending → approved` | Enrollment = active, InstructorEarning dibuat (gross, company, instructor amounts) |
| `pending → rejected` | Enrollment = rejected, rejection_reason tersimpan |
| `rejected → pending` | Payment baru + Enrollment baru (update payment_id) |

---

## 3. Enrollment Status

```mermaid
stateDiagram-v2
    [*] --> pending : Student daftar kursus\nsaat checkout

    pending --> active : Payment di-approve admin\nenrolled_at diupdate

    pending --> rejected : Payment di-reject admin

    active --> completed : Progress mencapai 100%\n(resolveStatusFromProgress)

    rejected --> pending : Student re-submit payment\npayment_id diupdate

    note right of active
        Student bisa mengakses
        semua konten kursus
    end note

    note right of completed
        Status logis dari
        CourseProgressService,
        bukan kolom DB
    end note
```

### Status Determination

| Status | Kolom DB | Logika |
|--------|----------|--------|
| `pending` | `enrollments.status = 'pending'` | Menunggu verifikasi payment |
| `active` | `enrollments.status = 'active'` | Payment sudah di-approve |
| `rejected` | `enrollments.status = 'rejected'` | Payment di-reject |
| `completed` | Bukan kolom DB | `CourseProgressService::resolveStatusFromProgress(100)` |

---

## 4. Payout Request Status

```mermaid
stateDiagram-v2
    [*] --> draft : Admin batch create\nsource = batch\nrequested_by = admin

    [*] --> pending : Instruktur manual request\nsource = manual\nrequested_by = instructor

    draft --> pending : Admin submit untuk review\n(implicit saat approve flow)

    draft --> approved : Admin approve langsung
    pending --> approved : Admin approve\napproved_by, approved_at diisi\napproved_amount = requested_amount

    draft --> rejected : Admin reject
    pending --> rejected : Admin reject\nrejection_reason diisi
    approved --> rejected : Admin reject sebelum paid\nearnings bebas kembali

    approved --> paid : Admin mark as paid\npaid_by, paid_at diisi\ntransfer_reference + proof disimpan

    paid --> [*] : Status final\nSemua earnings terkait\nreleased_at = now (jika fully paid)

    rejected --> [*] : Earnings kembali eligible\ntidak lagi di-reserve

    note right of paid
        Side effect:
        Earning.released_at di-set
        jika total paid dari semua
        request >= instructor_amount
    end note
```

### Reserved Statuses

Earning di-reserve (dikurangi dari eligible balance) saat termasuk dalam payout request dengan status:
`draft`, `pending`, `approved`, `paid`

```php
private const RESERVED_STATUSES = ['draft', 'pending', 'approved', 'paid'];
```

---

## 5. Instructor Earning Lifecycle

Ini bukan state machine dari kolom DB, melainkan **logical states** yang dihitung dari kolom-kolom earning.

```mermaid
stateDiagram-v2
    [*] --> CREATED : Payment di-approve\nEarning dibuat via\ncreateEarningFromApprovedPayment

    CREATED --> WAITING : available_at di masa depan\n(now + payout_delay_days)

    WAITING --> AVAILABLE : Waktu sekarang >= available_at\nearning masuk eligible balance

    CREATED --> AVAILABLE : delay_days = 0\navailable_at <= now langsung

    AVAILABLE --> RESERVED : Earning di-include dalam\nPayoutRequest (draft/pending/approved)

    RESERVED --> AVAILABLE : PayoutRequest di-reject\nearning bebas kembali

    RESERVED --> RELEASED : PayoutRequest di-mark paid\ndan total paid >= instructor_amount

    AVAILABLE --> RELEASED : Langsung saat payout paid\n(tanpa fase reserved terpisah)

    RELEASED --> [*] : Status final\nreleased_at terisi

    note right of AVAILABLE
        Dihitung oleh:
        InstructorPayoutService
        ::calculateEligibleBalance()
    end note
```

### Kriteria Available

```
earning.available_at IS NOT NULL
AND earning.available_at <= now()
AND earning.released_at IS NULL
AND (instructor_amount - reserved_amount) > 0
```

---

## 6. Role Request Status

```mermaid
stateDiagram-v2
    [*] --> pending : Student submit request\nrequested_role = instructor\n+ upload proof_file

    pending --> approved : Admin approve\n→ attach role instructor ke user\n→ reviewed_by, reviewed_at diisi

    pending --> rejected : Admin reject\n→ rejection_reason diisi\n→ reviewed_by, reviewed_at diisi

    approved --> [*] : Status final\nUser punya akses instructor

    rejected --> pending : Student buat request baru\n(request lama tetap rejected)

    note right of approved
        Side effect:
        UserRole pivot ditambahkan
        user bisa akses /instructor/*
    end note
```

### Validation Rules

| Transisi | Validasi |
|----------|----------|
| `pending → approved` | `requested_role = 'instructor'` DAN `status = 'pending'` |
| `pending → rejected` | `requested_role = 'instructor'` DAN `status = 'pending'` |
| `rejected → pending` | Buat RoleRequest baru (bukan update yang lama) |

---

## 7. User Status

```mermaid
stateDiagram-v2
    [*] --> pending : Register baru\n(via form register)

    [*] --> pre_registered : OAuth login pertama kali\n(email belum ada di DB)

    [*] --> invited : Admin invite user\npassword = null

    pending --> active : Email verified\natau setup selesai

    pre_registered --> active : Setup user selesai\ndengan password

    invited --> active : Register + has password\n+ has branch

    active --> inactive : Admin nonaktifkan\ninactive_reason, inactive_by,\ninactive_at diisi

    inactive --> active : Admin aktifkan kembali\nclear inactive_*

    pending --> inactive : Admin nonaktifkan

    note right of inactive
        User tidak bisa login
        Auth throw ValidationException
        dengan pesan auth.disabled
    end note
```

### Status Values (FormStatus enum)

| Status | Value | Keterangan |
|--------|-------|------------|
| `pending` | `'pending'` | Baru daftar, belum lengkap |
| `pre_registered` | `'pre_registered'` | Dari OAuth, perlu setup |
| `invited` | `'invited'` | Di-invite admin, perlu register |
| `active` | `'active'` | Bisa login dan beraktivitas |
| `inactive` | `'inactive'` | Dinonaktifkan admin |

---

## 8. Submission Status

```mermaid
stateDiagram-v2
    [*] --> submitted : Student upload file tugas\nSubmission::updateOrCreate\nstatus = submitted\nsubmitted_at = now

    submitted --> graded : Instruktur input grade\ngrade 0-100 + feedback\ngraded_at = now

    graded --> [*] : Status final\nNilai tampil di MyCourses student

    submitted --> submitted : Student re-upload file\n(sebelum deadline)\nstatus tetap submitted

    note right of submitted
        Bisa di-update selama
        deadline belum lewat.
        File bisa ditambah/dihapus.
    end note

    note right of graded
        Grade dan feedback
        hanya bisa di-set
        oleh instruktur via
        PATCH .../grade
    end note
```

### Constraints

| Constraint | Keterangan |
|-----------|------------|
| Unique `(user_id, content_id)` | Satu submission per siswa per konten |
| `isSubmissionType()` | Content type = `assignment` atau `pre_assessment` |
| `hasDeadlinePassed()` | Tidak bisa submit/update setelah deadline |

---

## 9. Course Publish Request Status

```mermaid
stateDiagram-v2
    [*] --> pending : Instruktur submit publish request\natau ubah harga course published\nsubmitted_price, submitted_discount,\nsubmitted_discount_type disimpan

    pending --> approved : Admin approve
→ Course.is_published = true
→ Course.price = submitted_price
→ Course.discount = submitted_discount
→ reviewed_by, reviewed_at diisi

    pending --> rejected : Admin reject\n→ rejection_reason diisi\n→ reviewed_by, reviewed_at diisi\n→ Course tidak berubah

    approved --> [*] : Status final\nCourse live di katalog

    rejected --> [*] : Instruktur harus update course\nterlebih dahulu sebelum\nsubmit request baru

    note right of pending
        Snapshot data:
        submitted_price, submitted_discount,
        submitted_discount_type
        menyimpan harga saat request dibuat
    end note
```

### Snapshot Data

Saat request dibuat, data berikut di-snapshot:

| Field | Keterangan |
|-------|------------|
| `submitted_price` | Harga course saat submit |
| `submitted_discount` | Diskon saat submit |
| `submitted_discount_type` | `percentage` atau `amount` |

Saat admin approve, snapshot ini di-apply ke course. Jika admin reject, data course tetap tidak berubah.

---

## Ringkasan Semua Status

| Entitas | Status Values | Sumber |
|---------|--------------|--------|
| Course | `draft`, `pending`, `published`, `rejected` | Derived (is_published + latest request) |
| Payment | `pending`, `approved`, `rejected` | `payments.status` |
| Enrollment | `pending`, `active`, `rejected` + `completed` (logis) | `enrollments.status` + progress |
| Payout Request | `draft`, `pending`, `approved`, `rejected`, `paid` | `instructor_payout_requests.status` |
| Earning | `created`, `waiting`, `available`, `reserved`, `released` | Derived (available_at, released_at, reserved) |
| Role Request | `pending`, `approved`, `rejected` | `role_requests.status` |
| User | `pending`, `pre_registered`, `invited`, `active`, `inactive` | `users.status` |
| Submission | `submitted`, `graded` | `submissions.status` |
| Publish Request | `pending`, `approved`, `rejected` | `course_publish_requests.status` |
