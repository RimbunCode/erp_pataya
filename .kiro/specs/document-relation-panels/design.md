# Design: Document Relation Panels

## 1. Masalah

Halaman dokumen di aplikasi baru menampilkan relasi antar-dokumen sebagai tree
link generik di sidebar (`SidebarChildren`, `FormPage.jsx:1616`). Payload yang
tersedia hanya `reference_type`, label model, `count`, dan daftar
`reference_display` + route (`app/Traits/DataTable.php:769`).

Aplikasi lama menampilkan relasi yang sama sebagai kartu berkolom:

| Dokumen | Panel | Kolom |
|---------|-------|-------|
| PurchaseOrder | Info Penerimaan Barang | Receive No, Tanggal, Quantity |
| PurchaseOrder | Info Pembayaran | No Pembayaran, Metode, Total |
| PurchaseOrder | Retur Barang | (kosong) + tombol Retur Barang |
| SalesOrder | Info Tagihan | (kosong) + tombol Buat Tagihan |
| SalesOrder | Info Pengiriman | No Pengiriman, Status, Jumlah |
| AssetService | Info Permintaan Pembelian | No, Status |
| AssetService | Info Purchase Order | (kosong) |
| AssetService | Info Internal Order | (kosong) |

Tiga kemampuan yang hilang di aplikasi baru:

1. Kolom spesifik domain (tanggal, qty, metode bayar, status kirim).
2. Baris agregat total.
3. Tombol aksi yang justru muncul **ketika relasi kosong** ("Buat Tagihan").
   Tree sekarang menyembunyikan node kosong sepenuhnya.

## 2. Keputusan Arsitektur

### 2.1 Sumber data: ModelConnection, bukan relasi Eloquent baru

`ModelConnection` sudah mencatat seluruh relasi yang dibutuhkan. Verifikasi di
database staging:

```
PurchaseOrder   -> PurchaseReceipt     (PSN/PO-0004/26 -> PSN/Receipt-0003/26)
PurchaseOrder   -> PurchaseInvoice     (PSN/PO-0001/26 -> PSN/PurchaseINV-0004/26)
PurchaseRequest -> PurchaseOrder
PurchaseRequestItem -> PurchaseOrderItem   data: {"ordered_quantity": 22}
```

Pencatatan berjalan otomatis lewat `CreateDocumentConnection` listener pada
event `DocumentSubmitted`.

Alternatif yang ditolak: menambah relasi `receipts()`, `invoices()`,
`payments()` di tiap model header. Ditolak karena membuat dua sumber kebenaran
untuk relasi yang sama, dan tiap modul harus mendefinisikan ulang relasinya.

### 2.2 Lokasi: body sebagai tab, bukan sidebar

Sidebar dibatasi `lg:max-w-72` (`FormPage.jsx:1598`). Tabel 3 kolom tidak muat.

Panel dirender sebagai `FormPageContent` sehingga muncul sebagai tab di
`TabsList`, mengikuti pola `ServiceActivityLog`
(`resources/js/Pages/Asset/Services/ServiceActivityLog.jsx`).

Slot tab bernama `connections` pernah disiapkan lalu dikomentari
(`FormPage.jsx:380-392` dan `FormPage.jsx:426`); komponen `Connections` sendiri
sudah tidak ada di tree. Desain ini mengaktifkan kembali konsep tersebut dengan
implementasi baru.

### 2.3 Tree sidebar dipertahankan

Tree Connections di sidebar **tidak dihapus dan tidak disembunyikan**. Dua
fungsi berbeda:

- Sidebar: navigasi cepat ke **semua** relasi, termasuk jenis yang tidak punya
  panel khusus.
- Tab: detail berkolom untuk jenis relasi yang penting secara bisnis.

### 2.4 Agregat dihitung di backend

Total qty dan nilai uang dihitung di PHP saat menyusun payload defer, bukan di
React. Alasan: pembulatan harus sama dengan nilai yang dipakai service lain
(mis. `PurchaseOrderService::syncItems`).

## 3. Arsitektur

### 3.1 Deklarasi panel di model tujuan

Tiap model yang bisa menjadi relasi mendeklarasikan bagaimana ia ditampilkan.
Deklarasi diletakkan di model tujuan (bukan model sumber) agar satu definisi
dipakai oleh semua dokumen yang menunjuk ke sana.

```php
// app/Models/Purchase/PurchaseReceipt.php
public static function relationPanel(): array {
    return [
        'title'   => 'purchase.purchaseReceipt.panel.title',
        'columns' => [
            ['key' => 'code',           'label' => 'purchase.purchaseReceipt.panel.code',     'align' => 'left'],
            ['key' => 'date',           'label' => 'purchase.purchaseReceipt.panel.date',     'align' => 'left',  'format' => 'date'],
            ['key' => 'total_quantity', 'label' => 'purchase.purchaseReceipt.panel.quantity', 'align' => 'right', 'format' => 'number', 'aggregate' => 'sum'],
        ],
    ];
}

/**
 * Nilai per baris panel. Dipanggil sekali per record relasi.
 *
 * @return array<string, mixed>
 */
public function relationPanelRow(): array {
    return [
        'code'           => $this->code,
        'date'           => $this->date,
        'total_quantity' => $this->items->sum('quantity'),
    ];
}
```

`aggregate` pada definisi kolom menentukan isi baris total: `sum`, atau tidak
ada sama sekali (kolom total dibiarkan kosong).

`aggregate_key` memisahkan nilai yang dijumlahkan dari nilai yang ditampilkan.
Kolom uang membutuhkannya: `PurchaseInvoice.currency_code` diisi per-invoice
saat create (`PurchaseInvoiceService::fillRelations`), bukan diwarisi dari PO,
sehingga satu PO boleh punya invoice dengan mata uang berbeda. Baris
menampilkan `amount` (mata uang transaksi, nilai asli dokumen), sedangkan baris
total menjumlahkan `amount_base_currency`, generated column yang selalu dalam
mata uang dasar. Tanpa pemisahan ini, baris total menjumlahkan angka yang tidak
sebanding.

### 3.2 Deklarasi panel yang diharapkan di model sumber

Model sumber mendeklarasikan panel apa saja yang **mungkin** ada, termasuk yang
belum terisi, beserta aksi untuk membuatnya. Ini yang membuat empty state
dengan tombol bisa muncul.

```php
// app/Models/Purchase/PurchaseOrder.php
public static function expectedRelationPanels(): array {
    return [
        PurchaseReceipt::class => [
            'action' => [
                'route'      => 'purchaseReceipts.create',
                'params'     => ['ref' => 'purchaseOrder/{id}'],
                'label'      => 'purchase.purchaseOrder.actions.create_purchase_receipt',
                'permission' => 'create',
            ],
        ],
        PurchaseInvoice::class => [
            'action' => [
                'route'      => 'purchaseInvoices.create',
                'params'     => ['ref' => 'purchaseOrder/{id}'],
                'label'      => 'purchase.purchaseOrder.actions.create_purchase_invoice',
                'permission' => 'create',
            ],
        ],
        PaymentEntry::class => ['action' => null],
    ];
}
```

Model yang tidak mendefinisikan `expectedRelationPanels()` tidak mendapat tab
panel; halaman dokumennya tidak berubah sama sekali.

### 3.3 Service penyusun payload

Logika penyusunan dipisah dari trait `DataTable` yang sudah besar.

`app/Services/Core/Connection/RelationPanelService.php`:

```php
/**
 * @return array<int, array{
 *   reference_type: string,
 *   title: string,
 *   columns: array<int, array{key: string, label: string, align: string, format?: string}>,
 *   rows: array<int, array<string, mixed>>,
 *   totals: array<string, mixed>,
 *   action: array{url: string, label: string}|null,
 *   is_empty: bool
 * }>
 */
public function build(Model $document): array
```

Alur:

1. Baca `$document::expectedRelationPanels()`. Kalau kosong, kembalikan `[]`.
2. Query `ModelConnection::search($documentClass, $document->getKey())` satu
   kali, lalu kelompokkan per `reference_type`.
3. Saring hanya `reference_type` yang ada di daftar expected. Baris audit
   (`sync`, `mark_done`) tersaring otomatis karena bukan nama kelas model.
4. Untuk tiap tipe, muat record tujuan dalam **satu** query
   `whereIn('id', $ids)` beserta relasi yang dibutuhkan `relationPanelRow()`.
5. Panggil `relationPanelRow()` per record, hitung `totals` dari kolom yang
   punya `aggregate`.
6. Untuk tipe expected yang tidak punya koneksi sama sekali: hasilkan entri
   dengan `rows: []`, `is_empty: true`, dan `action` terisi.
7. Resolusi `action.url` memakai `route()` dengan `{id}` diganti id dokumen.
   Entri dilewati kalau user tidak punya permission yang disebut.

### 3.4 Pengiriman ke frontend

Ditambahkan ke `Inertia::share` di `LinkModel::showDetail()`
(`app/Traits/LinkModel.php:496`), sebagai prop defer terpisah dari
`connections` yang sudah ada:

```php
'relationPanels' => Inertia::defer(
    fn () => app(RelationPanelService::class)->build($this),
    'relationPanels',
),
```

Prop terpisah, bukan memperbesar `connections`, supaya tree sidebar tetap
ringan dan dua fitur bisa gagal independen.

### 3.5 Komponen frontend

`resources/js/Pages/Core/Components/RelationPanels.jsx`:

```jsx
<FormPageContent value="relations" title={t("core.form.relations")}>
  <Deferred data={["relationPanels"]} fallback={<PanelSkeleton />}>
    {panels.map((panel) => (
      <RelationPanel key={panel.reference_type} panel={panel} />
    ))}
  </Deferred>
</FormPageContent>
```

`RelationPanel` merender satu kartu:

- Judul panel + tombol aksi di kanan (dari `panel.action`).
- Kalau `is_empty`: teks kosong terlokalisasi, tanpa tabel.
- Kalau terisi: tabel dengan header dari `panel.columns`, baris dari
  `panel.rows`, baris total dari `panel.totals` (hanya bila ada kolom
  ber-`aggregate`).
- Kolom pertama dirender sebagai `Link` ke `route(panel.route, row.id)`.
- `format` kolom menentukan rendering: `date` lewat `TZDate` + `format()` sesuai
  pola `ServiceActivityLog.jsx:47`, `number` dan `currency` lewat helper yang
  sudah ada di `@/lib/utils`.

Dipasang di halaman dokumen sebagai child `FormPage`:

```jsx
// resources/js/Pages/Purchase/PurchaseOrders/Show.jsx
<FormPage ...>
  <Form />
  {purchaseOrder?.submitted_at && <RelationPanels />}
</FormPage>
```

### 3.6 Catatan: tidak memakai `sidebarContent`

Prop `sidebarContent` (`FormPage.jsx:692`) mendukung callback dan belum dipakai
halaman mana pun. Prop ini **tidak** dipakai di sini karena keputusan 2.2
menempatkan panel di body. Prop tetap tersedia untuk kebutuhan lain.

## 4. Cakupan Panel

### Tahap 1 — PurchaseOrder

| Panel | Kolom | Agregat | Aksi saat kosong |
|-------|-------|---------|------------------|
| PurchaseReceipt | Kode, Tanggal, Total Qty | sum qty | Buat Penerimaan |
| PurchaseInvoice | Kode, Tanggal, Total | sum total | Buat Tagihan |

#### Hasil T05: panel PaymentEntry dikeluarkan dari tahap 1

Koneksi langsung `PurchaseOrder -> PaymentEntry` **tidak pernah tertulis**.
Diverifikasi lewat kode, database staging, dan test.

Rantainya terputus di dua titik:

1. `PaymentEntryService::fillRelations()` (baris 38) selalu mengisi
   `paymentable_type` dengan `PurchaseInvoice` atau `SalesInvoice`. Tidak ada
   jalur yang mengisinya dengan `PurchaseOrder`.
2. `PaymentEntryService::submit()` (baris 68) memancarkan
   `DocumentSubmitted($paymentEntry, $paymentEntry->paymentable)`, jadi
   referensinya adalah Invoice.
3. Tabel `purchase_invoices` tidak punya kolom `referenceable_type` /
   `referenceable_id` — hanya `purchase_invoice_items` yang punya. Guard di
   `CreateDocumentConnection` (baris 33) karena itu tidak pernah memanggil
   `attachConnections()`, sehingga rantai berhenti di Invoice.

Bukti di database staging: satu PaymentEntry sudah submit
(`PaymentEntry-0001/26`, 15 September 2026, status `paid`), tetapi tidak ada
satu pun baris `model_connections` yang menyebut `PaymentEntry` di sisi mana
pun.

Perilaku ini dikunci oleh test
`chain_stops_when_parent_has_no_referenceable_column` di
`tests/Feature/Core/DocumentConnectionTest.php`.

Konsekuensi untuk desain ini: panel pembayaran di halaman PurchaseOrder
(gambar "Info Pembayaran" pada aplikasi lama) **tidak dapat dibangun dari
koneksi langsung**. Opsi yang tersedia, di luar cakupan spec ini:

- Panel pembayaran dipasang di halaman **PurchaseInvoice**, tempat koneksinya
  memang ada.
- Atau `RelationPanelService` diberi kemampuan membaca relasi dua tingkat
  (PO → Invoice → Payment). Ini menambah kompleksitas query dan mengubah
  kontrak `expectedRelationPanels()`.

Keputusan: tahap 1 berjalan tanpa panel PaymentEntry. Pilihan di atas dibahas
terpisah setelah pola panel terbukti di T06.

### Tahap 2 — SalesOrder

| Panel | Kolom | Agregat | Aksi saat kosong |
|-------|-------|---------|------------------|
| SalesInvoice | Kode, Tanggal, Total | sum total | Buat Tagihan |
| DeliveryNote | Kode, Status, Total Qty | sum qty | Buat Pengiriman |

### Tahap 3 — AssetService

| Panel | Kolom | Agregat | Aksi saat kosong |
|-------|-------|---------|------------------|
| PurchaseRequest | Kode, Status | — | Buat PR |
| PurchaseOrder | Kode, Status | — | Buat PO |
| InternalOrder | Kode, Status | — | Buat IO |

Aksi tahap 3 menduplikasi dropdown Actions yang sudah ada di
`Asset/Services/Show.jsx:76-117`. Dropdown **tetap dipertahankan**; panel
menyediakan jalur kedua yang kontekstual.

## 5. Yang Tidak Termasuk

- Mengubah cara `ModelConnection` mencatat relasi.
- Menghapus atau menyembunyikan tree Connections di sidebar.
- Panel untuk relasi tidak langsung (PO → Invoice → Payment) di luar verifikasi
  T05.
- Kolom yang dapat dikonfigurasi pengguna.
- Retur barang sebagai jenis dokumen baru. `returnAgainst()` sudah ada di
  `PurchaseReceipt` dan `PurchaseInvoice`; panel retur memakai relasi tersebut
  bila koneksinya tercatat, tidak membuat model baru.

## 6. Risiko

| Risiko | Mitigasi |
|--------|----------|
| N+1 query saat `relationPanelRow()` mengakses relasi | Eager load eksplisit per tipe di langkah 3.3.4; uji dengan assertion jumlah query |
| Nama kelas penanda bebas (`sync`, `mark_done`) di `reference_type` | Saringan `is_subclass_of(..., Model::class)` sama seperti `DataTable.php:779` |
| Tab tambahan membuat halaman dokumen terasa ramai | Panel hanya muncul untuk dokumen yang sudah submit, mengikuti syarat `hasConnections` yang berlaku sekarang |
| Permission bocor lewat tombol aksi | Resolusi aksi memanggil pengecekan permission di backend, bukan hanya menyembunyikan di frontend |
| Baris panel membocorkan dokumen yang tidak boleh dilihat user | Lihat 3.7 |

### 3.6a Rincian item per baris

Panel penerimaan dan tagihan menampilkan dokumen, bukan isinya. Untuk menjawab
"item apa saja yang sudah diterima, dan apa yang masih kurang", panel perlu dua
tambahan.

#### Rincian per baris (expand)

Tiap baris dokumen dapat dibuka untuk menampilkan item yang dibawanya.
Definisinya ada di model tujuan, sejajar `relationPanel()`:

```php
// app/Models/Purchase/PurchaseReceipt.php
public static function relationPanelDetail(): array {
    return [
        'columns' => [
            ['key' => 'item',     'label' => '...', 'align' => 'left'],
            ['key' => 'quantity', 'label' => '...', 'align' => 'right', 'format' => 'number'],
        ],
        'eager' => ['items.item'],
    ];
}

/**
 * @return array<int, array<string, mixed>>
 */
public function relationPanelDetailRows(): array {
    return $this->items->map(fn (PurchaseReceiptItem $item): array => [
        'item'     => $item->item?->item_name ?? $item->item_name,
        'quantity' => $item->quantity,
    ])->all();
}
```

Model tanpa `relationPanelDetail()` tidak mendapat tombol buka, dan barisnya
tetap seperti sekarang.

Nama item diambil dari relasi `item` yang menunjuk `ItemVariant`, bukan dari
kolom `purchase_receipt_items.item_name`: kolom itu override opsional dan
umumnya null.

#### Sisa yang belum diterima

Item yang belum diterima sama sekali tidak ada di receipt mana pun, jadi tidak
punya tempat di dalam expand. Ia ditampilkan sebagai blok terpisah di bawah
daftar dokumen, didefinisikan di model sumber:

```php
// app/Models/Purchase/PurchaseOrder.php
public static function expectedRelationPanels(): array {
    return [
        PurchaseReceipt::class => [
            'action'    => [...],
            'remainder' => [
                'title'   => 'purchase.purchaseOrder.panel.receipt.remainder',
                'columns' => [
                    ['key' => 'item',      'label' => '...', 'align' => 'left'],
                    ['key' => 'remaining', 'label' => '...', 'align' => 'right', 'format' => 'number'],
                ],
                'rows' => 'unreceivedItemRows',
            ],
        ],
    ];
}

/**
 * @return array<int, array<string, mixed>>
 */
public function unreceivedItemRows(): array {
    return $this->items
        ->filter(fn (PurchaseOrderItem $item): bool => $item->unreceived_quantity > 0)
        ->map(fn (PurchaseOrderItem $item): array => [
            'item'      => $item->item?->item_name ?? $item->item_name,
            'remaining' => $item->unreceived_quantity,
        ])
        ->values()
        ->all();
}
```

`unreceived_quantity` dan `unbilled_quantity` adalah stored generated column di
`purchase_order_items`, jadi tidak ada perhitungan di PHP maupun React.

Blok ini disembunyikan ketika tidak ada sisa, sehingga PO yang sudah lengkap
tidak menampilkan tabel kosong.

#### Catatan arsitektur

Rincian item membaca relasi Eloquent, bukan `ModelConnection`. Keputusan 2.1
tetap berlaku untuk **daftar dokumen**: koneksi menentukan dokumen mana yang
muncul sebagai baris. Isi tiap baris lalu diambil lewat relasi model tujuan,
karena `model_connections` tidak punya baris
`PurchaseOrderItem -> PurchaseReceiptItem` sama sekali (diverifikasi di
database staging), sedangkan `purchase_receipt_items.purchase_order_item_id`
adalah foreign key langsung.

Penjagaan di 3.7 tetap menentukan dokumen mana yang boleh dimuat. Rincian item
hanya dibaca dari dokumen yang sudah lolos penjagaan itu, jadi tidak ada jalur
baru yang melewatinya.

### 3.6b Panel retur

PurchaseReceipt dan DeliveryNote punya tombol membuat retur
(`purchase.purchaseReceipt.create_purchase_return`,
`inventory.deliveryNote.actions.create_sales_return`). Dokumen retur adalah
record sejenis dengan `return_against_id` terisi.

Retur tidak tercatat di `ModelConnection`: saat disubmit, `DocumentSubmitted`
dipancarkan dengan reference `purchaseOrder`, bukan receipt yang diretur.
Hubungannya hanya ada sebagai foreign key.

Panel retur karena itu memakai sumber baris sendiri, sejajar `remainder`:

```php
// app/Models/Purchase/PurchaseReceipt.php
public static function expectedRelationPanels(): array {
    return [
        self::class => [
            'action' => [
                'route'      => 'purchaseReceipts.create',
                'params'     => ['ref' => 'purchaseReceipt/{id}'],
                'label'      => 'purchase.purchaseReceipt.create_purchase_return',
                'permission' => 'create',
            ],
            'source' => 'returnRows',
        ],
    ];
}
```

`source` menyebut method pada dokumen sumber yang mengembalikan record retur.
Ketika ada, `RelationPanelService` memakai hasilnya sebagai baris panel dan
melewati `ModelConnection` sepenuhnya. Penjagaan di 3.7 tetap berlaku: method
itu mengembalikan query builder, bukan koleksi, sehingga `loadRecords()` dapat
menerapkan ketiga lapisnya seperti biasa.

Panel retur menunjuk tipe dokumen yang sama dengan dokumennya sendiri
(`PurchaseReceipt` di halaman PurchaseReceipt). `relationPanel()` yang sudah
ada dipakai ulang, jadi kolomnya sama dengan panel penerimaan di halaman PO.

### 3.7 Penjagaan baris panel

Baris panel adalah data dokumen lain, jadi hak akses atas dokumen yang sedang
dibuka tidak cukup.

`$model->newQuery()` tidak membawa penjagaan apa pun. `DataTableScope::apply()`
kosong: scope itu hanya mendaftarkan macro `dataTable()`, dan seluruh filter
(cabang, `submitted_at`, `created_by_id`) hidup di dalam macro yang harus
dipanggil eksplisit. Model dokumen seperti `PurchaseReceipt` juga tidak memakai
trait `HasBranch`, jadi tidak ada global scope cabang yang menolong.

`RelationPanelService::loadRecords()` karena itu meniru jalur controller dengan
tiga lapis:

1. Tanpa permission `read` pada model tujuan, panel tetap muncul tetapi tanpa
   baris sama sekali.
2. Permission yang hanya berlaku lewat entry `only_creator` membatasi baris ke
   dokumen buatan user sendiri, sama seperti filter `created_by_id` di listing.
3. Dokumen submitable yang belum disubmit hanya terlihat oleh pembuatnya, guard
   yang sama dengan macro `dataTable()`.

Penjagaan memakai `Auth::user()`, bukan `request()->user()`. Di luar siklus HTTP
`request()` adalah instance kosong tanpa user resolver, sehingga `user()`-nya
selalu null dan seluruh baris akan hilang diam-diam. Pola ini sama dengan
`HasBranch::bootHasBranch()`.

Keterbatasan yang diketahui: `PermissionChecker::forUser()` membaca
`$request->user()` pada jalur fallback-nya, sehingga di konteks non-HTTP tanpa
session ia mengembalikan permission kosong. Akibatnya fail closed (tidak ada
baris), bukan kebocoran. Perilaku itu milik kode yang sudah ada dan tidak
diubah oleh spec ini.
