---
description: Generate tasks.md dari requirements dan design yang sudah ada
allowed-tools: Read, Write, Edit, Glob, Bash
---

Kamu membantu membuat `tasks.md` — implementation plan berdasarkan spec yang ada.

Input dari user: $ARGUMENTS

## Langkah:

### 1. Temukan dan baca spec

- Tentukan nama spec dari $ARGUMENTS atau tanya user
- Baca semua file yang ada: `.config.kiro` (jika ada), `requirements.md`, `design.md`
- Jika design.md belum ada, ingatkan user bahwa design sebaiknya dibuat dulu

### 2. Format Kiro (jika .config.kiro ada atau user pilih Kiro)

````markdown
# Implementation Plan: <Nama Spec>

## Overview

[Ringkasan pendekatan implementasi dalam 2-3 kalimat. Sebutkan pola utama,
komponen yang berubah, dan apa yang TIDAK berubah.]

## Tasks

- [ ] 1. <Nama Group — biasanya per file atau per layer>
  - [ ] 1.1 <Sub-task spesifik>
    - Detail implementasi baris 1
    - Detail implementasi baris 2
    - _Requirements: X.Y, X.Z_

  - [ ] 1.2 <Sub-task spesifik>
    - Detail implementasi
    - _Requirements: X.Y_

  - [ ] 1.3 Write [unit|property] tests for <komponen> (<Property/Test name>)
    - **<Property/Test>: <deskripsi singkat apa yang diverifikasi>**
    - Detail test: input apa, output apa yang diverifikasi
    - **Validates: Requirements X.Y, X.Z**

- [ ] 2. Checkpoint - Ensure <group sebelumnya> tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 3. <Nama Group berikutnya>
  - [ ] 3.1 ...

- [ ] 4. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Setiap task mereferensi requirement spesifik untuk traceability
- Checkpoint memastikan validasi inkremental
- [Catatan penting lainnya tentang scope, batasan, atau pendekatan]

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3"] },
    { "id": 2, "tasks": ["3.1"] }
  ]
}
```
````

### 3. Prinsip task yang baik

- **Atomik**: satu task = satu perubahan yang bisa di-commit
- **Spesifik**: sebutkan file atau fungsi yang terpengaruh
- **Terurut**: dependencies antar task jelas
- **Testable**: setiap task punya cara verifikasi
- **Traceable**: referensi ke requirement (untuk format Kiro)
- **Checkpoint**: setiap N group ada validasi "ensure tests pass"
- **Optional task**: gunakan `- [ ]\* <id> <deskripsi>` untuk task yang tidak wajib dikerjakan

### 4. Setelah menulis, tampilkan summary

```
✅ tasks.md sudah dibuat! (format: Kiro | Simple)

📊 Total: N tasks dalam X groups/phases
  [breakdown per group]

🚀 Siap untuk mulai implementasi!
Katakan "kerjakan task pertama" atau "mulai dari 1.1" untuk memulai.
```

### 5. Saat user minta mulai implementasi

- Cek apakah ada task optional (`[ ]\*`) — jika ada, **tanyakan dulu**: _"Jalankan required task saja, atau termasuk optional task?"_
- Baca task berikutnya yang `[ ]` atau `[~]` (dan `[ ]\*` jika user pilih termasuk optional)
- Update status ke `[-]` (in progress)
- Kerjakan task tersebut
- Jalankan test/build yang relevan (bukan lint/pint — lihat poin terakhir)
- Summary file yang berubah
- Update status ke `[x]` HANYA jika validasi pass
- Lanjutkan ke task berikutnya
- **Lint/Pint (vendor/bin/pint) hanya dijalankan setelah SEMUA task selesai** — jangan jalankan per task

Selalu gunakan bahasa yang sama dengan user.
