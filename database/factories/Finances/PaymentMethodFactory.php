<?php

namespace Database\Factories\Finances;

use App\Models\Finances\Account;
use App\Models\Finances\PaymentMethod;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<PaymentMethod>
 */
class PaymentMethodFactory extends Factory {
    protected $model = PaymentMethod::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array {
        $method = fake()->randomElement([
            [
                'name'        => 'Cash Payment',
                'description' => 'Direct cash settlement at cashier desk.',
            ],
            [
                'name'        => 'Bank Transfer',
                'description' => 'Settlement through interbank transfer.',
            ],
            [
                'name'        => 'Virtual Account',
                'description' => 'Automated settlement using virtual account.',
            ],
            [
                'name'        => 'Credit Card',
                'description' => 'Settlement through corporate credit card.',
            ],
            [
                'name'        => 'Digital Wallet',
                'description' => 'Settlement using approved digital wallet.',
            ],
        ]);

        return [
            'name'               => $method['name'] . ' ' . fake()->unique()->numerify('##'),
            'description'        => $method['description'],
            'default_account_id' => $this->resolveAccountId(),
        ];
    }

    private function resolveAccountId(): string {
        $accountId = Account::query()
            ->where('is_group', false)
            ->inRandomOrder()
            ->value('id');

        if ($accountId) {
            return $accountId;
        }

        $account = Account::query()->first();
        if ($account) {
            return $account->id;
        }

        return Account::query()->create([
            'account_name'   => fake()->company(),
            'account_number' => fake()->unique()->numerify('9###'),
            'is_group'       => false,
            'root_type'      => 'asset',
            'report_type'    => 'balance_sheet',
            'balance_type'   => 'debit',
            'account_type'   => 'cash',
            'currency_code'  => null,
        ])->id;
    }
}
