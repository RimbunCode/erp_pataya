# Implementation Plan: goey-toast-migration

## Overview

Migrasi toast Sonner → goey-toast lewat strategi shim/wrapper agar diff call site minimal. Pekerjaan dibagi: pasang dependency & provider, bangun shim + wrapper config, migrasi call site standar, konversi `toast.custom` → standard, lapisan loading Inertia (delay-threshold + Retry), audit async, lalu cleanup legacy + verifikasi. Yang TIDAK berubah: logika bisnis, alur form, progress bar bawaan Inertia, hook `useTheme`.

## Tasks

- [ ] 1. Dependency & entry point
  - [x] 1.1 Install `goey-toast` + `framer-motion`
    - Jalankan `npm install goey-toast framer-motion` (peer dep `framer-motion` wajib eksplisit)
    - **Butuh persetujuan user** sebelum mengubah `package.json` (CLAUDE.md: jangan ubah dependency tanpa approval)
    - Verifikasi `node_modules/goey-toast` ada
    - _Requirements: 1.4_

  - [x] 1.2 Import stylesheet goey-toast di entry point
    - Tambah `import "goey-toast/styles.css";` di `resources/js/app.jsx`
    - _Requirements: 1.2, 1.5_

- [ ] 2. Wrapper provider & shim
  - [x] 2.1 Buat wrapper `Components/ui/goey-toaster.jsx`
    - Komponen `GooeyToaster` baca `currentTheme` dari `useTheme()`
    - Set prop wajib: `theme={currentTheme}`, `spring`, `preset="smooth"`, `duration={5000}`, `position="top-center"`
    - Spread `{...props}` untuk override opsional
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x] 2.2 Buat shim `lib/gooeyToast.js`
    - Re-export `gooeyToast` dari `goey-toast` (named + default)
    - Helper `toastAlert(variant, title, options)` map `destructive→error`, `warning→warning`, `success→success`, fallback `info`
    - _Requirements: 3.1, 4.1_

- [ ] 3. Mount provider & swap Sonner
  - [x] 3.1 Ganti `<Toaster/>` Sonner → `<GooeyToaster/>` di `MasterLayout.jsx`
    - Hapus import `Toaster` dari `Components/ui/sonner`, import `GooeyToaster` dari `Components/ui/goey-toaster`
    - Pastikan mount tetap sekali, dekat root (R1.1, R1.3)
    - _Requirements: 1.1, 1.3_

- [x] 4. Checkpoint - Provider goey-toast aktif
  - Jalankan `npm run build` — pastikan sukses tanpa error toast; konfirmasi ke user jika ada masalah.
  - HASIL: build `✓ built in 3.23s`. Warning `:global` & chunk-size pre-existing (bukan dari toast).

- [ ] 5. Lapisan loading Inertia (promise + Retry)
  - [x] 5.1 Buat `lib/inertiaToast.jsx` dengan `setupInertiaToast({ t })`
    - State: `timer`, `toastId`, `lastVisit`
    - `router.on('start')`: simpan `lastVisit = e.detail.visit`; `setTimeout(350ms)` buka loading toast → `toastId`
    - `router.on('success')`: clear timer; jika `toastId` ada → `gooeyToast.update(id, {type:'success'})`
    - `router.on('error'|'exception')`: clear timer; jika `toastId` ada → `update` jadi error + `description` + action Retry; jika belum tampil → `gooeyToast.error(...)` langsung (cabang gagal-cepat)
    - `extractError(e, t)`: pindahkan logika `getHttpErrorMessage`/`showHttpErrorToast` lama (map status → `core.errors.http.*` / `core.errors.network.*`)
    - Action Retry: `router.visit(lastVisit.url, lastVisit)`
    - Return fungsi teardown (clear timer + lepas semua listener)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9_

  - [x] 5.2 Pasang `setupInertiaToast` + hapus listener lama di `MasterLayout.jsx`
    - Panggil `const teardown = setupInertiaToast({ t })` dalam `useEffect`, `return teardown`
    - **Hapus** listener `inertia:invalid` / `inertia:exception` lama (baris ~192–245) agar tak ada toast ganda
    - _Requirements: 5.10_

  - [x] 5.3 Tambah i18n keys
    - `core.toast.{loading,success,error,retry}` + `core.errors.fetch_failed` di `lang/*.json` (semua locale yang ada)
    - _Requirements: 3.3, 5.7_

- [x] 6. Checkpoint - Loading layer berfungsi
  - `npm run build` sukses (✓ 6.36s + ssr ✓ 1.31s), tanpa error. Manual verify ditunda ke checkpoint akhir.

- [ ] 7. Migrasi call site standar (success/error/warning/info)
  - [x] 7.1 Swap import per file dari `sonner` → `@/lib/gooeyToast`
    - Ganti `import { toast } from "sonner"` → `import { gooeyToast as toast } from "@/lib/gooeyToast"` di file non-custom
    - Cakup: `UploadDialog.jsx`, `TiptapEditor.jsx`, `FilterTable2.jsx`, `DataTable2.jsx`, `PrintTemplate/Editor.jsx` + sub-komponennya, `SaveStatusBadge.jsx`, `CustomModePanel.jsx`, `variableDropUtils.js`, `FormPage.jsx`
    - Verifikasi opsi tak didukung (mis. `cancel`) dipetakan/dihapus (R3.4)
    - _Requirements: 3.1, 3.2, 3.4_

- [ ] 8. Konversi `toast.custom(<Alert>)` → standard goey (R4)
  - [x] 8.1 `Components/InputBarcode.jsx` (3 titik)
    - 143 destructive → `gooeyToast.error`; 209 warning → `gooeyToast.warning`; 234 success → `gooeyToast.success`
    - Ambil title/description dari `<AlertTitle>`/`<AlertDescription>`; hapus `onClose`/`toast.dismiss` manual
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 8.2 `Pages/Users/Roles/Form.jsx:22` destructive → `gooeyToast.error`
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 8.3 `Pages/Core/FormPage.jsx:922` destructive → `gooeyToast.error`
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 8.4 `Pages/Finances/PaymentEntries/Form.jsx:189` success → `gooeyToast.success`
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 9. Checkpoint - Semua call site termigrasi
  - Grep pastikan tak ada `import { toast } from "sonner"` & tak ada `toast.custom` tersisa (R3.2). `npm run build` sukses. Konfirmasi ke user.

- [ ] 10. Audit operasi async silent (R6)
  - [x] 10.1 `LinkModel.jsx` fetch → toast error-only
    - `.catch(() => {})` (baris ~458 & ~567) → `gooeyToast.error(t("core.errors.fetch_failed"), { description })`
    - Tanpa loading/success toast
    - _Requirements: 6.2, 6.6_

  - [x] 10.2 Tambah toast error pada lokasi silent lain
    - `SelectModel.jsx`, `Dashboard.jsx`, `Comments.jsx`, `Tags.jsx`, `lib/utils.js getDataModel`, `lib/htmlSanitizer.js` → error-only sesuai tabel design
    - Biarkan tracking analitik `GlobalCommandPalette.jsx` tetap silent (R6.4)
    - _Requirements: 6.1, 6.3, 6.4, 6.5, 6.6_

- [x] 11. Cleanup legacy & verifikasi akhir
  - [x]* 11.1 Hapus sistem toast legacy Zustand (opsional) — DISETUJUI USER
    - DIHAPUS: `Components/ui/sonner.jsx`, `Components/Toasts.jsx`, `Hooks/useToasts.js` (0 referensi). Komentar mati `useToasts` di `Auth/Login.jsx` dibersihkan.
    - _Requirements: 7.1_

  - [x] 11.2 Verifikasi akhir
    - `npm run build` sukses (R7.2). `php -l` 4 file lang baru: no syntax errors.
    - CATATAN: `LocaleKeysTest` GAGAL, tapi **pre-existing** (bug test di Windows: `str_replace` dgn `getRealPath()` salah strip prefix karena separator `\` vs `/`). Terbukti gagal identik tanpa file baru → BUKAN dari migrasi. Di luar scope spec.
    - _Requirements: 7.2, 7.3, 7.4_

- [x] 12. Final checkpoint - lint selesai
  - eslint --fix + prettier --write file frontend berubah: 0 errors, sisa 3 warning jsdoc kosmetik (non-blocking). Build final ✓. Pint tak dijalankan (perubahan PHP hanya file lang array, tanpa logika).

## Notes

- Task 1.1 (install dependency) **wajib minta approval user** dulu — perubahan `package.json`.
- Task 11.1 ditandai optional (`[ ]*`) — tanyakan user sebelum hapus legacy.
- Lint/eslint hanya di task 12 (akhir), bukan per task.
- Strategi shim+alias (`gooeyToast as toast`) menekan diff; KECUALI `toast.custom` yang harus ditulis ulang manual (task 8).
- Anti double-toast: hanya lapisan Inertia (task 5) yang menangani error visit; listener lama dihapus.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "2.1", "2.2"] },
    { "id": 2, "tasks": ["3.1"] },
    { "id": 3, "tasks": ["4"] },
    { "id": 4, "tasks": ["5.1", "5.3"] },
    { "id": 5, "tasks": ["5.2"] },
    { "id": 6, "tasks": ["6"] },
    { "id": 7, "tasks": ["7.1", "8.1", "8.2", "8.3", "8.4"] },
    { "id": 8, "tasks": ["9"] },
    { "id": 9, "tasks": ["10.1", "10.2"] },
    { "id": 10, "tasks": ["11.1", "11.2"] },
    { "id": 11, "tasks": ["12"] }
  ]
}
```
