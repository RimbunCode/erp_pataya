<?php

return [
    'approvalScheme'     => 'Approval Scheme',
    'approvalSchemes'    => 'Approval Schemes',
    'title'              => 'Approval Schemes',
    'add'                => 'Add Approval Scheme',
    'new'                => 'New Approval Scheme',
    'delete'             => 'Delete Approval Scheme',
    'delete.description' => 'Are you sure you want to delete this Approval Scheme?',
    'delete.confirm'     => 'Delete',
    'columns'            => [
        'name'              => 'Name',
        'model'             => 'Model',
        'model.placeholder' => 'Select a model',
        'name_model'        => 'Model',
        'is_active'         => 'Is Active',
        'status'            => 'Status',
        'config'            => 'Config',
        'steps'             => 'Steps',
        'document'          => 'Document',
        'options'           => 'Options',
        'current_sequence'  => 'Current Sequence',
        'approval_scheme'   => 'Approval Scheme',
    ],
    'steps' => [
        'columns' => [
            'sequence'              => 'Sequence',
            'approval_scheme'       => 'Approval Scheme',
            'approver_type'         => 'Approver Type',
            'approver_type.options' => [
                'user' => 'User',
                'role' => 'Role',
            ],
            'approver'          => 'Approver',
            'config'            => 'Config',
            'acted_at'          => 'Acted At',
            'acted_by'          => 'Acted By',
            'status'            => 'Status',
            'approval_instance' => 'Approval Instance',
            'notes'             => 'Notes',
        ],
    ],
];
