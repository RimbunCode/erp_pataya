# Requirements Document

## Introduction

Widget "Assigned To" di sidebar `FormPage` (`resources/js/Pages/Core/Components/AssignedTo.jsx`) saat ini memakai alur inline-picker: begitu user memilih assignee dari `AssignableLinkModel`, request `addAssignee` langsung dikirim ke server tanpa langkah konfirmasi, dan tanpa kesempatan mengisi field lain (priority, description, date, due_date) — field-field itu selalu jatuh ke default (`priority=medium`, `description=null`) baik lewat `Controller::addAssignee` maupun `BufferedAttachmentService::attachAssignees`.

Fitur ini mengganti alur tersebut dengan dialog modal berisi form ToDo (assignee, priority, date, due_date, description — TANPA field status, lihat Requirement 3) yang harus dikonfirmasi eksplisit sebelum submit. Dialog yang sama dipakai untuk menambah assignee baru maupun mengedit item assignee yang masih berupa buffer lokal (create-mode dokumen induk, sebelum dokumen tersimpan). Untuk assignee yang sudah tersimpan sebagai row `Todo` nyata (edit-mode dokumen induk), klik row mengarahkan navigasi ke halaman `/todos/{id}` (Show) alih-alih membuka dialog.

Sidebar juga diperluas menampilkan SEMUA status ToDo terkait dokumen (bukan cuma `open` seperti sekarang) lengkap dengan indikator visual status per-row, supaya user bisa memantau progres tanpa membuka satu per satu.

## Glossary

- **Dialog Assign**: modal baru berisi field assignee (`AssignableLinkModel`), priority, date, due_date, description — TANPA field status. Dipakai untuk menambah assignee baru (create maupun edit-mode dokumen induk) dan mengedit item buffer (create-mode saja).
- **Buffer item**: entri sementara di `data.buffered_assignees` (create-mode dokumen induk, sebelum dokumen tersimpan) — belum punya `Todo.id` nyata karena belum di-submit ke server.
- **Assignee row**: satu baris di daftar sidebar "Assigned To", merepresentasikan satu `Todo` (edit-mode) atau satu buffer item (create-mode).
- **Indikator status**: elemen visual (badge/dot warna, mengikuti tema `BadgeStatus.jsx` yang sudah ada) pada assignee row yang menunjukkan status ToDo terkait (`open`/`closed`/`canceled`) tanpa perlu membuka halaman Show.

## Requirements

### Requirement 1: Dialog konfirmasi saat menambah assignee baru

**User Story:** As a pengguna yang membuka widget "Assigned To" di sidebar, I want mengisi detail ToDo (priority, tanggal, deskripsi) dan mengonfirmasi secara eksplisit sebelum assignment dibuat, so that saya tidak assign secara tidak sengaja dan bisa langsung melengkapi detail tugas tanpa harus membuka halaman `/todos` terpisah.

#### Acceptance Criteria

1. WHEN pengguna mengklik tombol tambah (`+`) pada widget "Assigned To" THEN sistem SHALL menampilkan Dialog Assign berisi field: assignee (wajib), priority, date, due_date, description.
2. THE Dialog Assign SHALL TIDAK menampilkan field status.
3. WHEN Dialog Assign pertama kali dibuka untuk menambah assignee baru THEN field priority SHALL berisi default `medium`, dan field lain (date, due_date, description) SHALL kosong.
4. WHEN pengguna memilih assignee namun belum mengklik tombol konfirmasi THEN sistem SHALL TIDAK mengirim request maupun mengubah buffer apapun.
5. WHEN pengguna mengklik tombol konfirmasi pada Dialog Assign dengan assignee terisi THEN sistem SHALL menutup dialog dan memproses assignment sesuai Requirement 2.
6. IF pengguna mengklik tombol konfirmasi tanpa memilih assignee THEN sistem SHALL menampilkan validasi dan TIDAK menutup dialog.
7. WHEN pengguna membatalkan Dialog Assign (tombol batal, klik di luar dialog, atau tombol close) THEN sistem SHALL menutup dialog tanpa efek samping apapun.

### Requirement 2: Perilaku submit berbeda antara create-mode dan edit-mode dokumen induk

**User Story:** As a pengguna yang sedang membuat dokumen baru (belum tersimpan) maupun mengedit dokumen yang sudah ada, I want assignment ToDo yang saya buat dari sidebar diperlakukan konsisten dengan cara dokumen induk itu sendiri disimpan, so that tidak ada assignment "yatim" yang tersimpan sebelum dokumen induknya benar-benar ada.

#### Acceptance Criteria

1. IF dokumen induk berada dalam create-mode (belum tersimpan) WHEN Dialog Assign dikonfirmasi THEN sistem SHALL menyimpan hasil form (assignee, priority, date, due_date, description) sebagai satu Buffer item baru di `data.buffered_assignees`, TANPA mengirim request ke server.
2. IF dokumen induk berada dalam edit-mode (sudah tersimpan) WHEN Dialog Assign dikonfirmasi THEN sistem SHALL mengirim seluruh field form (allocated_to, priority, date, due_date, description) ke endpoint `addAssignee` milik dokumen tersebut.
3. WHEN dokumen induk (create-mode) akhirnya disimpan THEN setiap Buffer item SHALL diproses menjadi satu row `Todo` dengan field priority/date/due_date/description sesuai isian Dialog Assign, dan `status` SHALL selalu `open`.
4. WHEN request `addAssignee` (edit-mode) diproses server THEN row `Todo` yang terbentuk SHALL memiliki `status` `open`, terlepas dari isian dialog manapun (field status tidak tersedia di dialog).

### Requirement 3: Field status terkunci "open" di sidebar (ditampilkan disabled, bukan disembunyikan)

**User Story:** As a pengguna, I want alur assign dari sidebar selalu menghasilkan ToDo berstatus "open", so that penutupan/pembatalan tugas (status closed/canceled) tetap merupakan aksi eksplisit yang dilakukan lewat halaman `/todos` standalone, bukan tercampur dengan alur assignment cepat di sidebar — namun field status tetap terlihat (disabled) supaya konsisten secara visual dengan `Todos/Form.jsx` dan tidak menyembunyikan informasi begitu saja.

#### Acceptance Criteria

1. THE Dialog Assign (baik untuk menambah assignee baru maupun mengedit Buffer item) SHALL menampilkan field status dalam keadaan disabled (non-interaktif), dengan value terkunci `open`.
2. WHEN sebuah ToDo dibuat melalui alur sidebar (baik langsung tersimpan lewat `addAssignee`, maupun lewat Buffer item yang diproses saat dokumen induk disimpan) THEN status ToDo tersebut SHALL selalu `open`, terlepas dari field status yang ditampilkan (disabled) di Dialog Assign.
3. Payload yang dikirim ke `addAssignee` atau disimpan ke Buffer item SHALL TIDAK menyertakan value `status` dari Dialog Assign — status `open` diterapkan oleh backend (`Controller::addAssignee`) atau saat Buffer item diproses (`BufferedAttachmentService`), bukan dikirim dari client, supaya field disabled di UI tidak bisa dimanipulasi jadi nilai lain lewat modifikasi payload di luar UI.

### Requirement 4: Klik assignee row — navigasi ke halaman Show atau buka Dialog Assign, tergantung mode

**User Story:** As a pengguna yang melihat daftar assignee di sidebar, I want mengklik satu assignee row untuk melihat atau mengubah detailnya, so that saya bisa meninjau maupun menyunting sebuah assignment tanpa perlu mencarinya manual di halaman `/todos`.

#### Acceptance Criteria

1. IF dokumen induk berada dalam edit-mode (assignee row merepresentasikan `Todo` yang sudah tersimpan) WHEN pengguna mengklik assignee row (di luar tombol hapus) THEN sistem SHALL menavigasikan pengguna ke halaman `/todos/{id}` (Show) milik `Todo` tersebut.
2. IF dokumen induk berada dalam create-mode (assignee row merepresentasikan Buffer item) WHEN pengguna mengklik assignee row (di luar tombol hapus) THEN sistem SHALL membuka Dialog Assign terisi data Buffer item tersebut (assignee, priority, date, due_date, description) untuk diedit.
3. WHEN pengguna mengonfirmasi Dialog Assign yang dibuka dari Requirement 4.2 THEN sistem SHALL memperbarui Buffer item yang bersangkutan di `data.buffered_assignees` (bukan menambah entri baru).

### Requirement 5: Sidebar menampilkan semua status ToDo dengan indikator visual

**User Story:** As a pengguna yang membuka halaman detail sebuah dokumen, I want melihat status setiap ToDo yang terkait dengan dokumen tersebut langsung dari sidebar, so that saya bisa memantau progres tindak lanjut tanpa harus membuka setiap ToDo satu per satu.

#### Acceptance Criteria

1. THE query assignee pada `showDetail()` (`App\Traits\DataTable`) SHALL menampilkan `Todo` dengan status apapun (`open`, `closed`, `canceled`) yang terkait dokumen tersebut, bukan hanya yang `open`.
2. THE assignee row di sidebar SHALL menampilkan indikator visual status (mengikuti skema warna `BadgeStatus.jsx` yang sudah ada untuk `open`/`closed`/`canceled`).
3. THE urutan assignee row SHALL tetap dapat dibaca dengan jelas terlepas dari campuran status (mis. tidak ada status yang secara visual "tersembunyi" akibat indikator yang tidak kontras).

### Requirement 6: Tombol hapus hanya tersedia untuk assignee berstatus open

**User Story:** As a pengguna, I want ToDo yang sudah closed/canceled tetap terlihat sebagai riwayat di sidebar tanpa bisa terhapus tidak sengaja, so that jejak tindak lanjut yang sudah selesai/dibatalkan tetap terjaga sebagai riwayat dokumen.

#### Acceptance Criteria

1. IF assignee row berstatus `open` THEN sistem SHALL menampilkan tombol hapus (X) yang berfungsi sesuai alur `removeAssignee`/hapus Buffer item yang sudah ada.
2. IF assignee row berstatus `closed` atau `canceled` THEN sistem SHALL TIDAK menampilkan tombol hapus pada row tersebut.
3. Requirement 6.2 SHALL HANYA berlaku pada edit-mode (row merepresentasikan `Todo` tersimpan) — Buffer item (create-mode) SHALL selalu bisa dihapus karena Requirement 3 menjamin Buffer item selalu berstatus `open` secara implisit (belum ada status closed/canceled sebelum dokumen induk tersimpan).

### Requirement 7: Reuse field form ToDo tanpa duplikasi definisi

**User Story:** As a pengembang yang memelihara kode ini, I want field-field Dialog Assign berbagi definisi dengan form ToDo standalone (`Todos/Form.jsx`), so that perubahan pada satu tempat (mis. tambah validasi priority) otomatis konsisten di kedua alur tanpa duplikasi.

#### Acceptance Criteria

1. THE komponen field inti (assignee, priority, status, date, due_date, description) pada `Todos/Form.jsx` SHALL direfactor agar dapat menerima `value`/`onChange` eksplisit, selain lewat context `useFormPage()` seperti sekarang.
2. WHEN `Todos/Form.jsx` dipakai di halaman `/todos` standalone (create maupun edit) THEN perilakunya SHALL tidak berubah dari sebelum refactor (tetap membaca/menulis lewat `useFormPage()`, termasuk field status tetap aktif/dapat diubah).
3. WHEN komponen field yang sama dipakai di dalam Dialog Assign (sidebar) THEN ia SHALL beroperasi di atas state lokal milik dialog tersebut, terisolasi dari context `FormPage` milik dokumen induk yang sedang dibuka.
4. Dialog Assign SHALL menampilkan field status dalam keadaan disabled/terkunci `open` (lihat Requirement 3), BUKAN menyembunyikannya — komponen field yang sama dipakai di kedua konteks, perbedaannya murni pada prop yang mengaktifkan mode disabled.

### Requirement 8: Default assignee ke user login saat create ToDo standalone

**User Story:** As a pengguna yang membuka halaman "New ToDo" (`/todos/create`), I want field assignee terisi otomatis dengan diri saya sendiri, so that untuk kasus paling umum (menugaskan diri sendiri) saya tidak perlu mencari nama sendiri di picker, konsisten dengan perilaku ERPNext di mana `allocated_to` wajib diisi dan default ke user yang sedang login.

#### Acceptance Criteria

1. WHEN pengguna membuka halaman "New ToDo" (`/todos/create`) THEN field assignee SHALL terisi default dengan user yang sedang login (`{id, type: 'user', name}`).
2. THE default assignee tersebut SHALL tetap dapat diganti secara manual oleh pengguna ke user lain atau role, sebelum disimpan.
3. THE mekanisme default ini SHALL diterapkan lewat prop `defaultData`/`defaultValues` yang sudah ada pada `FormPage` (`TodoController::create()` mengirim nilai default, `Todos/Show.jsx` meneruskannya) — bukan hardcode di dalam `Todos/Form.jsx`.
4. Requirement 8 SHALL HANYA berlaku untuk halaman `/todos/create` standalone — Dialog Assign (Requirement 1) tetap tidak memiliki default assignee, karena assignee yang wajib dipilih secara sadar adalah inti dari aksi "menugaskan" dari sidebar.

### Requirement 9: Cegah assign ganda ke assignee yang sudah punya ToDo untuk dokumen yang sama

**User Story:** As a pengguna yang menugaskan lewat sidebar, I want tidak bisa memilih assignee yang sudah punya ToDo (berstatus apapun) untuk dokumen yang sama, so that isian detail (priority/tanggal/deskripsi) yang saya buat di Dialog Assign tidak pernah diam-diam terbuang karena request diabaikan/gagal server, dan supaya perilakunya konsisten dengan ERPNext (assignee unik per dokumen, dicegah sejak pemilihan bukan gagal senyap atau error mentah setelah submit).

#### Acceptance Criteria

1. WHEN Dialog Assign dibuka untuk menambah assignee baru (Requirement 1) THEN picker assignee SHALL mengecualikan user/role yang sudah memiliki assignee row berstatus APAPUN (`open`, `closed`, maupun `canceled`) untuk dokumen yang sama, KECUALI assignee yang sedang diedit sendiri (lihat Requirement 4.2 — Buffer item existing tetap muncul sebagai dirinya sendiri saat diedit).
2. IF request `addAssignee` diterima server DAN assignee yang diminta sudah memiliki `Todo` row (status apapun, belum ter-soft-delete) untuk `reference` yang sama THEN sistem SHALL menolak request dengan pesan validasi eksplisit, TIDAK mengabaikannya secara senyap maupun membiarkannya gagal sebagai error database mentah.
3. Requirement 9.2 SHALL berlaku sebagai pertahanan kedua (defense-in-depth) — kondisi ini seharusnya jarang tercapai karena Requirement 9.1 sudah mencegahnya di picker, namun tetap divalidasi server untuk menutup celah race condition atau pemanggilan endpoint di luar UI dialog.
4. Requirement 9 SHALL konsisten dengan constraint unik `todos` tabel (`reference_type`+`reference_id`+`allocated_to_id`+`deleted_at`) — assignee yang row-nya sudah soft-deleted (`removeAssignee` sebelumnya) SHALL TIDAK dikecualikan dari picker maupun ditolak validasi, karena `deleted_at` yang berbeda membuat constraint tersebut tidak collide (assign ulang setelah dihapus tetap diperbolehkan, sesuai perilaku idempoten yang sudah ada). Menangani "reopen" ToDo `closed`/`canceled` tanpa soft-delete sebagai use case sadar berada di luar scope spec ini (lihat Out of Scope).

## Out of Scope

- Perubahan pada halaman `/todos` standalone (Index/Show) di luar refactor field (Requirement 7) dan default assignee (Requirement 8) — perilaku CRUD lain tidak berubah.
- Perubahan pada mekanisme notifikasi (`TodoService::notifyAssignee`) — tetap dipanggil dengan cara yang sama, hanya payload field tambahan (priority/description/date/due_date) yang kini bisa terisi non-default sejak assignment pertama kali dibuat.
- Bulk-assign (menugaskan banyak assignee sekaligus dalam satu submit dialog) — dialog tetap satu-assignee-per-submit seperti alur sekarang.
