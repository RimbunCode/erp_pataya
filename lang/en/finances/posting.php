<?php

return [
    'errors' => [
        'unresolved_role'           => 'The account role ":role" cannot be resolved for document :document (variant :variant) on :date. Layers checked: :layers. Complete the Posting Profile or the related master account.',
        'unresolved_role_account'   => 'The account for role ":role" (document :document, variant :variant, date :date) cannot be used: :reason (:account). Account source: :layer.',
        'unresolved_role_ambiguous' => 'The account role ":role" (document :document, variant :variant, date :date) is ambiguous in the legacy fallback: :candidates accounts match :root/:type and none was chosen. Map this role in the Posting Profile.',
        'unknown_document_type'     => 'The posting document type ":type" has no registered posting rule.',
        'switch_mode_forbidden'     => 'You are not allowed to change the posting engine mode.',
        'partial_posting'           => 'Partial posting for :source: journals :existing already exist, :missing do not. Manual intervention is required.',
    ],

    'layers' => [
        'master'               => 'master account',
        'rules'                => 'conditional account rule',
        'profile'              => 'profile default account',
        'legacy'               => 'legacy fallback',
        'master_none'          => 'master account: none',
        'rules_none'           => 'conditional account rule: none matched',
        'profile_none'         => 'profile default account: no active profile on that date',
        'profile_role_missing' => 'profile default account ":profile": role not mapped',
        'legacy_off'           => 'legacy fallback: disabled',
        'legacy_no_pair'       => 'legacy fallback: role has no equivalent',
        'legacy_no_account'    => 'legacy fallback: no account :root/:type',
    ],

    'account_problems' => [
        'not_found' => 'account not found',
        'deleted'   => 'account has been deleted',
        'group'     => 'group accounts cannot be posted to',
        'disabled'  => 'account is disabled',
    ],
];
