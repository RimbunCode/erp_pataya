# Tutorial 1 — Setup Awal & Data Master

> Menyiapkan fondasi sebelum transaksi: company, branch, warehouse, unit, kategori, pajak, COA.

## Langkah 0 — Login & Onboarding

1. Buka aplikasi (mis. `http://erp.test`), login.
2. User baru diarahkan ke halaman **Setup** (`setup.show`) — middleware `onboarded` memaksa ini. Lengkapi profil awal.
   - Route: `GET/PUT /setup` → `Auth\SetupUserController`. Lihat [Routes · Onboarding](../routes.md#3-onboarding--setup).

## Langkah 1 — Company

Menu **Settings → Company**.

| Aksi | Route |
|---|---|
| Lihat | `GET /settings/company` (`companies.index`) |
| Simpan | `PUT /settings/company` (`companies.update`) |
| Logo | `POST /settings/company/image` (`companies.image`) |

## Langkah 2 — Branch (Cabang)

Menu **Settings → Branches**. Minimal satu branch utama (`is_main_branch = true`).

- Halaman: `Pages/Settings/Branches/Index.jsx`, `Form.jsx`.
- `code` branch dipakai di penomoran dokumen (`@[branch_code]`) — lihat [FormatingSeries](../modules/core.md#formatingseries-penomoran-dokumen).
- Branch aktif diganti via switcher navbar (`PUT /switch_branch/{id}`).

## Langkah 3 — Penomoran Dokumen (FormatingSeries)

Menu **Settings → Formating Series**. Tentukan format kode per dokumen, mis. SO:

```
@[branch_code]/SO-@[iiii]/@[yy]   →   HO/SO-0001/25
```

Detail token: [Core · FormatingSeries](../modules/core.md#formatingseries-penomoran-dokumen).

## Langkah 4 — Data Master Inventory

| Master | Menu | Catatan |
|---|---|---|
| **Unit** | Inventory → Units | Satuan + grup konversi |
| **Category** | Inventory → Categories | Hierarki (TreeView) |
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
- **Supplier**: Purchase → Suppliers (hierarki TreeView).

## Berikutnya

→ [Tutorial 2 — Membuat Item & Variant](02-item-variant.md)

---

*Lihat: [Core / Settings](../modules/core.md) · [Inventory](../modules/inventory.md) · [Finances](../modules/finances.md)*
