# Multiple PR → PO — Implementation Plan

> **For agentic workers:** Baca `requirements.md`, `design.md`, dan **Shared Context** di bawah. Kerjakan satu task `[-]` pada satu waktu; tandai `[x]` setelah tes task itu lulus. Jika memakai subagent, bagikan konteks sesi (`fork_context: true`) dan hasil task sebelumnya. Gunakan `superpowers:subagent-driven-development` atau `superpowers:executing-plans` saat implementasi.

**Goal:** Dari checkbox/action PR, alokasikan beberapa item PR menjadi satu atau beberapa PO draft dengan pilihan satuan per alokasi, warning selisih per item dalam satuan PR, form PO berbasis `FormTable`, layout workspace tetap, serta penyimpanan atomik dan aman diulang.

**Architecture:** Action DataTable2 mengirim ID PR ke endpoint staging. Server menyelesaikan dan memvalidasi sumber, lalu Inertia merender tiga tahap Alokasi → Lengkapi PO → Tinjau. Rancangan PO disimpan sebagai state klien per ID stabil; satu endpoint batch memvalidasi ulang sumber, satuan PO, dan field PO lalu membuat semua draft dalam satu transaksi dengan idempotensi. `PurchaseOrderService::create()` dan relasi referensi item PR tetap dipakai; approval mengonversi qty PO ke satuan PR sebelum menjumlahkan `ordered_quantity`.

**Tech Stack:** Laravel 12 / PHP 8.4 / PHPUnit 11; Inertia v3 / React 19 / Vitest + React Testing Library; komponen UI existing dan Tailwind v4.

**Spec:** `.kiro/specs/purchase-requests-to-purchase-orders/requirements.md`, `.kiro/specs/purchase-requests-to-purchase-orders/design.md`.

## Shared Context

- Worktree saat perencanaan: `D:/Project/erp/.claude/worktrees/datatable2-checkbox-actions-17bfcf`. Gunakan Bash (`C:/Program Files/Git/usr/bin/bash.exe`), bukan PowerShell/cmd. Untuk FE gunakan `npm run build`, **jangan** `npm run dev`. Login browser development `admin/admin`; jangan ubah kredensial DB.
- Fondasi `DataTable2` sudah menyediakan `rowActions` `{key,label,single,bulk,enabled,requires,onAction}`, eligible-only bulk, metadata `$rowActionAttributes` + `dependsOn`, reset seleksi, dan mobile long-press. Action callback mendapat `rows[]` dan `{clearSelection,reload,source}`. Kontrak ada di `.kiro/specs/datatable2-row-actions/`.
- `PurchaseRequests/Show.jsx` saat ini menampilkan Buat PO jika `submitted_at`, `isValidStatus(status)`, dan total `unordered_quantity > 0`. `PurchaseOrderController::create()` hanya mem-prefill satu PR. `PurchaseRequestItem` menyimpan `unordered_quantity`; `PurchaseOrderItem` punya `referenceable_type/id`; `PurchaseOrderService::onApproved()` mengisi `ordered_quantity` sumber melalui `ModelConnection`.
- `PurchaseOrderRequest::rules()` adalah sumber aturan PO tunggal; `AdditionalDiscountRules::make(Request)` dan `PaymentSchedulesRules::make(Request)` juga perlu dipakai batch. `PurchaseOrderService::create(array $data): Model` membuat satu PO dan item/jadwal; `PurchaseOrderController::store()` mengisi `branch_id=session('currentBranch')` dan `created_by_id`.
- `PurchaseOrders/Form.jsx` memakai context `useFormPage`, `FormTable`, `ItemForm`, `AdditionalDiscount`, dan `PaymentSchedule`; jangan menduplikasi rumus total/diskon/pajak. `PurchaseRequest.external_note` adalah catatan sumber dan berbeda dengan catatan PO.
- Revisi disetujui setelah Task 9: tiap alokasi memilih satuan PO milik produk sumber; warning ditempel di item terkait dan dihitung dalam satuan PR (`qty_PO × faktor_PO / faktor_PR`); `FormTable` digunakan dalam mode sumber-terkunci dengan aksi custom; header/sidebar/footer workspace tetap pada viewport. Task 3 sebelumnya mengunci satuan sebagai pengaman sementara, dan digantikan Task 10–11. Task 7–9 sebelumnya telah lulus dalam cakupan awal dan diperluas oleh Task 12–15; status `[x]` historisnya tidak membuktikan revisi baru selesai.
- Route `resourceDetail('purchaseOrder', ...)` memuat route wildcard; route `purchaseOrders/from-requests/*` harus didaftarkan sebelum resource wildcard. Method baru di controller PO harus memetakan permission `create` secara eksplisit lewat `enforcePermission()` atau controller terpisah yang memanggil guard setara. Selain PO:create, cek PR:select/read dan `onlyCreator`/branch untuk setiap PR.
- Perubahan kode PHP: cari docs versi terpasang memakai Laravel Boost `search-docs` jika tersedia, ikuti `laravel-best-practices`; gunakan PHPUnit dan Pint di checkpoint akhir. Di host ini PHP tersedia sebagai `'/mnt/c/Users/Rahmad Maulana/.config/herd/bin/php84/php.exe'` dan Node sebagai `node.exe`; perintah `php artisan ...` dalam checklist berarti panggil executable PHP tersebut. FE UI pakai pola Inertia/RTL project. Tidak menambah dependency. Jangan commit/push kecuali diminta user.
- Model subagent: nilai beban tiap task sebelum spawn. Task mekanis dapat model ringan, backend transaksi/form reuse perlu model menengah/kuat sesuai risiko. Haiku/Sonnet hanya jika tersedia; bila tidak, pilih model runtime yang sepadan. Brief subagent menyebut kontrak yang dihasilkan task sebelumnya dan tes yang sudah lulus; jangan eksplorasi ulang tanpa alasan.

## Task Status

- [x] 1. Kelayakan PR bersama dan metadata DataTable2
- [x] 2. Staging dan resolver sumber yang diotorisasi
- [x] Checkpoint A — sumber dan permission
- [x] 3. Aturan validasi PO yang dapat dipakai ulang dan invariant item sumber
- [x] 4. Penyimpanan draft atomik dan idempotensi
- [x] Checkpoint B — backend end-to-end
- [x] 5. Aksi single/bulk pada index PR
- [x] 6. Model state alokasi dan rancangan
- [x] 7. UI Alokasi dan catatan PR
- [x] 8. Workspace rancangan PO dan pemakaian ulang form existing
- [x] 9. Tinjau, simpan, error recovery, dan hasil
- [x] 10. Validasi dan penyimpanan satuan PO pilihan
- [x] 11. Normalisasi `ordered_quantity` saat approval
- [x] 12. State alokasi dan warning per item lintas satuan
- [x] 13. `FormTable` sumber-terkunci dengan aksi custom
- [x] 14. Shell workspace dengan header/sidebar/footer tetap
- [x] 15. Tinjau dan integrasi lintas satuan
- [x] 16. Dropdown aksi item Lengkapi PO
- [x] Checkpoint C — FE/BE dan browser

Saat memulai, ubah satu baris menjadi `[-]`; `[~]` untuk antrean yang sudah dijadwalkan; `[x]` hanya setelah semua langkah dan tesnya terbukti lulus. Jangan mengerjakan dua task yang bergantung pada file sama secara paralel.

## Review Focus

Kasus berikut harus punya tes pada task pemilik kode, bukan sekadar diingat saat QA:

1. ID PR yang di luar cabang/izin serta `source_item_id` yang tidak termasuk token harus ditolak tanpa membocorkan detail atau membuat PO (Tasks 2 dan 4).
2. PR berubah status atau `unordered_quantity` ketika workspace terbuka: penyimpanan ditolak/menawarkan refresh; nilai form tidak dibuang (Tasks 2, 4, 9).
3. Satu item PR dibagi lintas dua PO/supplier: dua baris berbeda tetap merujuk item sumber yang sama, dengan warning over/under yang tidak memblokir (Tasks 4, 6, 7, 8).
4. Simpan gagal pada rancangan ke-2 atau permintaan diulang: tidak ada draft parsial atau duplikat; hasil retry berisi ID PO yang sama (Task 4).
5. Perubahan supplier/alokasi setelah field PO diisi: dialog konfirmasi dan preservasi nilai rancangan yang tidak terdampak, termasuk nominal/jadwal yang dihitung ulang (Tasks 6 dan 8).
6. Unit PO dari produk lain, terhapus, atau berfaktor nol harus ditolak tanpa membuat sebagian draft; `conversion_factor` dari klien tidak dipercaya (Task 10).
7. Approval dua PO yang merujuk item PR sama dengan satuan berbeda harus menjumlahkan `ordered_quantity` dalam satuan PR; referensi hulu yang berbeda satuan tidak boleh menerima angka mentah (Task 11).
8. Mengganti satuan di Lengkapi PO tanpa mengubah angka qty harus memperbarui warning di Alokasi/Tinjau dan tidak mengubah harga diam-diam (Tasks 12–13).
9. Saat form panjang digulir, header dan sidebar tidak bergeser, footer tetap di dasar viewport, dan aksi item tetap dapat dicapai pada mobile/keyboard (Tasks 13–14).

---

### Task 1: Kelayakan PR bersama dan metadata DataTable2

**Files:** `app/Services/Purchase/FromRequests/PurchaseRequestPoEligibility.php` (baru), `app/Models/Purchase/PurchaseRequest.php`, `resources/js/Pages/Purchase/PurchaseRequests/Show.jsx`, `tests/Feature/Purchase/PurchaseRequestPoEligibilityTest.php` (baru), tes RTL Show terkait.

**Interfaces:** `PurchaseRequestPoEligibility::isEligible(PurchaseRequest $request): bool` menjadi satu keputusan domain bagi accessor dan resolver. `PurchaseRequest::$rowActionAttributes = ['canCreatePo']`; accessor `canCreatePo` diserialisasi meski kolom status/item disembunyikan. Status mengikuti aksi Show existing, dengan query item positif yang efisien.

- [x] Tulis tes gagal: draft/unsubmitted/canceled/closed/need approval ditolak, submitted dengan item `unordered_quantity > 0` diterima, sisa nol ditolak; test DataTable response tanpa kolom status/item tetap berisi `canCreatePo` tanpa N+1 per baris.
- [x] Jalankan `php artisan test --compact tests/Feature/Purchase/PurchaseRequestPoEligibilityTest.php`; pastikan gagal karena kontrak belum tersedia.
- [x] Implementasi service, accessor/`rowActionAttributes`/`dependsOn`; migrasikan kondisi tombol Show ke sumber keputusan yang sama. Jangan membuat accessor memuat semua item untuk setiap baris.
- [x] Jalankan file tes BE itu dan tes Show RTL terkait; tandai `[x]` bila keduanya lulus.

### Task 2: Staging dan resolver sumber yang diotorisasi

**Files:** `app/Services/Purchase/FromRequests/PurchaseRequestPoSourceResolver.php` (baru), `app/Http/Controllers/Purchase/PurchaseOrderFromRequestsController.php` (baru), `routes/web.php`, `tests/Feature/Purchase/PurchaseOrderFromRequestsStageTest.php` (baru).

**Interfaces:** `POST purchaseOrders.fromRequests.stage` menerima `{ids: string[]}` dan memberi redirect ke `GET purchaseOrders.fromRequests.show` dengan token. Resolver menerima ID PR, user, dan cabang aktif, lalu mengembalikan payload sumber termasuk `PurchaseRequestItem`, variant, unit, `unordered_quantity`, kode PR, dan `external_note`. Token menyimpan ID sumber + user/cabang + waktu kedaluwarsa, tetap berlaku selama navigasi/retry sampai save berhasil.

- [x] Tulis tes gagal untuk single/multi ID valid, duplikat/malformed/lebih dari batas, PR tanpa izin, `onlyCreator`, cabang lain, stale/tidak layak, token user lain/kedaluwarsa, dan N+1 saat memuat banyak item.
- [x] Jalankan `php artisan test --compact tests/Feature/Purchase/PurchaseOrderFromRequestsStageTest.php`; pastikan kegagalan relevan.
- [x] Implementasi route sebelum wildcard PO, permission PO:create + PR:select/read, resolver dengan eager load, session token ber-TTL dan halaman Inertia workspace. GET tidak mengonsumsi token.
- [x] Jalankan tes file ini dan tes route/permission PO existing (`tests/Feature/Purchase/PurchaseOrderPermissionTest.php`); tandai `[x]` bila lulus.

### Checkpoint A: Sumber dan permission

- [x] Jalankan Task 1 dan 2 beserta tes permission PR/PO yang terdampak. Pastikan field action, route staging, scope cabang, dan token tetap konsisten sebelum menyusun endpoint penyimpanan.

### Task 3: Aturan validasi PO yang dapat dipakai ulang dan invariant item sumber

**Files:** `app/Http/Requests/Purchase/PurchaseOrderRequest.php`, `app/Http/Requests/Purchase/PurchaseOrderBatchRequest.php` (baru), kelas aturan bersama di `app/Http/Requests/Purchase/` bila diperlukan, `tests/Feature/Purchase/PurchaseOrderBatchValidationTest.php` (baru), tes form PO tunggal terkait.

**Interfaces:** Validator batch menerima `{token,idempotency_key,drafts:[{id,supplier,items:[{id,source_item_id,item,unit,quantity,rate,target_warehouse,...}],...}]}`. Field PO per `drafts.*` harus memakai aturan yang sama dengan `PurchaseOrderRequest`, termasuk tanggal, diskon, dan jadwal pembayaran. Hanya identitas item sumber yang dipasok dari token; quantity positif sesuai aturan PO existing. Untuk item PR, cek unit sumber/konversi sebelum menetapkan perilaku perubahan unit yang aman.

- [x] Tulis tes gagal untuk header/item/jadwal diskon tidak valid pada rancangan kedua dengan path error tepat, qty `0` ditolak tetapi qty di bawah/di atas kebutuhan diterima, varian atau satuan sumber yang tidak cocok ditolak tanpa melepaskan referensi.
- [x] Jalankan `php artisan test --compact tests/Feature/Purchase/PurchaseOrderBatchValidationTest.php`; pastikan gagal relevan.
- [x] Ekstrak aturan PO agar tunggal dan batch berbagi aturan. `AdditionalDiscountRules::make()` dan `PaymentSchedulesRules::make()` menerima `Request`; sediakan konteks per rancangan atau rule factory berbasis payload yang mempertahankan perilaku PO tunggal. Kunci satuan item PR di alur batch sesuai design karena approval existing menjumlahkan qty tanpa konversi.
- [x] Jalankan tes batch dan tes PO existing yang menyentuh validasi; tandai `[x]` bila lulus.

### Task 4: Penyimpanan draft atomik dan idempotensi

**Files:** `app/Services/Purchase/FromRequests/PurchaseOrderBatchService.php` (baru), `app/Models/Purchase/PurchaseOrderBatchSubmission.php` (baru bila memakai tabel), migrasi `database/migrations/*create_purchase_order_batch_submissions_table.php` (baru bila memakai tabel), `app/Http/Controllers/Purchase/PurchaseOrderFromRequestsController.php`, `routes/web.php`, `tests/Feature/Purchase/PurchaseOrderFromRequestsStoreTest.php` (baru).

**Interfaces:** `POST purchaseOrders.fromRequests.store` menerima payload tervalidasi Task 3. `GET purchaseOrders.fromRequests.result` menampilkan daftar kode/tautan PO milik user/cabang untuk token hasil. `PurchaseOrderBatchService::createDrafts()` mengembalikan daftar PO setelah satu transaksi. Idempotency key unik terikat user, cabang, token, dan hash payload; request ulang yang identik mengembalikan hasil lama.

- [x] Tulis tes gagal: satu PR → satu PO, beberapa PR → satu PO, multi supplier → beberapa PO, supplier sama → beberapa PO, dua baris ke satu item PR, qty kurang/lebih, draft tanpa menaikkan `ordered_quantity`, referensi palsu/cabang lain, sumber berubah, gagal PO kedua rollback, klik ganda/retry tidak membuat duplikat, key sama payload berbeda ditolak.
- [x] Jalankan `php artisan test --compact tests/Feature/Purchase/PurchaseOrderFromRequestsStoreTest.php`; pastikan gagal relevan.
- [x] Implementasi transaksi yang mengunci sumber dalam urutan deterministik, memvalidasi ulang izin/status/item, membangun referensi item dari sumber server, memanggil `PurchaseOrderService::create()` per rancangan, dan menyimpan hasil idempotensi secara durable dengan unique key. Jangan membangun `referenceable_type` dari input klien. Kembalikan error per rancangan/baris dan redirect hasil GET setelah commit.
- [x] Jalankan tes store + validasi + permission PO; tandai `[x]` bila lulus.

### Checkpoint B: Backend end-to-end

- [x] Jalankan semua tes BE fitur (Tasks 1–4) dan tes approval PO/PR terkait. Konfirmasi bahwa multi item PR tetap dapat ditelusuri dan `ordered_quantity` baru berubah di jalur approval existing.

### Task 5: Aksi single/bulk pada index PR

**Files:** `resources/js/Pages/Purchase/PurchaseRequests/Index.jsx`, `resources/js/Pages/Purchase/PurchaseRequests/Index.rtl.test.jsx` (baru/ubah), terjemahan `lang/id/purchase/*` dan `lang/en/purchase/*` yang relevan.

**Interfaces:** Action `{key:'createPo', single:true, bulk:true, enabled:row => row.canCreatePo === true, requires:['canCreatePo'], onAction:(rows)=>...}` mengirim hanya `rows.map(row => row.id)` ke route stage Task 2. Permission create PO menyembunyikan action. Bulk skip mengikuti fondasi DataTable2.

- [x] Tulis tes RTL gagal: action satu baris, bulk campuran hanya ID layak, tanpa permission tak ada action, mobile selection membuka alur yang sama, kegagalan stage menampilkan error.
- [x] Jalankan `node.exe node_modules/vitest/vitest.mjs run resources/js/Pages/Purchase/PurchaseRequests/Index.rtl.test.jsx`; pastikan gagal relevan.
- [x] Tambahkan action + label terjemahan; navigasi dari response staging ke workspace, tanpa menaruh daftar ID sensitif di URL.
- [x] Jalankan tes RTL file ini dan tes DataTable2 action terkait; tandai `[x]` bila lulus.

### Task 6: Model state alokasi dan rancangan

**Files:** `resources/js/Pages/Purchase/PurchaseOrders/FromRequests/allocationState.js` (baru), `resources/js/Pages/Purchase/PurchaseOrders/FromRequests/allocationState.test.js` (baru).

**Interfaces:** Fungsi murni `createInitialState(sources)`, `setAllocationQuantity(state,id,quantity)`, `splitAllocation(state,id,splitQuantity)`, `moveAllocation(state,id,draftId)`, `changeDraftSupplier(state,draftId,supplier)`, `reconcileDrafts(state)`, dan `getQuantityWarnings(state,sources)` memakai ID item sumber/ID rancangan stabil. Draft PO per supplier pada awalnya, lalu boleh dipecah manual.

- [x] Tulis tes gagal untuk satu item di dua supplier, dua PR dengan variant sama tetap terpisah, split menjaga total, edit qty memunculkan warning kurang/lebih, pindah tidak mengubah total, ganti supplier memerlukan flag konfirmasi, perubahan alokasi mempertahankan field draft tak terdampak, rancangan kosong dibuang.
- [x] Jalankan `node.exe node_modules/vitest/vitest.mjs run resources/js/Pages/Purchase/PurchaseOrders/FromRequests/allocationState.test.js`; pastikan gagal relevan.
- [x] Implementasi reducer/helper murni dan kontrak state di atas; jangan campurkan operasi HTTP/UI ke fungsi ini.
- [x] Jalankan tes fungsi murni; tandai `[x]` bila lulus.

### Task 7: UI Alokasi dan catatan PR

**Files:** `resources/js/Pages/Purchase/PurchaseOrders/FromRequests/Workspace.jsx` (baru), `AllocationStep.jsx` (baru), `PurchaseRequestNotes.jsx` (baru), `AllocationStep.rtl.test.jsx` dan `PurchaseRequestNotes.rtl.test.jsx` (baru), terjemahan purchase terkait.

**Interfaces:** Workspace menerima props Inertia dari Task 2, menyimpan state Task 6, dan memulai di tahap Alokasi. `AllocationStep` menampilkan item PR, supplier, qty, tambah/hapus alokasi, warning per item PR. `PurchaseRequestNotes` menerima daftar PR unik dan menampilkan `external_note` lengkap dengan kode/tautan.

- [x] Tulis tes RTL gagal: nilai awal `unordered_quantity`, supplier wajib, bagi ke dua supplier, hapus semua alokasi mencegah lanjut, warning over/under tidak mencegah lanjut, catatan panjang/kosong/duplikat PR, input tetap ada saat langkah berganti.
- [x] Jalankan tes RTL dua file tersebut; pastikan gagal relevan.
- [x] Implementasi komponen memakai komponen standar (FormInput, Select/LinkModel, NumberInput, Alert, Collapsible, Button), state loading/empty/error, dan tampilan mobile responsif.
- [x] Jalankan tes RTL terkait; tandai `[x]` bila lulus.

### Task 8: Workspace rancangan PO dan pemakaian ulang form existing

**Files:** `resources/js/Pages/Purchase/PurchaseOrders/Form.jsx`, komponen field bersama `resources/js/Pages/Purchase/PurchaseOrders/PurchaseOrderFields.jsx` (baru bila perlu), `FromRequests/DraftStep.jsx` (baru), `FromRequests/DraftStep.rtl.test.jsx` (baru), `resources/js/Pages/Purchase/PurchaseOrders/Form.rtl.test.jsx`.

**Interfaces:** `DraftStep` menerima `draftsById`, `activeDraftId`, dan setter Task 6. Form shared menerima `data`, `setData`, error per draft, serta konfigurasi sumber PR terkunci; PO tunggal memakai field/perhitungan yang sama. Sidebar daftar rancangan di kiri desktop, form lengkap di kanan; mobile memakai pemilih rancangan di atas panel.

- [x] Tulis tes RTL gagal: dua draft mempertahankan tanggal/mata uang/harga/catatan masing-masing, split supplier sama, pindah/bagi item dengan kode PR tetap benar, konfirmasi perubahan supplier, nominal/pajak/jadwal pembayaran terhitung ulang, catatan PR hanya dari draft aktif, layout mobile tetap punya aksi penting.
- [x] Jalankan tes `DraftStep.rtl.test.jsx` dan `Form.rtl.test.jsx`; pastikan tes baru gagal relevan dan catat baseline tes PO tunggal.
- [x] Ekstrak field/perhitungan PO tanpa mengubah perilaku form tunggal. Bangun sidebar + panel persis urutan visual `design.md`, gunakan komponen existing. Hubungkan aksi Pindah/Bagi qty ke state Task 6 dan panel catatan Task 7.
- [x] Jalankan dua file tes; tandai `[x]` bila lulus.

### Task 9: Tinjau, simpan, error recovery, dan hasil

**Files:** `resources/js/Pages/Purchase/PurchaseOrders/FromRequests/ReviewStep.jsx` (baru), `FromRequests/Result.jsx` (baru), `FromRequests/Workspace.jsx`, tes RTL `ReviewStep.rtl.test.jsx` dan `Workspace.rtl.test.jsx` (baru), terjemahan terkait.

**Interfaces:** Review memetakan rancangan ke payload Task 3 dengan `token`, `idempotency_key`, dan `drafts[]`. POST Task 4 dilakukan sekali per klik; error backend dipetakan ke draft/baris, state klien dipertahankan. Sukses membuka GET result Task 4 dengan semua tautan PO.

- [x] Tulis tes RTL gagal: ringkasan beberapa mata uang terpisah, kode PR per PO, warning qty tetap terlihat, validasi field menghalangi simpan tetapi warning tidak, request pending menonaktifkan tombol, error draft kedua mempertahankan isian, retry memakai key sama, hasil menampilkan semua PO.
- [x] Jalankan tes `ReviewStep.rtl.test.jsx` dan `Workspace.rtl.test.jsx`; pastikan gagal relevan.
- [x] Implementasi review, pemetaan payload/error, panggilan save, dan halaman hasil. Pertahankan field saat sumber stale dan sediakan refresh sumber yang meminta konfirmasi sebelum mengganti snapshot.
- [x] Jalankan tes file terkait; tandai `[x]` bila lulus.

### Task 10: Validasi dan penyimpanan satuan PO pilihan

**Files:** `app/Http/Requests/Purchase/PurchaseOrderBatchRequest.php`, `app/Services/Purchase/FromRequests/PurchaseOrderBatchService.php`, `app/Services/Purchase/FromRequests/PurchaseRequestPoSourceResolver.php`, `tests/Feature/Purchase/PurchaseOrderBatchValidationTest.php`, `tests/Feature/Purchase/PurchaseOrderFromRequestsStoreTest.php`.

**Interfaces:** `drafts.*.items.*.unit` menerima ID `ItemUnit` aktif untuk `item_id` produk varian sumber. Faktor konversi diambil hanya dari DB, tidak dari payload. Unit PR tetap default. `sourceVersion` mendeteksi perubahan faktor sumber yang membuat snapshot alokasi stale.

- [x] Tambahkan tes gagal: unit alternatif satu produk tersimpan beserta faktor server; unit produk lain, nonaktif/terhapus, atau faktor tidak positif ditolak; manipulasi `conversion_factor` klien diabaikan; kegagalan item di draft kedua tidak menghasilkan draft parsial; perubahan faktor sumber memicu stale.
- [x] Jalankan `php artisan test --compact tests/Feature/Purchase/PurchaseOrderBatchValidationTest.php tests/Feature/Purchase/PurchaseOrderFromRequestsStoreTest.php`; pastikan tes baru gagal untuk kontrak yang belum ada.
- [x] Validasi unit lewat produk varian sumber dan query DB, lalu teruskan unit terpilih ke `PurchaseOrderService::create()` tanpa menimpa identitas item/PR. Jangan mengubah perilaku create PO tunggal. Perbarui hash versi sumber hanya untuk atribut yang memengaruhi konversi.
- [x] Jalankan ulang dua file tes dan tes create PO tunggal terkait; tandai `[x]` hanya setelah lulus.

### Task 11: Normalisasi `ordered_quantity` saat approval

**Files:** `app/Services/Purchase/PurchaseOrderService.php`, helper konversi di `app/Services/Purchase/FromRequests/` bila perlu, `app/Traits/Submitable.php`, tes approval PO/PR terkait di `tests/Feature/Purchase/`.

**Interfaces:** Setiap edge referensi PO→PR mengonversi `quantity_PO × conversion_factor_PO / conversion_factor_PR` sebelum menambah `ordered_quantity` PR. Jika referensi diteruskan ke hulu dengan unit berbeda, konversi kembali dilakukan untuk edge itu. Alur approval selain PO→PR tetap seperti sebelumnya.

- [x] Tambahkan tes gagal: satu PO beda unit, dua PO dengan unit berbeda ke satu item PR, faktor desimal, dan rantai referensi hulu; pembatalan/rollback approval tidak meninggalkan jumlah parsial. Pastikan tes unit sama existing tetap hijau.
- [x] Jalankan tes approval terfokus dengan `php artisan test --compact --filter=<nama_tes>`; pastikan kasus baru gagal pada angka mentah, bukan pada setup.
- [x] Terapkan konversi terpusat dari faktor tersimpan pada setiap edge yang relevan, dengan pembulatan/precision mengikuti kolom model existing. Hindari mengonversi data yang sudah dalam satuan target atau memengaruhi alur referensi lain.
- [x] Jalankan tes baru serta tes approval PO existing; tandai `[x]` setelah lulus.

### Task 12: State alokasi dan warning per item lintas satuan

**Files:** `resources/js/Pages/Purchase/PurchaseOrders/FromRequests/allocationState.js`, `allocationState.test.js`, `draftData.js`, `draftData.test.js`, `AllocationStep.jsx`, `AllocationStep.rtl.test.jsx`.

**Interfaces:** Alokasi menyimpan `unit` pilihan per baris. Saat unit berubah, angka qty dan harga tetap, tetapi ekuivalen PR dihitung ulang sebagai `qty_PO × faktor_PO / faktor_PR`. `getQuantityWarnings` mengelompokkan seluruh alokasi berdasarkan `source_item_id` dan menghasilkan selisih per item dalam satuan PR; warning tidak memblokir tahap berikutnya.

- [x] Tambahkan tes gagal: default unit PR, pilihan unit produk sama, perubahan unit mempertahankan angka qty/harga, split/move mempertahankan unit, dua alokasi beda unit menghasilkan selisih tepat, warning tiap item independen, payload draft memakai unit pilihan.
- [x] Jalankan `node.exe node_modules/vitest/vitest.mjs run resources/js/Pages/Purchase/PurchaseOrders/FromRequests/allocationState.test.js resources/js/Pages/Purchase/PurchaseOrders/FromRequests/draftData.test.js resources/js/Pages/Purchase/PurchaseOrders/FromRequests/AllocationStep.rtl.test.jsx`; pastikan kegagalan baru relevan.
- [x] Perbarui helper murni, pilihan satuan dari sumber, dan warning lokal di kartu item; hapus banner selisih global dari tahap Alokasi. Pastikan unit pilihan dan faktor disinkronkan setelah pengguna kembali dari tahap Lengkapi PO.
- [x] Jalankan ulang tiga file tes; tandai `[x]` setelah lulus.

### Task 13: `FormTable` sumber-terkunci dengan aksi custom

**Files:** `resources/js/Components/FormTable.jsx`, `FormTable.test.js` dan tes RTL baru di dekatnya, `resources/js/Pages/Purchase/PurchaseOrders/Form.jsx`, `Form.rtl.test.jsx`, `FromRequests/DraftStep.jsx`, `DraftStep.rtl.test.jsx`.

**Interfaces:** Tambahkan mode opt-in `FormTable` untuk baris sumber tetap: tidak ada baris kosong otomatis atau tombol bawaan tambah/duplikat/hapus/reorder; kolom editable dan `actions` custom tetap bekerja. Form PO biasa tidak berubah. Item draft menampilkan identitas PR/produk terkunci, unit PO editable, qty/harga/pajak/warehouse existing, aksi Pindah/Bagi dari state alokasi.

- [x] Tambahkan tes gagal komponen: mode terkunci tidak mencipta baris kosong, tidak mengubah identitas sumber, tidak menampilkan aksi default, tetapi custom Pindah/Bagi dan edit kolom aktif; mode normal tetap berperilaku sama.
- [x] Jalankan tes `FormTable` terkait dan `Form.rtl.test.jsx`/`DraftStep.rtl.test.jsx`; pastikan tes baru gagal relevan.
- [x] Implementasikan opsi opt-in di `FormTable`, gunakan `itemColumns` shared PO pada mode sumber-terkunci, dan pindahkan daftar item custom DraftStep ke `FormTable`. Saat unit diubah, pertahankan angka qty dan harga lalu sinkronkan state alokasi untuk warning/review.
- [x] Jalankan ulang tes komponen, Form, dan DraftStep; tandai `[x]` setelah lulus.

### Task 14: Shell workspace dengan header/sidebar/footer tetap

**Files:** `resources/js/Layouts/AppLayout.jsx` (opsi scroll hanya untuk workspace), `resources/js/Pages/Purchase/PurchaseOrders/FromRequests/Workspace.jsx`, `DraftStep.jsx`, `Workspace.rtl.test.jsx`, `DraftStep.rtl.test.jsx`.

**Interfaces:** Workspace memakai tinggi viewport yang tersisa setelah topbar; header dan stepper tetap terlihat, area konten saja yang scroll. Pada desktop sidebar draft tetap saat panel form panjang digulir. Footer aksi merupakan sibling di luar scroll dan menempel ke dasar viewport, bukan `sticky` pada akhir konten. Mobile tetap memiliki area scroll serta tombol/aksi yang dapat diakses keyboard.

- [x] Tambahkan tes gagal untuk struktur shell/scroll dan keberadaan footer pada ketiga tahap; tes RTL memastikan navigasi keyboard/aksi tidak hilang pada mobile. Catat baseline posisi melalui browser sebelum patch bila perlu.
- [x] Jalankan tes Workspace/DraftStep RTL; pastikan tes baru gagal relevan.
- [x] Tambahkan override layout yang terisolasi pada halaman ini, susun header/stepper, sidebar, panel scroll, dan footer sebagai area flex/grid yang eksplisit. Jangan mengubah posisi layout halaman lain.
- [x] Jalankan ulang tes RTL; verifikasi browser dengan scroll dan `getBoundingClientRect()` pada desktop/mobile untuk topbar, sidebar, dan footer; tandai `[x]` hanya bila posisinya stabil.

### Task 15: Tinjau dan integrasi lintas satuan

**Files:** `resources/js/Pages/Purchase/PurchaseOrders/FromRequests/ReviewStep.jsx`, `ReviewStep.rtl.test.jsx`, `Workspace.jsx`, `Workspace.rtl.test.jsx`, `draftData.js`, tes integrasi BE/FE yang terdampak, terjemahan purchase terkait.

**Interfaces:** Review memperlihatkan unit tiap item dan warning tepat di item sumber; payload batch memakai unit pilihan tersinkronkan. Ketidaksesuaian qty adalah informasi, bukan error validasi. Simpan tetap atomik/idempotent dan menghasilkan draft tanpa menaikkan `ordered_quantity` sampai approval.

- [x] Tambahkan tes gagal perjalanan Alokasi→Lengkapi→Tinjau→kembali: ubah unit/qty pada FormTable, warning per item terbarui, unit pada review/payload tepat, item PR lain tidak berubah, retry memakai payload/key yang sama.
- [x] Jalankan tes Review/Workspace/draftData terfokus; pastikan tes baru gagal relevan.
- [x] Sinkronkan ReviewStep, pemetaan payload, label terjemahan, dan error tanpa banner warning global. Pertahankan input draft pada error backend/stale source.
- [x] Jalankan ulang tes FE terfokus serta tes backend batch; tandai `[x]` setelah lulus.

### Task 16: Dropdown aksi item Lengkapi PO

**Files:** `resources/js/Pages/Purchase/PurchaseOrders/FromRequests/DraftStep.jsx`, `DraftStep.rtl.test.jsx`.

**Interfaces:** Hanya aksi custom item pada Lengkapi PO memakai pemicu `⋯` dan dropdown Edit/Bagi qty/Pisahkan PO serta submenu Pindah bila ada rancangan tujuan. FormTable umum dan form PO tunggal tetap seperti sekarang.

- [x] Ubah tes RTL untuk membuktikan aksi tersembunyi sebelum menu dibuka, callback tiap aksi tetap berjalan, dan submenu tujuan dapat dipilih melalui keyboard.
- [x] Jalankan tes baru dan pastikan gagal pada tampilan tombol/select lama.
- [x] Ganti `SourceItemActions` dengan komponen `DropdownMenu` project; pertahankan callback/state yang ada.
- [x] Jalankan tes FE fokus dan verifikasi browser desktop/mobile; tandai `[x]` setelah lulus.

### Checkpoint C: FE/BE dan browser

- [x] Jalankan tes fokus semua file BE/FE fitur serta tes regresi PO tunggal/approval dan DataTable2 row actions. Perbaiki hanya regresi yang berasal dari fitur ini.
- [x] Jalankan `php vendor/bin/pint --dirty --format agent`, `npm run lint`, `npm run build`; setelah formatter, ulang tes terpengaruh. Bila `npm` Windows tidak tersedia di Bash, gunakan `node.exe 'C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js' run lint` dan `... run build`. Build hanya via `npm run build`. Pint dijalankan per file PHP yang berubah karena mode `--dirty`/multi-path macet pada Git worktree Windows ini; semua file lulus.
- [x] Jalankan suite penuh BE `php artisan test --compact` dan FE `node.exe node_modules/vitest/vitest.mjs run` setelah tes fokus lulus; catat jumlah lulus/gagal dan jangan perbaiki kegagalan yang tak terkait fitur tanpa persetujuan scope. FE: 479 file/6.690 tes lulus. BE: 767 tes Unit (2.509 assertion, 2 skipped) dan 1.608 tes Feature (5.359 assertion) lulus lewat PHPUnit/ParaTest langsung. Worker ParaTest memerlukan `--passthru-php="-d memory_limit=1G"`; Unit memakai PHP CLI tanpa Xdebug dengan JIT agar tes performa gambar yang tidak terkait fitur memenuhi ambang 3 detik. Tidak ada test aplikasi yang diubah untuk ambang tersebut.
- [x] Verifikasi browser desktop + mobile: single dan bulk PR, skip yang tidak layak, alokasi multi supplier, catatan PR, split supplier sama, pilih unit PO berbeda dan lihat selisih per item dalam unit PR, edit item melalui `FormTable`, isi beberapa rancangan, review, simpan beberapa draft, tautan hasil, retry/error. Ukur bahwa topbar/sidebar/footer tidak bergeser saat konten panjang digulir. Gunakan `admin/admin` di development tanpa mengubah kredensial DB. Bersihkan hanya fixture uji yang disetujui.
- [x] Tinjau diff terhadap R1–R5, cek tidak ada migrasi/perubahan di luar fitur, dan tandai semua checkpoint `[x]` hanya jika bukti lulus. Laporkan batasan verifikasi yang nyata.

## Handoff implementasi

Task saling bergantung: 1→2→3→4 untuk backend; 2→5, 6→7→8→9 untuk FE; Task 9 membutuhkan endpoint Task 4. Revisi 10→11 untuk backend, 12→13→14→15 untuk FE; Task 15 memerlukan Task 10–13. Kerjakan lokal sesuai keputusan user setelah kredit subagent habis; jangan menjalankan task yang menyentuh file sama secara paralel. Sebelum mulai implementasi, review kembali kontrak satuan, idempotensi, normalisasi approval, dan reuse form PO karena empat titik ini paling berisiko.
