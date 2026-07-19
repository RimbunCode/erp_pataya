# Requirements Document

## Introduction

Sistem ERP ini belum punya cara generik untuk menugaskan (assign) seseorang menindaklanjuti dokumen apapun — Ticket, PurchaseOrder, Branch, User, atau model lainnya. ERPNext menyelesaikan ini lewat fitur ToDo: record assignment polymorphic yang bisa menempel ke dokumen manapun, ditampilkan sebagai widget "Assigned To" di sidebar setiap halaman dokumen, plus halaman list terpusat untuk melihat semua tugas milik/dari user.

Fitur ini dibangun di atas infrastruktur notifikasi (in-app bell, broadcast real-time, email) yang sudah ada di codebase, dan mengikuti pola polymorphic (`morphTo` tak terbatas) serta wiring generik lintas-modul (`addTag`/`addFile`/`addComment` di base `Controller.php` + macro `Route::resourceDetail`) yang sudah terbukti di fitur Tag dan File.

## Glossary

- **ToDo**: record assignment — satu **User atau Role** (`allocated_to`, lihat Assignee) ditugaskan menindaklanjuti satu dokumen (`reference`), dibuat oleh user lain atau diri sendiri (`assigned_by`).
- **Reference**: dokumen/model target sebuah ToDo, direlasikan secara polymorphic (`reference_type`/`reference_id`) — bisa model apapun di sistem, atau kosong (ToDo standalone tanpa dokumen).
- **Assignable**: entitas gabungan User+Role yang bisa jadi assignee sebuah ToDo, direpresentasikan sebagai SATU database VIEW read-only (`assignables`, hasil `UNION` tabel `users` dan `roles`) — bukan tabel fisik yang di-duplikasi/di-sync manual, selalu konsisten dengan `users`/`roles` secara otomatis. Diakses lewat satu `LinkModel` (`AssignableLinkModel`) untuk pencarian/pemilihan di UI, dengan label tampilan `":type : :name"` (mis. "user : John Doe", "role : Warehouse Staff").
- **Assignee**: pihak yang ditugaskan pada sebuah ToDo — satu baris `Assignable` (bisa berasal dari User ATAU Role; jika Role, semua user pemegang role tersebut dianggap ikut memiliki ToDo itu). Disimpan di `todos.allocated_to_id` (FK ke `assignables.id`) + `todos.allocated_to_type` (`user`/`role`, cache dari `Assignable.type`).
- **Assigner**: user yang membuat assignment (`assigned_by_id` pada ToDo).
- **Sidebar "Assigned To"**: widget di sidebar kanan `FormPage` yang menampilkan daftar assignee aktif (User maupun Role) untuk dokumen yang sedang dibuka, dengan aksi tambah/hapus.
- **Modul ToDo standalone**: halaman CRUD (`/todos`) untuk melihat, membuat, dan mengelola ToDo yang terlihat oleh user yang login (lihat Requirement 8 untuk aturan visibility).
- **resourceDetail**: macro routing (`Route::resourceDetail`) yang otomatis mendaftarkan CRUD + sub-aksi generik (comment, tag, file, kini assignee) untuk sebuah modul.
- **Visibility scoping**: pembatasan baris ToDo yang tampil di halaman list, berdasarkan apakah pengguna punya permission penuh terhadap modul ToDo atau tidak (lihat Requirement 8).

## Requirements

### Requirement 1: Assign user atau role ke dokumen apapun lewat sidebar

**User Story:** As a pengguna yang sedang membuka halaman detail dokumen apapun (Ticket, PurchaseOrder, Branch, dst), I want menugaskan user lain ATAU sekelompok user lewat role tertentu untuk menindaklanjuti dokumen tersebut langsung dari sidebar, so that saya tidak perlu keluar dari halaman dokumen, menggunakan modul terpisah, atau menugaskan satu-satu orang secara manual saat yang saya maksud adalah "siapapun yang punya role ini".

#### Acceptance Criteria

1. THE sistem SHALL menampilkan widget "Assigned To" di sidebar kanan setiap halaman `FormPage` yang modelnya terdaftar via `Route::resourceDetail`.
2. THE widget "Assigned To" SHALL menyediakan pilihan untuk menugaskan ke satu User tertentu ATAU ke satu Role tertentu.
3. THE widget "Assigned To" SHALL memakai SATU picker pencarian (`AssignableLinkModel`) yang bisa menemukan User maupun Role sekaligus — bukan dua picker/toggle terpisah — karena keduanya sudah tergabung dalam satu sumber data (`Assignable`).
4. WHEN pengguna memilih seorang User lewat widget "Assigned To" dan mengonfirmasi, THE sistem SHALL membuat satu record ToDo baru dengan `reference_type`/`reference_id` mengarah ke dokumen yang sedang dibuka, `allocated_to_id` mengarah ke baris `Assignable` bertipe user tersebut, dan `allocated_to_type` = `user`.
5. WHEN pengguna memilih sebuah Role lewat widget "Assigned To" dan mengonfirmasi, THE sistem SHALL membuat satu record ToDo baru dengan `allocated_to_id` mengarah ke baris `Assignable` bertipe role tersebut dan `allocated_to_type` = `role` — SATU record ToDo mewakili seluruh role, TIDAK ada penggandaan record per-anggota role.
6. IF pengguna mencoba menugaskan User atau Role yang sama untuk dokumen yang sama dan ToDo aktifnya sudah ada, THEN THE sistem SHALL tidak membuat record duplikat, cukup mengembalikan record yang sudah ada (idempoten).
7. WHEN pengguna menghapus assignee dari widget "Assigned To", THE sistem SHALL menghapus (soft-delete) record ToDo yang bersangkutan.
8. THE widget "Assigned To" SHALL hanya menampilkan ToDo berstatus aktif (open) milik dokumen tersebut; ToDo yang sudah closed/canceled tidak ditampilkan di sidebar. Setiap item SHALL menampilkan label `":type : :name"` (dari `Assignable::templateLink()`) sehingga tipe assignee (user/role) selalu jelas tanpa perlu styling kondisional tambahan.
9. THE aksi assign/unassign SHALL tersedia secara otomatis di SEMUA modul yang sudah terdaftar `Route::resourceDetail`, tanpa memerlukan kode backend tambahan per modul.
10. THE aksi assign/unassign SHALL mensyaratkan pengguna memiliki permission `read` terhadap dokumen target.

### Requirement 2: Multi-assignee per dokumen

**User Story:** As a pengguna, I want menugaskan lebih dari satu orang atau role untuk dokumen yang sama, so that pekerjaan bisa didelegasikan ke beberapa pihak sekaligus seperti pola assignment ERPNext.

#### Acceptance Criteria

1. THE sistem SHALL mengizinkan lebih dari satu ToDo aktif untuk dokumen (`reference`) yang sama, selama kombinasi assignee-nya berbeda (baik antar-User, antar-Role, maupun campuran User dan Role).
2. THE widget "Assigned To" SHALL menampilkan seluruh assignee aktif (User maupun Role) untuk dokumen tersebut sebagai daftar, bukan satu nilai tunggal.
3. THE constraint basis data SHALL mencegah kombinasi (dokumen, assignee) aktif yang sama tercatat lebih dari satu kali — berlaku sama baik assignee-nya User maupun Role, karena keduanya diwakili satu ID `Assignable` yang unik lintas tabel asal.

### Requirement 3: Assign saat dokumen baru dibuat (create-mode)

**User Story:** As a pengguna yang sedang membuat dokumen baru, I want langsung menugaskan orang lain sebelum dokumen tersimpan, so that saya tidak perlu membuka dokumen lagi hanya untuk menambahkan assignee.

#### Acceptance Criteria

1. WHEN pengguna menambahkan assignee di widget "Assigned To" pada form yang belum tersimpan (create mode), THE sistem SHALL menyimpan pilihan tersebut sebagai buffer sisi klien, bukan langsung memanggil server.
2. WHEN dokumen baru berhasil disimpan, THE sistem SHALL otomatis membuat record ToDo untuk setiap assignee yang ada di buffer, mengarah ke dokumen yang baru dibuat.
3. THE proses attach buffer ini SHALL tidak berlaku untuk pembuatan record ToDo itu sendiri (mencegah rekursi).

### Requirement 4: Modul ToDo standalone

**User Story:** As a pengguna, I want melihat semua ToDo yang ditugaskan kepada saya atau yang saya buat untuk orang lain dalam satu halaman terpusat, so that saya bisa memantau dan mengelola seluruh tugas saya tanpa harus membuka setiap dokumen satu per satu.

#### Acceptance Criteria

1. THE sistem SHALL menyediakan halaman list ToDo (`/todos`) yang menampilkan seluruh record ToDo dengan paginasi, filter, dan sorting standar seperti modul lain.
2. THE halaman list SHALL menyediakan filter untuk menampilkan ToDo yang di-assign ke pengguna yang sedang login ("assigned to me") maupun yang dibuat oleh pengguna yang sedang login untuk orang lain ("assigned by me").
3. THE halaman list SHALL menyediakan filter berdasarkan status (open/closed/canceled) dan priority (low/medium/high).
4. THE sistem SHALL menyediakan form untuk membuat ToDo standalone (tanpa dokumen reference) berisi assignee, deskripsi, priority, status, tanggal, dan due date. Kolom `reference_type`/`reference_id` pada basis data SHALL bersifat nullable untuk mendukung ini.
5. THE sistem SHALL menyediakan halaman detail/edit ToDo yang menampilkan link ke dokumen reference-nya (jika ada).
6. THE sistem SHALL mengizinkan pengguna menghapus record ToDo (soft-delete).

### Requirement 5: Notifikasi assignment

**User Story:** As a user yang baru saja ditugaskan sebuah ToDo, I want menerima notifikasi (in-app dan email), so that saya langsung tahu ada tugas baru tanpa harus mengecek manual satu per satu dokumen.

#### Acceptance Criteria

1. WHEN sebuah record ToDo baru berhasil dibuat dengan assignee berupa User tertentu, THE sistem SHALL mengirim notifikasi ke user tersebut melalui channel database (bell in-app), broadcast real-time, dan email.
2. WHEN sebuah record ToDo baru berhasil dibuat dengan assignee berupa Role tertentu, THE sistem SHALL mengirim notifikasi individual ke SETIAP user yang memegang role tersebut (fan-out), masing-masing lewat channel per-user yang sudah ada — bukan satu notifikasi broadcast ke channel role baru.
3. IF assignee dari sebuah ToDo adalah user yang sama dengan pembuatnya (assign ke diri sendiri), THEN THE sistem SHALL tidak mengirim notifikasi untuk user itu. Jika assignee adalah Role dan pembuat ToDo termasuk anggota role tersebut, user lain dalam role yang sama TETAP menerima notifikasi seperti biasa (hanya pembuat yang di-skip).
4. WHEN pengguna mengklik notifikasi ToDo di bell navbar, THE sistem SHALL mengarahkan pengguna ke halaman detail ToDo yang bersangkutan.
5. THE halaman detail ToDo SHALL menampilkan kode/label dokumen reference (mis. nomor Ticket, nomor PurchaseOrder) beserta link menuju dokumen tersebut, jika ToDo memiliki reference.
6. IF ToDo memiliki `reference_type`/`reference_id` namun record dokumennya sudah tidak ada (terhapus), THEN THE halaman detail ToDo SHALL menampilkan indikator bahwa referensi tersebut sudah tidak tersedia, bukan link yang rusak.
7. IF ToDo memiliki `allocated_to_type` = `role` namun record role-nya sudah dihapus, THEN THE sistem SHALL tidak mengirim notifikasi ke siapapun untuk ToDo tersebut dan tidak boleh menyebabkan error (fan-out ke koleksi kosong, bukan exception).

### Requirement 6: Akses terbuka untuk semua pengguna

**User Story:** As a pengguna sistem manapun, I want bisa membuat, melihat, memperbarui, dan menghapus ToDo tanpa terhalang izin role tertentu, so that fitur delegasi tugas ini bisa dipakai siapa saja tanpa perlu setup permission khusus di awal.

#### Acceptance Criteria

1. THE modul ToDo standalone SHALL dapat diakses (create, read, update, delete) oleh semua pengguna yang sudah login, terlepas dari role/permission yang di-assign kepadanya — TIDAK ada aksi yang mengembalikan 403 karena kurang permission pada model ToDo.
2. THE aksi assign/unassign via sidebar SHALL tetap mensyaratkan permission `read` terhadap dokumen target (bukan terhadap ToDo itu sendiri) — permission dokumen yang di-assign tetap dihormati.
3. Keterbukaan akses pada Requirement ini SHALL berlaku untuk aksi CRUD (403 gate), TERPISAH dari pembatasan baris data yang ditampilkan di halaman list — lihat Requirement 8 untuk visibility scoping baris data.

### Requirement 7: Konsistensi tampilan status dan prioritas

**User Story:** As a pengguna, I want status dan priority ToDo ditampilkan dengan label dan warna yang konsisten dengan modul lain di sistem, so that saya tidak bingung dengan variasi istilah atau warna yang berbeda-beda antar modul.

#### Acceptance Criteria

1. THE status ToDo (open/closed/canceled) SHALL menggunakan namespace terjemahan dan skema warna badge yang sama dengan modul lain yang berbagi vocabulary status yang sama (bukan terjemahan/warna khusus modul ToDo).
2. THE ejaan nilai status "canceled" SHALL konsisten dengan ejaan yang sudah dipakai di seluruh sistem (satu huruf L), untuk mencegah kegagalan menampilkan warna badge yang benar.
3. THE priority ToDo (low/medium/high) SHALL menggunakan terjemahan khusus modul ToDo karena tidak ada namespace priority yang dipakai bersama modul lain.

### Requirement 8: Visibility scoping berdasarkan permission modul ToDo

**User Story:** As a pengguna yang tidak diberi permission penuh terhadap modul ToDo (mis. staf biasa, bukan admin/manager), I want halaman list ToDo hanya menampilkan tugas yang relevan untuk saya — yang di-assign langsung ke saya, atau ke role yang saya miliki — so that saya tidak melihat tugas milik orang/tim lain yang tidak berkaitan dengan saya, sekaligus tetap bisa melihat tugas yang di-assign ke role saya meski bukan ke saya secara personal.

#### Acceptance Criteria

1. WHEN pengguna TIDAK memiliki permission `select` (atau setara "lihat semua") pada model ToDo, THE halaman list ToDo (`/todos`) SHALL hanya menampilkan record yang `allocated_to_type` = `user` dengan `allocated_to_id` = ID pengguna tersebut, ATAU `allocated_to_type` = `role` dengan `allocated_to_id` termasuk salah satu role yang dimiliki pengguna tersebut.
2. WHEN pengguna MEMILIKI permission `select` pada model ToDo, THE halaman list ToDo SHALL menampilkan seluruh record ToDo tanpa pembatasan tambahan berdasarkan assignee.
3. Pembatasan pada AC 1 SHALL diterapkan sebagai scoping query di backend (bukan filter yang bisa di-toggle dari UI oleh pengguna) — pengguna tanpa permission tidak diberi opsi "lihat semua" di antarmuka.
4. Pembatasan visibility ini SHALL TIDAK menyebabkan halaman `/todos` mengembalikan 403 — pengguna tanpa permission tetap bisa mengakses halaman, hanya datanya yang dibatasi (lihat Requirement 6 AC 3 untuk pemisahan konsep ini dari gate akses/403).
5. Widget "Assigned To" di sidebar (Requirement 1) SHALL TIDAK terpengaruh oleh Requirement ini — widget tersebut selalu menampilkan seluruh assignee aktif dari dokumen yang sedang dibuka, terlepas dari permission pengguna terhadap modul ToDo (gate-nya tetap permission `read` ke dokumen target, sesuai Requirement 1 AC 10).
