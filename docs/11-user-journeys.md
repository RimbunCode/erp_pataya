# User Journeys — Peta Perjalanan Pengguna

Dokumen ini menjelaskan alur pengalaman (user journey) untuk setiap role dalam sistem ERP Inkindo, divisualisasikan dengan diagram Mermaid.

---

## 1. Gambaran Umum

Diagram berikut menunjukkan hubungan antar role dan bagaimana seorang pengguna dapat berpindah dari satu role ke role lainnya.

```mermaid
flowchart TB
    Guest[Guest / Pengunjung]
    Student[Student]
    Instructor[Instruktur]
    Organization[Organisasi]
    Admin[Admin]

    Guest -->|Register & Verifikasi Email| Student
    Student -->|Ajukan Role Instruktur| Instructor
    Organization -->|Dikelola terpisah| Organization

    Admin -->|Approve Role Request| Instructor
    Admin -->|Verifikasi Payment| Student
    Admin -->|Approve Publish Kursus| Instructor
    Admin -->|Kelola Semua User| Student
    Admin -->|Kelola Semua User| Instructor
    Admin -->|Kelola Semua User| Organization

    Student -->|Multi-role: bisa juga jadi| Instructor
    Student -->|Browse & Enroll Kursus| Student
    Instructor -->|Buat & Kelola Kursus| Instructor
```

---

## 2. Perjalanan Student (Student Journey)

Student adalah pengguna utama platform yang mendaftar untuk mengikuti kursus/pelatihan. Mereka bisa menelusuri katalog, mendaftar kursus, mengakses materi, mengerjakan tugas, dan pada akhirnya memperoleh sertifikat. Student juga bisa mengajukan diri menjadi Instruktur.

```mermaid
journey
    title Perjalanan Student
    section Registrasi & Setup
        Buka halaman register: 5: Guest
        Isi form registrasi: 4: Guest
        Verifikasi email: 3: Student
        Lengkapi profil (setup): 4: Student
    section Telusuri Katalog
        Buka katalog kursus: 5: Student
        Lihat preview kursus: 4: Student
        Tambah ke keranjang: 4: Student
    section Pendaftaran Kursus
        Checkout dari keranjang: 4: Student
        Upload bukti pembayaran: 3: Student
        Tunggu verifikasi admin: 2: Student
        Pembayaran disetujui: 5: Student
    section Belajar
        Akses konten kursus: 5: Student
        Tonton materi video/file: 5: Student
        Submit tugas: 4: Student
        Terima nilai & feedback: 4: Student
    section Progress & Penyelesaian
        Lihat persentase progress: 4: Student
        Selesaikan semua konten: 5: Student
        Dapatkan sertifikat: 5: Student
    section Opsional - Jadi Instruktur
        Ajukan role instruktur: 3: Student
        Tunggu persetujuan admin: 2: Student
        Disetujui menjadi instruktur: 5: Student
```

---

## 3. Perjalanan Instruktur (Instructor Journey)

Instruktur adalah pembuat dan pengelola kursus. Mereka membangun konten pembelajaran, memantau siswa yang terdaftar, memberikan penilaian, serta menerima pendapatan dari kursus yang mereka buat.

```mermaid
journey
    title Perjalanan Instruktur
    section Dashboard
        Lihat statistik & analytics: 5: Instruktur
        Lihat growth analytics: 4: Instruktur
    section Pembuatan Kursus
        Buat kursus baru: 4: Instruktur
        Upload thumbnail kursus: 4: Instruktur
        Tambah section ke kursus: 4: Instruktur
        Tambah catatan di section: 4: Instruktur
        Tambah konten ke section: 4: Instruktur
        Upload file materi: 3: Instruktur
    section Penerbitan Kursus
        Submit publish request: 4: Instruktur
        Tunggu approval admin: 2: Instruktur
        Kursus dipublikasikan: 5: Instruktur
    section Pengajaran
        Lihat daftar siswa enrolled: 5: Instruktur
        Review submission tugas: 4: Instruktur
        Berikan nilai & feedback: 4: Instruktur
    section Keuangan
        Lihat total earning: 5: Instruktur
        Ajukan payout request: 4: Instruktur
        Tunggu approval admin: 2: Instruktur
        Terima pembayaran: 5: Instruktur
    section Profil
        Edit profil instruktur: 4: Instruktur
        Update avatar: 4: Instruktur
```

---

## 4. Perjalanan Admin

Admin memiliki akses ke seluruh sistem dengan permission granular. Setiap sub-permission memiliki tanggung jawab spesifik. Berikut diagram alur kerja setiap modul admin:

```mermaid
flowchart TB
    AdminLogin[Admin Login & Dashboard]

    subgraph finance_admin[Finance Admin]
        FA1[Lihat daftar pembayaran]
        FA2[Verifikasi bukti bayar]
        FA3[Approve / Reject pembayaran]
        FA4[Lihat payout requests]
        FA5[Approve / Reject / Tandai paid]
        FA6[Run payout batch]
        FA7[Konfigurasi company fee]
        FA8[Konfigurasi payout delay]
        FA1 --> FA2 --> FA3
        FA4 --> FA5
        FA4 --> FA6
        FA7
        FA8
    end

    subgraph course_admin[Course Admin]
        CA1[Lihat publish requests]
        CA2[Review kursus]
        CA3[Approve / Reject kursus]
        CA4[Kelola kategori kursus]
        CA5[Tambah kategori baru]
        CA1 --> CA2 --> CA3
        CA4 --> CA5
    end

    subgraph user_admin[User Admin]
        UA1[Lihat direktori user]
        UA2[Lihat role requests]
        UA3[Approve / Reject role request]
        UA4[Ubah status user aktif/nonaktif]
        UA1 --> UA4
        UA2 --> UA3
    end

    subgraph content_admin[Content Admin]
        CT1[Buka pengaturan landing page]
        CT2[Edit konten halaman]
        CT3[Upload media]
        CT1 --> CT2
        CT1 --> CT3
    end

    subgraph super_admin[Super Admin]
        SA1[Semua akses modul di atas]
        SA2[Assign admin permissions ke user lain]
        SA1 --> SA2
    end

    AdminLogin --> finance_admin
    AdminLogin --> course_admin
    AdminLogin --> user_admin
    AdminLogin --> content_admin
    AdminLogin --> super_admin
```

---

## 5. Perjalanan Organisasi (Organization Journey)

Role organisasi ditujukan untuk entitas korporat yang mengelola partner trainer dan keuangan pelatihan secara terpusat.

```mermaid
flowchart LR
    Login[Login sebagai Organisasi]
    Dashboard[Dashboard Organisasi]
    Partner[Partner Trainers]
    Financial[Keuangan]
    Profile[Pengaturan Profil]

    Login --> Dashboard
    Dashboard --> Partner
    Dashboard --> Financial
    Dashboard --> Profile
    Partner -->|Kelola trainer mitra| Partner
    Financial -->|Lihat transaksi| Financial
    Profile -->|Edit info organisasi| Profile
```

---

## 6. Perjalanan Guest (Public Visitor)

Guest adalah pengunjung yang belum terdaftar. Mereka bisa melihat informasi publik dan katalog pelatihan sebelum memutuskan untuk mendaftar.

```mermaid
flowchart LR
    Home[Halaman Utama]
    Training[Katalog Pelatihan]
    Preview[Preview Kursus]
    About[Tentang Kami]
    Contact[Kontak]
    Verify[Verifikasi Sertifikat]
    Register[Register / Daftar]

    Home --> Training
    Training --> Preview
    Home --> About
    Home --> Contact
    Home --> Verify
    Preview --> Register
    Home --> Register
    About --> Register
    Contact --> Register
```

---

## Catatan

- Semua diagram di atas berdasarkan route dan permission yang terdaftar di `routes/web.php`, `routes/auth.php`, `routes/guest.php`, dan konfigurasi middleware.
- Untuk detail permission admin, lihat [Roles & Permissions](04-roles-permissions.md).
- User bisa memiliki multi-role (contoh: Student + Instructor sekaligus) dan berpindah antar role tanpa logout.
