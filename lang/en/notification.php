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
