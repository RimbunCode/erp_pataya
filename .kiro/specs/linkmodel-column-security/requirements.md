# Requirements Document

## Introduction

Endpoint lookup model — `POST /model` (`ModelController::__invoke`) & `POST /model/select-data`
(`ModelController::selectData`) — dipakai komponen `LinkModel`/`SelectModel` (dropdown referensi) dan saat ini
mengembalikan **seluruh kolom non-hidden + relasi `with` penuh** apa adanya. Akibatnya: (1) over-fetch kolom
yang tak dibutuhkan form; (2) kebocoran kolom sensitif terverifikasi (`sales_order_items.price`,
`purchase_order_items.rate`, `stocks.valuation_rate`) yang BUKAN bagian `templateLink`; (3) IDOR laten —
user mana pun dapat menarik kolom sensitif via `with`/`fields` walau tak ada form yang melakukannya.

Spec ini mengamankan jalur lookup dengan **tiga lapis pembatasan kolom, dievaluasi SERVER-SIDE**:
`linkable` (whitelist kolom yang boleh diminta), `fields`/`columns` (kebutuhan per-form), dan `visibleFor`
(izin per-kolom dengan pohon any/all). Default lookup hanya kolom `templateLink` (fail-safe). Semua model
tetap "linkable" (boleh dijadikan dropdown), tetapi kolom sensitif tak pernah keluar kecuali sengaja
ditandai dan diizinkan.

## Glossary

- **Lookup**: pengambilan record sebagai opsi dropdown via `POST /model` (LinkModel) atau `POST /model/select-data` (SelectModel). Berbeda dari "read penuh" (halaman model) yang ber-izin tersendiri.
- **templateLink**: string template tampilan model (mis. `:name (:code)`); kolom yang dirujuknya = tampilan minimal dropdown, SELALU keluar.
- **linkable**: flag `configColumns` (server) menandai kolom yang BOLEH diminta lewat lookup. Whitelist keamanan, global per-model.
- **fields / columns**: daftar kolom yang form BUTUH di luar templateLink. LinkModel pakai prop `fields`; SelectModel reuse `from.columns`/`selects[].columns`. Bukan gerbang keamanan (client bisa di-tamper) — hanya menyaring dari yang sudah `linkable`.
- **visibleFor**: aturan izin per-kolom (pohon any/all type-safe). Kolom keluar hanya bila user memenuhi aturan.
- **node (visibleFor)**: `{ any: node[] }` (OR) | `{ all: node[] }` (AND) | leaf.
- **leaf**: `[Model::class, actionNode]` — izin pada satu model.
- **actionNode**: `Permission` | `{ any: actionNode[] }` | `{ all: actionNode[] }` | `Permission[]` (datar = any).
- **PermissionChecker**: helper backend (BARU) cek izin user, mirror FE `checkPermission`. Backend belum punya helper ini.
- **fail-safe**: default lookup hanya templateLink; kolom yang tak ditandai `linkable` TIDAK keluar (lupa-tandai = aman, bukan bocor).

## Requirements

### Requirement 1: Pembatasan Kolom Default (fail-safe)

**User Story:** As a security maintainer, I want lookup endpoints to return only display columns by default, so
that newly added or untagged columns never leak through dropdowns.

#### Acceptance Criteria

1. THE lookup (`__invoke` & `selectData`) SHALL secara default mengembalikan HANYA kolom `templateLink` + primary key (`id`) + foreign/primary key relasi yang diperlukan.
2. IF sebuah kolom TIDAK ditandai `linkable` dan TIDAK ada di `templateLink`, THEN kolom itu SHALL TIDAK keluar dari lookup.
3. THE pembatasan SHALL dievaluasi SERVER-SIDE (tidak bergantung disiplin frontend).
4. THE perilaku ini SHALL berlaku pada model utama MAUPUN tiap relasi yang dimuat via `with`.

### Requirement 2: Whitelist Kolom `linkable`

**User Story:** As a developer, I want to declare which non-display columns may be requested via lookup, so that
forms can fetch the extra columns they need without exposing everything.

#### Acceptance Criteria

1. THE model SHALL menandai kolom non-templateLink yang boleh diminta dengan `'<col>' => ['linkable' => true]` di `configColumns` (bukan property baru).
2. WHEN kolom ditandai `linkable`, THE kolom itu SHALL boleh keluar bila diminta via `fields`/`columns` (dan lolos `visibleFor` bila ada).
3. THE flag `linkable` SHALL menjadi satu-satunya gerbang keamanan untuk kolom non-display — `fields`/`columns` TIDAK boleh memaksa keluar kolom non-`linkable`.

### Requirement 3: Kebutuhan Kolom Per-Form (`fields` / `columns`)

**User Story:** As a form author, I want to request only the columns my form needs, so that other forms don't
over-fetch columns they never use.

#### Acceptance Criteria

1. THE `LinkModel` SHALL menyediakan prop `fields` (array nama kolom) yang dikirim ke `/model`; default `[]` (hanya templateLink).
2. THE `SelectModel` SHALL memakai ulang `from.columns`/`selects[].columns` yang SUDAH ADA sebagai daftar kolom yang diminta — TANPA prop baru.
3. THE backend SHALL memperlakukan `fields` (LinkModel) dan `columns` (SelectModel) secara seragam sebagai "kolom diminta".
4. THE kolom yang keluar SHALL = `templateLink` + (`requested` ∩ `linkable`) − (kolom `visibleFor` yang gagal izin).
5. WHEN form tidak meminta sebuah kolom `linkable`, THE kolom itu SHALL TIDAK keluar (hemat over-fetch).

### Requirement 4: Izin Per-Kolom `visibleFor` (pohon any/all)

**User Story:** As a security maintainer, I want sensitive columns gated by role permissions tied to the
destination document, so that only users authorized for that workflow see them.

#### Acceptance Criteria

1. THE kolom sensitif SHALL boleh ditandai `'visibleFor' => <node>` di `configColumns`.
2. WHEN kolom punya `visibleFor`, THE kolom itu SHALL keluar HANYA bila `PermissionChecker::satisfies($node)` true.
3. THE `node` SHALL mendukung `{ any: node[] }` (OR), `{ all: node[] }` (AND), dan leaf `[Model::class, actionNode]`, bersarang.
4. THE `actionNode` SHALL mendukung `Permission` tunggal, `{ any: [...] }`, `{ all: [...] }`, dan array datar (= any) — sehingga any/all berlaku di level model MAUPUN aksi.
5. THE list datar di level node SHALL diperlakukan sebagai `{ any: [...] }` (backward-compat).
6. THE izin `visibleFor` SHALL diikat ke dokumen-tujuan yang sah memakai kolom (mis. Invoice/Order write), BUKAN ke izin model sumber — sehingga user tanpa izin model sumber tetap memperoleh kolom bila berhak atas dokumen tujuan.
7. THE `visibleFor` SHALL ditulis type-safe memakai `Model::class` + enum `Permission` (tanpa string FQCN/aksi mentah).

### Requirement 5: Enum `Permission` & `PermissionChecker` Backend

**User Story:** As a backend developer, I want a type-safe permission enum and a backend permission checker, so
that column gating mirrors the existing frontend permission logic without typo-prone strings.

#### Acceptance Criteria

1. THE `app/Enums/Permission.php` SHALL mendefinisikan enum string-backed untuk 12 aksi (`select/read/write/create/delete/submit/cancel/amend/print/import/export/share`) selaras `PermissionSeeder`.
2. THE `app/Services/Core/PermissionChecker.php` SHALL menyediakan `can(string $model, Permission $action, int $level = 0): bool` yang me-mirror logika FE `checkPermission` (`lib/utils.js`).
3. THE `PermissionChecker` SHALL menyediakan `satisfies(array $node): bool` yang mengevaluasi pohon `visibleFor` secara rekursif (any/all di level node dan aksi).
4. THE `PermissionChecker::forUser(Request)` SHALL mengambil permission user dari session (hasil `AppMiddleware`) atau me-resolve dari `RolePermission` bila session kosong.
5. THE penempatan SHALL TANPA folder `app/Support/` baru (gunakan `app/Enums` & `app/Services/Core`).

### Requirement 6: Penerapan di `ModelController` (kedua jalur)

**User Story:** As a maintainer, I want both lookup endpoints to enforce the same column rules, so that no jalur
bypasses the restriction.

#### Acceptance Criteria

1. THE `ModelController` SHALL menyediakan helper `resolveLookupColumns($model, array $requested, PermissionChecker $perm): array` yang menghitung kolom aman (templateLink + requested∩linkable − visibleFor-gagal) untuk model & tiap relasi `with`.
2. THE `__invoke` SHALL membatasi output (`get()->toArray()`) ke kolom aman; relasi `with` di-map ke kolom aman relasinya.
3. THE `selectData` SHALL membatasi `columns` metadata DAN data ke kolom aman.
4. THE perubahan SHALL TIDAK mengubah jalur filter (`baseFilters`/`filters`/`fid`) yang sudah ada.

### Requirement 7: Audit & Migrasi Konsumen (tanpa regresi)

**User Story:** As a maintainer, I want existing forms to keep working after the restriction, so that no form
loses a column it actually uses.

#### Acceptance Criteria

1. THE tiap konsumen `LinkModel`/`SelectModel` yang membaca kolom di luar templateLink SHALL di-audit; kolom yang dibutuhkan di-set di `fields`/`columns` dan ditandai `linkable`.
2. THE kolom harga transaksi (`sales_order_items.price`, `sales_invoice_items.price`, `purchase_order_items.rate`, `purchase_invoice_items.rate`) SHALL ditandai `linkable` + `visibleFor` (izin dokumen-tujuan).
3. THE kolom `stocks.valuation_rate` / `stock_entry_items.valuation_rate` SHALL TIDAK ditandai `linkable` (tak pernah keluar via lookup) kecuali ada kebutuhan form yang sah.
4. THE konsumen yang hanya butuh id/name/code (mis. ItemVariantLinkModel) SHALL tetap berfungsi tanpa perubahan (kolom itu sudah aman).
5. WHEN sebuah form sebelumnya mengandalkan kolom yang kini dibatasi, THE form SHALL diperbarui (`fields`/`columns` + tag model) agar tidak rusak.

### Requirement 8: Pengujian

**User Story:** As a maintainer, I want programmatic tests proving the restriction and the permission logic, so
that the security property holds and survives regression.

#### Acceptance Criteria

1. THE test suite SHALL mencakup `tests/Feature/Http/LinkModelColumnSecurityTest.php`: lookup default hanya templateLink; `fields=[linkable]` keluar; `fields=[non-linkable]` dibuang (uji IDOR `valuation_rate` → tak ada); relasi `with` tersaring.
2. THE test SHALL membuktikan `visibleFor`: user berizin → kolom keluar; user tanpa izin → kolom TIDAK keluar (row sama).
3. THE unit test `PermissionChecker::satisfies` SHALL mencakup leaf, OR antar-aksi, AND antar-aksi, `{any}`, `{all}`, nested, aksi-bersarang, dan list-datar=any (backward-compat).
4. THE test regresi (`ModelSelectDataTest`, `ModelControllerFilterTest`, `FilterEvaluatorTest`) SHALL tetap lulus (disesuaikan `fields` bila perlu).
5. WHEN semua test hijau, THE perubahan SHALL lolos `vendor/bin/pint --dirty --format agent` + eslint.
