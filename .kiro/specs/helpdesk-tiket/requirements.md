# Requirements Document

## Introduction

Fitur **Ticket Helpdesk** adalah modul baru (`Helpdesk`) yang memungkinkan pengguna membuat, mengelola, dan melacak ticket permasalahan atau permintaan di dalam aplikasi ERP. Ticket bersifat non-submitable (tidak melalui approval workflow), statusnya dikelola secara mandiri (New → In Progress → Resolved → Done). Setiap pembaruan ticket disimpan sebagai **TicketResponse** yang berfungsi sebagai riwayat perubahan.

## Glossary

| Istilah            | Definisi                                                                                     |
| ------------------ | -------------------------------------------------------------------------------------------- |
| **Ticket**         | Dokumen permintaan/permasalahan yang dibuat oleh pengguna                                    |
| **TicketResponse** | Rekaman setiap pembaruan ticket (balasan/update) termasuk perubahan status/progress/assignee |
| **Assign To**      | Pengguna yang bertanggung jawab menyelesaikan ticket                                         |
| **Creator**        | Pengguna yang pertama kali membuat ticket                                                    |
| **Mark Done**      | Aksi cepat untuk menutup ticket (status = Done, progress = 100%, catat end_date)             |
| **Update Ticket**  | Aksi untuk membalas/memperbarui ticket melalui AlertDialog, disimpan sebagai TicketResponse  |
| **Content**        | Field rich text (TiptapEditor) untuk isi ticket atau isi response                            |

---

## Requirements

### Requirement 1: Pembuatan Ticket

**User Story:** As a user, I want to create a ticket with type, priority, subject, assignee, start date, and content, so that issues or requests can be tracked systematically.

#### Acceptance Criteria

1. THE form SHALL include field: `type` (select: Bug/Problem, Task, Question, Other)
2. THE form SHALL include field: `subject` (text, required)
3. THE form SHALL include field: `assign_to` (UserLinkModel, nullable)
4. THE form SHALL include field: `start_date` (DatetimePicker, default = now)
5. THE form SHALL include field: `due_date` (DatetimePicker, nullable) — tanggal target selesai
6. THE form SHALL include field: `priority` (select: Low, Medium, High, Critical)
7. THE form SHALL include field: `status` (select: New, In Progress, On Hold, Resolved, Done, default = New)
8. THE form SHALL include field: `progress` (Slider 0–100%, default = 0)
9. THE form SHALL include field: `content` (TiptapEditor tanpa dialog, dengan extension insert gambar langsung)
10. WHEN content mengandung gambar yang diupload, THE system SHALL simpan gambar ke model `File` (polymorphic ke Ticket)
11. THE form SHALL auto-generate `code` via `FormatingSeries`
12. THE system SHALL set `created_by_id` = authenticated user saat create
13. WHEN ticket disimpan, THE system SHALL redirect ke halaman show ticket

---

### Requirement 2: Daftar Ticket

**User Story:** As a user, I want to see a list of all tickets with filtering and sorting, so that I can find and manage tickets efficiently.

#### Acceptance Criteria

1. THE index page SHALL menampilkan DataTable2 dengan kolom: code, type, subject, assign_to, status, progress, priority, start_date, due_date, created_by
2. THE DataTable2 SHALL support server-side pagination, sorting, dan filtering
3. THE DataTable2 SHALL support bulk delete
4. THE status SHALL ditampilkan sebagai BadgeStatus dengan warna berbeda per status

---

### Requirement 3: Detail Ticket

**User Story:** As a user, I want to view ticket details with action buttons, so that I can take actions on the ticket.

#### Acceptance Criteria

1. THE show page SHALL render `FormPage` dengan `disabled` saat status = Done
2. THE show page SHALL menampilkan semua field ticket dalam read-only mode
3. THE show page SHALL menampilkan daftar TicketResponse sebagai history di bawah detail
4. WHEN ticket berstatus selain Done, THE show page SHALL menampilkan tombol **"Mark Done"** dan **"Update Ticket"** di area `controls`
5. WHEN ticket berstatus Done, THE show page SHALL menyembunyikan tombol action

---

### Requirement 4: Mark Done

**User Story:** As a user, I want to mark a ticket as done with one click, so that I can close completed tickets quickly.

#### Acceptance Criteria

1. WHEN tombol "Mark Done" ditekan, THE system SHALL menampilkan Dialog konfirmasi
2. WHEN dikonfirmasi, THE system SHALL mengubah `status` = Done, `progress` = 100, `end_date` = now()
3. THE system SHALL membuat TicketResponse baru dengan `status` = Done, `progress` = 100
4. THE system SHALL memanggil `logForUpdated()` pada model Ticket
5. WHEN berhasil, THE page SHALL refresh (back())

---

### Requirement 5: Update Ticket (AlertDialog)

**User Story:** As a user, I want to reply or update a ticket through a dialog, so that I can add progress notes or reassign the ticket.

#### Acceptance Criteria

1. WHEN tombol "Update Ticket" ditekan, THE system SHALL menampilkan AlertDialog
2. THE dialog SHALL include field: `assign_to` (UserLinkModel)
3. WHEN user yang sedang login bukan creator ticket, THE dialog SHALL menampilkan tombol "Assign to Creator" di sebelah field assign_to
4. WHEN "Assign to Creator" ditekan, THE field assign_to SHALL terisi dengan creator ticket
5. THE dialog SHALL include field: `status` (default = status ticket saat ini)
6. THE dialog SHALL include field: `progress` (Slider, default = progress ticket saat ini)
7. THE dialog SHALL include field: `content` (TiptapEditor tanpa dialog, dengan insert gambar)
8. THE dialog SHALL include field: `end_date` (DatetimePicker, nullable) — opsional
9. WHEN disimpan, THE system SHALL membuat TicketResponse baru
10. WHEN disimpan, THE system SHALL mengupdate field `assign_to_id`, `status`, `progress` pada model Ticket
11. WHEN content mengandung gambar, THE system SHALL simpan ke model File (polymorphic ke TicketResponse)
12. THE system SHALL memanggil `logForUpdated()` pada model Ticket
13. WHEN berhasil, THE page SHALL refresh (back())

---

### Requirement 6: TicketResponse sebagai History

**User Story:** As a user, I want to see the full history of ticket updates, so that I can track what changed and when.

#### Acceptance Criteria

1. THE show page SHALL menampilkan daftar TicketResponse diurutkan dari terbaru ke terlama
2. SETIAP TicketResponse SHALL menampilkan: user (yang membuat response), created_at, status, progress, assign_to, content (rendered HTML)
3. THE list SHALL auto-refresh setelah Mark Done atau Update Ticket berhasil

---

### Requirement 7: Gambar dalam TiptapEditor

**User Story:** As a user, I want to insert images directly in the ticket content, so that I can attach visual context without leaving the editor.

#### Acceptance Criteria

1. THE TiptapEditor SHALL memiliki extension untuk upload gambar (Image extension + custom upload handler)
2. WHEN gambar diupload via editor, THE system SHALL POST ke endpoint upload file
3. THE uploaded file SHALL disimpan di model `File` dengan polymorphic ke Ticket atau TicketResponse
4. WHEN gambar berhasil diupload, THE editor SHALL insert gambar inline dengan src = URL file

---

### Requirement 8: Permissions

**User Story:** As an admin, I want to control who can create, read, update, and delete tickets, so that access is properly managed.

#### Acceptance Criteria

1. THE permission record SHALL dibuat untuk `App\Models\Helpdesk\Ticket` dengan permission: select, create, read, write, delete
2. THE controller SHALL memanggil `parent::__construct($request, Ticket::class)` sehingga permission check otomatis
3. WHEN user tidak punya permission, THE system SHALL return 403

---

### Requirement 9: Internasionalisasi (i18n)

#### Acceptance Criteria

1. SEMUA label, placeholder, dan pesan SHALL menggunakan key i18n
2. FILE translasi SHALL dibuat di: `lang/en/helpdesk/ticket.php` dan `lang/id/helpdesk/ticket.php`
3. KEY pattern SHALL mengikuti konvensi: `helpdesk.ticket.{section}.{field}`
