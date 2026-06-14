---
description: Update status task di tasks.md (kompatibel Kiro numerik dan format simple T01/T02)
allowed-tools: Read, Write, Edit, Glob
---

Update status task di `tasks.md`.

Input: $ARGUMENTS
(Contoh: "1.2 done", "3.1 mulai", "T04 selesai", "user-auth 1.1 reset")

## Format Status Task (Kiro-compatible)
| Status | Sintaks | Alias yang diterima |
|--------|---------|---------------------|
| Belum dikerjakan | `[ ]` | reset, batal, undo, todo |
| Antrian / queued | `[~]` | queue, antrian, queued |
| In progress | `[-]` | mulai, start, wip, in-progress |
| Selesai | `[x]` | done, selesai, complete, x |

## Format ID Task
Terima kedua format:
- **Kiro numerik**: `1.`, `1.1`, `1.2`, `3`, `3.1` dst
- **Simple**: `T01`, `T02`, `T03` dst

## Langkah:

### 1. Parse input
Tentukan:
- Nama spec (jika disebutkan) atau deteksi otomatis jika hanya ada satu spec aktif
- ID task yang ingin diupdate
- Status baru

### 2. Deteksi format tasks.md
Baca tasks.md dan deteksi apakah format Kiro (numerik) atau simple (T01/T02).

### 3. Update tasks.md
- Temukan baris dengan ID task yang dimaksud
- Untuk format Kiro: jika parent task `1.` di-set `[x]`, tanyakan apakah semua sub-tasks juga mau di-set `[x]`
- Ganti status checkbox sesuai input

### 4. Update counter (format simple saja)
Di format simple, update baris:
```
> Status: X / N tasks selesai
```

### 5. Konfirmasi perubahan

Format Kiro:
```
✅ Task 1.2 → [x] selesai

Progress group 1: 2/3 sub-tasks selesai
Overall: 5/12 tasks (42%)

⏭️  Task berikutnya: 1.3 — [deskripsi]
```

Format simple:
```
✅ T03 → [x] selesai

Progress: 4/8 tasks (50%)
████████░░░░░░░░ 50%

⏭️  Task berikutnya: T04 — [deskripsi]
```

### 6. Logika Checkpoint (format Kiro)
Task checkpoint adalah task yang deskripsinya mengandung "Checkpoint" atau "Ensure ... tests pass".
Saat task checkpoint dicapai (semua task sebelumnya `[x]`):
```
🔍 Checkpoint: task X — "Ensure tests pass"
Jalankan test suite dulu sebelum melanjutkan.
Setelah semua test pass, konfirmasi untuk tandai checkpoint [x] dan lanjut ke group berikutnya.
```

### 7. Jika semua task [x]
```
🎉 Semua tasks selesai! (N/N)

Langkah terakhir:
- [ ] Final test suite run: php artisan test --compact
- [ ] Jalankan lint/pint: vendor/bin/pint --dirty --format agent
- [ ] Commit pada branch saat ini dengan format pesan baku:
      feat(<scope>): <deskripsi singkat>      ← fitur baru
      fix(<scope>): <deskripsi singkat>       ← bug fix
      refactor(<scope>): <deskripsi singkat>  ← refactor tanpa behavior change
      chore(<scope>): <deskripsi singkat>     ← task non-fungsional (config, deps)
      docs(<scope>): <deskripsi singkat>      ← dokumentasi saja
      test(<scope>): <deskripsi singkat>      ← tambah/ubah test
```

Selalu gunakan bahasa yang sama dengan user.
