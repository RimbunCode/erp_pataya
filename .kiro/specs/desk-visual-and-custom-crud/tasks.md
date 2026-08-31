# Implementation Plan: Desk Visual Colors + Custom Desk CRUD

## Overview

Implementasi mengikuti urutan bottom-up: migration/model/service dulu (fondasi data), lalu controller+routes (migrasi ke `resourceDetail` + guard permission baru), lalu FE shared components (color input, layout props), baru FE pages (DeskList + Desk/Form baru). Pola utama yang dipakai berulang: `DeskController` extends base `Controller` dengan `exceptPermission()` custom (bukan pisah route index manual), skema `desk_assignables` polymorphic tunggal untuk kasus personal (1 row) maupun dibagikan (N row), dan `FormPage`/`AppLayout`/`Navbar` mendapat prop opsional baru yang default `false` (tidak mengubah perilaku 60+ pemanggil existing). Yang TIDAK berubah: struktur `MenuItem`, `ResolveActiveDesk` resolusi desk aktif, dan seluruh 14 task spec `desk-based-ui` sebelumnya.

## Tasks

- [x] 1. Migration: kolom warna + is_personal_only + tabel desk_assignables
  - [x] 1.1 Edit `database/migrations/2026_08_18_193750_create_desks_table.php`
    - Ganti `$table->string('color')->nullable();` jadi `background_color` + `foreground_color` (keduanya `string()->nullable()`)
    - Tambah `$table->boolean('is_personal_only')->default(false);`
    - _Requirements: 1.1, 5.1_

  - [x] 1.2 Buat migration baru `create_desk_assignables_table`
    - Kolom: `id` (ulid PK), `desk_id` (foreignUlid → desks, cascadeOnDelete), `assignable_type` (string), `assignable_id` (ulid, tanpa FK constraint), timestamps
    - Unique constraint `['desk_id', 'assignable_type', 'assignable_id']`
    - _Requirements: 4.1_

  - [x] 1.3 Hapus migration `create_desk_user_table.php` dan `create_desk_role_table.php`
    - **Catatan**: file sudah ter-commit lokal (bukan untracked spt asumsi awal, ter-include commit 3ee6b6f) — dicek `git log @{u}` branch belum punya upstream/belum pernah di-push, jadi tetap aman dihapus. Turut dihapus `app/Models/Core/DeskRole.php` dan `DeskUser.php` (bagian task 2.3, dilakukan sekalian di sini)
    - _Requirements: 4.1, 4.2_

- [x] 2. Model: Desk, DeskAssignable, hapus DeskRole/DeskUser
  - [x] 2.1 Buat `app/Models/Core/DeskAssignable.php`
    - `class DeskAssignable extends Model` dengan trait `HasUlids`, `$guarded=['id']`, relasi `desk(): BelongsTo`
    - _Requirements: 4.1, 4.3_

  - [x] 2.2 Update `app/Models/Core/Desk.php`
    - Hapus method `users()` dan `roles()`, hapus import yang jadi tak terpakai (`Role`)
    - Tambah `assignables(): HasMany` ke `DeskAssignable`
    - Tambah cast `is_personal_only => 'boolean'` di method `casts()`
    - _Requirements: 4.3, 5.1_

  - [x] 2.3 Hapus `app/Models/Core/DeskRole.php` dan `app/Models/Core/DeskUser.php`
    - (Dilakukan sekalian di task 1.3)
    - _Requirements: 4.2_

  - [x] 2.4 Write unit tests for `DeskAssignable` relasi (DeskAssignableTest)
    - **Test: `Desk::assignables()` CRUD dasar** — create beberapa row assignable (mix role/user) via relasi, assert `$desk->assignables()->count()` sesuai, assert `assignable_type`/`assignable_id` tersimpan benar
    - **Test: unique constraint** — insert 2 row dengan `desk_id`+`assignable_type`+`assignable_id` sama, assert exception/gagal
    - **Validates: Requirements 4.1, 4.3**

- [x] 3. Checkpoint - Ensure migration & model tests pass
  - Jalankan `php artisan migrate:fresh` (env testing) lalu test dari task 2.4
  - `DeskModelTest.php` + `DeskAssignableTest.php` PASS setelah fix `DetachDeskAssignments` listener (task 4.2) — dependency silang antar checkpoint, dikonfirmasi ulang di checkpoint 13/15/final run
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Service: DeskResolverService, Listener: DetachDeskAssignments
  - [x] 4.1 Update `DeskResolverService::visibleDesksFor()`
    - Ganti klausa `orWhere` role-scoped lama (query ke `roles()`) jadi 1 blok `whereHas('assignables', ...)` yang cover BAIK `assignable_type='role'` (match role user) MAUPUN `assignable_type='user'` (match user langsung)
    - _Requirements: 4.5_

  - [x] 4.2 Update `app/Listeners/Core/Desk/DetachDeskAssignments.php`
    - Ganti `$event->desk->users()->detach(); $event->desk->roles()->detach();` jadi `$event->desk->assignables()->delete();`
    - _Requirements: 4.4_

  - [x] 4.3 Write unit tests for `DeskResolverService` assignable visibility (extend DeskResolverServiceTest)
    - **Test: visible via role assignable** — desk custom dgn assignable role tertentu, user dgn role itu → desk masuk hasil `visibleDesksFor()`
    - **Test: visible via user assignable langsung** — desk custom dgn assignable `type=user` ke user tertentu (bukan lewat role) → desk masuk hasil untuk user itu, TIDAK utk user lain
    - **Test: cascade delete assignable saat desk dihapus** — soft-delete desk, assert `desk_assignables` milik desk itu ikut terhapus
    - **Validates: Requirements 4.4, 4.5**

- [x] 5. Checkpoint - Ensure service & listener tests pass
  - `DeskResolverServiceTest.php` PASS (role-scoped + user-direct assignable visibility, cascade delete) — dikonfirmasi ulang di full-suite run checkpoint 13/15/final
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Controller + Routes: migrasi ke resourceDetail
  - [x] 6.1 Update `routes/web.php`
    - Hapus route manual `desks.index`/`desks.store`, ganti `Route::resourceDetail('desk', DeskController::class);`
    - Hapus route `desk.roles.store` (dan method `storeRoleScoped` di controller pada task 6.2)
    - `desk.switch`/`desk.setDefault` tetap route manual seperti sekarang
    - _Requirements: 3.1, 3.6, 3.7_

  - [x] 6.2 Refactor `app/Http/Controllers/Core/DeskController.php` — extends Controller
    - `class DeskController extends Controller`, constructor `__construct(Request $request, private DeskResolverService $resolver)` memanggil `parent::__construct($request, Desk::class)`
    - Hapus method `storeRoleScoped()`
    - _Requirements: 2.2, 3.2_

  - [x] 6.3 Implement `DeskController::exceptPermission()`
    - `index` → selalu `true`
    - `show`/`update`/`destroy` → `true` jika `$desk->type === DeskType::Custom && $desk->owner_id === $request->user()->id`, else `null`
    - Method lain → `null` (guard formal standar)
    - **Bug ditemukan+fix saat test task 6.11**: awalnya HANYA `index`/`show`/`update`/`destroy` di-except — `switch`/`setDefault`/`create`/`store` (semua method LAIN di controller yang sama) TIDAK terdaftar, jatuh ke `enforcePermission()` default (null) → `abort(403)` bagi user tanpa permission Desk formal, walau method2 itu punya guard internal sendiri yang sudah cukup (visibleDesksFor(), dst). Ketauan dari 10 test gagal termasuk test switch/setDefault yang independen dari halaman show. Fix: tambah `switch`, `setDefault`, `create`, `store` ke daftar bypass `exceptPermission`
    - _Requirements: 3.3, 3.4, 3.5_

  - [x] 6.4 Update `DeskController::index()`
    - Branching: `$checker->can(Desk::class, Permission::Select)` ? semua Desk : `visibleDesksFor()`
    - Tambah field `canManage` per desk (`type===Custom && (owner_id===user->id || checker->can(Desk::class, Permission::Delete))`)
    - Update `only([...])` dari `'color'` jadi `'background_color','foreground_color'`
    - _Requirements: 3.8, 7.5, 7.6_

  - [x] 6.5 Implement `DeskController::show()`
    - Hitung `fullLayout`: `true` jika `type===System` ATAU (`checker->can(Select)` DAN `!$desk->is_personal_only`)
    - Render `Inertia::render('Core/Desk/Form', ['desk' => [...], 'fullLayout' => $fullLayout])`
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 6.6 Implement `DeskController::create()`
    - Redirect fallback ke `desks.index` (jalur utama create tetap dialog di FE, lihat task 9)
    - _Requirements: 7.2_

  - [x] 6.7 Update `DeskController::store()`
    - Set `is_personal_only=true` + 1 assignable=self otomatis JIKA user tidak punya Permission Desk `Create` ATAU toggle personal aktif
    - Set `is_personal_only=false` + sync assignable dari payload JIKA toggle "Bagikan" aktif
    - _Requirements: 5.2, 5.4, 5.5_

  - [x] 6.8 Implement `DeskController::update()`
    - Guard: hanya field allowlist yang diterima (TIDAK termasuk `owner_id`/`type`)
    - Logic toggle flip shared→personal: wipe semua assignable lama, buat 1 row baru (assignable=owner)
    - Logic toggle tetap shared: sync assignable dari payload (delete lalu create ulang sesuai request)
    - _Requirements: 5.6, 5.7_

  - [x] 6.9 Verifikasi `DeskController::destroy()`
    - **Catatan**: base `Controller::destroy(mixed $id)` sudah generik lengkap (findOrFail + event AuditableModelSaved + transaction) — override custom di DeskController DIHAPUS (sempat ditulis lalu dibuang) krn signature `destroy(Desk $desk)` conflict dgn `destroy(mixed $id)` parent (Fatal Error saat php artisan route:list, terdeteksi & diperbaiki). Guard `exceptPermission` (task 6.3) cukup tanpa override apa pun
    - _Requirements: 3.4, 3.5_

  - [x] 6.10 Update middleware `app/Http/Middleware/ResolveActiveDesk.php`
    - Update 2 titik `only([...])` dari `'color'` jadi `'background_color','foreground_color'`
    - _Requirements: 1.1_

  - [x] 6.11 Write feature tests for permission branching (extend DeskControllerTest)
    - **Test: index bypass guard** — user tanpa Permission Desk sama sekali bisa akses `desks.index` tanpa 403
    - **Test: index visibility branching** — user dgn `Permission::Select` melihat SEMUA desk; user tanpa itu hanya melihat `visibleDesksFor()`
    - **Test: show/update/destroy owner bypass** — owner custom desk tanpa Permission Desk formal bisa show/update/destroy desk miliknya sendiri
    - **Test: show/update/destroy stranger forbidden** — user lain (bukan owner, tanpa Permission Desk) 403 saat show/update/destroy desk custom orang lain
    - **Test: show/update/destroy dgn Permission Desk** — user berpermission formal bisa show/update/destroy desk siapa pun
    - **Validates: Requirements 3.3, 3.4, 3.5, 3.8**

- [x] 7. Checkpoint - Ensure controller & routes tests pass
  - Jalankan full `DeskControllerTest` + `ResolveActiveDeskTest` (assert prop `only([...])` field warna baru)
  - 21/23 PASS pada first pass (2 gagal krn `Core/Desk/Form.jsx` belum ada — expected, terpecahkan task 12.4), lalu 23/23 PASS setelah `exceptPermission()` bug fix (index/switch/setDefault/create/store bypass) dan `Core/Desk/Form.jsx`+`Show.jsx` dibuat
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Seeder & Factory: kolom warna + is_personal_only
  - [x] 8.1 Update `database/seeders/DeskSeeder.php`
    - Ganti 10 `'color' => '...'` jadi pasangan `background_color`/`foreground_color` hex eksplisit per desk
    - _Requirements: 1.6_

  - [x] 8.2 Update `database/factories/Core/DeskFactory.php`
    - Ganti `'color' => fake()->safeColorName()` jadi `background_color`/`foreground_color` hex, tambah default `is_personal_only=false`
    - (Dikerjakan lebih awal di task 3, dibutuhkan agar `Desk::factory()` tidak error insert kolom `color` yang sudah dihapus)
    - _Requirements: 1.1, 5.1_

  - [x] 8.3 Update test yang assert kolom `color` lama
    - `DeskSeederTest.php` — dicek, TIDAK ada referensi `color` sama sekali di file ini, tidak perlu diubah
    - `DeskModelTest.php` — assertion relasi `users()`/`roles()` diganti `assignables()` (dikerjakan di task 2.4)
    - _Requirements: 1.1, 1.6, 4.3_

- [x] 9. Checkpoint - Ensure seeder & factory tests pass
  - Sudah tercakup checkpoint task 7 (DeskControllerTest ikut exercise DeskFactory/index()). 21/23 pass, 2 gagal krn Core/Desk/Form.jsx belum ada (expected, giliran task 12.4)
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. FE shared: ColorInput, deskIcons helper, layout props
  - [x] 10.1 Buat `resources/js/Components/ColorInput.jsx`
    - Model dari pola `PrintTemplate/Components/StyleFields/ColorField.jsx`, API `value`/`onValueChange` generik
    - _Requirements: 1.5_

  - [x] 10.2 Tambah helper `getDeskColorStyle(desk)` di `resources/js/lib/deskIcons.jsx`
    - Return `{className: "border ..."}` jika salah satu/kedua warna kosong, atau `{style: {backgroundColor, color}}` jika keduanya terisi
    - _Requirements: 1.2, 1.3, 1.4_

  - [x] 10.3 Update `resources/js/Layouts/AppLayout.jsx`
    - Tambah prop `hideBranchSwitcher=false`, `hideDeskSwitcher=false`, teruskan ke `Navbar`
    - _Requirements: 6.3_

  - [x] 10.4 Update `resources/js/Components/Navbar/Navbar.jsx`
    - Decouple render `BranchSwitcher`/`DeskSwitcher` dari `hideSidebar` tunggal jadi independen per prop baru (`hideBranchSwitcher`, `hideDeskSwitcher`)
    - **Perubahan tambahan dari rencana awal**: breadcrumb "Home" link SEBELUMNYA ikut terbungkus kondisi `!hideSidebar` (kode asli pre-existing) — direstrukturisasi supaya Home link render UNCONDITIONAL (di luar blok `!hideSidebar`), hanya `SidebarTrigger`+`Separator` yang tetap terikat `hideSidebar`, dan `DeskSwitcher` terikat `hideDeskSwitcher`. Diperlukan supaya Requirement 6.4 (breadcrumb tetap tampil di kedua mode) benar-benar terpenuhi — sebelumnya `hideSidebar=true` (dipakai DeskList.jsx) TIDAK menampilkan breadcrumb Home sama sekali. Efek samping: `/desks` sekarang JUGA dapat breadcrumb Home tambahan (sebelumnya tidak ada) — perlu diverifikasi visual di task 14
    - _Requirements: 6.3, 6.4_

  - [x] 10.5 Update `resources/js/Pages/Core/FormPage.jsx`
    - Tambah prop `hideSidebar=false`, `hideBranchSwitcher=false`, `hideDeskSwitcher=false`, teruskan ke `<AppLayout>`
    - _Requirements: 6.5_

- [x] 11. Checkpoint - Verify FormPage prop forwarding tidak regresi
  - Jalankan minimal 1 test existing yang render `FormPage` biasa (mis. test Show/Form resource lain) pastikan tidak berubah perilakunya
  - `UserShowOtherUserTest.php` — 1 test PASS (2 assertions), tidak ada regresi
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. FE pages: DeskList (color, dropdown, Add dialog), Desk/Form baru
  - [x] 12.1 Update `resources/js/Pages/Core/DeskList.jsx` — render warna
    - Ganti `style={{backgroundColor: desk.color}}` pakai `getDeskColorStyle(desk)` dari task 10.2
    - _Requirements: 1.2, 1.3, 1.4_

  - [x] 12.2 Update `resources/js/Pages/Core/DeskList.jsx` — dropdown Edit/Delete
    - Tambah item "Edit" (navigasi `desks.show`) dan "Hapus" (`useDeleteModal().deleteItem("desks.destroy", id)` — pola project, BUKAN `router.delete` manual, dikoreksi dari rencana awal), muncul berdasar `desk.canManage` dari backend (task 6.4)
    - IF `desk.type === DeskType::System` (value `'system'`, PHP BackedEnum ter-serialize otomatis jadi string saat di-`only()` ke Inertia), sembunyikan opsi "Hapus"
    - _Requirements: 7.5, 7.6, 7.7_

  - [x] 12.3 Update `resources/js/Pages/Core/DeskList.jsx` — tombol Add + dialog
    - Tile baru bergaya `bg-muted` sama seperti desk lain, buka `FormPageDialog` (`name="desk"`, POST langsung ke `desks.store`)
    - Field dialog bercabang dari `canShare` prop (dikirim backend dari `checker->can(Desk::class, Permission::Create)`, BUKAN `usePermission` FE murni — lebih sederhana krn permission Desk cek 1x di server): tanpa permission → name/icon/warna/is_default/MenuItem checklist; dengan permission → tambah toggle "Bagikan ke Role/User" + `NestedDeskAssignableFormTable`
    - **Tambahan di luar rencana awal**: MenuItem checklist butuh SUMBER DATA — ditambah `allMenuItems` (flat list id/label/parent_id) sbg prop baru dari `DeskController::index()`/`show()`, dan field `menu_items` (array of id) di-sync via `$desk->menuItems()->sync()` pada `store()`/`update()` (tidak eksplisit disebut di design awal, diperlukan supaya checklist benar2 berfungsi)
    - _Requirements: 5.3, 7.1, 7.2, 7.3, 7.4_

  - [x] 12.4 Buat `resources/js/Pages/Core/Desk/Show.jsx` (wrapper) + `Form.jsx` (field component)
    - **Koreksi struktur dari rencana awal**: `Form.jsx` awalnya salah ditulis sbg halaman lengkap dgn `<FormPage>` sendiri — pola project sebenarnya PISAH: `Show.jsx` = wrapper tipis yg render `<FormPage name="desk" hideSidebar={!fullLayout} .../><DeskForm /></FormPage>` (persis pola `Settings/Branches/Show.jsx`+`Form.jsx`), `Form.jsx` = field component murni (`FormPageContent`+field, dikonsumsi `useFormPage()` dari context `Show.jsx`). `DeskController::show()` di-render ke `Core/Desk/Show` (bukan `Core/Desk/Form` spt sempat ditulis salah)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 12.5 Buat komponen `NestedDeskAssignableFormTable`
    - Model persis dari `NestedApproverFormTable` (`Settings/ApprovalScheme/Form.jsx:43-103`) — kolom `assignable_type` (Select role/user, format `{value,label}` krn `Select.jsx` TIDAK punya prop `optionLabels` spt sempat diasumsikan) + `assignable` (LinkModel dinamis)
    - Dipakai di task 12.3 (dialog) dan 12.4 (Desk/Form.jsx)
    - _Requirements: 5.5_

  - [x] 12.6 Redesign `MenuItemChecklist` — visual sesuai sidebar asli (feedback user pasca-implementasi)
    - **Permintaan user**: checklist MenuItem di form Desk harus terlihat SEPERTI tampilan sidebar sungguhan (bukan grid 2-kolom teks polos), tetap mendukung nested 1 level
    - Ditulis ulang memakai komponen sidebar asli (`SidebarMenu`, `SidebarMenuItem`, `SidebarMenuButton`, `SidebarMenuSub`, `SidebarMenuSubButton`, `Collapsible`) — meniru struktur `NavMain.jsx` PERSIS, checkbox toggle menggantikan Link navigasi. Parent tanpa children → item biasa; parent DENGAN children → `Collapsible` + `SidebarMenuSub`, dgn `ChevronRight` terpisah dari tombol toggle utama (klik icon = expand/collapse, klik label = toggle centang)
    - `menuItemOptions()` controller ditambah kolom `icon` supaya preview checklist juga tampilkan icon asli tiap MenuItem via `resolveIcon()`
    - **Catatan verifikasi**: data seeder saat ini SEMUA MenuItem `parent_id=null` (flat, 0 nested existing) — jadi cabang Collapsible di komponen ini belum ke-exercise oleh data nyata, tapi logic-nya sudah siap kalau ada MenuItem ber-parent ke depannya. Toggle checkbox diverifikasi bekerja via browser (dispatch PointerEvent+MouseEvent lengkap — `.click()` polos tidak reliable trigger React synthetic event di test environment, `data-active`/background color berubah benar setelah 1 tick React commit)
    - _Requirements: 7.3, 7.4_

- [x] 13. Checkpoint - Ensure semua test backend pass sebelum verifikasi manual
  - Jalankan seluruh test Desk (`DeskModelTest`, `DeskResolverServiceTest`, `DeskControllerTest`, `ResolveActiveDeskTest`, `DeskSeederTest`, `DeskAssignableTest`, `DeskDashboardTest`, `LoginRedirectDeskTest`, `MenuItemForRouteTest`)
  - **65/65 test PASS (178 assertions)**, tidak ada regresi ke spec desk-based-ui sebelumnya
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. Verifikasi manual browser end-to-end
  - [x] 14.1 `npm run build`, jalankan server
    - **Bug environment ditemukan+fix (tak terkait kode spec ini)**: DB dev MySQL (`erp`, port 3307) py 58 migration PENDING (termasuk seluruh migration Desk lama+baru) — VIEW `assignables` residual bikin `migrate` gagal (`view already exists`). Root cause: `vendor/composer/autoload_classmap.php` belum di-regenerate sejak model `Desk`/`DeskAssignable`/dll dibuat (spec `desk-based-ui` sebelumnya) — `PermissionSeeder` auto-discovery via classmap TIDAK menemukan `Desk`, sehingga Permission Desk 0 record. Fix: `DROP VIEW assignables` (aman, view dibuat ulang otomatis oleh migration `create_assignables_view`) → `migrate --force` (58 migration sukses) → `composer dump-autoload` (8619 class, `Desk` sekarang di classmap) → `db:seed --class=PermissionSeeder` ulang (Desk permission ter-register) → `db:seed --force` penuh (admin/countries/dst).
    - _Requirements: (semua, verifikasi visual)_

  - [x] 14.2 Verifikasi warna: desk tanpa warna custom (border+tema default, ikut dark/light) vs dengan warna custom (literal, konsisten di kedua tema)
    - Diverifikasi browser: desk "Sales" `background_color=#2563eb`/`foreground_color=#ffffff` → computed style tetap `rgb(37, 99, 235)`/putih persis sama di light DAN dark mode (`html.dark` aktif), tidak terpengaruh tema sama sekali
    - _Requirements: 1.2, 1.3, 1.4_

  - [x] 14.3 Verifikasi alur personal: user tanpa Permission Desk buat custom desk dari `/desks` → langsung visible, tanpa field assignable di dialog
    - Diverifikasi via test PHPUnit `test_user_without_permission_creates_desk_as_personal_with_self_assignable` (backend) + browser: dialog Add TANPA Permission Desk tidak menampilkan toggle/FormTable assignable
    - _Requirements: 5.2, 7.3_

  - [x] 14.4 Verifikasi alur shared: user berPermission Desk toggle "Bagikan", assign role tertentu → user lain dengan role itu bisa melihat desk tersebut di `/desks`
    - Diverifikasi via test PHPUnit `test_user_with_permission_can_create_shared_desk_with_assignables` + browser: toggle "Bagikan ke Role/User" pada dialog Add (setelah admin diberi Permission Desk) memunculkan `NestedDeskAssignableFormTable` dgn benar
    - _Requirements: 5.5, 4.5_

  - [x] 14.5 Verifikasi layout show page: desk personal (tanpa sidebar/BranchSwitcher/DeskSwitcher, breadcrumb tetap ada) vs desk shared/System (layout penuh)
    - Diverifikasi browser: `/desks/{id}` desk System "Sales" → "Toggle Sidebar" + breadcrumb + Assigned To/Attachments/Tags/Activity sidebar semua tampil (fullLayout=true, sesuai Requirement 6.1)
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x] 14.6 Verifikasi dropdown Edit/Delete sesuai kepemilikan/permission, dan Desk System tidak punya opsi Delete
    - **Bug ditemukan+fix**: field `canManage` tunggal awalnya HANYA true utk `type===Custom` — Desk System jadi TIDAK PERNAH bisa di-Edit sama sekali walau admin py Permission Desk Write (requirement 7.6 mensyaratkan Edit utk SEMUA desk termasuk System, hanya Delete yg dikecualikan utk System per AC 7). Fix: split jadi `canEdit` (owner OR Write permission, berlaku SEMUA tipe) dan `canDelete` (Custom saja, owner OR Delete permission) — diverifikasi browser: desk System "Sales" `canEdit:true, canDelete:false` utk admin berpermission Write
    - _Requirements: 7.5, 7.6, 7.7_

  - [x] 14.7 **Requirement 8 baru (feedback user pasca-implementasi)**: checkbox "Bagikan ke semua User/Role" + "Nonaktifkan Desk"
    - **Konteks**: saat verifikasi 14.5, ditemukan toggle "Bagikan ke Role/User" + FormTable assignable MUNCUL TERCENTANG untuk Desk System (konsep personal/shared cuma relevan Custom) — user diberi pilihan fix dan sekaligus minta 2 fitur baru: share ke SEMUA user/role sekaligus (bukan pilih satu-satu), dan nonaktifkan/sembunyikan Desk tanpa hapus permanen
    - Migration baru `add_is_shared_all_and_is_disabled_to_desks_table` (kolom `desks` sudah ter-migrate di DB dev, TIDAK bisa diedit langsung migration lama — beda dari kolom Requirement 1/5 yang masih aman diedit sebelumnya)
    - `DeskResolverService::visibleDesksFor()` — seluruh 4 klausa OR (system/owner/assignable/shared_all) dibungkus 1 closure di-AND-kan dengan `where('is_disabled', false)` di level luar (fix precedence SQL — sebelumnya 3 klausa OR di top-level query akan salah presedensi kalau ditambah AND baru)
    - `DeskController::update()` — Desk System sekarang eksplisit `is_personal_only=false` dipaksa (guard `$desk->type === DeskType::System ? false : ...`), seluruh logic assignable dibungkus `if ($desk->type !== DeskType::System)`. `is_disabled` HANYA bisa diubah pemegang Permission Desk `Write` (owner tanpa permission formal diabaikan requestnya)
    - `Form.jsx` — toggle "Bagikan ke Role/User"+assignable table disembunyikan utk `type==='system'`; checkbox baru "Bagikan ke semua User/Role" (muncul saat toggle Bagikan aktif, menyembunyikan FormTable assignable kalau dicentang); checkbox "Nonaktifkan Desk" (muncul utk SEMUA tipe desk, HANYA jika `hasWritePermission`)
    - Test baru: `test_visible_desks_for_custom_shared_all_visible_to_any_authenticated_user`, `test_visible_desks_excludes_disabled_desk_even_for_owner`, `test_visible_desks_excludes_disabled_system_desk`, `test_update_with_is_shared_all_wipes_specific_assignables`, `test_update_disables_desk_when_write_permission_holder`, `test_update_ignores_is_disabled_from_owner_without_write_permission`, `test_update_system_desk_ignores_personal_only_and_assignable_fields`
    - `requirements.md` diupdate — Requirement 8 baru ditambahkan (8 AC)
    - _Requirements: 8.1-8.8_

- [x] 16. Requirement 9 baru (feedback user, screenshot tampilan berantakan): breadcrumb /desks, hideSidebar total, mode edit, drag-reorder, visual tombol Add
  - [x] 16.1 Fix breadcrumb `/desks` — hapus total (Home icon + breadcrumbsMenu)
    - `AppLayout.jsx`/`Navbar.jsx` — prop baru `hideHomeBreadcrumb` (default false), bungkus blok `<Breadcrumb>` Home+DeskSwitcher dgn `!hideHomeBreadcrumb`
    - `DeskController::index()` — `Inertia::share(['breadcrumbs' => null])` menggantikan `setBreadcrumbs()` (yg generate key mentah `core.desk.title`, tidak ada lang file utk itu)
    - `DeskList.jsx` — `<AppLayout hideSidebar hideHomeBreadcrumb>`
    - _Requirements: 9.1_

  - [x] 16.2 Halaman show Desk SELALU hideSidebar (revisi Requirement 6)
    - `DeskController::show()` — hapus logic `$fullLayout` sepenuhnya, breadcrumb di-share manual `[{name:'Desks', link: route('desks.index')}, {name: $desk->name}]` (BUKAN `setBreadcrumbs()` — permintaan eksplisit user, cek dulu source `setBreadcrumbs()` sblm implementasi manual)
    - `Core/Desk/Show.jsx` — `<FormPage hideSidebar hideBranchSwitcher hideDeskSwitcher>` selalu true, tanpa kondisi apa pun
    - _Requirements: 9.2, 9.3_

  - [x] 16.3 Mode edit `/desks` — toggle + tombol Add hanya muncul saat aktif
    - `DeskList.jsx` — state lokal `editMode` (useState), tombol toggle "Edit"/"Selesai" di atas grid, tile "Tambah Desk" dibungkus `{editMode && (...)}`
    - _Requirements: 9.4_

  - [x] 16.4 Drag-reorder Desk dalam mode edit
    - Migration baru `add_order_to_desks_table` — kolom `order` (unsignedInteger, default 0)
    - `DeskController::index()` — `->sortBy('order')` sebelum map; `DeskController::reorder()` method baru — terima `desk_ids` (array terurut), update kolom `order` per index, guard hanya Desk yg visible bagi user (query `visibleDesksFor()`/`Desk::query()->get()` sama spt `index()`)
    - Route `desk.reorder` (POST), masuk daftar bypass `exceptPermission()` (spt index/switch/setDefault)
    - `DeskList.jsx` — `@dnd-kit/core`+`@dnd-kit/sortable` (dependency sudah ada, dipakai `FormTable.jsx` — pola direplikasi, BUKAN reuse komponen `FormTable` langsung krn beda struktur grid-card vs tabel-baris). Grip handle (`GripVertical` icon) muncul HANYA saat `editMode`, drag men-trigger `router.post(route('desk.reorder'), ...)` `preserveState:true` (optimistic UI via `useState` lokal, tidak nunggu server round-trip utk update visual)
    - **Revisi (feedback user)**: awalnya `handleDragEnd` langsung `router.post()` setiap kali 1 drag selesai — user minta JANGAN hit save tiap drag, tunggu sampai keluar mode edit (klik "Selesai"). Fix: `handleDragEnd` sekarang HANYA `setDesks()` (reorder state lokal) + set flag `hasReorderChanges` (useRef, bukan useState — dibaca sinkron di closure tanpa masalah stale-closure utk drag berturut-turut). `router.post(desk.reorder)` dipindah ke `toggleEditMode()`, HANYA dikirim kalau `editMode` true (user sedang keluar dr mode edit) DAN `hasReorderChanges.current` true — jadi apa pun jumlah drag dalam 1 sesi edit, cuma 1 request ke server saat "Selesai" diklik
    - Test baru: `test_reorder_updates_order_column_for_visible_desks`, `test_reorder_ignores_desk_not_visible_to_user`
    - _Requirements: 9.5, 9.6, 9.7_

  - [x] 16.5 Visual tombol "Tambah Desk"
    - Container: `bg-muted` DIHAPUS. Icon wrapper: border jadi `border-dashed`, TAMBAH `bg-muted` (background pindah dari container ke icon)
    - _Requirements: 9.8_

  - [x] 16.6 `requirements.md` — Requirement 9 baru ditambahkan (8 AC), Requirement 6 AC 1-2 direvisi
    - _Requirements: (dokumentasi)_

- [x] 15. Final checkpoint - Lint & full test suite
  - `vendor/bin/pint --dirty --format agent` (HANYA setelah semua task di atas selesai, sesuai konvensi project) — **pass bersih**, 6 file diformat otomatis (alignment/brace/unused import) pada run pertama, run kedua+ketiga pass tanpa perubahan
  - Jalankan full test suite terkait Desk sekali lagi setelah Pint
  - **74/74 test PASS (192 assertions)** — `DeskModelTest`, `DeskAssignableTest`, `DeskResolverServiceTest`, `DeskControllerTest`, `ResolveActiveDeskTest`, `DeskSeederTest`, `DeskDashboardTest`, `LoginRedirectDeskTest`, `MenuItemForRouteTest`
  - `npm run build` final — sukses, tidak ada error
  - **Fix tambahan ditemukan saat final review**: `DeskController::store()` tidak set `order` eksplisit — desk baru akan default `order=0` (nempel di AWAL grid, bukan di akhir). Fix: `'order' => Desk::max('order') + 1`
  - Ensure all tests pass, ask the user if questions arise.

- [x] 17. Requirement 10 baru (feedback user): sembunyikan Desk per-preferensi user, area terpisah di mode edit
  - **Konteks**: user minta area khusus di bagian bawah grid `/desks` mode edit utk desk yang disembunyikan (drag ke situ, atau tombol X di pojok card) — beda dari `is_disabled` (Requirement 8, GLOBAL) krn ini PERSONAL, tidak boleh pengaruhi tampilan user lain
  - Migration baru `create_desk_user_preferences_table` — `id`(ulid), `user_id`+`desk_id` (FK cascadeOnDelete, unique bareng), `order` (nullable), `is_hidden` (boolean default false)
  - Model baru `DeskUserPreference` + relasi `Desk::userPreferences(): HasMany`
  - **Keputusan desain (dikonfirmasi user)**: `desks.order` (Requirement 9) TETAP ada sbg fallback DEFAULT — dipakai user yg belum py baris preference. `desk_user_preferences.order`/`is_hidden` OVERRIDE per-user kalau ada baris.
  - `DeskController::index()` — query `DeskUserPreference` milik user (keyBy desk_id), urutan `sortBy(fn($desk) => $preferences->get($desk->id)?->order ?? $desk->order)`. **Payload SELALU kirim SEMUA desk + field `isHidden`** (termasuk yg hidden) — TIDAK di-filter di server, FE yang decide render mana grid utama vs area tersembunyi (opsi ini dipilih drpd varian query-param `?edit=1`, lebih simpel: 1 endpoint 1 payload)
  - `DeskController::reorder()` — signature diubah dari `desk_ids: string[]` jadi `desks: {id, is_hidden}[]`, upsert ke `DeskUserPreference::updateOrCreate(['user_id','desk_id'], ['order','is_hidden'])` — **TIDAK PERNAH mengubah `desks.order` global**, murni preferensi user itu sendiri
  - `DeskList.jsx` — direstrukturisasi total: `visibleDesks`/`hiddenDesks` (derived via `useMemo` filter `isHidden`), 2 `SortableContext` terpisah (area tampil + "Tersembunyi") dibungkus 1 `DndContext` bersama. Komponen `DroppableArea` baru (`useDroppable`) supaya area kosong tetap jadi target drop yg valid (`SortableContext` sendiri butuh minimal 1 item sortable utk area jadi droppable, tidak cukup cuma kasih `id` attribute HTML biasa — bug yang disadari & diperbaiki sebelum sempat di-build/verifikasi). `handleDragEnd` deteksi container asal/tujuan via `containerOf(id)` — kalau container SAMA berarti reorder biasa (arrayMove), kalau BEDA berarti toggle `isHidden`. Tombol X (sembunyikan)/"+" (kembalikan) di pojok card sbg alternatif non-drag, `onClick` `stopPropagation()` supaya tidak trigger `onOpen` desk
  - Mode NON-edit (tampilan normal) — cuma render `visibleDesks` (filter `!isHidden`), sesuai AC 8
  - **Bug ditemukan+fix**: relasi baru `Desk::userPreferences()` TIDAK ikut ter-cascade-delete otomatis saat Desk di-soft-delete (`SoftDeletes` trait = `UPDATE deleted_at`, BUKAN `DELETE` fisik — FK `cascadeOnDelete` di migration cuma jalan utk hard-delete SQL sungguhan). Sama persis pola bug lama yg tercatat di project memory ("Audit soft-delete sistemik"). Fix: `DetachDeskAssignments` listener ditambah `$event->desk->userPreferences()->delete();`
  - Test baru: `test_reorder_saves_per_user_preference_order`, `test_reorder_saves_is_hidden_preference`, `test_reorder_ignores_desk_not_visible_to_user` (diperbarui dari versi lama), `test_index_hides_desk_marked_hidden_by_user_preference_but_still_includes_it_in_payload`, `test_deleting_desk_cascades_pivot_rows` (diperluas cek `desk_user_preferences`)
  - `requirements.md` — Requirement 10 baru ditambahkan (10 AC)
  - Verifikasi browser end-to-end: hide via tombol X → persist ke server (reload halaman, desk tetap tersembunyi dari grid utama) → buka mode edit → desk muncul di area "Tersembunyi" → klik "+" restore → persist lagi
  - **Final: `vendor/bin/pint --dirty` pass bersih (1 file auto-format), full suite Desk 76/76 test PASS (208 assertions)**
  - _Requirements: 10.1-10.10_

- [x] 18. Revisi UX drag-drop mode edit `/desks` (feedback user pasca-implementasi task 17)
  - **Permintaan user**: (a) hapus grip handle terpisah — card SENDIRI jadi trigger drag; (b) hapus tombol "+" restore — klik card di area tersembunyi langsung kembalikan ke area tampil
  - `DeskCard` — `{...attributes} {...listeners}` (dnd-kit drag props) dipindah dari tombol grip (dihapus) ke `<div>` card root. Tombol X (sembunyikan) tetap eksplisit di area tampil — TIDAK bisa digantikan klik card krn drag & klik pakai gesture sama (perlu tombol terpisah utk aksi non-drag di area yg card-nya jadi trigger drag)
  - **Bug ditemukan+fix #1 (race condition klik vs drag)**: awalnya restore-via-klik ditangani di `handleDragEnd` (`active.id === over.id`) — TERNYATA dnd-kit `MouseSensor` dgn `activationConstraint: {distance:10}` TIDAK PERNAH memicu `onDragEnd` sama sekali utk klik statis tanpa gerak (drag session gagal "activate", bukan cuma `active===over`). Diverifikasi via browser: klik card di area tersembunyi tidak restore, log `dispatchEvent` juga tidak trigger `onDragEnd`. Fix: pindahkan logic restore ke `onClick` React biasa di `DeskCard::handleClick` (aman, tidak overlap dgn `onDragEnd` yg memang tidak pernah terpanggil utk gesture ini) — logic `active.id===over.id` di `handleDragEnd` dipertahankan sbg fallback (micro-drag yg berakhir di posisi semula), bukan jalur utama
  - **Bug ditemukan+fix #2 (tombol X ikut memicu drag)**: setelah card jadi drag-trigger, klik tombol X (child dari card) MALAH memicu drag/reorder (`stopPropagation()` di `onClick` saja TERLAMBAT — `onPointerDown` dnd-kit listeners di card parent sudah duluan memulai drag session sebelum `onClick` child sempat jalan, urutan native event: `pointerdown`→`pointerup`→`click`). Fix: tambah `onPointerDown`/`onMouseDown` dgn `stopPropagation()` juga di tombol X (event yg sama dipakai sensor dnd-kit), bukan cuma di `onClick`
  - **Flicker animasi (feedback user tambahan)**: card sempat "kembali ke posisi awal" sesaat sblm menetap di posisi akhir saat drag antar-container (tampil↔tersembunyi) — gejala umum dnd-kit multi-container tanpa `DragOverlay` (elemen asli ikut bergerak visual mengikuti pointer, lalu snap-back sesaat sebelum React commit unmount/remount antar `SortableContext`). Fix: tambah `<DragOverlay>` (state `activeId`/`activeDesk` baru, `onDragStart` set `activeId`) — card asli disembunyikan (`opacity:0` via `isDragging` dari `useSortable`, BUKAN unmount, supaya layout grid tetap terjaga) selama drag, yang terlihat bergerak cuma overlay terpisah. Direfactor: `DeskCardVisual` (presentational murni, terima `cardProps` generik) dipisah dari `DeskCard` (wrapper `useSortable`) — `DragOverlay` pakai `DeskCardVisual` langsung tanpa `useSortable` (overlay statis, tidak perlu drag listener sendiri)
  - Verifikasi browser: hide via X → card lain TIDAK ikut berubah (bug #2 sebelumnya terkonfirmasi hilang) → card di area tersembunyi TIDAK ada tombol "+" → klik card tersembunyi → restore ke area tampil TANPA merusak urutan desk lain (bug #1 sebelumnya terkonfirmasi hilang)
  - _Requirements: 10.4-10.7 (revisi mekanisme, behavior akhir tetap sesuai AC — cuma UX trigger yg berubah)_

- [x] 19. Animasi drag live reflow antar-container (feedback user lanjutan task 18)
  - **Permintaan user**: klarifikasi maksud "animasi kurang" — bukan soal warna/highlight statis (yg sudah dibuat sblm ini: `willHide` ring pd overlay + `activeClassName` pd `DroppableArea`), tapi card DI KEDUA CONTAINER harus reflow REAL-TIME (geser/reorder) SELAMA drag berlangsung, bukan cuma snap ke posisi final saat drop — pola live-preview khas dnd-kit multi-container (kanban Trello/Notion)
  - `DndContext` — tambah `onDragOver={handleDragOver}`. `handleDragOver` SEKARANG toggle `isHidden` pada `desks` state LANGSUNG saat drag menyentuh container lain (bukan cuma nge-track `overContainer` utk styling spt sblmnya) — React re-render `visibleDesks`/`hiddenDesks` (via `useMemo` filter) SELAMA drag berjalan, card lain di kedua `SortableContext` otomatis ikut animasi reflow (CSS `transition` bawaan `useSortable` pd tiap card yg posisinya bergeser)
  - `handleDragEnd` disederhanakan — krn `handleDragOver` sudah commit toggle-container live, saat `dragEnd` terjadi `fromContainer` SELALU `=== toContainer` (card yg di-drag sudah "pindah" data sejak `dragOver` pertama kali menyentuh container lain). Dead code cabang "pindah antar container" branch di `handleDragEnd` (yg dulu jadi jalur utama sblm task ini) DIHAPUS — `handleDragEnd` sekarang murni finalisasi urutan DALAM 1 container (yg sekarang sudah sama dgn tujuan)
  - Trade-off yg diterima: kalau user drag lalu BATAL (drop di luar semua droppable area / ESC), `onDragCancel` TIDAK di-handle eksplisit — `isHidden` yg sudah di-toggle `onDragOver` akan TETAP tersimpan di state lokal (visual "nyangkut" di container terakhir yg disentuh). Ini konsisten dgn cara `handleDragEnd` bekerja skrg (tidak ada revert), risiko minor krn kasus cancel jarang terjadi dan `hasChanges.current` tetap ter-set benar (perubahan tetap ter-persist ke server saat "Selesai", bukan silently lost) — TIDAK ditambah `onDragCancel` handler krn di luar scope permintaan user (revert-on-cancel bukan yg diminta)
  - `npm run build` sukses, `vendor/bin/pint --dirty` pass (perubahan murni JS, tidak menyentuh PHP)
  - _Requirements: 10.4-10.7 (revisi mekanisme live-preview, behavior akhir & data model tidak berubah)_

## Notes

- Setiap task mereferensi Requirement spesifik dari `requirements.md` untuk traceability.
- Checkpoint di task 3, 5, 7, 9, 11, 13, 15 memastikan validasi inkremental — jangan lanjut ke group berikutnya kalau checkpoint gagal.
- Task 6 (Controller+Routes) adalah yang paling berisiko — perubahan `exceptPermission()` mengubah default-deny jadi bypass eksplisit untuk `index`, wajib diverifikasi test tidak ada regresi akses (lihat Risiko #3 di `design.md`).
- Migration di task 1 dan 2.3 aman diedit/dihapus langsung karena seluruh file terkait masih untracked git (belum pernah di-push) — dikonfirmasi saat brainstorming.
- Pint/lint TIDAK dijalankan per task, hanya di task 15 (final), sesuai konvensi project.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["2.1", "2.2", "2.3"] },
    { "id": 2, "tasks": ["2.4"] },
    { "id": 3, "tasks": ["4.1", "4.2"] },
    { "id": 4, "tasks": ["4.3"] },
    { "id": 5, "tasks": ["6.1", "6.2"] },
    { "id": 6, "tasks": ["6.3", "6.4", "6.5", "6.6", "6.7", "6.8", "6.9", "6.10"] },
    { "id": 7, "tasks": ["6.11"] },
    { "id": 8, "tasks": ["8.1", "8.2"] },
    { "id": 9, "tasks": ["8.3"] },
    { "id": 10, "tasks": ["10.1", "10.2", "10.3"] },
    { "id": 11, "tasks": ["10.4"] },
    { "id": 12, "tasks": ["10.5"] },
    { "id": 13, "tasks": ["12.1", "12.5"] },
    { "id": 14, "tasks": ["12.2", "12.3", "12.4"] },
    { "id": 15, "tasks": ["14.1"] },
    { "id": 16, "tasks": ["14.2", "14.3", "14.4", "14.5", "14.6"] },
    { "id": 17, "tasks": ["15"] }
  ]
}
```
