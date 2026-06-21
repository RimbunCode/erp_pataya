# Frontend

## Struktur Direktori

```
resources/js/
├── Pages/
│   ├── Admin/          ← Halaman-halaman admin
│   ├── Instructors/    ← Halaman-halaman instruktur
│   ├── Students/       ← Halaman-halaman student
│   ├── Auth/           ← Login, Register, SetupUser, SelectRole
│   ├── Guest/          ← Landing page publik
│   ├── Organizations/  ← Halaman organisasi
│   └── Core/           ← Internal: DataTable, FormPage, dll
├── Layouts/
│   ├── AppLayout.jsx       ← Layout untuk Admin & Instructor (sidebar + header)
│   ├── StudentLayout.jsx   ← Layout untuk Student (sidebar + header student)
│   ├── AuthLayout.jsx      ← Layout untuk halaman auth (centered card)
│   ├── GuestLayout.jsx     ← Layout untuk landing page publik
│   ├── MainLayout.jsx      ← Layout generik (dipakai beberapa halaman)
│   └── MasterLayout.jsx    ← Base layout (dipake oleh layout lain)
├── Components/         ← Komponen shadcn/ui + Radix UI yang di-generate
├── Hooks/              ← Custom React hooks
└── lib/
    └── utils.js        ← Helper functions (cn, formatRp, dll)
```

---

## Layout per Role

| Layout | Dipakai oleh | Fitur Utama |
|--------|-------------|-------------|
| `AppLayout` | Admin & Instructor pages | Sidebar navigasi, header dengan role switcher, breadcrumb |
| `StudentLayout` | Student pages | Sidebar navigasi student, header |
| `AuthLayout` | Login, Register, ForgotPassword, dll | Halaman terpusat dengan card putih |
| `GuestLayout` | Landing page, katalog publik | Navbar publik, footer |

Setiap halaman harus mengeksport `layout` property untuk menentukan layout yang digunakan:

```jsx
// resources/js/Pages/Students/Dashboard.jsx
import StudentLayout from '@/Layouts/StudentLayout';

export default function Dashboard({ courses }) {
    return <div>...</div>;
}

Dashboard.layout = page => <StudentLayout>{page}</StudentLayout>;
```

---

## Daftar Halaman per Role

### Auth

| Halaman | File | Route |
|---------|------|-------|
| Login | `Auth/Login.jsx` | `/auth/login` |
| Register | `Auth/Register.jsx` | `/auth/register` |
| Lupa Password | `Auth/ForgotPassword.jsx` | `/auth/forgot-password` |
| Reset Password | `Auth/ResetPassword.jsx` | `/auth/reset-password/{token}` |
| Verifikasi Email | `Auth/VerifyEmail.jsx` | `/auth/verify-email` |
| Konfirmasi Password | `Auth/ConfirmPassword.jsx` | `/auth/confirm-password` |
| Pilih Role | `Auth/SelectRole.jsx` | `/auth/select-role` |
| Setup User | `Auth/SetupUser.jsx` | `/auth/setup` |

### Student

| Halaman | File | Route |
|---------|------|-------|
| Dashboard | `Students/Dashboard.jsx` | `/student/dashboard` |
| My Courses | `Students/MyCourses.jsx` | `/student/my-courses` |
| Katalog Kursus | `Students/CourseCatalogue.jsx` | `/student/course-catalogue` |
| Detail Kursus | `Students/CourseDetails.jsx` | `/student/course-preview/{course}` |
| Sertifikat | `Students/Certificates.jsx` | `/student/certificates` |
| Profil | `Students/Profile.jsx` | `/student/profile` |

### Instructor

| Halaman | File | Route |
|---------|------|-------|
| Dashboard | `Instructors/Dashboard.jsx` | `/instructor/dashboard` |
| Analitik | `Instructors/GrowthAnalytics.jsx` | `/instructor/growth` |
| Manajemen Siswa | `Instructors/StudentManagement.jsx` | `/instructor/students` |
| Daftar Kursus | `Instructors/CourseIndex.jsx` | `/instructor/classes` |
| Detail Kursus | `Instructors/CourseDetail.jsx` | `/instructor/classes/{course}` |
| Keuangan | `Instructors/Financial.jsx` | `/instructor/financial` |
| Profil | `Instructors/Profile.jsx` | `/instructor/profile` |

### Admin

| Halaman | File | Route |
|---------|------|-------|
| Dashboard | `Admin/Dashboard.jsx` | `/admin/dashboard` |
| Direktori User | `Admin/UserDirectory/Index.jsx` | `/admin/user` |
| Keuangan | `Admin/Finance/Index.jsx` | `/admin/finance` |
| Approval Kursus | `Admin/Approvals/Index.jsx` | `/admin/approvals` |
| Kategori Kursus | `Admin/CourseCategories/Index.jsx` | `/admin/course-categories` |
| Landing Page | `Admin/LandingPageSettings/Index.jsx` | `/admin/landing-page-settings` |
| Profil | `Admin/ProfileSettings.jsx` | `/admin/profile` |

---

## Custom Hooks

### `useCart`

**File**: `resources/js/Hooks/useCart.js`

Mengelola state keranjang belanja secara optimistic (UI update langsung, lalu sinkron dengan server).

```js
const { cartItems, addToCart, removeFromCart, isInCart } = useCart(initialCartItems);
```

- `addToCart(course)`: Tambah kursus ke cart, POST ke server
- `removeFromCart(courseId)`: Hapus dari cart, DELETE ke server
- `isInCart(courseId)`: Cek apakah kursus ada di cart

### `useSessionStorage`

**File**: `resources/js/Hooks/useSessionStorage.js`

Persist UI state ke sessionStorage — berguna untuk menyimpan pilihan view mode (list vs grid) yang tidak perlu dikirim ke server.

```js
const [viewMode, setViewMode] = useSessionStorage('course-view-mode', 'grid');
```

### `useDeleteModal`

**File**: `resources/js/Hooks/useDeleteModal.js`

Mengelola state modal konfirmasi delete, termasuk item yang akan dihapus.

```js
const { isOpen, itemToDelete, openModal, closeModal } = useDeleteModal();
```

### `useToasts`

**File**: `resources/js/Hooks/useToasts.js`

Mengelola antrian notifikasi toast (success/error). Biasanya terhubung dengan flash messages dari Inertia.

### `useDraftForm`

**File**: `resources/js/Hooks/useDraftForm.js`

Menyimpan draft form ke localStorage sehingga data tidak hilang jika halaman ter-refresh.

### `useIsDirtyForm`

**File**: `resources/js/Hooks/useIsDirtyForm.js`

Deteksi apakah form sudah diubah dari nilai awal, untuk menampilkan konfirmasi "Ada perubahan yang belum disimpan".

### `useLocale`

**File**: `resources/js/Hooks/useLocale.js`

Akses dan ubah locale aktif (id/en).

### `useTheme`

**File**: `resources/js/Hooks/useTheme.js`

Toggle dark/light mode.

---

## Pola Data Fetching

Tidak ada REST API terpisah. Semua data dikirim dari Laravel ke React melalui **Inertia props**:

```jsx
// Controller (PHP)
return Inertia::render('Students/CourseCatalogue', [
    'courses' => CourseResource::collection($courses),
    'categories' => CategoryResource::collection($categories),
    'filters' => $request->only(['search', 'category', 'level']),
]);

// Halaman React
export default function CourseCatalogue({ courses, categories, filters }) {
    // courses, categories, filters langsung tersedia sebagai props
}
```

### Navigasi & Form Submission

Gunakan helper dari Inertia.js, bukan `fetch` atau `axios`:

```jsx
import { router, useForm } from '@inertiajs/react';

// Navigasi
router.visit('/student/course-catalogue');

// Form submission
const { data, setData, post, processing, errors } = useForm({ search: '' });
post(route('student.cart.store'));
```

---

## Route Helper (Ziggy)

Untuk generate URL di JavaScript, gunakan `route()` helper (disediakan oleh Ziggy):

```jsx
import { route } from 'ziggy-js';

// Generate URL
const url = route('student.cart.store');                  // /student/cart
const url = route('student.course.preview', { course: id }); // /student/course-preview/abc123
```

Definisi route di-inject ke frontend via shared props `ziggy` di setiap halaman.

---

## UI Components

Komponen UI dibangun di atas **shadcn/ui** dan **Radix UI**, berlokasi di `resources/js/Components/`:

| Komponen | Deskripsi |
|---------|-----------|
| `Button`, `Input`, `Textarea` | Form controls dasar |
| `Dialog`, `AlertDialog` | Modal dan konfirmasi dialog |
| `DropdownMenu`, `Select` | Menu dropdown |
| `Card`, `Badge`, `Avatar` | Display components |
| `Table`, `DataTable` | Tabel data |
| `Tabs`, `Accordion` | Navigation patterns |
| `Chart` (Recharts wrapper) | Visualisasi data |
| `Toast` | Notifikasi popup |

**Prinsip**: Komponen ini adalah "dumb" — tidak punya state bisnis, hanya menerima props dan menampilkan UI.

---

## Dokumen Terkait

- [18 — Frontend Reference](./18-frontend-reference.md) — Inventaris lengkap halaman, komponen, dan pola frontend
- [17 — API Reference](./17-api-reference.md) — Inertia pages yang di-render per controller
- [11 — User Journeys](./11-user-journeys.md) — Alur navigasi user per role

