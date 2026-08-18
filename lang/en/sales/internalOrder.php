<?php

return [
    'title'   => 'Internal Orders',
    'add'     => 'New Internal Orders',
    'branch'  => 'Customer Branch',
    'new'     => 'New Internal Order',
    'items'   => 'Items',
    'detail'  => 'Detail',
    'status'  => 'Status',
    'source'  => 'Select a Source Warehouse',
    'columns' => [
        'code'                         => 'Code',
        'source_warehouse'             => 'Source Warehouse',
        'source_warehouse.placeholder' => 'Select a Source Warehouse',
        'item'                         => 'Item',
        'item.placeholder'             => 'Select an item',
        'date'                         => 'Date',
        'description'                  => 'Description',
        'quantity'                     => 'Quantity',
        'unit'                         => 'Unit',
        'unit.placeholder'             => 'Select a unit',
        'shipped'                      => 'Shipped',
        'sent'                         => 'Sent',
        'created_at'                   => 'Created at',
        'external_note'                => 'External Note',
        'referenceable_asset_service'  => 'Asset Service (optional)',
    ],
    'actions' => [
        'create_delivery_note' => 'Create Delivery Note',
    ],
];
