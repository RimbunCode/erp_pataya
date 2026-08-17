<?php

return [
    'title'              => 'Asset Service',
    'add'                => 'Add Service',
    'new'                => 'New Service',
    'delete'             => 'Delete Service',
    'delete.description' => 'Are you sure you want to delete this service?',
    'delete.confirm'     => 'Delete',
    'cancel'             => 'Cancel',

    'checklist_not_complete'          => 'All activity checklist items must be marked done before completing this service.',
    'asset_status_terminal'           => 'Asset is in a terminal status and cannot be repaired.',
    'activity_requires_approval'      => 'Activity log can only be edited after this service is submitted and approved.',
    'not_currently_rented'            => 'This asset is not currently rented out, so it cannot be billed to a renter.',
    'consumed_item_quantity_exceeded' => 'The delivered quantity cannot exceed the consumed item quantity used for this service.',

    'type' => [
        'maintenance_task' => 'Maintenance Task',
        'repair'           => 'Repair',
    ],

    'activity' => [
        'title'                        => 'Activity Log',
        'add'                          => 'Add Activity',
        'edit'                         => 'Edit Activity',
        'pic'                          => 'PIC',
        'description'                  => 'Description',
        'is_done'                      => 'Done',
        'save'                         => 'Save',
        'empty'                        => 'No activity logged yet.',
        'mark_complete'                => 'Mark Service as Complete',
        'confirm_complete'             => 'Complete this service?',
        'confirm_complete_description' => 'All activity checklist items are done. Confirm to complete this service and reactivate the asset.',
        'confirm_complete_action'      => 'Confirm',
    ],

    'columns' => [
        'code'                   => 'Code',
        'type'                   => 'Type',
        'status'                 => 'Status',
        'failure_date'           => 'Failure Date',
        'completion_date'        => 'Completion Date',
        'capitalize_repair_cost' => 'Capitalize Repair Cost',
        'increase_in_asset_life' => 'Increase in Asset Life (months)',
        'description'            => 'Description',
        'item'                   => 'Item',
        'quantity'               => 'Quantity',
        'valuation_rate'         => 'Valuation Rate',
        'bill_to_renter'         => 'Bill to Renter',
        'customer'               => 'Customer',
        'customer_branch'        => 'Customer Branch',
    ],
];
