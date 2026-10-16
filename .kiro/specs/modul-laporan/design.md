# Design: Modul Laporan

## Ringkasan

Modul Laporan menambahkan sembilan halaman baca-saja yang menyajikan ulang data
transaksi yang sudah ada. Tidak ada tabel baru, tidak ada perubahan skema, dan
tidak ada dependensi baru.

Keputusan arsitektural utama: **tabel memakai `DataTableScope` yang sudah ada,
KPI dihitung lewat query agregat terpisah**, dengan satu kelas filter per laporan
sebagai sumber kebenaran tunggal supaya kedua jalur tidak menyimpang.

---

## Latar belakang teknis

### Mengapa dua jalur query

`DataTableScope` memberi laporan banyak hal secara gratis: filter bersarang
AND/OR, filter relasi dot-notation (`items.item.name`), saved filter, grouping,
pagination, pembatasan cabang, dan pengaturan kolom per pengguna. Membangun
ulang semua itu untuk laporan akan mahal dan menghasilkan dua mesin filter yang
berbeda perilaku.

Tapi macro `dataTable()` di `app/Models/Scopes/DataTableScope.php:174` menutup
dirinya: ia memanggil `Inertia::share()` lalu selesai, tanpa mengembalikan
builder yang sudah terfilter.

```php
// DataTableScope.php:512 — macro berakhir di sini, tidak ada return builder
Inertia::share([
    ...$data,
    'dataTableColumns' => $dataTableColumns,
    // ...
]);
```

Akibatnya KPI tidak bisa meminjam builder akhir milik tabel. Mengubah macro agar
mengembalikan builder akan menyentuh seluruh modul yang memakainya (lebih dari
30 controller), jadi tidak sepadan risikonya.

Konsekuensinya: filter diterapkan pada dua builder berbeda. Risiko bawaannya
adalah KPI dan tabel bisa menghitung populasi baris yang berbeda. Requirement 4
dan 5 menangani risiko ini.

### Preseden di dalam repo

Masalah serupa sudah pernah diselesaikan untuk grouping. `DataTableScope.php:429-441`
menghitung agregat per grup, dan penulisnya sengaja menempatkan eksekusi
**setelah semua constraint ter-apply**, lalu `clone $query` untuk query turunan:

```php
// DataTableScope.php:441
$sampleBase = clone $query;
$node = new GroupNodeQuery($query, $groupLevels, $show, aggregates: $aggregates, ...);
```

Desain ini mengikuti semangat yang sama: satu definisi constraint, dipakai
beberapa jalur. Bedanya, karena KPI berada di luar macro, "satu definisi" itu
diwujudkan sebagai kelas filter yang dipanggil dua kali, bukan builder yang
di-clone.

---

## Arsitektur

### Alur request

```
Controller laporan
  |
  |-- 1. Bangun ReportFilter dari Request
  |
  |-- 2. Jalur tabel:
  |      Model::query()
  |        ->tap(fn($q) => $filter->applyTo($q))
  |        ->dataTable($request)        // Inertia::share(data, kolom, dll)
  |
  |-- 3. Jalur KPI:
  |      Model::query()
  |        ->tap(fn($q) => $filter->applyTo($q))   // filter YANG SAMA
  |        ->selectRaw(agregat)
  |
  |-- 4. Pemeriksaan konsistensi (non-production saja)
  |
  '-- 5. Inertia::render(halaman, ['kpi' => ..., 'consistency' => ...])
```

Kunci langkah 2 dan 3: keduanya memanggil `$filter->applyTo()` yang sama. Filter
ditulis satu kali di satu kelas, sehingga tidak ada peluang dua jalur berbeda
karena salah ketik atau lupa memperbarui salah satunya.

### Struktur direktori

Mengikuti konvensi `{Domain}/{Feature}` yang berlaku di repo:

```
app/
  Http/Controllers/Report/
    StockBalanceReportController.php
    StockMutationReportController.php
    SalesReportController.php
    SalesInvoiceReportController.php
    PurchaseReportController.php
    PurchaseInvoiceReportController.php
    WorkOrderMonitoringReportController.php
    SparepartUsageReportController.php
    TeamMemberReportController.php
    ReportIssueController.php          # tombol "Laporkan masalah ini"

  Services/Report/
    ReportFilter.php                   # kontrak abstrak
    ReportKpi.php                      # wadah hasil KPI
    ReportConsistencyChecker.php       # pemeriksa konsistensi
    ReportIssueReporter.php            # pembuat Ticket
    StockBalance/
      StockBalanceFilter.php
      StockBalanceKpiBuilder.php
    StockMutation/
      StockMutationFilter.php
      StockMutationKpiBuilder.php
      TransactionTypeLabeler.php       # peta referenceable_type -> label
    Sales/
      SalesFilter.php
      SalesKpiBuilder.php
      SalesChartBuilder.php
    # ...dst per laporan

resources/js/Pages/Report/
  StockBalance.jsx
  StockMutation.jsx
  Sales.jsx
  # ...dst
  Components/
    ReportLayout.jsx                   # kerangka: filter + KPI + grafik + tabel
    KpiStrip.jsx
    ReportChart.jsx
    ConsistencyWarning.jsx
```

---

## Komponen backend

### ReportFilter (abstrak)

Kontrak tunggal yang dipakai kedua jalur query.

```php
abstract class ReportFilter {
    /** Terapkan seluruh kondisi filter ke builder. */
    abstract public function applyTo(Builder $query): Builder;

    /** Ringkasan filter aktif untuk header export dan isi Ticket. */
    abstract public function toSummary(): array;
}
```

Implementasi per laporan membaca `Request` lalu menerjemahkannya jadi kondisi
Eloquent. Contoh untuk Laporan Penjualan:

```php
class SalesFilter extends ReportFilter {
    public function __construct(
        private ?string $dateFrom,
        private ?string $dateTo,
        private ?string $customerId,
        private ?string $itemId,
    ) {}

    public function applyTo(Builder $query): Builder {
        return $query
            ->when($this->dateFrom, fn ($q, $v) => $q->whereDate('date', '>=', $v))
            ->when($this->dateTo, fn ($q, $v) => $q->whereDate('date', '<=', $v))
            ->when($this->customerId, fn ($q, $v) => $q->where('customer_id', $v))
            ->when($this->itemId, fn ($q, $v) => $q->whereHas(
                'items',
                fn (Builder $i) => $i->where('item_variant_id', $v),
            ));
    }
}
```

Catatan: filter dasar ini **berdampingan** dengan filter lanjutan milik
`DataTableScope`. Filter dasar (rentang tanggal, dropdown) berlaku pada kedua
jalur; filter lanjutan pengguna (tree AND/OR, saved filter) hanya berlaku pada
jalur tabel. Perbedaan inilah yang dideteksi `ReportConsistencyChecker`, dan
itu memang disengaja: filter lanjutan adalah penyaringan tambahan di atas
populasi laporan.

### ReportKpi

Wadah hasil agregasi, sekaligus pembawa jumlah baris untuk pemeriksaan
konsistensi.

```php
final class ReportKpi {
    /**
     * @param  array<string,int|float>  $values  nama KPI => nilai
     * @param  int  $rowCount  jumlah baris yang ikut dihitung
     */
    public function __construct(
        public readonly array $values,
        public readonly int $rowCount,
    ) {}
}
```

`rowCount` wajib ada di setiap KPI builder, karena itulah yang dibandingkan
dengan `paginator->total()`.

### ReportConsistencyChecker

Membandingkan jumlah baris kedua jalur. Hanya berjalan di luar production.

```php
final class ReportConsistencyChecker {
    public function check(
        string $reportName,
        ReportKpi $kpi,
        int $tableTotal,
        array $filterSummary,
    ): ?array {
        if (app()->environment('production')) {
            return null;
        }
        if ($kpi->rowCount === $tableTotal) {
            return null;
        }

        Log::warning('Laporan: KPI tidak konsisten dengan isi tabel', [
            'report'      => $reportName,
            'kpi_rows'    => $kpi->rowCount,
            'table_rows'  => $tableTotal,
            'filter'      => $filterSummary,
        ]);

        return [
            'reportName' => $reportName,
            'kpiRows'    => $kpi->rowCount,
            'tableRows'  => $tableTotal,
            'filter'     => $filterSummary,
        ];
    }
}
```

Nilai balik non-null dikirim ke frontend sebagai prop `consistency`, yang memicu
banner peringatan.

### ReportIssueReporter

Menerjemahkan laporan masalah dari pengguna menjadi Ticket. Memakai model
`Helpdesk\Ticket` yang sudah ada, dengan nilai yang sudah tersedia di
`lang/*/helpdesk.php`:

| Field | Nilai |
|-------|-------|
| `type` | `bug_problem` |
| `priority` | `high` |
| `status` | `new` |
| `subject` | `Laporan {nama}: KPI tidak cocok dengan tabel` |
| `description` | filter aktif, jumlah baris KPI, jumlah baris tabel, URL |
| `assign_to_type` | `role` |
| `assign_to_id` | role tim IT |

Role tujuan dibaca dari konfigurasi, bukan ditulis mati, supaya bisa disesuaikan
per lingkungan.

Notifikasi memakai mekanisme notifikasi Laravel yang sudah dipakai
`TodoAssignedNotification`. Belum ada notification class untuk Ticket di repo,
jadi perlu dibuat satu: `ReportIssueNotification`.

### Peta jenis transaksi stok

`stock_ledger_entries.referenceable_type` berisi FQCN. Laporan Mutasi Stock
menerjemahkannya lewat peta yang ditulis di kode:

```php
final class TransactionTypeLabeler {
    private const MAP = [
        PurchaseReceipt::class => 'inventory.transactionType.purchaseReceipt',
        PurchaseInvoice::class => 'inventory.transactionType.purchaseInvoice',
        DeliveryNote::class    => 'inventory.transactionType.deliveryNote',
        StockEntry::class      => 'inventory.transactionType.stockEntry',
        // ...
    ];

    public function label(?string $fqcn): string {
        if ($fqcn === null) {
            return __('inventory.transactionType.unknown');
        }

        return isset(self::MAP[$fqcn])
            ? __(self::MAP[$fqcn])
            : class_basename($fqcn);   // fallback, jangan sampai kosong/error
    }
}
```

Daftar lengkap kelas yang menulis ke stock ledger harus ditelusuri dari kode
saat implementasi. Database dev saat ini hanya berisi `PurchaseInvoice` dan
`PurchaseReceipt`, jadi data bukan sumber yang bisa dipercaya untuk ini.

---

## Komponen frontend

### ReportLayout

Pembungkus yang merender kerangka seragam. `DataTable2` tidak menerima
`children` dan tidak punya slot header, jadi KPI dan grafik dirender sebagai
saudara di atasnya, bukan di dalamnya.

```jsx
export default function ReportLayout({ kpi, consistency, chart, children }) {
  return (
    <div className="flex flex-col gap-4">
      {consistency && <ConsistencyWarning {...consistency} />}
      <KpiStrip items={kpi} />
      {chart && <ReportChart {...chart} />}
      {children}
    </div>
  );
}
```

Halaman laporan jadi tipis, sejalan dengan pola halaman index yang ada:

```jsx
export default function Sales() {
  const { kpi, consistency, chart } = usePage().props;

  return (
    <ReportLayout kpi={kpi} consistency={consistency} chart={chart}>
      <DataTable2 selectable={false} hideDeleteAction />
    </ReportLayout>
  );
}
```

`selectable={false}` dan `hideDeleteAction` dipakai karena laporan baca-saja:
tidak ada aksi massal maupun penghapusan.

### ConsistencyWarning

Banner peringatan dengan tombol yang berbeda menurut izin pengguna.

- Semua pengguna melihat tombol **"Laporkan masalah ini"**.
- Pengguna dengan izin administratif juga melihat **"Hitung ulang akurat"**.

Tombol hitung ulang memanggil endpoint yang mengambil seluruh baris hasil filter
lewat jalur tabel lalu menjumlahkannya di aplikasi. Lambat, tapi hasilnya pasti
konsisten dengan tabel karena bersumber dari baris tabel itu sendiri.

Gating izin dilakukan di dua tempat: tombol disembunyikan di frontend, dan
endpoint memeriksa izin di backend. Penyembunyian di frontend saja tidak cukup.

---

## Keputusan desain dan alasannya

### KPI dihitung dengan agregasi SQL, bukan memuat semua baris

Alasan: laporan bisa mencakup ribuan baris. `SUM()` di database jauh lebih murah
daripada memuat seluruh baris ke PHP.

Konsekuensinya KPI dan tabel memakai query berbeda, yang memunculkan risiko
ketidakcocokan. Risiko itu diterima dan ditangani lewat Requirement 4 dan 5,
bukan dihindari dengan memuat semua baris.

Pengecualian: tombol "Hitung ulang akurat" justru sengaja memuat semua baris.
Di situ kebenaran lebih penting daripada kecepatan, dan pemakaiannya jarang.

### Pemeriksaan konsistensi tidak jalan di production

Alasan: pemeriksaan butuh satu query COUNT tambahan setiap laporan dimuat. Di
tabel besar itu beban nyata, dan pengguna tidak bisa berbuat apa-apa atas
hasilnya karena perbaikannya ada di kode.

Mismatch tertangkap lebih awal lewat pengujian otomatis dan pemakaian di
staging.

### Filter dasar dan filter lanjutan sengaja dipisah

Filter dasar (rentang tanggal, dropdown) adalah definisi populasi laporan,
berlaku pada KPI maupun tabel. Filter lanjutan `DataTableScope` (tree AND/OR,
saved filter) adalah penyaringan tambahan oleh pengguna, hanya pada tabel.

Konsekuensi yang perlu disadari: saat pengguna memakai filter lanjutan, KPI
akan mencakup lebih banyak baris daripada tabel, dan `ReportConsistencyChecker`
akan melaporkan selisih. Karena itu checker **harus** membedakan selisih yang
wajar (ada filter lanjutan aktif) dari yang mencurigakan (tidak ada filter
lanjutan tapi tetap beda).

Implementasinya: checker dilewati saat request membawa parameter filter lanjutan
(`fid`, `filter`, atau `search`). Ini ditegaskan sebagai syarat implementasi,
bukan detail opsional, karena tanpa itu peringatan akan muncul terus-menerus
pada pemakaian normal dan kehilangan maknanya.

### Permission mengikuti modul sumber

Tidak ada permission baru. Laporan memeriksa izin baca modul sumbernya lewat
mekanisme `Permission` yang sudah ada.

Konsekuensi yang perlu disadari tim: siapa pun yang bisa membaca modul Inventory
otomatis bisa melihat nilai persediaan, dan yang bisa membaca Finances bisa
melihat seluruh piutang. Kalau nanti dirasa terlalu longgar, pemisahan izin bisa
ditambahkan tanpa membongkar laporan.

---

## Pengujian

### Uji konsistensi KPI (wajib per laporan)

Pola yang sama untuk sembilan laporan:

```php
public function test_kpi_cocok_dengan_hitungan_manual_seluruh_baris(): void {
    // Siapkan data lewat factory, termasuk baris yang HARUS tersaring keluar
    // oleh filter, supaya uji ini benar-benar menguji filternya.

    $filter = new SalesFilter(dateFrom: '2026-01-01', dateTo: '2026-01-31', ...);

    $kpi = (new SalesKpiBuilder)->build($filter);

    $rows = SalesOrder::query()->tap(fn ($q) => $filter->applyTo($q))->get();

    $this->assertSame($rows->count(), $kpi->rowCount);
    $this->assertEqualsWithDelta(
        $rows->sum('amount'),
        $kpi->values['nilai_penjualan'],
        0.01,
    );
}
```

Uji ini yang menjadikan Requirement 4 nyata: kalau suatu saat filter di satu
jalur diubah tanpa mengubah yang lain, uji ini merah.

### Uji lain per laporan

- Filter menyaring dengan benar, termasuk kasus batas tanggal.
- Filter relasi bersarang menghasilkan baris yang benar.
- Permission: pengguna tanpa izin modul sumber ditolak.
- Export berisi seluruh baris hasil filter, bukan satu halaman.
- Peta jenis transaksi: FQCN tak dikenal jatuh ke `class_basename`, tidak error.
- Laporan kosong: KPI nol, tabel kosong, bukan error.

### Uji tombol laporkan masalah

- Ticket terbuat dengan `type` dan `priority` yang benar.
- Ticket ter-assign ke role IT.
- Notifikasi terkirim ke anggota role itu.
- Pengguna non-admin tidak bisa memanggil endpoint hitung ulang akurat.

---

## Yang TIDAK dikerjakan

Dicatat agar cakupan tidak melebar diam-diam:

- Tidak menambah kolom harga jual ke master item (lihat gap 1).
- Tidak menambah jenis pajak PPH atau potongan (lihat gap 2 sampai 4).
- Tidak menambah tanggal terima invoice pembelian (lihat gap 6).
- Tidak mengubah `DataTableScope` maupun `DataTable2`.
- Tidak menambah dependensi, termasuk package Excel. Export hanya PDF dan CSV.
- Tidak menyentuh model `Service\WorkOrder` yang sudah disembunyikan dari menu.
