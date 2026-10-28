<?php

return [
    'title'                 => 'Helpdesk Settings',
    'default'               => ['title' => 'Default Ticket'],
    'default_help'          => 'Pre-fills new tickets only. Existing tickets are not changed and each value can still be edited on the ticket.',
    'default_type'          => 'Default Type',
    'default_priority'      => 'Default Priority',
    'default_due_days'      => 'Default Due Days',
    'default_due_days_help' => 'Due date = start date + this many days. Leave empty to keep the due date blank.',
    'option_unavailable'    => 'The saved value is no longer a valid option, so it is not applied to new tickets. Choose a valid option or clear this setting.',
];
