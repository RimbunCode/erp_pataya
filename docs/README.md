# Dokumentasi ERP Inkindo

Selamat datang di dokumentasi teknis ERP Inkindo. Dokumentasi ini dirancang agar programmer baru bisa memahami sistem secara menyeluruh.

## Daftar Dokumen

### Memulai
- **[01 — Setup Lokal](01-setup.md)** — Cara instalasi dan menjalankan proyek di komputer kamu
- **[02 — Arsitektur](02-architecture.md)** — Gambaran besar sistem, stack teknologi, dan design patterns

### Referensi Teknis
- **[03 — Database](03-database.md)** — Schema semua tabel, ERD, dan relasi antar model
- **[04 — Roles & Permissions](04-roles-permissions.md)** — Sistem multi-role dan otorisasi granular
- **[05 — Routes](05-routes.md)** — Daftar lengkap endpoint per role

### Alur Bisnis per Modul
- **[06a — Modul Auth](06-modules/auth.md)** — Registrasi, login, setup user, Google OAuth
- **[06b — Modul Kursus](06-modules/course.md)** — Buat, edit, dan publikasi kursus
- **[06c — Modul Enrollment](06-modules/enrollment.md)** — Pendaftaran kursus & pembayaran
- **[06d — Modul Keuangan](06-modules/finance.md)** — Verifikasi payment & payout instruktur
- **[06e — Modul Progress](06-modules/student-progress.md)** — Tracking belajar & pengumpulan tugas
- **[06f — Modul Admin](06-modules/admin.md)** — User management & approval workflows

### Referensi Kode
- **[07 — Service Layer](07-services.md)** — Dokumentasi semua service class
- **[08 — Frontend](08-frontend.md)** — Struktur React, layout, halaman, dan hooks
- **[09 — Deployment](09-deployment.md)** — Proses CI/CD ke cPanel

### Diagram Visual
- **[10 — Diagram Ringkas](10-diagrams.md)** — ERD, flowchart activity, dan state machine (Mermaid)

### Dokumentasi Lanjutan
- **[11 — User Journeys](11-user-journeys.md)** — Alur perjalanan pengguna per role
- **[12 — Arsitektur Sistem](12-system-architecture.md)** — Diagram arsitektur lengkap
- **[13 — Alur Fitur](13-feature-flows.md)** — Flowchart detail setiap fitur
- **[14 — State Machines](14-state-machines.md)** — Diagram state/status setiap entity
- **[15 — Database ERD](15-database-erd.md)** — ERD lengkap per modul
- **[16 — Sequence Diagrams](16-sequence-diagrams.md)** — Diagram urutan interaksi komponen
- **[17 — API Reference](17-api-reference.md)** — Dokumentasi endpoint API lengkap
- **[18 — Frontend Reference](18-frontend-reference.md)** — Inventaris halaman, komponen, dan pola frontend
- **[19 — Developer Guide](19-developer-guide.md)** — Panduan menambah fitur baru

---

## Navigasi berdasarkan Role

**Saya developer Student features:**
- [05 — Routes](05-routes.md) · [06c — Enrollment](06-modules/enrollment.md) · [06e — Progress](06-modules/student-progress.md)
- [11 — User Journeys](11-user-journeys.md) · [13 — Alur Fitur](13-feature-flows.md)

**Saya developer Instructor features:**
- [05 — Routes](05-routes.md) · [06b — Kursus](06-modules/course.md) · [06d — Keuangan](06-modules/finance.md)
- [11 — User Journeys](11-user-journeys.md) · [13 — Alur Fitur](13-feature-flows.md)

**Saya developer Admin features:**
- [05 — Routes](05-routes.md) · [06f — Admin](06-modules/admin.md) · [04 — Roles & Permissions](04-roles-permissions.md)
- [11 — User Journeys](11-user-journeys.md) · [13 — Alur Fitur](13-feature-flows.md)

---

## Saya ingin...

| Tujuan | Dokumen |
|--------|---------|
| Memahami arsitektur sistem | [02 — Arsitektur](02-architecture.md), [12 — Arsitektur Sistem](12-system-architecture.md) |
| Melihat alur fitur tertentu | [13 — Alur Fitur](13-feature-flows.md), [16 — Sequence Diagrams](16-sequence-diagrams.md) |
| Memahami database | [03 — Database](03-database.md), [15 — Database ERD](15-database-erd.md) |
| Menambah fitur baru | [19 — Developer Guide](19-developer-guide.md) |
| Memahami state/status entity | [14 — State Machines](14-state-machines.md) |
| Melihat daftar endpoint | [05 — Routes](05-routes.md), [17 — API Reference](17-api-reference.md) |
| Setup lokal | [01 — Setup Lokal](01-setup.md) |
| Deploy ke production | [09 — Deployment](09-deployment.md) |

---

## Semua Diagram

| Diagram | Dokumen |
|---------|---------|
| Arsitektur | [12 — Arsitektur Sistem](12-system-architecture.md) |
| User Journey | [11 — User Journeys](11-user-journeys.md) |
| Alur Fitur | [13 — Alur Fitur](13-feature-flows.md) |
| State Machine | [14 — State Machines](14-state-machines.md) |
| ERD per Modul | [15 — Database ERD](15-database-erd.md) |
| Sequence Diagram | [16 — Sequence Diagrams](16-sequence-diagrams.md) |
| Diagram Ringkas (legacy) | [10 — Diagram Ringkas](10-diagrams.md) |

---

> Semua diagram menggunakan **Mermaid syntax** yang dirender otomatis di GitHub.
> Untuk melihat diagram secara lokal, gunakan ekstensi VS Code "Markdown Preview Mermaid Support".
