<?php

return [
    'title'    => 'Posting accounts',
    'subtitle' => 'Accounts are determined automatically by the Posting Profile configuration and cannot be changed here.',

    'columns' => [
        'role'    => 'Role',
        'account' => 'Account',
        'lines'   => 'Lines',
    ],

    'states' => [
        'preview'          => 'Preview: the accounts that will be used when the document is approved.',
        'estimated'        => 'Estimate: some values are only final on approval, so the journals created may differ.',
        'recorded'         => 'The accounts used when the document was posted.',
        'new'              => 'Accounts are determined automatically and will appear once the document is saved.',
        'pending_approval' => 'Accounts are determined when the document is approved.',
        'pending_posting'  => 'No accounts recorded yet: posting has not run, or the document was created before account recording was introduced.',
        'unavailable'      => 'There are no posting accounts for this document.',
    ],

    'lines_count' => ':count lines',
    'fix_profile' => 'Open Posting Profile',

    'errors' => [
        'preview_failed' => 'The account preview could not be built. Reload the page; if it keeps happening, contact an administrator.',
    ],
];
