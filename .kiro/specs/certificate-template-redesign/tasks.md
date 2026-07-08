# Implementation Plan: Certificate Template Redesign

## Overview

Implementasi mengikuti urutan dependency alami: pasang library barcode dulu, lalu ubah service layer (`CertificateService`) yang jadi sumber data untuk Blade view, baru redesign view-nya sendiri. Setelah jalur penerbitan PDF beres, bangun halaman verifikasi publik (route → controller → frontend) yang konsumsi data dari service yang sama. Terakhir, sambungkan auto-issuance job ke alur evaluasi final. Tidak ada migrasi baru di seluruh plan ini — semua kolom database sudah tersedia.

## Tasks

- [x] 1. Setup dependency barcode
  - [x] 1.1 Tambah `milon/barcode` ke `composer.json` dan install
    - Tambah `"milon/barcode": "^13.1"` ke `require`
    - Jalankan `composer require milon/barcode`
    - Verifikasi ekstensi PHP `gd` terpasang (`php -m | grep gd`) sebelum install — jika tidak ada, catat sebagai blocker infrastruktur, bukan kode
    - _Requirements: 2.1, 2.2_

- [x] 2. Checkpoint - Pastikan composer install sukses dan autoload facade `Milon\Barcode\Facades\DNS1DFacade` / `DNS2DFacade` bisa di-resolve (cek lewat `php artisan tinker` atau unit test kosong)

- [x] 3. `CertificateService` — generate barcode/QR dan paksa layout landscape
  - [x] 3.1 Modifikasi `issueFromTemplate()` di `app/Services/CertificateService.php`
    - Tambah `$verifyUrl = route('guest.verify.show', ['credentialId' => $credentialId]);` sebelum `$viewData` dibangun
    - Generate `$barcode1dBase64` via `DNS1DFacade::getBarcodePNG($credentialId, 'C128', 2, 30)` — encode `credential_id`, bukan URL
    - Generate `$qrCodeBase64` via `DNS2DFacade::getBarcodePNG($verifyUrl, 'QRCODE', 4, 4)` — encode `verifyUrl`, bukan `credential_id`
    - Tambah `verifyUrl`, `barcode1dBase64`, `qrCodeBase64` ke array `$viewData`
    - Ubah `Pdf::loadView('certificates.pdf', $viewData);` menjadi `Pdf::loadView('certificates.pdf', $viewData)->setPaper('a4', 'landscape');`
    - _Requirements: 1.1, 2.1, 2.2_

  - [x] 3.2 Write unit tests for `issueFromTemplate()` barcode/landscape changes (Barcode content invariant)
    - **Property: Barcode content invariant** — 1D SELALU encode credential_id persis, QR SELALU encode verifyUrl, tidak pernah tertukar
    - Test: panggil `issueFromTemplate()`, assert `$certificate->snapshot['barcode1dBase64']` dan `['qrCodeBase64']` non-kosong string valid base64
    - Test: assert `$certificate->snapshot['verifyUrl']` mengandung `credential_id` yang benar sebagai path segment
    - Test: assert PDF ter-generate dengan orientasi landscape (cek lewat `setPaper` dipanggil, atau isi output PDF jika library expose info)
    - **Validates: Requirements 1.1, 2.1, 2.2**

- [x] 4. Checkpoint - Pastikan semua test `CertificateServiceTest` (existing + baru) hijau

- [x] 5. Redesign Blade view `resources/views/certificates/pdf.blade.php`
  - [x] 5.1 Full rewrite layout ke A4 landscape
    - Tambah `@page { size: a4 landscape; margin: 0; }`
    - Halaman depan: header (logo mitra + logo INKINDO + organizer + title) → body (identitas peserta + judul + periode, vertical-center) → 2 tanda tangan sejajar
    - Halaman belakang: konten left-align (kecuali title center) — meta info (Judul/Periode/Instruktur/No. Sertifikat) dalam grid table sejajar, daftar materi
    - Barcode 1D (encode credential_id) + QR (encode verifyUrl) di pojok kiri-kanan bawah tiap halaman via `position:fixed` (sibling `.page`, bukan nested — hindari dompdf table-layout bug)
    - Background image asli (`resources/images/certificate-bg.png`, frame emas dekoratif) menggantikan border CSS
    - Revisi tambahan disetujui user: font diperbesar, info "Nilai Akhir" dihapus dari tampilan, dukungan logo mitra majemuk (`partnerLogos` array, kolom `partner_logo_paths` baru), TTD kedua (`signer_name_2` dkk, kolom baru)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2_

  - [x] 5.2 Manual visual verification PDF hasil redesign
    - Root cause halaman kosong ekstra ditemukan & diperbaiki: hindari `width`/`height` eksplisit dalam mm pada elemen bersarang (bentrok dengan `@page` rule) — solusi: `.page` sebagai `display:table; height:100%` tunggal, konten mengikuti flow natural
    - Vertical-center diperbaiki: pindahkan elemen `position:fixed` keluar dari struktur table `.page` (jadi sibling di `<body>`, bukan child) — struktur table bersih, `vertical-align:middle` bekerja
    - User approved hasil akhir setelah beberapa iterasi revisi visual
    - _Requirements: 1.1, 1.2, 1.3, 1.5_

- [x] 6. Checkpoint - Review visual PDF dengan user sebelum lanjut ke fitur verifikasi (disetujui)

- [ ] 7. Routing untuk halaman verifikasi dan stream endpoint
  - [x] 7.1 Tambah route verify di `routes/guest.php`
    - Tambah `Route::get('/verify/{credentialId}', [GuestPageController::class, 'verifyShow'])->name('verify.show');` di dalam grup `Route::name('guest.')`
    - Route `/verify` (tanpa param) yang sudah ada tetap tidak berubah
    - Dikerjakan lebih awal sebagai prasyarat task 3.1 (butuh `route('guest.verify.show', ...)` untuk generate `$verifyUrl`)
    - _Requirements: 3.1_

  - [x] 7.2 Tambah route stream signed di `routes/web.php`
    - Tambah `Route::get('/certificates/{certificate}/stream', [GuestCertificateStreamController::class, 'stream'])->middleware('signed')->name('certificates.stream');` sebagai route top-level (di luar grup auth/role)
    - Tambah `use App\Http\Controllers\Guest\GuestCertificateStreamController;`
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [ ] 8. Controller verifikasi publik
  - [x] 8.1 Buat `GuestCertificateStreamController` baru
    - File baru: `app/Http/Controllers/Guest/GuestCertificateStreamController.php`
    - Method `stream(Certificate $certificate): Response` — `abort_unless(source === 'template', 404)`, `abort_unless(file_path && Storage::exists, 404)`, return `Storage::response()` (inline, bukan download) dengan `Content-Type: application/pdf`
    - _Requirements: 4.4, 4.5_

  - [x] 8.2 Tambah method `verifyShow()` di `GuestPageController`
    - Inject `CertificateService` ke constructor (tambahan property, sejajar dengan dependency yang sudah ada)
    - `verifyShow(Request $request, string $credentialId): Response` — panggil `$this->certificateService->verify($credentialId)`
    - Jika tidak ketemu: `result = ['found' => false]`
    - Jika ketemu: bangun `result` dengan `found`, `status` (`effective_status`), `studentName`, `courseTitle`, `credentialId`, `issuedDate`, `expiresDate`, `pdfViewerUrl` (null default)
    - Jika `status === 'active'` DAN `source === 'template'` DAN `file_path` ada: generate `URL::temporarySignedRoute('certificates.stream', now()->addMinutes(15), ['certificate' => $certificate->id])`, bungkus jadi `pdfViewerUrl` dengan prefix Google Docs Viewer (`https://docs.google.com/viewerng/viewer?hl=en&embedded=true&url=` + urlencode)
    - Render `Inertia::render('Guest/VerifyCTA/VerifyCTA', [...])` dengan `content`, `liveEditor` (pola existing), plus `credentialId`, `result`
    - Route registration terverifikasi via `php artisan route:list` — `guest.verify.show` dan `certificates.stream` keduanya resolve dengan benar
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 4.1_

  - [x] 8.3 Write feature tests for halaman verifikasi publik (No-download invariant, status branching)
    - **Property: No-download invariant di halaman publik** — endpoint stream selalu inline, tidak pernah attachment
    - Test `tests/Feature/Guest/VerifyCertificateTest.php`: not-found → `result.found === false`; revoked → pesan dicabut; expired → pesan kedaluwarsa + tanggal; active+template source → `pdfViewerUrl` non-null berisi signed URL yang di-wrap Google Viewer; active+non-template source → `pdfViewerUrl` null, tidak ada error
    - 6/6 test lulus. Sempat blocked oleh Vite manifest belum ter-build di environment — diselesaikan dengan `npm install` + `npm run build` (heap limit dinaikkan via `NODE_OPTIONS=--max-old-space-size=4096`, default Node terlalu kecil untuk project ini)
    - **Validates: Requirements 3.2, 3.3, 3.4, 3.5, 3.6, 3.8**

  - [x] 8.4 Write feature tests for signed stream endpoint (Signed URL freshness, Ownership isolation)
    - **Property: Signed URL freshness** — signature valid dalam window 15 menit diterima, kadaluwarsa ditolak
    - **Property: Ownership isolation** — endpoint stream tidak pernah cek auth/user_id
    - Test `tests/Feature/Guest/CertificateStreamTest.php`: signature valid → 200 + `Content-Type: application/pdf`; signature invalid/hilang → 403; signature lewat 15 menit (`Carbon::setTestNow()`) → 403; `source !== 'template'` dengan signature valid → 404; request tanpa login sama sekali tetap berhasil (buktikan tidak ada auth check)
    - Bug ditemukan & diperbaiki: `GuestCertificateStreamController::stream()` di-declare return type `Illuminate\Http\Response`, tapi `Storage::response()` sebenarnya mengembalikan `Symfony\Component\HttpFoundation\StreamedResponse` — TypeError di runtime. Diperbaiki jadi return type `StreamedResponse` yang benar.
    - 7/7 test lulus setelah fix
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5**

- [x] 9. Checkpoint - Pastikan semua test Guest (VerifyCertificateTest, CertificateStreamTest) hijau — 13/13 lulus

- [x] 10. Frontend halaman verifikasi — `VerifyCTA.jsx`
  - [x] 10.1 Update `resources/js/Pages/Guest/VerifyCTA/VerifyCTA.jsx`
    - Terima props baru `credentialId` (nullable) dan `result` (nullable) di `VerifyCTAContent` dan default export
    - Inisialisasi `certId` state dari `credentialId` prop jika ada
    - Perbaiki tombol submit yang sebelumnya tidak berfungsi: `onClick` (dan Enter-key di input) memanggil `router.get(route('guest.verify.show', certId.trim()))`
    - Branch render: tanpa `result` → CTA statis (unchanged); `result.found === false` → pesan tidak ditemukan; `status === 'revoked'` → pesan dicabut; `status === 'expired'` → pesan kedaluwarsa + tanggal; `status === 'active'` → blok identitas (`VerifyIdentityCard`) + `<iframe src={result.pdfViewerUrl}>` full-screen jika `pdfViewerUrl` ada, identitas-saja jika null
    - Pastikan tidak ada elemen/tombol unduh dalam bentuk apapun di seluruh komponen ini — dikonfirmasi, tidak ada
    - Dipecah jadi sub-komponen (`VerifyForm`, `VerifyResultMessage`, `VerifyIdentityCard`) untuk keterbacaan
    - Diverifikasi: `npm run build` sukses tanpa error, dan `VerifyCertificateTest` (6/6) tetap hijau setelah rebuild — membuktikan JSX baru tidak memecahkan render halaman
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

  - [ ] 10.2 Manual verification alur verifikasi end-to-end di browser
    - Buka `/verify` (CTA kosong tampil normal), submit credential ID valid → redirect ke `/verify/{id}` menampilkan identitas + iframe PDF; submit credential ID tidak valid → pesan tidak ditemukan; scan QR dari PDF hasil task 5 → landing di halaman yang sama dengan iframe terisi
    - _Requirements: 3.1–3.8_

- [ ] 11. Checkpoint - Review UX halaman verifikasi dengan user sebelum lanjut ke auto-issuance

- [x] 12. Auto-issuance sertifikat saat evaluasi final
  - [x] 12.1 Buat job `IssueCertificateFromTemplateJob`
    - File baru: `app/Jobs/IssueCertificateFromTemplateJob.php`, pola sama seperti `IssueCertificateJob` yang sudah ada (`ShouldQueue`, `Queueable`, `InteractsWithQueue`, `tries=3`, `timeout=120`)
    - `handle(CertificateService $service, GradingService $gradingService)`: return awal jika `$enrollment->certificate` sudah ada; resolve template aktif (course-specific lalu fallback default, pola sama seperti `StudentCertificateUploadController::issueFromTemplate()`); jika tidak ada template, `Log::warning(...)` dan return; panggil `$service->issueFromTemplate(...)` dibungkus try/catch `\RuntimeException` → `Log::warning(...)` jika gagal
    - **Pekerjaan tambahan (di luar rencana awal task 12, dipicu laporan user)**: tombol manual "Terbitkan via Template" (`StudentCertificateUploadController::issueFromTemplate()`) sebelumnya memanggil `CertificateService::issueFromTemplate()` secara sinkron di request HTTP — timeout di production karena generate PDF (barcode+QR+background 1MB) lambat. Diubah untuk dispatch `IssueCertificateFromTemplateJob` yang sama, bukan panggilan sinkron. Controller tetap quick-validate (template ada, belum pernah terbit, evaluasi final+lulus) sebelum dispatch agar pesan error instan tidak berubah; pesan sukses berubah jadi "Sertifikat sedang diproses, akan muncul beberapa saat lagi." (disepakati dengan user: tanpa polling/auto-refresh). 3 test baru ditambahkan ke `tests/Feature/Admin/StudentCertificateUploadTest.php` (dispatch job, reject tanpa template, reject evaluasi belum final) — 9/9 lulus.
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ] 12.2 Dispatch job dari `Admin\EnrollmentEvaluationController::submitFinal()`
    - Di dalam `foreach ($evaluations as $evaluation)`, setelah `$evaluation->update([...])`, tambah `if ($evaluation->is_passed) { IssueCertificateFromTemplateJob::dispatch($evaluation->enrollment); }`
    - Tambah `use App\Jobs\IssueCertificateFromTemplateJob;`
    - _Requirements: 5.1, 5.2_

  - [ ] 12.3 Write feature tests for auto-issuance (Idempotent issuance, evaluasi tidak pernah gagal)
    - **Property: Idempotent issuance** — job/tombol manual dijalankan dua kali tidak pernah hasilkan dua `Certificate` row
    - **Property: Evaluasi final tidak pernah gagal karena isu sertifikat** — kegagalan job tidak melempar balik ke controller
    - Test `tests/Feature/Admin/EnrollmentEvaluationAutoIssueTest.php`: submit final untuk evaluasi lulus dengan template aktif → job ter-dispatch (`Queue::fake()` + `assertPushed`), jalankan job sinkron → `Certificate` row tercipta dengan `source = 'template'`; submit final tanpa template aktif → evaluasi tetap `status = 'final'`, tidak ada exception dilempar ke response, tidak ada `Certificate` row, log warning tercatat; submit final untuk evaluasi yang enrollment-nya sudah punya certificate → job tidak membuat certificate kedua
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6**

- [ ] 13. Checkpoint - Pastikan semua test auto-issuance hijau

- [ ] 14. Regresi dan verifikasi jalur yang tidak berubah
  - [ ] 14.1 Jalankan ulang test suite existing yang bersinggungan
    - `tests/Unit/CertificateServiceTest.php` (full suite, termasuk test lama untuk `issueCertificate()` jalur Google Docs)
    - `tests/Feature/Student/CertificatePageTest.php` — pastikan alur download/preview student (`Student\CertificateController::download()`) tidak terpengaruh sama sekali oleh perubahan di atas
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [ ] 14.2 Manual verification tombol manual "Terbitkan via Template" masih berfungsi sebagai fallback
    - Buka halaman admin "Upload Sertifikat Student", pilih student dengan evaluasi final tapi belum ada template aktif saat auto-issue berjalan (skenario 12.3), aktifkan template, klik "Terbitkan via Template" → sertifikat berhasil terbit manual
    - _Requirements: 5.6_

- [ ] 15. Final checkpoint - Pastikan seluruh test suite (unit + feature, lama + baru) hijau, lalu jalankan linter/formatter project

## Notes

- Tidak ada migrasi database di seluruh plan ini — seluruh kolom yang dibutuhkan (`credential_id`, `expires_at`, `status`, `source`, `file_path`, `snapshot` di `certificates`; `signer_name`, `signer_title`, `signature_image_path`, `logo_path` di `certificate_templates`) sudah ada.
- Editor WYSIWYG untuk `front_content`/`back_content` sengaja tidak disentuh — di luar scope spec ini.
- Jalur lama Google Docs (`issueCertificate()`, `IssueCertificateJob` yang sudah ada) tidak dimodifikasi sama sekali — job baru (`IssueCertificateFromTemplateJob`) terpisah total.
- Task 5.2, 10.2, dan 14.2 adalah verifikasi manual (bukan automated test) — dilakukan langsung oleh developer sebelum checkpoint terkait dianggap selesai.
- Setiap checkpoint (task 2, 4, 6, 9, 11, 13, 15) adalah titik berhenti untuk validasi bersama user sebelum lanjut — terutama checkpoint 6 (review visual PDF) dan 11 (review UX verifikasi) yang menyentuh keputusan desain, bukan cuma korektnes teknis.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["3.1"] },
    { "id": 2, "tasks": ["3.2", "5.1"] },
    { "id": 3, "tasks": ["5.2"] },
    { "id": 4, "tasks": ["7.1", "7.2"] },
    { "id": 5, "tasks": ["8.1", "8.2"] },
    { "id": 6, "tasks": ["8.3", "8.4", "10.1"] },
    { "id": 7, "tasks": ["10.2"] },
    { "id": 8, "tasks": ["12.1"] },
    { "id": 9, "tasks": ["12.2"] },
    { "id": 10, "tasks": ["12.3"] },
    { "id": 11, "tasks": ["14.1", "14.2"] }
  ]
}
```
