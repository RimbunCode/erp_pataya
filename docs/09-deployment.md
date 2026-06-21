# Deployment

## Prasyarat Server

| Software | Versi Minimum | Keterangan |
|---------|---------------|------------|
| PHP | 8.4 | Dengan ekstensi: pdo_mysql, mbstring, openssl, tokenizer, xml, ctype, json, bcmath, fileinfo |
| MySQL | 8.0 | |
| Node.js | 20.x (via `.nvmrc`) | Hanya dibutuhkan di CI, tidak di server |
| Composer | 2.x | Hanya di CI |

> **Catatan**: Node.js **tidak perlu** diinstall di server produksi karena frontend sudah di-build menjadi static assets oleh CI sebelum deploy.

---

## Variabel Environment Produksi

Salin `.env.example` ke `.env` dan isi nilai-nilai ini untuk produksi:

```bash
APP_NAME="ERP Inkindo"
APP_ENV=production
APP_DEBUG=false
APP_URL=https://your-domain.com

# Database
DB_CONNECTION=mysql
DB_HOST=localhost
DB_PORT=3306
DB_DATABASE=erp_inkindo_prod
DB_USERNAME=db_user
DB_PASSWORD=strong_password

# Cache & Session
CACHE_STORE=database         # atau redis jika tersedia
SESSION_DRIVER=database      # atau redis
SESSION_LIFETIME=120

# Queue (opsional)
QUEUE_CONNECTION=sync        # atau database/redis

# Mail
MAIL_MAILER=smtp
MAIL_HOST=smtp.provider.com
MAIL_PORT=587
MAIL_USERNAME=noreply@domain.com
MAIL_PASSWORD=mail_password
MAIL_FROM_ADDRESS=noreply@domain.com

# Google OAuth (opsional)
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx
GOOGLE_REDIRECT_URI=https://your-domain.com/auth/google/callback

# Storage
FILESYSTEM_DISK=local        # atau s3 untuk cloud storage
```

---

## Alur CI/CD (GitHub Actions → cPanel)

Pipeline deploy tersimpan di `.github/workflows/deploy-cpanel.yml`.

### Trigger

Deploy berjalan otomatis saat:
- Pull Request ke branch `main` **di-merge** (bukan hanya dibuat)
- Manual trigger via GitHub Actions tab (`workflow_dispatch`)

### Langkah-Langkah Pipeline

```mermaid
flowchart TD
    A([Merge PR ke main]) --> B[Checkout kode]
    B --> C[Setup PHP 8.4 + Composer]
    C --> D[Setup Node.js dari .nvmrc]
    D --> E[Build: composer install --no-dev --optimize-autoloader]
    E --> F[Build: npm ci]
    F --> G[Build: npm run build]
    G --> H[Cleanup: hapus node_modules, resources/js, resources/css]
    H --> I[Package: tar.gz seluruh codebase]
    I --> J[SCP: upload release.tar.gz ke server]
    J --> K[SCP: upload deploy scripts .scripts/*.sh]
    K --> L[SSH: jalankan deploy.sh staging]
    L --> M{Deploy sukses?}
    M -->|Ya| N[Aplikasi live]
    M -->|Tidak| O[Script rollback ke versi sebelumnya]
```

### Zero Downtime Deployment

Script `deploy.sh` menerapkan **blue-green style deployment** dengan symlink:
- Codebase baru di-extract ke direktori baru (versioned)
- Setelah selesai, symlink `current` diupdate ke versi baru
- Jika gagal, symlink dikembalikan ke versi sebelumnya (rollback otomatis)

---

## GitHub Secrets yang Dibutuhkan

Masuk ke **GitHub Repository → Settings → Secrets and variables → Actions**, tambahkan:

| Secret | Contoh Nilai | Keterangan |
|--------|-------------|------------|
| `SSH_HOST` | `server.domain.com` atau IP | Hostname server cPanel |
| `SSH_USER` | `cpanel_username` | Username SSH |
| `SSH_PRIVATE_KEY` | `-----BEGIN RSA PRIVATE KEY-----...` | Private key untuk autentikasi SSH |
| `SSH_PORT` | `22` | Port SSH (biasanya 22) |
| `SSH_PATH` | `/home/username/apps/erp_inkindo` | Path direktori app di server |

---

## Perintah Post-Deploy

Setelah deploy berhasil, jalankan via SSH:

```bash
# Masuk ke direktori aplikasi terbaru
cd /path/to/current

# 1. Jalankan migrasi database (WAJIB jika ada migration baru)
php artisan migrate --force

# 2. Cache konfigurasi untuk performa optimal
php artisan config:cache
php artisan route:cache
php artisan view:cache

# 3. Buat symlink storage (hanya pertama kali atau jika storage baru)
php artisan storage:link

# 4. Restart queue worker (jika menggunakan queue)
php artisan queue:restart
```

> **Penting**: Perintah `php artisan migrate --force` dijalankan tanpa konfirmasi — pastikan backup database sebelum deploy yang mengandung perubahan schema.

---

## Rollback Manual

Jika deploy berhasil secara teknis tapi ada bug yang terdeteksi setelah go-live:

```bash
# Di server, cek versi yang tersedia
ls -la /path/to/apps/

# Ganti symlink ke versi sebelumnya
ln -sfn /path/to/apps/release_20241201_143022 /path/to/current

# Rollback database jika perlu
php artisan migrate:rollback
```

> Rollback database hanya aman jika migration menggunakan `down()` yang benar. Cek `database/migrations/` untuk memastikan setiap migration punya method `down()` yang valid.

---

## Lint CI

File `.github/workflows/lint.yml` menjalankan auto-format sebelum merge:

| Step | Command | Perilaku |
|------|---------|---------|
| Format Frontend | `npx eslint --fix` | Auto-fix, commit hasilnya |
| Run Pint | `./vendor/bin/pint` | Auto-format PHP, commit hasilnya |
| Lint Frontend | `npx eslint` (no fix) | **Fail jika masih ada error** |

Step "Lint Frontend" akan membuat CI **gagal** jika ada ESLint error yang tidak bisa di-fix otomatis — ini mencegah kode bermasalah masuk ke `main`.
