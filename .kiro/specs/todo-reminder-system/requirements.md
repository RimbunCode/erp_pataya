# Requirements Document

## Introduction

Kolom `todos.due_date` sudah ada dan tampil di form, tapi tidak ada mekanisme apapun yang membacanya — ToDo yang lewat tenggat tidak menghasilkan sinyal apa-apa selain terlihat manual di halaman `/todos`. Fitur ini menambahkan sistem reminder terjadwal (multi-lead H-x, hari-H, overdue eskalasi) yang memanfaatkan infrastruktur notifikasi yang sudah matang (`NotifyUser`, channel database/broadcast/mail).

Karena aturan overdue tidak masuk akal kalau seragam untuk semua ToDo — tugas berdeadline yang lewat makin mendesak, sementara rapat yang sudah lewat cukup ditutup — fitur ini juga menambahkan field `type` (`task`/`event`/`meeting`/`deadline`) yang menentukan kebijakan reminder overdue dan auto-close per ToDo.

Sekaligus menutup gap UX: field `allocated_to` saat ini wajib diisi di semua entry point padahal mayoritas ToDo dibuat untuk diri sendiri. Field ini dibuat opsional dengan fallback ke pembuat ToDo, konsisten di ketiga jalur pembuatan yang ada di codebase.

Karena `event`/`meeting` secara wajar berulang pada dokumen dan assignee yang sama (mis. rapat mingguan), constraint unik yang sebelumnya membatasi satu ToDo aktif per (dokumen, assignee) dilonggarkan penuh. Widget sidebar "Assigned To" juga diperluas menampilkan indikator `type` per baris, tidak hanya nama assignee.

## Glossary

- **Stage reminder**: tahap pengingat pada siklus hidup sebuah ToDo — `lead` (H-x sebelum due_date), `day_of` (tepat pada due_date), `overdue` (setelah due_date lewat).
- **Lead days**: daftar angka hari (mis. `[7,3]`) yang dikonfigurasi per-ToDo untuk stage `lead`. H-1 dan `day_of` selalu aktif terlepas dari konfigurasi ini.
- **Eskalasi overdue**: pola pengiriman reminder `overdue` berulang yang frekuensinya mengecil seiring waktu (harian di awal, lalu melebar), berbeda per `type`.
- **Auto-close**: penutupan otomatis (`status → closed`) sebuah ToDo oleh scheduler saat `due_date` lewat, berlaku untuk type yang berbasis momen (`event`, `meeting`).
- **Ledger reminder** (`todo_reminders`): tabel pencatat setiap reminder yang benar-benar terkirim, dipakai sebagai sumber kebenaran idempotensi dan penghitung eskalasi.
- **Sweep**: satu eksekusi command terjadwal yang memeriksa seluruh ToDo aktif dan mengirim reminder/menutup ToDo sesuai aturan.
- **Assigner**: user yang membuat assignment (`assigned_by_id`), lihat spec `todo-feature` untuk definisi lengkap `Assignee`/`Assignable`.

## Requirements

### Requirement 1: Field `type` pada ToDo dengan kebijakan reminder per-type

**User Story:** As a pengguna yang membuat ToDo, I want menandai ToDo tersebut sebagai `task`, `event`, `meeting`, atau `deadline`, so that sistem tahu apakah ToDo ini perlu diingatkan terus-menerus ketika lewat tenggat atau cukup ditutup otomatis.

#### Acceptance Criteria

1. THE sistem SHALL menyediakan kolom `type` pada `todos` dengan nilai yang diizinkan `task`, `event`, `meeting`, `deadline`.
2. WHEN sebuah ToDo dibuat tanpa `type` eksplisit, THE sistem SHALL menetapkan `type = task` sebagai default.
3. THE sistem SHALL memberi nilai `type = task` pada seluruh baris ToDo yang sudah ada di database sebelum fitur ini (backfill).
4. WHERE `type` adalah `task` ATAU `deadline`, THE sistem SHALL mengirim reminder `overdue` berulang selama ToDo berstatus `open` dan lewat tenggat.
5. WHERE `type` adalah `event` ATAU `meeting`, THE sistem SHALL TIDAK mengirim reminder `overdue` apapun.
6. WHERE `type` adalah `deadline`, eskalasi reminder `overdue` SHALL lebih sering (harian ×7 lalu tiap 3 hari) DIBANDING `type = task` (harian ×3 lalu tiap 7 hari).
7. IF pengguna memasukkan nilai `type` di luar empat nilai yang diizinkan, THEN THE sistem SHALL menolak request dengan error validasi.

### Requirement 2: Auto-close ToDo bertipe momen saat tenggat lewat

**User Story:** As a pengguna, I want ToDo bertipe `event`/`meeting` otomatis ditutup ketika tanggalnya lewat, so that daftar ToDo saya tidak dipenuhi rapat/acara lampau yang tidak lagi actionable.

#### Acceptance Criteria

1. WHEN sweep harian berjalan DAN sebuah ToDo berstatus `open` ber-`type` `event` atau `meeting` memiliki `due_date` di masa lalu, THE sistem SHALL mengubah `status` ToDo tersebut menjadi `closed`.
2. WHEN sebuah ToDo di-auto-close pada suatu sweep, THE sistem SHALL TIDAK mengirim reminder stage lain (lead/day_of/overdue) untuk ToDo tersebut pada sweep yang sama.
3. THE sistem SHALL TIDAK menyertakan ToDo berstatus `closed` atau `canceled` dalam sweep berikutnya.
4. WHEN sebuah ToDo di-auto-close, THE sistem SHALL mengirim satu notifikasi informasi ke assignee DAN assigner (dedup jika sama orang) melalui channel `database`, `broadcast`, dan `mail`, terpisah dari notifikasi reminder.

### Requirement 3: Reminder bertahap sebelum dan pada tanggal jatuh tempo

**User Story:** As a assignee sebuah ToDo, I want diingatkan beberapa hari sebelum dan tepat pada hari jatuh tempo, so that saya tidak kelewatan tenggat.

#### Acceptance Criteria

1. THE sistem SHALL menyediakan kolom `reminder_lead_days` (array angka hari) yang dapat dikonfigurasi per-ToDo lewat form.
2. WHEN `due_date` sebuah ToDo berjarak N hari dari hari ini DAN N ada dalam `reminder_lead_days` milik ToDo tersebut, THE sistem SHALL mengirim satu reminder stage `lead` untuk offset N.
3. THE sistem SHALL mengirim reminder stage `lead` untuk H-1 SETIAP kali, terlepas dari apakah angka `1` dicantumkan di `reminder_lead_days`.
4. WHEN `due_date` sebuah ToDo jatuh pada hari ini, THE sistem SHALL mengirim satu reminder stage `day_of`, terlepas dari isi `reminder_lead_days`.
5. THE sistem SHALL mengirim paling banyak satu reminder per ToDo per sweep.
6. IF `reminder_lead_days` berisi nilai negatif atau nol, THEN THE sistem SHALL menolak request dengan error validasi.
7. WHERE `due_date` sebuah ToDo adalah null, THE sistem SHALL mengecualikan ToDo tersebut dari seluruh proses reminder.

### Requirement 4: Reminder overdue yang mengeskalasi

**User Story:** As a assignee sebuah ToDo bertipe `task`/`deadline`, I want terus diingatkan ketika ToDo saya lewat tenggat, dengan frekuensi yang mengecil seiring waktu, so that saya tetap sadar ada tunggakan tanpa dibanjiri notifikasi harian selamanya.

#### Acceptance Criteria

1. WHEN sebuah ToDo ber-`type` `task` lewat tenggat, THE sistem SHALL mengirim reminder `overdue` pada hari ke-1, ke-2, dan ke-3 setelah lewat tenggat, KEMUDIAN setiap 7 hari sesudahnya.
2. WHEN sebuah ToDo ber-`type` `deadline` lewat tenggat, THE sistem SHALL mengirim reminder `overdue` pada hari ke-1 sampai ke-7 setelah lewat tenggat, KEMUDIAN setiap 3 hari sesudahnya.
3. WHEN sebuah ToDo yang sedang dalam eskalasi overdue berubah status menjadi `closed` atau `canceled`, THE sistem SHALL menghentikan seluruh reminder overdue untuk ToDo tersebut.
4. IF scheduler tidak berjalan pada satu atau lebih hari terjadwal (mis. downtime), THEN sweep berikutnya SHALL mengirim reminder overdue yang seharusnya sudah jatuh tempo, TANPA mengirim seluruh reminder yang terlewat sekaligus (maksimal satu per sweep, sesuai Requirement 3.5).

### Requirement 5: Reminder tidak boleh terkirim dobel

**User Story:** As a pengguna, I want tidak menerima reminder yang sama berkali-kali akibat scheduler dijalankan ulang atau bersamaan, so that notifikasi saya tetap dapat dipercaya dan tidak menjadi spam.

#### Acceptance Criteria

1. THE sistem SHALL mencatat setiap reminder yang berhasil terkirim ke ledger sebelum mengirim notifikasi ke penerima.
2. IF sebuah kombinasi (ToDo, stage, offset, tanggal jatuh tempo saat itu) sudah pernah tercatat di ledger, THEN THE sistem SHALL TIDAK mengirim reminder itu lagi maupun mencatat ulang.
3. WHEN sweep dijalankan dua kali pada hari yang sama (baik terjadwal maupun manual), THE sistem SHALL menghasilkan jumlah notifikasi yang identik dengan menjalankannya satu kali.
4. WHEN `due_date` sebuah ToDo diubah SETELAH satu atau lebih reminder untuk tanggal lama sudah terkirim, THE sistem SHALL memperlakukan reminder untuk tanggal baru sebagai belum pernah terkirim (termasuk perhitungan ulang eskalasi overdue), TANPA menghapus riwayat reminder untuk tanggal lama.

### Requirement 6: Penerima dan channel reminder

**User Story:** As a pembuat ToDo yang menugaskan orang lain (atau diri sendiri), I want reminder terkirim ke assignee dan tembusan ke saya sebagai pembuat, so that saya juga tahu progres tenggat yang saya tetapkan tanpa kehilangan visibilitas ke ToDo milik saya sendiri.

#### Acceptance Criteria

1. THE sistem SHALL mengirim setiap reminder ke seluruh assignee ToDo (user tunggal, atau seluruh anggota role jika ToDo di-assign ke role) DAN kepada assigner (`assigned_by`) sebagai tembusan.
2. IF assigner adalah orang yang sama dengan satu-satunya assignee (ToDo self-assigned), THEN THE sistem SHALL mengirim tepat satu notifikasi kepada orang tersebut, bukan dua.
3. THE sistem SHALL mengirim setiap reminder melalui tiga channel: `database`, `broadcast`, dan `mail`.
4. IF `assigned_by_id` sebuah ToDo adalah null, THEN THE sistem SHALL tetap mengirim reminder ke seluruh assignee tanpa error.

### Requirement 7: `allocated_to` opsional dengan fallback ke pembuat ToDo

**User Story:** As a pengguna yang membuat ToDo untuk diri sendiri, I want bisa mengosongkan field assignee saat membuat ToDo, so that saya tidak perlu memilih diri saya sendiri secara eksplisit setiap kali.

#### Acceptance Criteria

1. THE sistem SHALL menerima request pembuatan ToDo tanpa field `allocated_to` diisi.
2. WHEN sebuah ToDo dibuat tanpa `allocated_to`, THE sistem SHALL menetapkan assignee-nya ke user yang sedang login (`type = user`).
3. THIS perilaku SHALL berlaku konsisten pada ketiga entry point pembuatan ToDo yang ada di codebase: form standalone `/todos`, widget sidebar "Assigned To" pada dokumen apapun, dan buffered-assignee saat pembuatan dokumen baru (termasuk dari modul Helpdesk).
4. IF ToDo dibuat tanpa konteks user yang login (mis. dari console/seeder) DAN `allocated_to` tidak diisi, THEN THE sistem SHALL menolak operasi tersebut secara eksplisit, bukan menyimpan nilai kosong/null ke kolom assignee.

> **Catatan revisi:** kriteria "tolak duplikat assignee pada dokumen yang sama" yang sebelumnya ada di sini dihapus — lihat Requirement 11.

### Requirement 8: Kontrak field lain pada jalur sidebar dan buffered-assignee tidak berubah

**User Story:** As developer yang memelihara sistem ini, I want penyatuan tiga jalur pembuatan ToDo tidak mengubah perilaku yang sudah ada di luar `allocated_to`, so that fitur sidebar "Assigned To" dan buffered-assignee di modul lain (termasuk Helpdesk) tidak regresi.

#### Acceptance Criteria

1. THE sistem SHALL selalu menetapkan `status = open` pada ToDo yang dibuat lewat jalur sidebar ATAU buffered-assignee, TANPA TERKECUALI, bahkan jika payload request menyertakan nilai `status` lain.
2. WHERE `priority` tidak disertakan pada jalur sidebar/buffered-assignee, THE sistem SHALL menetapkan `priority = medium`.
3. THE sistem SHALL tetap menetapkan `assigned_by_id` ke user yang sedang login pada jalur sidebar/buffered-assignee.
4. THE sistem SHALL tetap menghasilkan `code` unik untuk ToDo yang dibuat lewat jalur manapun.
5. THE sistem SHALL tetap mengirim notifikasi assignment (`TodoAssignedNotification`) untuk ToDo yang dibuat lewat jalur sidebar/buffered-assignee.

### Requirement 9: Mengosongkan assignee saat edit membutuhkan konfirmasi

**User Story:** As a pengguna yang mengedit ToDo milik orang lain, I want diberi peringatan eksplisit jika saya mengosongkan field assignee, so that saya tidak secara tidak sengaja mengambil alih ToDo yang bukan tugas saya.

#### Acceptance Criteria

1. WHEN pengguna mengosongkan `allocated_to` saat mengedit ToDo yang assignee-nya BUKAN dirinya sendiri, DAN request tidak menyertakan penanda konfirmasi, THE sistem SHALL menolak request dengan pesan yang menyatakan ToDo akan dialihkan ke pengguna tersebut.
2. WHEN pengguna mengulang request yang sama dengan penanda konfirmasi disertakan, THE sistem SHALL mengalihkan assignee ToDo ke pengguna yang mengedit.
3. IF assignee ToDo saat ini SUDAH merupakan pengguna yang mengedit, THEN mengosongkan `allocated_to` SHALL langsung diterima tanpa perlu konfirmasi (tidak ada perubahan berarti).

### Requirement 10: Operasional — dry-run dan sasaran tunggal untuk debugging

**User Story:** As administrator sistem, I want menjalankan sweep reminder dalam mode simulasi atau membatasinya ke satu ToDo, so that saya bisa memverifikasi perilaku di produksi tanpa efek samping yang tidak diinginkan.

#### Acceptance Criteria

1. THE sistem SHALL menyediakan command terjadwal yang berjalan otomatis satu kali sehari.
2. WHEN command dijalankan dengan opsi simulasi, THE sistem SHALL melaporkan reminder yang AKAN dikirim TANPA benar-benar mengirim notifikasi maupun mencatat ke ledger.
3. WHEN command dijalankan dengan opsi pembatas ke satu ToDo tertentu, THE sistem SHALL hanya mengevaluasi ToDo tersebut, mengabaikan seluruh ToDo lain yang sebenarnya due.

### Requirement 11: Assignee yang sama boleh punya beberapa ToDo pada dokumen yang sama

**User Story:** As a pengguna yang membuat ToDo bertipe `event`/`meeting` berulang (mis. rapat mingguan) pada dokumen yang sama untuk assignee yang sama, I want tidak dihalangi sistem, so that saya bisa mencatat setiap kejadian sebagai ToDo terpisah dengan tanggalnya masing-masing.

#### Acceptance Criteria

1. THE sistem SHALL mengizinkan lebih dari satu ToDo aktif untuk kombinasi (dokumen referensi, assignee) yang sama, terlepas dari `due_date` masing-masing.
2. THE sistem SHALL TIDAK menolak pembuatan ToDo dengan alasan assignee tersebut sudah pernah ditugaskan pada dokumen referensi yang sama.

> Ini merevisi batasan yang sebelumnya ada di spec `todo-feature` (constraint unik `reference_type, reference_id, allocated_to_id, deleted_at`), yang menjadi terlalu ketat begitu ToDo bertipe momen (`event`/`meeting`) bisa berulang secara wajar.

### Requirement 12: Indikator `type` pada widget sidebar "Assigned To"

**User Story:** As a pengguna yang membuka sidebar "Assigned To" pada dokumen apapun, I want melihat tipe setiap ToDo (task/event/meeting/deadline) di daftar, so that saya bisa membedakan tugas berdeadline dari rapat/acara hanya dengan melihat sidebar, tanpa membuka tiap ToDo satu per satu.

#### Acceptance Criteria

1. THE sistem SHALL menampilkan indikator visual `type` ToDo pada setiap baris daftar assignee di widget sidebar "Assigned To", berdampingan dengan nama assignee dan indikator status yang sudah ada.
2. THE indikator `type` SHALL menggunakan label yang sama dengan opsi `type` pada form ToDo (satu sumber terjemahan, tidak didefinisikan dua kali).
3. THE sistem SHALL TIDAK lagi menampilkan indikator assignee-kind (`user`/`role`) pada widget sidebar "Assigned To" — digantikan sepenuhnya oleh indikator `type` ToDo.
