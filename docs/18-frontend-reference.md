# Referensi Frontend

Dokumen ini merupakan referensi lengkap untuk developer frontend yang bekerja pada proyek ERP Inkindo. Mencakup inventaris halaman, komponen, hooks, dan pola-pola umum yang digunakan.

---

## 1. Inventaris Halaman per Role

### 1.1 Auth Pages

| Halaman | File Path | Route Name | URL | Keterangan |
|---------|-----------|------------|-----|------------|
| Login | `Pages/Auth/Login.jsx` | `login` | `/login` | Halaman masuk akun |
| Register | `Pages/Auth/Register.jsx` | `register` | `/register` | Halaman pendaftaran akun baru |
| Lupa Password | `Pages/Auth/ForgotPassword.jsx` | `password.request` | `/forgot-password` | Request reset password via email |
| Reset Password | `Pages/Auth/ResetPassword.jsx` | `password.reset` | `/reset-password/{token}` | Form reset password dengan token |
| Verifikasi Email | `Pages/Auth/VerifyEmail.jsx` | `verification.notice` | `/verify-email` | Pemberitahuan verifikasi email |
| Konfirmasi Password | `Pages/Auth/ConfirmPassword.jsx` | `password.confirm` | `/confirm-password` | Konfirmasi password sebelum aksi sensitif |
| Pilih Role | `Pages/Auth/SelectRole.jsx` | `select-role` | `/select-role` | Pemilihan role setelah login (multi-role) |
| Setup User | `Pages/Auth/SetupUser.jsx` | `setup` | `/setup` | Setup profil pertama kali |

### 1.2 Guest Pages (Landing / Publik)

| Halaman | File Path | Route Name | URL | Keterangan |
|---------|-----------|------------|-----|------------|
| Home / Landing Page | `Pages/Guest/Index.jsx` | `guest.home` | `/` | Landing page utama publik |
| Katalog Training | `Pages/Guest/CourseSection/CourseCatalogue.jsx` | `guest.training` | `/training` | Katalog kursus publik |
| Preview Training | `Pages/Guest/CourseSection/CoursePreview.jsx` | `guest.training.preview` | `/training/{course}` | Detail kursus publik |
| Verifikasi Sertifikat | `Pages/Guest/VerifyCTA/VerifyCTA.jsx` | `guest.verify` | `/verify` | Verifikasi keaslian sertifikat |
| Tentang Kami | `Pages/Guest/AboutUs/AboutUs.jsx` | `guest.about` | `/about` | Halaman profil organisasi |
| Kontak | `Pages/Guest/Contact/ContactInfo.jsx` | `guest.contact` | `/contact` | Halaman informasi kontak |
| Footer | `Pages/Guest/Footer.jsx` | — | — | Komponen footer landing page |
| CTA Banner | `Pages/Guest/CTABannerSection.jsx` | — | — | Section CTA banner |
| Popular Training | `Pages/Guest/PopularTrainingSection.jsx` | — | — | Section training populer |
| Why Inkindo | `Pages/Guest/WhyInkindo.jsx` | — | — | Section keunggulan Inkindo |
| Live Editor | `Pages/Guest/LiveEditor/GuestLiveEditorPanel.jsx` | — | — | Editor konten landing page (admin) |

### 1.3 Student Pages

| Halaman | File Path | Route Name | URL | Keterangan |
|---------|-----------|------------|-----|------------|
| Dashboard | `Pages/Students/Dashboard.jsx` | `student.dashboard` | `/student/dashboard` | Dashboard utama student |
| My Courses | `Pages/Students/MyCourses.jsx` | `student.courses.index` | `/student/my-courses` | Daftar kursus yang diikuti |
| Katalog Kursus | `Pages/Students/CourseCatalogue.jsx` | `student.course-catalogue` | `/student/course-catalogue` | Katalog kursus untuk student |
| Preview Kursus | `Pages/Students/CoursePreview.jsx` | `student.course.preview` | `/student/course-preview/{course}` | Preview kursus sebelum enroll |
| Detail Kursus | `Pages/Students/CourseDetails.jsx` | — | — | Detail kursus yang sedang diikuti |
| Sertifikat | `Pages/Students/Certificates.jsx` | `student.certificates` | `/student/certificates` | Daftar sertifikat student |
| Profil | `Pages/Students/ProfileSettings.jsx` | `student.profile` | `/student/profile` | Pengaturan profil student |

**Sub-komponen Student:**
- `Pages/Students/Components/CartPanel.jsx` — Panel keranjang belanja kursus
- `Pages/Students/Components/CourseCard.jsx` — Card kursus dalam katalog
- `Pages/Students/Components/CourseCompare.jsx` — Perbandingan kursus
- `Pages/Students/Components/MyCourseCard.jsx` — Card kursus yang diikuti
- `Pages/Students/Components/MyCourseInnerSection.jsx` — Section dalam halaman my courses

### 1.4 Instructor Pages

| Halaman | File Path | Route Name | URL | Keterangan |
|---------|-----------|------------|-----|------------|
| Dashboard | `Pages/Instructors/Dashboard.jsx` | `instructor.dashboard` | `/instructor/dashboard` | Dashboard instruktur |
| Manage Classes | `Pages/Instructors/ManageClasses.jsx` | `instructor.classes.index` | `/instructor/classes` | Daftar & manajemen kursus |
| Course Detail | `Pages/Instructors/CourseDetail.jsx` | `instructor.classes.show` | `/instructor/classes/{course}` | Detail kursus (sections, contents) |
| Student Management | `Pages/Instructors/StudentManagement.jsx` | `instructor.students` | `/instructor/students` | Manajemen siswa terdaftar |
| Growth Analytics | `Pages/Instructors/GrowthAnalytics.jsx` | `instructor.growth` | `/instructor/growth` | Analitik pertumbuhan instruktur |
| Financial | `Pages/Instructors/Financials.jsx` | `instructor.financial` | `/instructor/financial` | Keuangan & payout request |
| Profile | `Pages/Instructors/ProfileSettings.jsx` | `instructor.profile` | `/instructor/profile` | Pengaturan profil instruktur |

**Sub-komponen Instructor:**
- `Pages/Instructors/Components/CourseCard.jsx` — Card kursus instruktur
- `Pages/Instructors/Components/CourseRow.jsx` — Baris tabel daftar kursus
- `Pages/Instructors/Components/CourseStats.jsx` — Statistik kursus
- `Pages/Instructors/Components/CourseToolbar.jsx` — Toolbar aksi kursus
- `Pages/Instructors/Components/CourseDetailSectionBlock.jsx` — Blok section dalam detail kursus
- `Pages/Instructors/Components/CourseDetailContentRow.jsx` — Baris konten dalam section
- `Pages/Instructors/Components/CourseDetailContentBucket.jsx` — Container konten file
- `Pages/Instructors/Components/CourseDetailEditModal.jsx` — Modal edit konten/section
- `Pages/Instructors/Components/CourseDetailSectionNotes.jsx` — Catatan per section
- `Pages/Instructors/Components/CourseDetailStatCard.jsx` — Stat card dalam detail
- `Pages/Instructors/Components/CourseDetailTypeIcon.jsx` — Ikon tipe konten
- `Pages/Instructors/Components/CreateCourseModal.jsx` — Modal buat kursus baru (multi-step)
- `Pages/Instructors/Components/StudentFullReport.jsx` — Report lengkap per siswa
- `Pages/Instructors/Components/StudentManagementModal.jsx` — Modal detail siswa
- `Pages/Instructors/Components/StudentManagementRow.jsx` — Baris tabel siswa
- `Pages/Instructors/Components/StudentManagementStatCard.jsx` — Statistik siswa
- `Pages/Instructors/Components/StudentManagementProgressRing.jsx` — Ring progress siswa
- `Pages/Instructors/CourseModal/` — Modal kursus multi-step (Step1Form, Step2Sections, dll)

### 1.5 Admin Pages

| Halaman | File Path | Route Name | URL | Keterangan |
|---------|-----------|------------|-----|------------|
| Dashboard | `Pages/Admin/Dashboard.jsx` | `admin.dashboard` | `/admin/dashboard` | Dashboard admin |
| User Directory | `Pages/Admin/UserDirectory/index.jsx` | `admin.user` | `/admin/user` | Direktori & manajemen user |
| System Finance | `Pages/Admin/SystemFinance.jsx` | `admin.finance` | `/admin/finance` | Keuangan sistem (pembayaran, payout) |
| Approvals | `Pages/Admin/Approvals.jsx` | `admin.approval` | `/admin/approvals` | Approval publish kursus |
| Course Categories | `Pages/Admin/CourseCategories/index.jsx` | `admin.course-categories.index` | `/admin/course-categories` | Manajemen kategori kursus |
| Landing Page Settings | `Pages/Admin/LandingPageSettings/index.jsx` | `admin.landing-page-settings.index` | `/admin/landing-page-settings` | Pengaturan konten landing page |
| Profile | `Pages/Admin/ProfileSettings.jsx` | `admin.profile` | `/admin/profile` | Pengaturan profil admin |

### 1.6 Organization Pages

| Halaman | File Path | Route Name | URL | Keterangan |
|---------|-----------|------------|-----|------------|
| Dashboard | `Pages/Organizations/Dashboard.jsx` | `organization.dashboard` | `/organization/dashboard` | Dashboard organisasi |
| Partner Trainers | `Pages/Organizations/PartnerTrainers.jsx` | `organization.partner` | `/organization/partner` | Daftar partner trainer |

### 1.7 Core / Shared Pages

| Halaman | File Path | Keterangan |
|---------|-----------|------------|
| DataTable | `Pages/Core/DataTable.jsx` | Halaman tabel data generik (server-side) |
| DataTable2 | `Pages/Core/DataTable2.jsx` | Versi kedua DataTable dengan fitur tambahan |
| FormPage | `Pages/Core/FormPage.jsx` | Halaman form CRUD generik (create/edit/show) |
| Print | `Pages/Core/Print.jsx` | Halaman print dokumen |
| ShowLog | `Pages/Core/ShowLog.jsx` | Tampilan audit log |
| CountryLinkModel | `Pages/Core/CountryLinkModel.jsx` | LinkModel untuk negara |
| CurrencyLinkModel | `Pages/Core/CurrencyLinkModel.jsx` | LinkModel untuk mata uang |
| PermissionLinkModel | `Pages/Core/PermissionLinkModel.jsx` | LinkModel untuk permission |
| Language Index | `Pages/Core/Language/Index.jsx` | Manajemen bahasa |
| PrintTemplate Editor | `Pages/Core/PrintTemplate/Editor.jsx` | Editor template cetak (GrapesJS) |
| PrintTemplate Form | `Pages/Core/PrintTemplate/Form.jsx` | Form template cetak |

### 1.8 Halaman Lainnya

| Halaman | File Path | Keterangan |
|---------|-----------|------------|
| Welcome | `Pages/Welcome.jsx` | Halaman welcome/splash |
| Error | `Pages/Error.jsx` | Halaman error (404, 500, dll) |
| MultirolePage | `Pages/MultirolePage.jsx` | Halaman yang bisa diakses multi-role |
| ShowGeneral | `Pages/ShowGeneral.jsx` | Halaman detail generik |
| Status | `Pages/Status.jsx` | Status sistem (debug) |
| Test | `Pages/Test.jsx` | Halaman testing (development only) |

---

## 2. Katalog Komponen

### 2.1 UI Primitives (shadcn/ui + Radix UI)

Berlokasi di `resources/js/Components/ui/`:

| Komponen | File | Fungsi |
|----------|------|--------|
| Accordion | `ui/accordion.jsx` | Collapsible content sections |
| AlertDialog | `ui/alert-dialog.jsx` | Konfirmasi dialog (destructive actions) |
| Alert | `ui/alert.jsx` | Inline alert/notification banner |
| Avatar | `ui/avatar.jsx` | Foto profil/inisial user |
| Breadcrumb | `ui/breadcrumb.jsx` | Navigasi breadcrumb |
| Button | `ui/button.jsx` | Tombol aksi (primary, secondary, destructive, ghost, dll) |
| ButtonGroup | `ui/button-group.jsx` | Grup tombol terkait |
| Calendar | `ui/calendar.jsx` | Kalender date picker |
| Card | `ui/card.jsx` | Container konten dengan border |
| Carousel | `ui/carousel.jsx` | Slider konten |
| Chart | `ui/chart.jsx` | Wrapper Recharts untuk visualisasi data |
| Checkbox | `ui/checkbox.jsx` | Input checkbox |
| Collapsible | `ui/collapsible.jsx` | Konten yang bisa di-collapse |
| Command | `ui/command.jsx` | Command palette (Ctrl+K) |
| Dialog | `ui/dialog.jsx` | Modal dialog |
| Drawer | `ui/drawer.jsx` | Side drawer / bottom sheet |
| DropdownMenu | `ui/dropdown-menu.jsx` | Menu dropdown (actions, options) |
| Field | `ui/field.jsx` | Form field wrapper (label + input + error) |
| HoverCard | `ui/hover-card.jsx` | Card yang muncul saat hover |
| InputGroup | `ui/input-group.jsx` | Input dengan prefix/suffix |
| Input | `ui/input.jsx` | Input text dasar |
| Kbd | `ui/kbd.jsx` | Keyboard shortcut badge |
| Label | `ui/label.jsx` | Label form field |
| Pagination | `ui/pagination.jsx` | Navigasi halaman |
| Popover | `ui/popover.jsx` | Floating popover content |
| Progress | `ui/progress.jsx` | Progress bar |
| RadioGroup | `ui/radio-group.jsx` | Radio button group |
| RunningText | `ui/running-text.jsx` | Marquee / running text |
| ScrollArea | `ui/scroll-area.jsx` | Custom scrollable area |
| Select | `ui/select.jsx` | Dropdown select |
| Separator | `ui/separator.jsx` | Garis pemisah |
| Sheet | `ui/sheet.jsx` | Side panel overlay |
| Sidebar | `ui/sidebar.jsx` | Komponen sidebar (provider, trigger, content) |
| Skeleton | `ui/skeleton.jsx` | Loading placeholder |
| Slider | `ui/slider.jsx` | Range slider |
| Sonner | `ui/sonner.jsx` | Toast notification (via sonner) |
| Table | `ui/table.jsx` | HTML table wrapper |
| Tabs | `ui/tabs.jsx` | Tab navigation |
| Textarea | `ui/textarea.jsx` | Multi-line input |
| Tooltip | `ui/tooltip.jsx` | Tooltip on hover |

**Komponen UI khusus (`ui/` non-primitive):**

| Komponen | File | Fungsi |
|----------|------|--------|
| FormControls | `ui/FormControls.jsx` | Wrapper kontrol form standar |
| Icon | `ui/Icon.jsx` | Wrapper ikon generik |
| PermBadge | `ui/PermBadge.jsx` | Badge permission |
| RoleBadge | `ui/RoleBadge.jsx` | Badge role user |
| StatusBadge | `ui/StatusBadge.jsx` | Badge status dokumen |

### 2.2 Custom Components

Berlokasi di `resources/js/Components/`:

| Komponen | File | Fungsi |
|----------|------|--------|
| ApplicationLogo | `ApplicationLogo.jsx` | Logo aplikasi |
| BadgeStatus | `BadgeStatus.jsx` | Badge status form/dokumen |
| CheckoutModal | `CheckoutModal.jsx` | Modal checkout pembayaran kursus |
| Combobox | `Combobox.jsx` | Searchable dropdown (autocomplete) |
| CurrencyInput | `CurrencyInput.jsx` | Input nominal mata uang (Rp format) |
| DashboardChart | `DashboardChart.jsx` | Chart komponen dashboard |
| DatetimePicker | `DatetimePicker.jsx` | Picker tanggal & waktu |
| Dropdown | `Dropdown.jsx` | Simple dropdown legacy |
| FormInput | `FormInput.jsx` | Wrapper field form (label + children + error) |
| FormTable | `FormTable.jsx` | Tabel editable di dalam form |
| InputBarcode | `InputBarcode.jsx` | Input dengan scanner barcode |
| InputError | `InputError.jsx` | Pesan error di bawah input |
| InputLabel | `InputLabel.jsx` | Label input |
| Link | `Link.jsx` | Enhanced Inertia Link component |
| LinkModel | `LinkModel.jsx` | Modal pencarian & pemilihan record model |
| LoadingIcon | `LoadingIcon.jsx` | Animasi loading spinner |
| Mention | `Mention.jsx` | Inline mention user |
| MultiSelect | `MultiSelect.jsx` | Multi-value select dropdown |
| NestedSelect | `NestedSelect.jsx` | Select dengan opsi berjenjang/tree |
| PasswordChecker | `PasswordChecker.jsx` | Indikator kekuatan password |
| PasswordInput | `PasswordInput.jsx` | Input password dengan toggle show/hide |
| ReactQuill | `ReactQuill.jsx` | Rich text editor (Quill-based) |
| Select | `Select.jsx` | Custom select dengan search & create |
| SelectModel | `SelectModel.jsx` | Select yang fetch data dari model |
| StrikethroughDiff | `StrikethroughDiff.jsx` | Diff viewer dengan strikethrough |
| TextInput | `TextInput.jsx` | Input teks sederhana |
| TiptapHtmlRenderer | `TiptapHtmlRenderer.jsx` | Render HTML dari Tiptap editor |
| Toasts | `Toasts.jsx` | Container toast notifications (legacy) |
| ToggleTheme | `ToggleTheme.jsx` | Toggle dark/light mode |

**TimePicker:**
- `TimePicker/time-picker-input.jsx` — Input waktu (jam, menit, detik)
- `TimePicker/time-picker-utils.js` — Utility functions time picker

**Charts:**
- `Charts/PeriodFilterChart.jsx` — Chart dengan filter periode waktu

**Auth:**
- `Auth/RoleSelectionCards.jsx` — Card pemilihan role saat register/login

**Modals:**
- `Modals/LoginModal.jsx` — Modal login (untuk guest page)
- `Modals/RegisterModal.jsx` — Modal register (untuk guest page)

### 2.3 Layout & Navigation Components

**Sidebar (`Components/Sidebar/`):**

| Komponen | File | Fungsi |
|----------|------|--------|
| AppSidebar | `Sidebar/AppSidebar.jsx` | Sidebar utama (wraps MainSidebar) |
| MainSidebar | `Sidebar/MainSidebar.jsx` | Konten sidebar (menu items per role) |
| NavMain | `Sidebar/NavMain.jsx` | Navigasi utama sidebar (collapsible) |
| BranchSwitcher | `Sidebar/BranchSwitcher.jsx` | Switcher cabang organisasi |

**Navbar (`Components/Navbar/`):**

| Komponen | File | Fungsi |
|----------|------|--------|
| Navbar | `Navbar/Navbar.jsx` | Header navbar utama (breadcrumb, actions) |
| MainNavbar | `Navbar/MainNavbar.jsx` | Navbar untuk halaman main/general |
| NavbarGuest | `Navbar/NavbarGuest.jsx` | Navbar untuk halaman guest/publik |
| NavConfig | `Navbar/NavConfig.jsx` | Konfigurasi menu navigasi per role |
| Notifications | `Navbar/Notifications.jsx` | Bell notification dropdown |
| UserInfo | `Navbar/UserInfo.jsx` | User avatar + dropdown profil |

### 2.4 Table Components (`Components/Table/`)

| Komponen | File | Fungsi |
|----------|------|--------|
| Table | `Table/Table.jsx` | Tabel data dengan sorting & pagination |
| Table2 | `Table/Table2.jsx` | Versi kedua tabel dengan fitur lanjutan |
| FilterTable | `Table/FilterTable.jsx` | Wrapper filter untuk tabel |
| FilterItem | `Table/FilterItem.jsx` | Item filter individual |
| Header | `Table/Header.jsx` | Header tabel (kolom sortable) |
| Pagination | `Table/Pagination.jsx` | Navigasi halaman tabel |
| ColumnsFilter | `Table/ColumnsFilter.jsx` | Visibility toggle per kolom |
| NoDataImg | `Table/NoDataImg.jsx` | Ilustrasi ketika data kosong |

---

## 3. Daftar Hooks

Berlokasi di `resources/js/Hooks/`:

| Hook | File | Tujuan | Contoh Penggunaan |
|------|------|--------|-------------------|
| `useCart` | `useCart.js` | Manajemen cart kursus dengan optimistic update | `const { cart, addToCart, removeFromCart } = useCart(courses, cartItems)` |
| `useDraftForm` | `useDraftForm.js` | Menyimpan draft form ke localStorage agar tidak hilang saat refresh | `const form = useDraftForm('create-course', initialData, options)` |
| `useIsDirtyForm` | `useIsDirtyForm.js` | Deteksi perubahan form untuk konfirmasi "unsaved changes" | Zustand store: `useIsDirtyForm.getState().setIsDirty(true)` |
| `useDeleteModal` | `useDeleteModal.js` | State modal konfirmasi delete (route, id, attributes) | `const { open } = useDeleteModal(); open('courses.destroy', courseId)` |
| `useToasts` | `useToasts.js` | Zustand store antrian toast notification | `useToasts.getState().addToast({ type: 'success', message: '...' })` |
| `usePermission` | `usePermission.jsx` | Cek izin akses berdasarkan Inertia shared props | `const { can, canGlobal } = usePermission('course'); can('edit')` |
| `useNestedFilters` | `useNestedFilters.jsx` | Filter berjenjang/tree untuk DataTable (AND/OR groups) | Context provider + builder untuk query filters kompleks |
| `useSessionStorage` | `useSessionStorage.js` | Persist state ke sessionStorage (view mode, dll) | `const [viewMode, setViewMode] = useSessionStorage('key', 'grid')` |
| `useLocale` | `useLocale.js` | Akses & ubah locale aktif (id/en) | `const { locale, setLocale } = useLocale()` |
| `useTheme` | `useTheme.js` | Toggle dark/light/system theme | `const { theme, setTheme } = useTheme()` |
| `useIsMobile` | `use-mobile.jsx` | Deteksi viewport mobile (< 768px) | `const isMobile = useIsMobile()` |
| `useIsTablet` | `use-tablet.jsx` | Deteksi viewport tablet | `const isTablet = useIsTablet()` |
| `useScreen` | `useScreen.jsx` | Deteksi viewport berdasarkan breakpoint custom | `const isLg = useScreen('1024px')` |
| `useDidMountEffect` | `useDidMountEffect.js` | useEffect yang skip first render | `useDidMountEffect(() => { ... }, [deps])` |
| `useDynamicRefs` | `useDynamicRefs.js` | Membuat refs dinamis (key → ref) | `const { getRef, setRef } = useDynamicRefs()` |

---

## 4. Pola Frontend

### 4.1 Form Handling (useForm + Inertia)

#### Pola Standar Form

```jsx
import { useForm } from '@inertiajs/react';

export default function CreateCourse() {
    const { data, setData, post, processing, errors, reset } = useForm({
        title: '',
        description: '',
        price: 0,
    });

    const submit = (e) => {
        e.preventDefault();
        post(route('instructor.classes.store'), {
            onSuccess: () => reset(),
        });
    };

    return (
        <form onSubmit={submit}>
            <FormInput label="Judul" error={errors.title}>
                <Input value={data.title} onChange={e => setData('title', e.target.value)} />
            </FormInput>
            <Button type="submit" disabled={processing}>Simpan</Button>
        </form>
    );
}
```

#### Draft Form (Auto-save ke localStorage)

```jsx
import { useDraftForm } from '@/Hooks/useDraftForm';

const form = useDraftForm('create-course', { title: '', price: 0 }, {
    expiredDays: 7,
    onContinueDraft: () => { /* restore callback */ },
});
// form API sama dengan useForm dari Inertia
```

File terkait: `Hooks/useDraftForm.js`, `Layouts/MasterLayout.jsx` (alert dialog draft/dirty).

#### File Upload dalam Form

```jsx
const { data, setData, post } = useForm({ thumbnail: null });

const handleUpload = (e) => {
    setData('thumbnail', e.target.files[0]);
};

// Submit menggunakan FormData otomatis oleh Inertia
post(route('instructor.classes.thumbnail.update', courseId), {
    forceFormData: true,
});
```

File terkait: `Pages/Instructors/Components/CreateCourseModal.jsx`, `Pages/Core/Components/UploadDialog.jsx`.

### 4.2 Data Table Pattern

#### Penggunaan DataTable (Server-side)

`Pages/Core/DataTable.jsx` menyediakan halaman tabel generik yang terintegrasi dengan `ModelController`:

```jsx
// Controller mengirim data:
return Inertia::render('Core/DataTable', [
    'columns' => [...],
    'data' => $paginator,
    'filters' => $request->filters,
]);
```

Fitur DataTable:
- **Server-side pagination**: Navigasi halaman via Inertia router
- **Server-side sorting**: Klik header kolom → request ulang dengan sort params
- **Filtering**: `FilterTable` + `FilterItem` komponen
- **Column visibility**: `ColumnsFilter` toggle per kolom
- **Bulk actions**: Seleksi baris + dropdown aksi
- **Export**: Button export data

#### ModelController Integration

`POST /model/datatable` endpoint digunakan untuk fetch data tabel secara generik:

```jsx
router.post(route('model.datatable'), {
    model: 'Course',
    filters: { search: '...', status: 'published' },
    sort: { column: 'created_at', direction: 'desc' },
    page: 1,
    per_page: 10,
});
```

File terkait: `Components/Table/Table.jsx`, `Components/Table/Pagination.jsx`, `Pages/Core/DataTable.jsx`.

### 4.3 Modal/Dialog Pattern

#### Konfirmasi Delete

Menggunakan global `DeleteDialog` di `MasterLayout` + Zustand store `useDeleteModal`:

```jsx
import useDeleteModal from '@/Hooks/useDeleteModal';

function CourseRow({ course }) {
    const { open } = useDeleteModal();

    return (
        <Button
            variant="destructive"
            onClick={() => open('instructor.classes.destroy', course.id)}
        >
            Hapus
        </Button>
    );
}
// Dialog muncul otomatis di MasterLayout, DELETE request dikirim saat confirm
```

#### Konfirmasi Approve/Reject

```jsx
import { AlertDialog, AlertDialogAction, ... } from '@/Components/ui/alert-dialog';

const [showConfirm, setShowConfirm] = useState(false);

<AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
    <AlertDialogContent>
        <AlertDialogHeader>
            <AlertDialogTitle>Approve Kursus?</AlertDialogTitle>
        </AlertDialogHeader>
        <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleApprove}>Approve</AlertDialogAction>
        </AlertDialogFooter>
    </AlertDialogContent>
</AlertDialog>
```

#### Form Modal

```jsx
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/Components/ui/dialog';

<Dialog open={isOpen} onOpenChange={setIsOpen}>
    <DialogContent>
        <DialogHeader><DialogTitle>Buat Kursus</DialogTitle></DialogHeader>
        <form onSubmit={submit}>
            {/* form fields */}
        </form>
    </DialogContent>
</Dialog>
```

File terkait: `Layouts/AlertDialogs/DeleteDialog.jsx`, `Pages/Instructors/Components/CreateCourseModal.jsx`.

### 4.4 Toast Notifications

#### Mekanisme Flash Message → Toast

1. Backend mengirim flash data via Inertia shared props (`alerts`)
2. `MasterLayout.jsx` menggunakan `sonner` toast library
3. `Toasts.jsx` (legacy) membaca `usePage().props.alerts` dan menampilkan toast

```php
// Backend (Controller)
return redirect()->back()->with('alerts', [[
    'type' => 'success',
    'title' => 'Berhasil',
    'message' => 'Kursus berhasil dibuat.',
]]);
```

```jsx
// Frontend (MasterLayout.jsx) — menggunakan sonner
import { toast } from 'sonner';

useEffect(() => {
    flash?.forEach(alert => {
        toast[alert.type](alert.title, { description: alert.message });
    });
}, [flash]);
```

#### Manual Toast

```jsx
import { toast } from 'sonner';

toast.success('Data berhasil disimpan');
toast.error('Terjadi kesalahan');
```

File terkait: `Components/Toasts.jsx`, `Hooks/useToasts.js`, `Layouts/MasterLayout.jsx`.

### 4.5 File Upload Pattern

#### Image Upload (Thumbnail, Avatar)

```jsx
// Instruktur upload thumbnail kursus
router.post(route('instructor.classes.thumbnail.update', courseId), {
    avatar: file,  // File object
}, { forceFormData: true });

// Hapus thumbnail
router.delete(route('instructor.classes.thumbnail.delete', courseId));
```

#### Document Upload (Assignment, Course Material)

Menggunakan `UploadDialog` component dari Core:

```jsx
import UploadDialog from '@/Pages/Core/Components/UploadDialog';

<UploadDialog
    open={showUpload}
    onClose={() => setShowUpload(false)}
    uploadUrl={route('instructor.classes.sections.contents.upload', contentId)}
    accept=".pdf,.doc,.docx,.pptx"
    multiple
/>
```

#### Student Submission Upload

```jsx
router.post(route('student.submissions.store', contentId), {
    files: selectedFiles,
}, { forceFormData: true });

// Hapus file submission
router.delete(route('student.submissions.files.destroy', [contentId, fileId]));
```

File terkait: `Pages/Core/Components/UploadDialog.jsx`, `Pages/Core/Components/UploadDialog2.jsx`, `Pages/Core/Components/Attachments.jsx`.

### 4.6 Layout Assignment Pattern

Setiap halaman harus mengeksport properti `layout` untuk menentukan layout yang dipakai:

```jsx
// Admin / Instructor pages → AppLayout
import AppLayout from '@/Layouts/AppLayout';

export default function Dashboard({ stats }) {
    return <div>...</div>;
}
Dashboard.layout = page => <AppLayout>{page}</AppLayout>;
```

```jsx
// Student pages → StudentLayout
import StudentLayout from '@/Layouts/StudentLayout';

export default function MyCourses({ courses }) {
    return <div>...</div>;
}
MyCourses.layout = page => <StudentLayout>{page}</StudentLayout>;
```

```jsx
// Auth pages → AuthLayout
import AuthLayout from '@/Layouts/AuthLayout';

export default function Login() {
    return <div>...</div>;
}
Login.layout = page => <AuthLayout>{page}</AuthLayout>;
```

```jsx
// Guest pages → GuestLayout
import GuestLayout from '@/Layouts/GuestLayout';

export default function Home() {
    return <div>...</div>;
}
Home.layout = page => <GuestLayout>{page}</GuestLayout>;
```

**Hierarki Layout:**
- `MasterLayout` — Base layer (theme, toast, alert dialogs, error handling)
  - `AppLayout` — Admin & Instructor (sidebar + navbar + command palette)
  - `StudentLayout` — Student (sidebar student + header)
  - `AuthLayout` — Auth pages (centered card)
  - `GuestLayout` — Landing page (guest navbar + footer)
  - `MainLayout` — Halaman umum/generik

### 4.7 Shared Props Usage

#### Mengakses `auth.user` dan `active_role`

```jsx
import { usePage } from '@inertiajs/react';

export default function MyComponent() {
    const { auth } = usePage().props;
    const user = auth.user;           // { id, name, email, roles, ... }
    const activeRole = auth.active_role; // 'student' | 'instructor' | 'admin' | 'organization'

    return <span>Hello, {user.name} ({activeRole})</span>;
}
```

#### Admin Permissions

```jsx
const { admin_permissions } = usePage().props.auth;
// atau gunakan usePermission hook:
const { can, canGlobal } = usePermission('course');
if (can('edit')) { /* tampilkan tombol edit */ }
```

#### Ziggy Route Helper

```jsx
// route() tersedia global via Ziggy
const url = route('student.course.preview', { course: courseId });

// Dalam Inertia router
router.visit(route('instructor.dashboard'));

// Dalam Link component
<Link href={route('admin.finance')}>Keuangan</Link>
```

#### Flash Message

```jsx
const { alerts, flash } = usePage().props;
// alerts: array of { type, title, message, timeout }
// Dikonsumsi otomatis oleh MasterLayout untuk toast
```

#### Props Umum Lainnya

```jsx
const page = usePage();
const {
    auth,           // { user, active_role, admin_permissions }
    lang,           // locale aktif: 'id' | 'en'
    debug,          // boolean: mode debug
    translateKey,   // key translasi untuk halaman aktif
    permissions,    // object permission map untuk usePermission
    ziggy,          // konfigurasi Ziggy routes
} = page.props;
```

---

## 5. Library Utilities

Berlokasi di `resources/js/lib/`:

| File | Fungsi Utama |
|------|--------------|
| `utils.js` | Helper umum: `cn()` (classnames), `formatRp()`, `getLocaleDate()`, `generateRandom()`, `isDeepEmpty()`, `saveToLocalStorage()`, `checkPermission()`, dll |
| `authRoles.jsx` | Konfigurasi role & permission mapping |
| `linkModelUtils.js` | Utilities untuk LinkModel component (template links, conversions) |
| `flattenMediaPlugin.js` | Plugin GrapesJS untuk flatten media |
| `gjsTable.js` | Plugin GrapesJS untuk tabel |
| `gjsDocHeader.js` | Plugin GrapesJS untuk header dokumen |
| `gjsRelationsTable.js` | Plugin GrapesJS untuk tabel relasi |
| `guestContentDraft.js` | Draft management untuk konten guest page |
| `guestLiveEditorConfig.js` | Konfigurasi live editor landing page |
| `guestPageContent.js` | Default content landing page |
| `initHandlebar.js` | Inisialisasi Handlebars template engine |
| `tiptapContent.js` | Konfigurasi & extensions Tiptap editor |
| `google-diff.js` | Library diff text (Google diff-match-patch) |
