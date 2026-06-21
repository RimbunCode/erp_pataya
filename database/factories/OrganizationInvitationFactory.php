<?php

namespace Database\Factories;

use App\Models\OrganizationInvitation;
use App\Models\User\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<OrganizationInvitation>
 */
class OrganizationInvitationFactory extends Factory {
    public function definition(): array {
        return [
            'token'             => Str::random(64),
            'organization_name' => fake()->company(),
            'email'             => fake()->companyEmail(),
            'contact_person'    => fake()->name(),
            'status'            => 'invited',
            'invited_by'        => User::factory(),
            'expired_at'        => now()->addDays(7),
        ];
    }

    public function withProfile(): static {
        return $this->state(fn (array $attributes) => [
            'address'        => fake()->address(),
            'phone'          => '+62' . fake()->numerify('###########'),
            'website'        => 'https://' . fake()->domainName(),
            'industry'       => fake()->randomElement(['Construction', 'Consulting', 'Engineering', 'IT', 'Education']),
            'employee_count' => fake()->randomElement(['1-10', '11-50', '51-200', '201-500', '500+']),
            'password'       => 'Password123!',
        ]);
    }

    public function submitted(): static {
        return $this->withProfile()->state(fn (array $attributes) => [
            'status'       => 'submitted',
            'submitted_at' => now(),
        ]);
    }

    public function approved(): static {
        return $this->submitted()->state(fn (array $attributes) => [
            'status'      => 'approved',
            'reviewed_by' => User::factory(),
            'reviewed_at' => now(),
        ]);
    }

    public function rejected(): static {
        return $this->submitted()->state(fn (array $attributes) => [
            'status'           => 'rejected',
            'reviewed_by'      => User::factory(),
            'reviewed_at'      => now(),
            'rejection_reason' => fake()->sentence(),
        ]);
    }

    public function expired(): static {
        return $this->state(fn (array $attributes) => [
            'expired_at' => now()->subDays(1),
        ]);
    }
}
