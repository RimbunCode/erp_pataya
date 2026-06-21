# Service Layer

Service classes memisahkan business logic yang kompleks dari controller. Controller bertanggung jawab untuk menerima request dan mengembalikan response; service bertanggung jawab untuk keputusan bisnis dan data manipulation.

---

## Daftar Service Classes

### `InstructorPayoutService`

**File**: `app/Services/Finance/InstructorPayoutService.php`  
**Tanggung Jawab**: Kalkulasi earning instruktur, manajemen payout request, konfigurasi fee

| Method | Signature | Keterangan |
|--------|-----------|------------|
| `createEarningFromApprovedPayment` | `(Payment $payment): InstructorEarning` | Hitung dan simpan earning instruktur dari payment yang baru disetujui. Mengambil `company_fee_percentage` dan `payout_delay_days` dari DB. |
| `calculateEligibleBalance` | `(User $instructor): float` | Hitung total balance yang sudah available dan belum reserved oleh payout request aktif. |
| `calculateGlobalEligibleBalance` | `(): float` | Hitung total eligible balance untuk semua instruktur (untuk batch payout). |
| `queryEligibleEarnings` | `(string $instructorId): Collection` | Ambil collection earning yang eligible untuk dijadikan payout. |
| `createInstructorRequest` | `(User $instructor, float $amount, ?string $note): InstructorPayoutRequest` | Buat payout request manual dari instruktur. Validasi amount <= balance available. Wrapped dalam `DB::transaction`. |
| `runBatchPayout` | `(): array` | Scan semua instruktur, buat draft payout requests untuk yang eligible. Return summary hasil. |
| `resolvePayoutDelayDays` | `(): int` | Baca setting `payout_delay_days` dari tabel `preferences`. |
| `updatePayoutDelayDays` | `(int $days): void` | Update setting delay. |
| `resolveCompanyFeePercentage` | `(): float` | Baca setting `company_fee_percentage`. |
| `updateCompanyFeePercentage` | `(float $pct): void` | Update setting fee. |

**Contoh penggunaan:**
```php
// Di SystemFinanceController::approve()
$this->payoutService->createEarningFromApprovedPayment($payment);
```

---

### `AdminPermissionService`

**File**: `app/Services/Admin/AdminPermissionService.php`  
**Tanggung Jawab**: Resolve dan sync permission admin, proteksi super_admin

| Method | Signature | Keterangan |
|--------|-----------|------------|
| `resolveUserPermissionNames` | `(User $user): array<string>` | Ambil nama-nama permission yang dimiliki user. Result di-cache in-memory. |
| `userHasPermission` | `(User $user, string $permission): bool` | Cek apakah user punya permission tertentu. |
| `syncPermissions` | `(User $user, array $names): void` | Set permission user secara eksplisit. Soft-delete yang lama, tambah yang baru. Validasi minimal 1 super_admin tetap ada. |
| `countSuperAdmins` | `(): int` | Hitung jumlah user yang punya permission super_admin. |

**Konstanta penting:**
```php
public const ALLOWED_PERMISSION_NAMES = [
    'finance_admin', 'course_admin', 'user_admin', 'content_admin', 'super_admin'
];
```

---

### `UserTransformer`

**File**: `app/Services/Admin/UserTransformer.php`  
**Tanggung Jawab**: Transform data user untuk tampilan di UI (avatar initials, format tampilan)

| Method | Signature | Keterangan |
|--------|-----------|------------|
| `transform` | `(User $user): array` | Ubah model User menjadi array siap tampil, termasuk `initials` dari nama |

Menggunakan trait `HasInitials` untuk generate inisial avatar (contoh: "John Doe" → "JD").

---

### `RoleResolver`

**File**: `app/Services/Auth/RoleResolver.php`  
**Tanggung Jawab**: Resolve role user yang aktif, normalize nama role

| Method | Signature | Keterangan |
|--------|-----------|------------|
| `normalizeRoles` | `(array $roles): array` | Lowercase dan deduplikasi nama role |
| `resolveActiveRole` | `(User $user, Request $request): string\|null` | Baca role aktif dari cookie `last_active_role`, validasi masih dimiliki user |
| `getDefaultRole` | `(User $user): string\|null` | Ambil role pertama user jika belum ada cookie |

---

### `UserRoleManager`

**File**: `app/Services/Auth/UserRoleManager.php`  
**Tanggung Jawab**: Attach/detach role ke user, validasi business rules

| Method | Signature | Keterangan |
|--------|-----------|------------|
| `attachRole` | `(User $user, string $roleName): void` | Tambah role ke user jika belum punya |
| `detachRole` | `(User $user, string $roleName): void` | Hapus role dari user |
| `hasRole` | `(User $user, string $roleName): bool` | Cek apakah user punya role tertentu |

---

### `LoginCredentialVerifier`

**File**: `app/Services/Auth/LoginCredentialVerifier.php`  
**Tanggung Jawab**: Verifikasi kredensial login, cek status user

| Method | Signature | Keterangan |
|--------|-----------|------------|
| `verify` | `(string $email, string $password): User` | Cek email + password, cek status aktif/inactive. Throw `ValidationException` jika gagal. |

---

### `CourseProgressService`

**File**: `app/Services/CourseProgressService.php`  
**Tanggung Jawab**: Kalkulasi progress belajar siswa per enrollment

| Method | Signature | Keterangan |
|--------|-----------|------------|
| `calculateProgress` | `(Enrollment $enrollment): float` | Return progress % (0.0 - 100.0) |
| `isCompleted` | `(Enrollment $enrollment): bool` | Return true jika progress = 100% |
| `getCompletedContentIds` | `(Enrollment $enrollment): array` | Array ID konten yang sudah diselesaikan |

**Rumus**:
```
required_contents = content yang is_required = true
completed = UserProgress (is_completed=true) + Submission (exists)
progress% = (completed / total_required) × 100
```

---

### `StudentProgressBuilder`

**File**: `app/Services/Instructor/StudentProgressBuilder.php`  
**Tanggung Jawab**: Build data progress siswa lengkap untuk tampilan instruktur

| Method | Signature | Keterangan |
|--------|-----------|------------|
| `buildForEnrollment` | `(Enrollment $enrollment): array` | Return struktur data lengkap: course, sections, contents, progress per student, submissions, grades |

Digunakan di `StudentManagementController` untuk menampilkan detail progress tiap siswa di kursus instruktur.

---

### `GuestPageContentService`

**File**: `app/Services/Guest/GuestPageContentService.php`  
**Tanggung Jawab**: Ambil konten landing page dari DB (LandingPageSetting model)

| Method | Signature | Keterangan |
|--------|-----------|------------|
| `getContent` | `(): array` | Ambil semua setting landing page sebagai key-value array |
| `updateContent` | `(array $data): void` | Update setting landing page |

---

### Core Services (Internal)

| Service | File | Tanggung Jawab |
|---------|------|---------------|
| `DashboardService` | `app/Services/Core/DashboardService.php` | Build data untuk komponen dashboard chart |
| `FormatingSeriesService` | `app/Services/Core/FormatingSeriesService.php` | Format data series untuk chart (Recharts) |
| `WidgetService` | `app/Services/Core/WidgetService.php` | Resolve dan render widget di halaman dashboard |

---

## Pola Penggunaan di Controller

```php
// Dependency injection via constructor
class SystemFinanceController extends Controller {
    public function __construct(
        private readonly InstructorPayoutService $payoutService
    ) {}

    public function approve(Payment $payment) {
        DB::transaction(function () use ($payment) {
            $payment->update(['status' => 'approved', ...]);
            $this->payoutService->createEarningFromApprovedPayment($payment);
        });

        return back()->with('success', 'Payment disetujui');
    }
}
```

---

## Dokumen Terkait

- [13 — Alur Fitur](./13-feature-flows.md) — Flowchart detail yang melibatkan service-service ini
- [16 — Sequence Diagrams](./16-sequence-diagrams.md) — Interaksi timeline antara controller dan service
- [19 — Developer Guide](./19-developer-guide.md) — Pattern service layer dan cara membuat service baru

