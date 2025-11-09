<?php

return [
  'title'   => 'Sales Returns',
  'add'     => 'New Sales Returns',
  'new'     => 'New Sales Return',
  'items'   => 'Items',
  'detail'  => "Detail",
  'status'  => 'Status',
  'source'  => 'Source Warehouse',
  'target'  => 'Target Warehouse',
  'columns' => [
    'code'                         => 'Code',
    'sales_order'                  => 'Sales Order',
    'sales_order.placeholder'      => 'Select a Sales Order',
    'delivery_note'                => 'Delivery Note',
    'delivery_note.placeholder'    => 'Select a Delivery Note',
    'type'                         => 'Type',
    'type.placeholder'             => 'Select a type',
    'type.options'                 => [
      'return'  => 'Return',
      'replace' => 'Replace',
    ],
    'item'                         => 'Item',
    'item.placeholder'             => 'Select an item',
    'return_date'                  => 'Return Date',
    'description'                  => 'Description',
    'source_warehouse'             => 'Source Warehouse',
    'source_warehouse.placeholder' => 'Select a Source Warehouse',
    'target_warehouse'             => 'Target Warehouse',
    'target_warehouse.placeholder' => 'Select a Target Warehouse',
    'quantity'                     => 'Quantity',
    'unit'                         => 'Unit',
    'created_at'                   => 'Created at',
    'external_note'                => 'External Note',
  ],

];
