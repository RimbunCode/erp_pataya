# ERP System

Aplikasi Enterprise Resource Planning (ERP) berbasis web yang dibangun dengan Laravel 12 + React 19 + Inertia.js v2.

Mengelola siklus bisnis lengkap: Sales, Purchase, Inventory, Finances, dan Service — dalam satu platform terintegrasi.

---

## Tech Stack

| Teknologi | Versi | Dokumentasi |
|---|---|---|
| Laravel | ^12.0 | https://laravel.com/docs/ |
| Inertia.js (Laravel) | ^2.0 | https://inertiajs.com |
| Inertia.js (React) | ^2.3.18 | https://inertiajs.com |
| React | 19.2.4 | https://react.dev |
| TailwindCSS | ^4.2.1 | https://tailwindcss.com/docs |
| shadcn/ui | latest | https://ui.shadcn.com/docs |
| Ziggy | ^2.0 | https://github.com/tighten/ziggy |
| Laravel Sanctum | ^4.0 | https://laravel.com/docs/sanctum |
| Laravel Breeze | ^2.3 | https://laravel.com/docs/starter-kits |
| Laravel Socialite | ^5.26 | https://laravel.com/docs/socialite |
| laravel-react-i18n | ^2.0.5 | https://github.com/xiCO2k/laravel-react-i18n |
| PHPUnit | ^11.0 | https://phpunit.de |

---

## Prerequisites

- PHP 8.2+ (8.4 direkomendasikan)
- Node.js 20+ dan npm
- Composer
- MySQL 8.0+
- [Laravel Herd](https://herd.laravel.com/) (opsional, direkomendasikan)

---

## Instalasi

```bash
# 1. Clone repository
git clone <repository-url>
cd erp

# 2. Install dependencies
composer install
npm install

# 3. Setup environment
cp .env.example .env
php artisan key:generate

# 4. Konfigurasi database di .env
# DB_DATABASE=erp
# DB_USERNAME=root
# DB_PASSWORD=

# 5. Migrasi dan seed database
php artisan migrate --seed

# 6. Jalankan aplikasi
composer run dev
```

Atau gunakan shortcut setup:

```bash
composer run setup
```

---

## Menjalankan Aplikasi

```bash
# Development (server + queue + logs + vite — semua sekaligus)
composer run dev

# Hanya server + vite (lebih ringan)
composer run dev:simple

# Development dengan Xdebug
composer run dev:debug
```

Akses aplikasi di: `http://localhost:8000`

---

## Environment Variables Penting

| Variable | Deskripsi | Default |
|---|---|---|
| `APP_KEY` | Application key (generate otomatis) | — |
| `APP_URL` | URL aplikasi | `http://localhost` |
| `DB_HOST` | Host database | `127.0.0.1` |
| `DB_DATABASE` | Nama database | `laravel` |
| `DB_USERNAME` | Username database | `root` |
| `DB_PASSWORD` | Password database | — |
| `QUEUE_CONNECTION` | Driver queue | `database` |
| `SESSION_DRIVER` | Driver session | `database` |
| `MAIL_MAILER` | Driver email | `log` |
| `SOCIALITE_*` | OAuth provider credentials | — |

---

## Menjalankan Tests

```bash
# Jalankan semua test
php artisan test --compact

# Test dengan filter nama
php artisan test --compact --filter=SalesOrderTest

# Test file tertentu
php artisan test --compact tests/Feature/SalesOrderTest.php
```

---

## Build Frontend

```bash
# Development (HMR)
npm run dev

# Production build
npm run build

# Lint
npm run lint
```

---

## Dokumentasi

| Dokumen | Deskripsi |
|---|---|
| [Index Dokumentasi](docs/index.md) | Overview semua dokumentasi |
| [Arsitektur](docs/architecture.md) | Arsitektur sistem, design patterns, permission matrix |
| [Database Schema](docs/database.md) | ER diagram, referensi tabel, relasi |
| [Routes](docs/routes.md) | Referensi route lengkap per modul |
| [Frontend](docs/frontend.md) | Katalog komponen React, custom hooks |
| [Autentikasi & Otorisasi](docs/auth.md) | Auth, roles, permission system |
| [Artisan Commands](docs/artisan-commands.md) | Custom CLI commands dan schedules |
| **Modul Bisnis** | |
| [Sales](docs/modules/sales.md) | Sales Orders, Internal Orders, Customers |
| [Purchase](docs/modules/purchase.md) | Purchase Requests, Orders, Receipts, Suppliers |
| [Inventory](docs/modules/inventory.md) | Items, Warehouses, Stock Entries, Delivery Notes |
| [Finances](docs/modules/finances.md) | Invoices, Payments, Accounts, General Ledger |
| [Service](docs/modules/service.md) | Work Orders |
| [Core / Settings](docs/modules/core.md) | Branches, Approval Schemes, FormatingSeries, Print Templates |

---

## Struktur Direktori

```
app/
  Console/Commands/   Custom Artisan commands
  Http/
    Controllers/      Controller per modul
    Middleware/       AppMiddleware, HandleInertiaRequests, dll.
    Requests/         FormRequest per modul
  Models/             Model Eloquent dikelompokkan per modul
  Services/           Business logic layer
  Traits/             DataTable, Submitable, LinkModel, TreeView, dll.
resources/js/
  Components/         Komponen React reusable (LinkModel, FormInput, FormTable, dll.)
  Hooks/              Custom React hooks
  Layouts/            AppLayout, MasterLayout, GuestLayout
  Pages/              Halaman Inertia per modul
lang/
  en/                 Terjemahan Bahasa Inggris
  id/                 Terjemahan Bahasa Indonesia
routes/
  web.php             Web routes (dengan Route::resourceDetail macro)
  auth.php            Auth routes (Breeze)
  console.php         Scheduled commands
```

---

## Lisensi

MIT License
