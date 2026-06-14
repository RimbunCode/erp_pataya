# Tutorial

> Panduan langkah-demi-langkah berbasis skenario. Setiap tutorial mengacu ke route, halaman React, dan model nyata.

## Daftar Tutorial

| # | Tutorial | Prasyarat |
|---|---|---|
| 1 | [Setup Awal & Data Master](01-setup-data-master.md) | Aplikasi terinstall ([Setup Herd](../index.md#menjalankan-dengan-laravel-herd-windows)) |
| 2 | [Membuat Item & Variant](02-item-variant.md) | Tutorial 1 |
| 3 | [Alur Penjualan: SO → DN → SI → Payment](03-alur-penjualan.md) | Tutorial 2 |
| 4 | [Alur Pembelian: PR → PO → GR → PI → Payment](04-alur-pembelian.md) | Tutorial 2 |
| 5 | [Menyiapkan Approval Scheme](05-approval-scheme.md) | Tutorial 1 |
| 6 | [Retur: Sales/Purchase Return, Credit/Debit Note](retur.md) | Tutorial 3 / 4 |

### Peta Dokumen Retur

Retur selalu **dokumen bertipe sama** yang menunjuk dokumen asli via `return_against_id`. Pisahkan: pergerakan **barang** vs koreksi **tagihan**. Semua di [Tutorial Retur](retur.md):

| Sisi | Barang (stok) | Tagihan (akuntansi) |
|---|---|---|
| **Penjualan** | [Sales Return](retur.md#1-sales-return-dn-retur) (DN retur, stok +) | [Credit Note](retur.md#2-credit-note-sales-invoice-retur) (SI retur, piutang −) |
| **Pembelian** | [Purchase Return](retur.md#3-purchase-return-gr-retur) (GR retur, stok −) | [Debit Note](retur.md#4-debit-note-purchase-invoice-retur) (PI retur, hutang −) |

> **Tidak ada** dokumen "Credit Note"/"Debit Note" terpisah di sistem — itu istilah akuntansi untuk **invoice retur** (SI/PI dengan `return_against`).

## Konsep Dasar (wajib paham dulu)

| Konsep | Penjelasan singkat | Detail |
|---|---|---|
| **Branch aktif** | Semua dokumen di-assign ke branch yang sedang aktif (pojok navbar) | [Core · Branch](../modules/core.md#branch--multi-branch) |
| **Status dokumen** | Dokumen melewati DRAFT → Submitted → (approval) → workflow | [Auth · Workflow](../auth.md#workflow-dokumen) |
| **Item vs Variant** | Yang dipilih di transaksi adalah **ItemVariant** (SKU), bukan Item | [Inventory · Item & Variant](../modules/inventory.md#item--variant) |
| **Submit ≠ Save** | Save = DRAFT (bisa diedit). Submit = kunci + jalankan efek (stok/GL) | [Core · Trait Submitable](../modules/core.md#trait-submitable) |
| **Permission** | Aksi (create/submit/cancel) dibatasi role | [Auth · Roles](../auth.md#roles--permissions) |

---

*Lihat juga: [Index Dokumentasi](../index.md) · [Arsitektur](../architecture.md)*
