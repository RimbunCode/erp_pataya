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
        'no_journal'       => 'This document does not produce a journal, so no accounts are recorded.',
    ],

    'lines_count'       => ':count lines',
    'fix_profile'       => 'Open Posting Profile',
    'fix_profile_admin' => 'Contact an administrator to complete the Posting Profile configuration.',

    'errors' => [
        'preview_failed'                 => 'The account preview could not be built. Reload the page; if it keeps happening, contact an administrator.',
        'asset_category_account_missing' => 'The asset category accounts for ":category" at this asset\'s branch are not set. Complete them before approving the document; otherwise posting will fail.',
        'payment_type_unsupported'       => 'This payment type is not supported by the posting engine, so no account preview is available.',
    ],
];
