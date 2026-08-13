# Handoff — Asset Management Module (lanjut ke agent lain)

## Lokasi kerja

Worktree: `G:\Project App\erp\.claude\worktrees\claude+asset-management-module-5c9577`
Branch: `worktree-claude+asset-management-module-5c9577`
Shell wajib: **PowerShell** (bukan Bash/Git Bash — `php` cuma ada di PATH PowerShell, dikonfirmasi user berkali-kali di sesi ini).

## State repo SAAT INI — belum ada commit

Seluruh pekerjaan Spec 1 (`asset-management-core`) masih **uncommitted** di working tree (`git status` menunjukkan banyak modified + untracked). Sebelum lanjut kerja, cek `git status` dulu, JANGAN asumsikan sudah ter-commit. Kalau mau commit Spec 1 dulu sebelum mulai Spec 2, tanya user — belum ada instruksi eksplisit untuk commit dari sesi sebelumnya.

## Progress sejauh ini

### Spec 1 — `asset-management-core` (SELESAI, siap dipakai sbg fondasi)

Model `Asset`, `AssetCategory`, `AssetLocation` lengkap: migration, model, service, controller, request, lang (id/en), FE (React/Inertia pages di `resources/js/Pages/Asset/`), test suite **91 test PASS, 0 failure**. Menu sidebar sudah didaftarkan (`resources/js/Components/Sidebar/AppSidebar.jsx`, grup "Assets").

Detail lengkap ada di `.kiro/specs/asset-management-core/tasks.md` — baca terutama bagian **Gap 8** (bug fundamental `DataTableConfigValidator` yang diperbaiki sesi ini, PENTING dipahami sebelum sentuh `configColumns` model manapun).

### Bug fix besar sesi ini — `DataTableConfigValidator` (app/Services/Core/DataTableConfigValidator.php)

Validator generik ini (dipakai `php artisan model:cache --strict`, LINTAS SEMUA MODEL, bukan spesifik Asset) punya 3 bug fundamental yang baru diperbaiki:
1. Akses property `protected` (`configColumns`) dari luar class via `??` gagal diam-diam di PHP → validator dari awal TIDAK PERNAH benar-benar membaca config manapun. Fix: `ReflectionProperty::setAccessible(true)`.
2. Method `protected` milik trait `LinkModel` (mis. `appendStatus()`) muncul false-positive "undefined method" via magic `__call()`. Fix: skip Rule 3 untuk method non-public.
3. **Rule 3 sekarang cek urutan tetap TANPA bergantung sinyal `'type' => 'relation'`**: kolom DB fisik → attribute/accessor (`hasAttributeMutator()`/dst) → method relasi publik (`instanceof Relation`) → kalau ketiganya gagal, error. Validasi HANYA jalan untuk key milik `$instance->configColumns` sendiri (bukan `defaultConfigColumns` generik trait `LinkModel`).

**PENTING**: setelah fix ini, full `php artisan model:cache --strict` menemukan **14 violation genuine BARU** di 10 model LAIN (`Log`, `Widget`, `PaymentSchedule`, `PurchaseInvoice`, `PurchaseInvoiceItem`, `SalesInvoice`, `SalesInvoiceItem`, `Ticket`, `ItemUnit`, `PurchaseReceipt`) — bug pre-existing yang baru kedetek. **Sudah di-spawn sebagai task terpisah** (`task_64b72e66`, user sudah start di sesi lain, jalan independen) — jangan duplikasi kerjaan ini.

Kalau kamu edit `configColumns` model manapun (termasuk `Asset`), jalankan `php artisan model:cache --model=<Model> --strict` untuk verifikasi — validator sekarang BENERAN strict.

### Spec 2 — `asset-management-purchase-integration` (BARU DITULIS, BELUM ADA IMPLEMENTASI KODE)

Status: `requirements.md` + `design.md` + `tasks.md` sudah lengkap di `.kiro/specs/asset-management-purchase-integration/`. **Belum ada satupun task diimplementasikan** — semua masih `[ ]` di `tasks.md`.

**Baca file-file ini SEBELUM mulai coding, urutan wajib**:
1. `.kiro/specs/asset-management-purchase-integration/requirements.md` — 7 requirement, semua acceptance criteria hasil tanya-jawab detail dengan user (jangan re-interpretasi, ikuti persis).
2. `.kiro/specs/asset-management-purchase-integration/design.md` — arsitektur teknis, termasuk diagram mermaid alur Event/Listener.
3. `.kiro/specs/asset-management-purchase-integration/tasks.md` — 12 group, ~35 sub-task, urutan implementasi + dependency graph di akhir file.

## Keputusan desain kunci Spec 2 (supaya tidak salah asumsi ulang)

- **Pola Event/Listener, BUKAN inline di service** — ini SENGAJA menyimpang dari pola existing `StockLedgerEntry`/`GeneralLedger` (yang inline di `onApproved()`). User eksplisit pilih Event/Listener meski pola lama inline. Event baru: `App\Events\Asset\FixedAssetItemApproved`. Listener: `App\Listeners\Asset\CreateAssetFromPurchase implements ShouldQueue`.
- **Dispatch event SETELAH `DB::commit()`** di `PurchaseReceiptService::onApproved()` dan `PurchaseInvoiceService::onApproved()` — HANYA tambah 1 baris/loop kecil di akhir method, JANGAN refactor logic Stock/GL existing di sekitarnya (berisiko regresi modul yang sudah stabil).
- **PurchaseReceipt DAN PurchaseInvoice saling melengkapi** (bukan salah satu saja): Receipt approved → buat Asset baru (DRAFT, category/location null). Invoice approved untuk PO yang SAMA dengan Receipt yang sudah bikin Asset → UPDATE Asset itu (isi `purchase_invoice_id` + nilai final), BUKAN bikin baru. Invoice tanpa Receipt (invoice-only) → buat Asset baru dari Invoice.
- **Matching Receipt↔Invoice via `PurchaseOrderItem` bersama** — perlu kolom baru `purchase_receipt_item_id`/`purchase_invoice_item_id` di tabel `assets` (BUKAN cuma `purchase_receipt_id`, karena 1 dokumen bisa punya banyak baris item fixed-asset — perlu presisi per-baris untuk cegah duplikat).
- **asset_category_id/asset_location_id jadi nullable** — edit LANGSUNG migration Spec 1 (`2026_08_08_000004_create_assets_table.php`, belum production, aman diubah retroaktif, JANGAN bikin migration alter terpisah).
- **Status Asset auto-created tetap DRAFT biasa** (bukan status baru) — tapi `submit()`/`checkApproval()` HARUS ditolak (`LogicException`) kalau category/location masih null.
- **Quantity>1 TIDAK otomatis dipecah** — 1 baris Purchase qty=5 → 1 Asset dengan `asset_quantity=5`. Split jadi individual HANYA manual lewat dialog "Lengkapi Data Asset" (tombol opsional "split into N").
- **Dialog inline** di halaman Show PurchaseReceipt/PurchaseInvoice (bukan redirect ke halaman Asset terpisah) — isi category, location, opsi split.
- **Split logic**: sisa pembagian bulat masuk ke bagian PERTAMA (qty 5 split 3 → `[3,1,1]`). Nilai moneter dibagi proporsional per rasio qty. Asset asal di-soft-delete setelah split, semua hasil split mewarisi field lain (nama, dokumen sumber, tanggal) identik.
- Event/Listener baru masuk domain `App\Events\Asset\` dan `App\Listeners\Asset\` (folder domain Asset, BUKAN Purchase) — karena logic-nya "bagaimana Asset terbentuk", ikut aturan struktur folder `{Domain}/{Feature}` project (lihat `CLAUDE.md` project).

## Cara mulai

1. Baca 3 file spec Spec 2 di atas.
2. Mulai dari task 1.1 di `tasks.md` (migration), ikuti urutan wave di dependency graph.
3. Update `tasks.md` — checklist `[ ]` → `[-]` saat mulai, `[x]` HANYA setelah test pass, sebutkan file yang berubah tiap task selesai (aturan project di `CLAUDE.md`).
4. Jalankan test spesifik tiap task selesai (`php artisan test --compact --filter=...`), JANGAN jalankan Pint/lint sampai SEMUA task selesai.
5. Checkpoint (task 2, 4, 6, 8, 10, 12 di tasks.md) — WAJIB stop, jalankan full test suite terkait, baru lanjut.

## Yang JANGAN dilakukan

- Jangan sentuh 10 model di luar Asset yang punya violation `configColumns` (Log, Widget, PaymentSchedule, dll) — itu scope task terpisah (`task_64b72e66`) yang sedang jalan independen di sesi lain.
- Jangan refactor logic Stock/GL existing di `PurchaseReceiptService`/`PurchaseInvoiceService::onApproved()` di luar menambah dispatch event.
- Jangan buat migration alter terpisah untuk nullable `asset_category_id`/`asset_location_id` — edit langsung migration Spec 1 (belum production).
- Jangan commit apapun tanpa konfirmasi eksplisit user (aturan umum project — user harus review dulu).
