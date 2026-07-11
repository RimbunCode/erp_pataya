# Requirements Document

## Introduction

Tim sales/admin saat ini tidak punya cara terstruktur untuk mencatat calon customer (lead) di dalam aplikasi ERP Laravel ini sebelum mereka menjadi `Sales\Customer` resmi. Akibatnya, data prospek tersebar di luar sistem (spreadsheet, chat, catatan pribadi) dan tidak bisa dilacak sumbernya maupun status follow-up-nya.

Modul ini menambahkan kemampuan **input dan pengelolaan lead** secara native di dalam aplikasi, mengikuti pola arsitektur domain yang sudah mapan di codebase (dicontohkan oleh modul `Sales\Customer`): model dengan trait `DataTable`, controller dengan RBAC otomatis, request validasi, service untuk logika multi-step, halaman React/Inertia standar, dan permission yang ter-generate otomatis lewat `PermissionSeeder`.

Konsep data (Lead, Lead Source, konversi ke Customer) terinspirasi dari model Frappe CRM, namun ini **bukan** integrasi dengan produk Frappe CRM/ERPNext eksternal — seluruh implementasi native di dalam repo Laravel ini.

Cakupan v1 dibatasi pada kemampuan inti: mencatat lead, mengategorikan sumbernya, mengubah statusnya, dan mengonversinya menjadi `Customer` ketika qualified. Kanal input otomatis (web form publik, email-to-lead) dan entity pipeline (`Deal`/Opportunity) sengaja ditunda ke iterasi berikutnya agar v1 tetap kecil dan bisa langsung dipakai.

## Glossary

- **Lead**: catatan calon customer yang belum resmi menjadi `Customer` — berisi data kontak, sumber, dan status kualifikasi.
- **Lead Source**: kategori asal-usul lead (mis. Website, Referral, Cold Call) — data lookup yang bisa ditambah tanpa deploy kode.
- **Convert to Customer**: aksi yang mengubah sebuah `Lead` qualified menjadi record `Sales\Customer` baru, sambil menandai lead tersebut sebagai `converted`.
- **DataTable trait**: trait internal (`App\Traits\DataTable`) yang memberi model kemampuan listing, kolom konfigurasi, audit log, dan registrasi permission otomatis.
- **LinkModel**: komponen frontend generik untuk memilih record terkait (foreign key) lewat pencarian autocomplete, dengan opsi buat-baru inline.
- **RBAC (Role-Based Access Control)**: sistem otorisasi berbasis Role → Permission yang sudah ada di aplikasi ini, diterapkan otomatis di constructor setiap Controller.

## Requirements

### Requirement 1: Mencatat lead baru

**User Story:** As a sales/admin user, I want mencatat calon customer baru sebagai Lead, so that informasi prospek tersimpan terpusat dan tidak hilang.

#### Acceptance Criteria

1. THE sistem SHALL menyediakan form input Lead dengan field: nama perusahaan (`company_name`, wajib), nama kontak, email, telepon, sumber lead, status, catatan, dan alamat (jalan, kota, provinsi, kode pos, negara).
2. WHEN user menyimpan form Lead tanpa mengisi `company_name`, THE sistem SHALL menolak penyimpanan dan menampilkan pesan validasi.
3. WHEN user menyimpan Lead baru tanpa memilih status, THE sistem SHALL menetapkan status default `new`.
4. WHEN Lead baru berhasil disimpan, THE sistem SHALL mencatatnya ke audit log (`logForCreated`).
5. THE sistem SHALL menampilkan daftar Lead dalam tabel dengan kolom nama perusahaan, kontak, email, telepon, status, sumber, dan penanggung jawab (assigned to).
6. IF user tidak memiliki permission `create` pada Lead, THEN sistem SHALL menolak akses ke aksi tambah Lead.

### Requirement 2: Mengelola sumber lead (Lead Source)

**User Story:** As a admin, I want mengategorikan setiap lead berdasarkan sumbernya, so that tim bisa menganalisis kanal mana yang paling produktif.

#### Acceptance Criteria

1. THE sistem SHALL menyediakan data lookup Lead Source yang bisa dipilih saat mengisi form Lead, dicari via autocomplete.
2. THE sistem SHALL menyediakan set awal Lead Source (`web_form`, `email`, `manual`, `api`, `referral`, `call`) melalui seeder.
3. Lead Source SHALL memiliki `code` sebagai primary key dan `name` sebagai label tampilan.
4. THE Lead Source SHALL tidak memerlukan halaman CRUD atau permission tersendiri — konsisten dengan pola lookup `Country` yang sudah ada di aplikasi.
5. WHEN field `lead_source` pada Lead dikosongkan, THE sistem SHALL tetap mengizinkan penyimpanan Lead (field ini opsional).

### Requirement 3: Mengubah status dan menugaskan Lead

**User Story:** As a sales user, I want mengubah status Lead dan menugaskannya ke anggota tim, so that proses follow-up bisa dilacak dan dibagi tanggung jawabnya.

#### Acceptance Criteria

1. THE sistem SHALL menyediakan field `status` dengan opsi tetap: `new`, `contacted`, `qualified`, `unqualified`, `converted`.
2. WHEN user mengubah status Lead, THE sistem SHALL menyimpan perubahan dan mencatatnya ke audit log (`logForUpdated`).
3. THE sistem SHALL menyediakan field `assigned_to` yang merujuk ke user aplikasi (penanggung jawab lead), bersifat opsional.
4. IF user tidak memiliki permission `write` pada Lead, THEN sistem SHALL menolak perubahan status atau penugasan.

### Requirement 4: Mengonversi Lead menjadi Customer

**User Story:** As a sales user, I want mengonversi Lead yang sudah qualified menjadi Customer, so that data tidak perlu diinput ulang dan proses penjualan bisa dilanjutkan di modul Sales.

#### Acceptance Criteria

1. THE sistem SHALL menyediakan aksi "Convert to Customer" pada Lead yang belum berstatus `converted`.
2. WHEN aksi "Convert to Customer" dijalankan, THE sistem SHALL membuat record `Sales\Customer` baru dengan data nama, email, telepon, dan alamat disalin dari Lead.
3. WHEN konversi berhasil, THE sistem SHALL membuat branch utama (main branch) untuk Customer baru tersebut, mengikuti pola pembuatan Customer manual.
4. WHEN konversi berhasil, THE sistem SHALL mengubah status Lead menjadi `converted`, mengisi `converted_customer_id`, dan mencatat `converted_at`.
5. IF Lead sudah pernah dikonversi sebelumnya (`converted_customer_id` terisi), THEN sistem SHALL mengembalikan Customer yang sama tanpa membuat duplikat (idempotent) ketika aksi convert dijalankan ulang.
6. WHEN Lead berstatus `converted`, THE sistem SHALL menyembunyikan tombol "Convert to Customer" dan menampilkan tautan ke Customer hasil konversi.
7. IF user tidak memiliki permission `write` pada Lead, THEN sistem SHALL menolak aksi konversi.
8. WHEN Customer baru berhasil dibuat dari konversi, THE sistem SHALL mencatatnya ke audit log (`logForCreated`) pada Customer.

### Requirement 5: Kontrol akses berbasis peran (RBAC)

**User Story:** As a administrator sistem, I want modul Lead mengikuti sistem RBAC yang sudah ada, so that akses ke data lead bisa diatur per-role tanpa membangun mekanisme otorisasi baru.

#### Acceptance Criteria

1. WHEN model `Lead` didaftarkan (menggunakan trait `DataTable`), THE sistem SHALL secara otomatis membuat record Permission untuk `Lead` saat `PermissionSeeder` dijalankan, tanpa perlu entri seeder manual.
2. THE sistem SHALL menerapkan permission standar (`select`, `read`, `write`, `create`, `delete`) pada aksi CRUD Lead, konsisten dengan modul lain.
3. THE aksi custom `convert` SHALL dipetakan ke permission `write` sehingga tidak diblokir RBAC secara tidak sengaja maupun bisa diakses tanpa otorisasi.
4. THE Lead Source SHALL tidak mendapatkan record Permission tersendiri (konsisten dengan `Country`, yang diakses tanpa CRUD screen).

### Requirement 6: Konsistensi dengan pola arsitektur aplikasi

**User Story:** As a developer yang memelihara aplikasi ini, I want modul Lead mengikuti struktur domain yang sama dengan modul lain, so that kode mudah dipahami dan dirawat oleh siapa pun di tim.

#### Acceptance Criteria

1. THE modul Lead SHALL ditempatkan mengikuti struktur domain: `app/Models/CRM/`, `app/Http/Controllers/CRM/`, `app/Http/Requests/CRM/`, `app/Services/CRM/`, `resources/js/Pages/CRM/`.
2. THE route Lead SHALL didaftarkan melalui macro `Route::resourceDetail()` yang sudah dipakai seluruh modul lain di `routes/web.php`.
3. THE halaman Index Lead SHALL menggunakan komponen generik `DataTable2`, sama seperti modul Customer/Supplier.
4. THE Lead SHALL tidak memiliki halaman `Show.jsx` maupun alur submit/cancel/amend, karena bukan dokumen berbasis approval (non-submitable), konsisten dengan Customer.
5. WHEN domain lain di masa depan perlu mereferensikan Lead sebagai foreign key, THE sistem SHALL menyediakan `LeadLinkModel.jsx` yang mengikuti pola `CustomerLinkModel.jsx`.

## Out of Scope (v1)

Requirement berikut secara eksplisit **tidak** termasuk dalam v1 dan didokumentasikan sebagai follow-up di `design.md`:
- Endpoint intake lead publik dari web form (tanpa autentikasi).
- Pipeline otomatis email masuk → Lead (email-to-lead).
- Entity `Deal`/Opportunity dengan pipeline stage terpisah.
- Layar konfigurasi terpusat ala "CRM Settings" (default lead source, aturan round-robin assignee, dsb).
