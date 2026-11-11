<?php

return [
    'title'              => 'Journal Vouchers',
    'add'                => 'Add Journal Voucher',
    'new'                => 'New Journal Voucher',
    'detail'             => 'Journal Voucher Detail',
    'items'              => 'Journal Lines',
    'delete'             => 'Delete Journal Voucher',
    'delete.description' => 'Are you sure you want to delete this Journal Voucher?',
    'delete.confirm'     => 'Delete',
    'cancel'             => 'Cancel',
    'columns'            => [
        'code'                => 'Code',
        'date'                => 'Date',
        'description'         => 'Description',
        'status'              => 'Status',
        'items'               => 'Lines',
        'account'             => 'Account',
        'account.placeholder' => 'Select account',
        'item_description'    => 'Line Note',
        'debit'               => 'Debit',
        'credit'              => 'Credit',
    ],
    'balance' => [
        'balanced'   => 'Balanced',
        'unbalanced' => 'Not balanced: difference :difference',
        'too_few'    => 'At least 2 lines are required',
    ],
    'errors' => [
        'update_not_draft' => 'A Journal Voucher that has been submitted cannot be changed.',
        'submit_not_draft' => 'A Journal Voucher that has been submitted cannot be submitted again.',
    ],
];
