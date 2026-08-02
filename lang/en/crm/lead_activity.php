<?php

return [
    'title'   => 'Activity',
    'add'     => 'Add Activity',
    'columns' => [
        'type'             => 'Type',
        'type.placeholder' => 'Select a type',
        'type.options'     => [
            'task'    => 'Task',
            'call'    => 'Call',
            'meeting' => 'Meeting',
            'email'   => 'Email',
        ],
        'subject'            => 'Subject',
        'description'        => 'Description',
        'scheduled_at'       => 'Scheduled At',
        'status'             => 'Status',
        'status.placeholder' => 'Select a status',
        'status.options'     => [
            'open'   => 'Open',
            'closed' => 'Closed',
        ],
        'assigned_to'             => 'Assigned To',
        'assigned_to.placeholder' => 'Select a user',
    ],
];
