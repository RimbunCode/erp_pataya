# ERP Inkindo — Platform LMS INKINDO

Platform Learning Management System (LMS) untuk INKINDO (Ikatan Nasional Konsultan Indonesia). Memungkinkan instruktur membuat kursus, siswa mendaftar dan belajar, serta admin mengelola seluruh ekosistem termasuk pembayaran dan payout instruktur.

## Quick Start

```bash
git clone <repo-url>
cd erp_inkindo

cp .env.example .env
# Edit .env: isi DB_DATABASE, DB_USERNAME, DB_PASSWORD, APP_URL

composer install
npm install

php artisan key:generate
php artisan migrate --seed
php artisan storage:link

# Terminal 1
php artisan serve

# Terminal 2
npm run dev
```

Buka `http://localhost:8000` di browser.

## Akun Test

| Email | Password | Role |
|-------|----------|------|
| `student@inkindo.test` | `password` | Student |
| `instructor@inkindo.test` | `password` | Instructor |
| `admin@inkindo.test` | `password` | Admin (Super) |
| `finance.admin@inkindo.test` | `password` | Admin (Finance) |
| `course.admin@inkindo.test` | `password` | Admin (Course) |
| `user.admin@inkindo.test` | `password` | Admin (User) |
| `content.admin@inkindo.test` | `password` | Admin (Content) |
| `multi@inkindo.test` | `password` | Student + Instructor |

## Tech Stack

| Layer | Teknologi | Versi |
|-------|-----------|-------|
| Backend | Laravel | 12.x |
| Frontend | React + Inertia.js | 19.x / 2.x |
| Styling | Tailwind CSS | 4.x |
| Database | MySQL | 8.0+ |
| UI Components | shadcn/ui + Radix UI | — |
| Auth | Laravel Breeze + Sanctum | — |
| Social Auth | Laravel Socialite (Google) | 5.x |

## Dokumentasi

| Dokumen | Deskripsi |
|---------|-----------|
| [Setup Lokal](docs/01-setup.md) | Instalasi & konfigurasi development |
| [Arsitektur](docs/02-architecture.md) | Struktur sistem & design patterns |
| [Database](docs/03-database.md) | Schema tabel & ERD |
| [Roles & Permissions](docs/04-roles-permissions.md) | Sistem akses & otorisasi |
| [Routes](docs/05-routes.md) | Daftar endpoint per role |
| [Modul Auth](docs/06-modules/auth.md) | Registrasi, login, setup user |
| [Modul Kursus](docs/06-modules/course.md) | Manajemen & publikasi kursus |
| [Modul Enrollment](docs/06-modules/enrollment.md) | Pendaftaran & pembayaran |
| [Modul Keuangan](docs/06-modules/finance.md) | Verifikasi payment & payout instruktur |
| [Modul Progress](docs/06-modules/student-progress.md) | Progres belajar & pengumpulan tugas |
| [Modul Admin](docs/06-modules/admin.md) | Manajemen user & persetujuan |
| [Service Layer](docs/07-services.md) | Referensi class service |
| [Frontend](docs/08-frontend.md) | Struktur React & komponen |
| [Deployment](docs/09-deployment.md) | CI/CD ke cPanel |
| [Semua Diagram](docs/10-diagrams.md) | Flowchart & state machine lengkap |

## Menjalankan Test

```bash
php artisan test
```
