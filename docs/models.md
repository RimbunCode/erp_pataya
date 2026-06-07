# Referensi Model & Relasi

> Relasi Eloquent setiap model: nama relasi, tipe, model target, tujuan, dan link ke doc terkait. Relasi **polymorphic** (`morphTo`/`morphMany`) bisa menunjuk ke banyak model — target yang mungkin dijelaskan di [Relasi Polymorphic](#relasi-polymorphic).

## Daftar Isi

- [Cara Membaca](#cara-membaca)
- [Konvensi Umum Model](#konvensi-umum-model)
- [Relasi Polymorphic](#relasi-polymorphic)
- [Sales](#sales)
- [Purchase](#purchase)
- [Inventory](#inventory)
- [Finances](#finances)
- [Service](#service)
- [Core](#core)
- [User & Access](#user--access)

---

## Cara Membaca

- **Tipe**: `BT` = belongsTo · `HM` = hasMany · `HO` = hasOne · `BTM` = belongsToMany · `MT` = morphTo · `MM` = morphMany · `MO` = morphOne.
- **Target**: model tujuan (link ke doc modulnya). Untuk `MT`/`MM`, target tidak tunggal — lihat [Relasi Polymorphic](#relasi-polymorphic).
- Tabel DB tiap model: [Database](database.md). Halaman React: [Frontend](frontend.md).

---

## Konvensi Umum Model

Semua model ERP extend `App\Models\Model` (base). Sebagian besar memakai:

| Trait / Fitur | Efek |
|---|---|
| `HasUlids` | Primary key ULID (`char(26)`), bukan auto-increment |
| `SoftDeletes` | Kolom `deleted_at` |
| `DataTable` | Definisi kolom (`$configColumns`), logging CRUD, permission |
| [`Submitable`](modules/core.md#trait-submitable) | Workflow dokumen (status, submit/cancel/amend, approval) — hanya model dokumen |

Relasi yang **berulang** di hampir semua model dokumen (lewat trait/base, tidak ditabel ulang per model):

| Relasi | Tipe | Target | Tujuan |
|---|---|---|---|
| `createdBy` | BT | [User](#user--access) | Pembuat dokumen (`created_by_id`) |
| `branch` | BT | [Branch](#core) | Branch pemilik dokumen |
| `approvalable` | MO | [ApprovalInstance](#core) | Instance approval dokumen |
| `amendedFrom` | BT | _(self)_ | Dokumen asal saat di-amend |

---

## Relasi Polymorphic

Relasi `morphTo` menerima banyak tipe target. Berikut peta target nyata di aplikasi:

| Relasi | Model pemilik | Kolom | Target yang mungkin | Tujuan |
|---|---|---|---|---|
| `referenceable` | [SalesOrder](#sales), [DeliveryNote](#inventory), [StockEntry](#inventory), [PurchaseOrderItem](#purchase), [PurchaseInvoiceItem](#finances), [DeliveryNoteItem](#inventory) | `referenceable_type/id` | Dokumen/baris sumber: PR, PO, SO, WO, dll. | Lacak dokumen asal (cross-document) |
| `document` | [ApprovalInstance](#core) | `document_type/id` | Semua model [Submitable](modules/core.md#trait-submitable) (SO, PO, DN, Invoice, dll.) | Dokumen yang sedang di-approve |
| `approver` | [ApprovalSchemeStep](#core), [ApprovalInstanceStep](#core) | `approverable_type/id` | [Role](#user--access) atau [User](#user--access) | Penanggung jawab approval step |
| `partyable` | [PaymentEntry](#finances) | `partyable_type/id` | [Customer](#sales) atau [Supplier](#purchase) | Pihak lawan transaksi pembayaran |
| `paymentable` | [PaymentEntry](#finances) | `paymentable_type/id` | [SalesInvoice](#finances) atau [PurchaseInvoice](#finances) | Invoice yang dibayar |
| `payment_scheduleable` (`referenceTo`) | [PaymentSchedule](#finances) | `payment_scheduleable_type/id` | SalesInvoice, PurchaseInvoice, SO, PO | Dokumen pemilik jadwal bayar |
| `branchable` | [Branch](#core) | `branchable_type/id` | [Customer](#sales), [Supplier](#purchase), Company | Entitas pemilik cabang |
| `model` / `reference` | [ModelConnection](#core) | `model_type/id`, `reference_type/id` | Dua dokumen apa pun | Graph tautan antar dokumen |
| `loggable` | [Log](#core) | `loggable_type/id` | Semua model ber-`DataTable` | Subjek activity log |
| `taggable` | [Taggable](#core) | `taggable_type/id` | Semua model | Tagging polymorphic |
| `fileable` | [Fileable](#core) | `fileable_type/id` | Semua model | Lampiran file polymorphic |
| `referenceable` (AdditionalCost) | [AdditionalCost](#finances) | morph | StockEntry, dll. | Biaya tambahan dokumen |

> Mekanisme `referenceable` + tabel [`model_connections`](database.md#model_connections) adalah inti traceability antar dokumen. Lihat [Korelasi](modules/sales.md#korelasi-antar-feature).

---

## Sales

### SalesOrder
| Relasi | Tipe | Target | Tujuan |
|---|---|---|---|
| `items` | HM | SalesOrderItem | Baris item SO |
| `customer` | BT | [Customer](#sales) | Pemesan |
| `customerBranch` | BT | [Branch](#core) | Cabang customer (`customer_branch_id`) |
| `currency` | BT | [Currency](#core) | Mata uang (`currency_code`) |
| `referenceable` | MT | _polymorphic_ | Dokumen sumber (mis. dari WO) — [lihat](#relasi-polymorphic) |
| `referenceSo` | BT | SalesOrder (self) | SO acuan (`reference_so_id`) |
| `paymentSchedules` | MM | [PaymentSchedule](#finances) | Jadwal pembayaran |

### SalesOrderItem
| Relasi | Tipe | Target | Tujuan |
|---|---|---|---|
| `salesOrder` | BT | SalesOrder | Induk |
| `item` | BT | **[ItemVariant](#inventory)** (`item_id`) | SKU yang dijual — **bukan Item** |
| `unit` | BT | [ItemUnit](#inventory) | Satuan |
| `tax` | BT | [Tax](#finances) | Pajak baris |
| `sourceWarehouse` | BT | [Warehouse](#inventory) | Gudang sumber |
| `parentItem` / `childItems` | BT / HM | self | Hierarki bundle item |

### InternalOrder
| Relasi | Tipe | Target | Tujuan |
|---|---|---|---|
| `items` | HM | InternalOrderItem | Baris item |
| `branch` | BT | [Branch](#core) | Cabang |

### Customer
| Relasi | Tipe | Target | Tujuan |
|---|---|---|---|
| `country` | BT | [Country](#core) (`country_id`→`code`) | Negara |
| `branches` | MM | [Branch](#core) (`branchable`) | Cabang-cabang customer |

---

## Purchase

### PurchaseOrder
| Relasi | Tipe | Target | Tujuan |
|---|---|---|---|
| `items` | HM | PurchaseOrderItem | Baris item PO |
| `supplier` | BT | [Supplier](#purchase) | Pemasok |
| `currency` | BT | [Currency](#core) | Mata uang |
| `paymentSchedules` | MM | [PaymentSchedule](#finances) | Jadwal bayar |

### PurchaseOrderItem
| Relasi | Tipe | Target | Tujuan |
|---|---|---|---|
| `purchaseOrder` | BT | PurchaseOrder | Induk |
| `item` | BT | **[ItemVariant](#inventory)** | SKU dipesan |
| `unit` | BT | [ItemUnit](#inventory) | Satuan |
| `tax` | BT | [Tax](#finances) | Pajak |
| `targetWarehouse` | BT | [Warehouse](#inventory) | Gudang tujuan |
| `referenceable` | MT | _polymorphic_ | Baris PR sumber |
| `parentItem` / `childItems` | BT / HM | self | Hierarki |

### PurchaseRequest
| Relasi | Tipe | Target | Tujuan |
|---|---|---|---|
| `items` | HM | PurchaseRequestItem | Baris permintaan |

### PurchaseReceipt
| Relasi | Tipe | Target | Tujuan |
|---|---|---|---|
| `purchaseOrder` | BT | PurchaseOrder | PO yang diterima |
| `items` | HM | PurchaseReceiptItem | Baris diterima |
| `supplier` | BT | [Supplier](#purchase) | Pemasok |
| `returnAgainst` | BT | PurchaseReceipt (self) | GR asli (jika retur) — [flow](modules/purchase.md#flow-retur-returnagainst) |

### PurchaseReceiptItem
| Relasi | Tipe | Target | Tujuan |
|---|---|---|---|
| `purchaseReceipt` | BT | PurchaseReceipt | Induk |
| `purchaseOrderItem` | BT | PurchaseOrderItem | Baris PO sumber |
| `item` | BT | **[ItemVariant](#inventory)** | SKU |
| `unit` | BT | [ItemUnit](#inventory) | Satuan |
| `targetWarehouse` | BT | [Warehouse](#inventory) | Gudang |
| `returnAgainstItem` | BT | self | Baris GR asli (retur) |

### Supplier
| Relasi | Tipe | Target | Tujuan |
|---|---|---|---|
| `country` | BT | [Country](#core) | Negara |
| `branchOf` / `branches` | BT / HM | self | Hierarki supplier (TreeView) |

---

## Inventory

### Item
| Relasi | Tipe | Target | Tujuan |
|---|---|---|---|
| `category` | BT | Category | Kategori |
| `defaultUnit` | BT | Unit (`default_unit_id`) | Satuan default |
| `uom` / `uoms` | HM | ItemUnit | Konversi satuan |
| `variants` | HM | ItemVariant | Variant/SKU |
| `attributes` | HM | ItemAttribute | Atribut |
| `image` | BT | [File](#core) | Gambar |

### ItemVariant
| Relasi | Tipe | Target | Tujuan |
|---|---|---|---|
| `item` | BT | Item | Master induk |
| `values` | HM | ItemVariantAttribute | Nilai atribut variant |
| `category` | BT | Category | Kategori |
| `defaultUnit` | BT | Unit | Satuan default |
| `uoms` | HM | ItemUnit | Konversi satuan |
| `stocks` | HM | Stock | Posisi stok per gudang |
| `barcodes` | HM | ItemBarcode | Barcode |

> Mengapa banyak dokumen menunjuk ItemVariant, bukan Item: [Inventory · Item & Variant](modules/inventory.md#item--variant).

### Stock
| Relasi | Tipe | Target | Tujuan |
|---|---|---|---|
| `itemVariant` | BT | ItemVariant | SKU |
| `warehouse` | BT | Warehouse | Gudang |
| `unit` | BT | Unit | Satuan |

### Warehouse
| Relasi | Tipe | Target | Tujuan |
|---|---|---|---|
| `branch` | BT | [Branch](#core) | Cabang pemilik |
| `pic` | BT | [User](#user--access) (`user_id`) | Penanggung jawab |
| `stocks` | HM | Stock | Stok di gudang |

### DeliveryNote
| Relasi | Tipe | Target | Tujuan |
|---|---|---|---|
| `items` | HM | DeliveryNoteItem | Baris kirim |
| `customer` | BT | [Customer](#sales) | Penerima |
| `customerBranch` | BT | [Branch](#core) | Cabang customer |
| `referenceable` | MT | _polymorphic_ | Dokumen sumber (umumnya [SalesOrder](#sales)) |
| `referenceTo` | BT | [Permission](#user--access) (`reference_to_id`) | Referensi tipe dokumen |
| `returnAgainst` | BT | DeliveryNote (self) | DN asli (retur) — [flow](modules/sales.md#flow-retur-returnagainst) |

### DeliveryNoteItem
| Relasi | Tipe | Target | Tujuan |
|---|---|---|---|
| `deliveryNote` | BT | DeliveryNote | Induk |
| `item` | BT | **ItemVariant** | SKU |
| `unit` | BT | ItemUnit | Satuan |
| `sourceWarehouse` | BT | Warehouse | Gudang asal |
| `referenceable` | MT | _polymorphic_ | Baris SO sumber |
| `returnAgainstItem` | BT | self | Baris DN asli (retur) |

### StockEntry
| Relasi | Tipe | Target | Tujuan |
|---|---|---|---|
| `items` | HM | StockEntryItem | Baris pergerakan |
| `branch` | BT | [Branch](#core) | Cabang |
| `differenceAccount` | BT | [Account](#finances) | Akun selisih valuasi |
| `additionalCosts` | MM | [AdditionalCost](#finances) | Biaya tambahan |
| `referenceable` | MT | _polymorphic_ | Dokumen sumber |

### StockEntryItem
`stockEntry` (BT), `item` (BT → ItemVariant), `unit` (BT → ItemUnit), `sourceWarehouse`/`targetWarehouse` (BT → Warehouse).

### StockLedgerEntry
`item` (BT → ItemVariant), `unit` (BT → ItemUnit), `warehouse` (BT → Warehouse). Plus `referenceable` morph ke dokumen sumber.

### Pendukung Item
- **ItemUnit**: `item` (BT → Item), `unit` (BT → Unit).
- **ItemAttribute**: `item` (BT → Item), `attribute` (BT → Attribute), `barcodes` (HM).
- **ItemVariantAttribute**: `item` (BT → ItemVariant), `attribute` (BT → Attribute).
- **ItemBarcode**: `item` (BT → ItemVariant), `unit` (BT → ItemUnit), `basicUnit` (BT → Unit).
- **ItemAlternative**: `item` / `alternative` (BT → ItemVariant) — pasangan substitusi.
- **Category**: `defaultUnit` (BT → Unit) + hierarki TreeView.

---

## Finances

### Account (COA)
| Relasi | Tipe | Target | Tujuan |
|---|---|---|---|
| `currency` | BT | [Currency](#core) | Mata uang akun |
| `parentAccount` | BT | self | Hierarki COA (TreeView) |
| `generalLedgerEntries` | HM | GeneralLedger | Jurnal pada akun |

### SalesInvoice
| Relasi | Tipe | Target | Tujuan |
|---|---|---|---|
| `salesOrder` | BT | [SalesOrder](#sales) | SO yang ditagih |
| `items` | HM | SalesInvoiceItem | Baris tagihan |
| `customer` | BT | [Customer](#sales) | Tertagih |
| `customerBranch` | BT | [Branch](#core) | Cabang customer |
| `currency` | BT | [Currency](#core) | Mata uang |
| `debitAccount` | BT | Account | Akun piutang |
| `incomeAccount` | BT | Account | Akun pendapatan |
| `paymentSchedules` | MM | PaymentSchedule | Jadwal bayar |
| `returnAgainst` | BT | self | SI asli (retur/credit note) |

### PurchaseInvoice
| Relasi | Tipe | Target | Tujuan |
|---|---|---|---|
| `purchaseOrder` | BT | [PurchaseOrder](#purchase) | PO ditagih |
| `items` | HM | PurchaseInvoiceItem | Baris tagihan |
| `supplier` | BT | [Supplier](#purchase) | Penagih |
| `branch` | BT | [Branch](#core) | Cabang |
| `currency` | BT | [Currency](#core) | Mata uang |
| `creditAccount` | BT | Account | Akun hutang |
| `expenseHeadAccount` | BT | Account | Akun beban/persediaan |
| `paymentSchedules` | MM | PaymentSchedule | Jadwal bayar |
| `returnAgainst` | BT | self | PI asli (retur/debit note) |

### PaymentEntry
| Relasi | Tipe | Target | Tujuan |
|---|---|---|---|
| `paymentMethod` | BT | PaymentMethod | Metode bayar |
| `currency` | BT | [Currency](#core) | Mata uang |
| `partyable` | MT | [Customer](#sales)/[Supplier](#purchase) | Pihak lawan |
| `paymentable` | MT | SalesInvoice/PurchaseInvoice | Invoice dibayar |
| `accountPaidTo` | BT | Account | Akun penerima |
| `accountPaidFrom` | BT | Account | Akun pengirim |

### Item & pendukung
- **SalesInvoiceItem**: `salesInvoice` (BT), `salesOrderItem` (BT), `item` (BT → ItemVariant), `unit`, `tax`, `returnAgainstItem` (BT self).
- **PurchaseInvoiceItem**: `purchaseInvoice` (BT), `purchaseOrderItem` (BT), `item` (BT → ItemVariant), `unit`, `tax`, `targetWarehouse`, `referenceable` (MT), `returnAgainstItem` (BT self).
- **PaymentMethod**: `defaultAccount` (BT → Account).
- **PaymentTermTemplate**: `items` (HM → PaymentTermTemplateItem).
- **PaymentTermTemplateItem**: `paymentTermTemplate` (BT), `paymentMethod` (BT).
- **PaymentSchedule**: `paymentMethod` (BT), `referenceTo` (MT → invoice/order).
- **AdditionalCost**: `referenceable` (MT), `expenseAccount` (BT → Account).

---

## Service

### WorkOrder
`items` (HM → WorkOrderItem), `customer` (BT → [Customer](#sales)). Lihat [Service](modules/service.md).

### WorkOrderItem
`workOrder` (BT), `item` (BT → **[ItemVariant](#inventory)**, `item_variant_id`), `unit` (BT → ItemUnit). Alternatif komponen via `WorkOrderItemAlternative`.

---

## Core

### Branch
| Relasi | Tipe | Target | Tujuan |
|---|---|---|---|
| `billingCountry` / `shippingCountry` | BT | [Country](#core) | Negara alamat |
| `users` | BTM | [User](#user--access) (`user_branches`) | User yang punya akses |
| `branchable` | MT | Customer/Supplier/Company | Entitas pemilik cabang |

### ApprovalScheme
`permission` (BT → [Permission](#user--access)), `steps` (HM → ApprovalSchemeStep).

### ApprovalSchemeStep
`approvalScheme` (BT), `approver` (MT → Role/User).

### ApprovalInstance
`approvalScheme` (BT), `document` (MT → dokumen submitable), `steps` (HM → ApprovalInstanceStep), `currentStep` (HO).

### ApprovalInstanceStep
`approvalInstance` (BT), `approver` (MT → Role/User), `actedBy` (BT → User).

### Lainnya
- **PrintTemplate**: `permission` (BT → Permission), `letterHead` (BT self).
- **Dashboard**: `widgets` (HM → DashboardWidget), `createdBy` (BT → User).
- **Widget**: `dashboards` (HM → DashboardWidget), `createdBy` (BT → User), `model` (BT → Permission).
- **DashboardWidget**: `widget` (BT), `dashboard` (BT), parent (BT self).
- **ModelConnection**: `model` (MT), `reference` (MT) — dua dokumen apa pun.
- **File**: `user` (BT), `folder` (BT self, hierarki).
- **Fileable**: `fileable` (MT), `file` (BT → File).
- **Tag**: `tagMorphs` (MM → Taggable), `logs` (MM → Log).
- **Log**: `user` (BT), `loggable` (MT).
- **CommandRecent**: `user` (BT).

---

## User & Access

### User
| Relasi | Tipe | Target | Tujuan |
|---|---|---|---|
| `roles` / `idRoles` | BTM | Role (`user_role`) | Role user (RBAC) |
| `branches` | BTM | [Branch](#core) (`user_branch`) | Cabang yang diakses |
| `defaultBranch` | BT | [Branch](#core) | Cabang default |
| `dashboards` | BTM | [Dashboard](#core) | Dashboard user |
| `providers` | HM | UserProvider | Akun OAuth (Socialite) |

### Role
`users` (BTM → User), `rules` (HM → RolePermission).

### RolePermission
`permission` (BT → Permission), `role` (BT → Role).

### RoleProfile
`roles` (BTM → Role via `role_profile_details`).

### UserProvider
`user` (BT → User). Menyimpan koneksi OAuth — lihat [Auth · Social Login](auth.md#social-login-socialite).

> RBAC lengkap: [Auth · Roles & Permissions](auth.md#roles--permissions) · [Architecture · Permission](architecture.md#sistem-permission-role-based).

---

*Lihat juga: [Database](database.md) · [Architecture](architecture.md) · [Frontend](frontend.md) · Modul: [Sales](modules/sales.md) · [Purchase](modules/purchase.md) · [Inventory](modules/inventory.md) · [Finances](modules/finances.md) · [Service](modules/service.md) · [Core](modules/core.md)*
