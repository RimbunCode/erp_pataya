---
description: Buat atau update requirements.md untuk spec yang ada
allowed-tools: Read, Write, Edit, Glob, Bash
---

Kamu membantu menulis atau menyempurnakan `requirements.md` untuk sebuah spec.

Input dari user: $ARGUMENTS

## Langkah:

### 1. Temukan spec yang relevan
- Jika $ARGUMENTS menyebut nama spec, gunakan itu
- Jika tidak, list semua spec yang ada di `.kiro/specs/` dan tanyakan mana yang ingin diupdate
- Baca `spec.md` untuk memahami konteks

### 2. Baca konteks yang ada
- Baca `.config.kiro` untuk tipe dan deskripsi
- Jika `design.md` sudah ada, baca juga untuk menjaga konsistensi
- Jika `requirements.md` sudah ada, baca dan persiapkan untuk update

### 3. Buat atau update `requirements.md`

Gunakan template Kiro ini:
```markdown
# Requirements Document

## Introduction

[Context: masalah yang diselesaikan, sistem yang terlibat, kenapa perlu perubahan ini]

## Glossary

- **Term**: definisi istilah domain yang dipakai di seluruh dokumen

## Requirements

### Requirement 1: <Judul Singkat>

**User Story:** As a [role], I want [goal], so that [benefit].

#### Acceptance Criteria

1. THE [component] SHALL [behavior] WHEN [condition]
2. WHEN [event], THE [component] SHALL [behavior]
3. IF [condition], THEN THE [component] SHALL [behavior]
```

> Acceptance criteria ditulis dalam gaya formal: `SHALL`, `WHEN`, `IF...THEN`, `AND`

### 4. Setelah menulis, tanyakan user
```
📋 requirements.md sudah dibuat/diupdate.

Mohon review:
- Apakah Introduction sudah menggambarkan problem dengan tepat?
- Apakah ada User Story yang missing?
- Apakah acceptance criteria sudah cukup spesifik dan formal?

Jika sudah oke, ketik `/spec-design <nama-spec>` untuk lanjut ke design.
```

### 5. Jika ada revisi
Update file sesuai feedback user, lalu konfirmasi perubahan.

Selalu gunakan bahasa yang sama dengan user.
