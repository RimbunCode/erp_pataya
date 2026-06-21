# Setup Lokal

Panduan ini memandu kamu dari nol hingga aplikasi berjalan di komputer lokal.

## Prasyarat

Pastikan software berikut sudah terpasang:

| Software | Versi Minimum | Cara Cek |
|----------|---------------|----------|
| PHP | 8.2+ | `php --version` |
| Composer | 2.x | `composer --version` |
| Node.js | 18+ (lihat `.nvmrc`) | `node --version` |
| npm | 9+ | `npm --version` |
| MySQL | 8.0+ | `mysql --version` |

> **Tips**: Gunakan [nvm](https://github.com/nvm-sh/nvm) untuk mengelola versi Node.js. Jalankan `nvm use` di root proyek untuk otomatis memakai versi yang benar dari `.nvmrc`.

---

## Langkah Instalasi

### 1. Clone Repositori

```bash
git clone <repo-url>
cd erp_inkindo
```

### 2. Install Dependensi PHP

```bash
composer install
```

### 3. Install Dependensi JavaScript

```bash
npm install
```

### 4. Konfigurasi Environment

```bash
cp .env.example .env
```

Buka `.env` dan isi variabel berikut (minimal):

```env
APP_URL=http://localhost:8000

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=erp_inkindo
DB_USERNAME=root
DB_PASSWORD=your_password
```

Variabel opsional untuk fitur tambahan:

```env
# Google OAuth (untuk login via Google)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT="${APP_URL}/auth/google/callback"

# SSR (Server-Side Rendering) — matikan dulu saat development awal
SSR=false
```

### 5. Generate App Key

```bash
php artisan key:generate
```

### 6. Buat Database

Buat database baru di MySQL:

```sql
CREATE DATABASE erp_inkindo CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 7. Jalankan Migrasi & Seeder

```bash
php artisan migrate --seed
```

Perintah ini akan:
- Membuat semua tabel database
- Mengisi data awal: roles, permissions, 8 akun test, kategori kursus

### 8. Buat Symlink Storage

```bash
php artisan storage:link
```

---

## Menjalankan Development Server

Buka **dua terminal terpisah**:

**Terminal 1 — Laravel Backend:**
```bash
php artisan serve
```

**Terminal 2 — Vite Frontend (hot reload):**
```bash
npm run dev
```

Buka browser ke `http://localhost:8000`.

---

## Akun Test

Setelah seeder berjalan, akun berikut tersedia. Semua menggunakan password `password`.

| Email | Role | Akses |
|-------|------|-------|
| `student@inkindo.test` | Student | Katalog, enrollment, progres belajar |
| `instructor@inkindo.test` | Instructor | Buat kursus, kelola siswa, payout |
| `admin@inkindo.test` | Admin (Super) | Semua fitur admin |
| `finance.admin@inkindo.test` | Admin (Finance) | Verifikasi payment & payout |
| `course.admin@inkindo.test` | Admin (Course) | Approve/reject publish kursus |
| `user.admin@inkindo.test` | Admin (User) | Kelola user & role request |
| `content.admin@inkindo.test` | Admin (Content) | Landing page settings |
| `multi@inkindo.test` | Student + Instructor | Bisa beralih antara dua role |

---

## Catatan SSR (Server-Side Rendering)

Aplikasi ini mendukung SSR via Inertia.js. Saat `SSR=true` di `.env`, kamu perlu build frontend terlebih dahulu:

```bash
npm run build
php artisan inertia:start-ssr
```

Untuk development sehari-hari, set `SSR=false` agar bisa pakai hot reload (`npm run dev`).

---

## Menjalankan Test

```bash
php artisan test
```

Test menggunakan database SQLite in-memory (dikonfigurasi di `phpunit.xml`), jadi tidak akan mengubah database development kamu.

---

## Perintah Artisan yang Sering Dipakai

```bash
# Reset database (hati-hati di production!)
php artisan migrate:fresh --seed

# Bersihkan cache
php artisan config:clear
php artisan cache:clear
php artisan route:clear

# Lihat semua route
php artisan route:list

# Jalankan payout batch (untuk testing finance)
php artisan payout:batch --dry-run
```

---

## Troubleshooting

**Masalah: halaman error "No application encryption key"**
```bash
php artisan key:generate
```

**Masalah: gambar/file tidak muncul**
```bash
php artisan storage:link
```

**Masalah: `npm run dev` error**
```bash
rm -rf node_modules
npm install
npm run dev
```

**Masalah: class not found setelah pull**
```bash
composer dump-autoload
```
