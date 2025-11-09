<?php

namespace Database\Seeders;

use App\Models\Finances\Account;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class AccountSeeder extends Seeder {
  private function createAccounts(array $data, Account $accountParent = null) {
    foreach ($data as $account) {
      $children         = $account['children'] ?? [];
      $haveTransactions = \array_key_exists('children', $account);
      unset($account['children']);

      $acc = Account::firstOrCreate(
        [
          'account_name'   => $account['account_name'],
          'account_number' => $account['account_number'],
        ],
        [
          'have_transactions' => $haveTransactions,
          ...$account,
          ...($accountParent ? [
            'parent_account_id' => $accountParent->id,
            'root_type'         => $accountParent->root_type,
            'report_type'       => $accountParent->report_type,
          ] : []),
        ],
      );
      if ($account['is_group'] ?? false) {
        $this->createAccounts($children, $acc);
      }
    }
  }

  /**
   * Run the database seeds.
   */
  public function run(): void {
    $accounts = [
      [
        'account_name'   => 'Asset',
        'account_number' => '1000',
        'is_group'       => true,
        'root_type'      => 'asset',
        'report_type'    => 'balance_sheet',
        'children'       => [
          [
            'account_name'   => 'Asset Tetap',
            'account_number' => '1100',
            'is_group'       => true,
          ],
          [
            'account_name'   => 'Asset Bergerak',
            'account_number' => '1200',
            'is_group'       => true,
            'children'       => [
              [
                'account_name'   => 'Tunai',
                'account_number' => '1210',
                'is_group'       => true,
                'children'       => [
                  [
                    'account_name'   => 'Tunai Rupiah',
                    'account_number' => '1211',
                    'account_type'   => 'cash',
                    'currency_code'  => 'IDR',
                  ],
                ],
              ],
              [
                'account_name'   => 'Bank',
                'account_number' => '1220',
                'is_group'       => true,
              ],
              [
                'account_name'   => 'Piutang',
                'account_number' => '1230',
                'is_group'       => true,
                'children'       => [
                  [
                    'account_name'   => 'Piutang Dagang',
                    'account_number' => '1231',
                    'account_type'   => 'receivable',

                  ],
                ],
              ],
              [
                'account_name'   => 'Persediaan Barang',
                'account_number' => '1240',
                'is_group'       => true,
                'children'       => [
                  [
                    'account_name'   => 'Persediaan Barang',
                    'account_type'   => 'stock',
                    'account_number' => '1241',

                  ],
                ],
              ],
            ],
          ],
        ],
      ],
      [
        'account_name'   => 'Liability',
        'account_number' => '2000',
        'is_group'       => true,
        'root_type'      => 'liability',
        'report_type'    => 'balance_sheet',
        'children'       => [
          [
            'account_name'   => 'Liability Tetap',
            'account_number' => '2100',
            'is_group'       => true,
            'children'       => [
              [
                'account_name'   => 'Hutang pada Bank',
                'is_group'       => true,
                'account_number' => '2110',
              ],

            ],
          ],
          [
            'account_name'   => 'Liability Bergerak',
            'account_number' => '2200',
            'is_group'       => true,
            'children'       => [
              [
                'account_name'   => 'Hutang Dagang',
                'account_number' => '2210',
                'is_group'       => true,
                'children'       => [
                  [
                    'account_name'   => 'Hutang Dagang',
                    'account_number' => '2210',
                    'is_group'       => true,
                    'children'       => [
                      [
                        'account_name'   => 'Hutang Dagang Dalam Negeri',
                        'account_number' => '2211',
                        'account_type'   => 'payable',
                      ],
                      [
                        'account_name'   => 'Hutang Dagang Luar Negeri',
                        'account_number' => '2212',
                        'account_type'   => 'payable',
                      ],
                    ],
                  ],
                ],
              ],
            ],
          ],
          [
            'account_name'   => 'Kewajiban dan Pajak',
            'account_number' => '2300',
            'is_group'       => true,
            'children'       => [
              [
                'account_name'   => 'VAT',
                'account_number' => '2310',
                'account_type'   => 'tax',
              ],
            ],
          ],
        ],
      ],
      [
        'account_name'   => 'Equity',
        'account_number' => '3000',
        'is_group'       => true,
        'root_type'      => 'equity',
        'report_type'    => 'balance_sheet',
        'children'       => [
          [
            'account_name'   => 'Modal',
            'account_number' => '3100',
            'is_group'       => true,
          ],
          [
            'account_name'   => 'Laba',
            'account_number' => '3200',
            'is_group'       => true,
          ],
        ],
      ],
      [
        'account_name'   => 'Income',
        'account_number' => '4000',
        'is_group'       => true,
        'root_type'      => 'income',
        'report_type'    => 'profit_and_loss',
        'children'       => [
          [
            'account_name'   => 'Penjualan Barang',
            'account_number' => '4100',
            'is_group'       => true,
            'children'       => [
              [
                'account_name'   => 'Penjualan',
                'account_number' => '4110',
                'account_type'   => 'income_account',
              ],
              [
                'account_name'   => 'Retur Penjualan',
                'account_number' => '4120',
                'account_type'   => 'income_account',
              ],
            ],
          ],
          [
            'account_name'   => 'Harga Pokok Pembelian',
            'account_number' => '4200',
            'is_group'       => true,
            'children'       => [
              [
                'account_name'   => 'HPP Pembelian',
                'account_number' => '4210',
                'account_type'   => 'cost_of_goods_sold',
              ],
            ],
          ],
          [
            'account_name'   => 'Pendapatan Lain-Lain',
            'account_number' => '4300',
            'is_group'       => true,
          ],
        ],
      ],
      [
        'account_name'   => 'Expense',
        'account_number' => '5000',
        'is_group'       => true,
        'root_type'      => 'expense',
        'report_type'    => 'profit_and_loss',
        'children'       => [
          [
            'account_name'   => 'Beban Penjualan',
            'account_number' => '5100',
            'is_group'       => true,
            'children'       => [
              [
                'account_name'   => 'Penyesuaian Stok',
                'account_number' => '5110',
                'account_type'   => 'stock_adjustment',
              ],
            ],
          ],
          [
            'account_name'   => 'Beban Operasional',
            'account_number' => '5200',
            'is_group'       => true,
          ],
          [
            'account_name'   => 'Beban Lain-Lain',
            'account_number' => '5300',
            'is_group'       => true,
          ],
        ],
      ],
    ];
    $this->createAccounts($accounts);

  }
}
