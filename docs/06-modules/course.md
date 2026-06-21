# Modul Manajemen Kursus

## Ringkasan

Modul kursus mencakup pembuatan kursus, pengelolaan konten (sections & contents), dan alur publikasi yang melibatkan review oleh admin.

---

## Struktur Hierarki Kursus

```
Course
├── Section 1
│   ├── Content: Pre-Assessment (opsional)
│   ├── Content: Material (video/file)
│   ├── Content: Material (video/file)
│   └── Content: Assignment (tugas)
└── Section 2
    ├── Content: Material
    └── Content: Assignment
```

**Tipe konten:**

| Tipe | Deskripsi | Progress |
|------|-----------|---------|
| `material` | Materi belajar (video URL, file upload) | Via `UserProgress.is_completed` |
| `assignment` | Tugas yang harus dikumpulkan | Via `Submission` exists |
| `pre_assessment` | Penilaian awal sebelum belajar | Via `Submission` exists |

---

## Alur Membuat Kursus Baru

```mermaid
flowchart TD
    A([Instruktur buka /instructor/classes]) --> B[Klik Buat Kursus Baru]
    B --> C[Isi form: title, description, price, level, language, dll]
    C --> D[POST /instructor/classes]
    D --> E{Validasi server}
    E -->|Gagal| F[Tampilkan error validasi]
    F --> C
    E -->|Berhasil| G[Buat Course dengan is_published=false]
    G --> H[Redirect ke detail kursus]
    H --> I[Instruktur tambah sections]
    I --> J[Tambah contents per section]
    J --> K{Tipe konten?}
    K -->|Material| L[Isi judul + URL video\natau upload file]
    K -->|Assignment| M[Isi judul + deadline\n+ deskripsi tugas]
    K -->|Pre-Assessment| N[Isi judul + deskripsi]
    L --> O[Kursus siap untuk dipublish]
    M --> O
    N --> O
```

---

## Alur Publikasi Kursus

Kursus tidak bisa langsung publik — harus melalui review admin.

```mermaid
stateDiagram-v2
    [*] --> DRAFT: Kursus dibuat
    DRAFT --> PENDING: Instruktur submit publish request
    PENDING --> PUBLISHED: Admin approve
    PENDING --> REJECTED: Admin reject + alasan
    REJECTED --> DRAFT: Instruktur update kursus
    DRAFT --> PENDING: Instruktur submit ulang
    PUBLISHED --> DRAFT: Instruktur unpublish
    PUBLISHED --> PENDING: Instruktur ubah harga\n(harus review ulang)
```

### Detail State Machine

| State | Kondisi | Aksi tersedia |
|-------|---------|--------------|
| `DRAFT` | `is_published=false`, tidak ada pending request | Submit publish request |
| `PENDING` | Ada `CoursePublishRequest` dengan status=pending | Tidak bisa submit ulang sampai diputuskan |
| `PUBLISHED` | `is_published=true` | Unpublish, atau ubah harga (trigger review ulang) |
| `REJECTED` | Ada request dengan status=rejected | Update kursus, submit ulang |

---

## Alur Submit Publish Request

```mermaid
flowchart TD
    A([Instruktur klik Publish]) --> B{Kursus punya konten?}
    B -->|Tidak| C[Tampilkan error:\nHarus ada minimal 1 konten]
    B -->|Ya| D{Ada pending request?}
    D -->|Ya| E[Tampilkan error:\nSudah ada request pending]
    D -->|Tidak| F[Buat CoursePublishRequest\nstatus=pending\nsimpan submitted_price & discount]
    F --> G[Notifikasi admin]
    G --> H([Admin mereview di /admin/approvals])
```

---

## Alur Review oleh Admin

```mermaid
flowchart TD
    A([Admin buka /admin/approvals]) --> B[Lihat daftar pending requests]
    B --> C[Buka detail kursus]
    C --> D{Keputusan admin}
    D -->|Approve| E[Update CoursePublishRequest: status=approved\nUpdate Course: is_published=true\nprice & discount dari submitted values]
    D -->|Reject| F[Isi rejection_reason\nUpdate request: status=rejected\nCourse tetap di status sebelumnya]
    E --> G[Kursus muncul di katalog publik]
    F --> H[Instruktur dinotifikasi\nbisa submit ulang setelah revisi]
```

---

## Alur Perubahan Harga Kursus yang Sudah Published

Instruktur tidak bisa begitu saja mengubah harga kursus yang sudah published — harus review ulang:

```mermaid
flowchart TD
    A([Instruktur update kursus]) --> B{Ada perubahan price/discount?}
    B -->|Tidak| C[Update langsung tanpa review]
    B -->|Ya| D{Kursus currently published?}
    D -->|Tidak| C
    D -->|Ya| E[Buat CoursePublishRequest baru\nstatus=pending\nsimpan harga baru sebagai submitted_price]
    E --> F[is_published tetap true\nharga di DB belum berubah]
    F --> G[Admin review]
    G -->|Approve| H[Update harga di Course\nsesuai submitted_price]
    G -->|Reject| I[Harga lama tetap berlaku]
```

---

## Authorization

Setiap endpoint kursus memvalidasi bahwa instruktur hanya bisa mengakses kursus miliknya sendiri:

```php
// Diterapkan di CourseController, CourseSectionController, CourseContentController
if ($course->created_by !== Auth::id()) {
    abort(403);
}
```

Ini **tidak ditangani oleh Policy**, melainkan validasi eksplisit di setiap method controller. Lihat [Roles & Permissions](../04-roles-permissions.md) untuk detail.

---

## File Upload untuk Konten

File materi (PDF, video lokal, dll.) diupload melalui:

1. `POST /instructor/classes/contents/{content}/upload`
2. File disimpan ke `storage/app/private/` (tidak publik langsung)
3. Metadata disimpan di tabel `files`
4. Relasi dibuat di tabel `fileables` (polymorphic): `fileable_type = CourseContent::class`
5. Akses file via `/files/{file}/preview` yang dilindungi auth

---

## Controller & Service

| File | Tanggung Jawab |
|------|---------------|
| `app/Http/Controllers/Instructor/CourseController.php` | CRUD kursus, publish toggle, thumbnail |
| `app/Http/Controllers/Instructor/CourseSectionController.php` | CRUD sections |
| `app/Http/Controllers/Instructor/CourseContentController.php` | CRUD contents, file upload |
| `app/Http/Controllers/Admin/CourseApprovalController.php` | Approve/reject publish requests |
