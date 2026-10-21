<?php

return [
    'title'   => 'Sales Settings',
    'default' => [
        'title' => 'Default',
    ],
    'default_tax'                     => 'Default Tax',
    'default_source_warehouse'        => 'Default Source Warehouse',
    'default_payment_term_template'   => 'Default Payment Term Template',
    'transaction'                     => ['title' => 'Transactions'],
    'over_delivery_tolerance_percent' => 'Over-delivery Tolerance',
    'over_billing_tolerance_percent'  => 'Over-billing Tolerance',
    'over_delivery_tolerance_help'    => 'Allows delivering up to this percentage above the remaining quantity on a Sales Order item.',
    'over_billing_tolerance_help'     => 'Allows billing up to this percentage above the remaining quantity or value on a source item.',
    'reference_unavailable'           => 'The selected default is no longer active. Choose an active record or clear this setting.',
    'rate_change_action'              => 'Rate Change Between Documents',
    'rate_change_action_help'         => 'Compare Sales Invoice rates with linked Sales Order rates.',
    'below_cost_action'               => 'Sales Price Below Cost',
    'below_cost_action_help'          => 'Compare each stock Sales Invoice line net unit price with the current valuation rate in its source warehouse when posting. Non-stock items and lines without valuation are skipped.',
    'actions'                         => ['none' => 'No action', 'warn' => 'Warn and allow', 'stop' => 'Block'],
];
