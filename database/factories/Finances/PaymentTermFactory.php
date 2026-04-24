<?php

namespace Database\Factories\Finances;

use App\Models\Finances\PaymentMethod;
use App\Models\Finances\PaymentTerm;
use Illuminate\Database\Eloquent\Factories\Factory;

/** * @extends Factory<PaymentTerm> */
class PaymentTermFactory extends Factory {
    protected $model = PaymentTerm::class;

    /**     * @return array<string, mixed>     */
    public function definition(): array {
        $dueDateBasedOn = fake()->randomElement([
            'days_after_invoice_date',
            'weeks_after_invoice_date',
            'months_after_invoice_month',
        ]);
        $creditPeriod = match ($dueDateBasedOn) {
            'days_after_invoice_date'  => fake()->numberBetween(7, 60),
            'weeks_after_invoice_date' => fake()->numberBetween(1, 8),
            default                    => fake()->numberBetween(1, 6),
        };
        $termName = match ($dueDateBasedOn) {
            'days_after_invoice_date'  => "Net {$creditPeriod} Days",
            'weeks_after_invoice_date' => "Net {$creditPeriod} Weeks",
            default                    => "Month End +{$creditPeriod}",
        };
        $discountType = fake()->randomElement([null, 'percentage', 'amount']);

        return [
            'name'              => $termName . ' ' . fake()->unique()->numerify('##'),
            'due_date_based_on' => $dueDateBasedOn,
            'credit_period'     => $creditPeriod,
            'invoice_portion'   => 100,
            'discount_type'     => $discountType,
            'discount'          => $discountType ? fake()->randomFloat(2, 1, 10) : null,
            'description'       => "Payment term based on {$dueDateBasedOn} with {$creditPeriod} period.",
            'payment_method_id' => PaymentMethod::query()->inRandomOrder()->value('id') ?? PaymentMethodFactory::new()->create()->id,
        ];
    }
}