---
description: Baca dan rangkum spec yang sudah ada — termasuk spec yang di-generate oleh Kiro
allowed-tools: Read, Glob, Bash
---

Kamu membaca spec yang sudah ada di `.kiro/specs/` dan merangkumnya agar siap untuk implementasi.

Input dari user: $ARGUMENTS

## Langkah:

### 1. Temukan spec

- Jika $ARGUMENTS menyebut nama spec, langsung buka folder `.kiro/specs/<nama>/`
- Jika tidak ada argumen, list semua folder di `.kiro/specs/` dan tanyakan mana yang ingin dibaca
- Jika hanya ada satu spec, langsung baca tanpa tanya

### 2. Baca semua file yang tersedia

Baca file-file berikut (skip jika tidak ada):

**`.config.kiro`** (Kiro metadata — JSON):

```json
{
  "specId": "...",
  "workflowType": "requirements-first|design-first",
  "specType": "feature|bugfix"
}
```

Ekstrak: `workflowType`, `specType`

**`requirements.md`** — source of truth untuk behavior & acceptance criteria
Kenali struktur Kiro:

- `## Introduction` — context & problem statement
- `## Glossary` — definisi istilah domain
- `## Requirements` — requirements bernomor (Requirement 1, 2, dst)
  - Setiap requirement punya `**User Story**` dan `#### Acceptance Criteria` bernomor (1.1, 1.2, dst)

**`design.md`** — source of truth untuk arsitektur & keputusan teknis
Kenali struktur Kiro:

- `## Overview` — ringkasan solusi
- `## Architecture` — diagram Mermaid + data flow
- `## Components and Interfaces` — code signatures & pseudocode
- `## Data Models` — type definitions
- `## Correctness Properties` — formal properties untuk property-based testing
- `## Error Handling` — tabel error cases
- `## Testing Strategy` — unit tests, property tests, integration tests

**`tasks.md`** — checklist implementasi
Kenali struktur Kiro:

- Judul: `# Implementation Plan: <nama>`
- Ada `## Overview` — ringkasan approach
- Tasks hierarkis numerik: `1.`, `1.1`, `1.2`, bukan `T01/T02`
- Ada `## Task Dependency Graph` — JSON waves untuk paralelisasi
- Ada `## Notes` — catatan implementasi

### 3. Deteksi format tasks.md

Status task yang valid (Kiro & custom):

```
[ ]   — belum dikerjakan (required)
[ ]\*  — belum dikerjakan (optional — tidak wajib)
[~]   — antrian / queued
[-]   — sedang dikerjakan / in progress
[x]   — selesai / completed
```

Untuk tasks.md format Kiro (numerik), hitung progress berdasarkan item yang `[x]`.
Perhatikan bahwa sub-task `1.1`, `1.2` bisa dihitung terpisah dari parent `1.`.
Optional task (`[ ]\*`) ditampilkan terpisah dalam progress — jangan gabung ke total required.

### 4. Tampilkan rangkuman terstruktur

```
📁 Spec: <nama-spec>
Sumber: Kiro | Manual
Tipe: feature | bugfix
Alur: requirements-first | design-first

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 REQUIREMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Problem: [ringkasan 1-2 kalimat dari Introduction]

Glossary penting: [istilah kunci jika ada]

Requirements:
• Req 1: [judul] — N acceptance criteria
• Req 2: [judul] — N acceptance criteria
• ...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏗️  DESIGN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Pendekatan: [ringkasan dari Overview]

Komponen yang dimodifikasi:
• [list file/fungsi yang berubah]

Pola utama: [fallback chain, pattern, atau approach kunci]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ PROGRESS TASKS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total: X / N selesai  [████████░░░░] 67%

[x] 1. [deskripsi group]
  [x] 1.1 [sub-task]
  [-] 1.2 [sub-task] ← SEDANG DIKERJAKAN
[ ] 2. [deskripsi group]
  [ ] 2.1 [sub-task]
...

Task berikutnya: 1.2 — [deskripsi]
```

Jika ada `## Task Dependency Graph`, tampilkan:

```
📊 Dependency Waves:
  Wave 0: [tasks paralel]
  Wave 1: [tasks paralel]
  ...
```

### 5. Berikan rekomendasi langkah selanjutnya

Jika **ada task yang `[-]` (in progress)**:

```
⚡ Ada task yang sedang in progress: 1.2
Lanjutkan dengan: "lanjutkan 1.2" atau "kerjakan task berikutnya"
```

Jika **semua task `[x]`**:

```
🎉 Semua tasks selesai! Spec ini sudah complete.
```

Jika **ada task `[ ]` atau `[~]`**:

```
🚀 Siap untuk implementasi!
Katakan "kerjakan task berikutnya" atau "mulai dari task 1.1"
```

Jika **ada file yang missing**:

```
⚠️  [nama file] belum ada.
[saran perintah untuk membuatnya]
```

### 6. Catatan penting saat implementasi dari spec Kiro

- `requirements.md` adalah **source of truth** untuk behavior dan acceptance criteria
- `design.md` adalah **source of truth** untuk arsitektur dan keputusan teknis
- Setiap acceptance criteria bernomor (mis. `2.3`) harus dipenuhi sebelum task ditandai `[x]`
- Setelah selesai tiap task: jalankan test/lint/build, summary file yang berubah, baru tandai `[x]`
- Checkpoints (task bernomor bulat seperti `2.`, `4.`, `6.`) = validasi semua test pass sebelum lanjut

Selalu gunakan bahasa yang sama dengan user.
