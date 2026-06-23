# Requirements Document

## Introduction

Aplikasi saat ini memakai **Sonner v2.0.7** sebagai sistem toast/notifikasi. Toaster di-mount sekali di `resources/js/Layouts/MasterLayout.jsx`, dibungkus wrapper `resources/js/Components/ui/sonner.jsx` yang membaca tema dari hook `useTheme()` (Zustand). Call site memanggil `import { toast } from "sonner"` secara langsung di ~16 file (40+ titik), termasuk beberapa `toast.custom(<Alert>)` yang merender komponen Alert kustom.

Tujuan perubahan ini adalah **migrasi penuh ke `goey-toast`** — komponen toast gooey/morphing (pill → blob → pill) yang dibangun di atas Sonner + Framer Motion — agar UI notifikasi lebih modern dan menarik. Migrasi mencakup:

1. Mengganti provider & seluruh call site Sonner ke `goey-toast`.
2. Menyeragamkan toast kustom (`toast.custom`) menjadi varian standard `goey-toast`.
3. Menambahkan **indikator loading berbasis promise untuk navigasi/aksi Inertia** (tanpa menghapus progress bar bawaan), yang ter-update in-place menjadi sukses/error pada toast yang sama, dengan pesan error dan tombol **Retry** saat gagal.
4. **Audit codebase** untuk operasi async yang saat ini bekerja "diam" (silent) dan menambahkan toast yang sesuai kebutuhan (contoh: `LinkModel` saat fetch hanya menampilkan toast **error**).

Migrasi tidak boleh mengubah perilaku bisnis yang ada di luar lapisan notifikasi, dan harus tetap reaktif terhadap pergantian tema serta memakai i18n yang sudah ada.

## Glossary

- **goey-toast**: Package toast gooey/morphing berbasis Sonner + Framer Motion. Menyediakan `<GooeyToaster />` (provider) dan helper `gooeyToast` (`.success/.error/.warning/.info/.promise/.update/.dismiss`). Tidak memiliki API `toast.custom`.
- **Toast standard**: Varian bawaan goey-toast (`gooeyToast.success/error/warning/info/default`) dengan `title` + opsi `description`, `action`, `icon`, dst. — lawan dari "toast custom".
- **Toast custom**: Pemanggilan `toast.custom(<KomponenJSX />)` pada implementasi Sonner saat ini (umumnya merender komponen `Alert`).
- **Shim toast**: Modul perantara yang meng-export `gooeyToast` (dan `GooeyToaster`) sehingga call site cukup mengganti sumber import tanpa menulis ulang logika.
- **Visit Inertia**: Permintaan navigasi/aksi yang dilakukan Inertia (`router.get/post/put/patch/delete/visit`, `<Link>`, atau form submit). Memicu event `router.on('start' | 'finish' | 'success' | 'error' | 'exception')`.
- **Navigasi GET**: Visit Inertia bermetode `GET` untuk berpindah halaman (bukan mutasi data).
- **Mutasi**: Visit Inertia bermetode `POST/PUT/PATCH/DELETE` yang mengubah data di server.
- **Delay-threshold**: Ambang waktu (~350ms) sebelum toast loading ditampilkan; visit yang selesai lebih cepat dari ambang ini tidak memunculkan toast loading (cukup progress bar bawaan) agar tidak berkedip/spam.
- **Loading toast in-place**: Satu toast yang dibuka saat loading dan kemudian di-`update()` menjadi sukses/gagal memakai `id` yang sama, alih-alih membuat toast baru.
- **currentTheme**: Nilai tema yang sudah teresolusi (`'light' | 'dark'`) dari `useTheme()`; nilai `'system'` sudah dipetakan ke salah satunya.
- **LinkModel**: Komponen `resources/js/Components/LinkModel.jsx` untuk memilih data relasi via `axios.post(route("model"))`; saat ini menelan error secara diam (`.catch(() => {})`).

## Requirements

### Requirement 1: Provider goey-toast menggantikan Sonner

**User Story:** As a pengguna aplikasi, I want notifikasi tampil dengan gaya gooey-toast yang modern, so that pengalaman visual lebih menarik dan konsisten di seluruh aplikasi.

#### Acceptance Criteria

1. THE aplikasi SHALL me-mount `<GooeyToaster />` tepat satu kali dekat root (menggantikan `<Toaster />` Sonner di `MasterLayout.jsx`).
2. THE entry point (`resources/js/app.jsx`) SHALL meng-import stylesheet `goey-toast/styles.css` tepat satu kali.
3. WHEN halaman dimuat, THE aplikasi SHALL TIDAK lagi merender komponen `<Toaster />` berbasis Sonner.
4. THE package `goey-toast` dan peer dependency `framer-motion` SHALL terpasang di `package.json` sebelum implementasi UI (perubahan dependency memerlukan persetujuan user).
5. IF stylesheet `goey-toast/styles.css` tidak ter-import, THEN kondisi ini dianggap cacat (toast tampil tanpa gaya) dan SHALL diperbaiki.

### Requirement 2: Konfigurasi GooeyToaster sesuai ketentuan

**User Story:** As a developer, I want GooeyToaster dikonfigurasi sesuai standar yang ditetapkan, so that perilaku animasi, posisi, dan durasi seragam.

#### Acceptance Criteria

1. THE `<GooeyToaster />` SHALL menerima prop `theme` yang bernilai `currentTheme` dari `useTheme()` (`'light' | 'dark'`).
2. THE `<GooeyToaster />` SHALL diset `spring={true}`.
3. THE `<GooeyToaster />` SHALL diset preset animasi `smooth` (prop `preset="smooth"`).
4. THE `<GooeyToaster />` SHALL diset `duration={5000}`.
5. THE `<GooeyToaster />` SHALL diset `position="top-center"`.
6. WHEN user mengganti tema saat runtime, THE `<GooeyToaster />` SHALL ikut memperbarui `theme` mengikuti `currentTheme` terbaru.

### Requirement 3: Migrasi penuh seluruh call site toast

**User Story:** As a developer, I want semua pemanggilan toast lama berpindah ke goey-toast, so that tidak ada dua sistem toast yang berjalan bersamaan.

#### Acceptance Criteria

1. THE seluruh call site `toast.success/.error/.warning/.info(...)` Sonner SHALL diganti menjadi padanan `gooeyToast.*` dengan title, `description`, dan opsi yang setara.
2. WHEN migrasi selesai, THE codebase SHALL TIDAK lagi mengandung `import { toast } from "sonner"` di luar shim/wrapper resmi.
3. THE pesan toast SHALL tetap memakai mekanisme i18n yang ada (`t(...)` / `translateWithFallback`), tanpa hardcode string baru.
4. IF sebuah call site sebelumnya memakai opsi yang tidak didukung goey-toast (mis. `cancel` button), THEN call site SHALL dipetakan ke opsi goey-toast terdekat atau dihilangkan dengan perilaku setara.

### Requirement 4: Toast custom dipaksa menjadi standard goey

**User Story:** As a developer, I want toast custom berbasis Alert diseragamkan ke varian standard goey, so that tampilan notifikasi konsisten dan tidak ada komponen custom di dalam toast.

#### Acceptance Criteria

1. THE setiap `toast.custom((id) => <Alert .../>)` SHALL dikonversi menjadi `gooeyToast.error/success/info/warning` dengan `title` (dan `description` bila ada konten tambahan).
2. WHEN konversi dilakukan, THE toast SHALL TIDAK lagi merender komponen `Alert` di dalam body toast.
3. THE konversi SHALL mencakup minimal call site berikut: `MasterLayout.jsx` (HTTP error), `Pages/Users/Roles/Form.jsx`, `Pages/Finances/PaymentEntries/Form.jsx`, `Pages/Core/FormPage.jsx`, dan `InputBarcode.jsx` (tiga titik).
4. THE tipe toast hasil konversi SHALL mencerminkan makna aslinya (error → `error`, sukses → `success`, info → `info`).

### Requirement 5: Loading toast Inertia berbasis promise dengan update in-place dan Retry

**User Story:** As a pengguna, I want melihat indikator loading saat aksi/navigasi berlangsung dan hasil sukses/gagal pada toast yang sama, so that saya tahu status proses dan bisa mencoba ulang bila gagal.

#### Acceptance Criteria

1. THE aplikasi SHALL memasang listener `router.on('start' | 'finish' | 'success' | 'error' | 'exception')` untuk seluruh visit Inertia, termasuk **navigasi GET** dan **mutasi**.
2. THE penambahan loading toast SHALL TIDAK menghapus atau menggantikan progress bar bawaan Inertia (keduanya berjalan paralel).
3. WHEN sebuah visit dimulai, THE aplikasi SHALL menjadwalkan toast loading dengan **delay-threshold ~350ms**.
4. IF visit selesai sebelum delay-threshold tercapai, THEN THE aplikasi SHALL membatalkan jadwal dan TIDAK menampilkan toast loading apa pun.
5. WHEN delay-threshold tercapai sebelum visit selesai, THE aplikasi SHALL menampilkan satu toast loading dan menyimpan `id`-nya.
6. WHEN visit berakhir sukses DAN toast loading sudah tampil, THE aplikasi SHALL meng-`update()` toast yang sama menjadi tipe `success`.
7. WHEN visit berakhir gagal/error/exception DAN toast loading sudah tampil, THE aplikasi SHALL meng-`update()` toast yang sama menjadi tipe `error`, menampilkan pesan error, dan menyertakan **action `Retry`**.
8. WHEN user menekan **Retry**, THE aplikasi SHALL menjalankan ulang visit terakhir yang gagal (memakai detail visit yang tersimpan).
9. IF visit gagal SEBELUM toast loading tampil (lebih cepat dari delay-threshold), THEN THE aplikasi SHALL tetap menampilkan toast error (dengan pesan + Retry) secara langsung.
10. THE penanganan error Inertia yang sudah ada (listener `inertia:invalid` / `inertia:exception` di `MasterLayout.jsx`) SHALL diselaraskan dengan lapisan baru agar tidak memunculkan toast ganda untuk satu kegagalan.

### Requirement 6: Audit operasi async yang silent dan tambahkan toast sesuai kebutuhan

**User Story:** As a pengguna, I want operasi async yang sebelumnya gagal diam-diam memberi umpan balik yang sesuai, so that saya tahu ketika ada masalah atau keberhasilan.

#### Acceptance Criteria

1. THE proses harus mengaudit `resources/js` untuk operasi async (axios/fetch/router) yang TIDAK memiliki umpan balik loading/sukses/error ke pengguna.
2. WHEN `LinkModel` gagal fetch data (`axios.post(route("model"))`), THE komponen SHALL menampilkan toast **error saja** (TIDAK menampilkan toast loading maupun success), dengan pesan error yang dapat dipahami.
3. THE audit SHALL meninjau minimal lokasi berikut dan menetapkan jenis toast yang sesuai per lokasi: `LinkModel.jsx`, `SelectModel.jsx`, `Dashboard.jsx`, `Pages/Core/Components/Comments.jsx`, `Pages/Core/Components/Tags.jsx`, `lib/utils.js` (`getDataModel`), `lib/htmlSanitizer.js`, dan `AlertDialogs/DeleteDialog.jsx`.
4. IF sebuah operasi sengaja dirancang gagal diam (mis. tracking analitik non-blocking di `GlobalCommandPalette.jsx`), THEN operasi tersebut SHALL dibiarkan tanpa toast dan keputusan ini SHALL dicatat di design.
5. THE jenis toast per lokasi (loading/success/error atau kombinasi) SHALL didokumentasikan dalam tabel di `design.md`.
6. THE penambahan toast hasil audit SHALL TIDAK mengubah logika bisnis atau alur kontrol selain menambahkan umpan balik notifikasi.

### Requirement 7: Tidak ada regresi & pembersihan sistem toast lama

**User Story:** As a maintainer, I want sistem toast lama dibersihkan dan tidak ada fungsionalitas yang rusak, so that codebase tetap bersih dan stabil.

#### Acceptance Criteria

1. THE sistem toast legacy berbasis Zustand (`resources/js/Hooks/useToasts.js` dan `resources/js/Components/Toasts.jsx`) SHALL dievaluasi; karena tidak terpakai, keputusan hapus atau pertahankan SHALL ditetapkan di `design.md`.
2. WHEN migrasi selesai, THE aplikasi SHALL tetap dapat di-build (`npm run build`) tanpa error terkait toast.
3. THE perubahan SHALL TIDAK mengganggu test PHP yang ada (mis. `tests/Feature/Core/CompanyNumberFormatTest.php`).
4. THE seluruh perilaku toast yang sudah ada (sukses upload, simpan filter, error HTTP, dll.) SHALL tetap berfungsi setelah migrasi.
