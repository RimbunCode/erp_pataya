# Requirements Document

## Introduction

`LinkModel.jsx` adalah komponen combobox async yang dipakai luas di seluruh form aplikasi (Item, Account, Customer, Currency, Country, dst.) untuk memilih relasi model via endpoint `route("model")`. Mekanisme fetch-nya saat ini diimplementasikan manual (`axios` + `useState`/`useEffect` + sistem cache custom 4-storage-mode buatan sendiri), dengan konsekuensi:

- Tidak ada dedup request lintas instance yang identik.
- Tidak ada penanganan race-condition (response request lama bisa overwrite response yang lebih baru).
- Refetch berulang tanpa perlu setiap dropdown dibuka.
- Cache manual mereplikasi fungsi yang sudah tersedia di library (TanStack Query, sudah dipakai di `DashboardBlocks` untuk pola serupa).
- **Bug tersembunyi**: prop `filters` diabaikan total oleh backend maupun client saat mode `cache` aktif — konsumen yang menggabungkan `cache` + `filters` akan menerima dataset TIDAK terfilter.
- Dead code (`validateWithOperators()`) yang dibuat untuk menutup gap filter di atas tapi tidak pernah selesai disambungkan.

Requirements ini mendefinisikan perilaku yang harus dipenuhi migrasi fetch-layer `LinkModel` ke TanStack Query, TANPA mengubah kontrak props publik komponen maupun endpoint backend `route("model")`.

## Glossary

- **LinkModel**: komponen combobox async ([resources/js/Components/LinkModel.jsx](resources/js/Components/LinkModel.jsx)) untuk memilih record relasi model di form.
- **Cache mode**: mode operasi `LinkModel` (`cache` prop truthy) yang memuat SELURUH dataset model sekali lalu memfilter/mencari di sisi client (dipakai untuk data referensi kecil seperti Currency, Country).
- **cacheStorage**: pilihan tempat penyimpanan cache mode — `memory` (default), `localStorage`, `sessionStorage`, `indexedDB`.
- **queryKey**: identitas unik sebuah query TanStack Query; query dengan `queryKey` sama otomatis di-dedup dan berbagi cache.
- **staleTime**: durasi (ms) sebuah data dianggap masih segar setelah fetch — dalam window ini, remount/refocus TIDAK memicu fetch baru.
- **Stale-while-revalidate**: pola TanStack Query — data yang sudah lewat `staleTime` tetap ditampilkan instan dari cache, SAMBIL memicu refetch di background.
- **Persistence manual**: mekanisme baca-tulis `cacheStorage` yang diimplementasikan langsung di `useLinkModelOptions` (via `initialData`/`initialDataUpdatedAt` pada `useQuery` + write-through saat fetch sukses) — BUKAN via plugin resmi TanStack (`@tanstack/query-sync-storage-persister`/`@tanstack/query-async-storage-persister` dievaluasi lalu DIBATALKAN karena beroperasi di level seluruh `QueryClient`, bukan per-query; lihat `design.md`).
- **Debounced search**: nilai `search` SETELAH jeda (500ms) sejak user berhenti mengetik — dipakai sebagai bagian `queryKey`, berbeda dari `search` mentah (per-keystroke) yang dipakai untuk tampilan `<Input>`.

## Requirements

### Requirement 1: Dedup request dan mencegah refetch berlebih

**User Story:** As a pengguna form, I want LinkModel field dengan `model`+`filters`+`search` yang sama tidak fetch berulang ke backend, so that form terasa responsif dan tidak membebani backend secara tidak perlu.

#### Acceptance Criteria

1. WHEN dua atau lebih instance `LinkModel` dengan `model`, `filters`, `joins`, dan `debouncedSearch` yang identik mount bersamaan, THE `useLinkModelOptions` SHALL melakukan HANYA satu request HTTP ke backend untuk kombinasi tersebut.
2. WHEN dropdown `LinkModel` dibuka ulang dengan `search` dan `filters` yang sama seperti fetch sebelumnya DAN data belum melewati `staleTime`, THE `LinkModel` SHALL menampilkan data dari cache TANPA melakukan request baru.
3. WHEN response dari request yang lebih lama tiba SETELAH response dari request yang lebih baru (race condition akibat jitter jaringan), THE `LinkModel` SHALL menampilkan data dari `queryKey` yang aktif saat ini, BUKAN data dari response yang telat.
4. THE garansi dedup pada AC1-AC3 SHALL berlaku untuk jalur pengisian daftar opsi dropdown SAJA (pencarian non-cache maupun pemuatan penuh cache mode). THE jalur resolve nilai `defaultValue` dan jalur resolve-by-id setelah `FormPageDialog` sukses membuat record baru SHALL TETAP berupa fetch imperatif satu-kali yang TIDAK diikat ke mekanisme dedup/`queryKey` reaktif ini — perilaku keduanya TIDAK berubah dari implementasi saat ini.

### Requirement 2: Debounce search tidak membebani cache dengan entry per-keystroke

**User Story:** As a pengguna form, I want mengetik di kolom pencarian LinkModel tetap terasa instan, so that saya tidak merasakan lag saat mengetik meskipun fetch-nya di-debounce.

#### Acceptance Criteria

1. THE `LinkModel` input SHALL memperbarui tampilan teks yang diketik SECARA INSTAN pada setiap keystroke, terlepas dari status debounce.
2. THE `queryKey` SHALL HANYA berubah berdasarkan `debouncedSearch` (nilai search 500ms setelah user berhenti mengetik), BUKAN `search` mentah per-keystroke.
3. WHEN user mengetik serangkaian huruf secara cepat lalu berhenti, THE `useLinkModelOptions` SHALL melakukan fetch HANYA SATU KALI untuk nilai pencarian final, BUKAN satu fetch per huruf yang diketik.

### Requirement 3: cacheStorage dipertahankan dengan penjagaan kesegaran data (staleTime)

**User Story:** As a pengguna field referensi (Currency/Country/LeadSource/Permission), I want data yang tersimpan di browser storage tetap relevan dengan data server, so that saya tidak melihat opsi yang sudah tidak berlaku tanpa harus menutup/reload tab secara manual.

#### Acceptance Criteria

1. THE `LinkModel` SHALL tetap mendukung keempat mode `cacheStorage` (`memory`, `localStorage`, `sessionStorage`, `indexedDB`) dengan API/props publik yang SAMA seperti sekarang.
2. WHEN data yang dipulihkan dari storage persisten sudah melewati `staleTime`, THE `useLinkModelOptions` SHALL menampilkan data cache tersebut secara instan DAN memicu refetch di background secara otomatis.
3. THE `LinkModel` SHALL menyediakan prop opsional `staleTime` (satuan ms, default `120000`) untuk override per-instance, TANPA mengubah default global `QueryClient` yang sudah dipakai `DashboardBlocks`.
4. THE solusi penjagaan kesegaran data SHALL TIDAK memerlukan endpoint backend baru (mis. endpoint pengecekan "data terakhir diupdate").
5. THE prop `cache` SHALL disederhanakan menjadi boolean SAJA (`cache` / `cache={true}` / `cache={false}`, default `false`) — bentuk object `cache={{ enabled, refreshMs }}` SHALL DIHAPUS SELURUHNYA (bukan hanya sub-opsi `refreshMs`), karena TIDAK ADA konsumen manapun yang memakai bentuk object ini (di-grep, nol pemakaian termasuk sub-opsi `enabled`). `staleTime` (Requirement 3 AC3) SHALL menjadi SATU-SATUNYA mekanisme kontrol kesegaran data. Ini pengecualian yang disengaja terhadap Requirement 6 (lihat AC4 di Requirement 6).

### Requirement 4: Filter berfungsi benar saat cache mode aktif

**User Story:** As a developer yang memasang `LinkModel` dengan kombinasi `cache` + `filters`, I want opsi yang ditampilkan benar-benar sesuai `filters` yang saya berikan, so that dropdown tidak menampilkan record yang seharusnya tersaring.

#### Acceptance Criteria

1. WHEN mode cache aktif (`cacheMode: true`) DAN prop `filters` diisi, THE payload request ke backend SHALL menyertakan `filters` (digabung dengan `filterForDefaultValue` bila ada), SAMA seperti jalur non-cache.
2. THE `queryKey` SHALL tetap mencerminkan kombinasi `filters` yang aktif saat ini (perilaku `cacheKey` existing dipertahankan).
3. WHEN prop `filters` berubah saat runtime pada `LinkModel` dengan cache aktif, THE `useLinkModelOptions` SHALL memicu fetch baru untuk kombinasi `filters` yang baru tersebut.
4. THE sistem TIDAK diwajibkan mengimplementasikan validasi filter di sisi client (mis. menghidupkan kembali `validateWithOperators`) — filtering SHALL sepenuhnya dilakukan backend.

### Requirement 5: Pembersihan dead code

**User Story:** As a maintainer codebase, I want fetch-layer LinkModel bersih dari fungsi yang tidak lagi relevan, so that developer lain di masa depan tidak salah paham fungsi tersebut masih dipakai.

#### Acceptance Criteria

1. THE fungsi `validateWithOperators()` SHALL dihapus dari [linkModelUtils.js](resources/js/lib/linkModelUtils.js).
2. THE fungsi `validate()` dan `convertTemplateLink()` SHALL TIDAK terdampak oleh penghapusan tersebut — perilakunya tetap sama persis seperti sebelum perubahan.
3. WHEN test suite dijalankan setelah penghapusan, THE seluruh test di `linkModelUtils.test.js` SHALL tetap lulus tanpa modifikasi.

### Requirement 6: Kompatibilitas mundur untuk seluruh konsumen existing

**User Story:** As a developer dengan banyak komponen turunan `*LinkModel.jsx` (CurrencyLinkModel, CountryLinkModel, PermissionLinkModel, dst.), I want migrasi ini tidak memaksa perubahan cara pakai di kode pemanggil, so that migrasi bisa dilakukan tanpa menyentuh puluhan file consumer.

#### Acceptance Criteria

1. THE `LinkModel` SHALL mempertahankan SELURUH props publik existing (`value`, `onValueChange`, `model`, `filters`, `joins`, `cache`, `cacheStorage`, `defaultValue`, `form`, dst.) dengan perilaku yang SAMA seperti sebelum migrasi, KECUALI pengecualian eksplisit di AC4.
2. THE `LinkModel` SHALL menambahkan satu props baru yang bersifat opsional: `staleTime`.
3. WHEN komponen turunan (`CurrencyLinkModel.jsx`, `CountryLinkModel.jsx`, `LeadSourceLinkModel.jsx`, `PermissionLinkModel.jsx`, dan turunan lain) dijalankan tanpa modifikasi kode pemanggilnya, THE komponen tersebut SHALL berfungsi identik dengan perilaku sebelum migrasi.
4. **Pengecualian yang disengaja**: bentuk object `cache={{ enabled, refreshMs }}` SHALL DIHAPUS SELURUHNYA — `cache` menjadi boolean-only (lihat Requirement 3 AC5) — TIDAK termasuk garansi kompatibilitas mundur AC1, karena tidak dipakai konsumen manapun saat ini (baik sub-opsi `enabled` maupun `refreshMs`) dan digantikan sepenuhnya oleh `staleTime`. `cache` sebagai shorthand boolean (`cache` / `cache={true}` / `cache={false}`) TETAP berfungsi seperti sebelumnya.

### Requirement 7: Test coverage untuk perilaku baru

**User Story:** As a developer yang menjaga kualitas kode, I want migrasi ini punya test coverage yang memverifikasi perilaku baru, so that regresi (dedup gagal, filter diabaikan lagi, staleTime salah wiring) terdeteksi otomatis oleh CI.

#### Acceptance Criteria

1. THE test suite SHALL memperbarui `LinkModel.rtl.test.jsx` dan seluruh `*LinkModel.rtl.test.jsx` turunan untuk membungkus komponen dengan `QueryClientProvider` pada test setup.
2. THE test suite SHALL menambahkan unit test baru untuk `useLinkModelOptions.js` yang murni menguji hook (tanpa render UI komponen).
3. THE test suite SHALL memiliki test case yang secara eksplisit memverifikasi Requirement 4 (payload cache-mode menyertakan `filters` yang benar).
4. WHEN seluruh test suite frontend dijalankan (`npm run test`), THE hasilnya SHALL 100% lulus tanpa `continue-on-error`, sesuai konvensi CI (`.github/workflows/tests.yml`).

## Out of Scope

- Perubahan endpoint backend `route("model")` atau `LinkModel.php` trait.
- Perubahan UI/UX visual combobox (styling, keyboard navigation, dsb.).
- Menghidupkan kembali atau mendesain ulang `validateWithOperators()` sebagai filter engine client-side.
