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
        'actions'   => 'Actions',
    ],
    'errors' => [
        'invalid_range'  => 'The end date must be on or after the start date.',
        'outside_year'   => 'The period must fall within fiscal year :year (:start to :end).',
        'overlap'        => 'The date range overlaps period :name.',
        'duplicate_name' => 'A period named :name already exists in this fiscal year.',
    ],
    'generate' => [
        'title'   => 'Generate Fiscal Year',
        'year'    => 'Calendar Year',
        'submit'  => 'Generate',
        'success' => 'Fiscal year :year (12 monthly periods) is ready.',
    ],
    'actions' => [
        'close' => 'Close',
        'open'  => 'Reopen',
    ],
    'close' => [
        'title'              => 'Close Period',
        'description'        => 'Journals can no longer be posted into :period while enforcement is on.',
        'reason'             => 'Reason (optional)',
        'reason_placeholder' => 'Why is this period closed?',
        'confirm'            => 'Close Period',
        'cancel'             => 'Cancel',
        'success'            => 'Period :period was closed.',
    ],
    'open' => [
        'title'              => 'Reopen Period',
        'description'        => 'Journals can be posted into :period again.',
        'reason'             => 'Reason (optional)',
        'reason_placeholder' => 'Why is this period reopened?',
        'confirm'            => 'Reopen Period',
        'cancel'             => 'Cancel',
        'success'            => 'Period :period was reopened.',
    ],
    'enforcement' => [
        'title'       => 'Enforce Fiscal Periods',
        'description' => 'When on, journals can only be posted on dates that fall in an open fiscal period. Off by default so historical data is never blocked.',
        'saved'       => 'Enforcement setting saved.',
        'warning'     => ':count ledger rows are dated outside every defined fiscal period. With enforcement on, posting on such dates is rejected until a period covers them.',
        'read_only'   => 'You do not have permission to change this setting.',
    ],
    'list' => [
        'empty'   => 'No fiscal years yet. Generate one to get started.',
        'periods' => 'Periods',
        'range'   => ':start to :end',
    ],
];
