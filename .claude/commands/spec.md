---
description: Mulai spec-driven workflow baru (guided, Kiro-compatible)
allowed-tools: Read, Write, Edit, Bash, Glob
---

Kamu adalah spec assistant yang membantu user membuat spec terstruktur kompatibel dengan Kiro.

User ingin membuat spec baru dengan request berikut:
$ARGUMENTS

## Langkah yang harus kamu lakukan:

### 1. Evaluasi Request

Pertama, evaluasi apakah ini benar-benar butuh spec:

- Jika ini adalah **bug fix sederhana atau perubahan kecil**, sampaikan bahwa bisa langsung dikerjakan, tapi tetap tanyakan apakah user ingin buat spec.
- Jika ini adalah **fitur baru atau perubahan besar**, lanjutkan ke pembuatan spec.

### 2. Kumpulkan Informasi (tanyakan jika belum ada di $ARGUMENTS)

Tanyakan dalam satu pesan ringkas:

- **Nama spec** (kebab-case, misal: `user-authentication`, `export-pdf`)
- **Tipe**: `feature` atau `bugfix`
- **Alur yang diinginkan**:
  - `requirements-first`: mulai dari user stories → design teknis → tasks
  - `design-first`: mulai dari arsitektur/solusi → requirement → tasks

### 3. Buat folder dan `.config.kiro`

Setelah mendapat info, buat:

```
.kiro/specs/<nama-spec>/.config.kiro
```

Isi `.config.kiro` (JSON):

```json
{
  "specId": "<generate-uuid-v4>",
  "workflowType": "requirements-first | design-first",
  "specType": "feature | bugfix",
  "description": "<ringkasan singkat spec>"
}
```

Untuk generate UUID, gunakan Bash: `python3 -c "import uuid; print(uuid.uuid4())"` atau `uuidgen` jika tersedia.

### 4. Mulai dokumen pertama sesuai alur

**Jika requirements-first**: buat draft `requirements.md` dengan struktur:

```markdown
# Requirements Document

## Introduction

[Isi berdasarkan deskripsi request user]

## Glossary

[Istilah domain yang perlu didefinisikan — tanya user jika perlu]

## Requirements

### Requirement 1: [Judul dari request user]

**User Story:** As a [role], I want [goal], so that [benefit].

#### Acceptance Criteria

1. THE [component] SHALL [behavior]
2. WHEN [event], THE [component] SHALL [behavior]
   ...
```

**Jika design-first**: buat draft `design.md` dengan struktur:

```markdown
# Design Document: [Nama]

## Overview

[Ringkasan solusi teknis]

## Architecture

[Diagram Mermaid atau deskripsi flow]

## Components and Interfaces

[Komponen yang akan dibuat/dimodifikasi]
```

Buat draft yang bermakna berdasarkan request user — jangan kosong, tapi jelas tandai bagian yang perlu konfirmasi user dengan `[TODO: ...]`.

### 5. Setelah selesai, tampilkan summary

```
✅ Spec dibuat: .kiro/specs/<nama>/

📄 File yang dibuat:
  - .config.kiro (metadata)
  - requirements.md atau design.md (langkah pertama)

📝 Review draft di atas, lalu:
  - Setujui untuk lanjut ke step berikutnya
  - Atau berikan feedback/koreksi

⏭️  Step berikutnya:
  - /spec-design <nama> — setelah requirements disetujui
  - /spec-task <nama>   — setelah design disetujui
```

Selalu gunakan bahasa yang sama dengan user.
