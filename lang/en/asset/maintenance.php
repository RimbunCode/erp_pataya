<?php

return [
    'title'              => 'Asset Maintenance',
    'add'                => 'Add Maintenance',
    'new'                => 'New Maintenance',
    'delete'             => 'Delete Maintenance',
    'delete.description' => 'Are you sure you want to delete this maintenance record?',
    'delete.confirm'     => 'Delete',
    'cancel'             => 'Cancel',

    'columns' => [
        'asset'            => 'Asset',
        'maintenanceTeam'  => 'Maintenance Team',
        'maintenance_team' => 'Maintenance Team',
    ],

    'task' => [
        'columns' => [
            'task_name'            => 'Task Name',
            'maintenance_type'     => 'Maintenance Type',
            'periodicity'          => 'Periodicity (days)',
            'next_due_date'        => 'Next Due Date',
            'last_completion_date' => 'Last Completion Date',
            'assign_to'            => 'Assigned To',
            'certificate_required' => 'Certificate Required',
            'description'          => 'Description',
        ],
    ],

    'team' => [
        'title'              => 'Maintenance Team',
        'add'                => 'Add Team',
        'new'                => 'New Team',
        'delete'             => 'Delete Team',
        'delete.description' => 'Are you sure you want to delete this team?',
        'delete.confirm'     => 'Delete',
        'cancel'             => 'Cancel',

        'columns' => [
            'team_name' => 'Team Name',
            'manager'   => 'Manager',
            'branch'    => 'Branch',
        ],
    ],
];
