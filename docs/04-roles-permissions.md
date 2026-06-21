# Roles & Permissions

## Empat Role Utama

Setiap user bisa memiliki satu atau lebih role dari empat role yang ada:

| Role | Deskripsi | Dashboard |
|------|-----------|-----------|
| `student` | Mendaftar kursus, belajar, submit tugas | `/student/dashboard` |
| `instructor` | Membuat kursus, mengelola siswa, menerima payout | `/instructor/dashboard` |
| `organization` | Manajemen trainer korporat | `/organization/dashboard` |
| `admin` | Manajemen sistem keseluruhan | `/admin/dashboard` |

Role disimpan di tabel `roles` dan dihubungkan ke user melalui pivot `user_role`.

---

## Admin Sub-Permissions (Granular)

Role `admin` punya sistem permission granular — seorang admin bisa saja hanya punya akses ke modul finance, tidak ke modul lainnya. Permission ini **bukan role**, melainkan entri di tabel `admin_user_permissions`.

| Permission | Akses Modul | Route Middleware |
|------------|-------------|-----------------|
| `super_admin` | Semua modul + assign permissions | `admin.permission:super_admin` |
| `finance_admin` | Verifikasi payment, kelola payout | `admin.permission:finance_admin,super_admin` |
| `course_admin` | Approve/reject publish kursus, kelola kategori | `admin.permission:course_admin,super_admin` |
| `user_admin` | Kelola user, approve role request | `admin.permission:user_admin,super_admin` |
| `content_admin` | Edit landing page & media | `admin.permission:content_admin,super_admin` |

> **Catatan**: `super_admin` selalu punya akses ke semua modul. Jika user punya permission `super_admin`, mereka otomatis bisa mengakses semua modul admin lainnya.

---

## Matriks Akses: Role vs Fitur

| Fitur | Student | Instructor | Admin (sesuai permission) |
|-------|---------|------------|--------------------------|
| Browse katalog kursus | ✓ | ✓ | — |
| Daftar kursus & bayar | ✓ | — | — |
| Akses konten kursus | ✓ (enrolled) | — | — |
| Submit tugas | ✓ | — | — |
| Lihat nilai & feedback | ✓ | — | — |
| Ajukan role instructor | ✓ | — | — |
| Buat & edit kursus | — | ✓ (milik sendiri) | — |
| Upload materi & file | — | ✓ (milik sendiri) | — |
| Submit publish request | — | ✓ (milik sendiri) | — |
| Nilai tugas siswa | — | ✓ (kursus sendiri) | — |
| Lihat earning & payout | — | ✓ (milik sendiri) | — |
| Approve/reject kursus | — | — | course_admin / super_admin |
| Verifikasi payment | — | — | finance_admin / super_admin |
| Approve/reject payout | — | — | finance_admin / super_admin |
| Approve role request | — | — | user_admin / super_admin |
| Nonaktifkan user | — | — | user_admin / super_admin |
| Assign admin permission | — | — | super_admin |
| Edit landing page | — | — | content_admin / super_admin |
| Kelola kategori kursus | — | — | course_admin / super_admin |

---

## Middleware Chain

Laravel menerapkan akses kontrol via middleware yang dijalankan sebelum controller.

### Untuk Role Biasa

```
Request
  → auth             (cek: user sudah login?)
  → role:student     (cek: user punya role "student"?)
  → EnsureUserIsOnboarded  (cek: setup sudah selesai?)
  → Controller
```

### Untuk Admin dengan Sub-Permission

```
Request
  → auth
  → role:admin
  → admin.permission:finance_admin,super_admin
       (cek: user punya salah satu dari dua permission ini?)
  → Controller
```

### Kode di `routes/web.php`

```php
// Student routes
Route::middleware(['auth', 'role:student'])->prefix('student')->group(function () {
    Route::get('/dashboard', [StudentDashboardController::class, 'index']);
    // ...
});

// Admin finance routes
Route::middleware(['auth', 'role:admin', 'admin.permission:finance_admin,super_admin'])
    ->prefix('admin')
    ->group(function () {
        Route::get('/finance', [SystemFinanceController::class, 'index']);
        // ...
    });
```

---

## Multi-Role System

User bisa memiliki beberapa role sekaligus. Contoh: user `multi@inkindo.test` punya role `student` dan `instructor` sekaligus.

### Skenario Login Multi-Role

1. User masukkan email & password → autentikasi berhasil
2. Sistem deteksi user punya 2+ role
3. User diarahkan ke halaman **Select Role** (`/auth/select-role`)
4. User pilih role yang ingin digunakan saat ini
5. Role yang dipilih disimpan di cookie `last_active_role`
6. User diarahkan ke dashboard role yang dipilih

### Berpindah Role

Pengguna multi-role bisa berpindah role tanpa logout:
- Klik menu role switcher di sidebar/navbar
- Sistem redirect ke dashboard role yang baru dipilih
- Cookie `last_active_role` diperbarui

### RoleMiddleware — Cara Kerja

```php
// app/Http/Middleware/RoleMiddleware.php
public function handle(Request $request, Closure $next, string ...$roles): Response {
    $user = $request->user();

    // 1. Cek: user sudah login?
    if (!$user) return redirect('/guest');

    // 2. Normalize roles user (lowercase, deduplikasi)
    $userRoles = $this->roleResolver->normalizeRoles(
        $user->roles->pluck('name')->toArray()
    );

    // 3. Cek: user punya salah satu role yang diminta?
    $hasRole = count(array_intersect($requiredRoles, $userRoles)) > 0;
    if (!$hasRole) abort(403);

    // 4. Update cookie last_active_role
    // ...

    return $next($request);
}
```

---

## Authorization di Controller

Selain middleware, beberapa controller menerapkan **object-level authorization** — memastikan user hanya bisa mengubah data miliknya sendiri.

```php
// Contoh di CourseController
public function update(Request $request, Course $course) {
    // Pastikan instruktur hanya bisa edit kursus MILIKNYA
    if ($course->created_by !== Auth::id()) {
        abort(403);
    }
    // ...
}
```

Pola ini diterapkan di semua endpoint Instructor course management:
- `CourseController`: show, update, togglePublish, updateThumbnail
- `CourseSectionController`: store, update, destroy
- `CourseContentController`: store, update, destroy, upload, destroyFile

---

## Konfigurasi & Seeding

Permission di-seed via `AdminPermissionSeeder`. Test user dan permission-nya di-seed via `UserSeeder` dan `AdminPermissionSeeder`.

Lihat [Setup Lokal](01-setup.md) untuk daftar akun test beserta permission-nya.

---

## Dokumen Terkait

- [17 — API Reference](./17-api-reference.md) — Daftar lengkap endpoint dengan permission requirement
- [11 — User Journeys](./11-user-journeys.md) — Alur perjalanan per role
- [13 — Alur Fitur](./13-feature-flows.md) — Flow diagram untuk setiap fitur berdasarkan role
- [19 — Developer Guide](./19-developer-guide.md) — Cara menambah permission baru

