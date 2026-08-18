<?php

return [
    'title'              => 'Asset Movement',
    'add'                => 'Add Movement',
    'new'                => 'New Movement',
    'delete'             => 'Delete Movement',
    'delete.description' => 'Are you sure you want to delete this movement?',
    'delete.confirm'     => 'Delete',
    'cancel'             => 'Cancel',

    'asset_must_be_active'             => 'Asset :code must be Active to be included in a movement.',
    'transfer_requires_both_locations' => 'Transfer requires both source and target location.',
    'issue_requires_target_location'   => 'Issue requires a target location.',
    'receipt_requires_source_location' => 'Receipt requires a source location.',
    'source_location_mismatch'         => 'Source location does not match the current location of asset :code.',

    'purpose' => [
        'issue'              => 'Issue',
        'receipt'            => 'Receipt',
        'transfer'           => 'Transfer',
        'transfer_and_issue' => 'Transfer and Issue',
        'rent_out'           => 'Rent Out',
        'return_from_rent'   => 'Return from Rent',
        'sell'               => 'Sell',
    ],

    'columns' => [
        'code'             => 'Code',
        'purpose'          => 'Purpose',
        'transaction_date' => 'Transaction Date',
        'branch_id'        => 'Branch',
        'status'           => 'Status',
    ],
];
