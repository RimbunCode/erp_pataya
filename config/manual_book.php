<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Sumber Docs
    |--------------------------------------------------------------------------
    |
    | Root folder tempat semua file markdown sumber berada. Setiap `source`
    | pada `sections` di bawah selalu relatif terhadap folder ini. Ditulis
    | khusus untuk Manual Book (bahasa awam) — terpisah dari docs/modules dan
    | docs/tutorials yang jadi referensi teknis developer.
    |
    */
    'docs_path' => base_path('docs/manual-book'),

    /*
    |--------------------------------------------------------------------------
    | Gambar / Screenshot Manual Book
    |--------------------------------------------------------------------------
    |
    | File asli screenshot disimpan di repo pada `docs/manual-book/images/`,
    | satu subfolder per section (mis. `docs/manual-book/images/helpdesk/`) —
    | sejalan dengan file markdown sumbernya yang juga di `docs/manual-book/`.
    |
    | Folder `docs/` tidak dilayani web server. Agar gambar tetap tampil di
    | halaman manual book, buat junction/symlink lokal (sudah di-.gitignore):
    |
    |     # dari folder public/ (Windows, tanpa admin):
    |     cmd /c "mklink /J manual-book-images ..\docs\manual-book\images"
    |     # Linux/macOS:
    |     ln -s ../docs/manual-book/images manual-book-images
    |
    | Di file markdown, rujuk gambar dengan path absolut dari root situs:
    |
    |     ![Form tambah ticket](/manual-book-images/helpdesk/form-tambah-ticket.png)
    |
    | Path absolut wajib — file dilayani statis lewat junction di atas, di luar
    | route `/manual-book/{section}` (yang bersifat catch-all; path relatif
    | seperti `images/x.png` akan diperlakukan sebagai nama section dan
    | menghasilkan 404). Nama file pakai kebab-case, ekstensi `.png`.
    |
    */

    /*
    |--------------------------------------------------------------------------
    | Pola Heading yang Disembunyikan (default, berlaku untuk semua section)
    |--------------------------------------------------------------------------
    |
    | Safety net: heading level 2 (##) atau 3 (###) yang cocok salah satu pola
    | regex ini akan dihapus dari konten sebelum dirender, jaga-jaga ada
    | heading teknis (Routes, Frontend Pages) yang tidak sengaja ikut tertulis
    | di file sumber Manual Book. Regex case-insensitive, dicocokkan ke teks
    | heading utuh (setelah tanda `#` dan spasi dihapus).
    |
    */
    'default_excluded_heading_patterns' => [
        '/^Routes\b/i',
        '/^Frontend Pages$/i',
        '/^Related Documents$/i',
        '/^Daftar Isi$/i',
    ],

    /*
    |--------------------------------------------------------------------------
    | Daftar Section Manual Book
    |--------------------------------------------------------------------------
    |
    | Tiap key adalah slug yang dipakai di URL (`/manual-book/{key}`). Tiap
    | section berisi:
    | - title       : judul tampilan
    | - description : deskripsi singkat untuk kartu di halaman index
    | - icon        : nama komponen ikon dari lucide-react (dipetakan di frontend)
    | - source      : nama file markdown, relatif terhadap docs_path
    |
    */
    'sections' => [
        'sales' => [
            'title'       => 'Penjualan',
            'description' => 'Sales Order, Internal Order, Customer, dan alur penjualan end-to-end.',
            'icon'        => 'Receipt',
            'source'      => 'penjualan.md',
        ],

        'purchase' => [
            'title'       => 'Pembelian',
            'description' => 'Purchase Request, Purchase Order, Purchase Receipt, Supplier, dan alur pembelian end-to-end.',
            'icon'        => 'ShoppingBag',
            'source'      => 'pembelian.md',
        ],

        'inventory' => [
            'title'       => 'Inventory & Gudang',
            'description' => 'Item, Variant, Warehouse, Stock Entry, dan Delivery Note.',
            'icon'        => 'Package',
            'source'      => 'inventory.md',
        ],

        'finances' => [
            'title'       => 'Keuangan',
            'description' => 'Chart of Accounts, General Ledger, Invoice, Payment Entry, dan Pajak.',
            'icon'        => 'HandCoins',
            'source'      => 'keuangan.md',
        ],

        'service' => [
            'title'       => 'Layanan / Work Order',
            'description' => 'Work Order untuk layanan servis dan rental.',
            'icon'        => 'Wrench',
            'source'      => 'layanan.md',
        ],

        'aset' => [
            'title'       => 'Aset',
            'description' => 'Asset, kategori, lokasi, movement, maintenance/repair, sewa/jual, dan depresiasi.',
            'icon'        => 'Boxes',
            'source'      => 'aset.md',
        ],

        // 'crm' => [
        //     'title'       => 'CRM',
        //     'description' => 'Lead, Opportunity, dan Quotation — alur pre-sales.',
        //     'icon'        => 'Handshake',
        //     'source'      => 'crm.md',
        // ],

        'helpdesk' => [
            'title'       => 'Helpdesk / Ticket',
            'description' => 'Tiket dukungan internal dan riwayat respons.',
            'icon'        => 'TicketsIcon',
            'source'      => 'helpdesk.md',
        ],

        'retur' => [
            'title'       => 'Retur',
            'description' => 'Sales Return, Credit Note, Purchase Return, dan Debit Note.',
            'icon'        => 'Undo2',
            'source'      => 'retur.md',
        ],

        'pengaturan-umum' => [
            'title'       => 'Pengaturan Umum',
            'description' => 'Branch, Approval Scheme, Penomoran Dokumen, Print Template, Dashboard, Tags & Files, Todo, dan Notifikasi.',
            'icon'        => 'Settings2',
            'source'      => 'pengaturan-umum.md',
        ],
    ],
];
