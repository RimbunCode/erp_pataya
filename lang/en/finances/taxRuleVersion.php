<?php

return [
    'title'      => 'Tax Rule Versions',
    'name'       => 'Tax Rule Version',
    'open_ended' => 'open-ended',

    'columns' => [
        'tax'                   => 'Tax',
        'version'               => 'Version',
        'effective_from'        => 'Effective From',
        'effective_to'          => 'Effective To',
        'rate'                  => 'Rate (%)',
        'dpp_factor'            => 'Tax Base Factor',
        'rounding_mode'         => 'Rounding',
        'rounding_mode.options' => [
            'per_line'     => 'Per Line',
            'per_document' => 'Per Document',
        ],
        'output_role'    => 'Output Tax Role',
        'input_role'     => 'Input Tax Role',
        'status'         => 'Status',
        'status.options' => [
            'draft'   => 'Draft',
            'active'  => 'Active',
            'retired' => 'Retired',
        ],
        'notes' => 'Notes',
    ],

    'errors' => [
        'invalid_range'                  => 'The effective end date must be on or after the effective start date.',
        'overlap'                        => 'Active version :version (:from to :to) of this tax overlaps the effective range of this version.',
        'not_draft'                      => 'A version with status :status cannot be changed; create a new version.',
        'not_active'                     => 'Only an active version can be retired (current status: :status).',
        'invalid_rate'                   => 'The rate must be between 0 and 100.',
        'invalid_dpp_factor'             => 'Invalid tax base factor: numerator and denominator must be positive integers.',
        'dpp_factor_locked'              => 'Tax base factor :factor cannot be activated yet: invoice item calculated columns still use a fixed 11/12, so a rule with another factor would diverge from document amounts.',
        'invalid_rounding'               => 'Unknown rounding mode ":mode"; use per_line or per_document.',
        'invalid_role'                   => 'Invalid role ":role"; use a Posting Profile role key.',
        'version_starts_before_previous' => 'The new version must start after the previous version\'s effective date (:from).',
        'version_ends_before_previous'   => 'The new version must not end before the previous version ends (:to); the difference would leave dates with no effective rule.',
        'unknown_attribute'              => 'Field ":field" is unknown and was rejected.',
        'unknown_tax'                    => 'Tax not found.',
        'delete_not_draft'               => 'Only draft versions can be deleted.',
        'no_effective_rule'              => 'No tax rule version is effective for ":tax" on :date.',
    ],
];
