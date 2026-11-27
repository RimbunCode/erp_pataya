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
];
