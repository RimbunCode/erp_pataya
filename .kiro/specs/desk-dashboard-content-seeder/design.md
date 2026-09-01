# Design Document: Desk Dashboard Content Seeder

## Overview

`desk-based-ui` (selesai) menyiapkan `Desk::resolveDashboard()` — tiap Desk system otomatis dapat `Dashboard` kosong. `desk-dashboard-builder` (mayoritas selesai, task migration/verifikasi-visual/final-checkpoint masih terbuka) menyediakan kanvas block editor-nya. Keduanya BELUM mengisi kontennya — Desk Home selalu kosong sampai user mengisi manual.

Spec ini menambah **method seeder baru** (`seedDashboards()`) di `database/seeders/DeskSeeder.php` yang mengisi tiap 9 Desk system dengan konten dashboard bermakna: metrik ERP nyata (bukan placeholder) berdasarkan model-model yang SUDAH terdaftar sebagai `MenuItem` desk tersebut (lihat `seedMenuItems()` existing) — bukan tebakan baru, tapi representasi visual dari fitur yang memang ada di desk itu.

## Arsitektur

**Lokasi & pemanggilan**: method baru `seedDashboards(): void` di `DeskSeeder`, dipanggil dari `run()` setelah `seedMenuItems()`.

**Idempotensi — "isi sekali, jangan timpa"**: `desk-dashboard-builder` sengaja membuat Dashboard BISA diedit user lewat UI drag-drop. Kalau seeder ini menghapus-lalu-membuat-ulang widget setiap `db:seed` dijalankan ulang, itu **menghancurkan hasil edit manual user**. Aturan: untuk tiap Desk, seeder HANYA mengisi widget kalau Dashboard desk itu **belum punya widget sama sekali** (`$dashboard->widgets()->count() === 0`). Begitu ada widget apapun (dari seeder run pertama, ATAU dari user), run berikutnya SKIP TOTAL untuk desk itu.

```php
private function seedDashboards(): void {
    foreach ($this->desks as $desk) {
        $dashboard = $desk->dashboard_id
            ? Dashboard::find($desk->dashboard_id)
            : $desk->resolveDashboard();
        if ($dashboard->widgets()->count() > 0) {
            continue; // sudah ada isi (seeder run sebelumnya / edit user) — jangan timpa
        }
        $this->{'seedDashboardFor' . Str::studly($desk->domain->value)}($dashboard);
    }
}
```

**Helper methods baru** (pola sama seperti `menuItem()`/`menuGroup()` existing):

```php
/** Bikin NumberCard (card) + langsung 1 DashboardWidget ber-type 'card', urutan berikutnya di dashboard. */
private function card(Dashboard $dashboard, array $attrs, ?string $parentWidgetId = null, int $order = 0, int $width = 3): DashboardWidget

/** Bikin Chart + DashboardWidget ber-type 'chart'. */
private function chart(Dashboard $dashboard, array $attrs, ?string $parentWidgetId = null, int $order = 0, int $width = 6): DashboardWidget

/** DashboardWidget ber-type lain (section/text/spacer/quick_list/link_card/link_card_item), tanpa entity Chart/NumberCard terpisah. */
private function widget(Dashboard $dashboard, string $type, array $config, ?string $parentWidgetId = null, int $order = 0, int $width = 12): DashboardWidget
```

`card()`/`chart()` SELALU set `is_shared_all = true` (disetujui user — konten dashboard sistem dipakai bersama semua user yang akses Desk itu, bukan personal), `created_by_id` = user admin pertama (`User::first()?->id` atau setara — dibutuhkan karena `created_by_id` nullable tapi baik diisi utk audit trail).

## Referensi Skema (diverifikasi dari kode, bukan asumsi)

**`dashboard_widgets`**: `id, dashboard_id, parent_id (self, nullable), type (9 nilai), config (json), width (1-12), order, is_visible, chart_id (nullable), number_card_id (nullable)`. `type` ∈ `section, text, spacer, shortcut, link_card, link_card_item, quick_list, chart, card`. Aturan parent (`DashboardWidget::VALID_PARENTS`): `section` selalu root; `link_card_item` selalu child `link_card`; semua tipe lain root ATAU child `section`.

**Config shape per tipe** (dari `desk-dashboard-builder` design.md, diverifikasi konsisten dgn `DeskController::sanitizeRowHtml()`):
- `section`: `{ label: {json,html}, description: {json,html}|null }`
- `text`: `{ json, html }`
- `link_card`: `{ label: string }`
- `link_card_item`: `{ label, link_type: "menu_item"|"url", link_to: string }` — `link_to` = `menu_item_id` (ulid) kalau `menu_item`
- `quick_list`: `{ model_id, model_class, filters, sort_by, sort_direction, limit }` — **filter HANYA kolom fisik model root, TIDAK bisa lintas relasi** (`DashboardController::quickList()`, implementasi manual sendiri — BUKAN `FilterEvaluator`). `filters` = array triple `[field, operator, value]`, operator ∈ `=,!=,>,>=,<,<=,like,in,not_in`.
- `chart`/`card`: config kosong, data sesungguhnya di entity `Chart`/`NumberCard` terpisah (via `chart_id`/`number_card_id`)

**`charts`** (relevan): `chart_name, chart_source_type (count|sum|average|group_by|custom), visual_type (line|bar|pie|donut|percentage|heatmap), model_id (FK permissions, nullable), model_class, timeseries, based_on, timespan (last_week|last_month|last_quarter|last_year|custom), time_interval (daily|weekly|monthly|quarterly|yearly), group_by_based_on, group_by_type (count|sum|average), filters, is_shared_all, created_by_id`.

**`number_cards`** (relevan): `label, source_type (document_type|custom), function (count|sum|average|minimum|maximum), aggregate_function_based_on, model_id, model_class, filters, show_percentage_stats, stats_time_interval (daily|weekly|monthly|yearly), is_shared_all, created_by_id`.

**Validasi kondisional yang HARUS dipatuhi seeder** (dari `ChartRequest`/`NumberCardRequest` — seeder menulis langsung ke DB jadi validasi HTTP ini tidak otomatis berlaku, tapi tetap harus disiplin manual):
- `chart_source_type=group_by` → wajib isi `group_by_based_on` + `group_by_type`
- `function != count` (NumberCard) → wajib isi `aggregate_function_based_on`
- `show_percentage_stats=true` → wajib isi `stats_time_interval`

**⚠️ Risiko teknis diketahui, diverifikasi saat implementasi**: `ChartService::getGroupByChartConfig()` melakukan `GROUP BY` SQL literal pada kolom `group_by_based_on`. Untuk kolom `status` yang di-cast `FormStatus`/array JSON (SalesOrder, PurchaseOrder, Ticket, dst — MAYORITAS chart "per status" di desain di bawah), grouping terjadi pada representasi JSON MENTAH per baris, bukan nilai status bersih — secara PRAKTIK biasanya aman (dokumen umumnya cuma punya SATU status aktif sekaligus, jadi JSON-nya konsisten per kategori), tapi label hasil grouping kemungkinan tampil sebagai string JSON mentah (mis. `["approved"]`) bukan "Approved" yang rapi. Perlu dicek visual saat implementasi; kalau bermasalah, alternatif: beberapa `NumberCard` terpisah per status (masing-masing pakai `filters` bukan `group_by`) menggantikan 1 Chart group_by.

## Fitur yang DIKELUARKAN dari scope (dibahas & disepakati saat brainstorming)

1. **QuickList "assign to me" (Helpdesk)** — `quick_list.filters` statis, tersimpan sekali, sama untuk semua viewer. Tidak ada mekanisme token per-viewer (`@me`) di `DashboardController::quickList()`. Butuh fitur backend baru (di luar scope seeder), bisa jadi spec terpisah nanti.
2. **QuickList "Item stok rendah" berbasis `Stock` model (Inventory)** — dua kendala independen: (a) `Stock` tidak terdaftar di tabel `permissions` → `PermissionChecker->can(Stock::class, Select)` selalu `false` untuk SEMUA user, widget akan selalu kosong; mendaftarkannya butuh keputusan produk (Stock masuk sistem RBAC penuh, walau kolom Create/Write/Delete-nya tidak pernah dipakai kode manapun — `Stock` tidak punya Controller/route CRUD sama sekali). (b) `quickList()` cuma filter kolom fisik model root, TIDAK bisa bandingkan lintas relasi (`actual_quantity` vs `item.stock_minimum`) — jadi threshold HARUS tetap (bukan dinamis per-item) walau (a) diselesaikan. User memutuskan mengabaikan fitur ini untuk sekarang — dicatat sebagai future work, TIDAK diimplementasikan spec ini.

## Konten Per-Desk

Semua desk dapat 1 `section`+`text` pembuka ("Ringkasan"), lalu card/chart/quick_list/link_card sesuai domain, dipisah `spacer` antar-grup. **Tidak ada `shortcut`** (dihapus eksplisit oleh user). Semua desk WAJIB minimal 1 card + 1 chart + 1 quick_list + 1 link_card.

### Sales
| Widget | Detail |
|---|---|
| Card | Total SO bulan ini — `function=sum`, `aggregate_function_based_on=amount`, model=SalesOrder, filter tanggal bulan berjalan |
| Card | Total Customer — `function=count`, model=Customer |
| Chart | SO per status — `group_by`, `group_by_based_on=status`, model=SalesOrder, `visual_type=pie` |
| Chart | SO trend — `timeseries=true`, `based_on=date`, `time_interval=monthly`, model=SalesOrder, `visual_type=line` |
| Chart | Internal Order trend — sama pola, model=InternalOrder |
| Quick List | SO terbaru — model=SalesOrder, sort `date` desc |
| Quick List | Internal Order terbaru — model=InternalOrder, sort `date` desc |
| Quick List | Delivery Note belum terkirim — model=DeliveryNote, filter `status` (nilai "belum lengkap" — cek enum status DeliveryNote saat implementasi), sort terbaru |
| Link Card "Laporan" | → Sales Orders, → Internal Orders, → Customers |

### Purchase
| Widget | Detail |
|---|---|
| Card | Total PO bulan ini — sum `amount`, model=PurchaseOrder |
| Card | PR menunggu approval — `function=count`, model=PurchaseRequest, filter status draft/pending |
| Chart | PR→PO trend — timeseries line, model=PurchaseOrder atau PurchaseRequest (berdasar `date`) |
| Chart | PR per status — group_by pie, model=PurchaseRequest |
| Chart | PO per status — group_by pie, model=PurchaseOrder |
| Quick List | PR terbaru — model=PurchaseRequest |
| Quick List | PO required_date lewat — model=PurchaseOrder, filter `required_date < today` (kolom fisik, feasible) |
| Link Card "Procurement" | → Purchase Requests, → Purchase Orders, → Purchase Receipts, → Suppliers |

### Inventory
| Widget | Detail |
|---|---|
| Card | Total Item — count, model=Item |
| Card | Total Warehouse — count, model=Warehouse |
| Chart | Item per kategori — group_by bar, `group_by_based_on=category` (relasi — `ChartService` resolve FK fisik `category_id` otomatis), model=Item |
| Quick List | Stock Entry terbaru — model=StockEntry |
| Quick List | Purchase Receipt terbaru — model=PurchaseReceipt |
| Quick List | Delivery Note terbaru — model=DeliveryNote |
| Link Card "Item Master" | → Items, → Item Alternatives, → Attributes, → Categories, → Units |

*(Fitur stok rendah DIKELUARKAN — lihat bagian di atas)*

### Asset
| Widget | Detail |
|---|---|
| Card | Total Asset aktif — count, model=Asset, filter status aktif |
| Card | Value Adjustment bulan ini — `function=count` (BUKAN sum — nilai bisa naik/turun, sum bisa saling menghapus & menyesatkan), model=AssetValueAdjustment |
| Card | Total Depresiasi Terakumulasi — sum, model=AssetDepreciationSchedule (kolom pasti dicek saat implementasi) |
| Chart | Asset per status — group_by pie, model=Asset |
| Chart | AssetService per bulan — timeseries bar, `based_on=failure_date`, model=AssetService |
| Quick List | AssetService terbaru — model=AssetService |
| Quick List | Asset Movement terbaru — model=AssetMovement |
| Link Card "Maintenance" | → Asset Maintenance, → Maintenance Teams, → Asset Services |

### Service
| Widget | Detail |
|---|---|
| Card | Work Order open — count, model=WorkOrder, filter status |
| Card | AssetService bulan ini — count, model=AssetService |
| Chart | WO per status — group_by pie, model=WorkOrder |
| Chart | AssetService per bulan — timeseries bar (sama pola Asset) |
| Quick List | WO in-progress — model=WorkOrder |
| Quick List | AssetService terbaru — model=AssetService |
| Link Card "Maintenance" | → Asset Services, → Asset Maintenance |

### Finances
| Widget | Detail |
|---|---|
| Card | Sales Invoice sum bulan ini — sum `amount`, model=SalesInvoice |
| Card | Purchase Invoice sum bulan ini — sum `amount`, model=PurchaseInvoice |
| Card | Total Saldo Account — sum `balance_amount`, model=Account |
| Chart | General Ledger entries per bulan — timeseries line, model=GeneralLedger |
| Chart | Invoice per status — group_by pie, model=SalesInvoice (atau gabungan — dipilih saat implementasi) |
| Quick List | Sales Invoice belum lunas (AR) — model=SalesInvoice, filter `outstanding_amount > 0`, sort jatuh tempo |
| Quick List | Purchase Invoice belum lunas (AP) — model=PurchaseInvoice, filter `outstanding_amount > 0`, sort jatuh tempo |
| Link Card "Accounting & Invoices" | → Accounts, → General Ledgers, → Sales Invoices, → Purchase Invoices, → Payment Entries |

### User Management
| Widget | Detail |
|---|---|
| Card | Total User — count, model=User |
| Card | Total Role — count, model=Role |
| Chart | User per Role — group_by pie (relasi role — dicek nama kolom/relasi saat implementasi) |
| Chart | User baru per bulan — timeseries line, `based_on=created_at`, model=User |
| Quick List | User terbaru — model=User |
| Link Card "Users" | → Manage Users, → Roles |

### Helpdesk
| Widget | Detail |
|---|---|
| Card | Ticket open — count, model=Ticket, filter status belum done |
| Card | Ticket dibuat bulan ini — count, model=Ticket |
| Chart | Ticket per status — group_by pie, model=Ticket |
| Chart | Ticket per bulan — timeseries line, model=Ticket |
| Quick List | Ticket belum done, TERLAMA dulu — model=Ticket, filter status != done, sort `created_at` **asc** (bukan desc — prioritas SLA: tiket lama berisiko breach duluan) |
| Link Card "Tickets" | → Tickets (open), → Tickets (semua) |

### Core
| Widget | Detail |
|---|---|
| Card | Total Branch — count, model=Branch |
| Card | Total File — count, model=File |
| Card | Aktivitas harian — `function=count`, model=Log, filter hari ini, `show_percentage_stats=true`, `stats_time_interval=daily` (banding kemarin) |
| Chart | Log aktivitas per hari — timeseries line, `based_on=created_at`, `time_interval=daily`, model=Log |
| Quick List | Log terbaru — model=Log |
| Link Card "Pengaturan Cepat" | → Company, → Countries, → Currencies, → Formating Series, → Approval Schemes, → Print Templates, → Email Templates |

## Testing Strategy

- **Unit/Feature**: `DeskSeederDashboardTest` — jalankan `DeskSeeder::run()` (atau panggil `seedDashboards()` langsung via reflection/protected-test-helper), assert:
  - Tiap 9 Desk system punya `dashboard_id` terisi.
  - Tiap Dashboard punya widget count > 0, dan minimal 1 widget masing-masing type `card`/`chart`/`quick_list`/`link_card`.
  - Idempotensi: jalankan `seedDashboards()` DUA KALI, assert widget count TIDAK berubah run kedua (tidak dobel, tidak ke-reset).
  - Idempotensi vs edit user: buat 1 Dashboard dgn 1 widget manual (simulasi user), jalankan `seedDashboards()`, assert widget count TETAP 1 (seeder skip, tidak menimpa).
  - Tiap Chart/NumberCard yang dibuat: validasi kondisional terpenuhi (`group_by` → `group_by_based_on`+`group_by_type` terisi; `function != count` → `aggregate_function_based_on` terisi).
- **Manual/visual**: `php artisan db:seed --class=DeskSeeder` di DB dev, buka tiap 9 Desk Home di browser, verifikasi chart/card benar-benar render data (bukan kosong/error) — terutama titik-titik yang ditandai "dicek saat implementasi" di atas (status group_by label, Account.balance_amount, AssetDepreciationSchedule kolom sum, User-Role relasi).
