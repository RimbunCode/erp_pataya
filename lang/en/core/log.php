<?php

return [
    'title' => 'Activity Log',
    'name'  => 'Log',

    'columns' => [
        'code'                => 'Code',
        'action'              => 'Action',
        'activity_text'       => 'Activity',
        'loggable_type_label' => 'Module',
        'loggable'            => 'Document',
        'user'                => 'User',
        'created_at'          => 'Time',
    ],

    'action' => [
        'options' => [
            'created'   => 'Created',
            'updated'   => 'Updated',
            'deleted'   => 'Deleted',
            'restored'  => 'Restored',
            'submitted' => 'Submitted',
            'cancelled' => 'Cancelled',
            'amended'   => 'Amended',
        ],
    ],
];
