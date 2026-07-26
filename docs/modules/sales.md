# Modul Sales

> Dokumentasi modul penjualan: Sales Orders, Internal Orders, Customers.

## Daftar Isi

- [Gambaran Modul](#gambaran-modul)
- [Korelasi Antar-Feature](#korelasi-antar-feature)
- [Sales Order](#sales-order)
- [Item & Variant](#item--variant)
- [Internal Order](#internal-order)
- [Customer](#customer)
- [Status Workflow](#status-workflow)
- [Business Flow End-to-End](#business-flow-end-to-end)
- [Flow Retur (returnAgainst)](#flow-retur-returnagainst)

---

## Gambaran Modul

Modul Sales mengelola proses penjualan dari pembuatan order hingga pengiriman dan penagihan.

**Model utama:**

| Model | Tabel | Submitable |
|---|---|---|
| `SalesOrder` | `sales_orders` | Ya |
| `SalesOrderItem` | `sales_order_items` | — |
| `InternalOrder` | `internal_orders` | Ya |
| `InternalOrderItem` | `internal_order_items` | — |
| `Customer` | `customers` | Tidak |

**Services:** `SalesOrderService`, `InternalOrderService`, `CustomerService`

**Permissions:**

| Role | SO Actions | IO Actions |
|---|---|---|
| Sales Officer | select, read, write, create, delete, submit, cancel, amend, print | select, read, write, create, delete, submit, cancel, amend, print |
| Approver | select, read, submit, cancel, amend, print | select, read, submit, cancel, amend, print |
| Auditor | select, read, print | select, read, print |
| System Manager | Semua | Semua |

---

## Korelasi Antar-Feature

Sales Order adalah **pusat** dari proses penjualan — dari sini lahir dokumen pengiriman, tagihan, sampai pembayaran. Diagram berikut menggambarkan perjalanan satu Sales Order dari dibuat sampai selesai:

```mermaid
flowchart LR
    SO(["📋 Sales Order<br/>dibuat & disetujui"])
    DN["🚚 Delivery Note<br/>barang dikirim"]
    SI["🧾 Sales Invoice<br/>tagihan dibuat"]
    PE["💰 Payment Entry<br/>uang diterima"]
    Ledger[("📚 Buku Besar<br/>& Kartu Stok")]
    Closed(["✅ Sales Order Selesai"])

    SO ==> DN
    SO ==> SI
    DN -.->|"stok berkurang"| Ledger
    SI -.->|"piutang bertambah"| Ledger
    SI --> PE
    PE -.->|"kas bertambah, piutang berkurang"| Ledger
    DN --> Closed
    SI --> Closed
    PE --> Closed

    style SO fill:#3b82f6,stroke:#1d4ed8,color:#fff,stroke-width:2px
    style Closed fill:#22c55e,stroke:#15803d,color:#fff,stroke-width:2px
    style DN fill:#fef3c7,stroke:#d97706
    style SI fill:#fef3c7,stroke:#d97706
    style PE fill:#dcfce7,stroke:#16a34a
    style Ledger fill:#f3f4f6,stroke:#6b7280
```

**Cara membaca diagram ini:**
- Panah tebal (`==>`) = **alur utama** dokumen (satu Sales Order bisa punya banyak Delivery Note dan Sales Invoice).
- Panah putus-putus = **efek otomatis** ke pembukuan/stok setiap dokumen di-submit — tidak perlu diinput manual.
- Sales Order dianggap **Selesai** setelah seluruh barang terkirim, seluruh tagihan terbit, dan pembayarannya lunas.

> Delivery Note dan Sales Invoice bisa dibuat dalam **urutan bebas** — lihat [Dual Flow](#dual-flow-so--dn--si-atau-so--si--dn) untuk penjelasannya. Alur setara di sisi pembelian: [Purchase · Korelasi](purchase.md#korelasi-antar-feature).

---

## Sales Order

Sales Order (SO) adalah dokumen utama proses penjualan ke customer.

### Fields Utama

| Field | Tipe | Deskripsi |
|---|---|---|
| `code` | string | Kode SO (auto: FormatingSeries) |
| `customer` | relation | Customer pemesan |
| `customer_branch` | relation | Cabang customer |
| `date` | datetime | Tanggal SO |
| `is_rent` | boolean | Apakah transaksi rental |
| `start_date` / `end_date` | datetime | Periode rental (jika is_rent) |
| `items` | hasMany | Line items (lihat [Item & Variant](#item--variant)) |
| `currency` | relation | Mata uang transaksi |
| `discount_on` | enum | `grand_total` / `net_total` |
| `discount_rate` | double | Persentase diskon |
| `amount` | double | Total SO |
| `payment_schedules` | morphMany | Jadwal pembayaran |
| `status` | json | Status aktif (multi-status) |

### Default Format Kode

`@[branch_code]/SO-@[iiii]/@[yy]` → contoh: `HO/SO-0001/25`

### Status Workflow SO

```mermaid
stateDiagram-v2
    [*] --> Draft: Dibuat
    Draft --> Diajukan: Submit
    Diajukan --> MenungguPersetujuan: Ada skema approval
    Diajukan --> SiapProses: Tidak ada skema (langsung disetujui)
    MenungguPersetujuan --> SiapProses: Disetujui
    MenungguPersetujuan --> Ditolak: Ditolak
    Ditolak --> Draft: Direvisi (amend)

    state SiapProses {
        [*] --> BelumKirimBelumTagih
        BelumKirimBelumTagih --> SebagianTerkirim: Sebagian dikirim
        SebagianTerkirim --> Terkirim: Semua dikirim
        BelumKirimBelumTagih --> SebagianTertagih: Sebagian ditagih
        SebagianTertagih --> Tertagih: Semua ditagih
    }

    SiapProses --> Selesai: Terkirim & Tertagih tuntas
    SiapProses --> Dibatalkan: Cancel
```

> **Catatan:** Pengiriman dan penagihan berjalan **independen** — satu Sales Order bisa "sudah terkirim tapi belum tertagih", atau sebaliknya, sampai keduanya benar-benar tuntas dan status berubah jadi Selesai.

### Apa yang Terjadi Saat Anda Klik "Submit"

```mermaid
sequenceDiagram
    actor U as Sales Officer
    participant Sys as Sistem ERP

    U->>Sys: Klik tombol "Submit"

    rect rgb(240, 249, 255)
        Note over Sys: Otomatis, tanpa perlu tindakan tambahan
        Sys->>Sys: 1️⃣ Buat kode dokumen resmi
        Sys->>Sys: 2️⃣ Kunci stok yang dipesan di gudang asal
        Sys->>Sys: 3️⃣ Batalkan draft SO lain untuk pesanan yang sama (jika ada)
    end

    alt 🔔 Perusahaan mengaktifkan skema persetujuan
        Sys-->>U: Status: Menunggu Persetujuan Atasan
    else Tidak ada skema persetujuan
        Sys-->>U: Status: Siap Dikirim & Siap Ditagih
    end
```

> Reservasi stok (langkah 2) memastikan barang yang sudah dipesan tidak "tercuri" oleh pesanan lain sebelum sempat dikirim.

### Saat Disetujui

Status SO berubah menjadi **Siap Dikirim** dan **Siap Ditagih** sekaligus.

### Saat Ditolak / Dibatalkan

Status SO berubah menjadi **Ditolak** atau **Dibatalkan**. Semua reservasi stok yang sudah dibuat untuk item SO ini dikembalikan (rollback).

### Status Auto-Update

SO status di-update otomatis setiap ada perubahan Delivery Note atau Sales Invoice terkait:
- Delivered: 0 → `TO_DELIVER`, partial → `PARTIALLY_DELIVERED`, full → `DELIVERED`
- Billed: 0 → `TO_BILL`, partial → `PARTIALLY_BILLED`, full → `BILLED`
- Jika semua delivery dan billing selesai → `CLOSED`

### Dual Flow: SO → DN → SI atau SO → SI → DN

Aplikasi mendukung dua alur penjualan:
1. **SO → Delivery Note → Sales Invoice** (kirim dulu, tagih kemudian)
2. **SO → Sales Invoice → Delivery Note** (tagih dulu, kirim kemudian)

Kedua alur valid karena SO items memiliki kolom terpisah:
- `delivered_quantity` + `undelivered_quantity`
- `billed_quantity` + `unbilled_quantity`

### Routes SO (submitable)

`Sales\SalesOrderController`, prefix `/salesOrders`. 12 route dasar + 6 submitable + 2 non-standar:

| Method | URI | Route Name | Controller@method |
|---|---|---|---|
| GET | `/salesOrders` | `salesOrders.index` | `SalesOrderController@index` |
| POST | `/salesOrders` | `salesOrders.store` | `SalesOrderController@store` |
| GET | `/salesOrders/create/{ref?}` | `salesOrders.create` | `SalesOrderController@create` |
| GET | `/salesOrders/create-print-template` | `salesOrders.createPrintTemplate` | `SalesOrderController@createPrintTemplate` |
| GET | `/salesOrders/{salesOrder}` | `salesOrders.show` | `SalesOrderController@show` |
| PUT | `/salesOrders/{salesOrder}/{level?}` | `salesOrders.update` | `SalesOrderController@update` |
| DELETE | `/salesOrders/{salesOrder}` | `salesOrders.destroy` | `SalesOrderController@destroy` |
| PUT | `/salesOrders/{salesOrder}/submit` | `salesOrders.submit` | `SalesOrderController@submit` |
| PUT | `/salesOrders/{salesOrder}/cancel` | `salesOrders.cancel` | `SalesOrderController@cancel` |
| PUT | `/salesOrders/{salesOrder}/amend` | `salesOrders.amend` | `SalesOrderController@amend` |
| GET | `/salesOrders/{salesOrder}/print/{printTemplate?}` | `salesOrders.print` | `SalesOrderController@print` |
| POST | `/salesOrders/{salesOrder}/sync-items` | `salesOrders.syncItems` | `SalesOrderController@syncItems` |
| POST | `/salesOrders/{salesOrder}/mark-done` | `salesOrders.markDone` | `SalesOrderController@markDone` |
| POST | `/salesOrders/{salesOrder}/comment` | `salesOrders.addComment` | `SalesOrderController@addComment` |
| DELETE | `/salesOrders/{salesOrder}/comment/{id}` | `salesOrders.removeComment` | `SalesOrderController@removeComment` |
| POST | `/salesOrders/{salesOrder}/tag` | `salesOrders.addTag` | `SalesOrderController@addTag` |
| DELETE | `/salesOrders/{salesOrder}/tag/{id}` | `salesOrders.removeTag` | `SalesOrderController@removeTag` |
| POST | `/salesOrders/{salesOrder}/file` | `salesOrders.addFile` | `SalesOrderController@addFile` |
| DELETE | `/salesOrders/{salesOrder}/file/{id}` | `salesOrders.removeFile` | `SalesOrderController@removeFile` |

### Frontend Pages

| File | Deskripsi |
|---|---|
| `Pages/Sales/SalesOrders/Index.jsx` | Daftar SO (DataTable2) |
| `Pages/Sales/SalesOrders/Form.jsx` | Form buat/edit SO |
| `Pages/Sales/SalesOrders/Show.jsx` | Detail SO |
| `Pages/Sales/SalesOrders/ItemForm.jsx` | Sub-form baris item (memilih [ItemVariant](#item--variant), Unit, Tax, Warehouse) |
| `Pages/Sales/SalesOrders/SalesOrderLinkModel.jsx` | Selector SO untuk dipakai dokumen lain (DN, SI) |

Lihat juga [Frontend · Sales](../frontend.md#sales) dan [Peta LinkModel](../frontend.md#peta-linkmodel-relasi-ui).

---

## Item & Variant

Baris item Sales Order **bukan** memilih Item master secara langsung, melainkan memilih **Variant** dari item tersebut (SKU konkret — misalnya "Kaos Polos" adalah item, sedangkan "Kaos Polos - Merah, Size L" adalah variant-nya). Konsekuensi:

- Reservasi stok saat submit dilakukan per-variant, per-gudang asal.
- Tiap baris juga membawa informasi satuan, pajak, dan gudang asal.

> **Pajak bersifat opsional**: baris item SO tetap valid disubmit tanpa memilih pajak. Jika tidak ada pajak dipilih, nilai DPP dan nilai pajak (dihitung otomatis di sisi invoice, lihat [Finances · Bagaimana Pajak Dihitung](finances.md#si-item-fields)) akan bernilai 0.

---

## Internal Order

Internal Order adalah transfer order antar branch perusahaan sendiri.

Struktur serupa dengan Sales Order, namun:
- Tidak ada customer eksternal
- `status` workflow sama: DRAFT → SUBMITTED → APPROVED → TO_DELIVER → ...
- Digunakan untuk replenishment stok antar gudang/cabang

### Routes IO (submitable)

`Sales\InternalOrderController`, prefix `/internalOrders`. 12 route dasar + 6 submitable:

| Method | URI | Route Name | Controller@method |
|---|---|---|---|
| GET | `/internalOrders` | `internalOrders.index` | `InternalOrderController@index` |
| POST | `/internalOrders` | `internalOrders.store` | `InternalOrderController@store` |
| GET | `/internalOrders/create/{ref?}` | `internalOrders.create` | `InternalOrderController@create` |
| GET | `/internalOrders/create-print-template` | `internalOrders.createPrintTemplate` | `InternalOrderController@createPrintTemplate` |
| GET | `/internalOrders/{internalOrder}` | `internalOrders.show` | `InternalOrderController@show` |
| PUT | `/internalOrders/{internalOrder}/{level?}` | `internalOrders.update` | `InternalOrderController@update` |
| DELETE | `/internalOrders/{internalOrder}` | `internalOrders.destroy` | `InternalOrderController@destroy` |
| PUT | `/internalOrders/{internalOrder}/submit` | `internalOrders.submit` | `InternalOrderController@submit` |
| PUT | `/internalOrders/{internalOrder}/cancel` | `internalOrders.cancel` | `InternalOrderController@cancel` |
| PUT | `/internalOrders/{internalOrder}/amend` | `internalOrders.amend` | `InternalOrderController@amend` |
| GET | `/internalOrders/{internalOrder}/print/{printTemplate?}` | `internalOrders.print` | `InternalOrderController@print` |
| POST | `/internalOrders/{internalOrder}/comment` | `internalOrders.addComment` | `InternalOrderController@addComment` |
| DELETE | `/internalOrders/{internalOrder}/comment/{id}` | `internalOrders.removeComment` | `InternalOrderController@removeComment` |
| POST | `/internalOrders/{internalOrder}/tag` | `internalOrders.addTag` | `InternalOrderController@addTag` |
| DELETE | `/internalOrders/{internalOrder}/tag/{id}` | `internalOrders.removeTag` | `InternalOrderController@removeTag` |
| POST | `/internalOrders/{internalOrder}/file` | `internalOrders.addFile` | `InternalOrderController@addFile` |
| DELETE | `/internalOrders/{internalOrder}/file/{id}` | `internalOrders.removeFile` | `InternalOrderController@removeFile` |

---

## Customer

Master data customer. Bukan dokumen workflow — tidak punya status.

### Fields

| Field | Tipe | Deskripsi |
|---|---|---|
| `name` | string | Nama customer |
| `email` | string | Email |
| `phone` | string | Telepon |
| `vat` | string | NPWP / Tax ID |
| `is_disabled` | boolean | Status aktif |
| `street`, `city`, `province`, `zip_code` | string | Alamat |
| `country` | relation | Negara |

### Routes Customer

`Sales\CustomerController`, prefix `/customers`. 12 route dasar [macro](../routes.md#konvensi-macro-routeresourcedetail) (non-submitable):

| Method | URI | Route Name | Controller@method |
|---|---|---|---|
| GET | `/customers` | `customers.index` | `CustomerController@index` |
| POST | `/customers` | `customers.store` | `CustomerController@store` |
| GET | `/customers/create/{ref?}` | `customers.create` | `CustomerController@create` |
| GET | `/customers/{customer}` | `customers.show` | `CustomerController@show` |
| PUT | `/customers/{customer}` | `customers.update` | `CustomerController@update` |
| DELETE | `/customers/{customer}` | `customers.destroy` | `CustomerController@destroy` |
| POST/DELETE | `/customers/{customer}/comment[/{id}]` | `customers.addComment` / `removeComment` | `@addComment` / `@removeComment` |
| POST/DELETE | `/customers/{customer}/tag[/{id}]` | `customers.addTag` / `removeTag` | `@addTag` / `@removeTag` |
| POST/DELETE | `/customers/{customer}/file[/{id}]` | `customers.addFile` / `removeFile` | `@addFile` / `@removeFile` |

---

## Status Workflow

### FormStatus yang digunakan di modul Sales

| Status | Value | Deskripsi |
|---|---|---|
| DRAFT | `draft` | Baru dibuat, belum disubmit |
| SUBMITTED | `submitted` | Sudah disubmit |
| NEED_APPROVAL | `need_approval` | Menunggu persetujuan |
| APPROVED | `approved` | Disetujui |
| REJECTED | `rejected` | Ditolak (bisa di-amend) |
| CANCELED | `canceled` | Dibatalkan |
| TO_DELIVER | `to_deliver` | Menunggu pengiriman |
| PARTIALLY_DELIVERED | `partially_delivered` | Sebagian sudah dikirim |
| DELIVERED | `delivered` | Semua sudah dikirim |
| TO_BILL | `to_bill` | Menunggu penagihan |
| PARTIALLY_BILLED | `partially_billed` | Sebagian sudah ditagih |
| BILLED | `billed` | Semua sudah ditagih |
| CLOSED | `closed` | SO selesai |
| IN_RENT | `in_rent` | Sedang dalam rental |
| RETURNED | `returned` | Barang rental dikembalikan |

---

## Business Flow End-to-End

Dua tim yang biasanya terlibat dalam satu Sales Order: **Sales** (membuat pesanan), **Warehouse** (mengirim barang), dan **Finance** (menagih & menerima bayaran) — dengan **Approver** di tengah jika perusahaan mengaktifkan persetujuan berjenjang.

### Skenario 1: Kirim Dulu, Baru Tagih (paling umum)

```mermaid
sequenceDiagram
    actor Sales as 🧑‍💼 Sales Officer
    actor Approver as ✅ Approver
    actor Gudang as 📦 Warehouse Officer
    actor Finance as 💵 Finance Officer

    Sales->>Sales: Buat Sales Order (Draft)
    Sales->>Approver: Submit → Menunggu Persetujuan
    Approver-->>Sales: Disetujui ✅ (Siap Dikirim & Siap Ditagih)

    Gudang->>Gudang: Buat Delivery Note dari SO, submit
    Note right of Gudang: Stok berkurang, SO ditandai "Terkirim"

    Finance->>Finance: Buat Sales Invoice dari SO, submit
    Note right of Finance: Piutang tercatat, SO ditandai "Tertagih"

    Finance->>Finance: Terima pembayaran via Payment Entry
    Note right of Finance: Piutang lunas → Sales Order Selesai 🎉
```

### Skenario 2: Tagih Dulu, Baru Kirim (mis. bayar di muka / DP)

```mermaid
sequenceDiagram
    actor Sales as 🧑‍💼 Sales Officer
    actor Finance as 💵 Finance Officer
    actor Gudang as 📦 Warehouse Officer

    Sales->>Sales: Buat & submit Sales Order → Disetujui

    Finance->>Finance: Buat Sales Invoice dari SO (sebelum barang dikirim)
    Note right of Finance: SO ditandai "Tertagih"

    Gudang->>Gudang: Buat Delivery Note dari SO
    Note right of Gudang: SO ditandai "Terkirim" → Sales Order Selesai 🎉
```

> Kedua skenario di atas **sama-sama valid** — pilih sesuai kebiasaan bisnis Anda. Sales Order otomatis berstatus Selesai begitu pengiriman dan penagihannya sama-sama tuntas, apa pun urutannya.

---

## Flow Retur (returnAgainst)

Retur **bukan** dokumen jenis baru — cukup buat Delivery Note atau Sales Invoice seperti biasa, tapi tandai sebagai "retur dari" dokumen aslinya. Jumlah yang diisi berarti **jumlah yang dikembalikan**, bukan jumlah baru.

```mermaid
flowchart LR
    subgraph asli [" Dokumen Asli "]
      DN1["🚚 Delivery Note<br/>barang sudah dikirim"]
      SI1["🧾 Sales Invoice<br/>tagihan sudah terbit"]
    end
    subgraph retur [" Dokumen Retur "]
      DN2["↩️ Delivery Note Retur"]
      SI2["↩️ Credit Note<br/>(Sales Invoice Retur)"]
    end
    DN1 -->|"barang dikembalikan customer"| DN2
    SI1 -->|"tagihan dikoreksi"| SI2
    DN2 -->|"submit"| Stok[("📦 Stok bertambah kembali")]
    SI2 -->|"submit"| Piutang[("📉 Piutang berkurang")]

    style DN1 fill:#dbeafe,stroke:#3b82f6
    style SI1 fill:#dbeafe,stroke:#3b82f6
    style DN2 fill:#fef3c7,stroke:#d97706
    style SI2 fill:#fef3c7,stroke:#d97706
```

### Ringkasan Efeknya

| Dokumen Retur | Efek Saat Disubmit |
|---|---|
| **Delivery Note Retur** | Stok **kembali masuk** ke gudang asal; jumlah "dikembalikan" pada Delivery Note asli bertambah; status Sales Order ikut disesuaikan |
| **Credit Note (Sales Invoice Retur)** | Piutang & pendapatan **dikoreksi berkurang**; jumlah tertagih pada Sales Order disesuaikan |

- Delivery Note retur selalu tertaut ke Delivery Note aslinya, termasuk per baris item yang dikembalikan.
- Sales Invoice retur otomatis ditandai di aplikasi sebagai dokumen retur/credit note — mudah dibedakan dari invoice biasa.
- Sisi Purchase setara: GR retur & PI retur — lihat [Purchase · Flow Retur](purchase.md#flow-retur-returnagainst).

> Saat dokumen retur di-**batalkan (cancel)**, efeknya di buku besar dan kartu stok otomatis dikembalikan (reversal) — tidak perlu koreksi manual.

---

## Related Documents

| Topik | Dokumen |
|---|---|
| Item line → ItemVariant | [Inventory · Item & Variant](inventory.md#item--variant) · [Database](../database.md#item--itemvariant) |
| Customer | [Frontend · CustomerLinkModel](../frontend.md#peta-linkmodel-relasi-ui) |
| Pengiriman dari SO | [Inventory · Delivery Note](inventory.md) |
| Penagihan dari SO | [Finances · Sales Invoice](finances.md) |
| Pembayaran invoice | [Finances · Payment Entry](finances.md) |
| Sistem approval | [Core · Approval](core.md#approval) · [Auth · Workflow](../auth.md#workflow-dokumen) |
| Penomoran kode SO | [Core · FormatingSeries](core.md) |
| Tabel database | [Database · Domain Sales](../database.md#domain-sales) |
| Daftar route + Controller@method | [Routes · Sales](../routes.md#12-sales) |
| Halaman React | [Frontend · Sales](../frontend.md#sales) |
| Asal SO dari Quotation (CRM) | [CRM · Quotation](crm.md#quotation) |
