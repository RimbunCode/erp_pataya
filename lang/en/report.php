<?php

return [
    'issue' => [
        'subject'     => 'Report :report: KPI does not match the table',
        'description' => "Active filter: :filter\nKPI row count: :kpi_rows\nTable row count: :table_rows\nURL: :url",
        'no_filter'   => 'none',
    ],

    'notification' => [
        'title'   => 'Report has a problem',
        'message' => 'Ticket :ticket: the KPI of report :report does not match the table contents.',
    ],

    'filter' => [
        'item'      => 'Item',
        'warehouse' => 'Warehouse',
        'category'  => 'Category',
        'date_from' => 'Date from',
        'date_to'   => 'Date to',
        'supplier'  => 'Supplier',
        'customer'  => 'Customer',
        'status'    => 'Status',
        'pic'       => 'PIC',
        'asset'        => 'Asset',
        'service_type' => 'Service type',
    ],

    'transaction_type' => [
        'unknown'          => 'Unknown',
        'purchase_receipt' => 'Purchase Receipt',
        'delivery_note'    => 'Delivery Note',
        'stock_entry'      => 'Stock Entry',
        'purchase_invoice' => 'Purchase Invoice (value adjustment)',
    ],

    'stock_mutation' => [
        'title' => 'Stock Mutation',
        'kpi'   => [
            'total_transaction' => 'Total Transactions',
            'total_in'          => 'Total Items In',
            'total_out'         => 'Total Items Out',
        ],
    ],

    'sales' => [
        'title' => 'Sales Report',
        'chart' => 'Sales value per date',
        'kpi'   => [
            'total_transaction' => 'Total Transactions',
            'total_quantity'    => 'Total Quantity',
            'sales_value'       => 'Sales Value',
            'tax_value'         => 'Tax Value',
        ],
        'payment' => [
            'belum_ada'   => 'No invoice yet',
            'belum_lunas' => 'Unpaid',
            'lunas'       => 'Paid',
        ],
        'delivery' => [
            'belum'    => 'Not delivered',
            'sebagian' => 'Partially delivered',
            'terkirim' => 'Delivered',
        ],
    ],

    'purchase' => [
        'title' => 'Purchase Report',
        'chart' => 'Total purchases per date',
        'kpi'   => [
            'total_transaction' => 'Total Transactions',
            'total_quantity'    => 'Total Quantity',
            'purchase_value'    => 'Total Value',
            'tax_value'         => 'Tax Value',
        ],
    ],

    'sales_invoice' => [
        'title'   => 'Sales Invoice Report',
        'kpi'     => [
            'total_transaction'   => 'Transactions',
            'total_item'          => 'Items',
            'total_amount'        => 'Total Invoice',
            'tax_value'           => 'VAT Value',
            'outstanding_amount'  => 'Outstanding Receivable',
        ],
        'payment' => [
            'lunas'    => 'Paid',
            'sebagian' => 'Partially paid',
            'belum'    => 'Unpaid',
        ],
    ],

    'purchase_invoice' => [
        'title' => 'Purchase Invoice Report',
        'kpi'   => [
            'total_transaction'  => 'Transactions',
            'total_item'         => 'Items',
            'dpp_value'          => 'DPP Value',
            'tax_value'          => 'VAT Value',
            'outstanding_amount' => 'Outstanding Payable',
        ],
        'payment' => [
            'lunas'    => 'Paid',
            'sebagian' => 'Partially paid',
            'belum'    => 'Unpaid',
        ],
    ],

    'work_order' => [
        'title'    => 'Work Order Monitoring',
        'progress' => [
            'berjalan' => 'Running',
            'selesai'  => 'Finished',
        ],
        'kpi' => [
            'total'    => 'Total Jobs',
            'finished' => 'Finished Jobs',
            'running'  => 'Running Jobs',
            'avg_days' => 'Average Duration (days)',
        ],
    ],

    'sparepart_usage' => [
        'title' => 'Sparepart Usage Report',
        'kpi'   => [
            'total_item'     => 'Total Item Types',
            'total_quantity' => 'Total Quantity',
            'total_value'    => 'Total Sparepart Value',
        ],
    ],

    'team_activity' => [
        'title' => 'Team Member Report',
        'kpi'   => [
            'total_activity' => 'Total Activities',
            'total_pic'      => 'PICs Involved',
            'total_work'     => 'Jobs Touched',
        ],
    ],

    'team' => [
        'no_pic' => 'No PIC',
    ],

    'group' => 'Reports',

    'export' => [
        'generated_at' => 'Generated at',
        'filter'       => 'Filter',
    ],

    'columns' => [
        'code'                => 'Number',
        'item_code'           => 'Item Code',
        'item_name'           => 'Item Name',
        'warehouse'           => 'Warehouse',
        'unit'                => 'Unit',
        'quantity'            => 'Quantity',
        'unit_price'          => 'Unit Price',
        'stock_value'         => 'Stock Value',
        'transaction_date'    => 'Date',
        'transaction_type'    => 'Transaction Type',
        'quantity_change'     => 'Quantity Change',
        'quantity_after'      => 'Quantity After',
        'customer'            => 'Customer',
        'supplier'            => 'Supplier',
        'sales_value'         => 'Sales Value',
        'purchase_value'      => 'Total Value',
        'tax_value'           => 'Tax',
        'invoice_code'        => 'Invoice',
        'payment'             => 'Payment Status',
        'delivery'            => 'Delivery Status',
        'supplier_invoice'    => 'Supplier Invoice No.',
        'dpp'                 => 'DPP',
        'discount'            => 'Discount',
        'total_amount'        => 'Total Invoice',
        'paid_total'          => 'Total Paid',
        'last_payment_date'   => 'Last Payment Date',
        'outstanding'         => 'Outstanding',
        'note'                => 'Note',
        'sales_order_code'    => 'Related SO',
        'purchase_order_code' => 'Related PO',
        'asset'               => 'Asset',
        'service_type'        => 'Service Type',
        'progress'            => 'Progress',
        'start_date'          => 'Start Date',
        'completion_date'     => 'Completion Date',
        'duration'            => 'Duration (days)',
        'total_value'         => 'Total Value',
        'pic'                 => 'PIC',
        'status'              => 'Status',
        'description'         => 'Description',
    ],

    'stock_balance' => [
        'title' => 'Stock Balance',
        'kpi'   => [
            'total_item'  => 'Total Items On Hand',
            'total_value' => 'Total Stock Value',
        ],
    ],
];
