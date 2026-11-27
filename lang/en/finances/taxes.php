<?php

return [
    'title'              => 'Taxes',
    'add'                => 'Add Tax',
    'new'                => 'New Tax',
    'delete'             => 'Delete Tax',
    'delete.description' => 'Are you sure you want to delete this Tax?',
    'delete.confirm'     => 'Delete',
    'cancel'             => 'Cancel',
    'category'           => 'Category',
    'columns'            => [
        'name'             => 'Name',
        'rate'             => 'Rate (%)',
        'category'         => 'Category',
        'category.options' => [
            'unclassified' => 'Unclassified',
            'ppn_standard' => 'Standard VAT (PPN)',
            'ppn_luxury'   => 'Luxury Goods VAT (PPN)',
            'pph_21'       => 'Income Tax Art. 21',
            'pph_22'       => 'Income Tax Art. 22',
            'pph_23'       => 'Income Tax Art. 23',
            'pph_4_2'      => 'Income Tax Art. 4(2)',
            'other'        => 'Other',
        ],
        'behavior'         => 'Behavior',
        'behavior.options' => [
            'additive'    => 'Adds to Total (e.g. VAT)',
            'withholding' => 'Withheld from Payment (e.g. Income Tax)',
        ],
        'jurisdiction_code' => 'Jurisdiction Code',
        'is_creditable'     => 'Creditable',
    ],
    'errors' => [
        'withholding_ppn' => 'A VAT (PPN) category tax cannot be withheld: choose "Adds to Total" or another category.',
    ],
    'form' => [
        'classification'            => 'Classification',
        'is_creditable_description' => 'Only relevant for input tax: whether it can be credited against output tax.',
        'withholding_ppn_blocked'   => 'VAT (PPN) taxes cannot be withheld, so "Withheld from Payment" is not available for this category.',
        'unclassified_used'         => 'This tax is still unclassified but was used on :sales sales invoice(s) and :purchase purchase invoice(s) in the last 12 months. Set its category and behavior.',
    ],
];
