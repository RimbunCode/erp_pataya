<?php

return [
    'title'   => 'Number Cards',
    'add'     => 'Add Number Card',
    'new'     => 'Create Number Card',
    'details' => 'Details',
    'sharing' => 'Sharing',
    'columns' => [
        'label'                       => 'Label',
        'icon'                        => 'Icon',
        'description'                 => 'Description',
        'filters'                     => 'Filter',
        'function'                    => 'Function',
        'model'                       => 'Model',
        'model.placeholder'           => 'Select a model',
        'created_at'                  => 'Created At',
        'source_type'                 => 'Source',
        'aggregate_function_based_on' => 'Aggregate Field',
        'stats_time_interval'         => 'Compare Against',
        'currency'                    => 'Currency',
        'color'                       => 'Color',
        'background_color'            => 'Background Color',
        'show_full_number'            => 'Show Full Number',
        'show_percentage_stats'       => 'Show Percentage Stats',
        'is_shared_all'               => 'Share to all Users/Roles',
    ],
    'descriptions' => [
        'show_full_number'      => 'Show the full number with thousand separators (e.g. 1,234,567). If off, the number is abbreviated (e.g. 1.2M).',
        'show_percentage_stats' => 'Show a percentage change badge (up/down) compared to the previous period, based on the "Compare Against" interval.',
        'is_shared_all'         => 'This Number Card is visible to ALL users, regardless of their permission on the target model. This is additive, not a replacement — users with Select permission on the target model can still see this card even when this option is off.',
    ],

    'source_types' => [
        'document_type' => 'Document Type',
        'custom'        => 'Custom',
    ],
    'functions' => [
        'count'   => 'Count',
        'sum'     => 'Sum',
        'average' => 'Average',
        'minimum' => 'Minimum',
        'maximum' => 'Maximum',
    ],
    'stats_time_intervals' => [
        'daily'   => 'Yesterday',
        'weekly'  => 'Last Week',
        'monthly' => 'Last Month',
        'yearly'  => 'Last Year',
    ],
];
