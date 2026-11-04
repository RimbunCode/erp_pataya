<?php

return [
    'title' => 'Fiscal Years',
    'name'  => 'Fiscal Year',

    'columns' => [
        'name'           => 'Name',
        'start_date'     => 'Start Date',
        'end_date'       => 'End Date',
        'status'         => 'Status',
        'status.options' => [
            'open'   => 'Open',
            'closed' => 'Closed',
        ],
    ],
    'errors' => [
        'invalid_range'     => 'The end date must be on or after the start date.',
        'overlap'           => 'The date range overlaps fiscal year :name.',
        'not_calendar_year' => 'Fiscal year :name already exists with a non-calendar range (:start to :end), so calendar monthly periods cannot be generated. Create its periods manually.',
    ],
];
