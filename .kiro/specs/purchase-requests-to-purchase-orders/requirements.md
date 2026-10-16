# Requirements: Multiple Purchase Requests to Purchase Orders

## Tujuan dan batasan

Pengguna memilih satu atau beberapa Purchase Request (PR) dari `DataTable2`, mengalokasikan item PR ke supplier, melengkapi field Purchase Order (PO), dan menyimpan satu atau beberapa PO sebagai draft dalam satu operasi. Satu PO dapat memuat item dari beberapa PR; satu item PR dapat menjadi beberapa baris PO bila kuantitasnya dibagi. Tiap baris PO mempertahankan referensi ke satu item PR asal.

Alur pengguna: **Alokasi → Lengkapi PO → Tinjau → Simpan semua draft**. Tahap Lengkapi PO memakai layout workspace dari wireframe opsi 1: daftar rancangan di kiri, form PO terpilih dan baris item di kanan. Referensi visual bersifat panduan susunan, sedangkan komponen mengikuti standar aplikasi.

Fitur ini memakai fondasi `datatable2-row-actions` serta alur pembuatan, submit, approval, dan penelusuran referensi PO yang ada. Tidak mengubah aturan approval PR/PO.

## Istilah

- **PR layak**: PR yang telah disubmit, berstatus valid untuk dipesankan, dapat diakses pengguna pada cabang aktif, dan memiliki setidaknya satu item dengan `unordered_quantity > 0`.
- **Item sumber**: `PurchaseRequestItem` yang berasal dari PR terpilih.
- **Alokasi**: satu baris calon PO dengan item sumber, kuantitas dalam satuan PO yang dipilih, dan supplier. Satu item sumber dapat memiliki beberapa alokasi dengan satuan berbeda.
- **Rancangan PO**: kumpulan alokasi ke satu dokumen PO, berikut field header, harga, pajak, gudang, catatan, diskon, dan jadwal pembayaran dokumen itu.
- **Selisih kuantitas**: total alokasi satu item sumber setelah dikonversi ke satuan PR dikurangi sisa kebutuhannya saat terakhir diverifikasi.

## Kebutuhan fungsional

### R1. Pemicu dari DataTable2

1. Halaman index PR menampilkan aksi **Buat PO** pada menu `⋯` satu baris dan toolbar seleksi banyak baris. Keduanya membuka alur yang sama.
2. Aksi hanya tampil bagi pengguna yang memiliki izin membuat PO dan dapat melihat PR terkait. Kelayakan per baris berasal dari atribut model `canCreatePo` yang selalu tersedia lewat `rowActionAttributes`/`dependsOn`, termasuk saat kolom PR disembunyikan serta tampilan mobile/grup.
3. Seleksi campuran mengikuti kontrak DataTable2: aksi hanya membawa ID baris yang layak dan menjelaskan jumlah baris yang dilewati. Bila tidak ada yang layak, alur tidak dibuka.
4. Seleksi DataTable2 tidak lintas halaman dan reset saat datanya berubah. Setelah membuka workspace, daftar PR sumber disimpan di konteks alur tersendiri sehingga navigasi langkah tidak bergantung pada seleksi tabel.
5. Aksi mengirim **ID PR saja** ke backend. Data, status, item, dan jumlah kebutuhan diambil ulang dari server.

### R2. Kelayakan dan keamanan sumber

1. Kriteria status mengikuti tindakan **Buat PO** yang sekarang ada di halaman detail PR: `submitted_at` terisi, `isValidStatus(status)` setara dengan pengecualian draft/canceled/rejected/deleted/closed/need_approval/inactive, dan terdapat item dengan `unordered_quantity > 0`. Logika bersama harus dipakai frontend metadata dan backend agar tidak menyimpang.
2. Pada permulaan alur dan sebelum simpan, backend memeriksa izin baca/seleksi PR, izin membuat PO, aturan `onlyCreator` yang berlaku, cabang aktif, soft delete, status PR, kepemilikan item, dan integritas referensi. Jangan mengandalkan `enabled(row)` sebagai otorisasi.
3. Jika satu PR yang sudah masuk alur menjadi tidak layak atau tidak dapat diakses, tampilkan nama/kode PR dan sebabnya. Pengguna dapat memuat ulang sumber atau mengeluarkan PR itu; penyimpanan ditolak sampai sumber terselesaikan. Tidak ada penghapusan sumber secara diam-diam saat simpan.
4. Item PR yang sisa kebutuhannya nol tidak masuk alokasi default, tetapi tetap dapat ditunjukkan sebagai informasi sumber bila relevan. PR tanpa item layak tidak dapat memulai alur.

### R3. Tahap Alokasi

1. Tampilkan setiap item sumber sebagai baris terpisah walau produk sama, dengan kode PR, produk/deskripsi, satuan PR, tanggal kebutuhan, sisa kebutuhan, kuantitas dialokasikan, satuan PO yang dapat dipilih, dan supplier. Jangan menggabungkan identitas item sumber.
2. Alokasi awal per item sumber berkuantitas `unordered_quantity` dalam satuan PR saat alur dibuka, dengan supplier belum dipilih. Pengguna dapat memilih supplier, mengubah kuantitas dan satuan PO per alokasi, menambah alokasi untuk supplier lain, menghapus alokasi, atau tidak membeli item tertentu saat ini. Pilihan satuan dibatasi pada `ItemUnit` aktif milik produk yang sama; perubahan satuan mempertahankan angka qty yang diketik dan langsung menghitung ulang ekuivalennya dalam satuan PR.
3. Setiap alokasi aktif harus memiliki supplier dan kuantitas positif yang memenuhi validasi dasar PO. Setidaknya ada satu alokasi aktif untuk melanjutkan.
4. Total alokasi dihitung per **ID item PR** melintasi semua supplier/rancangan PO setelah setiap qty dikonversi dari satuan PO yang dipilih ke satuan PR. Bila total kurang atau lebih dari `unordered_quantity` saat ini, tampilkan warning informatif **di kartu/baris item PR terkait**, bukan banner global, dengan total ekuivalen, sisa kebutuhan, dan selisih dalam satuan PR. Contoh: PR 10 pcs, PO 1 box = 12 pcs → lebih 2 pcs. Warning ini **bukan penghalang** untuk melanjutkan atau menyimpan; selisih nol tidak ditampilkan.
5. Catatan setiap PR (`external_note`) ditampilkan utuh dalam panel yang bisa dilipat, berlabel kode PR dan tautan ke PR. Catatan kosong ditandai secara ringkas. Teks panjang dibungkus, tetap dapat dibaca, dan tidak disalin otomatis ke `external_note` PO.

### R4. Tahap Lengkapi PO

1. Default satu rancangan PO per supplier yang digunakan. Supplier yang sama dapat memiliki beberapa rancangan melalui **Pisahkan PO**; pengguna memilih alokasi yang dipindah. Rancangan kosong dibuang sebelum simpan.
2. Layout desktop: sidebar daftar rancangan PO dengan supplier dan jumlah item; panel utama untuk satu rancangan menampilkan field PO lengkap, `FormTable` baris item dengan PR asal dan aksi custom **Pindah**/**Bagi qty**/**Pisahkan PO**, panel catatan PR terkait, serta warning pada masing-masing item yang berselisih. Baris sumber pada `FormTable` tidak dapat ditambah, diurut ulang, atau dihapus lewat aksi bawaan, tetapi field PO yang diperbolehkan tetap dapat diedit. Header workspace dan sidebar rancangan tidak bergeser ketika isi form digulir; footer aksi langkah menempel pada dasar viewport dan berada di luar area scroll. Pada layar sempit, daftar rancangan menjadi pemilih/dropdown atau panel yang dapat dibuka tanpa kehilangan isian; footer tetap dapat dijangkau tanpa menutup field.
   Aksi custom setiap baris pada langkah Lengkapi PO ditampilkan melalui satu tombol ikon `⋯` yang membuka dropdown **Edit**, **Bagi qty**, **Pisahkan PO**, dan submenu **Pindah** berisi rancangan PO tujuan yang tersedia. Menu dapat diakses dengan keyboard dan pada mobile; FormTable umum serta form PO tunggal tidak berubah.
3. **Pindah** mengubah rancangan tujuan sebuah alokasi. **Bagi qty** menghasilkan baris baru dengan referensi dan satuan PO yang sama serta kuantitas terpisah. Bila tujuan memiliki supplier lain, nilai supplier alokasi mengikuti rancangan tujuan. Aksi tidak boleh diam-diam mengubah total alokasi item sumber setelah konversi.
4. Setiap rancangan menggunakan seluruh field dan aturan validasi PO existing: tanggal PO, tanggal kebutuhan, supplier, mata uang/kurs, gudang tujuan per item, kuantitas, satuan PO, harga, pajak, diskon, jadwal pembayaran, dan catatan PO. Field PO lain tetap dapat diedit; identitas sumber dan varian item dikunci. Satuan PO boleh berbeda dari satuan PR dan dapat diubah di Lengkapi PO; pilihan ini tersinkron dengan alokasi dan warning. Harga tetap dinyatakan per satuan PO yang dipilih, tanpa perubahan otomatis saat satuan berganti.
5. Nilai form disimpan per ID rancangan saat pengguna berpindah rancangan atau langkah. Kembali ke Alokasi mempertahankan field yang tidak terpengaruh. Bila perubahan supplier/alokasi menyebabkan perpindahan, penggabungan, atau penghapusan rancangan yang telah diisi, UI menjelaskan dampak dan meminta konfirmasi sebelum merombak data.
6. Catatan PR pada panel rancangan menampilkan hanya PR yang itemnya ada di rancangan terpilih, tanpa duplikasi PR.
7. Bila supplier pada header rancangan diganti, semua alokasi rancangan mengikuti supplier baru setelah konfirmasi yang menjelaskan dampaknya. Rancangan supplier sama yang lain tidak otomatis digabung. Total, pajak/diskon, dan jadwal pembayaran yang bergantung nilai baris dihitung ulang saat baris dipindah, dibagi, atau diubah.

### R5. Tinjau dan simpan

1. Tinjau menampilkan jumlah PO, supplier tiap PO, kode PR sumber, baris/kuantitas beserta satuan PO, mata uang dan total nominal per PO, serta warning selisih di bawah item PR terkait dalam satuan PR. Jangan menjumlahkan nominal lintas mata uang menjadi satu angka tanpa konversi.
2. Tombol **Simpan semua draft** hanya aktif jika setiap rancangan memenuhi validasi PO existing dan alokasi aktif telah ditempatkan. Selisih kuantitas tidak menonaktifkan tombol.
3. Satu permintaan membuat semua PO secara atomik: jika validasi atau pembuatan salah satu PO gagal, semua perubahan database operasi ini di-rollback. Setiap PO berstatus draft; submit/approval tetap melalui proses existing.
4. Setiap baris PO hasil menyimpan `referenceable_type = PurchaseRequestItem::class` dan `referenceable_id` item sumber yang tepat. Beberapa baris PO boleh menunjuk item sumber sama; jangan merusak referensi karena penggabungan produk.
5. Backend memvalidasi ulang PR dan item sumber, permission, cabang aktif, kesesuaian item, satuan PO milik produk yang sama dengan faktor konversi positif, dan field wajib PO di dalam operasi simpan. Nilai referensi, item, faktor konversi, dan kepemilikan PR tidak dapat disuntikkan dari klien. Kuantitas yang berbeda dari sisa kebutuhan tetap diterima selama lolos aturan dasar PO. Saat approval PO, `ordered_quantity` pada koneksi item PR dihitung dalam satuan PR dari faktor konversi tersimpan di PO dan PR; beberapa baris tetap dijumlahkan dengan benar. PO draft belum menaikkan `ordered_quantity`.
6. Klik ganda atau retry permintaan yang sama tidak menghasilkan PO duplikat. Selama request berjalan, tombol simpan dinonaktifkan. Kegagalan menampilkan error per rancangan/baris dan mempertahankan semua isian untuk koreksi.
7. Sesudah berhasil, tampilkan daftar semua PO draft yang dibuat, kode/tautan tiap PO, supplier, dan jumlah item. Seleksi tabel boleh dibersihkan setelah sukses. Navigasi ulang tidak mengulang penyimpanan.

## Kriteria nonfungsional dan pengujian

1. Gunakan komponen form, tabel, alert, dialog, select, dan responsivitas yang sudah umum di project. Label, state kosong/loading/error, dan teks Indonesia/Inggris mengikuti sistem terjemahan.
2. Fetch item dan catatan dilakukan sekali pada saat membuka alur, bukan lewat kolom DataTable2 yang kebetulan terlihat. Hindari query N+1 saat memuat PR/item/relasi/supplier.
3. Validasi dan penyimpanan mencakup tes FE untuk single/bulk action, alokasi, split/pindah, pergantian satuan, warning per item setelah konversi, preservasi isian, `FormTable`, footer/header/sidebar tetap, review, dan responsivitas; tes BE untuk izin/scope, sumber berubah, referensi palsu, satuan produk lain/faktor tidak valid, konversi approval, qty kurang/lebih, multi supplier, rollback, draft, dan idempotensi.
4. Verifikasi browser mencakup desktop dan mobile dari seleksi PR sampai hasil draft, menggunakan kredensial development `admin/admin` tanpa mengubah kredensial database. Untuk FE build gunakan `npm run build`, bukan dev server Vite.

## Di luar cakupan

- Mengubah workflow submit/approval, status, atau kalkulasi `ordered_quantity` PR saat PO masih draft.
- Menggabungkan beberapa item PR menjadi satu baris PO tanpa atribusi sumber.
- Mengubah field PR atau otomatis menyalin catatan PR ke catatan PO.
- Mengirim PO, menerima barang, atau membuat invoice secara otomatis.
