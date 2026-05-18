<?php

return [
    'title'   => 'Internal Orders',
    'add'     => 'Tambah Internal Order Baru',
    'branch'  => 'Cabang Pelanggan',
    'new'     => 'Internal Order Baru',
    'items'   => 'Item',
    'detail'  => 'Detail',
    'status'  => 'Status',
    'source'  => 'Pilih Gudang Asal',
    'columns' => [
        'code'                         => 'Kode',
        'source_warehouse'             => 'Gudang Asal',
        'source_warehouse.placeholder' => 'Pilih Gudang Asal',
        'item'                         => 'Item',
        'item.placeholder'             => 'Pilih item',
        'date'                         => 'Tanggal',
        'description'                  => 'Deskripsi',
        'quantity'                     => 'Kuantitas',
        'unit'                         => 'Unit',
        'unit.placeholder'             => 'Pilih unit',
        'shipped'                      => 'Dikirim',
        'sent'                         => 'Terikirim',
        'created_at'                   => 'Dibuat pada',
        'external_note'                => 'Catatan Eksternal',
    ],
    'actions' => [
        'create_delivery_note' => 'Buat Delivery Note',
    ],
];
