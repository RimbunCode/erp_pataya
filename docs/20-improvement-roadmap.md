# Roadmap Perbaikan ERP INKINDO — Keamanan, Efisiensi Data, Arsitektur, Higiene

> Hasil review menyeluruh repo (2026-07-04). Setiap fase bisa di-ship terpisah; setiap item wajib ada test PHPUnit (AGENTS.md); `vendor/bin/pint --dirty --format agent` setelah tiap perubahan PHP; migrations harus jalan di SQLite (`:memory:`).

## Context

Review menemukan masalah nyata di empat lapis:

1. **Keamanan/kebenaran**: `ProgressController::store` tanpa cek enrollment (siswa mana pun bisa menandai konten kursus mana pun selesai — dan ini memengaruhi kelayakan sertifikat); celah grading lintas kursus di `Instructor/SubmissionController`; `generateCredentialId` pakai `Certificate::count()+1` (race + duplikat setelah delete → 500 karena unique constraint); tidak ada Policies sama sekali, cek `created_by !== Auth::id()` diduplikasi ~13 titik di 4 controller instructor.
2. **Efisiensi data**: `SystemFinanceController::index` dan `UserDirectoryController::index` memuat SEMUA record tanpa pagination (payload bisa puluhan MB); katalog publik tanpa pagination; Student dashboard/course-list memuat pohon `course.sections.contents.files` penuh; nol penggunaan `Cache::remember`; nol Inertia v2 deferred props; index hilang di kolom filter panas (`payments.status`, `enrollments.status`, `courses.is_published`, `certificates.status`).
3. **Arsitektur**: `Utils.php` god-class (344 baris, `replaceStatus` 136 baris tanpa test); logika approval payment (payment→earning→notifikasi) inline di controller; `BaseNotification` tidak queued dan salah memakai trait Eloquent `SoftDeletes`; cart tidak dibersihkan setelah enrollment; expiry undangan organisasi hardcoded 7 hari.
4. **Higiene**: `index.html` 92.7KB leftover (bukan entry Vite), `package-lock-old.json` 528KB, `lint-report.json` ter-track; deps `motion` & `zustand` terpasang tanpa satu pun import; dua implementasi tabel (`Table.jsx` vs `Table2.jsx`); query-detector terpasang tapi tak dikonfigurasi; CI tanpa workflow test; 0 test frontend.

**Koreksi penting hasil verifikasi** (membentuk desain): FK via `foreignUlid()->constrained()` sudah otomatis ter-index InnoDB — hanya kolom filter non-FK yang butuh index; `credential_id` sudah punya unique constraint DB (jadi bug-nya manifes sebagai 500, bukan duplikat diam-diam); `Table.jsx`/`Table2.jsx` murni client-side sehingga strategi pagination harus hibrid; base `Controller.php` adalah god-class ERP legacy — Policies masuk lewat `Gate::authorize()` tanpa menyentuhnya.

**Keputusan yang sudah diambil**: (1) notifikasi jadi `ShouldQueue` penuh + cron worker cPanel; (2) test frontend Vitest + RTL disetujui masuk rencana.

---

## Fase A — Keamanan & Kebenaran (dikerjakan pertama)

### A1. Guard enrollment di ProgressController — S
`app/Http/Controllers/Student/ProgressController.php:10-25`: sebelum `UserProgress::firstOrCreate`, resolve `$content->section->course_id` dan wajibkan enrollment ACTIVE milik user (pakai `FormStatus`, jangan string hardcode), selain itu 403. Jangan sentuh guard `type !== 'material'`. Belum pakai Policy (diserap C1).
**Test baru**: `tests/Feature/Student/ProgressEnrollmentGuardTest.php` — non-enrolled 403, enrollment pending 403, active sukses.

### A2. Tutup celah grading lintas kursus — S
`app/Http/Controllers/Instructor/SubmissionController.php` (~baris 16-49): setelah cek yang ada, `loadMissing('content.section')` lalu abort(422) bila `submission->content->section->course_id !== enrollment->course_id`. Jangan restrukturisasi ke scoped route binding (rantai content→section→course, cek eksplisit lebih jelas).
**Test baru**: `tests/Feature/Instructor/SubmissionGradingScopeTest.php`.

### A3. Perbaiki generator credential ID — S/M
`app/Services/CertificateService.php:108-114`: ganti `Certificate::count()+1` dengan max-parse aman-delete: `Certificate::withTrashed()->where('credential_id','like',"INK-{$year}-%")`, parse suffix numerik maksimum, +1 — dibungkus `retry(3)` yang menangkap `QueryException` unique-violation dan regenerate tiap percobaan. Unique index = correctness, retry = liveness; identik di SQLite & MySQL. Format ID dipertahankan (sudah ada ID terbit). JANGAN bikin tabel sequence atau `lockForUpdate` (no-op di SQLite).
**Test**: tambah kasus di `tests/Unit/CertificateServiceTest.php` (setelah delete tidak duplikat; retry pada unique violation).

### A4. Queue semua notifikasi + cron worker cPanel — M
`app/Notifications/BaseNotification.php`: hapus trait `SoftDeletes` yang keliru; tambah `implements ShouldQueue` + `use Queueable` (18 turunan otomatis ikut; queue database sudah dikonfigurasi). `phpunit.xml` sudah set `QUEUE_CONNECTION=sync` jadi test lama aman.
Deploy: tambah instruksi cron cPanel `php artisan queue:work --stop-when-empty --max-time=50` tiap menit (dokumentasikan di README bagian deploy; jangan ubah `deploy-cpanel.yml`).
**Test baru**: `tests/Feature/NotificationQueueTest.php` (assert notifikasi masuk queue).

---

## Fase B — Efisiensi Data

### B1. Diet SystemFinanceController::index — M (3 commit terpisah)
`app/Http/Controllers/Admin/SystemFinanceController.php:32-161` + `resources/js/Pages/Admin/SystemFinance.jsx`:
1. **Chart ke SQL**: ganti pemuatan ulang seluruh payment (baris ~119-143) dengan agregat `selectRaw` — `DATE(verified_at), SUM(amount) GROUP BY date` dan `SUM(CASE WHEN …)` per status; `DATE()` jalan di MySQL & SQLite.
2. **Defer dataset sekunder**: `Inertia::defer` untuk `payoutRequests`, kedua time series, `payoutStats`; `<Deferred>` + skeleton di JSX — 8 partial reload `only:` yang sudah ada (baris ~554-769) tetap jalan karena nama prop tak berubah.
3. **Paginate payments**: `paginate(50)` + `through()` mempertahankan payload map; rejection history di-prefetch hanya untuk pasangan (user_id, course_id) halaman aktif via lookup map `groupBy` — pola house-style yang sama dengan `CourseProgressService::toLookup`.
JANGAN pindahkan semua sort/filter kolom ke server; JANGAN rewrite Table2.
**Test baru**: `tests/Feature/Admin/SystemFinanceIndexTest.php` (AssertableInertia: `->has('payments.data', 50)`, meta pagination, agregat chart vs data factory).

### B2. Diet UserDirectoryController::index — M
`app/Http/Controllers/Admin/UserDirectoryController.php:31-95`: paginate `users` (50/halaman + search LIKE server-side); `Inertia::defer` untuk `requests`/`admins`/`orgs`; `adminsPayload` pakai query `whereHas('roles')` terbatas sendiri, bukan filter koleksi penuh di PHP. Reuse pola paginator UI dari B1.
**Test baru**: shape test AssertableInertia serupa B1.

### B3. Migration index kolom filter — S (bisa paling awal, risiko nol)
Satu migration baru: index untuk `payments.status`, `enrollments.status`, `courses.is_published`, `certificates.status`. JANGAN re-index kolom FK (sudah otomatis); tanpa composite index sebelum ada pengukuran. Aman SQLite.
**Test**: suite penuh lewat (migration jalan di SQLite).

### B4. Cache counter dashboard — S/M
`Cache::remember('dash:admin:counters', 300, …)` dan `dash:instructor:{id}:counters` di `Admin/DashboardController` & `Instructor/DashboardController`; ekstrak query counter ke method privat. TTL pendek 300 detik, TANPA invalidasi event/tags/observer (staleness 5 menit bisa ditoleransi).
**Test**: assert nilai konsisten dua panggilan + cache store array.

### B5. Pagination katalog publik — S
`app/Http/Controllers/Guest/TrainingController.php:~38` → `paginate(24)->withQueryString()`, link paginator standar (halaman publik: SEO > infinite scroll).
**Test**: feature test halaman katalog dengan >24 course.

### B6. Perampingan payload Student — M
`Student/CourseListController.php:16-18`: daftar pending tidak butuh sections (cukup `payment`, `course.categories`, `course.creator`); pohon penuh hanya untuk enrollment ACTIVE; `with()` closure dengan kolom terbatas.
`Student/DashboardController.php:28-64`: butuh % progress, bukan pohon — helper berbasis count di `CourseProgressService`; defer blok berat tersisa. Grep JSX konsumen untuk prop terpakai SEBELUM menghapus field. JANGAN paginate enrollment satu siswa (bounded).
**Test**: update `tests/Feature/Student/CourseListPageTest.php` & `DashboardPageTest.php`.

---

## Fase C — Refactor Arsitektur

### C1. Policies inkremental — M (tergantung A1, A2)
`CoursePolicy` (`update`/`delete`/`manageContent` = `created_by === user->id`) + `SubmissionPolicy@grade` di `app/Policies/` (folder standar Laravel). Auto-discovery meng-cover `App\Models\Course`; model subnamespace (`App\Models\User\User`, `App\Models\Finance\*`) daftarkan via `Gate::policy()` di `AppServiceProvider::boot`. Ganti cek inline 1:1 dengan `Gate::authorize()`: `Instructor/CourseController.php` (4 titik), `CourseSectionController.php` (3), `CourseContentController.php` (5), `SubmissionController.php` (1) — section/content delegasi lewat `$section->course` / `$content->section->course`. JANGAN sentuh middleware `role:`/`admin.permission:` maupun base `Controller.php` legacy.
**Test**: 37 file test backend yang ada = jaring regresi; tambah kasus 403 untuk non-owner bila belum ada.

### C2. PaymentApprovalService — M (setelah B1, controller sama)
Pindahkan `SystemFinanceController::approve/reject` (baris ~164-240: guard status, transaksi payment→enrollment→`createEarningFromApprovedPayment`, dispatch notifikasi) ke `app/Services/Finance/PaymentApprovalService` baru, meniru pola `InstructorPayoutService` di sebelahnya. Tanpa events/listeners (call site tunggal).
**Test**: test approve/reject yang ada tetap hijau; tambah unit test service.

### C3. Dekomposisi Utils.php (terarah) — M
`Utils::replaceStatus` (136 baris, 4 mode) → static `FormStatus::replaceIn()` pada enum `app/FormStatus.php` yang sudah ada, dengan wrapper delegasi `@deprecated`. TULIS `tests/Unit/FormStatusReplaceTest.php` yang meng-cover 4 mode SEBELUM memindahkan (saat ini tak bertest). Deprecate `Utils::renderShow` (duplikat `Controller::renderShow`). Biarkan `getPreferenceColumns`/`convertTemplateLink`/`findRelationsTo` (terikat ERP-core). JANGAN buat `app/Support/` (butuh approval); tanpa migrasi caller besar-besaran.

### C4. Perbaikan alur kecil — S per item
- **Cart cleanup**: hapus baris `Cart` yang cocok di dalam transaksi pembuatan enrollment di `app/Http/Controllers/Student/EnrollmentController.php` (~baris 85). Test: cart kosong setelah enroll.
- **Expiry undangan organisasi**: `app/Services/Admin/OrganizationInvitationService.php:32` hardcoded 7 → `config('lms.invitation_expiry_days', 7)` + `config/lms.php` baru (standar Laravel).
- **Non-goal eksplisit**: penggabungan kolom `deadline`+`deadline_time` — risiko backfill > manfaat; `deadlineCutoff()` sudah memusatkannya.

---

## Fase D — Higiene & Tooling (semua S)

- **D1. Hapus file mati**: `git rm index.html package-lock-old.json lint-report.json` (grep referensi `index.html` dulu; entry Vite = `resources/js/app.jsx`); tambah `lint-report.json` ke `.gitignore`. Verifikasi: `npm run build` + suite penuh.
- **D2. Copot deps tak terpakai**: `npm uninstall motion zustand` (re-grep import saat eksekusi); lalu `npm run build` + `npm run lint`.
- **D3. Konfigurasi query detector**: publish `config/querydetector.php`; aktif saat debug, output ke log saja (dialog alert merusak Inertia), threshold 1; pastikan mati di `APP_ENV=testing`.
- **D4. CI test**: workflow baru `.github/workflows/tests.yml` — PHP 8.4, composer install, `php artisan test --compact` (SQLite `:memory:` sudah dikonfigurasi), plus gate `vendor/bin/pint --test`. Jangan sentuh `deploy-cpanel.yml`.

---

## Fase E — Test Frontend & Konsolidasi

- **E1. Setup Vitest + React Testing Library** (dev deps baru — sudah disetujui): konfigurasi vitest, script `npm test`. Mulai dari komponen kritis, BUKAN 159 pages: `Table2.jsx`, `PeriodFilterChart.jsx`, badge/status mapper di `SystemFinance.jsx`, satu form `useForm` representatif. — M
- **E2. Konsolidasi Table.jsx → Table2.jsx**: inventaris konsumen `Table.jsx`, migrasi, hapus. — M
- **E3. Konsolidasi 3 dashboard** (~1100 LOC): ekstrak komponen stat-card/skeleton bersama meniru pola `PeriodFilterChart`, setelah B4. — M/L
- **Backlog**: infinite scroll katalog (Inertia v2 `merge` + `WhenVisible`) hanya jika UX minta; `translate_helper.php` → artisan command.

---

## Keputusan Desain Kunci

1. **Pagination admin = hibrid**: server-side `paginate(50)` untuk dataset primer tak terbatas + footer paginator tipis yang memanggil `router.get(url, {page, search}, { only: ['payments'], preserveState: true, preserveScroll: true })` — persis pola partial-reload yang sudah dipakai SystemFinance.jsx 8×. Dataset sekunder → `Inertia::defer` + skeleton. Ditolak: deferred-only (dataset penuh tetap tertransfer) dan tabel full server-driven (rework Table2 besar, over-engineering).
2. **Policies di BAWAH middleware**: `role:*`/`admin.permission:*` tetap sebagai gerbang kasar; `Gate::authorize()` hanya menggantikan cek ownership inline.
3. **Credential ID**: format dipertahankan; max-parse `withTrashed()` per tahun + `retry(3)` pada unique violation. Tanpa tabel baru, tanpa locking DB-spesifik.
4. **Cache dashboard**: TTL pendek 300 detik tanpa invalidasi event — invalidasi akan menyentuh belasan write path demi manfaat nol yang terlihat.

## Urutan & Estimasi

| Urutan | Item | Effort | Dependensi |
|---|---|---|---|
| 1–3 | A1, A2, A3 | S, S, S/M | — |
| 4 | A4 queued notifications | M | — (cron cPanel: keputusan sudah diambil) |
| 5 | B3 indexes | S | — (paling awal, risiko nol) |
| 6–7 | B1 lalu B2 | M, M | B2 reuse paginator UI B1 |
| 8–10 | B5, B4, B6 | S, S/M, M | — |
| 11 | C1 policies | M | A1, A2 |
| 12 | C2 approval service | M | B1 (controller sama) |
| 13–14 | C3, C4 | M, S | — |
| 15 | D1–D4 | S each | — |
| 16 | E1–E3 | M, M, M/L | E3 setelah B4 |

## Verifikasi

- **Per fase A**: feature test per fix (403/422 + happy path), `Notification::fake()`; suite penuh `php artisan test --compact` di akhir fase.
- **Per fase B**: shape test AssertableInertia (`->has('payments.data', 50)`), agregat chart vs data factory, cache test di array store; suite SQLite membuktikan migration aman.
- **Per fase C**: 37 file test backend yang ada = jaring regresi untuk refactor pemertahan-perilaku; unit test `FormStatus::replaceIn` ditulis SEBELUM pemindahan.
- **Per fase D/E**: `npm run build`, `npm run lint`, `npm test` (setelah E1), suite PHP penuh, CI hijau.
- **Selalu**: `vendor/bin/pint --dirty --format agent` setelah tiap perubahan PHP; jalankan test minimal tertarget sesuai AGENTS.md.
- **Verifikasi manual end-to-end**: jalankan `composer run dev`, cek halaman Admin Finance (pagination + defer skeleton), User Directory, katalog publik, dashboard tiap role, alur enroll→approve→sertifikat.

## File Kritis

- `app/Http/Controllers/Student/ProgressController.php`
- `app/Http/Controllers/Instructor/SubmissionController.php`
- `app/Services/CertificateService.php`
- `app/Notifications/BaseNotification.php`
- `app/Http/Controllers/Admin/SystemFinanceController.php` + `resources/js/Pages/Admin/SystemFinance.jsx`
- `app/Http/Controllers/Admin/UserDirectoryController.php`
- `app/Http/Controllers/Guest/TrainingController.php`
- `app/Http/Controllers/Student/CourseListController.php` & `Student/DashboardController.php`
- `app/Utils.php` & `app/FormStatus.php`
- `database/migrations/` (migration index baru)
