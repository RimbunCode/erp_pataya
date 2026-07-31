<?php

return [
    'new'   => 'New ToDo',
    'title' => 'ToDo',
    'add'   => 'New ToDo',
    'name'  => 'ToDo',
    'edit'  => 'Edit ToDo',

    'columns' => [
        'code'               => 'Code',
        'description'        => 'Description',
        'reference'          => 'Reference',
        'allocated_to'       => 'Allocated To',
        'type'               => 'Type',
        'priority'           => 'Priority',
        'status'             => 'Status',
        'date'               => 'Date',
        'due_date'           => 'Due Date',
        'reminder_lead_days' => 'Reminder',
        'assigned_by'        => 'Assigned By',
    ],

    'priority' => [
        'options' => [
            'low'    => 'Low',
            'medium' => 'Medium',
            'high'   => 'High',
        ],
    ],

    'type' => [
        'options' => [
            'task'     => 'Task',
            'event'    => 'Event',
            'meeting'  => 'Meeting',
            'deadline' => 'Deadline',
        ],
    ],

    'reminder_stage' => [
        'options' => [
            'lead'    => 'Upcoming',
            'day_of'  => 'Today',
            'overdue' => 'Overdue',
        ],
    ],

    'lead_days' => [
        'options' => [
            '1'  => 'H-1',
            '3'  => 'H-3',
            '7'  => 'H-7',
            '14' => 'H-14',
            '30' => 'H-30',
        ],
    ],

    'hints' => [
        'allocated_to_self'  => 'Leave blank to assign to yourself',
        'reminder_lead_days' => 'H-1 and the due date itself are always reminded, regardless of selection here',
    ],

    'confirm' => [
        'reassign_to_self'             => 'Reassign this ToDo to yourself?',
        'reassign_to_self_description' => 'You left the assignee blank. Continuing will reassign this ToDo to you.',
    ],

    'reference_deleted' => 'Reference is no longer available.',

    'errors' => [
        'already_assigned' => 'This user or role is already assigned to this document.',
    ],
];
