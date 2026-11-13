<?php

return [
    'title'      => 'Posting Profiles',
    'name'       => 'Posting Profile',
    'open_ended' => 'open-ended',
    'accounts'   => 'Role Default Accounts',
    'rules'      => 'Conditional Account Rules',

    'columns' => [
        'name'           => 'Name',
        'effective_from' => 'Effective From',
        'effective_to'   => 'Effective To',
        'status'         => 'Status',
        'status.options' => [
            'draft'   => 'Draft',
            'active'  => 'Active',
            'retired' => 'Retired',
        ],
        'version'          => 'Version',
        'notes'            => 'Notes',
        'previous_profile' => 'Previous Version',
        'role'             => 'Role',
        'account'          => 'Account',
        'document_type'    => 'Document Type',
        'variant'          => 'Variant',
        'variant.options'  => [
            'normal' => 'Normal',
            'return' => 'Return',
        ],
        'item_type'     => 'Item Type',
        'is_stock_item' => 'Stock Item',
        'item_category' => 'Item Category',
        'priority'      => 'Priority',
    ],

    'errors' => [
        'invalid_range'                  => 'The effective end date must be on or after the effective start date.',
        'overlap'                        => 'The active profile ":name" (:from to :to) overlaps the effective range of this profile.',
        'not_draft'                      => 'A profile with status :status cannot be changed; create a new version.',
        'not_active'                     => 'Only active profiles can be retired (current status: :status).',
        'role_required'                  => 'The role is required.',
        'account_problem'                => 'Account :account for role ":role" cannot be used: :reason.',
        'rule_duplicate'                 => 'A rule with the same conditions already exists for role ":role" in this profile.',
        'rule_item_condition_role'       => 'Role ":role" is not a line-sensitive role; item attribute conditions are only allowed for line-sensitive roles.',
        'rule_unknown_document_type'     => 'Unknown document type ":type".',
        'rule_invalid_variant'           => 'Invalid variant ":variant"; use normal or return.',
        'version_starts_before_previous' => 'The new version must start after the previous profile start date (:from).',
        'version_ends_before_previous'   => 'The new version must not end before the previous profile end date (:to); the difference would leave a gap with no active profile.',
        'field_too_long'                 => 'The :field field exceeds :max characters.',
        'delete_referenced'              => 'This draft profile is the basis of another new version and cannot be deleted; delete the newer version first.',
        'rule_negative_priority'         => 'Priority must not be negative.',
        'rule_priority_too_large'        => 'Priority must not exceed :max.',
        'version_not_contiguous'         => 'The new version must start on :from, the day after the previous profile ends, so that no date is left without an active profile.',
        'rule_invalid_item_type'         => 'Unknown item type ":type"; use one of :allowed.',
        'rule_unknown_category'          => 'The item category in the rule was not found.',
        'unknown_input'                  => 'The field ":field" is not recognized and was rejected.',
        'unknown_role'                   => 'Role ":role" is not in the account role catalog.',
        'copy_draft'                     => 'A draft profile cannot be copied; edit the draft directly or activate it first.',
    ],

    'warnings' => [
        'retire_gap' => 'After retiring this profile, no active profile covers :from to :to; posting on those dates will fail until another profile is activated.',
    ],

    'new' => 'New Profile',

    'list' => [
        'empty'    => 'There are no Posting Profiles yet.',
        'add'      => 'New Profile',
        'range'    => ':from to :to',
        'mapped'   => ':count roles mapped',
        'open'     => 'Open',
        'subtitle' => 'Default account per role for the whole company, effective over a date range.',
    ],

    'form' => [
        'general'                  => 'Profile Details',
        'roles_description'        => 'Choose the default account for each role. Only active, non-group accounts can be selected.',
        'role_master_hint'         => 'Usually supplied by a master account; the account here is only a fallback.',
        'role_line_sensitive_hint' => 'Evaluated per item line; can be overridden by conditional rules.',
        'account_placeholder'      => 'Select account',
        'rules_read_only'          => 'Rules are shown read-only. Copy a version to carry rules over to a new version.',
        'rules_empty'              => 'There are no conditional account rules yet.',
        'any'                      => 'Any',
        'yes'                      => 'Yes',
        'no'                       => 'No',
        'read_only'                => 'A profile with status :status cannot be changed. Create a new version to change accounts.',
        'view_only'                => 'You do not have permission to change this profile.',
        'save'                     => 'Save',
        'create'                   => 'Create Draft',
        'back'                     => 'Back to List',
        'unmapped_cell'            => 'Not mapped',
    ],

    'actions' => [
        'new_version' => 'Create New Version',
        'activate'    => 'Activate',
        'retire'      => 'Retire',
        'discard'     => 'Delete Draft',
    ],

    'new_version' => [
        'title'          => 'Create New Version',
        'description'    => 'Copies the default accounts and rules into a new draft version. The effective date must continue from the previous profile.',
        'effective_from' => 'Effective From',
        'effective_to'   => 'Effective To (optional)',
        'name'           => 'Name (optional)',
        'confirm'        => 'Create Version',
        'cancel'         => 'Cancel',
    ],

    'confirm' => [
        'activate' => [
            'title'       => 'Activate Profile',
            'description' => 'Profile ":name" will be used by the account resolver for dates within its effective range.',
            'confirm'     => 'Activate',
        ],
        'retire' => [
            'title'       => 'Retire Profile',
            'description' => 'Profile ":name" will no longer be chosen by the resolver. Posting on dates not covered by another active profile will fail.',
            'confirm'     => 'Retire',
        ],
        'discard' => [
            'title'       => 'Delete Draft',
            'description' => 'Draft ":name" and its accounts and rules will be permanently deleted.',
            'confirm'     => 'Delete',
        ],
        'cancel' => 'Cancel',
    ],

    'unmapped' => [
        'title'   => 'Required roles are not mapped',
        'note'    => 'This check only looks at the profile default accounts; conditional account rules are not counted.',
        'message' => ':document: :roles',
    ],

    'retire_warning_title' => 'Date gap warning',

    'messages' => [
        'created'         => 'Draft profile ":name" created.',
        'updated'         => 'Profile ":name" saved.',
        'discarded'       => 'Draft profile ":name" deleted.',
        'version_created' => 'Draft version :version created.',
        'activated'       => 'Profile ":name" activated.',
        'retired'         => 'Profile ":name" retired.',
    ],
];
