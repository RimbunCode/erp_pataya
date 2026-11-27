<?php

namespace Database\Factories\Finances;

use App\Models\Finances\Tax;
use App\Services\Finances\Tax\TaxRuleVersionService;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Tax>
 */
class TaxFactory extends Factory {
    protected $model = Tax::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array {
        $tax = fake()->randomElement([
            ['name' => 'VAT Standard', 'rate' => 11.00],
            ['name' => 'Withholding Tax Art 23', 'rate' => 2.00],
            ['name' => 'Service Tax', 'rate' => 5.00],
            ['name' => 'Import Tax', 'rate' => 7.50],
            ['name' => 'Luxury Goods Tax', 'rate' => 10.00],
        ]);

        return [
            'name' => $tax['name'] . ' ' . fake()->unique()->numerify('##'),
            'rate' => $tax['rate'],
        ];
    }

    /**
     * Setiap pajak buatan factory langsung punya versi aturan 1 yang berlaku sejak 1970-01-01, menyerupai kondisi
     * setelah `finance:init-tax-rules` (Finance Fase 3, Requirement 6.1). Service invoice gagal tertutup untuk pajak
     * tanpa versi (Q-P3-5), jadi tanpa ini setiap test invoice harus menyiapkan versi sendiri. Test yang memerlukan
     * pajak tanpa versi membuatnya lewat `Tax::query()->create()`.
     */
    public function configure(): static {
        return $this->afterCreating(function (Tax $tax): void {
            app(TaxRuleVersionService::class)->createInitialVersion($tax);
        });
    }
}
