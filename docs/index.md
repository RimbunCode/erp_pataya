# ERP System - Dokumentasi Lengkap

> Laravel 12 + React 19 + Inertia.js v2 - Enterprise Resource Planning System

## Daftar Isi

| Dokumen | Deskripsi |
|---|---|
| [Arsitektur](architecture.md) | Arsitektur sistem, struktur direktori, design patterns, permission |
| [Database Schema](database.md) | ER diagram, referensi tabel (+ model terkait), relasi |
| [Model & Relasi](models.md) | Relasi Eloquent tiap model (belongsTo/hasMany/morph) + link |
| [Routes](routes.md) | 544 route lengkap per modul + `Controller@method` |
| [Frontend](frontend.md) | Katalog halaman React, peta LinkModel, komponen, hooks |
| [Autentikasi & Otorisasi](auth.md) | Auth, Socialite, roles, permission system |
| [Artisan Commands](artisan-commands.md) | Custom CLI commands dan jadwal |
| [Tutorial](tutorials/index.md) | Panduan langkah-demi-langkah per skenario |
| **Modul Bisnis** | |
| [CRM](modules/crm.md) | Lead, Opportunity, Quotation (pre-sales) |
| [Sales](modules/sales.md) | Sales Orders, Internal Orders, Customers |
| [Purchase](modules/purchase.md) | Purchase Requests, Orders, Receipts, Suppliers |
| [Inventory](modules/inventory.md) | Items, Warehouses, Stock Entries, Delivery Notes |
| [Finances](modules/finances.md) | Invoices, Payments, Accounts, General Ledger |
| [Service](modules/service.md) | Work Orders |
| [Helpdesk](modules/helpdesk.md) | Ticket dukungan internal, integrasi Changelog |
| [Core / Settings](modules/core.md) | Branches, Approval Schemes, FormatingSeries, Print Templates, Todo, Notification |

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
| laravel-react-i18n | ^2.0.5 | https://github.com/xiCO2k/laravel-react-i18n |
| Laravel Breeze | ^2.3 | https://laravel.com/docs/starter-kits |
| Laravel Socialite | ^5.26 | https://laravel.com/docs/socialite |
| PHPUnit | ^11.0 | https://phpunit.de |

## Quick Start

```bash
# Clone dan install
composer install
npm install

# Setup environment
cp .env.example .env
php artisan key:generate

# Migrasi & seed
php artisan migrate --seed

# Jalankan dev server (semua proses sekaligus)
composer run dev
```

Perintah `composer run dev` menjalankan secara paralel:
- PHP Artisan server
- Queue listener
- Log viewer (dev:logs)
- Vite dev server

> Requirement PHP: `^8.2` (composer.json). Project dikembangkan dengan PHP 8.4.

---

## Menjalankan dengan Laravel Herd (Windows)

[Laravel Herd](https://herd.laravel.com) adalah cara tercepat menjalankan aplikasi ini di Windows — sudah membundel PHP, Nginx, dan Node.

### 1. Install & Parking

1. Install Herd dari https://herd.laravel.com.
2. **Park** folder induk project agar Herd otomatis menyajikan semua project di dalamnya:
   - Buka Herd → tab **Sites** → **Add path** → pilih folder induk (mis. `G:\Project App`).
   - Project ter-serve di `http://<nama-folder>.test` → untuk repo ini: **`http://erp.test`**.
3. Pilih versi PHP **8.4** (atau ≥ 8.2) di Herd → tab **PHP**.

### 2. Setup Project

Herd menyediakan binary `php`, `composer`, dan `node`/`npm`. Jalankan dari root project:

```bash
composer install
npm install
cp .env.example .env
php artisan key:generate
php artisan migrate --seed
```

### 3. Konfigurasi `.env` untuk Herd

```dotenv
APP_URL=http://erp.test
# DB — sesuaikan dengan service DB Anda (Herd menyediakan MySQL/Postgres pada plan Pro)
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=erp
DB_USERNAME=root
DB_PASSWORD=
```

### 4. Frontend (Vite)

Herd menyajikan PHP/Nginx, tetapi asset frontend tetap perlu di-build atau dijalankan via Vite:

```bash
npm run dev      # mode pengembangan (HMR) — biarkan berjalan
# atau
npm run build    # build produksi sekali
```

Buka **`http://erp.test`** di browser.

> Jika muncul `Illuminate\Foundation\ViteException: Unable to locate file in Vite manifest`, jalankan `npm run dev` atau `npm run build`.

### 5. Queue & Scheduler (opsional, untuk fitur async)

```bash
php artisan queue:listen --tries=1     # job: index command, sync transaksi
php artisan schedule:work               # scheduler lokal (lihat artisan-commands.md)
```

---

## Menjalankan dengan Xdebug

> **Syarat: Xdebug harus terinstall lebih dahulu.** Versi PHP yang dipakai (via Herd atau CLI) menentukan binary Xdebug yang dibutuhkan.

### 1. Cek apakah Xdebug sudah ada

```bash
php -v          # jika ada "with Xdebug vX.Y.Z" → sudah terinstall
php -m | grep -i xdebug
```

### 2. Install Xdebug

**Via Laravel Herd:** Herd menyediakan toggle Xdebug per versi PHP — buka Herd → tab **PHP** → aktifkan **Xdebug** pada versi yang dipakai. Herd menangani instalasi & konfigurasi `php.ini` otomatis.

**Manual (PHP CLI di luar Herd):**
1. Cek konfigurasi yang cocok di https://xdebug.org/wizard — paste output `php -i` ke wizard.
2. Unduh DLL Xdebug sesuai versi PHP, arsitektur (x64), dan thread-safety (TS/NTS).
3. Letakkan di folder `ext/` PHP, lalu tambahkan ke `php.ini`:

```ini
[xdebug]
zend_extension=xdebug
xdebug.mode=debug,develop
xdebug.start_with_request=yes
xdebug.client_host=127.0.0.1
xdebug.client_port=9003
```

4. Restart PHP/Herd, verifikasi: `php -v` menampilkan baris Xdebug.

### 3. Debugging di IDE

- **VS Code**: install ekstensi *PHP Debug*, buat `launch.json` dengan konfigurasi *Listen for Xdebug* (port `9003`).
- **PhpStorm**: aktifkan *Start Listening for PHP Debug Connections*, set port `9003`.

> `xdebug.mode=debug` memperlambat eksekusi — nonaktifkan (atau set `xdebug.mode=off`) saat tidak debugging untuk performa normal. Untuk profiling pakai `xdebug.mode=profile`.

---

## Struktur Direktori Utama

```
app/
  Console/Commands/     Artisan commands kustom
  Http/
    Controllers/        Controller per modul (Core, Sales, Purchase, dll)
    Middleware/         AppMiddleware (permission), HandleInertiaRequests, dll
    Requests/           FormRequest per modul
  Models/               Model Eloquent per modul
  Services/             Service layer per modul
  Traits/               DataTable, Submitable, LinkModel, TreeView, dll
resources/js/
  Components/           Komponen React reusable
  Hooks/                Custom React hooks
  Layouts/              AppLayout, MasterLayout, GuestLayout
  Pages/                Halaman Inertia per modul
lang/
  en/                   Terjemahan Bahasa Inggris
  id/                   Terjemahan Bahasa Indonesia
routes/
  web.php               Semua web routes
  auth.php              Routes autentikasi (Breeze)
  console.php           Scheduled commands
```
