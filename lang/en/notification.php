<?php

return [
    'approval' => [
        'approved' => [
            'title'   => 'Document Approved',
            'message' => 'Document :document has been approved.',
        ],
        'rejected' => [
            'title'   => 'Document Rejected',
            'message' => 'Document :document has been rejected.',
        ],
        'pending' => [
            'title'   => 'Awaiting Your Approval',
            'message' => 'Document :document is awaiting your decision.',
        ],
        'canceled' => [
            'title'   => 'Document Canceled',
            'message' => 'Document :document has been canceled, no review needed.',
        ],
    ],
    'document_submitted' => [
        'title'   => 'New Document',
        'message' => 'New :document from :creator needs your attention.',
    ],
    'todo_assigned' => [
        'title'   => 'New ToDo Assigned',
        'message' => ':assigner assigned you a ToDo: :document',
    ],
    'todo_reminder' => [
        'lead' => [
            'title'   => 'ToDo Due Soon',
            'message' => 'ToDo :document is due in :days day(s) — :due_date.',
        ],
        'day_of' => [
            'title'   => 'ToDo Due Today',
            'message' => 'ToDo :document is due today at :due_date.',
        ],
        'overdue' => [
            'title'   => 'ToDo Overdue',
            'message' => 'ToDo :document passed its due date :days day(s) ago (:due_date).',
        ],
    ],
    'todo_auto_closed' => [
        'title'   => 'ToDo Closed Automatically',
        'message' => 'ToDo :document was automatically closed after its due date passed.',
    ],
    'user_invited' => [
        'subject'  => 'You Have Been Invited',
        'greeting' => 'Hello :name,',
        'line'     => 'You have been invited to join. Please complete your account setup.',
        'action'   => 'Complete Account',
    ],
    'panel' => [
        'title'            => 'Notifications',
        'mark_all_as_read' => 'Mark all as read',
        'empty'            => [
            'title'    => 'No Notifications Yet',
            'subtitle' => 'New notifications will appear here.',
        ],
    ],
];
