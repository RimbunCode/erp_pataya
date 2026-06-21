# Arsitektur Sistem

## Gambaran Besar

ERP Inkindo adalah aplikasi web monolitik dengan arsitektur **Inertia.js** — backend Laravel merender halaman React sepenuhnya di server, tanpa REST API terpisah.

```
┌─────────────────────────────────────────────────────────────┐
│  Browser                                                     │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  React (client-side rendering & interactivity)       │   │
│  │  Tailwind CSS + shadcn/ui                            │   │
│  └────────────────────┬─────────────────────────────────┘   │
└───────────────────────│─────────────────────────────────────┘
                        │  HTTP (Inertia.js protocol)
┌───────────────────────▼─────────────────────────────────────┐
│  Laravel 12 (Server)                                         │
│  ┌──────────────┐  ┌────────────┐  ┌────────────────────┐   │
│  │  Controllers │→ │  Services  │→ │  Models (Eloquent) │   │
│  └──────────────┘  └────────────┘  └────────────────────┘   │
│  ┌──────────────┐  ┌────────────┐                           │
│  │  Middleware  │  │   Traits   │                           │
│  └──────────────┘  └────────────┘                           │
└──────────────────────────────────────────┬──────────────────┘
                                           │ Eloquent ORM
                                    ┌──────▼──────┐
                                    │    MySQL     │
                                    └─────────────┘
```

### Cara Kerja Inertia.js

Tidak seperti SPA biasa yang memanggil REST API, Inertia.js bekerja seperti ini:

1. **Request pertama**: Laravel merender halaman HTML penuh dengan data ter-embed sebagai JSON
2. **Navigasi berikutnya**: Browser mengirim XHR ke Laravel, Laravel mengembalikan JSON baru, React me-render ulang komponen

Artinya: **tidak ada endpoint API terpisah** — setiap route di `routes/web.php` langsung mengembalikan `Inertia::render(...)` dengan props data.

---

## Stack Teknologi

| Kategori | Teknologi | Versi | Keterangan |
|----------|-----------|-------|------------|
| Backend Framework | Laravel | 12.x | PHP framework utama |
| PHP | PHP | 8.2+ | |
| Frontend Framework | React | 19.x | Library UI |
| SSR Bridge | Inertia.js | 2.x | Jembatan Laravel ↔ React |
| Styling | Tailwind CSS | 4.x | Utility-first CSS |
| UI Components | shadcn/ui + Radix UI | — | Accessible component library |
| Icons | Lucide React | — | Icon set |
| Charts | Recharts | — | Visualisasi data |
| Database | MySQL | 8.0+ | Database utama |
| ORM | Eloquent | — | Laravel built-in ORM |
| Auth | Laravel Breeze | 2.x | Starter kit autentikasi |
| API Auth | Laravel Sanctum | 4.x | Token-based auth (future API) |
| Social Auth | Laravel Socialite | 5.x | Google OAuth |
| Build Tool | Vite | — | Frontend bundler |
| Package Manager | Composer + npm | — | |
| Testing | PHPUnit | 11.x | |
| Static Analysis | PHPStan / Larastan | — | |
| Code Style | Laravel Pint | — | PHP formatter |

---

## Struktur Direktori

```
erp_inkindo/
├── app/
│   ├── Http/
│   │   ├── Controllers/
│   │   │   ├── Admin/          ← Controller untuk role admin
│   │   │   ├── Instructor/     ← Controller untuk role instructor
│   │   │   ├── Student/        ← Controller untuk role student
│   │   │   ├── Auth/           ← Registrasi, login, password reset
│   │   │   └── Core/           ← Shared: file, model, widget
│   │   ├── Middleware/         ← RoleMiddleware, AdminPermissionMiddleware, dll
│   │   └── BaseProfileController.php  ← Abstract base untuk profile controllers
│   ├── Models/
│   │   ├── Course.php
│   │   ├── Enrollment.php
│   │   ├── Payment.php
│   │   ├── Finance/            ← InstructorEarning, InstructorPayoutRequest
│   │   ├── Core/               ← File, Branch, Preference
│   │   └── User/               ← User, Role, Permission
│   ├── Services/
│   │   ├── Admin/              ← AdminPermissionService, UserTransformer
│   │   ├── Auth/               ← RoleResolver, UserRoleManager, LoginCredentialVerifier
│   │   ├── Finance/            ← InstructorPayoutService
│   │   ├── Instructor/         ← StudentProgressBuilder
│   │   └── CourseProgressService.php
│   └── Traits/
│       ├── Submitable.php      ← Workflow submit → approve/reject
│       ├── DataTable.php       ← Logging & datatable integration
│       ├── HasInitials.php     ← Generate avatar initials
│       ├── LinkModel.php       ← Datatable column config
│       └── HasCountry.php      ← Country relation
│
├── database/
│   ├── migrations/             ← 58 migration files
│   └── seeders/                ← 9 seeder files
│
├── resources/
│   └── js/
│       ├── Pages/
│       │   ├── Admin/          ← Halaman admin
│       │   ├── Instructors/    ← Halaman instructor
│       │   ├── Students/       ← Halaman student
│       │   ├── Guest/          ← Halaman publik
│       │   └── Auth/           ← Halaman login/register
│       ├── Components/         ← Komponen reusable (shadcn/ui)
│       ├── Layouts/            ← AppLayout, StudentLayout, AuthLayout, dll
│       └── Hooks/              ← useCart, useSessionStorage, usePermission
│
├── routes/
│   └── web.php                 ← Semua route (306 baris)
│
└── .github/
    └── workflows/
        ├── lint.yml            ← Auto-format & lint
        └── deploy-cpanel.yml   ← Deploy ke cPanel
```

---

## Design Patterns

### 1. Service Layer

Logic bisnis yang kompleks dipisahkan ke service class, bukan ditaruh di controller.

```
Controller → Service → Model
```

Contoh: `SystemFinanceController::approve()` memanggil `InstructorPayoutService::createEarningFromApprovedPayment()` — controller hanya orchestrate, service yang menghitung dan menyimpan.

Service classes ada di `app/Services/`. Lihat [07 — Service Layer](07-services.md) untuk referensi lengkap.

### 2. Template Method Pattern (BaseProfileController)

Ketiga role (student, instructor, admin) punya endpoint profil dengan logika yang mirip. `BaseProfileController` mendefinisikan alur umum, subclass mengisi detail spesifik.

```php
// app/Http/Controllers/BaseProfileController.php
abstract class BaseProfileController extends Controller {
    abstract public function index();
    abstract protected function validationRules(): array;
    abstract protected function updateProfileData(Request $request): void;
}
```

### 3. Trait-Based Mixins

Fungsionalitas yang dipakai banyak model di-extract ke trait:

| Trait | Fungsi | Dipakai oleh |
|-------|--------|--------------|
| `Submitable` | Workflow submit/approve/reject | Model dengan approval workflow |
| `DataTable` | Logging CRUD & datatable UI | Hampir semua model |
| `HasInitials` | Generate avatar "JD" dari "John Doe" | UserTransformer |
| `LinkModel` | Konfigurasi kolom datatable | Model yang tampil di UI |
| `HasCountry` | Relasi ke tabel countries | User dan model dengan country |

### 4. Primary Keys ULID

Semua model menggunakan **ULID** (Universally Unique Lexicographically Sortable Identifier) sebagai primary key, bukan auto-increment integer.

```php
use Illuminate\Database\Eloquent\Concerns\HasUlids;

class Course extends Model {
    use HasUlids; // ID akan otomatis jadi ULID string
}
```

Keuntungan ULID: aman untuk expose ke URL, sortable by time, tidak ada collisi di distributed system.

### 5. Soft Deletes

Tabel-tabel penting tidak benar-benar dihapus dari database — mereka hanya diberi timestamp `deleted_at`. Ini memungkinkan recovery data dan menjaga integritas referensial.

Tabel dengan soft delete: `users`, `courses`, `payments`, `instructor_earnings`, `instructor_payout_requests`, `role_requests`, `course_publish_requests`, `files`, `roles`, `permissions`, `tags`.

---

## Shared Props Inertia.js

Setiap halaman secara otomatis menerima props berikut dari `HandleInertiaRequests` middleware:

```javascript
// Tersedia di semua halaman via usePage().props
{
  auth: {
    user: { id, name, email, image, status },
    active_role: "student" | "instructor" | "admin" | "organization",
    admin_permissions: ["finance_admin", "super_admin"], // hanya untuk admin
    can_manage_admin_permissions: true | false,
  },
  lang: "id" | "en",
  ziggy: { /* route definitions untuk route() helper di JS */ },
  flash: {
    success: "Berhasil disimpan",
    error: null,
  }
}
```

---

## Multi-Role System

User bisa memiliki lebih dari satu role sekaligus. Misalnya, seorang yang sekaligus student dan instructor.

- Role disimpan di tabel pivot `user_role`
- Saat login, jika user punya 2+ role → diarahkan ke halaman pemilihan role
- Role aktif disimpan di cookie `last_active_role`
- `RoleMiddleware` memvalidasi role pada setiap request

Lihat [04 — Roles & Permissions](04-roles-permissions.md) untuk detail lebih lanjut.

---

## Alur Request Tipikal

```
Browser klik tombol
    ↓
Inertia router.visit() atau router.post()
    ↓
HTTP request ke Laravel
    ↓
Middleware chain (auth → role → admin.permission)
    ↓
Controller method
    ↓
Service (jika ada logic kompleks)
    ↓
Model / Eloquent
    ↓
MySQL
    ↓
Inertia::render('PageName', $props) atau redirect()
    ↓
React render ulang komponen
    ↓
User melihat hasil
```
