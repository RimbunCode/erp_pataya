---
description: Tampilkan semua spec yang ada beserta statusnya
allowed-tools: Read, Glob, Bash
---

List semua spec yang ada di folder `.kiro/specs/`.

## Langkah:

1. Gunakan Glob untuk menemukan semua file `.config.kiro` di `.kiro/specs/*/.config.kiro`

2. Untuk setiap spec, baca `.config.kiro` dan ekstrak:
   - Nama spec (dari nama folder)
   - Tipe (`specType`: feature/bugfix)
   - Alur (`workflowType`: requirements-first/design-first)
   - Deskripsi singkat (`description`)

3. Cek keberadaan file lain:
   - ✅ ada `requirements.md`
   - ✅ ada `design.md`  
   - ✅ ada `tasks.md`

4. Untuk spec yang punya `tasks.md`, hitung progress task:
   - Berapa total task
   - Berapa yang sudah `[x]`

5. Tampilkan dalam format yang rapi:

```
📁 Specs (.kiro/specs/)

┌─ user-authentication [feature] — in-progress
│  ✅ requirements.md  ✅ design.md  ✅ tasks.md
│  Progress: 3/8 tasks selesai
│  "Implementasi login/register dengan JWT"
│
├─ fix-export-bug [bugfix] — draft
│  ✅ requirements.md  ❌ design.md  ❌ tasks.md
│  "Bug pada export PDF ketika data kosong"
│
└─ payment-gateway [feature] — done
   ✅ requirements.md  ✅ design.md  ✅ tasks.md
   Progress: 12/12 tasks selesai ✨
   "Integrasi Midtrans payment gateway"

Total: 3 specs (1 done, 1 in-progress, 1 draft)
```

6. Jika tidak ada spec sama sekali:
```
📭 Belum ada spec.

Mulai dengan: /spec <deskripsi fitur atau bug yang ingin diselesaikan>
```

Selalu gunakan bahasa yang sama dengan user.
