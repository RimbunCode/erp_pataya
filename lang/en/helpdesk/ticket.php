<?php

return [
    'new'              => 'New Ticket',
    'edit'             => 'Edit Ticket',

    'columns'          => [
        'code'       => 'Code',
        'type'       => 'Type',
        'priority'   => 'Priority',
        'subject'    => 'Subject',
        'content'    => 'Content',
        'status'     => 'Status',
        'progress'   => 'Progress',
        'assign_to'  => 'Assign To',
        'created_by' => 'Created By',
        'start_date' => 'Start Date',
        'due_date'   => 'Due Date',
        'end_date'   => 'End Date',
    ],

    'type'             => [
        'options' => [
            'bug_problem' => 'Bug / Problem',
            'task'        => 'Task',
            'question'    => 'Question',
            'other'       => 'Other',
        ],
    ],

    'priority'         => [
        'options' => [
            'low'      => 'Low',
            'medium'   => 'Medium',
            'high'     => 'High',
            'critical' => 'Critical',
        ],
    ],

    'status'           => [
        'options' => [
            'new'         => 'New',
            'in_progress' => 'In Progress',
            'on_hold'     => 'On Hold',
            'resolved'    => 'Resolved',
            'done'        => 'Done',
        ],
    ],

    'actions'          => [
        'mark_done'         => 'Mark Done',
        'update_ticket'     => 'Update Ticket',
        'assign_to_creator' => 'Assign to Creator',
    ],

    'mark_done_dialog' => [
        'title'       => 'Mark as Done',
        'description' => 'This will set status to Done, progress to 100%, and record the completion date. This cannot be undone.',
        'confirm'     => 'Mark Done',
    ],

    'update_dialog'    => [
        'title'       => 'Update Ticket',
        'description' => 'Add a reply or update to this ticket. Changes to Assign To, Status, and Progress will be applied to the ticket.',
        'confirm'     => 'Save Update',
    ],

    'responses'        => [
        'title' => 'Response History',
        'empty' => 'No responses yet.',
    ],
];
