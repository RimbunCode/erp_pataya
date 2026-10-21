<?php

return [
    'title'                          => 'Purchase Settings',
    'default'                        => ['title' => 'Default'],
    'transaction'                    => ['title' => 'Transactions'],
    'default_tax'                    => 'Default Tax',
    'default_target_warehouse'       => 'Default Target Warehouse',
    'default_payment_term_template'  => 'Default Payment Term Template',
    'over_receipt_tolerance_percent' => 'Over-receipt Tolerance',
    'over_billing_tolerance_percent' => 'Over-billing Tolerance',
    'over_receipt_tolerance_help'    => 'Allows receiving up to this percentage above the remaining quantity on a Purchase Order item.',
    'over_billing_tolerance_help'    => 'Allows billing up to this percentage above the remaining quantity or value on a source item.',
    'reference_unavailable'          => 'The selected default is no longer active. Choose an active record or clear this setting.',
    'rate_change_action'             => 'Rate Change Between Documents',
    'rate_change_action_help'        => 'Compare purchase invoice rates with linked Purchase Order rates. This does not apply to receipt-only rows without a source rate.',
    'actions'                        => ['none' => 'No action', 'warn' => 'Warn and allow', 'stop' => 'Block'],
];
