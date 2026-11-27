<?php

return [
    'title' => 'Tax Breakdown',

    'columns' => [
        'line'                => 'Line',
        'tax'                 => 'Tax',
        'base_amount'         => 'Base',
        'dpp_factor'          => 'DPP Factor',
        'dpp_amount'          => 'DPP',
        'rate'                => 'Rate (%)',
        'tax_amount'          => 'Tax Amount',
        'rounding_adjustment' => 'Rounding Remainder',
        'version'             => 'Rule Version',
        'warnings'            => 'Warnings',
    ],

    'states' => [
        'snapshot' => 'Breakdown from the snapshot saved when the document was approved.',
        'legacy'   => 'This document was created before tax rule versions existed. The breakdown is explained from the values stored on the document lines (legacy), not from a rule version.',
        'pending'  => 'The document is not approved yet. The breakdown snapshot is created on approval; the current stored values are shown.',
        'none'     => 'This document has no taxed lines.',
        'error'    => 'The tax breakdown cannot be shown right now.',
        'new'      => 'The tax breakdown appears once the document is saved.',
    ],

    'version' => [
        'label'   => 'Version :number',
        'legacy'  => 'Legacy',
        'missing' => 'Version not available',
    ],

    'totals' => [
        'additive'    => 'Total additive tax',
        'withholding' => 'Total withheld tax',
    ],

    'warnings' => [
        'snapshot_build_failed'        => 'The tax breakdown could not be built when the document was approved; document amounts are not affected.',
        'persisted_vs_engine_mismatch' => 'The stored values differ from the rule calculation by more than one minor unit.',
        'unknown'                      => 'Warning: :code',
    ],
];
