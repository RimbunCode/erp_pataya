<?php

namespace Database\Factories\Finances;

use App\Models\Finances\PaymentMethod;
use App\Models\Finances\PaymentTermTemplate;
use App\Models\Finances\PaymentTermTemplateItem;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<PaymentTermTemplate>
 */
class PaymentTermTemplateFactory extends Factory {
    protected $model = PaymentTermTemplate::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array {
        return [
            'name'        => fake()->unique()->words(3, true),
            'description' => fake()->optional()->sentence(),
        ];
    }

    public function configure(): static {
        return $this->afterCreating(function (PaymentTermTemplate $paymentTermTemplate): void {
            $paymentMethodId = PaymentMethod::query()->inRandomOrder()->value('id') ?? PaymentMethodFactory::new()->create()->id;
            $installments = [60, 40];

            foreach ($installments as $index => $invoicePortion) {
                PaymentTermTemplateItem::query()->create([
                    'payment_term_template_id' => $paymentTermTemplate->id,
                    'due_date_based_on'        => fake()->randomElement([
                        'days_after_invoice_date',
                        'weeks_after_invoice_date',
                        'months_after_invoice_month',
                    ]),
                    'credit_period'   => fake()->numberBetween(0, 60) + ($index * 15),
                    'invoice_portion' => $invoicePortion,
                    'discount_type'   => null,
                    'discount'        => null,
                    'description'     => fake()->sentence(),
                    'payment_method_id' => $paymentMethodId,
                ]);
            }
        });
    }
}
