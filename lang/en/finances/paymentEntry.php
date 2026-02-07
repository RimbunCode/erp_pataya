<?php

return [
  'title'              => 'Payment Entries',
  'add'                => 'Add Payment Entry',
  'new'                => 'New Payment Entry',
  'delete'             => 'Delete Payment Entry',
  'delete.description' => 'Are you sure you want to delete this Payment Entry?',
  'delete.confirm'     => 'Delete',
  'cancel'             => 'Cancel',
  'category'           => 'Category',
  'columns'            => [
    'date'                       => 'Payment Date',
    'code'                       => 'Payment Code',
    'paymentable'                => 'Reference To',
    'currency_code'              => 'Currency Code',
    'partyable'                  => 'Party',
    'account_paid_to'            => 'Account Paid To',
    'account_paid_from'          => 'Account Paid From',
    'currency'                   => 'Currency',
    'currency.placeholder'       => 'Select a currency',
    'exchange_rate'              => 'Exchange Rate',
    'paid_amount'                => 'Paid Amount',
    'payment_method'             => 'Payment Method',
    'payment_method.placeholder' => 'Select a payment method',
    'payment_type'               => 'Payment Type',
    'payment_type.placeholder'   => 'Select a payment type',
    'payment_type.options'       => [
      'receive' => 'Receive',
      'pay'     => 'Pay',
    ],
    'party'                      => 'Party',
    'party.placeholder'          => 'Select a party',
    'party.options'              => [
      'customer' => 'Customer',
      'supplier' => 'Supplier',
    ],
  ],
];
