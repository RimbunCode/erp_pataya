# Tutorial 1 — Setup Awal & Data Master

> Menyiapkan fondasi sebelum transaksi: company, branch, warehouse, unit, kategori, pajak, COA.

## Langkah 0 — Login & Onboarding

1. Buka aplikasi, login.
2. User baru diarahkan ke halaman **Setup** untuk melengkapi profil awal sebelum bisa mengakses fitur lain.

## Langkah 1 — Company

Menu **Settings → Company** — lihat, simpan, dan upload logo perusahaan.

## Langkah 2 — Branch (Cabang)

Menu **Settings → Branches**. Minimal satu branch utama.

- Kode branch dipakai di penomoran dokumen — lihat [FormatingSeries](../modules/core.md#formatingseries-penomoran-dokumen).
- Branch aktif bisa diganti lewat switcher di navbar.

## Langkah 3 — Penomoran Dokumen

Menu **Settings → Formating Series**. Tentukan format kode otomatis per jenis dokumen, mis. untuk Sales Order:

```
@[branch_code]/SO-@[iiii]/@[yy]   →   HO/SO-0001/25
```

Detail token yang tersedia: [Core · FormatingSeries](../modules/core.md#formatingseries-penomoran-dokumen).

## Langkah 4 — Data Master Inventory

| Master | Menu | Catatan |
|---|---|---|
| **Unit** | Inventory → Units | Satuan + grup konversi |
| **Category** | Inventory → Categories | Bisa disusun berjenjang (parent-child) |
| **Attribute** | Inventory → Attributes | Untuk variant (ukuran, warna) |
| **Warehouse** | Inventory → Warehouses | Gudang per branch |

## Langkah 5 — Master Finance

| Master | Menu | Catatan |
|---|---|---|
| **Account (COA)** | Finances → Accounts | Chart of Accounts, hierarki |
| **Tax** | Finances → Taxes | PPN, PPh, dll. |
| **Payment Method** | Finances → Payment Methods | + akun kas/bank default |

## Langkah 6 — Mitra Bisnis

- **Customer**: Sales → Customers.
- **Supplier**: Purchase → Suppliers (bisa disusun berjenjang).

## Berikutnya

→ [Tutorial 2 — Membuat Item & Variant](02-item-variant.md)

---

*Lihat: [Core / Settings](../modules/core.md) · [Inventory](../modules/inventory.md) · [Finances](../modules/finances.md)*
