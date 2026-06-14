# Requirements: Variable Drop Mode Selector

Fitur ini memungkinkan pengguna untuk memilih format/mode representasi variabel ketika melakukan operasi drag-and-drop atau klik-menyisipkan variabel ke dalam canvas print template editor.

---

## 1. Functional Requirements

### FR-1: Pemicu Dialog Pilihan Mode (Drop & Click)

- **FR-1.1**: Ketika pengguna men-drag `VariableItem` dan meletakkannya (drop) pada canvas GrapesJS, sistem **HARUS** menampilkan modal dialog pilihan mode.
- **FR-1.2**: Ketika pengguna melakukan klik pada `VariableItem` untuk menyisipkan variabel ke komponen aktif, sistem **HARUS** menampilkan modal dialog pilihan mode.
- **FR-1.3**: Pengecualian: Jika kursor teks sedang aktif di dalam komponen teks (mode inline editing), sistem **HARUS** langsung menyisipkan token secara inline (Token Only) tanpa memicu dialog.
- **FR-1.4**: Pengecualian: Untuk variabel relasi banyak (`relations` yang menghasilkan tabel), sistem **HARUS** langsung menjatuhkan tabel (`gjsRelationsTable`) tanpa memicu dialog.

### FR-2: Opsi Mode Berdasarkan Target Drop

Sistem **HARUS** menyesuaikan daftar opsi mode yang tersedia berdasarkan elemen target tempat variabel dijatuhkan:

- **FR-2.1 [Target: gjsGrid]**: Menyediakan opsi: `Label Only`, `Token Only`, dan `Both`.
- **FR-2.2 [Target: gjsSubGrid]**: Menyediakan opsi: `Label Only` dan `Token Only` saja (opsi `Both` disembunyikan/dinonaktifkan).
- **FR-2.3 [Target: gjsRelationsTable Cell (td/th)]**: Menyediakan opsi: `Label Only`, `Token Only`, dan `Both`.
- **FR-2.4 [Target: Luar Grid (Wrapper/Body)]**: Menyediakan opsi: `Label Only`, `Token Only`, dan `Both`.

### FR-3: Spesifikasi Render Komponen

- **FR-3.1 [Mode: Label Only]**:
  - Menghasilkan elemen paragraf `<p>` berisi `<span>` dengan atribut `data-label-key`.
  - Content teks diatur ke nama tampilan variabel yang terlokalisasi (`displayLabel`).
- **FR-3.2 [Mode: Token Only]**:
  - Menghasilkan elemen paragraf `<p>` berisi `<span>` dengan atribut `data-token`.
  - Content teks diatur ke token Handlebar yang disederhanakan (`simplifiedToken`).
- **FR-3.3 [Mode: Both]**:
  - Menghasilkan komponen `gjsSubGrid` yang berisi label paragraf dan token paragraf dengan separator `": "`.

### FR-4: Perilaku Auto-Wrapping (Both Mode)

Jika pengguna memilih mode **Both**, sistem **HARUS** menerapkan auto-wrapping sesuai target:

- **FR-4.1**: Jika dijatuhkan langsung ke dalam `gjsGrid`, sisipkan `gjsSubGrid` secara langsung tanpa pembungkus tambahan.
- **FR-4.2**: Jika dijatuhkan di luar `gjsGrid` atau di dalam cell tabel `gjsRelationsTable`, bungkus subgrid dengan container `gjsGrid` baru secara otomatis.

### FR-5: Batalkan Operasi (Rollback)

- **FR-5.1**: Jika pengguna menutup dialog pilihan, membatalkan dialog, atau menekan Escape, sistem **HARUS** membatalkan seluruh operasi drop/insert dan memastikan tidak ada elemen kosong atau rusak yang tersisa di canvas.

---

## 2. Non-Functional Requirements

- **NFR-1 (Usability)**: Dialog mode harus muncul secara instan (< 100ms) setelah aksi drop/click diselesaikan.
- **NFR-2 (Focus Preservation)**: Saat dialog muncul, fokus editor dan status komponen yang terpilih di canvas harus tetap terjaga sehingga user tahu persis di mana variabel akan diletakkan.

---

## 3. Acceptance Criteria

- **AC-1**: Drop variabel ke canvas kosong → Dialog muncul dengan opsi Label, Token, Both. Memilih "Label" menghasilkan label teks saja.
- **AC-2**: Drop variabel ke dalam elemen `gjsSubGrid` → Dialog muncul hanya dengan opsi Label dan Token. Pilihan "Both" tidak ditampilkan.
- **AC-3**: Drop variabel ke dalam sel `<td>` dari `gjsRelationsTable` dalam Custom Mode → Dialog muncul dengan opsi Label, Token, Both. Memilih "Both" menghasilkan grid + subgrid di dalam sel.
- **AC-4**: Klik item variabel di sidebar dengan komponen teks biasa aktif → Dialog muncul. Memilih "Token Only" menyisipkan token di akhir komponen teks.
- **AC-5**: Klik batal pada dialog drop → Canvas bersih, tidak ada komponen baru yang ditambahkan.
