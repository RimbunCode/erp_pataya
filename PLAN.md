## MyCourses: File Submission Visibility + Per-File Delete + Deadline Time Support

### Summary

- Tampilkan file submission langsung di setiap content row `MyCourses` dan beri aksi hapus per file.
- Tetap tampilkan aksi `Upload Ulang` walau konten sudah berstatus submit.
- Tambahkan dukungan deadline jam (date + time) end-to-end dan enforce aturan “hanya sebelum deadline”.

### Public Interface Changes

- Database: tambah kolom nullable `deadline_time` (`TIME`) pada `course_contents`.
- Route baru: `DELETE /student/submissions/{content}/files/{file}` dengan nama `student.submissions.files.destroy`.
- Payload Inertia konten student ditambah:
  - `deadline_label` (format: `d M Y, H:i T`)
  - `can_manage_submission` (bool, untuk upload/hapus)
- Payload Inertia konten instructor ditambah:
  - `deadline_date` (`Y-m-d`)
  - `deadline_time` (`H:i`)
  - `deadline_label` (display)

### Implementation Changes

- Backend deadline logic:
  - Tambah helper di model `CourseContent` untuk hitung cutoff deadline dari `deadline + deadline_time` (timezone aplikasi).
  - Fallback legacy: jika hanya `deadline` lama yang ada, cutoff = akhir hari (`23:59:59`).
- Student submission flow:
  - `SubmissionController@store` divalidasi agar hanya `pre_assessment/assignment` dan ditolak jika deadline lewat.
  - Tambah `SubmissionController@destroyFile`:
    - validasi kepemilikan submission milik student login untuk content terkait
    - tolak jika deadline lewat
    - hard delete relasi `fileables`
    - jika file terakhir terhapus, hapus record `submissions` agar status kembali “belum submit”.
- Student course list mapping:
  - Ambil submission berdasarkan file aktif.
  - Progress submit dihitung dari submission yang masih punya file aktif.
  - Kirim data deadline + permission flag ke frontend.
- Instructor inline deadline editor:
  - `CourseContentController@update` menerima `deadline` + `deadline_time` (berpasangan).
  - `CourseDetailContentRow` ditambah input tanggal + jam inline untuk `pre_assessment/assignment`, simpan via endpoint update yang sama.
- Frontend student:
  - Di row konten, tampilkan daftar file submission dengan tombol hapus per file.
  - Tombol `Kumpulkan` berubah jadi `Upload Ulang` saat sudah submit.
  - Aksi upload/hapus di-disable/disembunyikan saat `can_manage_submission = false`.

### Assumptions

- Hapus file submission hanya melepas relasi (`fileables`), bukan hard delete record `files`.
- Zona waktu deadline mengikuti `APP_TIMEZONE` saat ini (`UTC`) dan ditampilkan dengan label zona waktu.
- Tidak membuat modal baru; pengaturan deadline dilakukan inline di row konten instructor.
