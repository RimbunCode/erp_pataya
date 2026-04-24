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
        return [
            'name'               => fake()->unique()->words(2, true),
            'description'        => fake()->optional()->sentence(),
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
