# Arsitektur Sistem — Diagram Teknis

Dokumen ini berisi diagram arsitektur teknis ERP Inkindo dalam format Mermaid. Setiap diagram menggambarkan aspek berbeda dari sistem.

---

## 1. C4 Container Diagram

Diagram ini menunjukkan seluruh container (unit deployable) dalam sistem dan interaksi antar-container.

```mermaid
graph LR
    Browser["Browser\n(React 19 + Tailwind CSS 4\nSPA via Inertia.js)"]
    Inertia["Inertia Protocol\n(XHR / HTML Bridge)"]
    Laravel["Laravel Application\n(PHP 8.4, Laravel 12\nControllers, Services, Models)"]
    MySQL["MySQL 8.0\n(ULID PKs, Soft Deletes\n25+ tabel, 58 migrasi)"]
    FileStorage["File Storage\n(Local Disk\nPayment proofs, Course files,\nThumbnails)"]
    MailService["Mail Service\n(SMTP Provider\nAsync via Queue)"]
    QueueWorker["Queue Worker\n(Laravel Queue\nSendEmailNotificationJob,\nRunInstructorPayoutBatchCommand)"]

    Browser -->|"HTTP (Inertia Protocol)"| Inertia
    Inertia -->|"JSON / HTML Response"| Browser
    Inertia -->|"HTTP Request"| Laravel
    Laravel -->|"Inertia::render()"| Inertia
    Laravel -->|"SQL (Eloquent ORM)"| MySQL
    MySQL -->|"Result Set"| Laravel
    Laravel -->|"Filesystem API"| FileStorage
    Laravel -->|"dispatch()"| QueueWorker
    QueueWorker -->|"SMTP"| MailService
    QueueWorker -->|"SQL"| MySQL
```

**Keterangan:**
- **Browser** menjalankan React 19 yang di-render client-side, berkomunikasi dengan server via protokol Inertia.js
- **Inertia Protocol** menjembatani server dan client — request pertama mengembalikan HTML penuh, navigasi berikutnya hanya JSON partial
- **Laravel Application** memproses semua business logic melalui layer Controller → Service → Model
- **MySQL 8.0** menyimpan seluruh data dengan ULID sebagai primary key dan soft deletes untuk data recovery
- **File Storage** menyimpan file upload (bukti pembayaran, file kursus, thumbnail) di local disk
- **Queue Worker** memproses job asinkron seperti pengiriman email dan batch payout instructor

---

## 2. Diagram Komponen Backend

Diagram ini menggambarkan arsitektur layer backend secara detail, dari request masuk hingga database.

```mermaid
graph TD
    Request["HTTP Request"]

    subgraph Middleware["Middleware Layer"]
        MW1["HandleTheme"]
        MW2["HandleInertiaRequests"]
        MW3["AppMiddleware (auth)"]
        MW4["RoleMiddleware"]
        MW5["AdminModulePermissionMiddleware"]
        MW6["EnsureUserIsOnboarded"]
        MW7["LanguageMiddleware"]
    end

    subgraph Controllers["Controller Layer"]
        AdminCtrl["Admin/ (7 controllers)\nDashboard, SystemFinance,\nCourseApproval, UserDirectory,\nCourseCategory, Profile,\nLandingPageSetting"]
        InstructorCtrl["Instructor/ (9 controllers)\nCourse, CourseContent,\nCourseSection, CourseSectionNote,\nDashboard, Financial,\nProfile, StudentManagement,\nSubmission"]
        StudentCtrl["Student/ (9 controllers)\nDashboard, Course, CourseList,\nEnrollment, Cart, Progress,\nProfile, Submission,\nInstructorRoleRequest"]
        AuthCtrl["Auth/ (10 controllers)\nAuthenticatedSession, Register,\nSetupUser, PasswordReset,\nEmailVerification, etc."]
        CoreCtrl["Core/ (15 controllers)\nDashboard, Widget, File,\nBranch, Company, Tag,\nApprovalInstance, ApprovalScheme,\nFormating, PrintTemplate, etc."]
        GuestCtrl["Guest/ (2 controllers)\nGuestPage, Training"]
    end

    subgraph Services["Service Layer"]
        FinanceSvc["Finance/\nInstructorPayoutService"]
        AuthSvc["Auth/\nRoleResolver\nUserRoleManager\nLoginCredentialVerifier"]
        AdminSvc["Admin/\nAdminPermissionService\nUserTransformer"]
        CoreSvc["Core/\nDashboardService\nWidgetService\nApprovalService"]
        InstructorSvc["Instructor/\nStudentProgressBuilder"]
        CourseSvc["CourseProgressService"]
        GuestSvc["Guest/\nLandingPageService"]
    end

    subgraph Models["Model Layer"]
        CoreModels["Core/ (19 models)\nFile, Branch, Preference,\nApprovalScheme, Tag, etc."]
        FinanceModels["Finance/ (3 models)\nInstructorEarning,\nInstructorPayoutRequest,\nPayoutBatch"]
        UserModels["User/ (10 models)\nUser, Role, Permission,\nUserRole, etc."]
        RootModels["Root Models (18)\nCourse, Enrollment, Payment,\nCourseContent, CourseSection,\nSubmission, Cart, etc."]
    end

    DB["MySQL Database\n(58 migrasi, 25+ tabel)"]

    Request --> Middleware
    MW1 --> MW2
    MW2 --> MW3
    MW3 --> MW4
    MW4 --> MW5
    MW5 --> MW6
    MW6 --> MW7
    Middleware --> Controllers
    AdminCtrl --> Services
    InstructorCtrl --> Services
    StudentCtrl --> Services
    AuthCtrl --> Services
    CoreCtrl --> Services
    GuestCtrl --> Services
    Services --> Models
    FinanceSvc --> FinanceModels
    AuthSvc --> UserModels
    AdminSvc --> UserModels
    CoreSvc --> CoreModels
    InstructorSvc --> RootModels
    CourseSvc --> RootModels
    Models --> DB
```

**Keterangan:**
- **Middleware Layer** memproses request secara berurutan: tema → Inertia → auth → role → permission → onboarding → bahasa
- **Controller Layer** diorganisir berdasarkan role pengguna, masing-masing bertanggung jawab atas route endpoint-nya
- **Service Layer** mengenkapsulasi business logic kompleks agar controller tetap ringan
- **Model Layer** merepresentasikan tabel database dengan relasi Eloquent, traits, dan scopes

---

## 3. Diagram Komponen Frontend

Diagram ini menunjukkan arsitektur React frontend termasuk layout, pages, dan shared props.

```mermaid
graph TD
    subgraph Layouts["Layout System"]
        Master["MasterLayout (base)"]
        App["AppLayout\n(Admin + Instructor)\nSidebar + Header + Breadcrumb"]
        Student["StudentLayout\n(Student-specific)\nSidebar + Header"]
        Auth["AuthLayout\nCentered Card"]
        Guest["GuestLayout\nNavbar + Footer"]
    end

    subgraph Pages["Pages (by Role)"]
        AdminPages["Admin/\nDashboard, Users, Finance,\nCourses, Settings"]
        InstructorPages["Instructors/\nDashboard, Courses, Content,\nStudents, Finance"]
        StudentPages["Students/\nDashboard, Courses, Cart,\nProgress, Submissions"]
        AuthPages["Auth/\nLogin, Register, Setup,\nPasswordReset, Verify"]
        GuestPages["Guest/\nLandingPage, Training"]
        OrgPages["Organizations/\nDashboard, Members"]
        CorePages["Core/\nSettings, Widgets, Files"]
    end

    subgraph Components["Komponen UI"]
        ShadcnUI["shadcn/ui\n(Radix UI primitives)\nButton, Dialog, Select,\nDropdown, Tabs, etc."]
        Custom["Custom Components\nDataTable, FormPage,\nFileUpload, RichEditor"]
        Charts["Recharts\nBar, Line, Pie,\nArea Charts"]
    end

    subgraph Hooks["Custom Hooks"]
        UseCart["useCart"]
        UseSession["useSessionStorage"]
        UsePerm["usePermission"]
    end

    subgraph Utils["Utilities"]
        CN["cn() - class merge"]
        FormatRp["formatRp() - currency"]
        Route["route() - Ziggy"]
    end

    subgraph SharedProps["Shared Props\n(HandleInertiaRequests)"]
        AuthProp["auth.user\nauth.active_role\nauth.admin_permissions"]
        LangProp["lang (id/en)"]
        ZiggyProp["ziggy (route definitions)"]
        FlashProp["flash (success/error)"]
    end

    Master --> App
    Master --> Student
    Master --> Auth
    Master --> Guest
    App --> AdminPages
    App --> InstructorPages
    Student --> StudentPages
    Auth --> AuthPages
    Guest --> GuestPages
    App --> OrgPages
    App --> CorePages
    Pages --> Components
    Pages --> Hooks
    Pages --> Utils
    SharedProps -->|"usePage().props"| Pages
```

**Keterangan:**
- **Layout System** menggunakan hierarki layout — MasterLayout sebagai base, kemudian layout spesifik per konteks
- **Pages** diorganisir berdasarkan role, setiap folder berisi halaman-halaman untuk role tersebut
- **Components** menggabungkan shadcn/ui (primitif Radix UI) dengan komponen custom seperti DataTable dan FormPage
- **Shared Props** dikirim dari server ke semua halaman via middleware `HandleInertiaRequests`

---

## 4. Arsitektur Deployment

Diagram ini menunjukkan pipeline CI/CD dari repository hingga server produksi.

```mermaid
flowchart TD
    Dev["Developer\nPush ke branch"]
    PR["Pull Request\nke branch main"]
    GH["GitHub Repository"]

    subgraph CI["GitHub Actions CI/CD"]
        Checkout["Checkout kode"]
        SetupPHP["Setup PHP 8.4 + Composer"]
        SetupNode["Setup Node.js (dari .nvmrc)"]
        ComposerInstall["composer install\n--no-dev --optimize-autoloader"]
        NpmCi["npm ci"]
        NpmBuild["npm run build"]
        Cleanup["Hapus node_modules,\nresources/js, resources/css"]
        Package["Package: tar.gz\nseluruh codebase"]
        Lint["ESLint + Pint\n(auto-format)"]
    end

    subgraph Deploy["Deploy Scripts (.scripts/)"]
        DeployScript["deploy.sh\n(orchestrator)"]
        StagingScript["deploy-staging.sh"]
        ProdScript["deploy-production.sh"]
    end

    subgraph Server["cPanel Hosting"]
        SCP["SCP Upload\nrelease.tar.gz + scripts"]
        SSH["SSH Execute\ndeploy.sh"]
        Extract["Extract ke direktori baru\n(versioned)"]
        Migrate["php artisan migrate --force"]
        Cache["config:cache\nroute:cache\nview:cache"]
        Symlink["Update symlink 'current'\n(zero-downtime)"]
    end

    Live["Aplikasi Live"]
    Rollback["Rollback\n(symlink ke versi lama)"]

    Dev --> GH
    GH --> PR
    PR -->|"Merge"| CI
    Checkout --> SetupPHP
    SetupPHP --> SetupNode
    SetupNode --> ComposerInstall
    ComposerInstall --> NpmCi
    NpmCi --> NpmBuild
    NpmBuild --> Lint
    Lint --> Cleanup
    Cleanup --> Package
    Package --> Deploy
    DeployScript --> StagingScript
    DeployScript --> ProdScript
    Deploy --> SCP
    SCP --> SSH
    SSH --> Extract
    Extract --> Migrate
    Migrate --> Cache
    Cache --> Symlink
    Symlink -->|"Sukses"| Live
    Symlink -->|"Gagal"| Rollback
```

**Keterangan:**
- Pipeline dipicu saat PR di-merge ke branch `main` atau via manual trigger (`workflow_dispatch`)
- Build step menghasilkan static assets — Node.js **tidak** diperlukan di server produksi
- Deployment menggunakan **blue-green style** dengan symlink untuk zero-downtime
- Rollback otomatis jika deploy gagal, cukup mengubah symlink ke versi sebelumnya
- Lint CI (ESLint + Pint) memastikan kode terformat sebelum deploy

---

## 5. Request Lifecycle (Sequence Diagram)

Diagram ini menunjukkan alur lengkap sebuah request Inertia.js dari browser hingga response kembali.

```mermaid
sequenceDiagram
    participant B as Browser (React)
    participant I as Inertia Protocol
    participant M as Middleware Chain
    participant C as Controller
    participant S as Service
    participant E as Model (Eloquent)
    participant DB as MySQL

    Note over B,DB: Request Pertama (Full Page Load)
    B->>I: GET /dashboard (no X-Inertia header)
    I->>M: HTTP Request
    M->>M: HandleTheme
    M->>M: HandleInertiaRequests
    M->>M: AppMiddleware (auth check)
    M->>M: RoleMiddleware (validate role)
    M->>M: AdminModulePermissionMiddleware
    M->>M: EnsureUserIsOnboarded
    M->>C: Route dispatched
    C->>S: Business logic delegation
    S->>E: Query data
    E->>DB: SQL Query
    DB-->>E: Result rows
    E-->>S: Eloquent Collection
    S-->>C: Processed data
    C->>I: Inertia::render('Dashboard', props)
    I-->>B: Full HTML + embedded JSON props
    B->>B: React hydrates component

    Note over B,DB: Navigasi Berikutnya (Partial Update)
    B->>I: GET /courses (X-Inertia: true)
    I->>M: XHR Request
    M->>M: Middleware chain (same)
    M->>C: Route dispatched
    C->>S: Business logic
    S->>E: Query data
    E->>DB: SQL Query
    DB-->>E: Result rows
    E-->>S: Data
    S-->>C: Props
    C->>I: Inertia::render('Courses', props)
    I-->>B: JSON only (page component + props)
    B->>B: React swaps component, preserves state
```

**Keterangan:**
- **Request pertama**: Server mengembalikan HTML lengkap dengan data JSON ter-embed, React melakukan hydration
- **Navigasi berikutnya**: Browser mengirim XHR dengan header `X-Inertia: true`, server hanya mengembalikan JSON (component name + props)
- **Middleware chain** selalu diproses penuh pada setiap request untuk menjamin keamanan
- React hanya mengganti komponen halaman tanpa full-page reload, menjaga state yang sudah ada

---

## 6. Diagram Alur Data

Tiga alur data utama dalam sistem: pembayaran, konten kursus, dan autentikasi.

### 6a. Alur Pembayaran (Payment Flow)

```mermaid
graph LR
    Student["Student"]
    Course["Pilih Course"]
    Cart["Cart"]
    Payment["Payment\n(upload bukti bayar)"]
    AdminVerify["Admin Verifikasi\n(approve/reject)"]
    Earning["InstructorEarning\n(otomatis tercatat)"]
    Payout["PayoutRequest\n(instructor request)"]
    Batch["PayoutBatch\n(admin proses)"]
    Bank["Transfer Bank\n(ke instructor)"]

    Student --> Course
    Course --> Cart
    Cart --> Payment
    Payment --> AdminVerify
    AdminVerify -->|"Approved"| Earning
    Earning --> Payout
    Payout --> Batch
    Batch --> Bank
    AdminVerify -->|"Rejected"| Student
```

### 6b. Alur Konten Kursus (Course Content Flow)

```mermaid
graph LR
    Instructor["Instructor"]
    CreateCourse["Buat Course\n(title, description, price)"]
    Sections["Buat Sections\n(modul/bab)"]
    Contents["Tambah Contents\n(video, text, quiz)"]
    Files["Upload Files\n(via FileController)"]
    Publish["PublishRequest\n(submit ke admin)"]
    AdminReview["Admin Review\n(approve/reject)"]
    Live["Course Live\n(visible ke student)"]
    StudentAccess["Student Enroll\n& akses konten"]
    Progress["UserProgress\n(tracking per content)"]

    Instructor --> CreateCourse
    CreateCourse --> Sections
    Sections --> Contents
    Contents --> Files
    Files --> Publish
    Publish --> AdminReview
    AdminReview -->|"Approved"| Live
    AdminReview -->|"Rejected"| Instructor
    Live --> StudentAccess
    StudentAccess --> Progress
```

### 6c. Alur Autentikasi (Authentication Flow)

```mermaid
graph LR
    User["User"]
    Login["Halaman Login\n(email + password\natau Google OAuth)"]
    Verify["LoginCredentialVerifier\n(validate credentials)"]
    Resolve["RoleResolver\n(cek roles user)"]
    MultiRole{"Multi-role?"}
    SelectRole["Halaman Pilih Role"]
    Cookie["Set Cookie\nlast_active_role"]
    Dashboard["Redirect ke Dashboard\n(sesuai role aktif)"]
    Onboard{"Sudah onboarded?"}
    Setup["Halaman Setup\n(lengkapi profil)"]

    User --> Login
    Login --> Verify
    Verify -->|"Valid"| Resolve
    Verify -->|"Invalid"| Login
    Resolve --> MultiRole
    MultiRole -->|"Ya (2+ roles)"| SelectRole
    MultiRole -->|"Tidak (1 role)"| Cookie
    SelectRole --> Cookie
    Cookie --> Onboard
    Onboard -->|"Belum"| Setup
    Onboard -->|"Sudah"| Dashboard
    Setup --> Dashboard
```

**Keterangan:**
- **Payment Flow**: Mengikuti pola submit → verify → earn → payout. Admin bertindak sebagai verifikator pembayaran.
- **Course Content Flow**: Instructor membuat konten secara bertahap, lalu submit untuk approval sebelum dipublikasi.
- **Authentication Flow**: Mendukung multi-role — user dengan lebih dari satu role akan diminta memilih role aktif saat login. Cookie `last_active_role` menyimpan pilihan terakhir.

---

## Referensi Terkait

- [02 — Arsitektur Sistem](02-architecture.md) — Gambaran besar dan design patterns
- [04 — Roles & Permissions](04-roles-permissions.md) — Sistem multi-role detail
- [07 — Service Layer](07-services.md) — Dokumentasi service classes
- [09 — Deployment](09-deployment.md) — Konfigurasi deploy dan CI/CD
