<?php

return [
    'issue' => [
        'subject'     => 'Laporan :report: KPI tidak cocok dengan tabel',
        'description' => "Filter aktif: :filter\nJumlah baris KPI: :kpi_rows\nJumlah baris tabel: :table_rows\nURL: :url",
        'no_filter'   => 'tidak ada',
    ],

    'notification' => [
        'title'   => 'Laporan bermasalah',
        'message' => 'Ticket :ticket: KPI laporan :report tidak cocok dengan isi tabel.',
    ],

    'filter' => [
        'item'         => 'Item',
        'warehouse'    => 'Gudang',
        'category'     => 'Kategori',
        'date_from'    => 'Tanggal dari',
        'date_to'      => 'Tanggal sampai',
        'supplier'     => 'Supplier',
        'customer'     => 'Pelanggan',
        'status'       => 'Status',
        'pic'          => 'PIC',
        'asset'        => 'Aset',
        'service_type' => 'Jenis servis',
    ],

    'transaction_type' => [
        'unknown'          => 'Tidak diketahui',
        'purchase_receipt' => 'Penerimaan Pembelian',
        'delivery_note'    => 'Delivery Note',
        'stock_entry'      => 'Stock Entry',
        'purchase_invoice' => 'Invoice Pembelian (penyesuaian nilai)',
    ],

    'stock_mutation' => [
        'title' => 'Mutasi Stock',
        'kpi'   => [
            'total_transaction' => 'Total Transaksi',
            'total_in'          => 'Total Item Masuk',
            'total_out'         => 'Total Item Keluar',
        ],
    ],

    'sales' => [
        'title' => 'Laporan Penjualan',
        'chart' => 'Nilai penjualan per tanggal',
        'kpi'   => [
            'total_transaction' => 'Total Transaksi',
            'total_quantity'    => 'Total Kuantitas',
            'sales_value'       => 'Nilai Penjualan',
            'tax_value'         => 'Nilai Pajak',
        ],
        'payment' => [
            'belum_ada'   => 'Belum ada invoice',
            'belum_lunas' => 'Belum lunas',
            'lunas'       => 'Lunas',
        ],
        'delivery' => [
            'belum'    => 'Belum dikirim',
            'sebagian' => 'Terkirim sebagian',
            'terkirim' => 'Terkirim',
        ],
    ],

    'purchase' => [
        'title' => 'Laporan Pembelian',
        'chart' => 'Total pembelian per tanggal',
        'kpi'   => [
            'total_transaction' => 'Total Transaksi',
            'total_quantity'    => 'Total Kuantitas',
            'purchase_value'    => 'Total Nilai',
            'tax_value'         => 'Nilai Pajak',
        ],
    ],

    'sales_invoice' => [
        'title' => 'Laporan Invoice Penjualan',
        'kpi'   => [
            'total_transaction'  => 'Jumlah Transaksi',
            'total_item'         => 'Jumlah Item',
            'total_amount'       => 'Total Invoice',
            'tax_value'          => 'Nilai PPN',
            'outstanding_amount' => 'Sisa Piutang',
        ],
        'payment' => [
            'lunas'    => 'Lunas',
            'sebagian' => 'Sebagian',
            'belum'    => 'Belum dibayar',
        ],
    ],

    'purchase_invoice' => [
        'title' => 'Laporan Invoice Pembelian',
        'kpi'   => [
            'total_transaction'  => 'Jumlah Transaksi',
            'total_item'         => 'Jumlah Item',
            'dpp_value'          => 'Nilai DPP',
            'tax_value'          => 'Nilai PPN',
            'outstanding_amount' => 'Sisa Hutang',
        ],
        'payment' => [
            'lunas'    => 'Lunas',
            'sebagian' => 'Sebagian',
            'belum'    => 'Belum dibayar',
        ],
    ],

    'work_order' => [
        'title'    => 'Monitoring Work Order',
        'progress' => [
            'berjalan' => 'Berjalan',
            'selesai'  => 'Selesai',
        ],
        'kpi' => [
            'total'    => 'Total Pekerjaan',
            'finished' => 'Pekerjaan Selesai',
            'running'  => 'Pekerjaan Berjalan',
            'avg_days' => 'Rata-rata Lama Pengerjaan (hari)',
        ],
    ],

    'sparepart_usage' => [
        'title' => 'Laporan Pemakaian Sparepart',
        'kpi'   => [
            'total_item'     => 'Total Jenis Item',
            'total_quantity' => 'Total Kuantitas',
            'total_value'    => 'Total Nilai Sparepart',
        ],
    ],

    'team_activity' => [
        'title' => 'Laporan Anggota Tim',
        'kpi'   => [
            'total_activity' => 'Total Aktivitas',
            'total_pic'      => 'Jumlah PIC Terlibat',
            'total_work'     => 'Pekerjaan Tersentuh',
        ],
    ],

    'team' => [
        'no_pic' => 'Tanpa PIC',
    ],

    'group' => 'Laporan',

    'export' => [
        'generated_at' => 'Dibuat pada',
        'filter'       => 'Filter',
    ],

    'columns' => [
        'code'                => 'Nomor',
        'item_code'           => 'Kode Item',
        'item_name'           => 'Nama Item',
        'warehouse'           => 'Gudang',
        'unit'                => 'Satuan',
        'quantity'            => 'Kuantitas',
        'unit_price'          => 'Harga Satuan',
        'stock_value'         => 'Nilai Persediaan',
        'transaction_date'    => 'Tanggal',
        'transaction_type'    => 'Jenis Transaksi',
        'quantity_change'     => 'Perubahan Kuantitas',
        'quantity_after'      => 'Kuantitas Setelah',
        'customer'            => 'Pelanggan',
        'supplier'            => 'Supplier',
        'sales_value'         => 'Nilai Penjualan',
        'purchase_value'      => 'Total Nilai',
        'tax_value'           => 'Pajak',
        'invoice_code'        => 'Invoice',
        'payment'             => 'Status Pembayaran',
        'delivery'            => 'Status Pengiriman',
        'supplier_invoice'    => 'No. Invoice Supplier',
        'dpp'                 => 'DPP',
        'discount'            => 'Diskon',
        'total_amount'        => 'Total Invoice',
        'paid_total'          => 'Total Pelunasan',
        'last_payment_date'   => 'Tanggal Pelunasan Terakhir',
        'outstanding'         => 'Sisa',
        'note'                => 'Keterangan',
        'sales_order_code'    => 'SO Terkait',
        'purchase_order_code' => 'PO Terkait',
        'asset'               => 'Aset',
        'service_type'        => 'Jenis Servis',
        'progress'            => 'Status Pengerjaan',
        'start_date'          => 'Tanggal Mulai',
        'completion_date'     => 'Tanggal Selesai',
        'duration'            => 'Lama Pengerjaan (hari)',
        'total_value'         => 'Nilai Total',
        'pic'                 => 'PIC',
        'status'              => 'Status',
        'description'         => 'Keterangan',
    ],

    'stock_balance' => [
        'title' => 'Stok Persediaan',
        'kpi'   => [
            'total_item'  => 'Total Item Dipegang',
            'total_value' => 'Total Nilai Persediaan',
        ],
    ],
];
