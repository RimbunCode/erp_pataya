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
        $templateType = fake()->randomElement([
            'Project Milestone',
            'Procurement Schedule',
            'Service Contract',
            'Operational Purchase',
            'Advance and Final Payment',
        ]);

        return [
            'name'        => "{$templateType} " . fake()->unique()->numerify('##'),
            'description' => "Staged payment template for {$templateType} transactions.",
        ];
    }

    public function configure(): static {
        return $this->afterCreating(function (PaymentTermTemplate $paymentTermTemplate): void {
            $paymentMethodId = PaymentMethod::query()->inRandomOrder()->value('id') ?? PaymentMethodFactory::new()->create()->id;
            $installments    = fake()->randomElement([
                [100],
                [60, 40],
                [50, 30, 20],
            ]);

            foreach ($installments as $index => $invoicePortion) {
                $discountType = $index === 0 && fake()->boolean(30)
                    ? fake()->randomElement(['percentage', 'amount'])
                    : null;

                PaymentTermTemplateItem::query()->create([
                    'payment_term_template_id' => $paymentTermTemplate->id,
                    'due_date_based_on'        => fake()->randomElement([
                        'days_after_invoice_date',
                        'weeks_after_invoice_week',
                        'months_after_invoice_month',
                    ]),
                    'credit_period'     => (($index + 1) * 15) + fake()->numberBetween(0, 10),
                    'invoice_portion'   => $invoicePortion,
                    'discount_type'     => $discountType,
                    'discount'          => $discountType ? fake()->randomFloat(2, 1, 5) : null,
                    'description'       => 'Installment ' . ($index + 1) . ' payment portion.',
                    'payment_method_id' => $paymentMethodId,
                ]);
            }
        });
    }
}
