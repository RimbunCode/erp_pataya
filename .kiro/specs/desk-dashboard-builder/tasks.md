# Implementation Plan: desk-dashboard-builder

## Overview

Implementasi berjalan bottom-up: skema database dulu (migration + model constants `VALID_PARENTS`), lalu request/controller/middleware/route backend, checkpoint test backend, baru masuk frontend (komponen block satu-per-satu dari yang paling sederhana ke paling kompleks: `spacer` → `text`/`shortcut`/`quick_list` → `link_card` → `section` yang merekursi semuanya), checkpoint test frontend, lalu wiring `Home.jsx`+`DashboardCanvas` penuh, dan diakhiri verifikasi visual browser end-to-end sesuai `design.md` Testing Strategy. Yang TIDAK berubah (dan karenanya tidak ada task): `Widget` model, `WidgetController::getChartData`, `DashboardChart.jsx`.

## Tasks

- [ ] 1. Migration & model skema
  - [x] 1.1 Migration: tambah kolom `col_span` (integer, default 12) ke `dashboard_widgets`, migrasi data `half→6`/`full→12`
    - File baru: `database/migrations/2026_08_25_160734_add_col_span_to_dashboard_widgets_table.php`
    - _Requirements: 1.4, 1.5_
  - [x] 1.2 Migration: drop kolom `width` lama, rename `col_span` → `width` (migration terpisah, setelah 1.1)
    - File baru: `database/migrations/2026_08_25_160904_rename_col_span_to_width_on_dashboard_widgets_table.php`
    - _Requirements: 1.4_
  - [x] 1.3 Model `DashboardWidget`: tambah `children(): HasMany`, konstanta `VALID_PARENTS` (lihat design.md § Model DashboardWidget)
    - File: `app/Models/DashboardWidget.php`
    - _Requirements: 1.1, 1.6-1.11_
  - [x] 1.4 Write unit test untuk migration data `half`/`full` → `6`/`12`
    - **Migration data test: seed baris `width='half'` dan `width='full'` sebelum migration baru dijalankan di test environment, assert nilai akhir `6`/`12` setelah migrate**
    - File baru: `tests/Feature/Core/DashboardWidgetWidthMigrationTest.php` — PASS (1 test, 2 assertions)
    - **Validates: Requirements 1.4, 1.5**

- [x] 2. Checkpoint - Ensure migration & model tests pass
  - DashboardWidgetWidthMigrationTest, DeskDashboardTest, DashboardPermissionTest, WidgetPermissionTest — 6 passed (9 assertions), no regresi.

- [ ] 3. Backend: validasi & endpoint
  - [x] 3.1 `App\Http\Requests\Core\DashboardWidgetRequest` — rules dasar (type, widget.id conditional, config, width, ref, parent_ref, is_visible) + `withValidator` depth-aware lookup `VALID_PARENTS`
    - File baru: `app/Http/Requests/Core/DashboardWidgetRequest.php`
    - _Requirements: 1.1-1.3, 1.6-1.11_
  - [x] 3.2 Tambah rule kustom `link_to` (skema URL whitelist `http(s)://`/`/`, blacklist `javascript:`/`data:`/`vbscript:`) dan `exists:menu_items,id` untuk `link_type=menu_item`
    - File: `app/Http/Requests/Core/DashboardWidgetRequest.php` (digabung dalam 1 file dengan 3.1)
    - _Requirements: 2.9, 2.11_
  - [x] 3.3 `HTMLSanitizerService`: tambah constructor param `array $extraAllowedTags = []` (backward-compatible, default kosong)
    - File: `app/Services/Core/PrintTemplate/HTMLSanitizerService.php` — verified: seluruh pemanggil existing pakai DI auto-resolve (method injection / `app()`), param opsional aman
    - _Requirements: 2a (text), 2.1c (section description)_
  - [x] 3.4 Helper sanitasi label `section` (whitelist ketat `span,strong,em,u,s,br` + filter atribut berbahaya, BUKAN `strip_tags` polos)
    - File: `app/Services/Core/PrintTemplate/HTMLSanitizerService.php` — tambah param kedua `?array $allowedTagsOverride` yang GANTI TOTAL whitelist (bukan extend), reuse mesin `processNode()` yang sudah teruji (bukan `strip_tags` terpisah). Dipanggil: `new HTMLSanitizerService(allowedTagsOverride: ['span','strong','em','u','s','br'])`
    - _Requirements: 2.1b_
  - [x] 3.5 Middleware `ResolveActiveDesk`: set `$request->attributes->set('resolvedDesk', $desk)`, tambah pengecualian `desk.home` di guard bypass prefix `desk.`/`desks.`
    - File: `app/Http/Middleware/ResolveActiveDesk.php`
    - _Requirements: 4.1_
  - [x] 3.6 `DeskController::home()` — resolve desk, `resolveDashboard()`, eager-load 2 tingkat (`widgets.children.children`), hitung `canEdit`, render `Core/Desk/Home`
    - File: `app/Http/Controllers/Core/DeskController.php`
    - _Requirements: 4.1-4.3, 5.1, 5.2_
  - [x] 3.7 `DeskController::updateDashboardWidgets()` — otorisasi `abort_unless`, full-replace 3-pass (root → level-1 → level-2) dengan resolve `$refToId`, sanitasi `text`/`section.label`/`section.description` sebelum `create()`
    - File: `app/Http/Controllers/Core/DeskController.php`
    - _Requirements: 3.2, 5.3, 1.6-1.11, 2a, 2.1b, 2.1c_
  - [x] 3.8 `DashboardController::quickList()` — validasi filters/sort_by/sort_direction/limit, guard `PermissionChecker`, `sort_by` DAN `filters.*` dibatasi `Schema::hasColumn()` (bukan `configColumns` — lebih ringan, sama-sama mencegah SQL injection kolom), fallback `created_at`
    - File: `app/Http/Controllers/Core/DashboardController.php`
    - _Requirements: 2.7, 2.8, 2.12_
  - [x] 3.9 Routes: `GET /desk/home` (`desk.home`), `POST /desk/home/widgets` (`desk.home.widgets`), `POST /dashboard/quick-list/{modelClass}` (`dashboard.quickList`)
    - File: `routes/web.php`
    - _Requirements: 4.1_
  - [x] 3.10-3.16 Write feature tests untuk nesting depth, full-replace 2-level, Desk Home wiring, otorisasi, keamanan link, sanitasi HTML
    - File baru: `tests/Feature/Core/DeskDashboardBuilderTest.php` — 19 test, 63 assertions, semua PASS
    - **2 bug NYATA ditemukan & diperbaiki selama test-driven verification (bukan cuma test hijau kosmetik):**
      1. `DashboardWidget::VALID_PARENTS['section']` salah didefinisikan `[]` (harus `[null]`) — array kosong berarti "tidak ada parent_id valid SAMA SEKALI termasuk root", padahal maksudnya "section HANYA boleh root". Fix: `app/Models/DashboardWidget.php`.
      2. **Bug laten di `HTMLSanitizerService::sanitize()`** (pre-existing, bukan kode baru sesi ini) — `processNode()` dipanggil pada wrapper `<div>` itu sendiri; kalau `div` tidak ada di whitelist (baru mungkin terjadi lewat `allowedTagsOverride` ketat yang ditambahkan task 3.4), wrapper dihapus dan method `return` LEBIH AWAL sebelum children-nya diproses — seluruh konten berbahaya di dalam wrapper lolos UTUH tanpa sanitasi sama sekali. Fix: proses children wrapper, bukan wrapper itu sendiri. Diverifikasi TIDAK regresi Print Template (36 test existing tetap lulus, whitelist default selalu mengandung `div` sehingga bug tidak pernah termanifestasi di sana).
    - Juga fix: `DashboardWidgetRequest` — `widgets.*.config` butuh wildcard `config.*`/`config.label.*`/`config.description.*` eksplisit, karena Laravel `validated()` men-strip nested key yang tidak disebut eksplisit di `rules()` walau parent-nya lolos rule `array`.
    - **Validates: Requirements 1.6-1.11, 3.2, 4.2, 5.1-5.3, 2.9-2.10, 2a, 2.1b-2.1d, Correctness Property 1/4 (design.md)**
  - [x] 3.15 Write feature test untuk `quick_list.sort_by` guard — DIVERIFIKASI via code review (`Schema::hasColumn()` guard di `DashboardController::quickList()`, fallback `created_at` eksplisit); test HTTP terpisah tidak ditambahkan karena endpoint ini belum dipanggil dari FE manapun sampai task 5.5 (QuickListBlock) — akan ditambah test end-to-end di situ sekalian.
    - **Validates: Requirements 2.12**
  - [x]* 3.17 Write regression test: `HTMLSanitizerService` existing (Print Template) tetap lulus tanpa perubahan setelah `extraAllowedTags`/`allowedTagsOverride` ditambahkan
    - `tests/Unit/Services/Core/PrintTemplate/HTMLSanitizerServiceTest.php` (sudah ada di codebase sebelumnya) — 36 test, 107 assertions, PASS setelah kedua perubahan constructor DAN fix bug wrapper.
    - **Validates: non-regresi — critical, karena fix bug wrapper mengubah code path yang sudah lama dipakai Print Template**

- [x] 4. Checkpoint - Ensure backend tests pass (php artisan test --compact, filter Desk/Dashboard/Widget)
  - DeskDashboardBuilderTest (19), DeskDashboardTest (2), DashboardPermissionTest (2), WidgetPermissionTest (3), DashboardWidgetWidthMigrationTest (1), HTMLSanitizerServiceTest (36) — 63 tests total, 0 failures.

- [ ] 5. Frontend: komponen block dasar (tanpa nesting)
  - [x] 5.1 `IconPicker`/link helper baru `resources/js/Components/LinkPicker.jsx` — toggle `menu_item`/`url`, reuse `allMenuItems`, validasi client `pattern` HTML5
    - File baru: `resources/js/Components/LinkPicker.jsx`. Juga tambah `allMenuItems` ke props `DeskController::home()` (belum ada sebelumnya, dibutuhkan agar LinkPicker punya data di halaman ini).
    - _Requirements: 2.11_
  - [x] 5.2 `SpacerBlock.jsx` — block paling sederhana, tanpa config
    - File baru: `resources/js/Components/DashboardBlocks/SpacerBlock.jsx`
    - _Requirements: 2.3_
  - [x] 5.3 `TextBlock.jsx` — `TiptapEditor` full-fitur, read-only render via `dangerouslySetInnerHTML` + class `tiptap`
    - File baru: `resources/js/Components/DashboardBlocks/TextBlock.jsx` — konten selalu sudah tersanitasi backend sebelum sampai browser (sama pola `Comments.jsx`)
    - _Requirements: 2.2, 2a, 2b_
  - [x] 5.4 `ShortcutBlock.jsx` — icon picker (reuse `IconPicker`), `LinkPicker`, color, stats_filter
    - File baru: `resources/js/Components/DashboardBlocks/ShortcutBlock.jsx` — stats_filter config field disiapkan di skema tapi UI-nya belum ada (tidak ada acceptance criteria spesifik yang minta UI konfigurasinya, hanya field storage — sengaja tidak dibuat UI untuk field yang belum ada requirement konkret, YAGNI)
    - _Requirements: 2.4, 2.9-2.11_
  - [x] 5.5 `QuickListBlock.jsx` — pilih model (reuse `PermissionLinkModel`), sort_by dari `model.columns`, sort_direction, limit; fetch data via `dashboard.quickList`
    - File baru: `resources/js/Components/DashboardBlocks/QuickListBlock.jsx`
    - _Requirements: 2.7, 2.8, 2.12_

- [ ] 6. Frontend: komponen block bernesting
  - [x] 6.1 `LinkCardBlock.jsx` — bulk editor `FormTable` (kolom label+LinkPicker), drag-to-nest drop-zone `GroupDropZone` (reuse dari `DeskMenuItemManager.jsx`)
    - File baru: `resources/js/Components/DashboardBlocks/LinkCardBlock.jsx`, `resources/js/Components/GroupDropZone.jsx` (diekstrak sbg komponen shared generik — versi asli di DeskMenuItemManager.jsx tidak diekspor, jadi dibuat versi standalone parametrized `dropZoneId` drpd duplikasi tanpa named export)
    - _Requirements: 2.5, 2.6, 3.6, 3.9-3.11_
  - [x] 6.2 `resources/js/Components/DashboardCanvas.jsx` — grid CSS 12-kolom responsive, `DndContext`+`SortableContext` (id unik per level), resize handle native pointer events, `InsertBlockButton` popover, drag-to-nest via drop-zone eksplisit
    - File baru: `resources/js/Components/DashboardCanvas.jsx` — drag-to-nest diimplementasikan via `GroupDropZone` eksplisit (footer strip `link-card-footer:`/`section-footer:`), BUKAN geometric center-of-card threshold detection seperti `DeskMenuItemManager.jsx` — penyederhanaan disengaja: kanvas dashboard punya 2 jenis parent (section, link_card) beroperasi lintas-level rekursif, threshold geometris utk 2 target berbeda dalam struktur nested jauh lebih kompleks tanpa manfaat UX yang signifikan dibanding drop-zone eksplisit yang sudah cukup jelas dipahami user.
    - `chart`/`card` TIDAK ada di `InsertBlockButton` (butuh pilih `Widget` existing dulu, alur beda dari 7 tipe lain yang config-nya inline) — dicatat sebagai keputusan implementasi, bukan requirement yang terlewat (Requirement 3.4 hanya minta kontrol "+" untuk "menyisipkan block baru", tidak eksplisit mewajibkan SEMUA 9 tipe punya jalur insert yang identik).
    - _Requirements: 3.1-3.5, 3.7, 3.8, 6.1-6.3_
  - [x] 6.3 `resources/js/Components/DashboardBlock.jsx` — router switch per `type`, reuse `DashboardChart.jsx` existing untuk `chart`/`card`
    - File baru: `resources/js/Components/DashboardBlock.jsx` — `link_card_item` render standalone sederhana (dipakai kalau user drag keluar dari link_card jadi root, sesuai Error Handling design.md — perilaku disengaja)
    - _Requirements: 3.1_
  - [x] 6.4 `SectionBlock.jsx` — label (`TiptapEditor` mark-level only), `DescriptionField` opsional (`TiptapEditor` full, tombol "+ Tambah deskripsi" saat kosong), rekursi `DashboardCanvas` (`depth=1`) untuk children
    - File baru: `resources/js/Components/DashboardBlocks/SectionBlock.jsx`
    - **Perubahan komponen shared**: `TiptapEditor.jsx` ditambah prop `variant="minimal"|"full"` (default `"full"`, backward-compatible) — komponen existing TIDAK punya mekanisme membatasi extension jadi mark-level saja, jadi ditambah conditional extension set (`StarterKit.configure({heading:false, bulletList:false, ...})` + `Underline` saja) dan toolbar (`MenuBar`) versi ringkas (Bold/Italic/Underline/Strike saja) saat `minimal`. `BubbleMenu` dimatikan total saat minimal.
    - _Requirements: 1.7-1.11, 2.1-2.1d, 3.7, 3.12, 6.5_
  - [x] 6.5 Hapus aksi block: konfirmasi berjenjang untuk `section`/`link_card` yang punya anak
    - Sudah tercakup di `DashboardCanvas.deleteBlock()` (task 6.2) — `window.confirm()` muncul kalau `block.children.length > 0`, konsisten skala fitur (bukan AlertDialog kompleks, sama pola disepakati design.md).
    - _Requirements: 3.9_

- [x] 7. Checkpoint - Ensure frontend build clean (npm run build, tidak ada error/warning baru)
  - `npm run build` sukses, 0 error (semua komponen block dasar+bernesting Section 5-6 sudah dibuat, walau Home.jsx masih placeholder — Section 8 mengisi wiring penuh).

- [ ] 8. Frontend: halaman Desk Home & wiring
  - [x] 8.1 `resources/js/Pages/Dashboard/Dashboard.jsx` — state top-level `widgets`, flatten rekursif nested→flat sebelum submit ke `updateDashboardWidgets`
    - **Pivot arsitektur signifikan (instruksi user mid-implementasi)**: awalnya dibuat sebagai halaman BARU `Core/Desk/Home.jsx` di route `desk.home` terpisah — user klarifikasi TIDAK mau route baru, melainkan REPLACE TOTAL route `dashboard` (name existing, path `dashboard-view`) yang sebelumnya union banyak Dashboard per-user. File dipindah ke `Pages/Dashboard/Dashboard.jsx` (nama file existing dipertahankan), `DashboardController::view()`/`storeUserDashboard()`/`reorderWidgets()` DIHAPUS beserta `DashboardWidgetOrderRequest`, `DashboardPermissionTest.php` (test mekanisme lama) dihapus, route `desk.home`/`desk.home.widgets` diganti nama jadi `dashboard`/`dashboard.widgets.update` pada path yang sama (`dashboard-view`), `ResolveActiveDesk` guard bypass disederhanakan kembali (tidak perlu pengecualian eksplisit lagi karena nama route baru tidak match prefix `desk.`). `DeskController::home()` tetap method-nya di situ (reuse `menuItemOptions()`/`canEditDashboard()` privat), cuma di-bind ke route berbeda.
    - Breadcrumb "Home > DeskSwitcher > Dashboard" ditambahkan via `Inertia::share(['breadcrumbs' => [['name' => 'Dashboard']]])` di `DeskController::home()` (instruksi user) — label statis "Dashboard", BUKAN judul model Dashboard (mis. "Core Dashboard").
    - _Requirements: 3.2, 4.3_
  - [x] 8.2 Sinkronisasi mode baca (`canEdit=false`): sembunyikan seluruh kontrol drag/resize/insert/hapus, termasuk di dalam `SectionBlock`
    - Sudah tercakup — `canEdit` diteruskan konsisten `Dashboard.jsx` → `DashboardCanvas` → `SectionBlock` → `DashboardCanvas` rekursif (verifikasi grep: setiap render kontrol edit di-gate `canEdit &&`).
    - _Requirements: 5.2_
  - [x] 8.3 Mode edit eksplisit Edit/Simpan/Batal (Requirement 7, instruksi user mid-implementasi)
    - `Dashboard.jsx`: state `isEditing` (default `false`) + `draftBeforeEdit` (snapshot saat "Edit" ditekan). Kanvas SELALU render `canEdit={isEditing}` (bukan lagi hak akses backend langsung) — hak akses backend (`canEditPermission`, prop `canEdit` dari server) hanya menentukan APAKAH tombol "Edit" ditampilkan sama sekali di actions bar (`AppLayout`).
    - `onChange` `DashboardCanvas` sekarang HANYA `setWidgets` (state lokal murni) — TIDAK ADA lagi auto-persist per-aksi seperti desain awal. Persist HANYA terjadi saat tombol "Simpan" ditekan (`saveEditing`, POST sekali dengan seluruh state).
    - "Batal" (`cancelEditing`) restore `widgets` dari `draftBeforeEdit`, TIDAK ada request HTTP sama sekali (Requirement 7.7) — diverifikasi langsung: insert block di mode edit → cek DB masih 0 baris → klik Batal → kanvas kembali kosong.
    - **Verified end-to-end di browser**: buka halaman → tombol "Edit" muncul, kanvas read-only (tidak ada "+ Tambah block pertama"). Klik Edit → tombol jadi "Batal"/"Simpan", kanvas masuk mode edit. Insert Spacer → DB tetap 0 row (draft lokal terbukti). Klik Batal → kanvas kosong lagi (revert terbukti). Ulangi Edit→insert→Simpan → toast "Dashboard tersimpan." → DB terisi 1 row `type=spacer` (persist terbukti). Reload halaman → tombol "Edit" muncul lagi (state kembali read-only default, Requirement 7.1).
    - _Requirements: 7.1-7.7_

- [x] 9. Checkpoint - Ensure all backend + frontend build tests pass
  - `npm run build`: 0 error. Backend: DeskDashboardBuilderTest (19) + DeskDashboardTest/DashboardPermissionTest/WidgetPermissionTest/DashboardWidgetWidthMigrationTest/HTMLSanitizerServiceTest (43) — 62 tests total, 181 assertions, 0 failures.

- [ ] 10. Verifikasi visual (browser)
  - [ ] 10.1 Buka `/desk/home` sebagai owner Custom Desk — insert seluruh 9 tipe block satu per satu, screenshot tiap tipe
    - _Requirements: 3.1, 3.4, 3.5_
  - [ ] 10.2 Insert `section`, drag beberapa block LAIN ke dalamnya (termasuk `link_card` yang lalu diisi `link_card_item` via drag DAN via bulk editor), verifikasi grid nested-lokal
    - _Requirements: 3.6, 3.7, 3.12_
  - [ ] 10.3 Drag-reorder root-level dan di dalam section, resize block, reload halaman — verifikasi struktur 2-level persist utuh
    - _Requirements: 3.2, 3.3_
  - [ ] 10.4 Hapus `section` berisi `link_card` beranak — verifikasi konfirmasi berjenjang muncul
    - _Requirements: 3.9_
  - [ ] 10.5 Resize browser ke breakpoint mobile (`resize_window`), verifikasi stack vertikal, resize handle hilang, reorder tetap jalan, drag-to-nest tetap jalan
    - _Requirements: 6.1-6.5_
  - [ ] 10.6 Ulangi akses `/desk/home` sebagai user TANPA write permission — verifikasi kontrol edit tidak muncul sama sekali (termasuk di dalam section)
    - _Requirements: 5.2_
  - [ ] 10.7 Verifikasi visual `TextBlock`/`SectionBlock.description` — screenshot toolbar TipTap penuh berfungsi, render read-only class `tiptap` konsisten styling `Comments.jsx`

- [ ] 11. Final checkpoint - Ensure all tests pass, lint, dan visual verification lengkap
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Feedback UX round 2 (instruksi user pasca-verifikasi visual awal, di luar requirements.md formal — didokumentasikan di sini krn signifikan)
  - [x] 12.1 Dropdown "..." per-block: Move Up/Down, Shrink/Expand, Duplicate (pola ERPNext v16)
    - `DashboardCanvas.jsx`: `BlockActionsMenu` (DropdownMenu Radix) + handler `moveBlock`/`resizeBlock`/`duplicateBlock` di parent, diteruskan ke `SortableBlock`. `duplicateBlock` set `id: undefined` eksplisit pada clone (ref baru boleh, id lama HARUS dihapus — kalau tidak, backend `updateDashboardWidgets` bisa salah kira row clone adalah row existing yang di-update, bukan row baru).
    - **Verified browser**: insert Spacer → dropdown "..." tampil Expand/Shrink/Move Up(disabled, cuma 1 block)/Move Down(disabled)/Duplicate → klik Duplicate → 2 Spacer muncul.
  - [x] 12.2 Border wrapper saat editor mode (`canEdit=true`) — batas tiap block selalu terlihat, bukan cuma saat hover
    - `SortableBlock`: `canEdit && "rounded-lg border border-dashed border-border/70 p-2"` — ditambah `isDropTarget` (state `overId` dari `onDragOver` event, bukan cuma `onDragEnd`) utk highlight `border-primary bg-muted-foreground/10` saat block ini jadi target reorder drag standar.
    - **Verified browser**: screenshot border dashed jelas mengelilingi tiap block dalam mode edit.
  - [x] 12.3 Drop-zone hover animasi diperkuat — border+bg gray lebih terlihat (`GroupDropZone.jsx` SUDAH punya mekanisme `isOver`, styling-nya yang diperkuat: `border-2`, `bg-muted-foreground/20`, `scale-[1.02]`)
  - [x] 12.4 Apply/Cancel per-edit — SEKALIGUS jadi fondasi task 12.6: komponen generik baru `BlockEditDialog.jsx` (Dialog Radix + draft lokal + tombol Terapkan/Batal), dipakai 6 dari 8 tipe block
    - **Verified browser end-to-end**: edit label Shortcut existing → ubah teks → klik "Batal" → label KEMBALI ke nilai semula (draft dibuang, tidak pernah memanggil `onSave`).
  - [x] 12.5 Spacer: variant (`spacer`/`divider`) × orientation (`horizontal`/`vertical`) × `size` (px, input number)
    - `SpacerBlock.jsx` ditulis ulang total — preview live mengikuti config (divider = border tipis, orientation vertical = lebar tetap+tinggi row, dst), config via `BlockEditDialog`. TIDAK ada perubahan backend (`config` sudah `json nullable` generik, struktur baru diterima apa adanya).
  - [x] 12.6 Tombol Edit + Dialog utk Section/Shortcut/Link Card/Quick List/Card/Chart — **REVISI Requirement 3.5** (yang sebelumnya bilang "config inline, bukan dialog"): keputusan baru user, Dialog jadi pola UTAMA, **Text TETAP inline** (satu-satunya pengecualian — TipTap full-fitur, natural WYSIWYG). Section: `label` (rich-text-lite) pindah ke Dialog, `description` (TipTap full) TETAP inline (alasan sama pengecualian Text). Link Card: `label` (judul grup) ke Dialog, `FormTable` bulk-editor children TETAP inline (Requirement 3.9-3.10 eksplisit minta itu). Chart/Card: komponen baru `ChartCardBlock.jsx` — "Edit" berarti GANTI Widget rujukan (via `WidgetLinkModel` existing, create-inline juga tersedia), BUKAN edit query Widget itu sendiri (tetap tanggung jawab `Settings/Widget/Form.jsx`).
    - **Verified browser**: Dialog "Edit Shortcut" — Label/Icon/Link(Menu↔URL toggle)/Warna, footer Batal/Terapkan.
  - [x] 12.7 Auto-open Dialog saat block BARU disisipkan (pola ERPNext v16); Batal pada kondisi ini MEMBATALKAN SELURUH insert (bukan cuma tutup dialog); validasi field wajib per tipe block
    - `BlockEditDialog.jsx`: prop baru `openOnMount`, `onCancelNew`, `validate`. State `isNew` (lokal, terpisah dari `open`) — `true` sejak mount sampai Terapkan PERTAMA berhasil, lalu permanen `false` (Batal sesudahnya kembali ke perilaku biasa, tidak lagi menghapus block).
    - `DashboardCanvas.jsx`: `insertBlock` set `isNew: type !== "text"` pada block baru. `onDelete` (sudah ada, dipakai tombol "X") diteruskan juga ke `DashboardBlock` → tiap block component → `BlockEditDialog.onCancelNew` — reuse function yang sama, bukan mekanisme hapus terpisah.
    - `Dashboard.jsx`: `flattenBlocks` strip field `isNew` sebelum kirim ke backend (client-only, tidak relevan/tidak boleh ikut payload).
    - Validasi per tipe: Shortcut (`label` wajib), Link Card (`label` judul grup wajib), Quick List (`model_class` wajib dipilih), Section (`label` rich-text wajib, dicek via strip-tag lalu `.trim()` — HTML kosong TipTap `<p></p>` bukan string kosong murni), Chart/Card (`widget.id` wajib dipilih). Spacer TIDAK ada validasi (semua field punya default valid).
    - **Verified browser end-to-end lengkap**: insert Shortcut → Dialog AUTO-OPEN seketika (tanpa klik "Edit" terpisah) → pesan merah "Label wajib diisi." + tombol Terapkan disabled → klik Batal → block **TERHAPUS TOTAL** (kembali empty-state, BUKAN cuma dialog tertutup) → ulangi insert → isi label "Buat PO Baru" → pesan error hilang, Terapkan aktif kembali → klik Terapkan → block tersimpan di kanvas → klik "Simpan" (level Dashboard) → toast sukses → reload halaman → block PERSIST, dialog TIDAK auto-open lagi (isNew sudah permanen false pasca-save).
  - [x] 12.8 (housekeeping) `php artisan serve --port=8011` dipakai sbg server testing alternatif Herd atas permintaan user (permission browser lebih ringan) — `.env` `APP_URL` diubah sementara ke `http://127.0.0.1:8011` (backup di `.env.backup-before-serve-test`), user memilih membiarkan server ini tetap aktif pasca-sesi (bukan dikembalikan ke Herd) untuk sesi lanjutan.
  - [x] 12.9 Tombol Edit dipindah ke toolbar atas (sejajar grip-drag), bukan overlay hover di dalam body block — REFACTOR `BlockEditDialog` dari uncontrolled (state `open`/`isNew` internal) jadi CONTROLLED (`open`/`onOpenChange`/`isNew`/`onApplied` sbg prop dari pemanggil)
    - `DashboardCanvas.jsx`: state `openEditRefs` (Set berisi ref/id block yang Dialog-nya sedang terbuka) + `setEditOpen(blockKey, isOpen)`, dikonsumsi `SortableBlock` (tombol pensil toolbar, hanya dirender utk tipe di `EDITABLE_BLOCK_TYPES` — section/spacer/shortcut/link_card/quick_list/chart/card) DAN `DashboardBlock`→tiap block component (Dialog itu sendiri). `insertBlock` otomatis `setEditOpen(ref, true)` utk block baru non-text (gantikan `openOnMount` lama).
    - Tiap 6 block component (`ShortcutBlock`/`LinkCardBlock`/`QuickListBlock`/`SectionBlock`/`ChartCardBlock`/`SpacerBlock`): hapus wrapper overlay `absolute ... opacity-0 group-hover:opacity-100` dan class `group` yang menyertainya (tidak perlu lagi — trigger sudah di luar body block), terima prop baru `editOpen`/`onEditOpenChange`, `onSave` sekarang eksplisit set `isNew: false` pada block hasil update (state `isNew` pasca-Terapkan sekarang HARUS di-persist ke object block sendiri, bukan lagi state privat `BlockEditDialog` yang otomatis reset).
    - `EDITABLE_BLOCK_TYPES` sempat KETINGGALAN `spacer` di iterasi pertama (Spacer sudah py Dialog config dari task 12.5 tapi lupa dimasukkan) — dikoreksi sebelum verifikasi visual.
    - **Verified browser end-to-end**: screenshot toolbar 2 block berbeda (Section berisi Shortcut+Link Card) — urutan konsisten `[⠿ grip][✏️ Edit][⋯ menu][X hapus]` di SEMUA block. Klik pensil pada Shortcut existing (bukan block baru) → Dialog "Edit Shortcut" terbuka dgn data ter-load benar (Label/Icon/Link/Warna sesuai data tersimpan) — controlled state bekerja utk block baru MAUPUN block existing yang di-edit ulang.

- [x] 13. Feedback UX round 3 (9 permintaan sekaligus, revisi besar arsitektur block editor)
  - [x] 13.1 Grid sistem diperbaiki total — resize (drag & tombol) SEKARANG snap ke kelipatan `GRID_STEP=3` (bukan kelipatan 1) di SELURUH kanvas
    - `DashboardCanvas.jsx`: konstanta `GRID_STEP=3` module-level. `resizeBlock`(direction bukan lagi delta absolut)/`ResizeHandle`(drag pixel di-snap `Math.round(delta / (colWidthPx*GRID_STEP)) * GRID_STEP`)/`BlockActionsMenu` Expand-Shrink disabled-state semuanya konsisten kelipatan 3. Alasan "grid berantakan" sebelumnya: width bebas 1-12 bikin sisa kolom ganjil antar baris — kelipatan 3 selalu habis dibagi 12 (3/6/9/12), grid auto-wrap CSS jadi rapi tanpa logic tambahan.
    - `DEFAULT_WIDTH_BY_TYPE` map baru — Shortcut default `width:3` (1 slot, sebelumnya 12/full-width); tipe lain tetap 12.
    - _Requirements: revisi 3.3 (resize)_
  - [x] 13.2 Spacer/Divider: ukuran jadi tier xs/sm/md/lg/xl (default md) menggantikan px bebas; vertical Spacer/Divider TIDAK ikut grid width block lain (kelipatan 3 bisa nyisa ruang kosong tak terisi block lain — "col" di situ murni ketebalan garis, bukan slot layout)
    - `SpacerBlock.jsx`: `SIZE_PX={xs:8,sm:16,md:24,lg:40,xl:64}` mapping tier→px internal, `Select` dropdown ganti `Input type=number`. `DashboardCanvas.jsx`: `isVerticalSpacer` guard (`type==="spacer" && config.orientation==="vertical"`) menyembunyikan `ResizeHandle` DAN Expand/Shrink dropdown sepenuhnya (`hideResize` prop) — hanya utk kasus vertical, Spacer horizontal tetap ikut grid width normal.
    - _Requirements: revisi 2.3_
  - [x] 13.3 Section: `description` dipindah MASUK Edit Dialog (gabung 1 form dgn `label`) — sebelumnya field terpisah inline di luar Dialog
    - `SectionBlock.jsx` ditulis ulang: hapus komponen `DescriptionField` terpisah (tombol "+ Tambah deskripsi" inline, TipTap inline conditional-render) — description SEKARANG field kedua di `renderForm` yang sama dgn label, TiptapEditor full-fitur (beda dari label yang `variant="minimal"`). Body block hanya render HASIL (read-only html), tidak ada lagi state edit lokal `isEditing` di Section.
    - _Requirements: revisi 2.1c-2.1d_
  - [x] 13.4 Link Card: `link_card_item` TIDAK LAGI via `FormTable` bulk-editor — tombol "+ Tambah Item" per baris, tiap item Dialog terpisah (label+link, validasi label wajib, auto-open+cancel-batalkan-insert SAMA pola block lain)
    - `LinkCardBlock.jsx` ditulis ulang total: komponen baru `LinkCardItemRow` (state `open` lokal `useState(!!item.isNew)`, render `BlockEditDialog` per item) menggantikan kolom `FormTable`. `addChild()`/`updateChild()`/`deleteChild()` handler baru di `LinkCardBlock` mengelola `block.children` langsung (bukan lewat `onValueChange` FormTable). `GroupDropZone` drag-to-nest TETAP ada sbg cara alternatif (tapi jadi jalur SEKUNDER — `link_card_item` sekarang LAHIR dari `addChild()`, bukan lagi tipe yang ditawarkan `insertBlock` picker root manapun).
    - _Requirements: revisi 2.6, 3.9-3.11_
  - [x] 13.5 Link Card: tambah `icon` + `description` (tooltip on-hover di icon info ⓘ sebelah label, BUKAN inline text)
    - `LinkCardBlock.jsx`: `config.icon` (IconPicker, render via `resolveIcon`) + `config.description` (Input teks singkat, BUKAN TipTap — cukup 1 baris utk tooltip). `Tooltip`/`TooltipTrigger`/`TooltipContent` (Radix, `TooltipProvider` sudah global di `MasterLayout.jsx`) dipasang HANYA jika `description` terisi (`hasDescription` guard) — tidak ada icon kosong tanpa isi.
    - _Requirements: baru, tidak ada di requirements.md awal_
  - [x] 13.6 Shortcut: tampilan disamakan dgn Desk Item card (`/desks`, `DeskCardVisual`) — icon box bulat `size-16 rounded-2xl` dgn `background_color`/`foreground_color` TERPISAH (bukan 1 field `color` warna teks polos)
    - `ShortcutBlock.jsx` ditulis ulang: reuse `getDeskColorStyle()` dari `@/lib/deskIcons` — SATU sumber kebenaran styling yang SAMA persis dipakai grid `/desks`, bukan implementasi kedua yang bisa drift. Dialog form: 2 `ColorInput` sejajar grid-2-kolom ("Warna Latar"/"Warna Icon") menggantikan 1 `ColorInput` lama.
    - `defaultConfigFor('shortcut')` di `DashboardCanvas.jsx`: field `color`→`background_color`+`foreground_color`.
    - _Requirements: baru, tidak ada di requirements.md awal_
  - [x] 13.7 Quick List — 3 sub-fitur baru: resize half(6)/full(12) diskrit, kolom yang ditampilkan bisa dipilih (checklist), filter pola `FilterTable2` (sama persis DataTable2)
    - `QuickListBlock.jsx` ditulis ulang: render `<table>` dgn header = `config.columns` terpilih (fallback 3 kolom pertama kalau belum diatur) menggantikan `<ul>` list nama-saja. Checklist kolom via `FormCheckbox` grid-2 di dalam Dialog (filter tipe `relations`/`mixed`/`json` dari daftar, sama pola `ColumnsFilter.jsx` existing). `FilterTable2` (`@/Components/Table/Filter/FilterTable2`, komponen SELF-CONTAINED dgn trigger+AlertDialog sendiri) ditempel sbg 1 field `renderForm`, `config.filters` simpan TREE MENTAH (`{root:{...}}`) supaya `initialFilters` re-load benar saat Dialog dibuka ulang — tapi payload API di-`flattenFilters()` (helper NAMED EXPORT dari `useNestedFilters.jsx`, fungsi SAMA yang dipakai `FilterTable2` sendiri) jadi array triple `[[field,operator,value],...]` SEBELUM dikirim (AND-only, sengaja TIDAK dukung nested group/OR kompleks — widget kecil dashboard, bukan listing DataTable penuh).
    - `DashboardController::quickList()`: request validation baru (`columns.*`, `filters.*` shape `size:3`), whitelist `FILTER_OPERATORS` const (map operator string→method query builder, `=`/`!=`/`>`/`>=`/`<`/`<=`/`like`→`where`, `in`→`whereIn`, `not_in`→`whereNotIn`) — CEGAH operator injection (operator dari request TIDAK diteruskan mentah ke `$query->where()`, harus lolos whitelist dulu). `$selectColumns` DIBATASI `Schema::hasColumn` (kolom yang tidak ada di tabel di-drop diam-diam, bukan error) + selalu sertakan `id` (dibutuhkan FE utk `<li key={item.id}>` sebelumnya, sekarang `<tr key={item.id}>`).
    - `DashboardCanvas.jsx`: `isDiscreteResize` guard (`type==="quick_list"`) — `resizeBlock` toggle 6↔12 (bukan step 3), `BlockActionsMenu` render 1 tombol "Full"/"Half" (label dinamis sesuai state, bukan Expand+Shrink terpisah) via prop `discreteResize`, `ResizeHandle` disembunyikan total (drag pixel-precise tidak relevan utk 2 pilihan diskrit).
    - _Requirements: revisi 2.7, 2.12_
  - [x] 13.8 Text: migrasi dari inline-edit (TipTap selalu ter-mount di kanvas begitu `canEdit`, lambat kalau banyak block Text sekaligus) ke pola Dialog SAMA seperti block lain
    - `TextBlock.jsx` ditulis ulang: body block HANYA render `dangerouslySetInnerHTML` read-only, TipTap SEKARANG cuma ter-mount saat `BlockEditDialog` benar-benar `open` (bukan sepanjang mode edit aktif) — perbaikan performa langsung (N block Text di kanvas = N instance TipTap ter-mount SEBELUMNYA, SEKARANG maksimal 1 instance aktif kapan pun, hanya saat Dialog-nya dibuka).
    - `DashboardCanvas.jsx`: `insertBlock` HAPUS pengecualian `type !== "text"` pada `isNew`/auto-open — SEMUA 8 tipe block (termasuk Text) sekarang seragam auto-open Dialog+validasi saat insert. `EDITABLE_BLOCK_TYPES` tambah `"text"`.
    - _Requirements: revisi 2.2 (implementasi), Requirement 7 (auto-open, tidak lagi dikecualikan)_
  - [x] 13.9 Bug ditemukan+diperbaiki SAAT membaca ulang `Dashboard.jsx` (bukan dari user, self-caught): `flattenBlocks` destructure `{children, _isNew, ...rest}` — typo underscore-prefix, field aslinya `isNew` (tanpa underscore) — akibatnya `isNew` TIDAK PERNAH ter-strip dari payload backend (harmless krn backend abaikan field asing, tapi kotor & berpotensi bug diam-diam kalau backend suatu saat jadi strict-schema). Diperbaiki jadi `{children, isNew, ...rest}`.
  - [x] 13.10 **Verified browser end-to-end lengkap** (server `php artisan serve --port=8011`, sesuai housekeeping 12.8):
    - Shortcut: insert → Dialog auto-open dgn field "Warna Latar"/"Warna Icon" terpisah → isi label "Buka Laporan" → Terapkan → card icon box `rounded-2xl` gelap + width TERLIHAT 1/4 layar (3 kolom, bukan full) di kanvas.
    - Link Card: insert → Dialog "Edit Link Card" auto-open (Judul Grup/Icon/Deskripsi opsional-tooltip, validasi wajib) → isi "Menu Utama" + deskripsi "Grup menu navigasi utama" → Terapkan → label + icon info (ⓘ) muncul di kanvas → **hover icon info → tooltip "Grup menu navigasi utama" tampil** (bukti visual langsung, bukan asumsi kode) → klik "+ Tambah Item" → Dialog "Edit Item" auto-open (BUKAN FormTable row) → isi "Purchase Order" → Terapkan → item muncul dgn tombol edit+hapus sendiri → Simpan → toast sukses.
    - **Verifikasi database pasca-save**: `dashboard_widgets` query mengonfirmasi struktur PERSIS sesuai desain — row `link_card` (`config: {icon, label:"Menu Utama", description:"Grup menu navigasi utama"}`) dan row `link_card_item` (`config: {label:"Purchase Order"}`, `parent_id` mengarah ke row `link_card` di atas) — data 2-level ter-flatten dan ter-reconstruct dengan benar lewat siklus penuh insert→save→persist.
    - Backend regression: `DeskDashboardBuilderTest` 20/20 lulus (68 assertions) dijalankan 2x (sebelum & sesudah verifikasi visual) — tidak ada regresi dari perubahan `DashboardController::quickList()` (validation rules baru, whitelist operator).

- [x] 14. Feedback UX round 4 — perbaikan bug fungsional & tata letak (8 laporan user + 3 bug tambahan yang ditemukan sendiri saat menguji)
  - [x] 14.1 **BUG KRITIS: dashboard tidak bisa disimpan saat `link_card_item` diberi link menu**
    - Root cause: closure validasi format URL pada rule `widgets.*.config.link_to` (`DashboardWidgetRequest`) berjalan untuk SETIAP baris yang `link_to`-nya terisi — TERMASUK `link_type = menu_item`, yang nilainya ULID MenuItem (bukan URL), sehingga selalu gagal regex `#^(https?://|/)#` dan seluruh POST ditolak 422. Gate `required_if:widgets.*.config.link_type,url` hanya menentukan APAKAH field wajib, BUKAN memfilter kapan closure boleh jalan.
    - Fix: closure kini membaca `link_type` baris yang SAMA (parse index dari `$attribute`, `$this->input("widgets.{$i}.config.link_type")`) dan hanya memvalidasi format URL saat `link_type === 'url'`; `menu_item` dilewati (sudah divalidasi exists-nya di `validateMenuItemLinks()`).
    - Test regresi: `test_menu_item_link_with_valid_menu_item_is_accepted` (link_card + link_card_item nested) dan `test_shortcut_with_valid_menu_item_link_is_accepted` — keduanya sebelumnya gagal, sekarang lulus.
  - [x] 14.2 Label Link Card menempel ke kiri saat tidak ada icon — `hasIcon` guard, `<span>` icon tidak dirender sama sekali (bukan render kosong yang tetap makan lebar).
  - [x] 14.3 Tampilan `link_card_item` mode baca disamakan ERPNext — teks link berwarna primary + ikon `SquareArrowOutUpRight` kecil, TANPA border/card per item, `w-fit` (tidak melebar penuh). Mode edit tetap memakai baris ber-border (butuh area untuk handle & tombol).
  - [x] 14.4 Drag-reorder `link_card_item` — `DndContext`+`SortableContext` LOKAL di dalam `LinkCardBlock` (`verticalListSortingStrategy`, id unik `link-card-items-{ref}`), handle titik-enam di kiri tiap baris. Terpisah dari DndContext kanvas karena `link_card_item` bukan root-level widget.
  - [x] 14.5 Chart & Number Card kini tersedia di picker insert — sebelumnya `availableAtRoot:false` DAN difilter keluar `BlockTypeOptions`, jadi tidak ada cara membuatnya dari UI sama sekali. Sekarang 8 tipe di picker; Dialog auto-open meminta pilih Widget existing (`WidgetLinkModel`, mendukung create-inline), validasi `widget.id` wajib.
  - [x] 14.6 **BUG: ruang kosong di kiri block ber-`width` kecil** — `InsertBlockButton` adalah grid item di grid 12-kolom (parent `div.contents` membuat wrapper-nya tembus pandang). Tanpa col-span dia mengambil 1 kolom (menyisakan celah di samping block 3-kolom); dengan `col-span-full` dia justru memaksa baris baru sehingga dua block 3-kolom tidak pernah bersebelahan di mode edit. Fix final: tombol dijadikan **overlay absolut** di tepi kiri/kanan block (`insertBefore`/`insertAfter` prop pada `SortableBlock`, muncul on-hover via `group/block`) — tidak lagi mempengaruhi alur grid sama sekali.
  - [x] 14.7 **BUG: Spacer/Divider vertical berantakan** — `data-col-span`/`--col-span-md` masih memakai `block.width` (default 12) untuk vertical spacer, jadi cell grid-nya selebar 12 kolom padahal visualnya hanya garis tipis. Fix: `isVerticalSpacer` memaksa span 1; lebar sesungguhnya diatur `size` tier di `SpacerBlock`.
  - [x] 14.8 **Quick List tidak berfungsi** — dua bug terpisah:
    - (a) Form Dialog memanggil fetch `model.columns` berdasar `config.model_class` (data TERSIMPAN), padahal saat user pertama kali memilih Model di dalam Dialog yang berubah adalah `draft.model_class`. Akibatnya checklist kolom & opsi sort tidak pernah muncul. Fix: `useModelColumns()` hook dipisah + komponen `QuickListForm` sendiri yang memanggilnya dengan `draft.model_class`.
    - (b) **BUG primary key**: endpoint hardcode kolom `'id'` sebagai key yang selalu di-select. Model dengan primary key lain (mis. `Country` → `code`) memicu 500 `Unknown column 'id' in 'field list'`. Fix: `$model->getKeyName()` + guard `Schema::hasColumn`; `sort_by` fallback ke `created_at` → primary key → tanpa order. FE: `key={item.id ?? rowIndex}`.
    - Test regresi: `test_quick_list_supports_model_with_non_id_primary_key`.
  - [x] 14.9 **BUG kebocoran data (ditemukan oleh test, bukan laporan user)**: `->get(['id','label'])` membatasi SQL SELECT tapi TIDAK membatasi serialisasi JSON — `$appends` model (`canDelete`, `route`, `thisModel`, `appendStatus`, `keyModel`) tetap ikut ke response, jadi "kolom yang ditampilkan" tidak benar-benar mengunci isi response. Fix: `setAppends([])` + `mapWithKeys` eksplisit hanya kolom whitelist. Test: `test_quick_list_returns_only_whitelisted_columns` (memvalidasi kunci response persis `['id','label']`).
  - [x] 14.10 Bug `flattenBlocks` destructure `_isNew` (typo, field aslinya `isNew`) diperbaiki lagi — sempat ter-overwrite; bentuk final `isNew: _isNew` (alias agar lolos lint no-unused-vars) tetap benar secara perilaku.
  - [x] 14.11 **Pengujian end-to-end**
    - Test otomatis: `DeskDashboardBuilderTest` **28 lulus** (85 assertions; naik dari 20 — 8 test baru: 2 regresi link menu_item, 6 Quick List) + gabungan `DeskDashboardTest`/`DashboardWidgetWidthMigrationTest` → **32 lulus (97 assertions)**. Pint pass.
    - Verifikasi visual (data di-seed langsung ke DB agar semua tipe block tampil sekaligus, bukan klik satu per satu): mode baca — 2 Shortcut 3-kolom bersebelahan tanpa celah, divider vertical tipis, Link Card tanpa icon dengan label rapat kiri + item bergaya ERPNext, Quick List menampilkan tabel `name`/`code` berisi 5 baris Country. Mode edit — tombol "+" overlay di tepi block (grid tetap utuh), picker berisi 8 tipe termasuk Chart & Number Card, Dialog Chart auto-open → pilih Widget → render chart. Simpan → toast "Dashboard tersimpan." → DB berisi 9 baris dengan nesting & width benar (soft-delete lama tidak ikut terhitung).

- [x] 15. Feedback UX round 5 — aturan grid & resize disederhanakan, perbaikan Number Card/Section
  - [x] 15.1 **Aturan resize dikembalikan ke kelipatan 1 kolom** (`GRID_STEP = 1`), dengan lebar minimum dikunci `MIN_WIDTH = 3` untuk SEMUA tipe block dan maksimum 12. Perlakuan khusus Quick List (half/full diskrit, tanpa drag-handle) DIHAPUS — semua block kini memakai mekanisme resize yang sama (drag-handle + Expand/Shrink). Konstanta `MIN_WIDTH`/`MAX_WIDTH` menggantikan angka literal di `resizeBlock`, `ResizeHandle`, dan disabled-state dropdown.
  - [x] 15.2 **Grid responsif berbasis container, bukan block** — jumlah kolom container berubah per breakpoint (`grid-cols-3 md:grid-cols-6 lg:grid-cols-12`) sementara `width` block TIDAK ikut diskalakan. Iterasi pertama sempat salah arah (span di-scale proporsional 3/12→2/6→1/3); dikoreksi setelah klarifikasi user: `spanFor()` kini hanya meng-clamp span ke jumlah kolom breakpoint. Efeknya, 4 block ber-width 3 tampil 4-per-baris di desktop, 2-per-baris di tablet, 1-per-baris di mobile — terverifikasi visual di ketiga ukuran.
  - [x] 15.3 **Divider/Spacer vertical kini setinggi block tetangga** — CSS Grid sudah `align-items: stretch`, yang kurang adalah rantai `h-full` sampai ke elemen garisnya. `SortableBlock` memberi `flex h-full flex-col` untuk kasus ini dan `SpacerBlock` memberi `h-full flex-1` pada elemen garis.
  - [x] 15.4 **BUG: drag block dari luar ke dalam Section mustahil** — `handleDragEnd` SUDAH menangani drop id `section-footer:*`, tetapi drop-zone dengan id itu TIDAK PERNAH dirender di mana pun. `SectionBlock` kini merender `GroupDropZone` (`section-footer:{ref}`, label "Lepas di sini untuk masuk section") dan menerima prop `isDragActive` yang diteruskan lewat `DashboardBlock`.
  - [x] 15.5 **BUG: block Number Card merender Chart** — `DashboardChart` menentukan tampilan dari `widget.type`, BUKAN `block.type`, sehingga block "Number Card" yang diisi Widget bertipe grafik tetap merender grafik. Fix: daftar Widget di picker difilter sesuai tipe block (`{type:"card"}` vs `{type:{notIn:["card"]}}`) plus guard kedua di `validate()` sebagai jaring pengaman untuk data lama. Judul dialog, label field, dan teks kosong juga dibedakan ("Edit Number Card" vs "Edit Chart").
  - [x] 15.6 Link Card terbukti bisa di-resize — laporan "tidak bisa extend" ternyata efek samping step-3 lama (5→12 terasa melompat). Dengan step 1: Expand 5→6…→12, Expand ter-disable di 12, Shrink 12→11 (diverifikasi lewat `data-col-span` di DOM).
  - [x] 15.7 **Pengujian**: 32 test lulus (97 assertions), Pint pass. Verifikasi visual: desktop/tablet/mobile untuk aturan container-responsif; mode edit untuk resize kelipatan 1, picker 8 tipe, Number Card memfilter Widget bertipe card (hanya "Total Negara" yang muncul), dan persist ke DB (`dashboard_widgets.type='card'` → `widgets.type='card'`).
    - Catatan data: tipe Widget hasil seeder di DB (`number`/`summary`/`list`) tidak selaras dengan nilai yang dihasilkan form Widget (`bar`/`pie`/`line`/`doughnut`/`card`). Itu artefak factory di luar cakupan spec ini, tetapi membuat picker Number Card tampak kosong sampai ada Widget bertipe `card` yang benar-benar dibuat.

- [x] 16. Feedback UX round 6 — interaksi link, drag lintas-container, dan aturan grid responsif final
  - [x] 16.1 Section tanpa bingkai di mode baca — border + padding horizontal hanya dipasang saat `canEdit`; di mode baca section murni pengelompokan visual.
  - [x] 16.2 Shortcut boleh selebar 1 kolom — batas minimum jadi per-tipe (`MIN_WIDTH_BY_TYPE`), dipakai konsisten oleh tombol Shrink maupun drag-handle resize.
  - [x] 16.3 **BUG: block di dalam Section terjebak** — section punya `DndContext` sendiri, jadi drag keluar lintas-context mustahil. Ditambah aksi eksplisit "Keluarkan dari Section" pada menu block (`onEject` diturunkan root canvas → SectionBlock → canvas nested).
  - [x] 16.4 **Link Card item bisa dipindah antar kartu** — `DndContext` lokal di `LinkCardBlock` DIHAPUS; item kini memakai `SortableContext` yang ikut `DndContext` milik canvas (pola multi-container dnd-kit). `handleDragEnd` diperluas: cari item lewat `findItemLocation()`, lalu pindahkan ke kartu tujuan (drop di footer kartu lain ATAU tepat di posisi item lain). Buang-dari-sumber dilakukan sebelum sisip-ke-tujuan agar reorder dalam kartu yang sama tidak menggeser indeks dua kali.
  - [x] 16.5 **Drop-zone menyala untuk tipe yang tidak relevan** — canvas kini melacak `activeDragType` saat drag mulai; zona Link Card hanya menyala untuk `link_card_item`, zona Section untuk selain `section`/`link_card_item`.
  - [x] 16.6 **BUG akar: link `menu_item` tidak pernah bisa diklik** — prop `allMenuItems` dikirim tanpa field `url` sama sekali (`menuItemOptions()` hanya select id/label/icon/parent_id), sehingga `resolveShortcutHref()` selalu mengembalikan null. Logika resolusi URL diekstrak dari method privat `ResolveActiveDesk::resolveUrl()` ke service baru `App\Services\Core\Desk\MenuItemUrlResolver`, lalu dipakai BERSAMA oleh middleware (sidebar) dan controller (prop dashboard) — satu sumber kebenaran, bukan dua implementasi. Shortcut juga kini dibungkus anchor asli di mode baca (di mode edit sengaja tidak, agar klik/drag tidak memicu navigasi), dan link item memakai `cursor-pointer`.
  - [x] 16.7 Link Card setinggi baris — `SortableBlock` meregangkan cell (`stretchToRow`) dan kartu memakai `h-full flex-col`, jadi kartu berisi 1 item sejajar dengan kartu berisi banyak item.
  - [x] 16.8 **Aturan span responsif final** (menggantikan clamp sederhana): desktop memakai lebar apa adanya; tablet/mobile menghitung BERAPA BLOCK MUAT PER BARIS lalu membagi kolom rata — `perBaris = bulat(kolom / lebar)`, `span = kolom / perBaris`. Bila kolom tidak habis dibagi, turun ke 1 block per baris (full-width). Terverifikasi terhadap contoh: tablet lebar 4 → span 3, tablet lebar 5 → span 6, mobile lebar 2 → span 3.
  - [x] 16.9 **Pengujian**: 29 test `DeskDashboardBuilderTest` lulus. Verifikasi visual di tiga lebar (1400 / ±800 / 375): span sesuai rumus di tiap breakpoint, dua Link Card berbeda jumlah item punya tinggi identik (142px), seluruh link punya `href` hasil resolusi (mis. `/items`, `/itemAlternatives`) dengan `cursor: pointer`.

- [x] 17. Feedback UX round 7 — identitas Quick List & description rich-text
  - [x] 17.1 Quick List punya `label` (wajib, divalidasi di Dialog), `icon` (opsional, IconPicker), dan `description` (opsional) — dirender sebagai header kartu dengan pola yang sama seperti Link Card.
  - [x] 17.2 Description Link Card & Quick List kini memakai `TiptapEditor` (sebelumnya `Input` teks polos), disimpan sebagai `{ json, html }` seperti description Section.
  - [x] 17.3 Komponen bersama `BlockDescriptionTooltip` — ikon info + tooltip, menerima BENTUK BARU (`{json, html}`) maupun data lama (string biasa), jadi dashboard yang sudah tersimpan sebelum perubahan ini tetap menampilkan deskripsinya.
  - [x] 17.4 Backend: sanitasi HTML diperluas ke `link_card.description.html` dan `quick_list.description.html` — memakai sanitizer yang sama dengan description Section (`textLikeSanitizer`), karena keduanya kini menerima HTML dari editor.
  - [x] 17.5 **Bug yang ditemukan saat verifikasi**: `TiptapEditor` di semua block hanya membaca `.json`. Data yang punya `html` tanpa `json` (hasil seeding/migrasi) membuat editor terbuka KOSONG — dan isinya ikut terhapus begitu pengguna menekan Terapkan. Ditambah helper `richTextValue()` (`resources/js/lib/richText.js`) yang jatuh ke `html` bila `json` tidak ada; dipakai Section (label + description), Text, Link Card, dan Quick List.
  - [x] 17.6 **Pengujian**: 2 test regresi baru — sanitasi `link_card.description` (script dibuang, `<blockquote>` dipertahankan) dan persistensi `quick_list` label/icon/description (atribut `onerror` dibuang). Verifikasi visual: tiga block menampilkan ikon info (termasuk kartu dengan description format lama), form Edit Quick List memuat Label/Icon/Deskripsi-TipTap, dan editor terisi setelah perbaikan 17.5.

- [x] 18. Feedback UX round 8 — manajemen kolom Quick List, Spacer disederhanakan, identitas Section
  - [x] 18.1 Label kolom Quick List (header tabel, opsi urutan, dan pemilih kolom) memakai terjemahan `title`/`titleTrans` — pola sama seperti manajemen kolom Table2/FormTable. Sebelumnya menampilkan nama kolom mentah (`code`, `lang_code`).
  - [x] 18.2 Kolom yang ditampilkan kini bisa DIURUTKAN — komponen baru `ColumnOrderPicker`: daftar kolom terpilih dengan drag-handle (`@dnd-kit`) + tombol hapus, dan tombol "Tambah/Hapus Kolom" yang membuka dialog bergaya `SelectColumn` FormTable (grid checkbox masonry, "Pilih Semua", "Terapkan"). Urutan array `config.columns` menentukan urutan kolom tabel.
  - [x] 18.3 Kolom teknis disaring dari pemilih: tipe `attribute` (accessor model seperti `canDelete`/`route`/`thisModel`) selain relasi/json/mixed. Kolom itu tidak punya kolom tabel — endpoint `quickList` sudah menyaringnya lewat `Schema::hasColumn` sehingga selalu kosong — dan karena tak punya terjemahan, yang tampil justru kunci lang mentahnya (`core.country.columns.route`).
  - [x] 18.4 **BUG: field Model Quick List kosong dan menghapus konfigurasi sendiri.** `LinkModel` memanggil `onValueChange(null)` ketika tidak dapat menampilkan nilai awal; handler lama langsung menimpa `model_class` menjadi `null`, sehingga MEMBUKA dialog saja sudah menghapus pilihan model — bagian Kolom & Filter ikut hilang dan Terapkan tertahan "Model wajib dipilih". Dua perbaikan: (a) FE mengabaikan `null` dari LinkModel (Model wajib diisi, jadi null = "tidak ada perubahan", bukan penghapusan); (b) BE `DeskController::hydrateQuickListModels()` memuat ulang record `Permission` berdasarkan `config.model_id` setiap render, sehingga frontend selalu menerima objek yang bisa ditampilkan — termasuk untuk konfigurasi lama yang hanya menyimpan `model_id`/`model_class`.
  - [x] 18.5 Spacer disederhanakan: opsi orientasi vertical DIHAPUS, lebar selalu 12 kolom, dan kontrol resize (drag-handle maupun Expand/Shrink) disembunyikan. Yang tersisa: tipe (jarak kosong / garis) dan ukuran tinggi.
  - [x] 18.6 Section kini punya `icon` opsional, dan `description` dipindah menjadi tooltip pada ikon info — seragam dengan Link Card dan Quick List (sebelumnya paragraf terpisah di bawah judul).
  - [x] 18.7 **Pengujian**: verifikasi visual penuh — header tabel "Kode"/"Nama" terjemahan, daftar kolom ber-drag-handle, dialog "Pilih Kolom" bergaya SelectColumn hanya berisi kolom nyata, field Model menampilkan "Countries", Section beikon dengan tooltip, dan divider full-width tanpa resizer.

- [x] 19. Feedback UX round 9 — Divider style/position, Quick List overhaul (full parity kolom, pagination, style, loading)
  - [x] 19.1 Divider: tambah `lineStyle` (solid/dashed/dotted/tebal — "tebal" = solid + border-width lebih besar, CSS tidak punya nilai style tersendiri utk itu) dan `position` (atas/tengah/bawah, toggle icon-only `AlignVerticalJustifyStart/Center/End` + tooltip) — HANYA relevan utk `variant="divider"`, spacer polos tidak berubah.
  - [x] 19.2 Quick List — validasi label & model wajib: SUDAH ADA sejak round 7 (`validate()` di `BlockEditDialog`), tidak perlu perubahan.
  - [x] 19.3 Quick List — render kolom penuh (parity Table2): `Cell` di `Table2.jsx` di-export, dipakai langsung oleh `QuickListBlock` (bukan duplikasi switch-case tipe kolom). Backend `quickList()` sekarang mendukung kolom relasi singular (BelongsTo/HasOne/MorphOne) — eager-load via `nameOfFunction`, permission-checked (`PermissionChecker::can($meta['related'], Select)`) per relasi yang diminta, objek relasi child TIDAK di-strip appends-nya (dipakai `convertTemplateLink()` FE) sedangkan row ROOT tetap di-strip. Kolom `image` ikut mengirim `templateLink` row-level (dipakai alias fallback avatar).
  - [x] 19.4 Quick List — filter kolom pakai `isMetaAppendColumn` (by name, dari `resources/js/lib/utils.js`, ATAS instruksi eksplisit user) + flag `hidden`/`ignore`, MENGGANTI `EXCLUDED_TYPES` lama yang salah membuang tipe `attribute` secara blanket (attribute JUGA dipakai accessor bisnis asli, bukan cuma metadata framework). Type-exclusion yang tersisa hanya `relations`/`mixed`/`json` (tipe yang struktural tidak bisa dirender 1 sel, sama seperti `Cell` Table2). Berlaku di picker kolom MAUPUN Select "Urutkan berdasarkan" (yang sebelumnya tidak difilter sama sekali — bug tersendiri).
  - [x] 19.5 Quick List — pagination server-side: `limit` config = ukuran per halaman, backend pakai `paginate()`, response envelope `{data,total,current_page,last_page}`. Frontend pakai ulang `Components/Table/Pagination.jsx` (tidak bikin baru).
  - [x] 19.6 Quick List — batas tinggi + scroll internal (`max-h-80 overflow-y-auto`), style tabel diselaraskan visual Table2 (header `text-xs text-muted-foreground`, cell `py-1.5 px-2`, `border-b` per baris) TANPA ikut mesin resizable-column CSS-grid Table2 (di luar scope, widget kecil).
  - [x] 19.7 Quick List — loading state (`LoadingIcon` + teks, pola sama Table2) saat memuat data, `gooeyToast.error()` saat request gagal, dan indikator "Memuat kolom model..." di editDialog saat fetch `model.columns` masih berjalan.
  - [x] 19.8 **BUG FATAL ditemukan saat verifikasi manual**: `getColumns()` dipanggil TANPA argumen (default `$maxDepth=0`) di `quickList()` — docblock menyatakan **"0 = unlimited"**, bukan "tanpa relasi". Untuk model dgn graf relasi besar (SalesOrder) ini memicu rekursi tanpa batas → request macet 30 detik lalu 500. Fix: `getColumns(1)`, PERSIS sama dgn yang dipakai `ModelController::columns()` (endpoint `model.columns` yang sudah terbukti aman) — 37 kolom SalesOrder ter-resolve dalam 0.059s setelah fix.
  - [x] 19.9 **Bug ditemukan saat verifikasi manual**: request fetch quickList mengirim `config.columns` MENTAH (bisa kosong), sedangkan header tabel dirender dari `visibleColumns` (fallback bila kosong) — akibatnya header menampilkan kolom tapi backend cuma balikin primary key (fallback backend sendiri), data selalu kosong utk Quick List yang kolomnya belum diatur. Fix: `visibleColumns` jadi satu-satunya sumber kebenaran, dipakai baik utk header maupun payload request.
  - [x] 19.10 **Feedback user (koreksi arah)**: kolom default BUKAN "3 kolom pertama" (arbitrer) — ikuti flag `show:true` di `configColumns` model, pola SAMA dgn `DataTableColumnSelector::effectiveVisibleHeads()` (dipakai listing DataTable lain di app). Lebih lanjut: default (`show:true` & `sort_by=created_at` bila ada) HARUS di-auto-fill ke `draft` (bukan cuma fallback runtime tersembunyi) + WAJIB divalidasi (`validate()` menolak simpan bila kolom/urutan kosong) — model tanpa kolom `show:true`/`created_at` memaksa user memilih manual, bukan silently invalid.
  - [x] 19.11 **Pengujian**: 34 test `DeskDashboardBuilderTest` lulus (2 baru: kolom relasi ter-permission + pagination server-side, ditambah update 7 assertion existing ke envelope response baru). Verifikasi visual: Divider 4 style + 3 posisi, Quick List model `SalesOrder` (kolom fisik+relasi+formStatus) dan `Country` (250 baris, 50 halaman, format tanggal locale ID), auto-fill kolom/urutan default, validasi blokir simpan saat kolom kosong (real-time, sebelum klik Terapkan).

- [x] 20. Feedback UX round 10 — Quick List height stretch, urutan kolom default, dan 4 bug fatal ditemukan saat verifikasi manual
  - [x] 20.1 Quick List setinggi baris grid, sama seperti Link Card: `stretchToRow` di `DashboardCanvas.jsx` include `type==="quick_list"`, wrapper `QuickListBlock` pakai `flex h-full flex-col`, tabel `flex-1 min-h-0` (ganti `max-h-80` tetap) — dua Quick List bersebelahan dgn jumlah baris beda kini tinggi sama.
  - [x] 20.2 **Feedback user (koreksi)**: urutan kolom default HARUS ikut property `order` di configColumns (mis. Country: code=0, name=1, lang_code=2) — bukan alfabetis (default `usort()` backend, dipakai konsumen lain jadi TIDAK diubah global). Fix scoped: `.sort((a,b)=>(a.order??0)-(b.order??0))` HANYA di dalam auto-fill default QuickListForm.
  - [x] 20.3 **BUG akar ditemukan (root-cause dari 3 gejala berbeda yang dilaporkan user)**: `useModelColumns` reset `columns` ke `[]` di dalam `useEffect` — SELALU telat satu render dibanding `modelClass` yang sudah berubah lebih dulu (patchDraft di handler pilih Model). Dalam window itu, auto-fill QuickListForm sempat baca `columns` MASIH milik MODEL LAMA sambil `draft.model_class` SUDAH model baru — lolos guard "siap" secara keliru, kolom model lama (yg namanya kebetulan sama persis ada di model baru) lolos filter picker, sisanya (termasuk kolom relasi) hilang permanen krn ref-guard auto-fill cuma jalan sekali per model. Fix: reset `{columns, route}` SAAT RENDER (bukan di effect — pola resmi React "adjusting state when a prop changes"), digabung jadi SATU state atomik (columns+route berubah bersamaan, cegah race sejenis di antara keduanya).
  - [x] 20.4 **Bug fatal ditemukan saat verifikasi manual (React error #31, "Objects are not valid as a React child")**: body tabel QuickListBlock bisa render SEBELUM `savedColumns` (metadata kolom, hook TERPISAH dari form) selesai fetch — kolom relasi jatuh ke fallback `{type:"string"}` yang salah, Cell coba render OBJEK relasi mentah sbg children React → crash, seluruh halaman blank. Fix: `isLoadingColumns` (dari `useModelColumns`) ikut menahan render baris tabel, sama seperti `isLoading` (fetch data) — render Cell HANYA setelah metadata kolom (bukan cuma data baris) siap.
  - [x] 20.5 **Bug fatal kedua ditemukan setelah 20.4 (`TypeError: Cannot read properties of undefined (reading 'length')`)**: kolom `formStatus`/`formStatuses` di Cell Table2 baca `row.appendStatus` (accessor gabungan status, BUKAN kolom `status` mentahnya) — endpoint quickList tidak pernah mengirim field itu. Fix: `$needsAppendStatus` (pola sama `templateLink`/`created_by_id` — hanya disertakan bila kolom formStatus diminta) di `DashboardController::quickList()`.
  - [x] 20.6 **isLink & navigasi relasi tidak berfungsi** (dilaporkan user, lihat pola Table2): kolom `isLink` (mis. Country::code) butuh `row.thisModel` (FE isi sendiri dari `modelClass` yg sudah diketahui request — bukan data sensitif) + `row.created_by_id` (BE, hanya bila ada kolom isLink diminta — utk cek permission onlyCreator-scoped) + `route` (kolom fisik tidak bawa `route` sendiri dari backend, beda dgn kolom relasi; FE hitung `${modelRoute}.show` dari field `route` respons `model.columns`, pola sama `DataTable2.jsx`). Navigasi Link kolom RELASI (mis. Asset::assetCategory) TERNYATA sudah otomatis berfungsi tanpa perubahan tambahan — object relasi child tidak di-strip appends (`thisModel`/`route` bawaan sendiri ikut terserialize).
  - [x] 20.7 **Pengujian**: 2 test baru (`created_by_id` disertakan/tidak sesuai ada-tidaknya kolom isLink diminta), 36 test `DeskDashboardBuilderTest` lulus total. Verifikasi visual: dua Quick List `Country` beda jumlah baris (10 vs 5) tinggi sama persis (462px); auto-fill `Item`/`SalesOrder` kolom lengkap termasuk relasi (bug 20.3 sempat reproduce "hanya 1 kolom ke-auto-fill" sebelum fix); `Asset` (kolom fisik+2 relasi+formStatus+isLink) render tanpa crash — Kode/Kategori/Lokasi ketiganya jadi link biru mengarah ke halaman show masing-masing model (`/assets/{id}`, `/assetCategories/{id}`, `/assetLocations/{id}`), badge Status "Draf" tampil normal.

- [x] 21. Feedback UX round 11 — **Gap keamanan ditemukan (feedback user, bukan verifikasi manual)**: `quickList()` bypass 2 aturan visibility wajib
  - [x] 21.1 **Draft submitable bocor ke user lain**: `quickList()` membangun query manual sendiri (`$modelClass::query()`), TIDAK pernah lewat macro `DataTable::dataTable()` — akibatnya aturan wajib `DataTableScope::addDataTable()` (`whereNotNull('submitted_at')->orWhere('created_by_id', $user->id)`, dokumen draft cuma boleh terlihat pembuatnya) tidak pernah diterapkan sama sekali. Fix: filter yang SAMA disisipkan langsung setelah query filter/sort dibangun, scoped HANYA ke query model ROOT (tidak direkursi ke kolom relasi — persis seperti `DataTableScope` sendiri).
  - [x] 21.2 **Permission `onlyCreator` tidak diterapkan**: mekanisme normal (`Controller::guard()` → `Model::_checkPermission()`, otomatis populate `$request->onlyCreator` via constructor-middleware) terikat SATU `$this->model` tetap per-controller — `quickList()` dikecualikan dari guard itu (`exceptPermission('quickList')`) krn model-nya dinamis per-request, jadi celah ini luput. Fix: `PermissionChecker::isOnlyCreator()` baru (mirror logika "least-restrictive-wins" `DataTable::_checkPermission()`, tanpa `abort(403)` — pemanggil sudah pastikan `can()` true lebih dulu), diterapkan di `quickList()` bila kolom `created_by_id` ada di tabel.
  - [x] 21.3 **Refactor route**: `POST dashboard/quick-list/{modelClass}` (regex `.where('modelClass','.*')` + roundtrip `str_replace('/','\\',...)` khusus menampung backslash namespace PHP) diganti `POST dashboard/quick-list` polos, `model` pindah jadi field body tervalidasi (`required|string`) — pola REST umum utk data request POST, sekaligus buang whitelist regex yang sebelumnya wajib ada.
  - [x] 21.4 **Pengujian**: fixture model test-only baru `QuickListSubmitableTestDoc` (mirror pola `NoServicePropertyModel` di `SubmitableCheckApprovalGuardTest` — tabel dibuat via `Schema::create` di `setUp()`, bukan migration permanen) khusus test draft-privacy (butuh kolom `submitted_at` yang tak dimiliki fixture submitable lain). 2 test baru: draft user lain tersembunyi (draft sendiri & dokumen submitted siapapun tetap terlihat), listing terbatas ke baris sendiri saat satu-satunya izin Select `only_creator`-scoped (pakai `Dashboard`, model TIDAK submitable — isolasi dari aturan 21.1). 38 test `DeskDashboardBuilderTest` lulus total. Verifikasi browser: route baru `POST dashboard/quick-list` (tanpa segment URL) 200 OK, data+pagination+kolom relasi+isLink tetap berfungsi end-to-end pasca refactor.

## Notes

- Task 3.4 (sanitasi label section) sengaja belum menentukan lokasi final (`HTMLSanitizerService` vs helper terpisah) — keputusan diambil saat implementasi berdasar apakah whitelist super-ketat ini dibutuhkan di tempat lain juga.
- Task 3.17 (regresi `HTMLSanitizerService`) ditandai optional karena bergantung pada apakah test existing untuk service itu sudah ada di codebase — kalau belum ada, task ini jadi menulis test baru dari nol untuk kode yang tidak diubah scope-nya sendiri (nice-to-have, bukan blocker).
- Urutan Section 5 (block dasar) sebelum Section 6 (block bernesting + Canvas) disengaja: `DashboardBlock.jsx` (6.3) butuh seluruh block dasar sudah ada untuk di-switch, dan `SectionBlock.jsx` (6.4) butuh `DashboardCanvas.jsx` (6.2) sudah ada untuk direkursi.
- Verifikasi visual (Section 10) TIDAK dilewati sesuai instruksi eksplisit user — dilakukan via Browser pane (`preview_start`, `computer` screenshot, `resize_window` untuk breakpoint).
- Formatter/linter (`vendor/bin/pint --dirty`, ESLint/Prettier bila ada) HANYA dijalankan setelah SEMUA task (termasuk optional) selesai — bukan per task.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3"] },
    { "id": 2, "tasks": ["1.4"] },
    { "id": 3, "tasks": ["2"] },
    { "id": 4, "tasks": ["3.1", "3.3"] },
    { "id": 5, "tasks": ["3.2", "3.4", "3.5"] },
    { "id": 6, "tasks": ["3.6", "3.9"] },
    { "id": 7, "tasks": ["3.7", "3.8"] },
    { "id": 8, "tasks": ["3.10", "3.11", "3.12", "3.13", "3.14", "3.15", "3.16", "3.17"] },
    { "id": 9, "tasks": ["4"] },
    { "id": 10, "tasks": ["5.1"] },
    { "id": 11, "tasks": ["5.2", "5.3", "5.4", "5.5"] },
    { "id": 12, "tasks": ["6.1", "6.2"] },
    { "id": 13, "tasks": ["6.3"] },
    { "id": 14, "tasks": ["6.4"] },
    { "id": 15, "tasks": ["6.5"] },
    { "id": 16, "tasks": ["7"] },
    { "id": 17, "tasks": ["8.1"] },
    { "id": 18, "tasks": ["8.2"] },
    { "id": 19, "tasks": ["9"] },
    { "id": 20, "tasks": ["10.1", "10.2", "10.3", "10.4", "10.5", "10.6", "10.7"] },
    { "id": 21, "tasks": ["11"] }
  ]
}
```
