<?php

namespace Database\Factories\User;

use App\Models\Core\File;
use App\Models\User\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * @extends Factory<User>
 */
class UserFactory extends Factory {
    /**
     * The current password being used by the factory.
     */
    protected static ?string $password;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array {
        return [
            'name'              => fake()->name(),
            'username'          => fake()->unique()->userName(),
            'email'             => fake()->unique()->safeEmail(),
            'email_verified_at' => now(),
            'password'          => static::$password ??= Hash::make('password'),
            'remember_token'    => Str::random(10),
        ];
    }

    /**
     * Indicate that the model's email address should be unverified.
     */
    public function unverified(): static {
        return $this->state(fn (array $attributes) => [
            'email_verified_at' => null,
        ]);
    }

    /**
     * Tautkan user ke sebuah File TTD dummy (PNG kosong 1x1). Dipakai test
     * yang butuh user dengan `hasSignature()` true tanpa menjalankan
     * SignatureImageService yang sesungguhnya.
     */
    public function withSignature(): static {
        return $this->afterCreating(function (User $user) {
            $file = File::create([
                'name'          => 'signature',
                'path'          => 'signatures/' . Str::uuid() . '.png',
                'extension'     => 'png',
                'mime_type'     => 'image/png',
                'is_public'     => false,
                'created_by_id' => $user->id,
            ]);

            $user->update(['signature_file_id' => $file->id]);
        });
    }
}
