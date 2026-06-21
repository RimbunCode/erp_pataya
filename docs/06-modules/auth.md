# Modul Autentikasi

## Ringkasan

Autentikasi menangani: registrasi user baru, setup profil untuk user yang diundang, login dengan rate limiting, pemilihan role untuk multi-role user, dan login via Google OAuth.

---

## Alur Registrasi

```mermaid
flowchart TD
    A([User buka /auth/register]) --> B[Isi form: name, email, password]
    B --> C{Email sudah ada di DB?}
    C -->|Ya, status=INVITED| D[Update user existing\nisi password + name]
    C -->|Tidak| E[Buat user baru\nstatus = pending]
    C -->|Ya, sudah aktif| F[Tampilkan error:\nEmail sudah terdaftar]
    D --> G[Attach role student]
    E --> G
    G --> H[Login otomatis]
    H --> I{Punya 2+ role?}
    I -->|Ya| J[Redirect ke /auth/select-role]
    I -->|Tidak| K[Redirect ke /student/dashboard]
    J --> L[User pilih role aktif]
    L --> M[Set cookie last_active_role]
    M --> N[Redirect ke dashboard role]
```

**Catatan penting:**
- User yang pernah diundang (status `INVITED`) bisa menyelesaikan registrasi mereka dengan mengisi form registrasi normal — sistem otomatis mendeteksi dan mengupdate record yang ada
- Password di-hash dengan `bcrypt` sebelum disimpan
- Email verifikasi tidak wajib untuk dapat mengakses dashboard (bergantung konfigurasi)

---

## Alur Setup User (INVITED)

User yang diundang oleh admin tidak punya password awalnya. Mereka perlu menyelesaikan setup:

```mermaid
flowchart TD
    A([User klik link invite di email]) --> B[Redirect ke /auth/setup]
    B --> C[Isi form: name, username, password, konfirmasi password]
    C --> D{Validasi form}
    D -->|Gagal| E[Tampilkan error validasi]
    E --> C
    D -->|Berhasil| F[Update user: password, name, username]
    F --> G[Update status user = active]
    G --> H[Login otomatis]
    H --> I[Redirect ke dashboard role]
```

---

## Alur Login

```mermaid
flowchart TD
    A([User buka /auth/login]) --> B[Isi email + password]
    B --> C{Rate limit check\nmaks 5 percobaan / menit}
    C -->|Limit tercapai| D[Tampilkan error:\nTerlalu banyak percobaan]
    D --> E([Tunggu 1 menit])
    C -->|OK| F{Email ada di DB?}
    F -->|Tidak| G[Tampilkan error: Kredensial tidak valid]
    F -->|Ya| H{Password cocok?}
    H -->|Tidak| G
    H -->|Ya| I{Status user?}
    I -->|inactive| J[Tampilkan pesan:\nAkun nonaktif + alasan]
    I -->|pending / active| K[Login berhasil]
    K --> L{Punya 2+ role?}
    L -->|Ya| M[Redirect ke /auth/select-role]
    L -->|Tidak| N[Set cookie last_active_role]
    N --> O[Redirect ke dashboard role]
    M --> P[User pilih role]
    P --> N
```

**Catatan:**
- Laravel Throttle middleware membatasi 5 percobaan login per 1 menit per IP
- User dengan status `inactive` tidak bisa login; pesan alasan nonaktif ditampilkan
- User dengan status `pending` (belum verify email atau belum setup) bisa login, tapi diarahkan ke halaman setup/verifikasi

---

## Alur Pemilihan Role (Multi-Role)

```mermaid
flowchart TD
    A([Login berhasil, user punya 2+ role]) --> B[Redirect ke /auth/select-role]
    B --> C[Tampilkan daftar role yang dimiliki user]
    C --> D[User klik role yang diinginkan]
    D --> E[Set cookie last_active_role = role_dipilih]
    E --> F[Redirect ke /role_dipilih/dashboard]
```

Halaman ini juga memungkinkan user untuk switch role kapan saja dari dalam aplikasi tanpa perlu logout, melalui menu role switcher di sidebar.

---

## Alur Google OAuth

```mermaid
flowchart TD
    A([User klik Login with Google]) --> B[Redirect ke /auth/google]
    B --> C[Redirect ke halaman consent Google]
    C --> D{User setujui?}
    D -->|Tidak| E[Redirect kembali ke login]
    D -->|Ya| F[Google callback ke /auth/google/callback]
    F --> G{Email user sudah ada di DB?}
    G -->|Ya| H[Login dengan user existing]
    G -->|Tidak| I[Buat user baru dari data Google\nname, email, google_id, avatar]
    I --> J[Assign role student]
    J --> H
    H --> K{Punya 2+ role?}
    K -->|Ya| L[Redirect ke /auth/select-role]
    K -->|Tidak| M[Redirect ke /student/dashboard]
```

**Implementasi**: `app/Http/Controllers/Auth/SocialAuthController.php` menggunakan `Laravel Socialite` untuk handle OAuth flow.

---

## Middleware yang Relevan

| Middleware | Kelas | Tujuan |
|-----------|-------|--------|
| `auth` | `Authenticate` | Cek user sudah login |
| `guest` | `RedirectIfAuthenticated` | Redirect ke dashboard jika sudah login |
| `throttle:login` | `ThrottleRequests` | Rate limit login 5x/menit |
| `verified` | `EnsureEmailIsVerified` | Wajib verifikasi email (jika aktif) |
| `EnsureUserIsOnboarded` | Custom | Cek setup sudah selesai |
