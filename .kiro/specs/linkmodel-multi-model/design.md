# Design Document: LinkModel Multi-Model

## Overview

`LinkModel` saat ini hanya melayani **satu** model (`model` prop, string). Spec ini membuat satu dropdown dapat memuat opsi dari **main model** (prop `model`, tetap) dan **sub model** (prop baru `subModels`), ditampilkan sebagai bagian-bagian ber-header.

Kasus pemicu: kolom item pada form Purchase Receipt. Main = `PurchaseOrderItem` (item dalam PO), sub = `ItemVariant` (item di luar PO).

```
  Item C                    <- main tanpa mainLabel: baris biasa
  Item D
> Purchase Order Item       <- main dengan mainLabel: header, terbuka (default)
    Item A
    Item B
> Item Lainnya              <- sub: header WAJIB, tertutup (default), lazy
-------------------------
  Advance Search
  + Tambah Purchase Order Item
  + Tambah Item Lainnya
```

**Di luar scope (spec terpisah):** backend Purchase Receipt untuk menyimpan item tanpa `purchase_order_item_id` (`PurchaseReceiptRequest.php:32` mewajibkan; `PurchaseReceiptService.php:43` membaca `item_id` dari PO Item), serta perubahan form Purchase Receipt itu sendiri. Spec ini murni komponen `LinkModel` generik.

## Temuan penelusuran kode (fakta)

| # | Temuan | Dampak |
|---|--------|--------|
| 1 | `validate(value, model)` = `value.thisModel === model` (`lib/linkModelUtils.js:3`); `setOption` menolak opsi tak valid (`LinkModel.jsx:257`) dan efek `[filters, option, value, model]` mengosongkan nilai tak valid (`:331`) | Perlu validasi terhadap **daftar** model |
| 2 | Route `model` (`ModelController::__invoke`) melayani satu `$request->model` di seluruh jalur (search, filter, kolom aman, paginasi, grup) | Satu request per sumber; **tidak ada perubahan backend**, kontrak keamanan kolom utuh |
| 3 | `useLinkModelInfiniteOptions` sudah mendukung flat berpaginasi + grup lazy per model; `GroupedOptions`/`GroupTree` generik | Dipakai ulang per bagian |
| 4 | Nilai cmdk opsi = `` `${opt.id}` `` (`LinkModel.jsx:898`), `knownRowsRef` memakai kunci yang sama | Id PO Item dan id ItemVariant bisa sama -> wajib prefiks sumber |
| 5 | Navigasi (`as`, `canNavigation`, `disabledNavigation`, `customNavigation`) dan Add (`form`, `titleDialog`, `disabledAddButton`, `defaultValueForm`, `postOption`, `classNameDialog`) adalah prop tunggal | Dijadikan konfigurasi per sumber |
| 6 | `AdvanceSearchDialog` + `useAdvanceSearchModel` bekerja untuk satu `model` | Satu instance isi dialog per tab |
| 7 | Operator `notIn` didukung `ModelController::filterOperator` / `FilterEvaluator` | Dedupe cukup lewat `filters` sub (tanpa fitur baru) |

## Keputusan desain (hasil brainstorming)

1. **Scope A:** hanya komponen `LinkModel` generik.
2. **Prop:** `model` tetap sebagai main, ditambah `mainLabel` dan `subModels`. Tanpa `subModels` perilaku identik dengan sekarang.
3. **Dedupe:** konsumen mengirim `filters: { id: { notIn: [...] } }` pada sub. Tidak ada `excludeBy` bawaan. "Dobel" = dua baris item yang sama di dropdown, bukan soal kuantitas; item PO yang sudah diterima penuh tidak muncul di main (`unreceived_quantity > 0`) maupun di sub (`notIn`).
4. **Buka-tutup:** main terbuka, sub tertutup dan lazy (fetch saat dibuka). Saat `search` terisi semua sumber di-fetch; bagian berhasil terbuka otomatis, bagian kosong disembunyikan.
5. **Grup per model:** tiap sumber punya `group` sendiri (tak diisi = `$defaultGroups` model itu, `[]` = tanpa grup). Header bagian di tingkat teratas, grup di dalamnya. Mode `cache` hanya untuk main; sub selalu mode search.
6. **Advance Search:** satu tombol, dialog bertab per model.
7. **Add:** satu baris Add per sumber di area sticky bawah (hanya yang punya `form` + izin create).

## API

```jsx
<LinkModel
  model="App\Models\Purchase\PurchaseOrderItem"
  mainLabel="Purchase Order Item"      // ada -> main dibungkus; tak ada -> baris biasa
  filters={{ purchase_order_id, unreceived_quantity: { ">": 0 } }}
  subModels={[
    {
      model: "App\\Models\\Inventory\\ItemVariant",
      label: "Item Lainnya",           // wajib
      filters: { id: { notIn: poVariantIds } },
      with, fields, order, keywords, translate, group,
      advanceSearch,                   // default true
      // add
      form, titleDialog, disabledAddButton, defaultValueForm, postOption, classNameDialog,
      // navigate
      as, canNavigation, disabledNavigation, customNavigation,
    },
  ]}
/>
```

Validasi prop: `subModels[i].model` dan `label` wajib; model duplikat (sama dengan main atau antar sub) diabaikan dengan peringatan dev.

## Komponen

- **`LinkModel.jsx`** tetap pemilik state: `open`, `search`, `option`, highlight cmdk, Tab-autocomplete, exact-match-on-close, `knownRowsRef`. Ditambah `sources` = `buildSources(...)` = `[main, ...subModels]` ter-normalisasi (index, model, label, wrapped, config).
- **Main tetap dirender oleh kode LinkModel yang ada** (hook search/cache, grup lokal, highlight, nilai cmdk apa adanya) -- hanya dibungkus `SourceHeader` + indentasi bila `mainLabel` ada. Ini menjaga kompatibilitas mundur dan mode `cache` main tanpa perubahan.
- **`LinkModel/SourceSection.jsx` (baru):** satu bagian **sub**. Tiap instance memanggil `useLinkModelInfiniteOptions` dengan model/filter/grup sumbernya, merender daftar flat atau `GroupedOptions` (dipakai ulang; prop baru `sourceIndex` + `depthOffset`). Hook per bagian dipanggil di komponen anak agar jumlah hook tetap (Rules of Hooks).
  - Header bagian: `SourceHeader` (`CommandItem` bergaya header grup, `aria-expanded`), nilai cmdk `__linkmodel_source__<index>`.
  - Fetch sub lazy: hanya bila bagian terbuka ATAU user mencari; saat mencari fetch ditahan sampai debounce menyamai ketikan (tak ada request dengan `search` lama/kosong).
  - Callback ke induk: `onStatus(index, {hasResults, settled})` untuk pesan "tidak ditemukan" lintas sumber; bagian tanpa hasil final disembunyikan saat mencari.
- **`lib/linkModelUtils.js`:** `validate(value, model)` menerima string **atau** array model (`thisModel ∈ model`). Tambah `buildSources`, `sourceValue(index, id)` / `parseSourceValue()` untuk nilai cmdk baris **sub** berprefiks `<index>:<id>` (nilai baris main tidak berubah; id main tak pernah berpola `<angka>:...`, jadi tak ada tabrakan).
- **`AdvanceSearchDialog.jsx`:** dipecah menjadi `AdvanceSearchBody` (isi satu model, kode lama) + pembungkus yang menerima `sources`; bila >1 sumber (dan `advanceSearch !== false`) render `Tabs` per model, tiap tab = `AdvanceSearchBody` dengan config sumber. Tab awal = main; `initialSearch` terbawa. `onSelect(row)` sama.
- **Navigasi:** `option.thisModel` -> cari sumber -> pakai `as`/`canNavigation`/`disabledNavigation`/`customNavigation` sumber itu; izin baca via `canGlobal(model, ...)`; tak ada sumber cocok = sumber main.
- **Add:** baris Add main tetap (`ADD_VALUE`), baris Add sub `__linkmodel_add__:<index>`, hanya sub ber-`form` + tak `disabledAddButton` + `canGlobal(model sub, "create")`. `FormPageDialog` per sub; `onSuccess` fetch `{model sumber, with sumber, id}` lalu `setOption`.

## Alur data

1. Dropdown dibuka -> `SourceSection` main fetch (halaman 1, infinite scroll/grup lazy seperti sekarang); sub render header tertutup tanpa fetch.
2. Klik/Enter/panah-kanan header sub -> `enabled` jadi true -> fetch -> daftar/grup tampil.
3. Ketik -> debounce 500ms (hook yang ada) -> semua sumber fetch dengan `search` sama; hasil melapor `hasResults`; bagian dengan hasil auto-expand (memakai `autoExpand` yang ada), tanpa hasil disembunyikan; semua kosong -> pesan "tidak ditemukan".
4. Pilih baris -> `setOption(row)` (row membawa `thisModel` sumbernya) -> `validate(row, allModels)` lolos -> `onValueChange(row)`.

## Keyboard (cmdk)

- Header bagian = item cmdk; Enter/klik/panah kanan-kiri membuka-menutup (logika panah header grup diperluas ke header bagian).
- Nilai baris sub `<index>:<id>`, baris main tak berubah; selalu string. Tab-autocomplete dan exact-match-on-close mencari ke `flatOptions` main + `knownRowsRef` (baris sub berprefiks terdaftar saat dirender).
- Sorotan awal: baris pertama main (jika ada), jika tidak header bagian pertama.

## Error handling

- Fetch daftar flat sub gagal: toast yang ada (`core.errors.fetch_failed`, perilaku hook) dan bagian kosong; bagian lain tak terpengaruh. Node grup gagal: pesan + coba lagi bawaan `GroupTree`.
- Model sub yang tak punya izin baca / ditolak server: bagian menampilkan kosong (server sudah menyaring); tidak ada crash.

## Keamanan

Tidak ada permukaan baru: tiap sumber memanggil route `model` yang sama; `safeLookupColumns` (`linkable`, `visibleFor`, `templateLink`) berlaku per model.

## Strategi pengujian

- Unit (`.test.js`, node): `validate` string/array; `sourceValue`/`parseSourceValue`; normalisasi `sources` (duplikat, label wajib).
- RTL (`.rtl.test.jsx`): kompatibilitas tanpa `subModels` (test LinkModel yang ada tetap hijau tanpa diedit); main terbuka/sub tertutup; sub tak di-fetch sebelum dibuka; request sub memuat model+filter `notIn`; search fetch semua sumber + auto-expand + sembunyikan kosong + "tidak ditemukan"; `mainLabel` on/off; pilih baris sub -> `onValueChange` bermodel sub; model luar daftar ditolak; id sama lintas model tak bentrok; navigate/add per sumber; tab Advance Search per model + teks terbawa.
- Browser sungguhan (wajib, `npm run build`): Purchase Receipt (PurchaseOrderItem + ItemVariant), keyboard panah/Enter/Tab, dedupe.
- Backend: tidak berubah; jalankan test `ModelController` yang ada sebagai regresi.

## Tidak termasuk (YAGNI)

Backend/form Purchase Receipt, `excludeBy` bawaan, sub model mode `cache`, endpoint `model` multi-model satu request, sumber dinamis saat runtime.
