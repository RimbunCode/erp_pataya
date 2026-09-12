<?php

return [
    'title'     => 'Item Request',
    'empty'     => 'Tidak ada kebutuhan item yang shortage.',
    'selectRow' => 'Pilih baris',
    'actions'   => [
        'createPurchaseRequest' => 'Buat PR',
        'createPurchaseOrder'   => 'Buat PO',
        'moreActions'           => 'Aksi lainnya',
    ],
    'filters' => [
        'warehouse'      => 'Warehouse',
        'allWarehouses'  => 'Semua Warehouse',
        'branch'         => 'Branch',
        'allBranches'    => 'Semua Branch',
        'sourceType'     => 'Dokumen Sumber',
        'allSourceTypes' => 'Semua Dokumen Sumber',
    ],
    'columns' => [
        'item'      => 'Item',
        'source'    => 'Sumber',
        'warehouse' => 'Warehouse',
        'branch'    => 'Branch',
        'required'  => 'Dibutuhkan',
        'covered'   => 'Sudah Dicover',
        'available' => 'Tersedia',
        'shortage'  => 'Shortage',
    ],
];
