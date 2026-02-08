<?php

return [
    'approvalInstance' => 'Approval Instance',
    'approvalInstances' => 'Approval Instances',
    'title' => 'Approvals',
    'add' => 'Add Approval Instance',
    'new' => 'New Approval Instance',
    'delete' => 'Delete Approval Instance',
    'delete.description' => 'Are you sure you want to delete this Approval Instance?',
    'delete.confirm' => 'Delete',
    'columns' => [
        'name' => 'Name',
        'model' => 'Model',
        'model.placeholder' => 'Select a model',
        'name_model' => 'Model',
        'is_active' => 'Is Active',
        'status' => 'Status',
        'config' => 'Config',
        'steps' => 'Steps',
        'document' => 'Document',
        'options' => 'Options',
        'current_sequence' => 'Current Sequence',
        'approval_instance' => 'Approval Instance',
    ],
    'steps' => [
        'title' => 'Approvals',
        'columns' => [
            'sequence' => 'Sequence',
            'approval_instance' => 'Document',
            'approver_type' => 'Approver Type',
            'approver_type.options' => [
                'user' => 'User',
                'role' => 'Role',
            ],
            'approver' => 'Approver',
            'config' => 'Config',
            'acted_at' => 'Acted At',
            'acted_by' => 'Acted By',
            'status' => 'Status',
            'notes' => 'Notes',
        ],
    ],
];
