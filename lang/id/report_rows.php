<?php

// Judul dan label kolom tabel setiap laporan. DataTable2 membaca `{translateKey}.title` dan
// `{translateKey}.columns.{kolom}`, jadi tiap model baris laporan menunjuk ke grup di sini.
return [
    'stock_balance' => [
        'title'   => 'Stok Persediaan',
        'columns' => [
            'item_code'      => 'Kode Item',
            'item_name'      => 'Nama Item',
            'warehouse_name' => 'Gudang',
            'unit_name'      => 'Satuan',
            'quantity'       => 'Stok Tersedia',
            'valuation_rate' => 'Harga Beli Rata-rata',
            'stock_value'    => 'Nilai Persediaan',
        ],
    ],

    'stock_mutation' => [
        'title'   => 'Mutasi Stock',
        'columns' => [
            'transaction_date'           => 'Tanggal Transaksi',
            'item_code'                  => 'Kode Item',
            'item_name'                  => 'Nama Item',
            'warehouse_name'             => 'Gudang',
            'transaction_type'           => 'Jenis Transaksi',
            'quantity_change'            => 'Perubahan Kuantitas',
            'quantity_after_transaction' => 'Kuantitas Setelah Transaksi',
        ],
    ],

    'sales' => [
        'title'   => 'Laporan Penjualan',
        'columns' => [
            'code'             => 'Nomor SO',
            'transaction_date' => 'Tanggal',
            'customer_name'    => 'Pelanggan',
            'total_quantity'   => 'Total Kuantitas',
            'sales_value'      => 'Nilai Penjualan',
            'tax_value'        => 'Pajak',
            'invoice_code'     => 'Invoice',
            'payment_label'    => 'Status Pembayaran',
            'delivery_label'   => 'Status Pengiriman',
        ],
    ],

    'purchase' => [
        'title'   => 'Laporan Pembelian',
        'columns' => [
            'code'             => 'Nomor PO',
            'transaction_date' => 'Tanggal',
            'supplier_name'    => 'Supplier',
            'total_quantity'   => 'Total Kuantitas',
            'purchase_value'   => 'Total Nilai',
            'tax_value'        => 'Pajak',
        ],
    ],

    'sales_invoice' => [
        'title'   => 'Laporan Invoice Penjualan',
        'columns' => [
            'code'               => 'Nomor Invoice',
            'transaction_date'   => 'Tanggal Invoice',
            'customer_name'      => 'Pelanggan',
            'sales_order_code'   => 'SO Terkait',
            'dpp_value'          => 'DPP',
            'tax_value'          => 'PPN',
            'total_amount'       => 'Total Invoice',
            'paid_total'         => 'Total Pelunasan',
            'last_payment_date'  => 'Tanggal Pelunasan Terakhir',
            'outstanding_amount' => 'Sisa Piutang',
            'payment_label'      => 'Status Pembayaran',
        ],
    ],

    'purchase_invoice' => [
        'title'   => 'Laporan Invoice Pembelian',
        'columns' => [
            'supplier_invoice'    => 'No. Invoice Supplier',
            'transaction_date'    => 'Tanggal Invoice',
            'supplier_name'       => 'Supplier',
            'purchase_order_code' => 'PO Terkait',
            'dpp_value'           => 'DPP',
            'discount_value'      => 'Diskon',
            'tax_value'           => 'PPN',
            'total_amount'        => 'Total Invoice',
            'paid_total'          => 'Total Pelunasan',
            'last_payment_date'   => 'Tanggal Pelunasan Terakhir',
            'outstanding_amount'  => 'Sisa Hutang',
            'external_note'       => 'Keterangan',
            'payment_label'       => 'Status Pembayaran',
        ],
    ],

    'work_order' => [
        'title'   => 'Monitoring Work Order',
        'columns' => [
            'code'             => 'Kode',
            'asset_name'       => 'Aset',
            'service_type'     => 'Jenis',
            'progress_label'   => 'Status',
            'transaction_date' => 'Tanggal Kerusakan',
            'start_date'       => 'Tanggal Mulai',
            'completion_date'  => 'Tanggal Selesai',
            'duration_days'    => 'Lama Pengerjaan (hari)',
        ],
    ],

    'sparepart_usage' => [
        'title'   => 'Laporan Pemakaian Sparepart',
        'columns' => [
            'transaction_date' => 'Tanggal',
            'code'             => 'Kode Pekerjaan',
            'asset_name'       => 'Aset',
            'item_code'        => 'Kode Item',
            'item_name'        => 'Nama Item',
            'quantity'         => 'Kuantitas',
            'unit_name'        => 'Satuan',
            'unit_price'       => 'Harga Satuan',
            'total_value'      => 'Nilai Total',
        ],
    ],

    'team_activity' => [
        'title'   => 'Laporan Anggota Tim',
        'columns' => [
            'transaction_date' => 'Tanggal Aktivitas',
            'pic_label'        => 'PIC',
            'code'             => 'Kode Pekerjaan',
            'asset_name'       => 'Aset',
            'activity_status'  => 'Status',
            'description'      => 'Keterangan',
        ],
    ],
];
