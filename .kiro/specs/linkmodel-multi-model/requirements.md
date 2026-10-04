# Requirements Document

## Introduction

Diturunkan dari [design.md](design.md) (alur `design-first`). `LinkModel` hanya dapat memuat opsi dari satu model. Spec ini menambah **sub model** sehingga satu dropdown dapat menampilkan opsi dari beberapa model dalam bagian ber-header. Tidak ada perubahan backend; backend/form Purchase Receipt untuk item di luar PO adalah spec terpisah.

## Glossary

- **Main**: model dari prop `model` (tetap).
- **Sub**: model dari elemen `subModels`.
- **Sumber**: main atau sub.
- **Bagian**: area dropdown milik satu sumber; berheader bila dibungkus.
- **Dibungkus**: bagian dengan header buka-tutup. Sub selalu; main hanya bila `mainLabel` ada.

## Requirements

### Requirement 1: Kompatibilitas mundur

**User Story:** Sebagai developer, saya ingin semua pemakaian LinkModel yang ada tidak berubah.

1. WHEN `subModels` tidak diberikan, THE LinkModel SHALL berperilaku identik dengan sebelumnya (dropdown, grup, cache, Advance Search, add, navigate).
2. THE test LinkModel yang sudah ada SHALL tetap lulus tanpa diedit.

### Requirement 2: Konfigurasi sub model

1. THE LinkModel SHALL menerima `subModels`: list `{model, label, filters, with, fields, order, keywords, translate, group, advanceSearch, form, titleDialog, disabledAddButton, defaultValueForm, postOption, classNameDialog, as, canNavigation, disabledNavigation, customNavigation}`.
2. `model` dan `label` SHALL wajib; elemen tanpa keduanya diabaikan dengan peringatan (dev).
3. Model duplikat (sama dengan main atau antar sub) SHALL diabaikan dengan peringatan (dev).
4. Mode `cache` SHALL hanya berlaku untuk main; sub SHALL selalu mode search.

### Requirement 3: Tampilan dropdown

1. WHEN `mainLabel` tidak ada, main SHALL tampil sebagai baris biasa di atas bagian sub.
2. WHEN `mainLabel` ada, main SHALL tampil sebagai bagian ber-header, terbuka secara default.
3. Setiap sub SHALL tampil sebagai bagian ber-header (`label`), tertutup secara default.
4. Header bagian SHALL memakai gaya header grup yang ada (chevron, `aria-expanded`).
5. Pesan "tidak ditemukan" SHALL tampil hanya bila semua bagian kosong.
6. Fetch/kegagalan satu bagian SHALL tidak memblokir bagian lain; kegagalan fetch flat = toast + bagian kosong, kegagalan node grup = pesan + coba lagi bawaan `GroupTree`.

### Requirement 4: Fetch lazy

1. WHEN dropdown dibuka tanpa `search`, THE LinkModel SHALL hanya fetch main; sub SHALL tidak di-fetch sebelum dibuka.
2. WHEN header sub dibuka (klik/Enter/panah kanan), THE LinkModel SHALL fetch sub memakai model, `filters`, `with`, `fields`, `order`, `keywords`, `translate`, `group` miliknya.
3. WHEN `search` terisi, THE LinkModel SHALL fetch semua sumber dengan kata kunci yang sama (debounce yang ada; sub SHALL tidak fetch dengan `search` lama sebelum debounce selesai); bagian berhasil SHALL terbuka otomatis, bagian tanpa hasil SHALL disembunyikan.
4. WHEN `search` dikosongkan, bagian SHALL kembali ke status awal (main terbuka, sub tertutup).

### Requirement 5: Dedupe

1. Dedupe SHALL dilakukan konsumen lewat `filters` sub (mis. `{id: {notIn: [...]}}`); komponen SHALL tidak menambah fitur dedupe bawaan.

### Requirement 6: Grup per sumber

1. Setiap sumber SHALL memakai `group` miliknya: tak diisi = `$defaultGroups` model itu, `[]` = tanpa grup, list = grup eksplisit.
2. Grup SHALL tampil di dalam bagian (header bagian di tingkat teratas), lazy seperti `GroupedOptions` sekarang.

### Requirement 7: Pemilihan dan validasi

1. `validate(value, model)` SHALL menerima string atau array model; `value.thisModel` SHALL termasuk salah satu.
2. WHEN baris sub dipilih, THE LinkModel SHALL memanggil `onValueChange` dengan baris itu (membawa `thisModel` sub).
3. Opsi bermodel di luar daftar SHALL ditolak (`onValueChange` tidak terpanggil) dan nilai tak valid SHALL dikosongkan seperti sekarang.
4. `defaultValue` SHALL tetap di-resolve dari main.

### Requirement 8: Keyboard dan identitas baris

1. Nilai cmdk baris sub dan kunci `knownRowsRef` baris sub SHALL berprefiks sumber (`<indeks>:<id>`) dan selalu string, sehingga id yang sama di main dan sub tidak bentrok; nilai baris main SHALL tidak berubah.
2. Header bagian SHALL dapat dibuka/ditutup dengan Enter, klik, panah kanan/kiri.
3. Tab-autocomplete dan exact-match-on-close SHALL mencari ke seluruh sumber.
4. Sorotan awal SHALL baris pertama main (bila ada), jika tidak header bagian pertama.

### Requirement 9: Add per sumber

1. Setiap sumber ber-`form`, tidak `disabledAddButton`, dan lolos `can("create")` model itu SHALL punya satu baris Add di area sticky bawah (berlabel `titleDialog`).
2. WHEN add sukses, THE LinkModel SHALL fetch baris baru dengan model + `with` sumber itu lalu menjadikannya `option`.

### Requirement 10: Navigate per sumber

1. Tombol navigasi SHALL memakai `as`, `canNavigation`, `disabledNavigation`, `customNavigation` sumber yang cocok dengan `option.thisModel`.
2. WHEN tak ada sumber yang cocok, tombol SHALL disembunyikan.

### Requirement 11: Advance Search bertab

1. WHEN >1 sumber (dan `advanceSearch !== false`), dialog SHALL menampilkan tab per model; isi tab SHALL memakai config sumber itu.
2. Tab awal SHALL main; teks pencarian dropdown SHALL terbawa ke tab aktif.
3. Memilih baris di tab mana pun SHALL memanggil `setOption(row)` lalu menutup dialog.

### Requirement 12: Keamanan

1. Tiap sumber SHALL memakai route `model` yang sama; tidak ada perubahan backend dan kontrak kolom aman (`linkable`, `visibleFor`, `templateLink`) SHALL berlaku per model.
