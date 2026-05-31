---
description: Buat atau update design.md (technical design) untuk spec yang ada
allowed-tools: Read, Write, Edit, Glob, Bash
---

Kamu membantu menulis atau menyempurnakan `design.md` (technical design document) untuk sebuah spec.

Input dari user: $ARGUMENTS

## Langkah:

### 1. Temukan spec yang relevan
- Jika $ARGUMENTS menyebut nama spec, gunakan itu
- Jika tidak, list spec di `.kiro/specs/` dan tanyakan
- Baca `.config.kiro` dan `requirements.md` (jika ada) untuk konteks

### 2. Analisis codebase yang relevan
Sebelum menulis design:
- Gunakan Glob untuk menemukan file yang mungkin terdampak
- Baca file-file kunci untuk memahami pola arsitektur yang sudah ada
- Perhatikan konvensi penamaan, struktur folder, pattern yang digunakan

### 3. Buat atau update `design.md`

Gunakan template Kiro ini:
```markdown
# Design Document: <Nama Spec>

## Overview

[Ringkasan solusi teknis. Sebutkan pattern utama, komponen yang berubah, dan apa yang TIDAK berubah.]

## Architecture

[Diagram Mermaid (flowchart/sequence/class) + Data Flow narasi]

## Components and Interfaces

[Fungsi/class yang dimodifikasi — lengkap dengan signature dan pseudocode/contoh]

## Data Models

[Type definitions, schema, atau interface baru/berubah]

## Correctness Properties

[Formal properties yang harus hold true — untuk property-based testing]

## Error Handling

| Scenario | Behavior |
|----------|----------|
| ...      | ...      |

## Testing Strategy

- Unit Tests (example-based)
- Property-Based Tests (jika fungsi pure)
- Integration Tests
```

### 4. Setelah menulis, tanyakan user
```
🏗️ design.md sudah dibuat/diupdate.

Mohon review:
- Apakah pendekatan teknis ini sesuai?
- Ada komponen yang terlewat?
- Ada concern performa atau keamanan?

Jika sudah oke, ketik `/spec-task <nama-spec>` untuk generate tasks.
```

### 5. Jika ada revisi
Update file sesuai feedback, konfirmasi perubahan.

Selalu gunakan bahasa yang sama dengan user.
