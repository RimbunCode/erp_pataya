<?php

return [
    'new'   => 'New ToDo',
    'title' => 'ToDo',
    'add'   => 'New ToDo',
    'name'  => 'ToDo',
    'edit'  => 'Edit ToDo',

    'columns' => [
        'description'  => 'Description',
        'reference'    => 'Reference',
        'allocated_to' => 'Allocated To',
        'priority'     => 'Priority',
        'status'       => 'Status',
        'date'         => 'Date',
        'due_date'     => 'Due Date',
        'assigned_by'  => 'Assigned By',
    ],

    'priority' => [
        'options' => [
            'low'    => 'Low',
            'medium' => 'Medium',
            'high'   => 'High',
        ],
    ],

    'reference_deleted' => 'Reference is no longer available.',

    'errors' => [
        'already_assigned' => 'This user or role is already assigned to this document.',
    ],
];
