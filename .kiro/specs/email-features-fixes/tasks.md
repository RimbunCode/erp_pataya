# Implementation Plan: email-features-fixes

## Overview

Lima perbaikan independen di fitur email: (1) entry sidebar untuk halaman Email Templates, (2) lang key yang hilang di dialog kirim email, (3) upload attachment via `UploadDialog` (bukan input manual), (4) default nama pengirim dari user login, (5) restrukturisasi layout dialog jadi 2 kolom dengan section attachment terpisah. Tidak ada perubahan kontrak API (`emailPreview`/`sendEmail`), schema DB, atau logic PDF existing — semua perubahan backend hanya 1 baris, sisanya di layer presentasi React + JSON lang.

## Tasks

- [ ] 1. Backend — default Send From dari user login
  - [x] 1.1 Update `app/Http/Controllers/Controller.php::emailPreview()`
    - Ganti `'fromName' => config('mail.from.name'),` menjadi `'fromName' => auth()->user()->name,`
    - `fromAddress` tidak diubah
    - _Requirements: 4.1, 4.3, 4.4_

  - [x] 1.2 Write feature test untuk `fromName` dari user login
    - **Test: emailPreview response fromName mengikuti user yang login**
    - Dibuat `tests/Feature/Sales/SalesOrderEmailPreviewTest.php` — login user "Budi Santoso", GET `salesOrders.email.preview`, assert JSON `fromName` = "Budi Santoso"
    - **Bug ditemukan & diperbaiki (di luar scope awal, atas persetujuan user)**: endpoint 500 karena `Controller.php:468` — accessor `SalesOrder::rentDate()` (di `$appends`) return array `{from, to}`, lolos filter `reject(nameOfFunction)` (filter itu cuma exclude kolom relasi, bukan attribute/append non-scalar), lalu `(string)` cast meledak. Fix: tambah `reject(fn($col) => is_array(...) || is_object(...))` di `resolvedFields` sebelum map.
    - **Validates: Requirements 4.1** — PASS (1 test, 2 assertions)

- [x] 2. Checkpoint - Ensure backend tests pass
  - `php artisan test --compact --filter=SalesOrderEmailPreviewTest` → 1 passed (2 assertions).

- [ ] 3. Sidebar — entry Email Templates
  - [x] 3.1 Update `resources/js/Components/Sidebar/AppSidebar.jsx`
    - Cek dulu pola exact entry "Print Templates" (literal string vs `t(...)`) di sekitar baris ~316-320
    - Tambah entry baru "Email Templates" tepat setelah entry "Print Templates", mengikuti pola yang sama persis: `url: "/settings/emailTemplates"`, `urlPattern: "/settings/emailTemplates/*"`, `model: "App\\Models\\Core\\EmailTemplate"`
    - _Requirements: 1.1, 1.3_

- [ ] 4. Lang keys — dialog kirim email
  - [x] 4.1 Update `lang/id/core/emailTemplate.php`
    - **Koreksi**: `lang/php_id.json` BUKAN source of truth — file itu build artifact gitignored, digenerate plugin `laravel-react-i18n/vite` dari `lang/{locale}/**/*.php` saat `npm run dev`/`npm run build`. Key manual yang sempat ditambah ke JSON hilang setelah rebuild (sesuai ekspektasi).
    - Ditambah section `'send' => [...]` (14 key) di source PHP asli
    - `columns.subject`/`body` sudah ada sebelumnya — tidak ditambah lagi
    - _Requirements: 2.1, 2.2_

  - [x] 4.2 Update `lang/en/core/emailTemplate.php`
    - Ditambah section `'send' => [...]` versi Inggris, key sama persis dengan versi ID
    - Diverifikasi via `npm run build`: value baru ("Kirim Email") muncul di compiled bundle `public/build/assets/php_id-*.js`
    - _Requirements: 2.1, 2.2_

  - [x] 4.3 Verifikasi tidak ada key yang asimetris antar 2 file
    - Dicek via Python: 14 key `core.emailTemplate.send.*` identik persis di kedua file (0 selisih)
    - Catatan: ditemukan 8 key pre-existing yang asimetris di domain lain (`approvalInstance`, `helpdesk`, `user`) — tidak terkait scope spec ini, tidak diperbaiki (di luar 5 requirement)
    - _Requirements: 2.3_

- [x] 5. Checkpoint - Ensure sidebar & lang key perubahan konsisten
  - `php artisan route:list --name=emailTemplates` → 17 route valid, `emailTemplates.index` di `settings/emailTemplates` cocok dgn URL sidebar baru.

- [ ] 6. EmailSendDialog — ganti upload manual ke UploadDialog
  - [x] 6.1 Hapus kode upload manual di `resources/js/Pages/Core/Components/EmailSendDialog.jsx`
    - Dihapus: `fileInputRef`, `handleUpload`, `<input type="file">` manual, tombol lama
    - _Requirements: 3.1_

  - [x] 6.2 Tambah state & handler baru
    - Ditambah import `UploadDialog`, `DialogTrigger`; state `uploadOpen`, `newFileIds`; handler `handleNewFiles(items)`; `setNewFileIds([])` di useEffect fetch preview
    - _Requirements: 3.1, 3.2_

  - [x] 6.3 Render `UploadDialog` sebagai pengganti tombol upload lama
    - `<Dialog>` bersarang di dalam `EmailSendDialog` (sudah `<Dialog>`) — dikonfirmasi aman, pola sama dipakai `Attachments.jsx` yang dirender di dalam `FormPageDialog` (AlertDialog → Dialog → UploadDialog, Radix Portal, sudah proven di production)
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 7. Checkpoint - Ensure upload flow tidak merusak submit
  - `npm run test` (vitest): 1812 passed. 18 failed semua berasal dari `.claude/worktrees/item-image-uploader/` (working tree lain, pre-existing, tidak terkait perubahan spec ini). Tidak ada test yang menyentuh `EmailSendDialog.jsx`/`AppSidebar.jsx` gagal.

- [x] 8. EmailSendDialog — layout 2 kolom + section attachment
  - [x] 8.1 Perbesar lebar dialog
    - `DialogContent` className: `max-w-2xl` → `max-w-4xl`
    - _Requirements: 5.3_

  - [x] 8.2 Restrukturisasi container jadi grid 2 kolom
    - Container `grid lg:grid-cols-[1fr_18rem] gap-6`, kolom kiri (`min-w-0`) From/To/Cc/Bcc/Subject/Body, kolom kanan (`min-w-0 border-t pt-4 lg:border-t-0 lg:pt-0 lg:border-l lg:pl-4`) attachment sections
    - _Requirements: 5.1, 5.2_

  - [x] 8.3 Tambah derivasi list section attachment
    - `allNonPdfFiles`, `existingNonPdfFiles`, `newFiles`, `existingPdfFiles` ditambahkan sesuai design.md
    - _Requirements: 5.4_

  - [x] 8.4 Render 3 section attachment di kolom kanan
    - "Attachment Dokumen" (render hanya jika ada isi), "PDF Dokumen" (jika `hasGeneratedPdf`), checkbox "Sertakan PDF" (logic existing tidak diubah), "Lampiran Baru" (render hanya jika ada isi), tombol upload di akhir
    - _Requirements: 5.1, 5.4, 5.5_

  - [x] 8.5 Verifikasi responsif mobile
    - Class `lg:` breakpoint pada kolom kanan (`border-t` mobile → `lg:border-l` desktop) sesuai pola `FormPageDialog`
    - _Requirements: 5.2_

- [-] 9. Final checkpoint - Ensure all tests & manual verification pass
  - `php artisan test --compact --filter=SalesOrderEmailPreviewTest` → pass (task 1.2/2)
  - `npm run test` (vitest) → 1812 passed, 18 failed di worktree lain tidak terkait (task 7)
  - `vendor/bin/pint --dirty --format agent` → pass
  - `npx eslint --fix` pada 2 file JS yang diubah → 0 error, 0 warning setelah fix
  - **Verifikasi manual browser BELUM dilakukan** — tidak ada akses browser interaktif di sesi ini. User perlu cek manual: `npm run dev` aktif, buka dialog kirim email dari dokumen submitable (mis. Sales Order), cek sidebar Email Templates, label ID/EN, upload file baru, Send From, layout 2 kolom, submit email.

## Notes

- Task 1 (backend) sengaja dikerjakan lebih dulu dan terpisah dari task frontend — perubahannya independen, low-risk, dan lebih mudah divalidasi via test otomatis sebelum masuk ke perubahan UI yang lebih besar.
- Task 3 (sidebar) dan Task 4 (lang) saling independen, bisa dikerjakan dalam urutan apa pun — dipisah dari task 6-8 karena keduanya tidak menyentuh `EmailSendDialog.jsx`.
- Task 6 (ganti mekanisme upload) sengaja dipisah dari Task 8 (restrukturisasi layout) meski sama-sama di file yang sama — supaya perubahan logic (state/handler) dan perubahan JSX/layout bisa divalidasi secara bertahap, mengurangi risiko konflik saat debugging jika ada yang tidak sesuai.
- Tidak ada task lint/format terpisah — Pint (PHP) dijalankan sekali di akhir setelah semua task selesai, sesuai aturan project.
- Tidak ada unit test JS baru dibuat (project ini tidak punya test suite JS) — verifikasi frontend murni manual/browser sesuai design.md Testing Strategy.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "3.1", "4.1"] },
    { "id": 1, "tasks": ["1.2", "4.2"] },
    { "id": 2, "tasks": ["4.3"] },
    { "id": 3, "tasks": ["6.1"] },
    { "id": 4, "tasks": ["6.2"] },
    { "id": 5, "tasks": ["6.3"] },
    { "id": 6, "tasks": ["8.1", "8.2"] },
    { "id": 7, "tasks": ["8.3"] },
    { "id": 8, "tasks": ["8.4"] },
    { "id": 9, "tasks": ["8.5"] }
  ]
}
```
