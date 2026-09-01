# Requirements Document

## Introduction

Desk-based UI redesign (spec `desk-based-ui`, sudah selesai) menyiapkan mekanisme `Desk::resolveDashboard()` — setiap Desk bisa ditautkan ke satu `Dashboard` — tapi secara eksplisit menunda dua hal: (1) integrasi tampilannya ke UI, dan (2) "dashboard widget builder ala ERPNext Home (chart/card berbasis query, spacer, grid, link, drag-drop lintas tipe widget)". Spec ini adalah kelanjutan yang ditunda tersebut.

Saat ini, mengakses sebuah Desk langsung melempar user ke item menu pertama tanpa halaman landing netral. Infrastruktur `Dashboard`/`Widget`/`DashboardWidget` sudah matang untuk chart/card berbasis query (calculation_type sum/average/count/group_by, time series, dynamic column loader), dengan drag-reorder yang sudah battle-tested di `Dashboard/Dashboard.jsx` (halaman dashboard milik user, konsep terpisah dari Desk). Yang belum ada: halaman *home* per-Desk, tipe block non-chart (section, text, spacer, shortcut, link card, quick list), grid fleksibel 12-kolom, kanvas editor visual untuk menyusunnya, dan container bersarang (`section` menampung block lain, termasuk `link_card`) — persis seperti Workspace Home di ERPNext.

Riset langsung terhadap ERPNext v16 (instance lokal via Docker) mengonfirmasi pola: kanvas hanya menyimpan *posisi* block (urutan + lebar grid), sedangkan konfigurasi detail tiap block disimpan terpisah dan direferensikan by-name. Spec ini mengadaptasi pola tersebut ke skema yang sudah ada di codebase (`DashboardWidget.config` JSON, `parent_id` self-referencing) alih-alih meniru banyak tabel terpisah ala ERPNext.

## Glossary

- **Dashboard**: model existing (`app/Models/Core/Dashboard.php`) — kumpulan widget yang ditampilkan bersama. Satu Desk memiliki tepat satu Dashboard (via `desks.dashboard_id`).
- **Widget**: model existing (`app/Models/Core/Widget.php`) — definisi query-builder untuk chart/card (model target, calculation_type, filter waktu, dst). Tidak berubah oleh spec ini.
- **DashboardWidget**: pivot existing (`app/Models/DashboardWidget.php`) yang menghubungkan Dashboard ke Widget, dan (setelah spec ini) juga menjadi baris block non-chart secara langsung.
- **Block**: satu unit visual di kanvas dashboard — merepresentasikan satu baris `DashboardWidget`. Sembilan tipe: `chart`, `card` (keduanya merujuk ke Widget via `widget_id`, existing), `section`, `text`, `spacer`, `shortcut`, `link_card`, `link_card_item`, `quick_list` (baru, konfigurasi disimpan di kolom `config`).
- **Section**: block tipe `section` — container universal dengan label rich-text-lite (bold/italic/underline/warna, TANPA block-level seperti heading/list/blockquote) yang menampung block tipe apapun sebagai anak (termasuk `link_card`, lihat Requirement 1.9-1.11), selalu berada di root (tidak bisa bersarang di dalam block lain).
- **Link Card**: block tipe `link_card` — grup judul yang menampung beberapa `link_card_item` sebagai anak, tiap anak adalah satu tautan. Boleh berada di root ATAU di dalam sebuah `section` (Requirement 1.10).
- **Kanvas**: komponen UI (`DashboardCanvas`) yang merender seluruh block milik satu Dashboard dalam grid 12-kolom, mendukung drag-reorder, resize, dan insert block baru secara visual.
- **Desk Home**: halaman landing baru per-Desk yang merender Dashboard hasil `Desk::resolveDashboard()` melalui Kanvas.

## Requirements

### Requirement 1: Perluasan skema DashboardWidget untuk block non-chart

**User Story:** As a developer sistem, I want `DashboardWidget` bisa merepresentasikan block selain chart/card tanpa menambah tabel baru, so that penambahan tipe block baru di masa depan tidak memerlukan migrasi struktural berulang.

#### Acceptance Criteria

1. THE sistem SHALL memperluas kolom `dashboard_widgets.type` menjadi salah satu dari: `chart`, `card`, `section`, `text`, `spacer`, `shortcut`, `link_card`, `link_card_item`, `quick_list`.
2. WHEN `type` bernilai `chart` atau `card`, THE sistem SHALL mewajibkan `widget_id` terisi (perilaku existing, tidak berubah).
3. WHEN `type` bernilai selain `chart`/`card`, THE sistem SHALL menyimpan seluruh konfigurasi block pada kolom `config` (JSON, existing) dan membiarkan `widget_id` kosong.
4. THE sistem SHALL mengganti kolom `dashboard_widgets.width` dari enum (`half`/`full`) menjadi integer 1–12 merepresentasikan lebar grid 12-kolom.
5. WHEN migrasi dijalankan pada data existing, THE sistem SHALL mengonversi nilai `half` menjadi `6` dan `full` menjadi `12` tanpa kehilangan baris data.
6. THE sistem SHALL mengaktifkan kolom `dashboard_widgets.parent_id` (existing, self-referencing) sebagai penanda nesting, dengan kedalaman maksimal 2 level (`section` → `link_card` → `link_card_item`).
7. THE block `section` SHALL SELALU berada di root: `parent_id` WAJIB null untuk baris bertipe `section`.
8. THE block `link_card` SHALL memperbolehkan `parent_id` berupa null (root) ATAU menunjuk ke satu baris bertipe `section`; tidak ada nilai lain yang valid untuk `parent_id`-nya.
9. THE block `link_card_item` SHALL mewajibkan `parent_id` terisi dan HARUS menunjuk ke satu baris bertipe `link_card` (baik `link_card` tersebut berada di root maupun di dalam `section`).
10. THE block selain `section`/`link_card_item` (yaitu `chart`, `card`, `text`, `spacer`, `shortcut`, `link_card`, `quick_list`) SHALL memperbolehkan `parent_id` berupa null (root) ATAU menunjuk ke satu baris bertipe `section`; TIDAK BOLEH menunjuk ke `link_card`.
11. THE sistem SHALL menolak (validasi backend) setiap kombinasi `parent_id` yang melanggar Requirement 1.7-1.10, termasuk mencegah rantai kedalaman lebih dari 2 level (mis. `link_card_item` yang menunjuk ke `link_card_item` lain, atau `section` yang menunjuk ke `section` lain).

### Requirement 2: Definisi konfigurasi per tipe block baru

**User Story:** As a user yang menyusun dashboard, I want tiap tipe block punya field konfigurasi yang relevan dengan fungsinya, so that saya bisa membangun tampilan informatif tanpa perlu tipe chart/card untuk semua kebutuhan.

#### Acceptance Criteria

1. THE block `section` SHALL menyimpan `{ label, description }` pada `config`, dengan `label` berupa rich-text-lite JSON (subset TipTap: bold, italic, underline, strike, warna teks — TIDAK termasuk node block-level seperti heading/list/blockquote/image, karena label section adalah teks satu-baris, bukan dokumen).
1a. THE editor label `section` SHALL menggunakan `TiptapEditor` (existing) dengan ekstensi dibatasi hanya mark-level (lihat Requirement 2.1) — bukan instance `StarterKit` penuh yang dipakai block `text` (Requirement 2.2).
1b. THE sistem SHALL men-sanitasi `config.label.html` di backend dengan whitelist tag LEBIH KETAT dari block `text` (Requirement 2a): hanya `span`, `strong`, `em`, `u`, `s`, `br` — mencegah label section menyisipkan struktur block yang merusak tata letak Kanvas.
1c. THE `description` pada block `section` SHALL bersifat OPSIONAL (boleh kosong/null) dan SHALL menggunakan `TiptapEditor` FULL FITUR yang SAMA dengan block `text` (toolbar lengkap, bukan subset mark-level seperti `label`) — disimpan dan disanitasi dengan struktur dan aturan yang identik Requirement 2.2/2a/2b (`{ json, html }`, whitelist tag `extraAllowedTags`).
1d. WHEN `description` kosong, THE sistem SHALL TIDAK menampilkan area editor/render deskripsi sama sekali pada block `section` dalam mode baca (bukan menampilkan area kosong) — sejalan sifat opsionalnya.
2. THE block `text` SHALL menggunakan komponen `TiptapEditor` (existing, dipakai `Comments.jsx`/`EmailTemplate/Form.jsx`) sebagai editor rich-text, dan SHALL menyimpan `{ json, html }` pada `config` — `json` (ProseMirror JSON, sumber kebenaran untuk re-edit) dan `html` (hasil render, untuk tampilan cepat tanpa re-parse).
2a. THE sistem SHALL men-sanitasi `config.html` di backend menggunakan `HTMLSanitizerService` (existing, `app/Services/Core/PrintTemplate/`) sebelum disimpan — sanitasi client (`sanitizeHTML`, existing) SAJA TIDAK CUKUP karena bukan satu-satunya jalur data mencapai penyimpanan.
2b. THE sistem SHALL menampilkan block `text` dalam mode baca menggunakan `dangerouslySetInnerHTML` dari `config.html` yang SUDAH tersanitasi backend, dengan class `tiptap` (pola sama `CommentBody` di `Comments.jsx`) untuk styling konsisten.
3. THE block `spacer` SHALL tidak memerlukan field konfigurasi tambahan (config kosong/null diperbolehkan).
4. THE block `shortcut` SHALL menyimpan `{ icon, link_type, link_to, color, stats_filter }` pada `config`, dengan `link_type` berupa salah satu dari `menu_item` (merujuk `MenuItem` existing, tervalidasi) atau `url` (link bebas, lihat Requirement 2.9-2.11).
5. THE block `link_card` SHALL menyimpan `{ label }` pada `config` sebagai judul grup.
6. THE block `link_card_item` SHALL menyimpan `{ label, link_type, link_to }` pada `config` dengan struktur `link_type`/`link_to` yang sama seperti Requirement 2.4, dan HARUS memiliki `parent_id` yang menunjuk ke satu baris `link_card`.
7. THE block `quick_list` SHALL menyimpan `{ model, filters, sort_by, sort_direction, limit }` pada `config`, merujuk ke Permission Model (pola sama dengan `Widget.model_id`/`model_class`) yang datanya akan ditampilkan.
8. WHEN pengguna memilih `model` pada block `quick_list`, THE sistem SHALL membatasi pilihan pada model yang pengguna miliki izin `select`-nya (pola sama dengan `PermissionChecker` existing).
9. WHEN `link_type` bernilai `url` (link bebas, bukan `MenuItem`), THE sistem SHALL memvalidasi `link_to` HANYA menerima skema `http://`, `https://`, atau path relatif dimulai `/` — skema lain (termasuk `javascript:`, `data:`, `vbscript:`) SHALL ditolak di backend saat penyimpanan.
10. THE sistem SHALL me-render `link_to` bertipe `url` sebagai atribut `href` murni (tanpa interpolasi HTML/JS tambahan), dan SHALL menandai visual (mis. ikon "external link") untuk membedakannya dari link `menu_item` yang sudah divalidasi lebih ketat sejak seeding.
11. WHEN pengguna memilih `link_type = menu_item`, THE sistem SHALL menampilkan pemilih dari daftar `MenuItem` yang sudah ada (pola sama seperti picker pada `DeskMenuItemManager.jsx`); WHEN `link_type = url`, THE sistem SHALL menampilkan input teks bebas dengan validasi skema (Requirement 2.9) berjalan di sisi client sebagai bantuan UX dan WAJIB diulang di backend sebagai penegak utama.
12. THE block `quick_list` SHALL mengizinkan pengguna menentukan `sort_by` (nama kolom, dibatasi pada kolom yang terdaftar di `configColumns` model terkait — pola sama seperti validasi kolom pada `Settings/Widget/Form.jsx`) dan `sort_direction` (`asc`/`desc`), serta `limit` (integer, default 5, maksimum dibatasi angka wajar mis. 20 untuk mencegah query berat).

### Requirement 3: Kanvas dashboard sebagai editor visual

**User Story:** As a pemilik/pengelola Desk, I want menyusun block dashboard langsung secara visual (drag, resize, sisipkan), so that saya tidak perlu berpindah ke form terpisah untuk membangun tampilan Desk Home.

#### Acceptance Criteria

1. THE sistem SHALL merender seluruh block satu Dashboard dalam grid CSS 12-kolom sesuai `order` dan `width` masing-masing baris.
2. WHEN pengguna melakukan drag pada sebuah block, THE sistem SHALL memperbarui `order` block-block yang terpengaruh secara optimistic di client lalu mempersist ke server (pola sama dengan `handleWidgetReorder` di `Dashboard.jsx` existing).
3. WHEN pengguna melakukan resize pada sebuah block, THE sistem SHALL memperbarui `width` (1–12) block tersebut.
4. THE sistem SHALL menyediakan kontrol "+" (inserter) di antara block-block untuk menyisipkan block baru, membuka pemilih tipe block (mirip pola dropdown pada `IconPicker`/picker existing lain di codebase).
5. WHEN pengguna menyisipkan block, THE sistem SHALL memungkinkan konfigurasi block dilakukan inline pada kanvas (tanpa membuka dialog terpisah).
6. WHEN pengguna melakukan drag sebuah `link_card_item` ke atas block `link_card`, THE sistem SHALL menjadikannya anak dari `link_card` tersebut (pola drag-to-nest sama seperti `DeskMenuItemManager.jsx`).
7. WHEN pengguna melakukan drag sebuah block bertipe `text`/`spacer`/`shortcut`/`chart`/`card`/`quick_list`/`link_card` ke atas block `section`, THE sistem SHALL menjadikannya anak dari `section` tersebut.
8. THE sistem SHALL mencegah kombinasi drag-to-nest yang melanggar Requirement 1.7-1.11 — termasuk mencegah `section` dinestingkan ke `section` lain atau ke `link_card`, mencegah `link_card_item` dinestingkan ke selain `link_card`, dan mencegah `link_card` di dalam `section` menerima drop `link_card_item` dari LUAR dirinya sendiri secara tidak sengaja tertukar target.
9. THE sistem SHALL menyediakan aksi hapus per-block; WHEN block yang dihapus memiliki anak (`section` atau `link_card`), THE sistem SHALL meminta konfirmasi sebelum menghapus beserta seluruh anaknya (untuk `section` yang berisi `link_card` beranak, konfirmasi SHALL mencakup penghapusan berjenjang 2 level).
10. THE block `link_card` SHALL menyediakan editor tabel (bulk editor) untuk mengelola seluruh `link_card_item` anaknya sekaligus — tambah baris baru, ubah label/link tiap baris, hapus baris, dan atur ulang urutan — sebagai pelengkap (bukan pengganti) cara drag-to-nest satu-per-satu pada Requirement 3.6.
11. THE editor tabel Link Card SHALL menggunakan pola komponen `FormTable` yang sudah ada di codebase (konsisten dengan `NestedDeskAssignableFormTable`/picker MenuItem), dibuka inline di dalam block `link_card` (bukan dialog terpisah, tetap sejalan Requirement 3.5).
12. THE block `section` SHALL merender seluruh anaknya (block tipe apapun, termasuk `link_card` beserta `link_card_item`-nya) dalam grid 12-kolom LOKAL di dalam batas visual `section` tersebut (nested grid, bukan ikut alur grid root Kanvas) — pola visual sama seperti "outer border" yang menampung children pada `DeskMenuItemManager.jsx`.

### Requirement 4: Desk Home — wiring Desk ke Dashboard

**User Story:** As a user, I want mengakses sebuah Desk menampilkan halaman ringkasan (home) miliknya sendiri, so that saya langsung melihat informasi relevan tanpa harus memilih menu terlebih dahulu.

#### Acceptance Criteria

1. THE sistem SHALL menggunakan route existing bernama `dashboard` (path `/dashboard-view`) sebagai Desk Home, merender Dashboard hasil `Desk::resolveDashboard()` milik Desk aktif — **REVISI dari draft awal**: bukan route baru terpisah, melainkan MENGGANTIKAN TOTAL perilaku lama route ini (union banyak Dashboard per-user via `user_dashboards`, `DashboardController::view()`/`storeUserDashboard()`/`reorderWidgets()`), sesuai instruksi eksplisit user saat implementasi. Mekanisme lama (tabel `user_dashboards`, relasi `User::dashboards()`) dibiarkan ada di schema (tidak di-drop) tapi tidak lagi dipakai jalur manapun di aplikasi.
2. WHEN Desk aktif belum memiliki `dashboard_id`, THE sistem SHALL memanggil `resolveDashboard()` untuk membuat Dashboard kosong secara otomatis (perilaku existing, Requirement 7 AC 2 spec `desk-based-ui`).
3. THE Desk Home SHALL menggunakan Kanvas (Requirement 3) untuk merender block-block Dashboard tersebut.
4. THE breadcrumb halaman Desk Home SHALL selalu "Home > [DeskSwitcher] > Dashboard" — label terakhir SHALL berupa teks statis "Dashboard", BUKAN judul record `Dashboard` model (mis. "Core Dashboard") yang sudah terwakili oleh DeskSwitcher (nama Desk aktif).

### Requirement 5: Otorisasi pengeditan Dashboard Desk

**User Story:** As pemilik Desk atau user dengan akses tulis, I want hanya pihak yang berwenang bisa mengubah susunan block dashboard, so that tampilan Desk yang dibagikan ke banyak user tidak bisa diubah sembarangan.

#### Acceptance Criteria

1. THE sistem SHALL mengizinkan mode edit Kanvas hanya untuk pengguna yang memiliki hak tulis atas Desk tersebut (pola sama dengan `hasWritePermission`/`canShare` pada `Desk/Form.jsx` existing).
2. WHEN pengguna tanpa hak tulis mengakses Desk Home, THE sistem SHALL menampilkan Kanvas dalam mode baca saja (tanpa kontrol drag/resize/insert/hapus).
3. THE sistem SHALL memvalidasi otorisasi ini di backend (endpoint update block), bukan hanya menyembunyikan kontrol di frontend.

### Requirement 6: Kanvas responsif lintas ukuran layar

**User Story:** As a user yang mengakses Desk Home dari perangkat berbeda (desktop, tablet, mobile), I want tata letak grid dashboard tetap terbaca dan bisa dioperasikan, so that saya tidak kehilangan konteks informasi hanya karena ukuran layar lebih kecil.

#### Acceptance Criteria

1. THE grid 12-kolom SHALL menyesuaikan jumlah kolom efektif berdasarkan breakpoint Tailwind standar yang sudah dipakai di codebase (`sm`/`md`/`lg`, pola sama seperti `DeskList.jsx`).
2. WHEN lebar viewport berada di bawah breakpoint `md`, THE sistem SHALL menampilkan seluruh block dalam satu kolom penuh (stack vertikal), mengabaikan nilai `width` asal per-block agar tidak ada block yang terpotong atau tumpang tindih.
3. WHEN mode edit aktif pada viewport sempit (di bawah `md`), THE sistem SHALL tetap mengizinkan reorder (drag vertikal antar block) tetapi SHALL menonaktifkan kontrol resize lebar (kontrol resize hanya relevan pada tata letak multi-kolom).
4. THE drag-to-nest `link_card_item` ke `link_card`, dan block manapun ke `section` (Requirement 3.6-3.7) SHALL tetap berfungsi pada seluruh breakpoint, termasuk viewport sempit.
5. WHEN viewport berada di bawah breakpoint `md`, THE grid 12-kolom LOKAL di dalam `section` (Requirement 3.12) SHALL turut mengikuti aturan stack-vertikal yang sama seperti grid root (Requirement 6.2).

### Requirement 7: Mode edit eksplisit (Edit/Simpan/Batal)

**User Story:** As a user dengan hak edit, I want kanvas SELALU terbuka dalam mode baca dulu dan saya HARUS menekan tombol "Edit" untuk mulai mengubah, so that saya tidak tidak sengaja mengubah tata letak dashboard hanya karena membuka halaman.

#### Acceptance Criteria

1. WHEN halaman Desk Home dibuka, THE kanvas SHALL SELALU dalam mode baca (tanpa kontrol drag/resize/insert/hapus) terlepas dari hak edit pengguna, SAMPAI pengguna menekan tombol "Edit" secara eksplisit.
2. WHEN pengguna memiliki hak edit (Requirement 5.1), THE sistem SHALL menampilkan tombol "Edit" di actions bar halaman.
3. WHEN tombol "Edit" ditekan, THE sistem SHALL mengambil snapshot state kanvas saat itu (sebagai titik pulih), mengaktifkan seluruh kontrol edit, dan mengganti tombol "Edit" menjadi tombol "Simpan" dan "Batal".
4. WHEN pengguna melakukan perubahan (insert/hapus/drag/resize/edit konten) SELAMA mode edit aktif, THE sistem SHALL menyimpan perubahan tersebut HANYA di state lokal — TIDAK mengirim request ke server sampai tombol "Simpan" ditekan.
5. WHEN tombol "Simpan" ditekan, THE sistem SHALL mengirim SELURUH state kanvas saat itu ke `updateDashboardWidgets` sekali, lalu kembali ke mode baca setelah berhasil.
6. WHEN tombol "Batal" ditekan, THE sistem SHALL mengembalikan kanvas ke snapshot yang diambil saat tombol "Edit" ditekan (Requirement 7.3), membuang seluruh perubahan yang belum disimpan, lalu kembali ke mode baca.
7. THE sistem SHALL TIDAK mengirim request apapun ke `updateDashboardWidgets` akibat tombol "Batal" — pembatalan murni operasi state lokal.

## Non-Functional / Out of Scope

- Block tipe `onboarding` (checklist progres ala ERPNext) — tidak termasuk spec ini.
- Block tipe `custom_block` (HTML bebas) — butuh riset sanitasi HTML terpisah (`HTMLSanitizerService`), tidak termasuk spec ini.
- Migrasi data dashboard/widget historis milik user manapun — spec ini hanya menyediakan mekanisme baru.
- Drop schema `user_dashboards`/`User::dashboards()` — mekanisme lama route `/dashboard-view` dinonaktifkan dari aplikasi (Requirement 4.1) tapi TABEL dan RELASI-nya dibiarkan ada (tidak ada migration drop) — pembersihan schema, jika diperlukan, adalah spec/task terpisah.
- Dependency library baru (`@editorjs/editorjs` atau sejenis) — Kanvas dibangun native dengan `@dnd-kit` yang sudah dipakai di codebase.
- Dynamic filter expression runtime (mis. `frappe.defaults.get_user_default(...)` ala ERPNext) untuk `quick_list`/`shortcut.stats_filter` — filter yang didukung spec ini adalah nilai statis (dipilih/diketik saat konfigurasi), bukan expression yang dievaluasi ulang tiap request.
