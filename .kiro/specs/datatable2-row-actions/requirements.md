# Requirements: DataTable2 Row Actions

Fondasi aksi baris untuk semua halaman index berbasis `DataTable2`: checkbox seleksi tampil secara default, kolom aksi diganti tombol `⋯` (menu) yang berisi aksi "Hapus" bawaan plus aksi custom per halaman, dan aksi yang sama dapat dijalankan secara massal (bulk) pada baris yang dicentang.

Fitur ini menjadi pondasi untuk fitur lanjutan (mis. "pilih beberapa Purchase Request → buat 1 PO atau lebih"), yang akan ditulis sebagai spec terpisah.

---

## Glossary

- **Row action** — aksi yang didefinisikan secara deklaratif lewat prop `rowActions` pada `DataTable2`.
- **Eligible row** — baris yang lolos `enabled(row)` untuk sebuah aksi.
- **Bulk bar** — toolbar yang muncul saat ≥1 baris dicentang.
- **Action attribute** — accessor model yang didaftarkan di `$rowActionAttributes` dan selalu ikut ter-SELECT di DataTable.

---

## 1. Functional Requirements

### FR-1: Checkbox seleksi default

- **FR-1.1**: Setiap `DataTable2` **HARUS** menampilkan kolom checkbox di sebelah kiri kolom aksi secara default.
- **FR-1.2**: Halaman **DAPAT** menonaktifkan seleksi dengan `selectable={false}`.
- **FR-1.3**: Pada mode flat, checkbox header **HARUS** mencentang/menghapus centang semua baris di halaman yang tampil. Status header tristate: kosong, sebagian (indeterminate), penuh.
- **FR-1.4**: Pada mode grup (`GroupTree`), checkbox per baris **HARUS** berfungsi; checkbox header **TIDAK** ditampilkan (baris dimuat malas per node lewat react-query, sehingga "semua" tidak terdefinisi dengan jelas).
- **FR-1.5**: Seleksi **HARUS** di-reset setiap kali data dimuat ulang (ganti halaman, filter, sort, group, jumlah per halaman, atau `reload()`).

### FR-2: Kolom aksi menjadi menu `⋯`

- **FR-2.1**: Kolom aksi **HARUS** berisi satu tombol ikon `⋯` yang membuka dropdown menu, menggantikan tombol Hapus merah.
- **FR-2.2**: Menu **HARUS** berisi aksi halaman (urutan sesuai deklarasi) lalu aksi "Hapus" bawaan di paling bawah, dipisah separator.
- **FR-2.3**: Aksi yang `enabled(row)` bernilai `false` **TIDAK** ditampilkan di menu baris tersebut.
- **FR-2.4**: Bila tidak ada aksi yang tersisa untuk sebuah baris, tombol `⋯` **TIDAK** dirender (sel tetap ada agar grid tidak bergeser).
- **FR-2.5**: Aksi dengan `variant: "destructive"` **HARUS** ditampilkan dengan warna destruktif.

### FR-3: Aksi "Hapus" bawaan

- **FR-3.1**: "Hapus" bawaan **HARUS** eligible untuk sebuah baris hanya jika `row.canDelete !== false` **DAN** `can("delete", { user_id: row.created_by_id })` bernilai true (perilaku saat ini dipertahankan).
- **FR-3.2**: Per baris, "Hapus" **HARUS** memakai alur yang ada (`useDeleteModal` → `DeleteDialog` → `DELETE <plural>.destroy`), termasuk konfirmasi password bila `usePasswordConfirmationForDelete`.
- **FR-3.3**: Pada bulk bar, "Hapus" **HARUS** tampil hanya bila backend menyatakan `bulkDestroy = true`.
- **FR-3.4**: Bulk delete **HARUS** meminta konfirmasi (dengan jumlah baris), plus input password bila `usePasswordConfirmationForDelete`.
- **FR-3.5**: Halaman **DAPAT** menyembunyikan "Hapus" bawaan dengan `hideDeleteAction`.

### FR-4: Aksi custom per halaman (`rowActions`)

- **FR-4.1**: `DataTable2` **HARUS** menerima prop `rowActions` berupa array definisi aksi:
  `{ key, label, icon?, variant?, single?, bulk?, enabled?, requires?, confirm?, onAction }`.
- **FR-4.2**: `single` default `true` (tampil di menu `⋯`), `bulk` default `false` (tampil di bulk bar).
- **FR-4.3**: `onAction` **HARUS** selalu dipanggil dengan array baris (per baris = array satu elemen) dan objek helper `{ clearSelection, reload }`.
- **FR-4.4**: Bila `confirm` diberikan, sistem **HARUS** menampilkan dialog konfirmasi sebelum `onAction` dipanggil. `confirm` dapat berupa objek atau fungsi `(rows) => objek`.
- **FR-4.5**: `onAction` **DAPAT** mengembalikan Promise; selama pending, tombol aksi terkait **HARUS** dalam keadaan loading/disabled.
- **FR-4.6**: Prop lama `actions` (render-prop) **DIHAPUS** dari `DataTable2`; satu-satunya pemakai (`Core/GlPostingStatuses/Index.jsx`) dimigrasi ke `rowActions`.

### FR-5: Bulk bar & baris tidak eligible

- **FR-5.1**: Saat ≥1 baris dicentang, bulk bar **HARUS** tampil dengan jumlah terpilih, tombol tiap aksi ber-`bulk: true`, dan tombol "Batal pilih".
- **FR-5.2**: Untuk tiap aksi bulk, sistem **HARUS** menjalankan `onAction` hanya pada baris eligible. Label tombol menampilkan jumlah eligible bila berbeda dari jumlah terpilih (mis. "Buat PO (3 dari 5)"), dengan tooltip yang menjelaskan jumlah baris yang dilewati.
- **FR-5.3**: Tombol aksi bulk dengan 0 baris eligible **HARUS** disabled.
- **FR-5.4**: Setelah aksi bulk "Hapus" sukses, seleksi **HARUS** dikosongkan dan data dimuat ulang.

### FR-6: Ketersediaan field untuk aksi

- **FR-6.1**: Model **DAPAT** mendeklarasikan `protected static array $rowActionAttributes` berisi nama accessor yang **HARUS** selalu ikut ter-SELECT pada query DataTable, terlepas dari kolom yang ditampilkan (cookie visible columns) dan dari tampilan (desktop/mobile).
- **FR-6.2**: Accessor yang terdaftar **HARUS** memiliki `dependsOn` di `configColumns` (dipaksa oleh mekanisme strict yang ada).
- **FR-6.3**: Deklarasi ini **TIDAK BOLEH** memperluas kolom yang dapat diminta lewat endpoint LinkModel (berbeda dari `forceSelect`).
- **FR-6.4**: Bila aksi mencantumkan `requires`, pada mode development `DataTable2` **HARUS** memberi `console.warn` jika baris tidak memiliki field tersebut. Tidak ada efek di produksi.

### FR-7: Endpoint bulk delete

- **FR-7.1**: Macro `resourceDetail` **HARUS** mendaftarkan `DELETE /{plural}` → `destroyMany`, bernama `{plural}.destroyMany`, dengan body `ids[]`.
- **FR-7.2**: `destroyMany` **HARUS** memakai permission `delete` (mapping di constructor `Controller`).
- **FR-7.3**: `ids` **HARUS** divalidasi: array, minimal 1, maksimal 500, distinct.
- **FR-7.4**: Bila ada id yang tidak ditemukan, request **HARUS** gagal 404 tanpa menghapus apa pun.
- **FR-7.5**: Bila permission `onlyCreator` aktif dan salah satu record bukan milik user, request **HARUS** gagal 403 tanpa menghapus apa pun.
- **FR-7.6**: Penghapusan **HARUS** berjalan dalam satu transaksi DB; bila satu record gagal (mis. guard `canDelete` di event `deleting`, atau `beforeDestroy`), **SEMUA** dibatalkan dan error menyebut identitas record yang gagal.
- **FR-7.7**: Tiap record **HARUS** dihapus lewat jalur yang sama dengan `destroy` tunggal (`beforeDestroy` → `delete()` → event audit).
- **FR-7.8**: Bila controller membutuhkan password (`destroyRequiresPassword()`), `destroyMany` **HARUS** memvalidasi `current_password`.
- **FR-7.9**: Controller yang meng-override `destroy` tanpa meng-override `destroyRecord` **HARUS** dianggap tidak mendukung bulk delete: `destroyMany` → 405, dan prop `bulkDestroy` = `false`.
- **FR-7.10**: Sukses → redirect ke index dengan flash jumlah data terhapus.

### FR-8: Mobile

- **FR-8.1**: Setiap kartu `templateItem` **HARUS** dibungkus `DataTable2` dengan tombol `⋯` di sisi kanan, berisi aksi yang sama dengan desktop.
- **FR-8.2**: Long-press (±500 ms, batal bila jari bergeser melebihi ambang) pada kartu **HARUS** masuk ke mode pilih dan mencentang kartu tersebut.
- **FR-8.3**: Menu `⋯` di header mobile **HARUS** menyediakan entri "Pilih" sebagai alternatif long-press.
- **FR-8.4**: Dalam mode pilih, checkbox tampil di kiri kartu; tap kartu = toggle centang dan **TIDAK** memicu navigasi `Link` di dalam kartu. Click yang menyusul long-press **HARUS** ditelan.
- **FR-8.5**: Bulk bar mobile menempel di bawah layar. Mode pilih berakhir saat seleksi kosong atau user menekan "Batal pilih".
- **FR-8.6**: Berlaku juga di mode grup mobile (`GroupTree` infinite).
- **FR-8.7**: `templateItem` tetap menerima `deleteItem` (deprecated) untuk kompatibilitas; tombol hapus manual di 16 halaman `Index.jsx` dihapus agar tidak dobel dengan `⋯`.

---

## 2. Non-Functional Requirements

- **NFR-1 (Kompatibilitas)**: `Table2` yang dipakai `SelectModel` dan `AdvanceSearchDialog` (seleksi uncontrolled via `row.isSelected` + `ref.getSelectedItem()`) **HARUS** tetap berfungsi tanpa perubahan.
- **NFR-2 (Keamanan)**: Frontend hanya menyaring; server tetap memvalidasi permission, kepemilikan, dan `canDelete` per record.
- **NFR-3 (Performa)**: Tidak ada query tambahan per baris untuk menentukan eligibility; eligibility dibaca dari atribut yang sudah ada di payload.
- **NFR-4 (Aksesibilitas)**: Tombol `⋯` memiliki `aria-label`; checkbox memiliki label baris; mode pilih mobile dapat diakses tanpa long-press (FR-8.3).
- **NFR-5 (i18n)**: Semua teks baru tersedia di `lang/en/core/datatable.php` dan `lang/id/core/datatable.php`.

---

## 3. Out of Scope

- Persistensi seleksi lintas halaman/filter dan "pilih semua N hasil filter".
- Fitur Purchase Request → Purchase Order (spec terpisah).
- Aksi bulk lain selain "Hapus" bawaan (kecuali migrasi `retry` di GlPostingStatuses).
- Perubahan `Table` (v1) dan `FormTable`.

---

## 4. Acceptance Criteria

1. Membuka halaman index mana pun (desktop) menampilkan kolom checkbox dan tombol `⋯`; tidak ada lagi tombol Hapus merah di kolom aksi.
2. Mencentang 3 baris di halaman yang `delete`-nya diizinkan, menekan "Hapus" di bulk bar, mengonfirmasi → 3 record terhapus dalam satu request; seleksi kosong; tabel dimuat ulang.
3. Bila salah satu dari 3 record memiliki transaksi (`canDelete = false` di server), tidak ada yang terhapus dan pesan error menyebut record tersebut.
4. Halaman dengan aksi custom `bulk: true` dan `enabled` yang hanya meloloskan sebagian baris menampilkan label "(n dari m)" dan `onAction` hanya menerima baris eligible.
5. Menyembunyikan kolom yang menjadi dasar atribut di `$rowActionAttributes` tidak mengubah eligibility aksi.
6. Di mobile, long-press kartu masuk mode pilih; tap kartu lain menambah centang tanpa navigasi; bulk bar tampil di bawah.
7. `SelectModel` dan `AdvanceSearchDialog` tetap dapat memilih baris seperti sebelumnya.
8. `DELETE /tags` (controller dengan `destroy` kosong) → 405; halaman tidak menampilkan "Hapus" di bulk bar.
