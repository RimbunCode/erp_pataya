# Implementation Plan: LinkModel Fetch Optimization

## Overview

Migrasi fetch-layer `LinkModel.jsx` dari `axios`+manual-cache ke TanStack Query, mengikuti pola `useQuery` yang sudah dipakai `DashboardBlocks`. Perubahan inti: hook baru `useLinkModelOptions.js` (dedup, debounce-aware `queryKey`, persister per mode `cacheStorage`, `staleTime`), fix bug `filters` diabaikan saat `cache` mode aktif, hapus dead code `validateWithOperators()`, sederhanakan prop `cache` jadi boolean-only, tambah prop `staleTime`. Props publik lainnya, endpoint backend `route("model")`, dan UI/UX visual TIDAK berubah — 39 komponen turunan `*LinkModel.jsx` tetap jalan tanpa modifikasi kode-nya sendiri (hanya test file pendampingnya yang perlu wrapper `QueryClientProvider`, karena `useQuery` sekarang selalu dipanggil di dalam `LinkModel`).

## Tasks

- [ ] 1. Persiapan: dependency & pembersihan dead code
  - [x] 1.1 ~~Tambah dependency `@tanstack/query-sync-storage-persister`/`@tanstack/query-async-storage-persister`~~ — DIBATALKAN & di-uninstall
    - Sempat di-install, TAPI dibatalkan saat implementasi Task 3.3: API paket ini beroperasi di level SELURUH `QueryClient` (`persistQueryClient`), tidak cocok untuk kebutuhan per-instance/per-`cacheStorage`-berbeda dalam satu `QueryClient` yang dishare. Lihat koreksi di `design.md`.
    - Persistence `cacheStorage` diimplementasikan manual (tanpa dependency baru) di Task 3.3 — reuse pola `readCache`/`writeCache`/`removeCache` dari `LinkModel.jsx` lama
    - _Requirements: 3.1_
  - [x] 1.2 Hapus `validateWithOperators()` dari `resources/js/lib/linkModelUtils.js`
    - Hapus fungsi (baris 3-182 versi saat ini), sisakan `validate()` dan `convertTemplateLink()` apa adanya
    - _Requirements: 4.4, 5.1, 5.2_
  - [ ] 1.3 Write test: verifikasi `linkModelUtils.test.js` tetap lulus tanpa modifikasi
    - **Regression check: penghapusan dead code tidak mempengaruhi `validate()`/`convertTemplateLink()`**
    - Jalankan `npm run test -- linkModelUtils` — pastikan hijau tanpa perlu mengubah file test
    - **Validates: Requirements 5.3**

- [x] 2. Checkpoint - Pastikan test `linkModelUtils` hijau
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 3. Hook baru: `resources/js/Hooks/useLinkModelOptions.js`
  - [x] 3.1 Implement `useQuery` untuk jalur pengisian opsi dropdown (search-mode & cache-mode)
    - Terima params: `model`, `filters`, `filterForDefaultValue`, `joins`, `with`, `fields`, `keywords`, `order`, `translate`, `search` (raw), `cacheMode` (boolean, dari prop `cache` yang sudah disederhanakan), `cacheStorage`, `staleTime`
    - Kelola `debouncedSearch` secara internal (delay 500ms, pola sama `LinkModel.jsx:528-542` versi lama)
    - `queryKey` mode search: `["linkModel", model, filtersKey, debouncedSearch, joins, with, order, keywords]`
    - `queryKey` mode cache: SAMA TANPA `debouncedSearch` (search-nya difilter di client via `filteredOptions`, tidak berubah dari implementasi lama)
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3_
  - [x] 3.2 Fix bug: selalu sertakan `filters`+`filterForDefaultValue` di payload, TERLEPAS `cacheMode` aktif/tidak
    - Hapus pengecualian `!isCacheRequest` KHUSUS untuk `filters` — `search`/`order`/`limit`/`fields`/`with` TETAP dikecualikan di cache-mode seperti implementasi lama (filtering-nya tetap di client untuk field-field itu)
    - `queryKey`/`cacheKey` TIDAK perlu berubah — sudah benar menghitung `filters`
    - _Requirements: 4.1, 4.2, 4.3_
  - [x] 3.3 Wire persistence manual per mode `cacheStorage` + `staleTime` (BUKAN via plugin resmi — lihat koreksi Task 1.1)
    - Baca snapshot tersimpan (`localStorage`/`sessionStorage` via Storage API, `indexedDB` via helper) SEBELUM `useQuery` mount, oper sebagai `initialData`+`initialDataUpdatedAt` (timestamp ASLI kapan data itu di-fetch, BUKAN `Date.now()` saat restore)
    - Tulis-balik (write-through) ke storage yang sama saat fetch sukses (`onSuccess`/setelah `data` berubah)
    - `memory`/cache nonaktif → TANPA baca/tulis storage
    - Pastikan `staleTime` vs `initialDataUpdatedAt` yang menentukan kapan background-refetch terpicu (stale-while-revalidate — BUKAN "restore = selalu dianggap fresh")
    - _Requirements: 3.1, 3.2, 3.3, 3.5_
  - [x] 3.4 Write unit test untuk `useLinkModelOptions.js` (`renderHook` + `QueryClientProvider` wrapper + mock `axios`)
    - **Dedup: dua pemanggilan hook dengan params identik (model+filters+joins+debouncedSearch sama) hanya menghasilkan 1 network call**
    - **Debounce: rentetan perubahan `search` yang cepat menghasilkan HANYA 1 fetch untuk nilai final, bukan 1 fetch per huruf**
    - **Cache-mode filters: payload request saat `cacheMode: true` menyertakan `filters` yang benar (regression test bug fix task 3.2)**
    - **staleTime: data hasil restore dari mock storage yang SUDAH lewat `staleTime` memicu background refetch; yang BELUM lewat tidak fetch ulang**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 2.2, 2.3, 3.2, 3.3, 4.1, 4.3**

- [x] 4. Checkpoint - Pastikan seluruh test `useLinkModelOptions` hijau
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Refactor `resources/js/Components/LinkModel.jsx`
  - [x] 5.1 Ganti internal fetch logic (state `options`/`loading`/`getModels`, effect jalur search-debounce & on-open) dengan `useLinkModelOptions`
    - Jalur resolve `defaultValue` dan jalur resolve-by-id setelah `FormPageDialog` sukses TETAP imperative `axios`, TIDAK disentuh (lihat Requirement 1.4)
    - State `search` (raw, untuk `<Input>`) TETAP ada terpisah dari `debouncedSearch` — update instan tiap keystroke, diteruskan ke hook sebagai raw value
    - _Requirements: 1.4, 2.1, 6.1, 6.3_
  - [x] 5.2 Tambah prop `staleTime` (default `120000`) dan sederhanakan prop `cache` jadi boolean-only
    - Hapus cabang parsing `typeof cache === "object"` di `cacheConfig` (`LinkModel.jsx:117-128` versi lama) — bentuk object `{enabled, refreshMs}` TIDAK didukung lagi sama sekali
    - Update JSDoc `@param props.cache` dari `boolean | { enabled?, refreshMs? }` jadi `boolean`; tambah `@param props.staleTime`
    - _Requirements: 3.3, 3.5, 6.2, 6.4_
  - [x] 5.3 Update `resources/js/Components/LinkModel.rtl.test.jsx` — bungkus `QueryClientProvider` di test setup
    - Pola sama `QuickListBlock.rtl.test.jsx:289-300`
    - Tambah test case: 2 instance `LinkModel` dengan props identik mount bersamaan → hanya 1 network call (dedup end-to-end lewat komponen, melengkapi test hook di 3.4)
    - _Requirements: 7.1, 7.3_

- [x] 6. Checkpoint - Pastikan `LinkModel.rtl.test.jsx` hijau
  - Ensure all tests pass, ask the user if questions arise.
  - **Catatan penting**: pada titik ini, 38 test file turunan lain (`*LinkModel.rtl.test.jsx` di Task 7) DIPERKIRAKAN GAGAL dengan error semacam "No QueryClient set". Ini EXPECTED, BUKAN regresi — `LinkModel.jsx` sekarang selalu memanggil `useQuery` secara internal, jadi test apa pun yang me-render turunannya butuh `QueryClientProvider`. Diperbaiki di Task 7.

- [ ] 7. Rollout `QueryClientProvider` ke seluruh test turunan `*LinkModel.rtl.test.jsx`
  - [x] 7.1 Bungkus `QueryClientProvider` (pola sama Task 5.3) di 39 file test turunan berikut (dikoreksi dari estimasi awal 38 — `find` ulang saat eksekusi menghasilkan 39, `CurrencyLinkModel.rtl.test.jsx` sudah dikerjakan lebih dulu sebagai probe empiris `vi.waitFor`, sisa 38 dikerjakan via 4 agent paralel — SEMUA lulus, 1 bug asli ditemukan+diperbaiki: `CountryLinkModel.rtl.test.jsx` kurang `sessionStorage.clear()` di `beforeEach`, lihat Notes) — TIDAK ada perubahan pada file komponen `*LinkModel.jsx` itu sendiri (Requirement 6.3), hanya file test-nya:
    - `resources/js/Components/ChartLinkModel.rtl.test.jsx`
    - `resources/js/Components/NumberCardLinkModel.rtl.test.jsx`
    - `resources/js/Pages/Asset/Assets/AssetLinkModel.rtl.test.jsx`
    - `resources/js/Pages/Asset/Categories/AssetCategoryLinkModel.rtl.test.jsx`
    - `resources/js/Pages/Asset/Locations/AssetLocationLinkModel.rtl.test.jsx`
    - `resources/js/Pages/Asset/MaintenanceTeams/AssetMaintenanceTeamLinkModel.rtl.test.jsx`
    - `resources/js/Pages/Asset/Services/AssetServiceConsumedItemLinkModel.rtl.test.jsx`
    - `resources/js/Pages/Asset/Services/AssetServiceLinkModel.rtl.test.jsx`
    - `resources/js/Pages/CRM/Leads/LeadLinkModel.rtl.test.jsx`
    - `resources/js/Pages/CRM/Opportunities/OpportunityLinkModel.rtl.test.jsx`
    - `resources/js/Pages/CRM/Quotations/QuotationLinkModel.rtl.test.jsx`
    - `resources/js/Pages/Core/CountryLinkModel.rtl.test.jsx`
    - `resources/js/Pages/Core/CurrencyLinkModel.rtl.test.jsx`
    - `resources/js/Pages/Core/LeadSourceLinkModel.rtl.test.jsx`
    - `resources/js/Pages/Core/PermissionLinkModel.rtl.test.jsx`
    - `resources/js/Pages/Finances/Accounts/AccountLinkModel.rtl.test.jsx`
    - `resources/js/Pages/Finances/PaymentMethods/PaymentMethodLinkModel.rtl.test.jsx`
    - `resources/js/Pages/Finances/PaymentTermTemplate/PaymentTermTemplateLinkModel.rtl.test.jsx`
    - `resources/js/Pages/Finances/PurchaseInvoice/PurchaseInvoiceLinkModel.rtl.test.jsx`
    - `resources/js/Pages/Finances/SalesInvoice/SalesInvoiceLinkModel.rtl.test.jsx`
    - `resources/js/Pages/Finances/Taxes/TaxLinkModel.rtl.test.jsx`
    - `resources/js/Pages/Inventory/Attributes/AttributeLinkModel.rtl.test.jsx`
    - `resources/js/Pages/Inventory/Categories/CategoryLinkModel.rtl.test.jsx`
    - `resources/js/Pages/Inventory/DeliveryNotes/DeliveryNoteLinkModel.rtl.test.jsx`
    - `resources/js/Pages/Inventory/Items/ItemLinkModel.rtl.test.jsx`
    - `resources/js/Pages/Inventory/Items/ItemUnitLinkModel.rtl.test.jsx`
    - `resources/js/Pages/Inventory/Items/ItemVariantLinkModel.rtl.test.jsx`
    - `resources/js/Pages/Inventory/StockEntries/CategoryLinkModel.rtl.test.jsx`
    - `resources/js/Pages/Inventory/Units/UnitLinkModel.rtl.test.jsx`
    - `resources/js/Pages/Inventory/Warehouses/WarehouseLinkModel.rtl.test.jsx`
    - `resources/js/Pages/Purchase/PurchaseOrders/PurchaseOrderItemLinkModel.rtl.test.jsx`
    - `resources/js/Pages/Purchase/PurchaseOrders/PurchaseOrderLinkModel.rtl.test.jsx`
    - `resources/js/Pages/Purchase/PurchaseReceipts/PurchaseReceiptLinkModel.rtl.test.jsx`
    - `resources/js/Pages/Purchase/Suppliers/SupplierLinkModel.rtl.test.jsx`
    - `resources/js/Pages/Sales/Customers/CustomerLinkModel.rtl.test.jsx`
    - `resources/js/Pages/Sales/SalesOrders/SalesOrderItemLinkModel.rtl.test.jsx`
    - `resources/js/Pages/Sales/SalesOrders/SalesOrderLinkModel.rtl.test.jsx`
    - `resources/js/Pages/Settings/Branches/BranchLinkModel.rtl.test.jsx`
    - `resources/js/Pages/Users/ManageUsers/AssignableLinkModel.rtl.test.jsx`
    - `resources/js/Pages/Users/ManageUsers/UserLinkModel.rtl.test.jsx`
    - _Requirements: 7.1, 6.3_
  - [x] 7.2 Write test tambahan khusus konsumen `cache` mode existing
    - **KOREKSI ditemukan saat eksekusi**: `PermissionLinkModel.jsx` ternyata punya `cache`/`cacheStorage` DI-COMMENT-OUT (bukan consumer aktif) — cuma 3 consumer aktif: Currency/Country/LeadSource, bukan 4 seperti asumsi awal design.md
    - **cacheStorage write-parity: ditambahkan 1 test baru per file (Currency/Country/LeadSource) yang membaca `window.sessionStorage` langsung via `buildPersistKey()` (export baru dari hook) dan verifikasi data+timestamp beneran tertulis — sebelumnya tidak ada satupun test di ketiga file itu yang membaca sessionStorage secara langsung (semua cuma assert payload axios/UI dropdown)**
    - **Validates: Requirements 3.1, 6.1**

- [x] 8. Final checkpoint - Pastikan seluruh test suite frontend DAN backend lulus
  - `npm run test` PENUH: **lulus (exit 0)**.
  - `php artisan test`/`vendor/bin/phpunit` PENUH (dipecah batch per direktori karena OOM 128MB default CLI Windows di worktree ini — lihat Notes): **1263 test, 0 gagal, 0 error** (Unit 195, Feature Api/Asset/Auth/CRM/Core 687, Feature Migration/Models/Purchase/Rules/Sales/Services/Traits/User 159, Feature Finances 5, Helpdesk 23, Http 47, Inventory 40, Feature file-root 107).
  - Backend TIDAK disentuh sama sekali oleh spec ini (0 file `.php` berubah) — hasil ini murni verifikasi bahwa migrasi frontend tidak berdampak ke backend, bukan test terhadap kode baru.

## Notes

- **Temuan lingkungan (Task 8, BUKAN bug kode)**: `php artisan test` penuh di worktree ini OOM (`Allowed memory size of 134217728 bytes exhausted`, limit 128MB default CLI PHP Herd) — bahkan untuk 1 direktori kecil, karena bootstrap Laravel (route table besar, ERP banyak modul) sendiri sudah mendekati batas itu. `-d memory_limit=...` yang dioper ke `php artisan test` TIDAK ikut ke subprocess phpunit yang di-spawn Laravel (`Process` component start proses baru, tidak inherit ini setting) — fix: jalankan `vendor/bin/phpunit` LANGSUNG (bukan lewat `artisan test`) dengan `php -d memory_limit=1024M vendor/bin/phpunit <path>`, dipecah per direktori/grup kecil. Worktree ini juga belum pernah `npm run build` (public/build/manifest.json tidak ada) — sempat menyebabkan 9 `ViteManifestNotFoundException` di test yang me-render view Inertia, hilang setelah build. Kedua hal ini murni gap-setup worktree baru, tidak terkait spec ini sama sekali (0 file `.php` diubah) — dicatat di sini supaya sesi berikutnya yang kerja di worktree serupa tidak perlu re-diagnosis dari nol.
- **Bug ditemukan+diperbaiki (Task 7.1)**: `CountryLinkModel.rtl.test.jsx` `beforeEach` kurang `window.sessionStorage.clear()` (ada di `CurrencyLinkModel`/`LeadSourceLinkModel` sejak awal, tapi kelewat di `CountryLinkModel`). Sebelum migrasi ini tidak masalah (cache lama gampang di-reset per test); SETELAH migrasi, `useLinkModelOptions` mem-persist snapshot ke `sessionStorage` dengan `ts: Date.now()` lalu me-restore via `queryClient.setQueryData(..., {updatedAt: stored.ts})` — `QueryClient` baru per `render()` TIDAK cukup untuk isolasi test karena staleness dihitung dari timestamp yang tersimpan di `sessionStorage` (state lintas-test), bukan dari umur `QueryClient` itu sendiri. Tanpa `clear()`, test kedua dst di file itu diam-diam serve dari snapshot test pertama dan `axiosPost` tidak pernah terpanggil lagi. Fix: tambah `sessionStorage.clear()` sama seperti 2 file cache-mode lain.
- **Koreksi (Task 7.2)**: `PermissionLinkModel.jsx` punya `cache`/`cacheStorage` DI-COMMENT-OUT — bukan consumer `cache` mode aktif seperti asumsi awal `design.md` ("4 konsumen": Currency/Country/LeadSource/Permission). Hanya 3 consumer aktif. Tidak mempengaruhi implementasi (Permission tetap diperlakukan sebagai LinkModel non-cache biasa, sudah benar), cuma koreksi dokumentasi.
- Lint/Pint (`vendor/bin/pint`, `eslint`) HANYA dijalankan setelah SEMUA task selesai — bukan per task, sesuai `CLAUDE.md` project.
- Requirement 3 AC4 (tidak perlu endpoint backend baru untuk cek "data terakhir update") adalah BATASAN desain, bukan task implementasi tersendiri — terpenuhi otomatis karena tidak ada task di atas yang menyentuh backend.
- Task 7.1 murni mekanis (pola identik dengan Task 5.3, diterapkan ke 38 file) — boleh dikerjakan bertahap per beberapa file sekaligus kalau ingin checkpoint lebih sering, tapi tetap dihitung SATU task Kiro (satu commit logis: "wrap semua test turunan LinkModel dengan QueryClientProvider").
- File komponen `*LinkModel.jsx` turunan (CurrencyLinkModel.jsx, CountryLinkModel.jsx, dst. — BUKAN file test-nya) TIDAK disentuh sama sekali oleh spec ini, sesuai Requirement 6.
- Daftar 39 file test di atas didapat dari `Glob **/*LinkModel.rtl.test.jsx` saat tasks.md ini ditulis — jalankan ulang glob tersebut sebelum eksekusi Task 7 untuk memastikan tidak ada file baru yang luput (mis. kalau ada `*LinkModel.jsx` baru ditambahkan sebelum spec ini dieksekusi).

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3"] },
    { "id": 2, "tasks": ["3.1"] },
    { "id": 3, "tasks": ["3.2"] },
    { "id": 4, "tasks": ["3.3"] },
    { "id": 5, "tasks": ["3.4"] },
    { "id": 6, "tasks": ["5.1"] },
    { "id": 7, "tasks": ["5.2"] },
    { "id": 8, "tasks": ["5.3"] },
    { "id": 9, "tasks": ["7.1"] },
    { "id": 10, "tasks": ["7.2"] }
  ]
}
```
