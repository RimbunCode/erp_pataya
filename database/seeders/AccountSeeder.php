<?php

namespace Database\Seeders;

use App\Models\Finances\Account;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class AccountSeeder extends Seeder {
  private function createAccounts(array $data, ?Account $accountParent = null) {
    foreach ($data as $account) {
      $children = $account['children'] ?? [];
      unset($account['children']);

      $acc = Account::updateOrCreate(
        [
          'account_number' => $account['account_number'],
        ],
        [
          'account_name'      => $account['account_name'],
          'have_transactions' => true,
          ...$account,
          'account_type'      => ($account['is_group'] ?? false) ? null : $account['account_type'] ?? null,
          ...($accountParent ? [
            'parent_id'    => $accountParent->id,
            'root_type'    => $accountParent->root_type,
            'report_type'  => $accountParent->report_type,
            'balance_type' => $accountParent->balance_type,
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
        'balance_type'   => 'debit',
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
                'children'       => [
                  [
                    'account_name'   => 'Bank Rupiah',
                    'account_number' => '1221',
                    'account_type'   => 'bank',
                  ],
                ],
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
              [
                'account_number' => '1250',
                'account_name'   => 'Current Assets',
                'is_group'       => true,
                'children'       => [
                  [
                    'account_number' => '1251',
                    'account_name'   => 'Work in Progress',
                    'is_group'       => true,
                    'children'       => [
                      [
                        'account_number' => '1251.1',
                        'account_name'   => 'WIP Service',
                        'account_type'   => 'current_asset',
                      ],
                    ],
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
        'balance_type'   => 'credit',
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
                    'account_name'   => 'Hutang Dagang Dalam Negeri',
                    'account_number' => '2211',
                    'is_group'       => true,
                  ],
                  [
                    'account_name'   => 'Hutang Dagang Luar Negeri',
                    'account_number' => '2212',
                    'is_group'       => true,
                  ],
                  [
                    'account_name'   => 'Stock Diterima Tapi Belum Dibayar',
                    'account_number' => '2214',
                    'account_type'   => 'stock_received_but_not_billed',
                  ],
                ],
              ],
              [
                'account_name'   => 'Biaya Yang Harus Dibayar',
                'account_number' => '2220',
                'is_group'       => true,
                'children'       => [
                  [
                    'account_name'   => 'Biaya Yang Harus Dibayar',
                    'account_number' => '2221',
                    'account_type'   => 'expense_included_in_valuation',
                  ],
                ],
              ],
              [
                'account_name'   => 'Hutang Pajak',
                'account_number' => '2230',
                'account_type'   => 'payable',
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
        'balance_type'   => 'credit',
        'children'       => [
          [
            'account_name'   => 'Modal',
            'account_number' => '3100',
            'is_group'       => true,
            "children"       => [
              [
                'account_name'   => 'Pembukaan Stock',
                'account_number' => '3110',
                'account_type'   => 'stock',
              ],
            ],
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
        'balance_type'   => 'credit',
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
        'balance_type'   => 'debit',
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
