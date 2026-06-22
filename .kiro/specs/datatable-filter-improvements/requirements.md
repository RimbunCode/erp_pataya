# Requirements — DataTable2 Filter Improvements

## Pendahuluan

Sistem filter server-side DataTable2 (mesin: `app/Services/Core/FilterEvaluator.php`) memiliki dua kebutuhan:

1. **Bugfix** — kolom bertipe `formStatuses` (JSON array, mis. `'["draft","approved"]'`) tidak terfilter dengan benar pada operator `in`/`!in`/`has`/`!has` karena evaluator memakai `whereIn` yang membandingkan seluruh blob JSON sebagai string.
2. **Fitur baru** — pengguna ingin membandingkan nilai satu kolom dengan kolom lain (mis. `qty > min_qty`, `price between cost AND max_price`), termasuk kolom di relasi (dot-notation).

Aturan operator/value di-mirror di 3 lapisan dan **harus konsisten**: query (`FilterEvaluator`), validasi save-time (`FilterTreeCleaner`), serta UI + validasi client (`operators.js`, `ValueField.jsx`, `filterValidation.js`, `FilterItem2.jsx`). Item yang tidak lolos validasi di salah satu lapisan akan di-drop diam-diam.

## Glossary

- **Filter tree** — struktur DSL `{ root: { k, c: { <id>: group|item } } }` hasil FilterBuilder frontend, disimpan di `saved_filters.filter`.
- **Item** — daun filter `{ k: <kolom>, o: <operator>, v: <value> }`.
- **Mode value** — value `v` berupa literal (perilaku saat ini).
- **Mode column** — value `v` berupa referensi kolom: `{ kind: "column", ref: <key|key[]> }`.
- **Column ref / `ref`** — key kolom (notasi sama dengan column picker; dot-notation untuk relasi).
- **Same-table** — kolom kiri & kanan pada tabel model yang sama.
- **Cross-table** — salah satu sisi berada di relasi (butuh correlated subquery).

---

## Requirement 1 — Fix filter `formStatuses` (JSON array)

**User Story:** Sebagai pengguna, saya ingin memfilter kolom multi-status (`formStatuses`) dengan operator `in`/`!in`/`has`/`!has` sehingga baris yang status-array-nya memuat (atau tidak memuat) nilai terpilih tampil dengan benar.

### Acceptance Criteria

1. WHEN sebuah item memfilter kolom bertipe `formStatuses` dengan operator `in` dan daftar value `[a, b, ...]`, THEN sistem HARUS mengembalikan baris yang JSON array-nya memuat **minimal salah satu** dari value tersebut.
2. WHEN operator `!in` dipakai pada kolom `formStatuses` dengan daftar value `[a, b, ...]`, THEN sistem HARUS mengembalikan baris yang JSON array-nya **tidak memuat satupun** value tersebut.
3. WHEN operator `has` / `!has` dipakai pada kolom `formStatuses`, THEN perilakunya HARUS identik dengan `in` / `!in` (semantik "memuat" / "tidak memuat").
4. WHEN beberapa value dipilih, THEN matching HARUS berbasis keanggotaan elemen pada JSON array, BUKAN kecocokan string blob JSON penuh.
5. Kolom bertipe `formStatus` **tunggal** (string biasa via `FormStatusCast`) TIDAK boleh berubah perilakunya — `whereIn`/`whereNotIn` tetap benar untuk type itu.
6. WHEN nilai NULL pada kolom `formStatuses`, THEN baris tersebut TIDAK match untuk `in`/`has` dan tidak menyebabkan error.
7. Item `formStatuses` dengan list value kosong HARUS di-drop pada validasi save-time (`FilterTreeCleaner`) — konsisten dengan operator list lain.
8. Penggabungan AND/OR dengan item lain HARUS menjaga precedence yang benar (OR-chain internal terbungkus group).

---

## Requirement 2 — Bandingkan nilai antar-kolom (value-source toggle)

**User Story:** Sebagai pengguna, saya ingin sebuah item filter bisa membandingkan kolom kiri dengan kolom lain (bukan hanya nilai literal) sehingga saya dapat menyaring baris berdasar relasi antar-kolom (mis. `qty > min_qty`).

### Acceptance Criteria

1. WHEN pengguna mengaktifkan mode column pada sebuah item, THEN value `v` HARUS berbentuk `{ kind: "column", ref: <key | key[]> }` dan sistem HARUS membangun perbandingan kolom-ke-kolom, bukan kolom-ke-literal.
2. Bentuk `{ kind: "column", ref }` HARUS backward-compatible: item literal lama (tanpa `v.kind`) tetap diproses sebagai mode value.
3. WHEN operator komparasi (`=`, `!=`, `>`, `>=`, `<`, `<=`) dipakai di mode column, THEN sistem HARUS membandingkan kolom kiri dengan **satu** kolom kanan.
4. WHEN operator `in` / `!in` dipakai di mode column dengan `ref` = daftar kolom, THEN sistem HARUS mencocokkan kolom kiri terhadap **himpunan kolom** kanan (mis. `left = refA OR left = refB`), dan `!in` adalah negasinya.
5. WHEN operator `between` / `!between` dipakai di mode column dengan `ref` = tepat 2 kolom `[lo, hi]`, THEN sistem HARUS menerapkan `left >= lo AND left <= hi` (dan `!between` negasinya), terbungkus group.
6. WHEN kolom kiri & kanan keduanya di tabel yang sama (same-table), THEN sistem HARUS memakai `whereColumn` (atau OR/AND-chain `whereColumn` untuk in/between).
7. WHEN kolom kanan (atau kiri) berada di relasi (cross-table), THEN sistem HARUS memakai correlated subquery (pola nested `whereHas`) dengan nama kolom terkualifikasi tabel agar referensi tabel luar valid.
8. WHEN type kolom kiri dan kanan tidak kompatibel (mis. `string` vs `number`), THEN item HARUS di-drop (tidak mengubah hasil). Kategori kompatibel: numeric↔(number/currency), string↔string, date↔(date/datetime), time↔time, boolean↔boolean.
9. Validasi save-time (`FilterTreeCleaner`) HARUS me-mirror aturan ini: `ref` ter-resolve & searchable, jumlah ref sesuai operator (single / ≥1 / tepat 2), dan type-compat — selain itu item di-drop.

---

## Requirement 3 — Operator date/datetime per mode

**User Story:** Sebagai pengguna, saya ingin membandingkan kolom tanggal dengan kolom tanggal lain memakai operator komparasi/in/between, tanpa mengubah cara filter tanggal dengan nilai (period).

### Acceptance Criteria

1. Pada **mode value**, kolom `date`/`datetime` HARUS tetap menyediakan **hanya** `in_period`/`!in_period` (period picker) — perilaku tidak berubah.
2. Pada **mode column**, kolom `date`/`datetime` HARUS menyediakan set operator penuh `= != > >= < <= in !in between !between` dan TIDAK menyediakan `in_period`/`!in_period`.
3. WHEN `in_period`/`!in_period` muncul di mode column (semua type), THEN item HARUS dianggap invalid (di-drop) — period menuntut anchor literal.
4. WHEN operator komparasi date dipakai dengan nilai **literal** di mode value, THEN item HARUS di-drop (mode value date hanya menerima period).
5. Operator date/datetime di mode column HARUS diproses lewat jalur perbandingan kolom yang sama dengan type lain (tanpa input tanggal literal baru).

---

## Requirement 4 — Konsistensi UI & validasi client

**User Story:** Sebagai pengguna, saya ingin UI filter menampilkan operator & input value yang benar sesuai mode (value/column) dan memvalidasi sebelum "Terapkan", sehingga tidak ada item yang diam-diam tidak berefek.

### Acceptance Criteria

1. WHEN pengguna men-toggle sebuah item ke mode column, THEN UI HARUS menampilkan column picker (sumber kolom sama dengan picker kolom kiri, termasuk lazy-load kolom relasi) untuk memilih `ref`.
2. WHEN mode column aktif, THEN daftar operator HARUS mengikuti aturan Requirement 2 & 3, dan operator `set`/`!set` TIDAK ditampilkan.
3. WHEN mode berpindah (value↔column) atau operator berganti jenis input, THEN value `v` HARUS direset (analog reset value saat ganti operator saat ini).
4. Column picker mode column HARUS hanya menampilkan kolom yang **type-compatible** dengan kolom kiri.
5. Validasi client (`filterValidation.js`) HARUS menolak item column-ref yang `ref`-nya kosong / jumlahnya tidak sesuai operator, dengan pesan error yang sesuai.
6. UI single ref → satu picker; `in`/`!in` → multi picker (`MultiGrow`); `between`/`!between` → dua picker (`RangePair`).

---

## Out of Scope

- Operator komparasi tanggal pada **nilai literal** di mode value (tetap period-only).
- Perbandingan antar-kolom untuk type yang tidak punya operator komparasi yang bermakna (mis. `json`, `binary`, `mixed`, `attribute` — tetap non-filterable).
- Perubahan skema penyimpanan `formStatuses` (tetap JSON array).
