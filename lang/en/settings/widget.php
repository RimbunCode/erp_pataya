<?php

return [
  'title'                  => 'Widgets',
  'add'                    => 'Add Widget',
  'new'                    => 'Create Widget',
  'time_series'            => 'Time Series',
  'details'                => "Details",
  'columns'                => [
    'name'                        => 'Name',
    'is_disabled'                 => 'Status',
    'created_at'                  => 'Created At',
    'model'                       => 'Model',
    'model.placeholder'           => 'Select a model',
    'level'                       => 'Level',
    'only_creator'                => 'Only Creator',
    'permissions'                 => 'Permissions',
    'title'                       => 'Title',
    'type'                        => 'Type',
    'calculation_type'            => 'Calculation Type',
    'group_by_types'              => 'Group By Types',
    'group_by_base_on'            => 'Group By Base On',
    'group_by_types.options'      => [
      'sum'     => 'Sum',
      'average' => 'Average',
      'count'   => 'Count',
    ],
    'time_interval'               => 'Time Interval',
    'time_based_on'               => 'Time Based On',
    'time_span'                   => 'Time Span',

    'value_based_on'              => 'Value Based On',
    'permission'                  => 'Permission',
    'aggregate_function_based_on' => 'Aggregate Function Based On',
  ],

  'types'                  => [
    'card'     => 'Card',
    'line'     => 'Line',
    'bar'      => 'Bar',
    'pie'      => 'Pie',
    'doughnut' => 'Doughnut',

  ],
  'calculation_types'      => [
    'count'    => 'Count',
    'sum'      => 'Sum',
    'average'  => 'Average',
    'group_by' => 'Group By',
  ],
  'time_intervals'         => [
    'daily'     => 'Daily',
    'weekly'    => 'Weekly',
    'monthly'   => 'Monthly',
    'quarterly' => 'Quarterly',
    'yearly'    => 'Yearly',
  ],
  'group_by_base_on.types' => [
    'daily'   => 'Daily',
    'weekly'  => 'Weekly',
    'monthly' => 'Monthly',
    'yearly'  => 'Yearly',
  ],
  'time_spans'             => [
    'last_week'    => 'Last Week',
    'last_month'   => 'Last Month',
    'last_quarter' => 'Last Quarter',
    'last_year'    => 'Last Year',
  ],
];
