<?php

return [
    'title' => 'Fiscal Periods',
    'name'  => 'Fiscal Period',

    'columns' => [
        'name'           => 'Name',
        'fiscal_year'    => 'Fiscal Year',
        'start_date'     => 'Start Date',
        'end_date'       => 'End Date',
        'status'         => 'Status',
        'status.options' => [
            'open'   => 'Open',
            'closed' => 'Closed',
        ],
        'closed_at' => 'Closed At',
    ],
    'errors' => [
        'invalid_range'  => 'The end date must be on or after the start date.',
        'outside_year'   => 'The period must fall within fiscal year :year (:start to :end).',
        'overlap'        => 'The date range overlaps period :name.',
        'duplicate_name' => 'A period named :name already exists in this fiscal year.',
    ],
];
