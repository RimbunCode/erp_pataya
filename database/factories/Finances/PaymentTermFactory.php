<?php

namespace Database\Factories\Finances;

use App\Models\Finances\PaymentMethod;
use App\Models\Finances\PaymentTerm;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<PaymentTerm>
 */
class PaymentTermFactory extends Factory {
    protected $model = PaymentTerm::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array {
        $discountType = fake()->randomElement([null, 'percentage', 'amount']);

        return [
            'name'              => fake()->unique()->words(3, true),
            'due_date_based_on' => fake()->randomElement([
                'days_after_invoice_date',
                'weeks_after_invoice_date',
                'months_after_invoice_month',
            ]),
            'credit_period'     => fake()->numberBetween(0, 90),
            'invoice_portion'   => 100,
            'discount_type'     => $discountType,
            'discount'          => $discountType ? fake()->randomFloat(2, 1, 10) : null,
            'description'       => fake()->optional()->sentence(),
            'payment_method_id' => PaymentMethod::query()->inRandomOrder()->value('id') ?? PaymentMethodFactory::new()->create()->id,
        ];
    }
}
