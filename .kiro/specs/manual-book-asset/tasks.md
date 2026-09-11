# Tasks

## Fase 1 — Tulis draft & kalibrasi

- [x] T01 Tulis `docs/manual-book/aset.md` sesuai template & konvensi
      bahasa di `design.md` (identik 8 file existing). Referensi alur:
      `.kiro/specs/asset-management-core/requirements.md`,
      `.kiro/specs/asset-management-purchase-integration/requirements.md`,
      `.kiro/specs/asset-management-depreciation/requirements.md`,
      `.kiro/specs/asset-management-movement/requirements.md`,
      `.kiro/specs/asset-maintenance-repair/requirements.md`,
      `.kiro/specs/asset-rental-migration/requirements.md`,
      `.kiro/specs/asset-service-billing/requirements.md`,
      `.kiro/specs/asset-service-internal-order/requirements.md`,
      `.kiro/specs/asset-service-procurement/requirements.md`.
      Cakupan & urutan sub-topik: lihat `design.md` §"Urutan Alur/Tugas
      yang Dicakup". JANGAN salin dari `docs/modules/asset.md` (outdated).
- [x] T02 **Checkpoint**: tampilkan draft ke user untuk review gaya
      bahasa & akurasi alur. Jangan lanjut ke Fase 2 sebelum disetujui.
      — Disetujui user.

## Fase 2 — Revisi layanan.md & rewiring backend

(Baru dikerjakan setelah T02 disetujui)

- [x] T03 Revisi `docs/manual-book/layanan.md`: tambah 1-2 kalimat
      pembuka pointer ke Asset Service (menu Assets → Asset Services)
      untuk servis aset tetap, tanpa menghapus/mengubah konten Work
      Order existing.
- [x] T04 Tambah entry `aset` di `config/manual_book.php` (title,
      description, icon `Boxes`, source `aset.md`), posisi setelah
      `service` sebelum `helpdesk`. Tambahan yang ketauan perlu saat
      verifikasi: `Boxes` didaftarkan ke
      `resources/js/Components/ManualBook/iconMap.js` (belum ada di
      map — tanpa ini ikon section Aset fallback diam-diam ke
      `FileText`).
- [x] T05 Cek `tests/Feature/Core/ManualBookControllerTest.php` — semua
      assertion generik (baca `config('manual_book.sections')` secara
      dinamis, termasuk `test_no_section_leaks_developer_only_details`
      yang meng-iterasi seluruh key). Tidak ada perubahan diperlukan;
      section `aset` otomatis ikut tercakup pengujian.

## Fase 3 — Validasi akhir

- [x] T06 Jalankan test terkait (`php artisan test --compact --filter=ManualBook`)
      via Herd (`php` tidak ada di PATH bash, pakai
      `/c/Users/joim1/.config/herd/bin/php.bat`). Hasil: 4 passed, 75
      assertions (naik dari 67 — `test_no_section_leaks_developer_only_details`
      sekarang ikut memvalidasi `aset.md`).
- [-] T07 **Checkpoint**: konfirmasi ke user test lulus, minta user cek
      tampilan section "Aset" di browser (`/manual-book/aset`) — kartu
      index, TOC, render Mermaid, tombol cetak.
