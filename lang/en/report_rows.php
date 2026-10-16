<?php

// Report table titles and column labels. DataTable2 reads `{translateKey}.title` and
// `{translateKey}.columns.{column}`, so each report row model points to a group here.
return [
    'stock_balance' => [
        'title'   => 'Stock Balance',
        'columns' => [
            'item_code'      => 'Item Code',
            'item_name'      => 'Item Name',
            'warehouse_name' => 'Warehouse',
            'unit_name'      => 'Unit',
            'quantity'       => 'Quantity On Hand',
            'valuation_rate' => 'Average Cost',
            'stock_value'    => 'Stock Value',
        ],
    ],

    'stock_mutation' => [
        'title'   => 'Stock Mutation',
        'columns' => [
            'transaction_date'           => 'Transaction Date',
            'item_code'                  => 'Item Code',
            'item_name'                  => 'Item Name',
            'warehouse_name'             => 'Warehouse',
            'transaction_type'           => 'Transaction Type',
            'quantity_change'            => 'Quantity Change',
            'quantity_after_transaction' => 'Quantity After Transaction',
        ],
    ],

    'sales' => [
        'title'   => 'Sales Report',
        'columns' => [
            'code'             => 'SO Number',
            'transaction_date' => 'Date',
            'customer_name'    => 'Customer',
            'total_quantity'   => 'Total Quantity',
            'sales_value'      => 'Sales Value',
            'tax_value'        => 'Tax',
            'invoice_code'     => 'Invoice',
            'payment_label'    => 'Payment Status',
            'delivery_label'   => 'Delivery Status',
        ],
    ],

    'purchase' => [
        'title'   => 'Purchase Report',
        'columns' => [
            'code'             => 'PO Number',
            'transaction_date' => 'Date',
            'supplier_name'    => 'Supplier',
            'total_quantity'   => 'Total Quantity',
            'purchase_value'   => 'Total Value',
            'tax_value'        => 'Tax',
        ],
    ],

    'sales_invoice' => [
        'title'   => 'Sales Invoice Report',
        'columns' => [
            'code'               => 'Invoice Number',
            'transaction_date'   => 'Invoice Date',
            'customer_name'      => 'Customer',
            'sales_order_code'   => 'Related SO',
            'dpp_value'          => 'DPP',
            'tax_value'          => 'VAT',
            'total_amount'       => 'Total Invoice',
            'paid_total'         => 'Total Paid',
            'last_payment_date'  => 'Last Payment Date',
            'outstanding_amount' => 'Outstanding Receivable',
            'payment_label'      => 'Payment Status',
        ],
    ],

    'purchase_invoice' => [
        'title'   => 'Purchase Invoice Report',
        'columns' => [
            'supplier_invoice'    => 'Supplier Invoice No.',
            'transaction_date'    => 'Invoice Date',
            'supplier_name'       => 'Supplier',
            'purchase_order_code' => 'Related PO',
            'dpp_value'           => 'DPP',
            'discount_value'      => 'Discount',
            'tax_value'           => 'VAT',
            'total_amount'        => 'Total Invoice',
            'paid_total'          => 'Total Paid',
            'last_payment_date'   => 'Last Payment Date',
            'outstanding_amount'  => 'Outstanding Payable',
            'external_note'       => 'Note',
            'payment_label'       => 'Payment Status',
        ],
    ],

    'work_order' => [
        'title'   => 'Work Order Monitoring',
        'columns' => [
            'code'             => 'Code',
            'asset_name'       => 'Asset',
            'service_type'     => 'Type',
            'progress_label'   => 'Status',
            'transaction_date' => 'Damage Date',
            'start_date'       => 'Start Date',
            'completion_date'  => 'Completion Date',
            'duration_days'    => 'Duration (days)',
        ],
    ],

    'sparepart_usage' => [
        'title'   => 'Sparepart Usage Report',
        'columns' => [
            'transaction_date' => 'Date',
            'code'             => 'Job Code',
            'asset_name'       => 'Asset',
            'item_code'        => 'Item Code',
            'item_name'        => 'Item Name',
            'quantity'         => 'Quantity',
            'unit_name'        => 'Unit',
            'unit_price'       => 'Unit Price',
            'total_value'      => 'Total Value',
        ],
    ],

    'team_activity' => [
        'title'   => 'Team Member Report',
        'columns' => [
            'transaction_date' => 'Activity Date',
            'pic_label'        => 'PIC',
            'code'             => 'Job Code',
            'asset_name'       => 'Asset',
            'activity_status'  => 'Status',
            'description'      => 'Description',
        ],
    ],
];
