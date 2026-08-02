# Modul Service

> Dokumentasi modul service / pekerjaan: Work Orders.

## Daftar Isi

- [Gambaran Modul](#gambaran-modul)
- [Korelasi Antar-Feature](#korelasi-antar-feature)
- [Work Order](#work-order)
- [Business Flow](#business-flow)

---

## Gambaran Modul

Modul Service mengelola pekerjaan atau layanan yang diberikan kepada customer, maupun kebutuhan internal perusahaan (Work Order).

---

## Korelasi Antar-Feature

Work Order **tidak langsung** menyentuh stok atau buku besar. Work Order akan menghasilkan dokumen turunan tergantung jenisnya:

- **Untuk Customer** (ada customer yang dipilih) → berlanjut ke **Sales Order** → mengikuti [alur penjualan](sales.md#korelasi-antar-feature) (Delivery Note → Sales Invoice → Payment).
- **Internal** (tidak ada customer, untuk kebutuhan perusahaan sendiri) → berlanjut ke **Internal Order** → **Delivery Note**.

```mermaid
flowchart TD
    WO(["🔧 Work Order"])
    SO["📋 Sales Order"]
    IO["📋 Internal Order"]
    DN["🚚 Delivery Note"]
    SI["🧾 Sales Invoice → Payment"]

    WO -->|"untuk Customer"| SO
    SO --> DN
    SO --> SI
    WO -->|"internal (tanpa Customer)"| IO
    IO --> DN

    style WO fill:#6366f1,stroke:#4338ca,color:#fff
```

| Jenis Work Order | Mengarah ke | Lanjutan |
|---|---|---|
| **Untuk Customer** | [Sales Order](sales.md#sales-order) | Mengikuti [alur penjualan](sales.md#korelasi-antar-feature): Delivery Note → Sales Invoice → Payment |
| **Internal** | [Internal Order](sales.md#internal-order) | → [Delivery Note](inventory.md#delivery-note) |

> **Catatan:** Submit Work Order hanya membuat kode dokumen dan mengecek approval — Work Order **tidak** langsung memengaruhi stok atau buku besar. Efek stok & akuntansi baru terjadi di dokumen turunannya (Delivery Note, Sales Invoice). "Jenis Service" adalah pekerjaan yang dikerjakan (memilih Variant dari item), sedangkan "Komponen/Bahan" adalah material yang dipakai untuk mengerjakannya.

> Tiap komponen/bahan Work Order punya progres bertahap: diminta → dipesan → diterima → siap dipakai → sudah ditransfer ke lokasi kerja → sisa yang masih dibutuhkan. Komponen bisa punya alternatif pengganti jika stok utama tidak tersedia.

---

## Work Order

Work Order (WO) adalah dokumen pekerjaan/layanan yang diberikan ke customer atau untuk keperluan internal.

### Fields Utama

| Field | Deskripsi |
|---|---|
| Kode | Kode WO (dibuat otomatis) |
| Customer | Pelanggan (kosongkan untuk kebutuhan internal) |
| Cabang Customer | Cabang tujuan |
| Jenis Service | Layanan/pekerjaan yang dikerjakan |
| Tanggal | Tanggal WO dibuat |
| Catatan | Catatan tambahan |
| Waktu Mulai | Kapan pekerjaan mulai dikerjakan |
| Waktu Selesai | Kapan pekerjaan selesai |
| Baris Komponen | Komponen/bahan yang digunakan |

### Baris Komponen Work Order

| Field | Deskripsi |
|---|---|
| Item (Variant) | Komponen/bahan yang dipakai |
| Satuan | Satuan pengukuran |
| Jumlah Dibutuhkan | Total kebutuhan komponen |
| Sudah Dipesan | Progres pemesanan komponen |
| Sudah Diterima | Progres penerimaan komponen |
| Siap Dipakai | Jumlah yang sudah siap dipakai |
| Sudah Ditransfer | Jumlah yang sudah dipindahkan ke lokasi kerja |
| Sisa Dibutuhkan | Sisa kebutuhan yang belum terpenuhi |
| Keterangan | Catatan tambahan per baris |

### Alur Status Work Order

```mermaid
stateDiagram-v2
    [*] --> Draft: Dibuat
    Draft --> Diajukan: Submit
    Diajukan --> MenungguPersetujuan: Ada skema approval
    Diajukan --> MenungguDikerjakan: Tidak ada skema (langsung disetujui)
    MenungguPersetujuan --> MenungguDikerjakan: Disetujui
    MenungguPersetujuan --> Ditolak: Ditolak
    Ditolak --> Draft: Direvisi (amend)
    MenungguDikerjakan --> SedangDikerjakan: Pekerjaan dimulai
    SedangDikerjakan --> Selesai: Pekerjaan selesai
    SedangDikerjakan --> Dibatalkan: Dibatalkan
```

### Apa yang Terjadi Saat Anda Klik "Submit"

```mermaid
sequenceDiagram
    actor U as Sales/Service Officer
    participant Sys as Sistem ERP

    U->>Sys: Klik tombol "Submit"
    Sys->>Sys: Buat kode dokumen resmi
    alt 🔔 Ada skema persetujuan aktif
        Sys-->>U: Status: Menunggu Persetujuan
    else Tidak ada skema persetujuan
        Sys-->>U: Status: Menunggu Dikerjakan
    end
```

Pekerjaan dimulai dan diselesaikan lewat aksi terpisah — masing-masing mencatat tanggal mulai dan tanggal selesai secara otomatis.

---

## Business Flow

Kolaborasi antar peran dalam satu Work Order — dari dibuat sampai selesai dikerjakan:

```mermaid
sequenceDiagram
    actor Sales as 🧑‍💼 Sales/Service Officer
    actor Approver as ✅ Approver
    actor Tech as 🔧 Teknisi

    Sales->>Sales: Buat Work Order, tentukan jenis service & komponen
    Sales->>Approver: Submit → Menunggu Persetujuan
    Approver-->>Sales: Disetujui ✅ (Menunggu Dikerjakan)

    Tech->>Tech: Mulai pekerjaan (status: Sedang Dikerjakan)
    Tech->>Tech: Selesaikan pekerjaan (status: Selesai) 🎉

    Note over Sales: Pemenuhan komponen & penagihan lewat dokumen turunan:
    Sales->>Sales: Untuk Customer → Sales Order → Delivery Note/Invoice
    Sales->>Sales: Internal → Internal Order → Delivery Note
```

> Work Order sendiri **tidak** menghasilkan catatan stok atau buku besar — efek itu baru muncul di dokumen turunannya. Lihat [Korelasi Antar-Feature](#korelasi-antar-feature).

---

## Related Documents

| Topik | Dokumen |
|---|---|
| Komponen & service → ItemVariant | [Inventory · Item & Variant](inventory.md#item--variant) |
| WO untuk Customer → Sales Order (lalu Delivery Note/Invoice/Payment) | [Sales · Sales Order](sales.md#sales-order) |
| WO internal → Internal Order → Delivery Note | [Sales · Internal Order](sales.md#internal-order) · [Inventory · Delivery Note](inventory.md#delivery-note) |
| Approval Work Order | [Core · Approval](core.md#approval) |
