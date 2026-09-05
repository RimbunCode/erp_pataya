# Requirements Document

## Introduction

`Widget` (`app/Models/Core/Widget.php`) saat ini satu entity dengan field `type` yang mencampur "sumber data" (document type/custom) dan "tampilan visual" (bar/pie/line/doughnut/card) sekaligus. Ini menyebabkan dua masalah nyata: (1) kalkulasi `group_by` di `WidgetController::getChartData()` selalu jatuh ke `COUNT(*) GROUP BY period` (waktu), field `group_by_base_on`/`group_by_type`/`aggregate_function_based_on` yang sudah ada di form tidak pernah dipakai backend — fitur "Group By" chart efektif tidak berfungsi; (2) delta persentase Number Card dihitung dari selisih 2 bucket time-series terakhir, yang untuk `calculation_type=average` berarti me-rata-rata bucket yang sudah di-rata-rata (bukan rata-rata sebenarnya atas seluruh range).

Studi terhadap ERPNext v16.18.3 (source `frappe/frappe/desk/doctype/{number_card,dashboard_chart}/`) menunjukkan Number Card dan Chart adalah dua DocType terpisah dengan field set berbeda, masing-masing standalone document yang di-link ke Workspace lewat thin-link doctype — pola yang sudah selaras dengan arsitektur `Widget` + `DashboardWidget` di sini. Spec ini memecah `Widget` jadi dua entity independen (`NumberCard`, `Chart`) mengikuti struktur tersebut, dengan penyesuaian: source `Report` di-drop (tidak ada entity Report setara di codebase ini), source `Custom` pakai registry tertutup (bukan whitelist method-path bebas), dan model visibilitas pakai gate ganda (permission model target ATAU sharing eksplisit) yang berbeda dari pola ERPNext (`is_public`/`roles`) maupun pola `Desk` (`owner_id`-restrictive).

Data existing di tabel `widgets` (6 baris dev, `type` tidak cocok pilihan form sekarang) tidak perlu dipertahankan — bebas drop/rebuild.

## Glossary

- **NumberCard**: entity baru, nilai tunggal (single aggregate value) dari satu model, opsional delta persentase vs periode sebelumnya.
- **Chart**: entity baru, data time-series atau kategorikal untuk divisualisasikan (line/bar/pie/donut/heatmap).
- **source_type / chart_source_type**: cara NumberCard/Chart menghitung nilainya — `document_type` (agregat langsung ke model), `custom` (lewat `CustomChartSourceRegistry`). Chart tambahan: `group_by` (agregat per nilai field kategorikal).
- **visual_type**: representasi visual Chart (line/bar/pie/donut/percentage/heatmap) — terpisah total dari `chart_source_type`.
- **timeseries**: flag Chart yang menentukan apakah datanya dibucket per waktu (`based_on`/`time_interval`/`timespan`) — mutually exclusive dengan `chart_source_type=group_by`.
- **Shareable**: trait yang menambahkan `is_shared_all` + relasi `assignables` (pivot ke User/Role) pada NumberCard dan Chart.
- **Assignable**: view union User+Role yang sudah ada (`App\Models\User\Assignable`), dipakai sebagai target sharing (pola sama `Desk`/`DeskAssignable`).
- **CustomChartSourceRegistry**: daftar tertutup key→class implementasi `CustomChartSourceContract`, satu-satunya jalan source `custom` boleh dieksekusi.

## Requirements

### Requirement 1: Entity NumberCard

**User Story:** As a pengguna Settings, I want membuat Number Card yang menghitung satu nilai agregat dari sebuah model, so that saya bisa memantau metrik ringkas (total, rata-rata, dst) tanpa harus buka chart penuh.

#### Acceptance Criteria

1. THE sistem SHALL menyediakan model `NumberCard` dengan field `label`, `source_type`, `function` (count/sum/average/minimum/maximum), `aggregate_function_based_on`, `model_id`, `filters`, `currency`, `color`, `background_color`, `show_full_number`, `show_percentage_stats`, `stats_time_interval`, `method`.
2. WHEN `source_type=document_type` DAN `function!=count`, THE sistem SHALL mewajibkan `aggregate_function_based_on` terisi (validasi form, sebelum simpan).
3. THE sistem SHALL menghitung nilai NumberCard lewat SATU query agregat langsung atas seluruh filter yang berlaku — TIDAK boleh berupa agregasi-dari-agregasi (mis. rata-rata dari beberapa rata-rata per periode).
4. WHEN `model_id` menunjuk model yang sudah tidak ada (`class_exists` false), THE sistem SHALL mengembalikan state kosong, BUKAN error 500.

### Requirement 2: Delta persentase NumberCard

**User Story:** As a pengguna dashboard, I want lihat perubahan persentase Number Card dibanding periode sebelumnya, so that saya tahu tren metrik itu naik/turun tanpa harus buka chart.

#### Acceptance Criteria

1. WHEN `show_percentage_stats=true`, THE sistem SHALL menghitung nilai pembanding lewat query TERPISAH dengan filter cutoff `created_at <= asOfDate`, BUKAN dari selisih data time-series.
2. THE `asOfDate` SHALL dihitung dari `stats_time_interval` (daily: -1 hari, weekly: -1 minggu, monthly: -1 bulan, yearly: -1 tahun) relatif terhadap waktu request.
3. IF nilai pembanding hasilnya 0, THEN THE sistem SHALL mengembalikan `null` (tidak terdefinisi), bukan pembagian oleh nol.

### Requirement 3: Entity Chart

**User Story:** As a pengguna Settings, I want membuat Chart yang menampilkan tren waktu atau breakdown kategori dari sebuah model, so that saya bisa memvisualisasikan data tanpa nulis query manual.

#### Acceptance Criteria

1. THE sistem SHALL menyediakan model `Chart` dengan field `chart_name`, `chart_source_type`, `visual_type`, `model_id`, `timeseries`, `based_on`, `value_based_on`, `timespan`, `time_interval`, `from_date`, `to_date`, `group_by_based_on`, `group_by_type`, `aggregate_function_based_on`, `number_of_groups`, `heatmap_year`, `color`, `currency`, `show_values_over_chart`, `custom_options`, `method`, `filters`.
2. WHEN `chart_source_type=group_by`, THE sistem SHALL menyembunyikan/menonaktifkan field `based_on`/`timespan`/`time_interval` di form (tidak relevan) dan mewajibkan `group_by_based_on`.
3. WHEN `timeseries=true`, THE sistem SHALL mewajibkan `based_on` terisi.

### Requirement 4: Kalkulasi Chart time-series

**User Story:** As a pengguna dashboard, I want lihat tren Count/Sum/Average dari sebuah model per periode waktu, so that saya bisa memantau pola dari waktu ke waktu.

#### Acceptance Criteria

1. WHEN `chart_source_type` in (count, sum, average) DAN `timeseries=true`, THE sistem SHALL membucket data berdasarkan `based_on` sesuai `time_interval` (daily/weekly/monthly/quarterly/yearly) dalam rentang `timespan`/`from_date`-`to_date`.
2. THE perilaku bucketing ini SHALL identik dengan `WidgetController::getChartData()` existing (termasuk pengisian periode kosong untuk `bar`/`line`) — dipindah, bukan ditulis ulang dari nol.

### Requirement 5: Kalkulasi Chart Group By (fix bug)

**User Story:** As a pengguna dashboard, I want lihat breakdown kategori (mis. jumlah dokumen per status) dalam bentuk chart, so that saya bisa lihat distribusi data, bukan cuma tren waktu.

#### Acceptance Criteria

1. WHEN `chart_source_type=group_by`, THE sistem SHALL mengagregasi data per NILAI DISTINCT `group_by_based_on` (BUKAN per periode waktu) menggunakan fungsi `group_by_type` (count/sum/average) dan `aggregate_function_based_on` bila relevan.
2. THE hasil SHALL diurutkan menurun berdasarkan nilai agregat, dibatasi maksimal `number_of_groups` baris.
3. IF `group_by_based_on` adalah kolom relasi (Link/BelongsTo), THEN THE sistem SHALL me-resolve label dari relasi tersebut HANYA jika user punya permission Select ke model relasinya (pola sama `PermissionChecker::can($related, Select)` di `quickList()`) — kalau tidak, kolom itu di-skip dari hasil.
4. THE jalur ini SHALL TIDAK PERNAH memanggil logic bucketing waktu (Requirement 4) — dua code path terpisah total.

### Requirement 6: Kalkulasi Chart Heatmap

**User Story:** As a pengguna dashboard, I want lihat aktivitas harian dalam bentuk kalender heatmap (mis. jumlah dokumen dibuat per hari), so that saya bisa lihat pola aktivitas sepanjang tahun.

#### Acceptance Criteria

1. WHEN `visual_type=heatmap`, THE sistem SHALL menghitung jumlah baris per hari dalam `heatmap_year`.
2. IF `heatmap_year` kosong, THEN THE sistem SHALL default ke tahun berjalan.
3. THE frontend SHALL menyediakan komponen kalender-heatmap baru (tidak ada primitive ini di recharts yang sudah dipakai).

### Requirement 7: Custom source registry

**User Story:** As a developer, I want mendaftarkan sumber data custom untuk NumberCard/Chart lewat mekanisme tertutup, so that fitur ini bisa diperluas tanpa membuka celah eksekusi method sembarang dari input user.

#### Acceptance Criteria

1. THE sistem SHALL menyediakan `CustomChartSourceContract` (interface `getValue(array $filters): array`) dan `CustomChartSourceRegistry` (daftar tertutup key→FQCN class terdaftar eksplisit di kode, BUKAN string bebas dari database).
2. WHEN `source_type`/`chart_source_type=custom` DAN `method` menunjuk key yang TIDAK terdaftar di registry, THE sistem SHALL menolak saat SIMPAN (validasi form, HTTP 422) — bukan baru gagal saat render.
3. THE sistem SHALL TIDAK PERNAH meng-invoke method/class dari string yang tidak melalui registry ini.

### Requirement 8: Visibilitas & sharing

**User Story:** As a pemilik dashboard, I want NumberCard/Chart bisa dilihat siapa saja yang punya akses ke model datanya, dan opsional dibagikan ke user/role tertentu di luar itu, so that saya bisa berbagi insight tanpa harus memberi akses penuh ke data mentah.

#### Acceptance Criteria

1. THE visibilitas NumberCard/Chart SHALL ditentukan oleh: `PermissionChecker::can(model_id.model, Select)` DENGAN user tsb OR `is_shared_all=true` OR ada baris assignable yang match role user atau user itu sendiri.
2. THE tiga kondisi pada AC1 SHALL berlaku sebagai OR-gate murni — permission model TIDAK PERNAH menjadi syarat wajib ketika salah satu kondisi share terpenuhi, dan share TIDAK PERNAH mengurangi visibilitas yang sudah didapat dari permission model.
3. THE `created_by_id`/`owner` SHALL TIDAK ikut jadi bagian gate visibilitas (beda dari pola `Desk` yang `owner_id`-restrictive).
4. WHEN endpoint nilai/data (`getValue`/`getPercentageDifference`/`getData`) dipanggil, THE sistem SHALL mengecek ulang gate ini PER REQUEST (bukan percaya konfigurasi block yang sudah tersimpan), karena permission user bisa berubah sejak block ditempel di Desk.
5. THE sharing target (assignable) SHALL menggunakan pola pivot yang sama dengan `DeskAssignable` (`assignable_id`+`assignable_type` user/role, resolve lewat view `Assignable` yang sudah ada).

### Requirement 9: Integrasi Desk block

**User Story:** As a pengguna Desk, I want menempatkan Number Card atau Chart yang sudah dibuat ke canvas Desk, so that saya bisa menyusun dashboard tanpa membuat ulang konfigurasinya.

#### Acceptance Criteria

1. THE tabel `dashboard_widgets` SHALL punya kolom `number_card_id` (FK nullable → number_cards) dan `chart_id` (FK nullable → charts), menggantikan `widget_id`.
2. WHEN block bertipe `card`, THE sistem SHALL mengisi `number_card_id` (TIDAK `chart_id`); WHEN block bertipe `chart`, THE sistem SHALL mengisi `chart_id` (TIDAK `number_card_id`) — mutually exclusive per baris.
3. THE tipe block (`chart`/`card` di `DashboardWidget::TYPES_WITH_WIDGET`) dan mekanisme nesting/`parent_id` SHALL TIDAK berubah dari desk-dashboard-builder yang sudah ada.
4. THE picker block (`NumberCardBlock`/`ChartBlock`) SHALL hanya menampilkan NumberCard/Chart yang visible bagi user (Requirement 8).

### Requirement 10: Migrasi dari Widget lama

**User Story:** As a maintainer, I want kode `Widget` lama dihapus bersih setelah split selesai, so that tidak ada dua sistem paralel yang membingungkan.

#### Acceptance Criteria

1. THE sistem SHALL menghapus `app/Models/Core/Widget.php`, `WidgetController.php`, `WidgetRequest.php`, halaman `Settings/Widget/*`, `WidgetLinkModel.jsx`, route terkait (`settings.widget.*`, `get-chart`).
2. THE migration SHALL men-drop tabel `widgets` TANPA script pemetaan data lama (data existing bukan data produksi, sudah dikonfirmasi bebas drop).
3. THE 38 test `DeskDashboardBuilderTest` yang sudah ada SHALL tetap pass setelah perubahan `dashboard_widgets` (Requirement 9) — block type lain (quick_list/link_card/section/dst) tidak boleh terdampak.
