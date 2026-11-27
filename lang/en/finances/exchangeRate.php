<?php

return [
    'title' => 'Exchange Rates',
    'name'  => 'Exchange Rate',

    'columns' => [
        'from_currency_code' => 'From Currency',
        'to_currency_code'   => 'To Currency',
        'rate_type'          => 'Rate Type',
        'rate_type.options'  => [
            'spot'        => 'Spot',
            'transaction' => 'Transaction',
            'closing'     => 'Closing',
            'contract'    => 'Contract',
            'historical'  => 'Historical',
        ],
        'rate'           => 'Rate',
        'rate_date'      => 'Rate Date',
        'source'         => 'Source',
        'source_ref'     => 'Source Reference',
        'source.options' => [
            'manual'   => 'Manual',
            'import'   => 'Import',
            'provider' => 'Provider',
        ],
    ],

    'errors' => [
        'no_rate'              => 'No :type rate from :from to :to found for :date. Add the rate in the Exchange Rates master.',
        'immutable_referenced' => 'This rate is already used by transactions and cannot be changed or deleted. Create a rate with another type or date.',
        'same_currency'        => 'The source and target currencies must be different.',
        'rate_not_positive'    => 'The rate must be greater than 0.',
        'rate_invalid_format'  => 'The rate must be a positive decimal number with at most 8 decimal places, using a dot as the decimal separator (15500.25, not 15500,25).',
        'rate_out_of_range'    => 'The rate is outside the supported range (less than 1,000,000,000,000).',
        'unknown_currency'     => 'Currency code ":code" was not found.',
        'invalid_type'         => 'Unknown rate type ":type".',
        'invalid_date'         => 'Rate date ":date" is invalid; use the YYYY-MM-DD format.',
        'missing_field'        => 'The ":field" column is required.',
        'duplicate_in_file'    => 'The same pair, type, and date appears more than once in the file (line :first).',
        'referenced_conflict'  => 'A rate for this pair, type, and date already exists, is used by transactions, and has a different value; it cannot be changed.',
        'csv_missing_header'   => 'The CSV header must contain the columns: :columns.',
        'csv_unreadable'       => 'The CSV file could not be read.',
        'csv_too_large'        => 'The CSV file exceeds the :max MB limit.',
        'csv_too_many_rows'    => 'The CSV file exceeds the limit of :max data rows.',
        'csv_duplicate_header' => 'The CSV header contains duplicate columns: :columns.',
        'database_error'       => 'The row could not be saved because of a database error.',
        'csv_column_count'     => 'The row has a different number of columns than the header (expected :expected, found :actual).',
    ],
];
