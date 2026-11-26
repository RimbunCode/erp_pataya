<?php

return [
    'title'            => 'GL Posting Status',
    'name'             => 'GL Posting Status',
    'retry'            => 'Retry',
    'zero_total_retry' => 'The posting value of this receipt is 0, so no journal can be created. Check the receipt line values and the stock valuation first.',

    'columns' => [
        'referenceable_type' => 'Document Type',
        'referenceable'      => 'Document',
        'status'             => 'Status',
        'retry_count'        => 'Retry Count',
        'last_error'         => 'Last Error',
        'posted_at'          => 'Posted At',
        'created_at'         => 'Created At',
    ],
];
