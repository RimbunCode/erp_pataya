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
    'fx' => [
        'title'              => 'Exchange Rates',
        'max_age_days'       => 'Maximum Rate Age (days)',
        'max_age_days_help'  => 'When no rate exists on the transaction date, the nearest earlier rate within this many days is used. Enter 0 to accept only a rate on the exact date. Maximum 3650.',
        'allow_inverse'      => 'Allow Inverse Rates',
        'allow_inverse_help' => 'When the direct rate is missing, the opposite pair is used by dividing by its stored rate.',
    ],
    'posting' => [
        'title'                                => 'Posting',
        'discount_split_from_sales_invoice'    => 'Separate Discount for Sales Invoice From',
        'discount_split_from_purchase_invoice' => 'Separate Discount for Purchase Invoice From',
        'discount_split_help'                  => 'From this date, invoice journals post the discount to a separate Discount account (the discount role). Leave empty to disable. Journals dated before this date are unchanged. The discount role must already be mapped on the active Posting Profile (Purchase Invoice: through an account rule for the Purchase Invoice document type).',
    ],
];
