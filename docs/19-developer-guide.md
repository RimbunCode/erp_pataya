# Developer Guide — Panduan Developer

Dokumen ini berisi workflow umum untuk developer baru, pattern yang digunakan di codebase, dan panduan onboarding.

---

## Daftar Isi

1. [Developer Workflows](#1-developer-workflows)
2. [Backend Patterns Reference](#2-backend-patterns-reference)
3. [Developer Onboarding Path](#3-developer-onboarding-path)

---

## 1. Developer Workflows

### 1.1 Tambah Fitur Baru untuk Student

**Contoh:** Menambahkan halaman "Sertifikat Saya"

1. **Buat Controller** di `app/Http/Controllers/Student/`:
   ```bash
   php artisan make:controller Student/CertificateController
   ```

2. **Definisikan Route** di `routes/web.php` dalam group `role:student`:
   ```php
   Route::middleware(['role:student'])->prefix('/student')->group(function () {
       // ... existing routes
       Route::get('/certificates', [CertificateController::class, 'index'])
           ->name('student.certificates');
   });
   ```

3. **Buat Inertia Page** di `resources/js/Pages/Students/`:
   ```bash
   # Buat file React component, misal Certificates.jsx
   ```

4. **Controller mengembalikan Inertia response**:
   ```php
   public function index() {
       return Inertia::render('Students/Certificates', [
           'certificates' => $data,
       ]);
   }
   ```

5. **Test** alur dari browser sebagai student.

---

### 1.2 Tambah Fitur Baru untuk Instructor

**Contoh:** Menambahkan halaman "Analytics"

1. **Buat Controller** di `app/Http/Controllers/Instructor/`:
   ```bash
   php artisan make:controller Instructor/AnalyticsController
   ```

2. **Definisikan Route** di `routes/web.php` dalam group `role:instructor`:
   ```php
   Route::middleware(['role:instructor'])->prefix('/instructor')->name('instructor.')->group(function () {
       // ... existing routes
       Route::get('/analytics', [AnalyticsController::class, 'index'])->name('analytics');
   });
   ```

3. **Query data** dari course milik instruktur (selalu filter `created_by = Auth::id()`).

4. **Buat Inertia Page** di `resources/js/Pages/Instructors/`.

5. **Test** sebagai instructor.

---

### 1.3 Tambah Modul Admin Baru

**Contoh:** Menambahkan "Content Management" untuk content_admin

1. **Buat Controller** di `app/Http/Controllers/Admin/`:
   ```bash
   php artisan make:controller Admin/ContentManagementController
   ```

2. **Definisikan Route** di `routes/web.php` dalam group admin dengan permission middleware:
   ```php
   Route::middleware(['role:admin'])->prefix('/admin')->name('admin.')->group(function () {
       Route::middleware(['admin.permission:content_admin,super_admin'])->group(function () {
           Route::get('/content', [ContentManagementController::class, 'index'])->name('content');
           // ... more routes
       });
   });
   ```

3. **Buat Inertia Page** di `resources/js/Pages/Admin/`.

4. **Pastikan permission terdaftar** di tabel `permissions` jika membuat permission baru.

---

### 1.4 Tambah Payment Status Baru

1. **Tambahkan case** di `app/FormStatus.php` jika status baru belum ada:
   ```php
   case NEW_STATUS = 'new_status';
   ```

2. **Update Controller** yang relevan:
   - `SystemFinanceController` — jika admin yang mengubah
   - `EnrollmentController` — jika mempengaruhi checkout
   - `InstructorPayoutService` — jika mempengaruhi earning

3. **Update State Machine** di docs [`14-state-machines.md`](./14-state-machines.md).

4. **Update frontend** — komponen status badge di React pages.

5. **Write test** untuk transisi status baru.

---

### 1.5 Buat Model Baru dengan Migration

```bash
php artisan make:model ModelName --migration --factory --seeder
```

**Konvensi yang harus diikuti:**

1. **Primary Key ULID** — gunakan di migration:
   ```php
   $table->ulid('id')->primary();
   ```

2. **Soft Deletes** — jika data kritis:
   ```php
   $table->softDeletes();
   ```

3. **Timestamps** — selalu include:
   ```php
   $table->timestamps();
   ```

4. **Model extends base Model:**
   ```php
   use App\Models\Model; // bukan Illuminate\Database\Eloquent\Model
   
   class NewModel extends Model {
       use HasUlids; // auto ULID primary key
       use SoftDeletes; // jika perlu
   }
   ```

5. **Foreign Key naming:**
   ```php
   $table->foreignUlid('course_id')->references('id')->on('courses')->cascadeOnDelete();
   ```

6. **Buat Factory** dengan data faker yang realistis.

7. **Buat Seeder** jika perlu data awal.

---

### 1.6 Tambah Admin Permission Baru

1. **Buat record** di tabel `permissions`:
   ```php
   // Dalam seeder atau migration
   Permission::create([
       'module' => 'nama_modul',
       'name' => 'new_permission',
       'model' => 'ModelName',
       'permissions' => ['view', 'write'],
   ]);
   ```

2. **Daftarkan middleware** di route group:
   ```php
   Route::middleware(['admin.permission:new_permission,super_admin'])->group(function () {
       // routes
   });
   ```

3. **Update `AdminPermissionService`** jika ada logic khusus untuk permission baru.

4. **Update frontend** di `Admin/UserDirectory` — form permission assignment.

---

## 2. Backend Patterns Reference

### 2.1 Service Layer Pattern

**Kapan digunakan:** Ketika business logic kompleks dan digunakan oleh lebih dari satu controller.

**Contoh services yang ada:**
| Service | Lokasi | Tanggung Jawab |
|---------|--------|----------------|
| `InstructorPayoutService` | `app/Services/Finance/` | Semua logic payout: earning creation, balance calculation, batch generation |
| `CourseProgressService` | `app/Services/` | Progress calculation, module building, status resolution |
| `RoleResolver` | `app/Services/Auth/` | Role normalization, dashboard path, cookie management |
| `LoginCredentialVerifier` | `app/Services/Auth/` | Credential validation, rate limiting |
| `AdminPermissionService` | `app/Services/Admin/` | Permission checking, syncing, protection |
| `GuestPageContentService` | `app/Services/Guest/` | Landing page content assembly |

**Cara buat service baru:**
```bash
php artisan make:class Services/MyFeatureService
```

**Pattern:**
- Inject via constructor di controller
- Return domain objects (models, collections), bukan HTTP responses
- Gunakan `ValidationException::withMessages()` untuk business rule violations

### 2.2 Trait Usage

| Trait | Lokasi | Kegunaan |
|-------|--------|----------|
| `Submitable` | `app/Traits/` | Workflow submit/cancel/amend untuk dokumen |
| `DataTable` | `app/Traits/` | Backend datatable untuk ModelController |
| `HasInitials` | `app/Traits/` | Generate inisial dari nama user |
| `LinkModel` | `app/Traits/` | Utility untuk load semua relasi |
| `HasCountry` | `app/Traits/` | Relasi ke country |
| `TreeView` | `app/Traits/` | Hierarchical data display |
| `BackupDatabase` | `app/Traits/` | Database backup utility |

### 2.3 ULID + SoftDeletes Convention

Semua model domain menggunakan:
- **ULID** sebagai primary key (string 26 karakter, sortable)
- **SoftDeletes** untuk data yang tidak boleh hilang permanen

```php
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;

class Course extends Model {
    use HasUlids, SoftDeletes;
}
```

### 2.4 BaseProfileController Template Method

Pattern untuk profile controllers (Student, Instructor, Admin):

```php
abstract class BaseProfileController extends Controller {
    abstract public function index();                    // render halaman
    abstract protected function validationRules(): array; // validasi update
    abstract protected function updateProfileData(Request $request): void; // simpan data profil

    // Template methods (sudah diimplementasi):
    public function update(Request $request)     // common update flow
    public function updateAvatar(Request $request) // common avatar upload
    public function destroyImage()               // common image delete
}
```

Setiap role meng-extend dan implement abstract methods.

### 2.5 Middleware Chain

```
auth → role:X → admin.permission:Y
```

| Middleware | Class | Fungsi |
|-----------|-------|--------|
| `auth` | Laravel built-in | Pastikan user login |
| `role` | `RoleMiddleware` | Cek user punya role X; set cookie `last_active_role` |
| `admin.permission` | `AdminModulePermissionMiddleware` | Cek admin punya permission Y atau super_admin |

### 2.6 FormRequest Pattern

Validasi kompleks dipisah ke FormRequest class:

```
app/Http/Requests/
├── Admin/
│   ├── MarkPayoutPaidRequest.php
│   ├── RejectPayoutRequestRequest.php
│   ├── RejectCoursePublishRequestRequest.php
│   ├── UpdateAdminPermissionsRequest.php
│   ├── UpdateCompanyFeeRequest.php
│   ├── UpdatePayoutDelayRequest.php
│   └── UpdateUserStatusRequest.php
├── Auth/
│   ├── LoginRequest.php
│   ├── LoginRolesRequest.php
│   ├── SelectRoleRequest.php
│   └── SetupUserRequest.php
└── Instructor/
    └── StorePayoutRequestRequest.php
```

### 2.7 DataTable Backend (ModelController)

`ModelController` menyediakan endpoint generic untuk datatable:
- `POST /model` — get model data
- `POST /model/datatable` — datatable query
- `GET /model/{model}` — get columns

Digunakan oleh fitur legacy dari ERP core.

### 2.8 Inertia Response Pattern

Semua controller mengembalikan Inertia response:

```php
return Inertia::render('Folder/PageName', [
    'propName' => $data,
    'anotherProp' => $value,
]);
```

File React page berada di `resources/js/Pages/` dengan struktur folder sesuai role:
```
resources/js/Pages/
├── Students/    → Student pages
├── Instructors/ → Instructor pages
├── Admin/       → Admin pages
├── Auth/        → Login, Register, Setup
└── Guest/       → Public pages
```

---

## 3. Developer Onboarding Path

### 3.1 Urutan Membaca Dokumentasi

Untuk developer baru, ikuti urutan ini:

1. **[`01-setup.md`](./01-setup.md)** — Setup environment development
2. **[`02-architecture.md`](./02-architecture.md)** — Pahami arsitektur umum
3. **[`04-roles-permissions.md`](./04-roles-permissions.md)** — Pahami sistem role
4. **[`05-routes.md`](./05-routes.md)** — Pahami routing
5. **[`11-user-journeys.md`](./11-user-journeys.md)** — Pahami pengalaman user per role
6. **[`03-database.md`](./03-database.md)** — Pahami schema database
7. **[`10-diagrams.md`](./10-diagrams.md)** — Lihat diagram ringkas
8. **[`06-modules/`](./06-modules/)** — Baca modul yang akan dikerjakan
9. **[`13-feature-flows.md`](./13-feature-flows.md)** — Detail alur fitur
10. **[`17-api-reference.md`](./17-api-reference.md)** — Referensi endpoint

### 3.2 Mini Tasks untuk Hands-on Learning

**Level 1 — Pemula:**
- [ ] Login sebagai student, browse course catalogue
- [ ] Login sebagai instructor, lihat dashboard
- [ ] Login sebagai admin, buka halaman finance
- [ ] Baca file `routes/web.php` dan identifikasi semua role groups

**Level 2 — Menengah:**
- [ ] Tambah kolom baru ke model Course (buat migration + update controller)
- [ ] Buat halaman baru di student section
- [ ] Modifikasi tampilan dashboard instructor

**Level 3 — Lanjut:**
- [ ] Tambah fitur approval workflow baru
- [ ] Buat service class baru untuk business logic
- [ ] Implementasi fitur yang melibatkan multi-role (admin approve, instructor submit)

### 3.3 Struktur Direktori Penting

```
app/
├── Http/
│   ├── Controllers/
│   │   ├── Admin/        → Controllers admin
│   │   ├── Auth/         → Login, register, setup
│   │   ├── Instructor/   → Controllers instruktur
│   │   ├── Student/      → Controllers student
│   │   ├── Guest/        → Halaman publik
│   │   └── Core/         → Shared controllers (File, Language)
│   ├── Middleware/        → Role, Permission, etc.
│   └── Requests/         → Form validation
├── Models/
│   ├── Core/             → Framework models (File, Tag, etc.)
│   ├── Finance/          → Earning, Payout
│   ├── User/             → User, Role, Permission
│   └── *.php             → Domain models (Course, Payment, etc.)
├── Services/
│   ├── Admin/            → Admin business logic
│   ├── Auth/             → Login, role resolution
│   ├── Finance/          → Payout calculations
│   └── *.php             → Shared services
├── Traits/               → Reusable model behaviors
└── FormStatus.php        → Enum semua status

resources/js/Pages/       → React pages (Inertia)
routes/                   → Route definitions
database/migrations/      → Database migrations
```

### 3.4 Tips Development

1. **Cek sibling files** sebelum membuat file baru — ikuti konvensi yang ada
2. **Gunakan `Inertia::render()`** bukan Blade views untuk semua halaman
3. **Filter `created_by = Auth::id()`** untuk data instructor (security)
4. **Selalu gunakan DB::transaction** untuk operasi yang mengubah banyak tabel
5. **Gunakan `ValidationException::withMessages()`** untuk business rule errors
6. **Redirect dengan `back()->with('success', '...')`** setelah operasi berhasil
7. **Cek `FormStatus` enum** sebelum hardcode status string
8. **Test dengan `php artisan test --compact`** setelah perubahan
