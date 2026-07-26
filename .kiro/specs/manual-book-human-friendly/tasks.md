# Tasks

## Fase 1 — Kalibrasi

- [x] T01 Tulis `docs/manual-book/penjualan.md` sesuai template & konvensi
      bahasa di `design.md`. Referensi alur: `docs/modules/sales.md`,
      `docs/tutorials/03-alur-penjualan.md`.
- [x] T02 **Checkpoint**: tampilkan draft ke user untuk review gaya bahasa.
      Jangan lanjut ke Fase 2 sebelum disetujui. — Disetujui user ("looking
      good").

## Fase 2 — Tulis 7 section sisanya

(Baru dikerjakan setelah T02 disetujui, memakai gaya bahasa yang sama)

- [x] T03 Tulis `docs/manual-book/pembelian.md`. Referensi:
      `docs/modules/purchase.md`, `docs/tutorials/04-alur-pembelian.md`.
- [x] T04 Tulis `docs/manual-book/inventory.md`. Referensi:
      `docs/modules/inventory.md`, `docs/tutorials/02-item-variant.md`.
- [x] T05 Tulis `docs/manual-book/keuangan.md`. Referensi:
      `docs/modules/finances.md`.
- [x] T06 Tulis `docs/manual-book/layanan.md`. Referensi:
      `docs/modules/service.md`.
- [x] T07 Tulis `docs/manual-book/helpdesk.md`. Referensi:
      `docs/modules/helpdesk.md` (kecuali bagian integrasi CI/CD deploy).
- [x] T08 Tulis `docs/manual-book/retur.md`. Referensi:
      `docs/tutorials/retur.md`.
- [x] T09 Tulis `docs/manual-book/pengaturan-umum.md`. Referensi:
      `docs/modules/core.md` (Branch, Approval, Penomoran Dokumen, Print
      Template, Dashboard, Tags & Files, Todo, Notification, Email
      Template, Preferences, Company Settings, Command Palette),
      `docs/auth.md` (Roles & Permissions, Workflow Dokumen, Multi-Branch
      Access), `docs/tutorials/01-setup-data-master.md`,
      `docs/tutorials/05-approval-scheme.md`.

## Fase 3 — Rewiring backend

- [x] T10 Update `config/manual_book.php`: ganti `docs_path` ke
      `base_path('docs/manual-book')`, ganti tiap section dari `sources`
      (array) ke `source` (string tunggal), hapus `include_headings` /
      `excluded_heading_patterns` per-section yang sudah tidak dipakai.
- [x] T11 Sederhanakan `ManualBookService`: `renderSection()` baca 1 file
      langsung (hapus logic `implode` multi-source), hapus parameter
      `include_headings`/`excluded_heading_patterns` per-source
      (`extractMarkdown()` → `readMarkdown()`, `filterSections()` →
      `filterExcludedHeadings()` sebagai safety net murni). Pertahankan
      `stripTechnicalNoise()` dan `toHtml()`.
- [x] T12 Cek `tests/Feature/Core/ManualBookControllerTest.php` — semua
      assertion sudah generik (tidak bergantung heading spesifik konten
      lama), tidak perlu diubah. 4 test lulus (67 assertions).

## Fase 4 — Validasi akhir

- [-] T13 **Checkpoint**: test suite terkait sudah lulus (4 test, 67
      assertions) dan Pint sudah dijalankan (`config/manual_book.php`
      diformat ulang). Menunggu user cek tampilan Manual Book di browser
      secara manual (https://erp.test/manual-book) — lingkungan ini tidak
      punya browser automation terpasang untuk verifikasi otomatis.
