<?php

return [
    'title'       => 'Finance Settings',
    'tax_invoice' => [
        'title'                => 'Tax Invoice',
        'range_start'          => 'Serial Number Range Start',
        'range_end'            => 'Serial Number Range End',
        'last_used'            => 'Last Used Serial Number',
        'range_not_configured' => 'The tax invoice serial range is not configured. Contact an administrator to set the range in Finance Settings.',
        'range_exhausted'      => 'The allocated tax invoice serial range is exhausted. Contact an administrator to obtain a new range from DJP.',
    ],
    'posting' => [
        'title'                                => 'Posting',
        'discount_split_from_sales_invoice'    => 'Separate Discount for Sales Invoice From',
        'discount_split_from_purchase_invoice' => 'Separate Discount for Purchase Invoice From',
        'discount_split_help'                  => 'From this date, invoice journals post the discount to a separate Discount account (the discount role). Leave empty to disable. Documents before this date are unchanged. The discount role must already be mapped on the active Posting Profile.',
    ],
];
