# Requirements: Document Relation Panels

## 1. Ringkasan

Halaman dokumen menampilkan panel relasi berkolom untuk dokumen-dokumen yang
terhubung dengannya, menggantikan kemampuan yang hilang saat migrasi dari
aplikasi lama. Panel menampilkan kolom spesifik domain, baris total, dan tombol
aksi saat relasi belum terisi.

Data berasal dari `ModelConnection` yang sudah mencatat relasi secara otomatis.
Tidak ada relasi Eloquent baru yang ditambahkan ke model header.

## 2. Functional Requirements

### FR1: Panel Relasi Berkolom

Dokumen yang mendeklarasikan `expectedRelationPanels()` menampilkan tab
"Relations" berisi satu panel per jenis relasi.

Tiap panel menampilkan:

- Judul terlokalisasi.
- Tabel dengan kolom sesuai `relationPanel()['columns']` milik model tujuan.
- Satu baris per dokumen terhubung.
- Kolom pertama berupa tautan ke halaman dokumen tersebut.

**Acceptance:**

- PurchaseOrder yang punya PurchaseReceipt menampilkan panel "Info Penerimaan
  Barang" dengan kolom Kode, Tanggal, Total Qty.
- Mengklik kode penerimaan membuka halaman penerimaan tersebut.
- Dokumen tanpa `expectedRelationPanels()` tidak menampilkan tab Relations sama
  sekali dan halamannya tidak berubah.

### FR2: Baris Total

Kolom yang menyatakan `aggregate` menampilkan nilai agregat pada baris total di
bawah tabel.

**Acceptance:**

- Panel PurchaseReceipt dengan 2 penerimaan (qty 3 dan 5) menampilkan baris
  total bernilai 8.
- Kolom tanpa `aggregate` (mis. Kode, Tanggal) menampilkan sel kosong pada baris
  total.
- Panel yang tidak punya kolom ber-`aggregate` sama sekali tidak menampilkan
  baris total.
- Nilai agregat dihitung di backend, bukan di React.

### FR3: Empty State dengan Aksi

Panel yang dideklarasikan di `expectedRelationPanels()` tetap tampil walau belum
punya dokumen terhubung.

**Acceptance:**

- PurchaseOrder tanpa PurchaseInvoice tetap menampilkan panel "Info Tagihan"
  berisi teks kosong terlokalisasi.
- Panel kosong yang punya `action` menampilkan tombol yang menuju halaman
  pembuatan dokumen dengan query `ref` terisi.
- Tombol aksi tidak muncul bila user tidak punya permission `create` pada model
  tujuan.
- Panel kosong tanpa `action` menampilkan teks kosong saja.

### FR4: Tree Connections Dipertahankan

Tree Connections di sidebar tetap berfungsi seperti sebelumnya.

**Acceptance:**

- Setelah fitur ini aktif, sidebar tetap menampilkan seluruh relasi termasuk
  jenis yang sudah punya panel.
- Prop `connections` dan payload-nya tidak berubah bentuk.
- Panel relasi dikirim lewat prop defer terpisah bernama `relationPanels`.

### FR5: Pemuatan Tertunda

Panel dimuat lewat Inertia deferred props, tidak memblokir render halaman.

**Acceptance:**

- Halaman dokumen tampil sebelum data panel selesai dimuat.
- Selama pemuatan, area panel menampilkan skeleton beranimasi.
- Kegagalan memuat `relationPanels` tidak mengganggu tree Connections di
  sidebar, dan sebaliknya.

### FR6: Syarat Tampil

Panel hanya muncul pada dokumen yang sudah disubmit.

**Acceptance:**

- Dokumen berstatus draft tidak menampilkan tab Relations.
- Syarat mengikuti kondisi `hasConnections` yang berlaku sekarang:
  `submitable && status && !inArray(status, "draft")`.

Pengecualian: `Opportunity` tidak memakai trait `Submitable` dan tabel
`opportunities` tidak punya kolom `submitted_at`, `status`, maupun
`created_by_id`, sehingga syarat ini tidak dapat diterapkan. Panelnya tampil
selama dokumennya ada.

Ini tidak membuka celah. Opportunity hanya menjadi sumber panel, tujuannya
adalah `Quotation` yang submitable dan punya ketiga kolom itu, sehingga
penjagaan di FR8 tetap berlaku penuh pada baris yang ditampilkan.

### FR7: Keamanan Query

Penyusunan panel tidak menimbulkan N+1 query.

**Acceptance:**

- Satu query untuk `ModelConnection`.
- Satu query `whereIn` per jenis relasi untuk memuat record tujuan beserta
  relasi yang dibutuhkan.
- Jumlah query tidak bertambah seiring jumlah baris dalam satu panel.

### FR7a: Rincian Item per Baris

Baris dokumen pada panel dapat dibuka untuk menampilkan item yang dibawanya.

**Acceptance:**

- Baris penerimaan punya kontrol buka/tutup; mengkliknya menampilkan tabel item
  berisi nama item dan qty.
- Nama item terbaca, bukan kosong atau id.
- Model tujuan tanpa `relationPanelDetail()` tidak menampilkan kontrol buka, dan
  barisnya tetap seperti sebelumnya.
- Memuat rincian tidak menambah query per baris (eager load per tipe).

### FR7b: Sisa yang Belum Diterima

Panel menampilkan item yang masih kurang, terpisah dari daftar dokumen.

**Acceptance:**

- Di bawah daftar penerimaan ada blok berisi item dengan
  `unreceived_quantity > 0`, menampilkan nama item dan sisa qty.
- Item yang belum diterima sama sekali muncul di blok ini.
- Blok tidak muncul sama sekali ketika seluruh item sudah diterima.
- Angka sisa berasal dari kolom di database, tidak dihitung ulang di frontend.

### FR8: Penjagaan Baris Panel

Baris panel hanya menampilkan dokumen yang boleh dilihat user.

**Acceptance:**

- Tanpa permission `read` pada model tujuan, panel muncul tanpa baris.
- Permission yang hanya berlaku lewat entry `only_creator` membatasi baris ke
  dokumen buatan user sendiri.
- Dokumen submitable milik user lain yang belum disubmit tidak muncul sebagai
  baris; draft milik user sendiri tetap muncul.
- Penjagaan dievaluasi di backend, bukan dengan menyembunyikan baris di
  frontend.

### FR9: Ketahanan terhadap Baris Audit

Baris `model_connections` dengan `reference_type` berupa penanda bebas
(`sync`, `mark_done`) tidak merusak penyusunan panel.

**Acceptance:**

- PurchaseOrder yang pernah di-`syncItems` (punya baris `reference_type: sync`)
  tetap menampilkan panel dengan benar.
- Tidak ada error "Class not found".

## 3. Cakupan Bertahap

| Tahap | Dokumen | Panel |
|-------|---------|-------|
| 1 | PurchaseOrder | PurchaseReceipt, PurchaseInvoice |
| 2 | SalesOrder | SalesInvoice, DeliveryNote |
| 3 | AssetService | PurchaseRequest, PurchaseOrder, SalesOrder, InternalOrder |
| 4 | PurchaseRequest | PurchaseOrder |
| 4 | PurchaseInvoice | PaymentEntry |
| 4 | SalesInvoice | PaymentEntry |
| 4 | WorkOrder | PurchaseRequest |
| 4 | Quotation | SalesOrder |
| 4 | Opportunity | Quotation |
| 4 | InternalOrder | DeliveryNote |
| 5 | PurchaseReceipt | Retur penerimaan |
| 5 | DeliveryNote | Retur pengiriman |

Cakupan ditentukan dari dua sumber yang saling melengkapi: `DocumentSubmitted`
di service menentukan dokumen mana yang muncul sebagai baris panel, sedangkan
dropdown Actions dengan parameter `ref` di halaman Show menentukan tombol pada
panel kosong.

Sebagian panel akan tampil kosong sampai spec `document-connection-coverage`
selesai, karena lima service belum mencatat koneksi sama sekali. Itu soal data,
bukan panel.

Panel PaymentEntry **tidak termasuk**. Verifikasi T05 membuktikan koneksi
langsung `PurchaseOrder -> PaymentEntry` tidak pernah tertulis karena
`PaymentEntry.paymentable` selalu menunjuk ke Invoice, dan `purchase_invoices`
tidak punya kolom `referenceable` untuk melanjutkan rantai. Rinciannya di
`design.md` bagian 4.

## 4. Non-Functional Requirements

### NFR1: Lokalisasi

Seluruh judul panel, label kolom, teks empty state, dan label tombol memakai
kunci terjemahan. Tidak ada string Indonesia atau Inggris yang di-hardcode di
komponen.

### NFR2: Konsistensi Visual

Panel memakai komponen yang sudah ada (`FormPageContent`, `Button`, `Link`) dan
mengikuti pola tabel yang berlaku di halaman dokumen.

### NFR3: Testing

- Unit test untuk `RelationPanelService`: penyusunan payload, agregat, empty
  state, penyaringan baris audit, pengecekan permission, dan ketiga lapis
  penjagaan baris pada FR8.
- Feature test per dokumen: prop `relationPanels` berisi struktur yang benar.
- RTL test untuk `RelationPanels.jsx` dan `RelationPanel`: render tabel, baris
  total, empty state dengan dan tanpa tombol.

## 5. Di Luar Cakupan

- Mengubah pencatatan `ModelConnection`.
- Menghapus tree Connections.
- Panel untuk relasi tidak langsung.
- Konfigurasi kolom oleh pengguna.
- Model dokumen retur baru.
